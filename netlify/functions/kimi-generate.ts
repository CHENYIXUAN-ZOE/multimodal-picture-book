import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { SESSION_COOKIE, verifySessionToken } from "../../app/lib/session";
import { buildBookPrompt } from "../../server/prompts";
import type { AppSettings, ConsistencySettings, CoreSubject } from "../../shared/types";

type Input = {
  topic?: unknown;
  categories?: unknown;
  acknowledgeCost?: unknown;
  settings?: Partial<AppSettings>;
};

type RawConsistency = Partial<ConsistencySettings> & {
  coreSubjects?: Array<Partial<CoreSubject>>;
};

type RawPage = {
  title?: string;
  text?: string;
  imagePrompt?: string;
  charactersInScene?: unknown;
  emotion?: string;
};

const jsonHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function boundedText(value: unknown, fallback: string, max: number) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return (text || fallback).slice(0, max);
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function safeSettings(input: Partial<AppSettings> | undefined) {
  return {
    targetAge: boundedText(input?.targetAge, "6—9 岁", 40),
    sciencePageCount: boundedInteger(input?.sciencePageCount, 7, 3, 10),
    storyPageCount: boundedInteger(input?.storyPageCount, 8, 3, 10),
    scienceKnowledgePointCountMin: boundedInteger(input?.scienceKnowledgePointCountMin, 6, 3, 12),
    scienceKnowledgePointCountMax: boundedInteger(input?.scienceKnowledgePointCountMax, 9, 3, 15),
    sciencePrompt: boundedText(input?.sciencePrompt, "为儿童创作准确、清晰的科普绘本。", 12_000),
    storyPrompt: boundedText(input?.storyPrompt, "为儿童创作温暖、有起伏的故事绘本。", 12_000),
    scienceImageStylePrompt: boundedText(input?.scienceImageStylePrompt, "playful children's science picture book", 4_000),
    scienceNegativePrompt: boundedText(input?.scienceNegativePrompt, "text, watermark, horror, malformed anatomy", 4_000),
    scienceImagePromptGuide: boundedText(input?.scienceImagePromptGuide, "Describe subject, action, setting, composition, lighting and color.", 8_000),
    storyImageStylePrompt: boundedText(input?.storyImageStylePrompt, "warm watercolor children's storybook", 4_000),
    storyNegativePrompt: boundedText(input?.storyNegativePrompt, "text, watermark, horror, inconsistent character design", 4_000),
    storyImagePromptGuide: boundedText(input?.storyImagePromptGuide, "Keep character design consistent and describe emotion, action, setting and camera.", 8_000),
  };
}

async function reserveDailyCall(limit: number) {
  const day = new Date().toISOString().slice(0, 10);
  const store = getStore({ name: "kimi-private-demo-usage", consistency: "strong" });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = (await store.getWithMetadata(day, { type: "json" })) as {
      data: { count?: number } | null;
      etag?: string;
    };
    const count = Number(current.data?.count || 0);
    if (count >= limit) return { allowed: false, count, limit };
    const result = await store.setJSON(
      day,
      { count: count + 1, updatedAt: new Date().toISOString() },
      current.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    );
    if (result.modified) return { allowed: true, count: count + 1, limit };
  }
  throw new Error("无法安全更新今日调用计数");
}

function normalizeConsistency(value: RawConsistency | undefined, fallbackArtStyle: string) {
  if (!value) return null;
  const allowedTypes = new Set(["character_story", "lifecycle", "concept", "comparison"]);
  return {
    type: allowedTypes.has(String(value.type))
      ? (value.type as ConsistencySettings["type"])
      : "concept",
    narrativeReason: value.narrativeReason ? String(value.narrativeReason) : undefined,
    coreSubjects: Array.isArray(value.coreSubjects)
      ? value.coreSubjects.slice(0, 8).map((subject) => ({
          name: String(subject.name || "").slice(0, 100),
          headFeatures: String(subject.headFeatures || "").slice(0, 500),
          bodyType: String(subject.bodyType || "").slice(0, 500),
          otherFeatures: String(subject.otherFeatures || "").slice(0, 500),
          personality: subject.personality ? String(subject.personality).slice(0, 500) : undefined,
        }))
      : [],
    artStyle: String(value.artStyle || fallbackArtStyle).slice(0, 1_000),
    colorPalette: String(value.colorPalette || "").slice(0, 1_000),
    storyTheme: value.storyTheme ? String(value.storyTheme).slice(0, 1_000) : undefined,
  } satisfies ConsistencySettings;
}

