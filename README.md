# 多模态绘本

一个重新搭建的、本地优先的儿童科普与故事绘本创作工作台。它与旧项目相互独立，不复用旧数据库、生成记录、API 密钥或远程服务器。

## 第一版功能

- 灵感主体库：内置主体种子、搜索、分类、手工新增和 `.xlsx` 导入
- 绘本项目：从自由主题或主体库批量创建项目
- 双绘本生成：同一主题生成科普绘本与故事绘本
- 页面工作台：编辑标题、正文、图片提示词，上传图片和重新生成本地占位图
- 内容审核：零费用本地规则审核；可选 Kimi 审核
- 生成队列：单机串行队列，支持暂停、恢复和取消
- 项目导出：导出内容 JSON 与本地素材 ZIP
- 音频端口：保留页面级音频接口，但未接入任何供应商

## 安全默认值

- 后端只监听 `127.0.0.1`，并拒绝非本机请求
- 数据写入本项目的 SQLite 文件，不连接 MySQL、Redis 或其他远程数据库
- `AI_CALLS_ENABLED=false`，首次启动不会调用任何付费 API
- 每次 Kimi 生成都需要在界面中明确确认费用
- Kimi 调用并发固定为 1、自动重试为 0，并有每日调用次数上限
- 只允许 Kimi 官方中国区或国际区 API 端点
- `.env.local`、SQLite 数据、生成素材和日志均被 Git 忽略
- 日志会遮盖 Authorization 和密钥字段

## 运行要求

- Node.js 22.13 或更新版本
- npm

```bash
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`。本地 API 固定使用回环地址，默认端口为 `43120`。

## Kimi 配置（可选，可能产生费用）

项目不配置 Kimi 也能使用本地主体库、项目管理、本地内容骨架、占位图、编辑、审核和导出。

需要 Kimi 时：

```bash
cp .env.example .env.local
```

然后只在 `.env.local` 中填写：

```dotenv
AI_CALLS_ENABLED=true
MOONSHOT_API_KEY=你重新申请的密钥
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2.6
DAILY_AI_CALL_LIMIT=20
```

中国区与国际区账号和密钥不互通。请根据密钥所属平台选用对应的官方端点，不要把真实密钥写入源码、README、截图或 Git。

Kimi 在本项目中负责文本策划、内容生成、图片提示词和可选审核。图片生成当前使用零费用本地占位图与手工上传，因为官方 Kimi API 不提供图片生成接口。音频也没有接入任何付费服务。

## 主体库种子

仓库内的 `data/subjects.seed.json` 是一次性生成的独立数据副本。以后如需从新的总表重建：

```bash
npm run seed:subjects -- /绝对路径/你的主体总表.xlsx
```

运行中的 SQLite 已有数据时不会自动覆盖。

## 验证

```bash
npm run typecheck
npm test
npm run build
npm run security:scan
npm audit
```

更多安全边界见 [SECURITY.md](./SECURITY.md)。
