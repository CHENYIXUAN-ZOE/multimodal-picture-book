import { demoApi } from "./demo-api";

const API_BASE = "/api/local/api/v1";
export const isPublicDemo = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === "demo";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (isPublicDemo) {
    return demoApi<T>(path, options);
  }
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({
    success: false,
    error: "服务返回了无法解析的响应",
  }));
  if (!response.ok || payload.success === false) {
    throw new ApiError(payload.error || `请求失败（${response.status}）`, response.status);
  }
  return payload as T;
}

export function jsonBody(value: unknown): Pick<RequestInit, "body"> {
  return { body: JSON.stringify(value) };
}

export function downloadUrl(path: string) {
  return `${API_BASE}${path}`;
}
