import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const load = (file) => readFile(new URL(file, root), "utf8");

test("defaults to local-only and zero paid calls", async () => {
  const [example, config, kimi] = await Promise.all([
    load(".env.example"),
    load("server/config.ts"),
    load("server/kimi.ts"),
  ]);

  assert.match(example, /^AI_CALLS_ENABLED=false$/m);
  assert.match(example, /^MOONSHOT_API_KEY=$/m);
  assert.match(config, /localApiHost:\s*"127\.0\.0\.1"/);
  assert.match(config, /maxConcurrentAiCalls:\s*1/);
  assert.match(config, /maxAiRetries:\s*0/);
  assert.match(kimi, /必须明确确认本次调用可能产生费用/);
  assert.match(kimi, /getCallsToday\(\)\s*>=\s*dailyLimit/);
});

test("only official Kimi endpoints are allowlisted", async () => {
  const config = await load("server/config.ts");
  const urls = [...config.matchAll(/https:\/\/api\.moonshot\.(?:cn|ai)\/v1/g)].map(
    (match) => match[0],
  );
  assert.deepEqual(
    [...new Set(urls)].sort(),
    ["https://api.moonshot.ai/v1", "https://api.moonshot.cn/v1"],
  );
});

test("audio slot is present but has no provider", async () => {
  const [config, server] = await Promise.all([
    load("server/config.ts"),
    load("server/index.ts"),
  ]);
  assert.match(config, /audioProvider:\s*"disabled"/);
  assert.match(server, /AUDIO_PROVIDER_DISABLED/);
  assert.match(server, /当前未接入任何服务，也不会产生费用/);
});

test("runtime secrets and generated assets are ignored", async () => {
  const ignore = await load(".gitignore");
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.match(ignore, /^\/data\/\*\.sqlite$/m);
  assert.match(ignore, /^\/storage\/$/m);
});
