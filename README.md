# Personal Job Agent

中国大陆个人求职助手 MVP。已整合 Career Profile、简历中心、JD 分析、职业策略、岗位匹配、合规搜索接入、投递工作台、面试反馈、任务和 Offer 闭环。

## 本地运行

`npm run dev` 现在只启动 Next.js，不再自动启动 Docker。数据库需要单独准备，这样 Docker Hub 暂时不可用时，应用启动脚本不会被 Docker 镜像拉取问题卡死。

### 方案 A：Docker PostgreSQL

```bash
copy .env.example .env
npm install
npm run db
npm run db:status
npm run setup
npm run dev
```

访问 `http://localhost:3000`。

如果 `npm run db` 报错类似：

```text
failed to resolve reference "docker.io/library/postgres:16-alpine"
failed to authorize: failed to fetch anonymous token
Get "https://auth.docker.io/token?...": EOF
```

这通常是 Docker Hub 网络、代理、登录态或镜像源问题，不是 Next.js 代码错误，也不是 Prisma schema 错误。

排查建议：

- 重试 `npm run db`
- 确认 Docker Desktop 正常运行
- 执行 `docker pull postgres:16-alpine` 单独测试镜像拉取
- 执行 `docker login` 后重试
- 配置 Docker 镜像加速、代理或公司网络白名单
- 改用方案 B：本机 PostgreSQL
- 改用方案 C：云 PostgreSQL

### 方案 B：本机 PostgreSQL

1. 确认本机已安装并启动 PostgreSQL。
2. 创建数据库 `personal_job_agent`。
3. 修改 `.env` 中的 `DATABASE_URL`，例如：

```bash
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/personal_job_agent?schema=public"
```

4. 运行：

```bash
npm install
npm run setup
npm run dev
```

### 方案 C：云 PostgreSQL

1. 准备云数据库连接串。
2. 修改 `.env`：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
```

3. 运行：

```bash
npm install
npm run setup
npm run dev
```

不要提交真实 `.env`。

## 诊断命令

```bash
npm run doctor
```

Doctor 会检查：

- Node.js / npm 版本
- `.env` 是否存在
- `DATABASE_URL` 是否配置
- Docker / Docker Compose 是否可用
- 数据库端口是否可连接
- Prisma Client 是否可生成

## 常用命令

```bash
npm run dev          # 只启动 Next.js
npm run dev:app      # 同上，显式别名
npm run db           # 启动 Docker PostgreSQL
npm run db:down      # 关闭 Docker PostgreSQL
npm run db:logs      # 查看 PostgreSQL 容器日志
npm run db:status    # 查看 PostgreSQL 容器状态
npm run db:wait      # 等待 DATABASE_URL 对应数据库可连接
npm run setup        # generate -> 检查 DB -> migrate -> seed
npm run setup:db     # 只执行 migrate + seed
npm run setup:docker # Docker 模式：db -> wait -> migrate + seed
npm run check        # typecheck + lint + test
```

## 常见错误

### Prisma P1001

`P1001: Can't reach database server at localhost:5432`

含义：应用或 Prisma CLI 找不到 PostgreSQL。常见原因：

- PostgreSQL 没启动
- Docker 镜像拉取失败，容器没有创建成功
- `.env` 中 `DATABASE_URL` 用户名、密码、主机或端口错误
- 端口 5432 被占用或未映射

处理：

```bash
npm run doctor
npm run db:status
npm run db
npm run setup
```

如果 Docker 仍无法拉取镜像，使用本机 PostgreSQL 或云 PostgreSQL，并更新 `.env`。

### Docker Hub anonymous token / EOF

这是 Docker 拉取镜像时访问 Docker Hub 鉴权接口失败。它不代表项目代码坏了。可以重试、登录 Docker、配置代理/镜像源，或直接使用本机/云 PostgreSQL。

## Demo 数据

`npm run seed` 会重建 `DEMO_USER_EMAIL` 对应的 demo 用户，默认 `demo@example.com`。Seed 覆盖 Profile、Resume、JD/JDAnalysis、Strategy、JobPost、JobMatch、SavedJob、Application、InterviewFeedback 和 OfferRecord。

## Dashboard 与导航

首页跳转 `/dashboard`。统一导航包含 Dashboard、Profile、Resume、JD、Strategy、Jobs、Applications、Settings。Dashboard 展示模块统计、求职漏斗、最近行动、推荐下一步和快捷入口。

## 数据与隐私

访问 `/settings/data` 可以查看当前用户数据统计、导出 JSON、删除 Demo 用户数据。

本地开发默认数据保存在本地 PostgreSQL。简历、面试反馈、投递记录和 Offer 属于个人敏感信息，部署时应做好访问控制和授权。

系统不会自动投递简历、不会登录招聘平台、不会发送邮件、不会操作外部招聘平台、不会在未配置真实搜索时访问外网，也不会接入真实 LLM。
## Real LLM and Job Search MVP

The app still works without any external API keys. By default it uses deterministic mock/rule providers for AI and fixture/mock providers for job search.

### AI provider configuration

Set these values in `.env` when you want to use an OpenAI-compatible LLM endpoint:

```env
AI_PROVIDER="llm_provider"
LLM_API_KEY="your-local-secret"
LLM_MODEL="your-model-name"
LLM_BASE_URL="https://api.openai.com/v1"
```

