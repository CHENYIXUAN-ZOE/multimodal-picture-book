import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { paths } from "./config";
import {
  DEFAULT_IMAGE_STYLE,
  DEFAULT_SCIENCE_PROMPT,
  DEFAULT_STORY_PROMPT,
} from "./prompts";
import type {
  AppSettings,
  AuditIssue,
  AuditResult,
  BookPage,
  Project,
  ProjectStatus,
  Subject,
} from "../shared/types";

export const db = new DatabaseSync(paths.database);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    label_id TEXT NOT NULL,
    level1 TEXT NOT NULL DEFAULT '',
    level2 TEXT NOT NULL DEFAULT '',
    level3 TEXT NOT NULL DEFAULT '',
    chinese_name TEXT NOT NULL,
    english_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    generation_status TEXT NOT NULL DEFAULT 'pending',
    project_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_unique
    ON subjects(chinese_name, level1, level2, level3);
  CREATE INDEX IF NOT EXISTS idx_subject_level1 ON subjects(level1);
  CREATE INDEX IF NOT EXISTS idx_subject_name ON subjects(chinese_name);

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    subject_id TEXT,
    label_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    categories_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'idle',
    current_step TEXT NOT NULL DEFAULT '等待开始',
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_project_status ON projects(status);

  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    page_index INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    image_prompt TEXT NOT NULL DEFAULT '',
    image_path TEXT,
    audio_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, content_type, page_index),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT 'local',
    cost_acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    issues_json TEXT NOT NULL DEFAULT '[]',
    mode TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usage_log (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();

const defaults: AppSettings = {
  targetAge: "6—9 岁",
  sciencePageCount: 7,
  storyPageCount: 8,
  imageStyle: DEFAULT_IMAGE_STYLE,
  model: "kimi-k2.6",
  kimiEnabled: false,
  kimiRegion: "cn",
  generationMode: "local",
  dailyAiCallLimit: 20,
  sciencePrompt: DEFAULT_SCIENCE_PROMPT,
  storyPrompt: DEFAULT_STORY_PROMPT,
};

const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(key) DO NOTHING
`);

for (const [key, value] of Object.entries(defaults)) {
  upsertSetting.run(key, JSON.stringify(value), now());
}

type SubjectSeed = {
  level1: string;
  level2: string;
  level3: string;
  chineseName: string;
  englishName: string;
  description: string;
  tags: string;
};

function seedSubjects() {
  const count = Number(
    (db.prepare("SELECT COUNT(*) AS count FROM subjects").get() as { count: number }).count,
  );
  if (count > 0 || !fs.existsSync(paths.subjectSeed)) return;

  const seeds = JSON.parse(fs.readFileSync(paths.subjectSeed, "utf8")) as SubjectSeed[];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO subjects (
      id, label_id, level1, level2, level3, chinese_name, english_name,
      description, tags, generation_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
  db.exec("BEGIN");
  try {
    seeds.forEach((seed, index) => {
      const timestamp = now();
      insert.run(
        randomUUID(),
        String(index + 1001),
        seed.level1,
        seed.level2,
        seed.level3,
        seed.chineseName,
        seed.englishName,
        seed.description,
        seed.tags,
        timestamp,
        timestamp,
      );
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

seedSubjects();

const asSubject = (row: Record<string, unknown>): Subject => ({
  id: String(row.id),
  labelId: String(row.label_id),
  level1: String(row.level1),
  level2: String(row.level2),
  level3: String(row.level3),
  chineseName: String(row.chinese_name),
  englishName: String(row.english_name),
  description: String(row.description),
  tags: String(row.tags),
  generationStatus: String(row.generation_status) as Subject["generationStatus"],
  projectId: row.project_id ? String(row.project_id) : null,
  createdAt: String(row.created_at),
});

const asPage = (row: Record<string, unknown>): BookPage => ({
  id: String(row.id),
  projectId: String(row.project_id),
  contentType: String(row.content_type) as BookPage["contentType"],
  pageIndex: Number(row.page_index),
  title: String(row.title),
  text: String(row.text),
  imagePrompt: String(row.image_prompt),
  imageUrl: row.image_path ? `/api/local/storage/${String(row.image_path)}` : null,
  audioUrl: row.audio_path ? `/api/local/storage/${String(row.audio_path)}` : null,
  status: String(row.status) as BookPage["status"],
});

const asProject = (row: Record<string, unknown>): Project => ({
  id: String(row.id),
  subjectId: row.subject_id ? String(row.subject_id) : null,
  labelId: String(row.label_id),
  topic: String(row.topic),
  categories: JSON.parse(String(row.categories_json || "[]")),
  status: String(row.status) as ProjectStatus,
  currentStep: String(row.current_step),
  lastError: row.last_error ? String(row.last_error) : null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

export function getSettings(): AppSettings {
  const result = { ...defaults } as Record<string, unknown>;
  const rows = db.prepare("SELECT key, value_json FROM settings").all() as Array<{
    key: string;
    value_json: string;
  }>;
  rows.forEach((row) => {
    result[row.key] = JSON.parse(row.value_json);
  });
  return result as unknown as AppSettings;
}

export function updateSettings(updates: Partial<AppSettings>) {
  const allowed = new Set(Object.keys(defaults));
  const statement = db.prepare(`
    INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `);
  for (const [key, value] of Object.entries(updates)) {
    if (allowed.has(key) && value !== undefined) statement.run(key, JSON.stringify(value), now());
  }
  return getSettings();
}

export function listSubjects(input: {
  search?: string;
  level1?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (input.search) {
    clauses.push("(chinese_name LIKE ? OR english_name LIKE ? OR tags LIKE ?)");
    const term = `%${input.search}%`;
    params.push(term, term, term);
  }
  if (input.level1) {
    clauses.push("level1 = ?");
    params.push(input.level1);
  }
  if (input.status) {
    clauses.push("generation_status = ?");
    params.push(input.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total = Number(
    (
      db.prepare(`SELECT COUNT(*) AS count FROM subjects ${where}`).get(...params) as {
        count: number;
      }
    ).count,
  );
  const limit = Math.min(Math.max(input.limit || 50, 1), 500);
  const offset = Math.max(input.offset || 0, 0);
  const rows = db
    .prepare(
      `SELECT * FROM subjects ${where}
       ORDER BY CAST(label_id AS INTEGER), chinese_name LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as Record<string, unknown>[];
  return { data: rows.map(asSubject), total, limit, offset };
}

