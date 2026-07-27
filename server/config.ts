import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));

dotenv.config({ path: path.join(projectRoot, ".env.local") });
dotenv.config({ path: path.join(projectRoot, ".env") });

const integer = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const officialKimiEndpoints = new Map([
  ["https://api.moonshot.cn/v1", "cn"],
  ["https://api.moonshot.ai/v1", "global"],
] as const);

const kimiBaseUrl = (process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1").replace(/\/+$/, "");

if (!officialKimiEndpoints.has(kimiBaseUrl as never)) {
  throw new Error("KIMI_BASE_URL 必须使用 Kimi 官方中国区或国际区端点");
}

export const env = {
  localApiHost: "127.0.0.1",
  localApiPort: integer(process.env.LOCAL_API_PORT, 43120),
  aiCallsEnabled: process.env.AI_CALLS_ENABLED === "true",
  moonshotApiKey: process.env.MOONSHOT_API_KEY || "",
  kimiBaseUrl,
  kimiRegion: officialKimiEndpoints.get(kimiBaseUrl as never) || "cn",
  kimiModel: process.env.KIMI_MODEL || "kimi-k2.6",
  dailyAiCallLimit: integer(process.env.DAILY_AI_CALL_LIMIT, 20),
  maxConcurrentAiCalls: 1,
  maxAiRetries: 0,
  audioProvider: "disabled" as const,
};

export const paths = {
  data: path.join(projectRoot, "data"),
  database: path.join(projectRoot, "data", "multimodal-picture-book.sqlite"),
  subjectSeed: path.join(projectRoot, "data", "subjects.seed.json"),
  storage: path.join(projectRoot, "storage"),
  projects: path.join(projectRoot, "storage", "projects"),
  exports: path.join(projectRoot, "storage", "exports"),
};

for (const directory of [paths.data, paths.storage, paths.projects, paths.exports]) {
  fs.mkdirSync(directory, { recursive: true });
}
