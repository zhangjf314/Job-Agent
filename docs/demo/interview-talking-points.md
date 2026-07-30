# Interview Talking Points

## 30 秒版本

Personal Job Agent 是一个个人求职工作台，把职业档案、JD 分析、岗位定制简历、职业策略和投递复盘放在同一条数据链路中。最关键的设计是让 LLM 只选择候选人事实，再由确定性 Compiler 生成最终简历，因此既保留岗位个性化，也能通过事实引用和门禁防止虚构经历。

## 2 分钟版本

用户先维护结构化职业档案和通用简历，再录入 JD。系统分析岗位要求和匹配差距，生成定制简历与申请材料，并把岗位推进到投递工作台中复盘。

技术上使用 Next.js、TypeScript、Prisma 和 PostgreSQL。AI 层通过 Provider Factory 支持 Mock 与 OpenAI-compatible Provider。候选人档案先转换为 Candidate Fact Registry；模型只返回 ID 和 enum 构成的 Selection Plan；严格 validator 拒绝 JD-only、未知和重复事实；Compiler 控制所有最终文本、section、长度、来源和申请材料；Grounded Schema 与 Factuality Gate 再做最终校验。

项目结果包括完整自动化测试、Linux/Windows CI、安全 Provider observability、独立可重复的 Portfolio 数据库和无外部调用的截图流程。真实 DeepSeek 链路通过单次受控 Smoke 验收，但 Demo 日志明确标记为静态虚构数值。

## 深入追问

### 为什么不用 LLM 直接生成最终简历？

完整 JSON 同时承担内容和结构时容易出现 Schema 漂移、数组或长度超限，以及 JD 要求被事实化。将“选择”与“渲染”拆分后，模型面对更小的输出空间，系统可以确定性保证结构和事实边界。

### Candidate Fact Registry 如何设计？

Registry 只从结构化候选人数据生成稳定 ID、类别、原文和 canonical terms。Render descriptor 也只依赖候选人事实，不读取 JD；无法在 80 字内安全表达的事实不会进入 Plan 可选集合。

### 如何阻止虚构经验？

Plan 只能引用已知 `F_*`；`J_REQ_*`、未知和重复 ID 会失败。最终 fact line 必须携带实际来源，Factuality Gate 还会检查工作、实习、奖项、指标、技能强度及 AI/LLM 项目等高风险类别。

### 为什么保留 Grounded Schema 和事实门禁？

Compiler 是代码，同样可能出现回归。Schema 保证结构，事实门禁保证语义，两者是独立的纵深防御，也能在保存前阻断错误对象。

### Plan Schema 失败怎么办？

立即失败，不进入 Compiler，不保存结果，也不使用 Mock fallback 伪装成功。受限 smoke 中不会发起第二次请求。

### Compiler 出错怎么办？

结构失败归类为 deterministic compiler schema bug，事实失败归类为 factuality bug。修复代码和测试，而不是调用 LLM Repair 掩盖。

### 如何控制 Token 成本？

让模型只返回事实 ID 和 enum，Prompt 与 completion 都显著小于完整 Grounded Resume；确定性文本生成不消耗 Token。

### 为什么 Mock fallback 默认关闭？

真实 Provider 失败若静默回退，会产生看似成功但来源不同的结果，破坏验收和观测。Demo 和 CI 显式选择 Mock；真实模式失败则明确暴露。

### 如何保证日志不泄露隐私？

日志只记录 operation、模型、状态、耗时、Token 和白名单状态/计数，不记录 Prompt、Response、reasoning、事实 ID、事实正文、JD 或简历正文。

### 如何扩展更多 Provider？

Provider Factory 和统一 client contract 隔离了业务服务。新增 Provider 需要实现同一结构化完成接口、错误分类与安全观测，不改变事实门禁和 Compiler。

## 失败与改进

早期完整 Grounded 输出在真实 Provider 上出现结构与长度漂移。最终调整不是继续堆 Prompt，而是重新划分模型和系统职责：模型负责相关性判断，确定性代码负责最终对象。这体现了对可靠性、成本和可测试性的工程权衡。