export function getSubjectCategories() {
  return db
    .prepare("SELECT level1, COUNT(*) AS count FROM subjects GROUP BY level1 ORDER BY level1")
    .all() as Array<{ level1: string; count: number }>;
}

export function createSubject(input: Partial<Subject>) {
  const timestamp = now();
  const id = randomUUID();
  const next = Number(
    (db.prepare("SELECT COALESCE(MAX(CAST(label_id AS INTEGER)), 1000) + 1 AS value FROM subjects").get() as { value: number }).value,
  );
  db.prepare(`
    INSERT INTO subjects (
      id, label_id, level1, level2, level3, chinese_name, english_name,
      description, tags, generation_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id,
    String(next),
    input.level1 || "",
    input.level2 || "",
    input.level3 || "",
    input.chineseName || "",
    input.englishName || "",
    input.description || "",
    input.tags || "",
    timestamp,
    timestamp,
  );
  return asSubject(db.prepare("SELECT * FROM subjects WHERE id = ?").get(id) as Record<string, unknown>);
}

export function importSubjects(subjects: SubjectSeed[]) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO subjects (
      id, label_id, level1, level2, level3, chinese_name, english_name,
      description, tags, generation_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
  let imported = 0;
  const base = Number(
    (db.prepare("SELECT COALESCE(MAX(CAST(label_id AS INTEGER)), 1000) AS value FROM subjects").get() as { value: number }).value,
  );
  db.exec("BEGIN");
  try {
    subjects.forEach((subject, index) => {
      const timestamp = now();
      const result = insert.run(
        randomUUID(),
        String(base + index + 1),
        subject.level1,
        subject.level2,
        subject.level3,
        subject.chineseName,
        subject.englishName,
        subject.description,
        subject.tags,
        timestamp,
        timestamp,
      );
      imported += Number(result.changes || 0);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { imported, skipped: subjects.length - imported };
}

export function deleteSubject(id: string) {
  return db.prepare("DELETE FROM subjects WHERE id = ?").run(id);
}

export function createProject(input: {
  subjectId?: string;
  topic?: string;
  categories?: string[];
}) {
  let subject: Subject | null = null;
  if (input.subjectId) {
    const row = db.prepare("SELECT * FROM subjects WHERE id = ?").get(input.subjectId);
    subject = row ? asSubject(row as Record<string, unknown>) : null;
  }
  const id = randomUUID();
  const timestamp = now();
  const topic = input.topic || subject?.chineseName || "未命名主题";
  const categories = input.categories || (subject ? [subject.level1, subject.level2, subject.level3] : []);
  const labelId = subject?.labelId || `P${Date.now().toString().slice(-6)}`;
  db.prepare(`
    INSERT INTO projects (
      id, subject_id, label_id, topic, categories_json, status,
      current_step, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'idle', '等待开始', ?, ?)
  `).run(id, subject?.id || null, labelId, topic, JSON.stringify(categories), timestamp, timestamp);
  if (subject) {
    db.prepare(
      "UPDATE subjects SET project_id = ?, generation_status = 'idle', updated_at = ? WHERE id = ?",
    ).run(id, timestamp, subject.id);
  }
  return getProject(id)!;
}

export function createProjectsFromSubjects(subjectIds: string[]) {
  return subjectIds.map((subjectId) => {
    const existing = db.prepare("SELECT id FROM projects WHERE subject_id = ?").get(subjectId) as
      | { id: string }
      | undefined;
    return existing ? getProject(existing.id)! : createProject({ subjectId });
  });
}

export function listProjects(input: { status?: string; limit?: number } = {}) {
  const params: Array<string | number> = [];
  const where = input.status ? "WHERE status = ?" : "";
  if (input.status) params.push(input.status);
  params.push(Math.min(input.limit || 200, 500));
  return (
    db.prepare(`SELECT * FROM projects ${where} ORDER BY updated_at DESC LIMIT ?`).all(...params) as Record<
      string,
      unknown
    >[]
  ).map(asProject);
}

export function getProject(id: string) {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!row) return null;
  const project = asProject(row as Record<string, unknown>);
  project.pages = (
    db
      .prepare("SELECT * FROM pages WHERE project_id = ? ORDER BY content_type, page_index")
      .all(id) as Record<string, unknown>[]
  ).map(asPage);
  project.audit = getAudit(id);
  return project;
}

export function updateProject(
  id: string,
  updates: Partial<Pick<Project, "status" | "currentStep" | "lastError">>,
) {
  const current = getProject(id);
  if (!current) return null;
  const status = updates.status || current.status;
  const currentStep = updates.currentStep ?? current.currentStep;
  const lastError =
    updates.lastError === undefined ? (current.lastError ?? null) : (updates.lastError ?? null);
  db.prepare(
    "UPDATE projects SET status = ?, current_step = ?, last_error = ?, updated_at = ? WHERE id = ?",
  ).run(status, currentStep, lastError, now(), id);
  if (current.subjectId) {
    db.prepare(
      "UPDATE subjects SET generation_status = ?, updated_at = ? WHERE id = ?",
    ).run(status, now(), current.subjectId);
  }
  return getProject(id);
}

export function deleteProject(id: string) {
  const project = getProject(id);
  if (project?.subjectId) {
    db.prepare(
      "UPDATE subjects SET project_id = NULL, generation_status = 'pending', updated_at = ? WHERE id = ?",
    ).run(now(), project.subjectId);
  }
  return db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export function replacePages(
  projectId: string,
  content: {
    science: Array<{ title: string; text: string; imagePrompt: string }>;
    story: Array<{ title: string; text: string; imagePrompt: string }>;
  },
) {
  db.prepare("DELETE FROM pages WHERE project_id = ?").run(projectId);
  const insert = db.prepare(`
    INSERT INTO pages (
      id, project_id, content_type, page_index, title, text,
      image_prompt, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'placeholder', ?, ?)
  `);
  db.exec("BEGIN");
  try {
    (["science", "story"] as const).forEach((contentType) => {
      content[contentType].forEach((page, index) => {
        const timestamp = now();
        insert.run(
          randomUUID(),
          projectId,
          contentType,
          index,
          page.title,
          page.text,
          page.imagePrompt,
          timestamp,
          timestamp,
        );
      });
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getProject(projectId);
}

export function updatePage(
  id: string,
  updates: Partial<Pick<BookPage, "title" | "text" | "imagePrompt" | "status">> & {
    imagePath?: string | null;
  },
) {
  const row = db.prepare("SELECT * FROM pages WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  db.prepare(`
    UPDATE pages SET title = ?, text = ?, image_prompt = ?, image_path = ?,
      status = ?, updated_at = ? WHERE id = ?
  `).run(
    updates.title ?? String(row.title),
    updates.text ?? String(row.text),
    updates.imagePrompt ?? String(row.image_prompt),
    updates.imagePath === undefined
      ? row.image_path
        ? String(row.image_path)
        : null
      : updates.imagePath,
    updates.status ?? String(row.status),
    now(),
    id,
  );
  return asPage(db.prepare("SELECT * FROM pages WHERE id = ?").get(id) as Record<string, unknown>);
}

export function getPage(id: string) {
  const row = db.prepare("SELECT * FROM pages WHERE id = ?").get(id);
  return row ? asPage(row as Record<string, unknown>) : null;
}

export function createTask(projectId: string, mode: "local" | "kimi", costAcknowledged: boolean) {
  const existing = db
    .prepare("SELECT id FROM tasks WHERE project_id = ? AND status IN ('queued','processing') LIMIT 1")
    .get(projectId);
  if (existing) return existing as { id: string };
  const id = randomUUID();
  const timestamp = now();
  db.prepare(`
    INSERT INTO tasks (
      id, project_id, status, progress, message, mode, cost_acknowledged,
      created_at, updated_at
    ) VALUES (?, ?, 'queued', 0, '等待生成', ?, ?, ?, ?)
  `).run(id, projectId, mode, costAcknowledged ? 1 : 0, timestamp, timestamp);
  updateProject(projectId, { status: "queued", currentStep: "已加入生成队列", lastError: null });
  return { id };
}

export function getNextTask() {
  return db
    .prepare(
      `SELECT tasks.*, projects.topic FROM tasks
       JOIN projects ON projects.id = tasks.project_id
       WHERE tasks.status = 'queued' ORDER BY tasks.created_at LIMIT 1`,
    )
    .get() as
    | {
        id: string;
        project_id: string;
        topic: string;
        mode: "local" | "kimi";
        cost_acknowledged: number;
      }
    | undefined;
}

export function updateTask(id: string, status: string, progress: number, message: string) {
  db.prepare(
    "UPDATE tasks SET status = ?, progress = ?, message = ?, updated_at = ? WHERE id = ?",
  ).run(status, progress, message, now(), id);
}

export function listTasks() {
  return db
    .prepare(
      `SELECT tasks.*, projects.topic FROM tasks
       JOIN projects ON projects.id = tasks.project_id
       WHERE tasks.status IN ('queued','processing','paused')
       ORDER BY tasks.created_at`,
    )
    .all() as Array<Record<string, unknown>>;
}

export function pauseQueuedTasks() {
  db.prepare("UPDATE tasks SET status = 'paused', updated_at = ? WHERE status = 'queued'").run(now());
}

export function resumePausedTasks() {
  db.prepare("UPDATE tasks SET status = 'queued', updated_at = ? WHERE status = 'paused'").run(now());
}

export function cancelProjectTasks(projectId: string) {
  db.prepare(
    "UPDATE tasks SET status = 'cancelled', message = '已取消', updated_at = ? WHERE project_id = ? AND status IN ('queued','paused')",
  ).run(now(), projectId);
  updateProject(projectId, { status: "cancelled", currentStep: "生成已取消" });
}

export function saveAudit(projectId: string, score: number, issues: AuditIssue[], mode: "local" | "kimi") {
  const id = randomUUID();
  const timestamp = now();
  db.prepare("DELETE FROM audits WHERE project_id = ?").run(projectId);
  db.prepare(
    "INSERT INTO audits (id, project_id, score, issues_json, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, projectId, score, JSON.stringify(issues), mode, timestamp);
  updateProject(projectId, {
    status: issues.some((issue) => issue.severity === "high" || issue.severity === "medium")
      ? "review_needed"
      : "complete",
    currentStep: "审核完成",
  });
  return getAudit(projectId)!;
}

export function getAudit(projectId: string): AuditResult | null {
  const row = db.prepare("SELECT * FROM audits WHERE project_id = ?").get(projectId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    score: Number(row.score),
    issues: JSON.parse(String(row.issues_json)),
    mode: String(row.mode) as "local" | "kimi",
    createdAt: String(row.created_at),
  };
}

export function recordUsage(model: string, inputTokens: number, outputTokens: number) {
  db.prepare(
    "INSERT INTO usage_log (id, provider, model, input_tokens, output_tokens, created_at) VALUES (?, 'kimi', ?, ?, ?, ?)",
  ).run(randomUUID(), model, inputTokens, outputTokens, now());
}

export function getCallsToday() {
  return Number(
    (
      db
        .prepare("SELECT COUNT(*) AS count FROM usage_log WHERE created_at >= ?")
        .get(new Date().toISOString().slice(0, 10)) as { count: number }
    ).count,
  );
}

export function getDashboardCounts() {
  const scalar = (sql: string) =>
    Number((db.prepare(sql).get() as { count: number }).count);
  return {
    subjectCount: scalar("SELECT COUNT(*) AS count FROM subjects"),
    projectCount: scalar("SELECT COUNT(*) AS count FROM projects"),
    completedCount: scalar("SELECT COUNT(*) AS count FROM projects WHERE status = 'complete'"),
    reviewCount: scalar("SELECT COUNT(*) AS count FROM projects WHERE status = 'review_needed'"),
    queuedCount: scalar("SELECT COUNT(*) AS count FROM projects WHERE status IN ('queued','processing','planning')"),
    generatedPages: scalar("SELECT COUNT(*) AS count FROM pages"),
  };
}
