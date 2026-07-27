import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ZipArchive } from "archiver";
import readXlsxFile from "read-excel-file/node";
import { env, paths } from "./config";
import {
  cancelProjectTasks,
  createProject,
  createProjectsFromSubjects,
  createSubject,
  createTask,
  deleteProject,
  deleteSubject,
  getCallsToday,
  getDashboardCounts,
  getPage,
  getProject,
  getSettings,
  getSubjectCategories,
  importSubjects,
  listProjects,
  listSubjects,
  pauseQueuedTasks,
  resumePausedTasks,
  saveAudit,
  updatePage,
  updateProject,
  updateSettings,
} from "./db";
import { auditWithKimi, testKimiConnection } from "./kimi";
import { getQueueState, setQueuePaused } from "./queue";
import { createPlaceholder } from "./placeholder";
import type { AppSettings, AuditIssue } from "../shared/types";

const app = Fastify({
  logger: {
    level: "info",
    redact: {
      paths: ["req.headers.authorization", "req.body.apiKey", "req.body.key"],
      censor: "[REDACTED]",
    },
  },
  bodyLimit: 20 * 1024 * 1024,
});

await app.register(multipart, {
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
});

await app.register(fastifyStatic, {
  root: paths.storage,
  prefix: "/storage/",
  decorateReply: false,
});

app.addHook("onRequest", async (request, reply) => {
  const remote = request.ip;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
    return reply.code(403).send({ success: false, error: "仅允许本机访问" });
  }
});

app.get("/api/v1/health", async () => ({
  success: true,
  data: serviceStatus(),
}));

function serviceStatus() {
  const settings = getSettings();
  return {
    localOnly: true as const,
    database: "ready" as const,
    kimi: {
      configured: Boolean(env.moonshotApiKey),
      enabled: env.aiCallsEnabled,
      model: settings.model,
      callsToday: getCallsToday(),
      dailyLimit: Math.min(settings.dailyAiCallLimit, env.dailyAiCallLimit),
      endpointRegion: env.kimiRegion,
    },
    image: {
      provider: "local-placeholder" as const,
      generationAvailable: false,
      uploadAvailable: true,
    },
    audio: {
      provider: "disabled" as const,
      reserved: true,
    },
  };
}

app.get("/api/v1/dashboard", async () => ({
  success: true,
  data: {
    ...getDashboardCounts(),
    recentProjects: listProjects({ limit: 6 }),
    queue: getQueueState(),
    services: serviceStatus(),
  },
}));

app.get("/api/v1/subjects", async (request) => {
  const query = request.query as Record<string, string | undefined>;
  return {
    success: true,
    ...listSubjects({
      search: query.search,
      level1: query.level1,
      status: query.status,
      limit: Number(query.limit || 50),
      offset: Number(query.offset || 0),
    }),
  };
});

app.get("/api/v1/subjects/categories", async () => ({
  success: true,
  data: getSubjectCategories(),
}));

app.post("/api/v1/subjects", async (request, reply) => {
  const body = request.body as {
    chineseName?: string;
    englishName?: string;
    level1?: string;
    level2?: string;
    level3?: string;
    description?: string;
    tags?: string;
  };
  if (!body.chineseName?.trim()) {
    return reply.code(400).send({ success: false, error: "中文名称不能为空" });
  }
  return { success: true, data: createSubject(body) };
});

app.delete("/api/v1/subjects/:id", async (request) => {
  const { id } = request.params as { id: string };
  deleteSubject(id);
  return { success: true };
});

app.post("/api/v1/subjects/import", async (request, reply) => {
  const part = await request.file();
  if (!part) return reply.code(400).send({ success: false, error: "请选择 Excel 文件" });
  if (!part.filename.toLowerCase().endsWith(".xlsx")) {
    return reply.code(400).send({ success: false, error: "只支持 .xlsx 文件" });
  }
  const temporary = path.join(paths.data, `import-${Date.now()}.xlsx`);
  await pipeline(part.file, fs.createWriteStream(temporary, { mode: 0o600 }));
  try {
    const sheets = await readXlsxFile(temporary);
    const subjects: Array<{
      level1: string;
      level2: string;
      level3: string;
      chineseName: string;
      englishName: string;
      description: string;
      tags: string;
    }> = [];
    for (const { data: rows } of sheets) {
      rows.slice(1).forEach((row) => {
        const chineseName = String(row[3] || "").trim();
        if (!chineseName) return;
        subjects.push({
          level1: String(row[0] || "").trim(),
          level2: String(row[1] || "").trim(),
          level3: String(row[2] || "").trim(),
          chineseName,
          englishName: String(row[4] || "").trim(),
          description: String(row[5] || "").trim(),
          tags: String(row[6] || "").trim(),
        });
      });
    }
    return { success: true, data: { total: subjects.length, ...importSubjects(subjects) } };
  } finally {
    fs.rmSync(temporary, { force: true });
  }
});