If `AI_PROVIDER=mock` or `LLM_API_KEY` is empty, the app automatically falls back to mock providers. The key is never shown in the UI or test output. You can check the active mode at:

```bash
npm run dev
# then open /settings/ai
```

Current LLM-capable provider layer:

- JD analysis provider
- JD-tailored resume writer provider
- career strategy provider
- resume bullet writer provider

JD analysis and career strategy services now route through the provider factory, so they can use the real provider when configured and fallback safely when the provider fails or returns invalid structured output.

### Job search provider configuration

The job search MVP supports multiple source types without depending on a single recruitment platform:

- Mock job source
- Manual JD text
- Manual public job URL
- Company career page URL or pasted page text
- Web Search Provider

Optional search settings:

```env
SEARCH_PROVIDER="mock"
SEARCH_API_KEY=""
SEARCH_BASE_URL=""
JOB_SEARCH_DEFAULT_LIMIT=20
JOB_FETCH_TIMEOUT_MS=15000
ENABLE_REAL_WEB_SEARCH="false"
ENABLE_COMPANY_PAGE_FETCH="false"
```

When `SEARCH_API_KEY` is empty or real search is disabled, web search uses fixture/mock results. To import a real job manually, use:

```bash
npm run dev
# open /jobs/import
```

Paste a JD text, a public job URL, or public company career page text. The app structures the job into `JobPost`, deduplicates it, detects risk flags, calculates a profile match, and can then create a `JobDescription` for JD analysis and tailored resume generation.

This MVP does not bypass login, CAPTCHA, anti-bot systems, or platform restrictions. It only supports user-provided text/URLs, public pages when enabled, and configurable search providers.

## 实习求职核心闭环

当前 MVP 已覆盖以下主流程：

1. 在“职业档案”维护教育、技能、项目、实习、目标城市和岗位偏好。
2. 在“岗位库 > 导入岗位”手动粘贴岗位描述、导入公开链接，或批量上传 CSV / Excel 文件。
3. 系统结构化提取岗位、公司、城市、技能、学历、实习周期、转正机会、职责、要求、加分项和候选人画像。
4. 系统结合职业档案计算技能、项目、经历、学历、城市、成长价值、转正机会和方向匹配，并给出风险提示和投递建议。
5. 从岗位生成岗位描述分析和定制简历；定制结果附带自我介绍、投递邮件和招聘沟通话术。
6. 在“投递工作台”管理待投递、已投递、筛选、笔试、面试、录用、拒绝和复盘状态。
7. 在“质量评估”对岗位描述解析、匹配评分和简历建议进行 1–5 分人工标注，并查看大模型调用耗时与 Token 汇总。

批量岗位文件支持 `.csv` 和 `.xlsx`，首行应为列名。推荐列名为：`岗位名称`、`公司`、`城市`、`薪资`、`岗位职责`、`任职要求`、`来源链接`。单次最多导入 200 条，导入后会复用现有归一化、去重、风险识别和人岗匹配流程。

## 架构演进说明

当前后端逻辑继续运行在 Next.js 服务层和 Server Actions 中，数据库使用 PostgreSQL + Prisma。FastAPI、Redis 队列、LangGraph、pgvector/Qdrant 和 reranker 尚未引入；这些组件适合在异步批量采集、长流程 Agent 编排和语义检索规模增长后按需拆分，不是当前 MVP 正常运行的前置条件。

## 简历模板系统

简历中心现已支持四种模板：极简、简洁大方、深色和带证件照。新建通用简历时可选择模板；已有简历可在详情页切换并保存，保存后预览、Markdown 下载和浏览器打印/PDF 会统一使用该模板。旧简历以及无效或已废弃的模板键会安全回退到默认的“极简”模板。

模板骨架位于 `template/*.md`，元数据注册表位于 `services/resume-templates/registry.ts`，所有输出统一通过 `services/resume-templates/renderer.ts` 渲染。新增第五个模板时，只需增加模板文件、模板键、注册表定义、对应样式和测试，不需要分别修改预览、下载与打印逻辑。完整占位符规范见 `docs/resume-template-system.md`。

当前 Career Profile 没有照片字段或上传能力，因此带证件照模板在没有照片时自动采用无照片布局，不会生成损坏图片。本功能没有新增环境变量；数据库新增 migration `20260728125000_add_resume_template_key`，为 `Resume.templateKey` 提供 `minimal` 默认值并兼容已有数据。

## CI 质量门禁

Pull Request 和推送到 `main` 都会触发 GitHub Actions CI，也可以通过 `workflow_dispatch` 手动运行。Linux 主门禁使用一次性 PostgreSQL 16 服务，依次执行锁文件依赖安装、Prisma Client 生成、Schema 校验、9 条迁移的部署与状态检查、TypeScript/ESLint/Vitest 工程检查以及生产构建。

独立的 Windows 门禁执行依赖安装、Prisma 生成与校验以及完整的 `npm run check`，用于发现 Windows 路径、Vitest 项目内缓存和跨平台兼容问题；数据库迁移由 Linux 主门禁负责。两个 Job 均固定使用 Mock AI、Fixture 搜索，并关闭真实 Web Search 和公司页面抓取，因此不需要也不会读取真实 API Key。
