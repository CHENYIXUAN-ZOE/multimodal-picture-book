import type { Config } from "@netlify/functions";
import {
  createSessionToken,
  passwordsMatch,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../../app/lib/session";

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json", ...headers },
  });
}

export default async function handler(request: Request) {
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ success: false, error: "已拒绝跨站请求" }, 403);
  }
  const configuredPassword = process.env.PROTECTED_PAGE_PASSWORD || "";
  if (configuredPassword.length < 12) {
    return json({ success: false, error: "演示站尚未完成密码配置" }, 503);
  }
  if (Number(request.headers.get("content-length") || 0) > 4096) {
    return json({ success: false, error: "请求过大" }, 413);
  }
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!(await passwordsMatch(password, configuredPassword))) {
    return json({ success: false, error: "演示密码不正确" }, 401);
  }
  const token = await createSessionToken(configuredPassword);
  const cookie = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
  return json({ success: true }, 200, { "Set-Cookie": cookie });
}

export const config: Config = {
  path: "/api/demo/login",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowLimit: 5,
    windowSize: 60,
  },
};
