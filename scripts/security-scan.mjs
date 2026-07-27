import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter(
    (file) =>
      !file.startsWith(".wrangler/") &&
      !file.startsWith("public/multimodal-picture-book-cover.png") &&
      file !== "scripts/security-scan.mjs" &&
      file !== "package-lock.json",
  );

const forbiddenProviders = [
  ["旧 Gemini 服务", /generativelanguage\.googleapis\.com|google\.generativeai|@google\/generative-ai/i],
  ["旧 MiniMax 服务", /api\.minimax|group_id|minimax[_-]?(api|key|token)/i],
  ["旧远程基础设施", /\b(mysql|redis|bullmq):\/\/|DB_HOST|REDIS_HOST|REMOTE_SERVER/i],
];

const likelySecrets = [
  ["通用 Bearer 密钥", /\bBearer\s+[A-Za-z0-9_\-.]{24,}/],
  ["OpenAI 风格密钥", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["Moonshot 密钥值", /MOONSHOT_API_KEY[ \t]*=[ \t]*["']?[A-Za-z0-9_-]{20,}/],
  ["私钥", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

const findings = [];
for (const relative of files) {
  const full = path.join(root, relative);
  if (!existsSync(full)) continue;
  let content;
  try {
    content = readFileSync(full, "utf8");
  } catch {
    continue;
  }
  for (const [name, pattern] of [...forbiddenProviders, ...likelySecrets]) {
    if (pattern.test(content)) findings.push(`${relative}: ${name}`);
  }
}

const config = readFileSync(path.join(root, "server/config.ts"), "utf8");
for (const endpoint of config.matchAll(/https:\/\/api\.moonshot\.(?:cn|ai)\/v1/g)) {
  if (!["https://api.moonshot.cn/v1", "https://api.moonshot.ai/v1"].includes(endpoint[0])) {
    findings.push(`server/config.ts: 非官方 Kimi 端点 ${endpoint[0]}`);
  }
}

if (findings.length) {
  console.error("安全扫描未通过：");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(
  `安全扫描通过：检查 ${files.length} 个项目文件，未发现旧供应商、远程基础设施或疑似真实密钥。`,
);
