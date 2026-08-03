# 安全说明

## 密钥与费用

- 真实密钥可以通过设置页保存到 `.secrets/kimi-api-key`，或手工放在 `.env.local`
- `.secrets/` 和 `.env.local` 都不会提交；本机 Key 文件权限固定为 `0600`
- 示例配置故意保留空密钥，并默认关闭所有 Kimi 调用
- “检测连接”只调用官方模型列表与余额接口，不生成内容；正式生成仍需显式费用确认
- API 响应只返回 Key 是否配置及末四位提示，不返回完整 Key
- 每日上限按“请求次数”保护，不等同于金额预算；请同时在 Kimi 控制台查看余额与用量
- 如怀疑旧密钥曾进入历史仓库，应在原服务控制台撤销并重新生成；从源码删除不等于密钥失效

## 网络边界

- 本地 API 仅绑定 `127.0.0.1`
- 服务端再次检查请求来源，拒绝非回环地址
- Kimi 地址使用代码 allowlist，仅接受官方中国区与国际区端点
- 本项目没有旧服务器地址、数据库账号、对象存储、域名、Webhook 或远程部署配置

## 数据边界

- SQLite、Key 文件、上传图片、生成图片、导出包和日志默认不进入 Git
- 删除项目会删除本项目 `storage/projects/<项目ID>` 下对应素材
- 项目导出不包含 API 密钥或环境变量

## Netlify 私人演示边界

- `PROTECTED_PAGE_PASSWORD` 和 `MOONSHOT_API_KEY` 只能作为 Netlify Secret 配置
- 未登录请求不能访问页面或 Kimi Function；伪造会话 Cookie 会被拒绝
- Function 不接受客户端传入的 API Key 或自定义供应商地址
- Function 检查同源、费用确认、IP 限流和每日持久化上限
- 仅文本、分镜和图片提示词发送给 Kimi；不上传 SQLite、本地图片或密钥文件
- 演示结果保存在当前浏览器，清理站点数据会删除这些结果

## 音频保留接口

`POST /api/v1/pages/:id/regenerate-audio` 固定返回 `501` 和
`AUDIO_PROVIDER_DISABLED`。它只是未来接入点，目前没有 SDK、密钥字段、
域名或后台调用。

## 提交前检查

```bash
npm run security:scan
git status --short
git diff --cached
```

若安全扫描失败，不要提交或推送，先处理报告中的文件。
