import { env } from "./config";
import { getCallsToday, getSettings, recordUsage } from "./db";
import { buildAuditPrompt, buildBookPrompt } from "./prompts";

type KimiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type KimiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: KimiUsage;
  error?: { message?: string; type?: string };
};

let activeCalls = 0;

function assertPaidCallAllowed(acknowledgeCost: boolean) {
  if (!env.aiCallsEnabled) {
    throw new Error("Kimi 调用当前处于关闭状态，请先在 .env.local 中启用");
  }
  if (!acknowledgeCost) {
    throw new Error("必须明确确认本次调用可能产生费用");
  }
  if (!env.moonshotApiKey) {
    throw new Error("尚未配置 MOONSHOT_API_KEY");
  }
  if (activeCalls >= env.maxConcurrentAiCalls) {
    throw new Error("已有 Kimi 请求正在进行，请稍后再试");
  }
  const settings = getSettings();
  const dailyLimit = Math.min(settings.dailyAiCallLimit, env.dailyAiCallLimit);
  if (getCallsToday() >= dailyLimit) {
    throw new Error(`已达到每日 Kimi 调用上限（${dailyLimit} 次）`);
  }
}

async function chat(input: {
  system: string;
  prompt: string;
  acknowledgeCost: boolean;
  json?: boolean;
}) {
  assertPaidCallAllowed(input.acknowledgeCost);
  activeCalls += 1;
  const settings = getSettings();
  const model = settings.model || env.kimiModel;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${env.kimiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.moonshotApiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
        thinking: { type: "disabled" },
        response_format: input.json ? { type: "json_object" } : { type: "text" },
        max_tokens: 12_000,
      }),
    });
    const payload = (await response.json()) as KimiResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `Kimi 请求失败（${response.status}）`);
    }
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Kimi 返回了空内容");
    recordUsage(
      model,
      payload.usage?.prompt_tokens || 0,
      payload.usage?.completion_tokens || 0,
    );
    return content;
  } finally {
    clearTimeout(timeout);
    activeCalls -= 1;
  }
}

export async function generateWithKimi(
  input: {
    topic: string;
    categories: string[];
    acknowledgeCost: boolean;
  },
) {
  const settings = getSettings();
  const content = await chat({
    system: "你是严谨、温暖的儿童多模态绘本创作助手。",
    prompt: buildBookPrompt({
      topic: input.topic,
      categories: input.categories,
      targetAge: settings.targetAge,
      sciencePageCount: settings.sciencePageCount,
      storyPageCount: settings.storyPageCount,
      sciencePrompt: settings.sciencePrompt,
      storyPrompt: settings.storyPrompt,
      imageStyle: settings.imageStyle,
    }),
    acknowledgeCost: input.acknowledgeCost,
    json: true,
  });
  const parsed = JSON.parse(content) as {
    science?: { pages?: Array<{ title?: string; text?: string; imagePrompt?: string }> };
    story?: { pages?: Array<{ title?: string; text?: string; imagePrompt?: string }> };
  };
  const normalize = (
    pages: Array<{ title?: string; text?: string; imagePrompt?: string }> | undefined,
    expected: number,
  ) => {
    if (!Array.isArray(pages) || pages.length !== expected) {
      throw new Error(`Kimi 返回的页数不符合要求（应为 ${expected} 页）`);
    }
    return pages.map((page, index) => ({
      title: String(page.title || `第 ${index + 1} 页`),
      text: String(page.text || ""),
      imagePrompt: String(page.imagePrompt || ""),
    }));
  };
  return {
    science: normalize(parsed.science?.pages, settings.sciencePageCount),
    story: normalize(parsed.story?.pages, settings.storyPageCount),
  };
}

export async function auditWithKimi(
  input: {
    topic: string;
    pages: Array<{ contentType: string; pageIndex: number; text: string; imagePrompt: string }>;
    acknowledgeCost: boolean;
  },
) {
  const content = await chat({
    system: "你是儿童内容安全与质量审核专家，只输出严格 JSON。",
    prompt: buildAuditPrompt(input),
    acknowledgeCost: input.acknowledgeCost,
    json: true,
  });
  return JSON.parse(content) as {
    score: number;
    issues: Array<{
      type: "accuracy" | "age_fit" | "continuity" | "visual" | "safety";
      severity: "low" | "medium" | "high";
      pageIndex?: number;
      message: string;
      suggestion: string;
      status: "open";
    }>;
  };
}

export async function testKimiConnection(acknowledgeCost: boolean) {
  const content = await chat({
    system: "你是连接测试助手。",
    prompt: '只返回 JSON：{"ok":true,"message":"连接成功"}',
    acknowledgeCost,
    json: true,
  });
  return JSON.parse(content);
}