app.get("/api/v1/projects", async (request) => {
  const query = request.query as Record<string, string | undefined>;
  return {
    success: true,
    data: listProjects({ status: query.status, limit: Number(query.limit || 200) }),
  };
});

app.get("/api/v1/projects/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const project = getProject(id);
  if (!project) return reply.code(404).send({ success: false, error: "项目不存在" });
  return { success: true, data: project };
});

app.post("/api/v1/projects", async (request) => {
  const body = request.body as {
    subjectIds?: string[];
    subjectId?: string;
    topic?: string;
    categories?: string[];
  };
  const projects = body.subjectIds?.length
    ? createProjectsFromSubjects(body.subjectIds)
    : [createProject(body)];
  return { success: true, data: projects };
});

app.delete("/api/v1/projects/:id", async (request) => {
  const { id } = request.params as { id: string };
  deleteProject(id);
  const directory = path.join(paths.projects, id);
  fs.rmSync(directory, { recursive: true, force: true });
  return { success: true };
});

app.post("/api/v1/projects/:id/generate", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body || {}) as {
    mode?: "local" | "kimi";
    acknowledgeCost?: boolean;
  };
  if (!getProject(id)) return reply.code(404).send({ success: false, error: "项目不存在" });
  const mode = body.mode === "kimi" ? "kimi" : "local";
  if (mode === "kimi" && !body.acknowledgeCost) {
    return reply
      .code(400)
      .send({ success: false, error: "必须明确确认本次 Kimi 调用可能产生费用" });
  }
  return {
    success: true,
    data: createTask(id, mode, Boolean(body.acknowledgeCost)),
  };
});

app.post("/api/v1/projects/:id/cancel", async (request) => {
  const { id } = request.params as { id: string };
  cancelProjectTasks(id);
  return { success: true };
});

app.post("/api/v1/projects/:id/resume", async (request) => {
  const { id } = request.params as { id: string };
  updateProject(id, { status: "idle", currentStep: "已恢复，可重新加入队列", lastError: null });
  return { success: true };
});

app.post("/api/v1/projects/:id/audit", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body || {}) as {
    mode?: "local" | "kimi";
    acknowledgeCost?: boolean;
  };
  const project = getProject(id);
  if (!project) return reply.code(404).send({ success: false, error: "项目不存在" });
  if (!project.pages?.length) {
    return reply.code(400).send({ success: false, error: "请先生成绘本内容" });
  }
  if (body.mode === "kimi") {
    if (!body.acknowledgeCost) {
      return reply
        .code(400)
        .send({ success: false, error: "必须明确确认本次 Kimi 调用可能产生费用" });
    }
    const result = await auditWithKimi({
      topic: project.topic,
      pages: project.pages.map((page) => ({
        contentType: page.contentType,
        pageIndex: page.pageIndex,
        text: page.text,
        imagePrompt: page.imagePrompt,
      })),
      acknowledgeCost: true,
    });
    return {
      success: true,
      data: saveAudit(id, Math.round(result.score), result.issues, "kimi"),
    };
  }
  const issues: AuditIssue[] = [];
  project.pages.forEach((page) => {
    if (page.text.length < 35) {
      issues.push({
        type: "age_fit",
        severity: "low",
        pageIndex: page.pageIndex,
        message: "本页文字较短，知识或情节可能不够完整。",
        suggestion: "补充一个清晰事实、动作或自然互动问题。",
        status: "open",
      });
    }
    if (page.imagePrompt.length < 45) {
      issues.push({
        type: "visual",
        severity: "medium",
        pageIndex: page.pageIndex,
        message: "图片提示词缺少足够的视觉信息。",
        suggestion: "补充主体动作、场景、镜头和光线。",
        status: "open",
      });
    }
  });
  const score = Math.max(60, 100 - issues.length * 4);
  return { success: true, data: saveAudit(id, score, issues, "local") };
});