function normalizePages(pages: RawPage[] | undefined, expected: number) {
  if (!Array.isArray(pages) || pages.length !== expected) {
    throw new Error(`Kimi 返回的页数不符合要求（应为 ${expected} 页）`);
  }
  return pages.map((page, index) => ({
    title: String(page.title || `第 ${index + 1} 页`).slice(0, 200),
    text: String(page.text || "").slice(0, 4_000),
    imagePrompt: String(page.imagePrompt || "").slice(0, 5_000),
    charactersInScene: Array.isArray(page.charactersInScene)
      ? page.charactersInScene.map(String).filter(Boolean).slice(0, 12)
      : [],
    emotion: String(page.emotion || "").slice(0, 500),
  }));
}

export default async function handler(request: Request) {
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const password = process.env.PROTECTED_PAGE_PASSWORD;
  if (!(await verifySessionToken(readCookie(request, SESSION_COOKIE), password))) {
    return json({ success: false, error: "请先登录私人演示站" }, 401);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ success: false, error: "已拒绝跨站请求" }, 403);
  }
  const apiKey = process.env.MOONSHOT_API_KEY || "";
  if (!apiKey) return json({ success: false, error: "Netlify 尚未配置 Kimi API Key" }, 503);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 100_000) return json({ success: false, error: "请求内容过大" }, 413);
  const input = (await request.json().catch(() => null)) as Input | null;
  if (!input || input.acknowledgeCost !== true) {
    return json({ success: false, error: "必须明确确认本次 Kimi 调用可能产生费用" }, 400);
  }
  const topic = boundedText(input.topic, "", 200);
  if (!topic) return json({ success: false, error: "请填写绘本主题" }, 400);
  const categories = Array.isArray(input.categories)
    ? input.categories.map((item) => String(item).slice(0, 100)).filter(Boolean).slice(0, 6)
    : [];
  const settings = safeSettings(input.settings);
  if (settings.scienceKnowledgePointCountMax < settings.scienceKnowledgePointCountMin) {
    settings.scienceKnowledgePointCountMax = settings.scienceKnowledgePointCountMin;
  }

  const dailyLimit = boundedInteger(process.env.KIMI_DAILY_LIMIT, 12, 1, 50);
  let usage: { allowed: boolean; count: number; limit: number };
  try {
    usage = await reserveDailyCall(dailyLimit);
  } catch {
    return json({ success: false, error: "无法验证今日调用上限，已为安全起见停止请求" }, 503);
  }
  if (!usage.allowed) {
    return json({ success: false, error: `已达到今日 Kimi 调用上限（${usage.limit} 次）` }, 429);
  }

  const model = ["kimi-k2.6", "kimi-k3"].includes(process.env.KIMI_MODEL || "")
    ? String(process.env.KIMI_MODEL)
    : "kimi-k2.6";
  const baseUrl = process.env.KIMI_REGION === "global"
    ? "https://api.moonshot.ai/v1"
    : "https://api.moonshot.cn/v1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: "你是严谨、温暖的儿童多模态绘本创作助手。" },
        { role: "user", content: buildBookPrompt({ topic, categories, ...settings }) },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 12_000,
    };
    if (model === "kimi-k3") body.reasoning_effort = "low";
    if (model === "kimi-k2.6") body.thinking = { type: "disabled" };
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string; code?: string };
    } | null;
    if (!response.ok) {
      const message = response.status === 401
        ? "Kimi API Key 无效或与国内站/国际站不匹配"
        : payload?.error?.code === "exceeded_current_quota_error"
          ? "Kimi 账户可用余额不足"
          : payload?.error?.message || `Kimi 请求失败（${response.status}）`;
      return json({ success: false, error: message }, response.status === 401 ? 401 : 502);
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return json({ success: false, error: "Kimi 返回了空内容" }, 502);
    const parsed = JSON.parse(content) as {
      science?: { consistencySettings?: RawConsistency; pages?: RawPage[] };
      story?: { consistencySettings?: RawConsistency; pages?: RawPage[] };
    };
    return json({
      success: true,
      data: {
        consistencySettings: {
          science: normalizeConsistency(parsed.science?.consistencySettings, settings.scienceImageStylePrompt),
          story: normalizeConsistency(parsed.story?.consistencySettings, settings.storyImageStylePrompt),
        },
        science: normalizePages(parsed.science?.pages, settings.sciencePageCount),
        story: normalizePages(parsed.story?.pages, settings.storyPageCount),
      },
      usage: { callsToday: usage.count, dailyLimit: usage.limit },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json({ success: false, error: "Kimi 请求超时，请稍后再试" }, 504);
    }
    return json({ success: false, error: error instanceof Error ? error.message : "Kimi 返回内容无法解析" }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export const config: Config = {
  path: "/api/demo/kimi-generate",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowLimit: 3,
    windowSize: 60,
  },
};
