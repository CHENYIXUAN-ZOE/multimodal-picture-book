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
  assert.match(ignore, /^\/\.secrets\/$/m);
  assert.match(ignore, /^\/data\/\*\.sqlite$/m);
  assert.match(ignore, /^\/storage\/$/m);
});

test("settings API never persists or returns the full Kimi key", async () => {
  const [server, secrets] = await Promise.all([
    load("server/index.ts"),
    load("server/secrets.ts"),
  ]);
  assert.match(server, /req\.body\.apiKey/);
  assert.match(server, /saveKimiApiKey\(body\.apiKey\)/);
  assert.doesNotMatch(server, /data:\s*body\.apiKey/);
  assert.match(secrets, /mode:\s*0o600/);
  assert.match(secrets, /hint:\s*key\s*\?\s*`••••\$\{key\.slice\(-4\)\}`/);
});

test("Kimi production requests use current model-specific parameters", async () => {
  const kimi = await load("server/kimi.ts");
  assert.match(kimi, /max_completion_tokens:\s*12_000/);
  assert.doesNotMatch(kimi, /\bmax_tokens:\s*12_000/);
  assert.match(kimi, /configuration\.model === "kimi-k3"/);
  assert.match(kimi, /body\.reasoning_effort = "low"/);
  assert.match(kimi, /configuration\.model === "kimi-k2\.6"/);
  assert.match(kimi, /body\.thinking = \{ type: "disabled" \}/);
  assert.match(kimi, /fetch\(`\$\{baseUrl\}\/models`/);
});

test("full prompt system and consistency metadata are part of production generation", async () => {
  const [presets, prompts, kimi, database, settingsUi] = await Promise.all([
    load("server/prompt-presets.ts"),
    load("server/prompts.ts"),
    load("server/kimi.ts"),
    load("server/db.ts"),
    load("app/components/StudioApp.tsx"),
  ]);

  assert.match(presets, /主题知识维度框架/);
  assert.match(presets, /禁止的故事套路/);
  assert.match(presets, /imagePrompt 必须从该页正文的核心知识点推导/);
  assert.match(prompts, /scienceImagePromptGuide/);
  assert.match(prompts, /storyImagePromptGuide/);
  assert.match(prompts, /consistencySettings/);
  assert.match(prompts, /charactersInScene/);
  assert.match(prompts, /emotion/);
  assert.match(kimi, /normalizeConsistency/);
  assert.match(database, /consistency_settings_json/);
  assert.match(database, /characters_in_scene_json/);
  assert.match(settingsUi, /scienceNegativePrompt/);
  assert.match(settingsUi, /storyNegativePrompt/);
  assert.match(settingsUi, /scienceKnowledgePointCountMin/);
});