app.patch("/api/v1/pages/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const page = updatePage(id, request.body as never);
  if (!page) return reply.code(404).send({ success: false, error: "页面不存在" });
  return { success: true, data: page };
});

app.post("/api/v1/pages/:id/regenerate-image", async (request, reply) => {
  const { id } = request.params as { id: string };
  const page = getPage(id);
  if (!page) return reply.code(404).send({ success: false, error: "页面不存在" });
  const project = getProject(page.projectId)!;
  const imagePath = await createPlaceholder({
    projectId: page.projectId,
    contentType: page.contentType,
    pageIndex: page.pageIndex,
    topic: project.topic,
    title: page.title,
  });
  return {
    success: true,
    data: updatePage(id, { imagePath, status: "complete" }),
    message: "已重新生成零费用本地占位图",
  };
});

app.post("/api/v1/pages/:id/upload-image", async (request, reply) => {
  const { id } = request.params as { id: string };
  const page = getPage(id);
  if (!page) return reply.code(404).send({ success: false, error: "页面不存在" });
  const part = await request.file();
  if (!part || !part.mimetype.startsWith("image/")) {
    return reply.code(400).send({ success: false, error: "请选择图片文件" });
  }
  const extension = part.mimetype === "image/png" ? "png" : "jpg";
  const relativeDirectory = path.join("projects", page.projectId, page.contentType);
  const absoluteDirectory = path.join(paths.storage, relativeDirectory);
  fs.mkdirSync(absoluteDirectory, { recursive: true });
  const fileName = `page_${String(page.pageIndex).padStart(3, "0")}_uploaded.${extension}`;
  await pipeline(part.file, fs.createWriteStream(path.join(absoluteDirectory, fileName), { mode: 0o600 }));
  const imagePath = path.posix.join(relativeDirectory.split(path.sep).join("/"), fileName);
  return { success: true, data: updatePage(id, { imagePath, status: "complete" }) };
});

app.post("/api/v1/pages/:id/regenerate-audio", async (_request, reply) =>
  reply.code(501).send({
    success: false,
    error: "音频接口已保留，但当前未接入任何服务，也不会产生费用",
    code: "AUDIO_PROVIDER_DISABLED",
  }),
);

app.get("/api/v1/queue", async () => ({ success: true, data: getQueueState() }));

app.post("/api/v1/queue/pause", async () => {
  setQueuePaused(true);
  pauseQueuedTasks();
  return { success: true, data: getQueueState() };
});

app.post("/api/v1/queue/resume", async () => {
  setQueuePaused(false);
  resumePausedTasks();
  return { success: true, data: getQueueState() };
});

app.get("/api/v1/settings", async () => ({
  success: true,
  data: getSettings(),
  services: serviceStatus(),
}));

app.patch("/api/v1/settings", async (request) => ({
  success: true,
  data: updateSettings(request.body as Partial<AppSettings>),
}));

app.post("/api/v1/settings/test-kimi", async (request) => {
  const body = (request.body || {}) as { acknowledgeCost?: boolean };
  return {
    success: true,
    data: await testKimiConnection(Boolean(body.acknowledgeCost)),
  };
});

app.get("/api/v1/exports/:id/download", async (request, reply) => {
  const { id } = request.params as { id: string };
  const project = getProject(id);
  if (!project) return reply.code(404).send({ success: false, error: "项目不存在" });
  const safeName = project.topic.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  reply.header("Content-Type", "application/zip");
  reply.header(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}-多模态绘本.zip`)}`,
  );
  const archive = new ZipArchive({ zlib: { level: 8 } });
  archive.on("error", (error: Error) => reply.raw.destroy(error));
  archive.pipe(reply.raw);
  archive.append(
    JSON.stringify(
      {
        project: {
          id: project.id,
          topic: project.topic,
          categories: project.categories,
          exportedAt: new Date().toISOString(),
          audioProvider: "disabled",
          imageProvider: "local-placeholder-or-upload",
        },
        pages: project.pages,
        audit: project.audit,
      },
      null,
      2,
    ),
    { name: "content.json" },
  );
  const projectDirectory = path.join(paths.projects, id);
  if (fs.existsSync(projectDirectory)) archive.directory(projectDirectory, "assets");
  await archive.finalize();
  return reply;
});

try {
  await app.listen({ host: env.localApiHost, port: env.localApiPort });
  app.log.info(`多模态绘本本地服务已启动：127.0.0.1:${env.localApiPort}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
