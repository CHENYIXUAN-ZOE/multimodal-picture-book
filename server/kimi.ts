import { env, getKimiBaseUrl } from "./config";
import { getCallsToday, getSettings, recordUsage } from "./db";
import { buildAuditPrompt, buildBookPrompt } from "./prompts";
import { readKimiApiKey, validateKimiApiKey } from "./secrets";
import type { KimiConnectionResult } from "../shared/types";

type KimiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type KimiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: KimiUsage;
  error?: { message?: string; type?: string; code?: string };
};

let activeCalls = 0;

function operationalError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function getPaidCallConfiguration(acknowledgeCost: boolean) {
  const settings = getSettings();
  if (!(settings.kimiEnabled || env.aiCallsEnabled)) {
    throw operationalError("Kimi 调用当前处于关闭状态，请先在创作设置中启用");
  }
  if (!acknowledgeCost) {
    throw operationalError("必须明确确认本次调用可能产生费用");
  }
  const apiKey = readKimiApiKey();
  if (!apiKey) {
    throw operationalError("尚未配置 Kimi API Key，请先到创作设置中验证并保存");
  }
  if (activeCalls >= env.maxConcurrentAiCalls) {
    throw operationalError("已有 Kimi 请求正在进行，请稍后再试", 409);
  }
  const dailyLimit = Math.min(settings.dailyAiCallLimit, env.dailyAiCallLimit);
  if (getCallsToday() >= dailyLimit) {
    throw operationalError(`已达到每日 Kimi 调用上限（${dailyLimit} 次）`);
  }
  return {
    apiKey,
    baseUrl: getKimiBaseUrl(settings.kimiRegion),
    model: settings.model || env.kimiModel,
    settings,
  };
}

function kimiError(status: number, payload: KimiResponse | null) {
  if (status === 401) {
    return operationalError("Kimi API Key 无效，或 Key 与所选国内站/国际站不匹配");
  }
  if (status === 404) {
    return operationalError("当前账号无法使用所选 Kimi 模型，请在设置中更换模型");
  }
  if (payload?.error?.code === "exceeded_current_quota_error") {
    return operationalError("Kimi 账户可用余额不足，请充值后再试");
  }
  return operationalError(payload?.error?.message || `Kimi 请求失败（${status}）`, 502);
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as KimiResponse | null;
}

async function chat(input: {
  system: string;
  prompt: string;
  acknowledgeCost: boolean;
  json?: boolean;
}) {
  const configuration = getPaidCallConfiguration(input.acknowledgeCost);
  activeCalls += 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const body: Record<string, unknown> = {
      model: configuration.model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
      response_format: input.json ? { type: "json_object" } : { type: "text" },
      max_completion_tokens: 12_000,
    };
    if (configuration.model === "kimi-k3") {
      body.reasoning_effort = "low";
    } else if (configuration.model === "kimi-k2.6") {
      body.thinking = { type: "disabled" };
    }
    const response = await fetch(`${configuration.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw kimiError(response.status, payload);
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Kimi 返回了空内容");
    recordUsage(
      configuration.model,
      payload?.usage?.prompt_tokens || 0,
      payload?.usage?.completion_tokens || 0,
    );
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw operationalError("Kimi 请求超时，请稍后重试", 504);
    }
    throw error;
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

export async function testKimiConnection(input?: {
  apiKey?: string;
  region?: "cn" | "global";
  model?: string;
}): Promise<KimiConnectionResult> {
  const settings = getSettings();
  let apiKey = "";
  try {
    apiKey = input?.apiKey ? validateKimiApiKey(input.apiKey) : readKimiApiKey();
  } catch (error) {
    throw operationalError(error instanceof Error ? error.message : "Kimi API Key 格式不正确");
  }
  if (!apiKey) throw operationalError("请先填写 Kimi API Key");
  const region = input?.region || settings.kimiRegion;
  const model = input?.model || settings.model;
  const baseUrl = getKimiBaseUrl(region);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const modelsResponse = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    const modelsPayload = (await modelsResponse.json().catch(() => null)) as
      | (KimiResponse & { data?: Array<{ id?: string }> })
      | null;
    if (!modelsResponse.ok) throw kimiError(modelsResponse.status, modelsPayload);
    const availableModels = (modelsPayload?.data || [])
      .map((item) => String(item.id || ""))
      .filter(Boolean);

    let balance: KimiConnectionResult["balance"] = null;
    const balanceResponse = await fetch(`${baseUrl}/users/me/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (balanceResponse.ok) {
      const payload = (await balanceResponse.json()) as {
        data?: {
          available_balance?: number;
          cash_balance?: number;
          voucher_balance?: number;
        };
      };
      if (payload.data) {
        balance = {
          available: Number(payload.data.available_balance || 0),
          cash: Number(payload.data.cash_balance || 0),
          voucher: Number(payload.data.voucher_balance || 0),
        };
      }
    }
    return {
      ok: true,
      availableModels,
      selectedModelAvailable: availableModels.includes(model),
      balance,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw operationalError("连接 Kimi 超时，请检查网络后重试", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
