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
import { getKimiSecretStatus, removeKimiApiKey, saveKimiApiKey } from "./secrets";
import type { AppSettings, AuditIssue, KimiConnectionResult } from "../shared/types";

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

app.setErrorHandler((error, request, reply) => {
  const failure = error instanceof Error ? error : new Error("本地服务处理失败");
  const statusCode = (failure as Error & { statusCode?: number }).statusCode;
  const status = statusCode && statusCode >= 400 ? statusCode : 500;
  request.log.error(
    { errorName: failure.name, statusCode: status },
    "本地 API 请求处理失败",
  );
  return reply.code(status).send({
    success: false,
    error: failure.message || "本地服务处理失败",
  });
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
  const secret = getKimiSecretStatus();
  return {
    localOnly: true as const,
    database: "ready" as const,
    kimi: {
      configured: secret.configured,
      enabled: secret.configured && (settings.kimiEnabled || env.aiCallsEnabled),
      keySource: secret.source,
      keyHint: secret.hint,
      model: settings.model,
      callsToday: getCallsToday(),
      dailyLimit: Math.min(settings.dailyAiCallLimit, env.dailyAiCallLimit),
      endpointRegion: settings.kimiRegion,
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
  if (mode === "kimi" && !serviceStatus().kimi.enabled) {
    return reply.code(400).send({
      success: false,
      error: "Kimi 尚未启用，请先在创作设置中验证并保存 API Key",
    });
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
    if (!serviceStatus().kimi.enabled) {
      return reply.code(400).send({
        success: false,
        error: "Kimi 尚未启用，请先在创作设置中验证并保存 API Key",
      });
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

app.patch("/api/v1/settings", async (request, reply) => {
  const updates = (request.body || {}) as Partial<AppSettings>;
  if (updates.kimiRegion && !["cn", "global"].includes(updates.kimiRegion)) {
    return reply.code(400).send({ success: false, error: "请选择正确的 Kimi API 区域" });
  }
  if (updates.model && !["kimi-k2.6", "kimi-k3"].includes(updates.model)) {
    return reply.code(400).send({ success: false, error: "当前版本只支持 kimi-k2.6 或 kimi-k3" });
  }
  return {
    success: true,
    data: updateSettings(updates),
    services: serviceStatus(),
  };
});

app.post("/api/v1/settings/kimi-key", async (request, reply) => {
  const body = (request.body || {}) as {
    apiKey?: string;
    region?: "cn" | "global";
    model?: string;
  };
  if (!body.apiKey?.trim()) {
    return reply.code(400).send({ success: false, error: "请填写 Kimi API Key" });
  }
  const region = body.region === "global" ? "global" : "cn";
  const model = ["kimi-k2.6", "kimi-k3"].includes(body.model || "")
    ? String(body.model)
    : getSettings().model;
  const result = await testKimiConnection({ apiKey: body.apiKey, region, model });
  if (!result.selectedModelAvailable) {
    return reply.code(400).send({
      success: false,
      error: `Key 有效，但当前账号没有 ${model} 模型权限，请换一个模型后重试`,
    });
  }
  saveKimiApiKey(body.apiKey);
  const data = updateSettings({
    kimiEnabled: true,
    kimiRegion: region,
    generationMode: "kimi",
    model,
  });
  return {
    success: true,
    data,
    services: serviceStatus(),
    connection: result,
  };
});

app.delete("/api/v1/settings/kimi-key", async (request, reply) => {
  const secret = getKimiSecretStatus();
  if (secret.source === "environment") {
    return reply.code(409).send({
      success: false,
      error: "当前 Key 来自 .env.local，请在该文件中移除后重启本地服务",
    });
  }
  removeKimiApiKey();
  const data = updateSettings({ kimiEnabled: false, generationMode: "local" });
  return { success: true, data, services: serviceStatus() };
});

app.post("/api/v1/settings/test-kimi", async () => {
  const data: KimiConnectionResult = await testKimiConnection();
  return {
    success: true,
    data,
    services: serviceStatus(),
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
