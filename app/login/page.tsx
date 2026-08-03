"use client";

import { FormEvent, useState } from "react";
import { BookHeart, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "无法登录");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法登录");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <span><BookHeart size={28} /></span>
          <div><strong>多模态绘本</strong><small>PRIVATE KIMI DEMO</small></div>
        </div>
        <div className="login-shield"><ShieldCheck size={30} /></div>
        <h1>进入私人演示站</h1>
        <p>站点中的 Kimi 功能可能产生 API 费用，请先验证演示密码。</p>
        <form onSubmit={submit}>
          <label className="field-label">
            演示密码
            <div className="login-input-wrap">
              <KeyRound size={17} />
              <input
                autoFocus
                autoComplete="current-password"
                className="text-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入 Netlify 演示密码"
              />
            </div>
          </label>
          {error ? <div className="login-error" role="alert">{error}</div> : null}
          <button className="primary-button full-button" disabled={busy || !password}>
            {busy ? <RefreshCw className="spin" size={17} /> : <ShieldCheck size={17} />}
            {busy ? "正在验证" : "安全进入"}
          </button>
        </form>
        <small className="login-footnote">8 小时后会自动退出 · API Key 不会下发到浏览器</small>
      </section>
    </main>
  );
}
