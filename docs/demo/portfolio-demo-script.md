# Personal Job Agent Portfolio Demo Script

目标时长：3–5 分钟。全部页面使用独立 Portfolio 数据库和虚构演示数据，Demo 模式不会调用外部 LLM。

## 00:00–00:25 项目定位

- 展示顶部 Demo Banner，说明人物、学校、公司、项目和岗位均为虚构。
- 一句话介绍：这是一个把职业档案、JD 分析、定制简历、岗位与投递复盘连接起来的个人求职工作台。
- 强调项目不会自动投递，也不会登录招聘平台。

## 00:25–00:55 Dashboard 与职业档案

- 展示各模块数量与求职漏斗。
- 打开林知远的虚构职业档案，说明教育、技能和三个课程/个人 Demo 项目构成候选人事实来源。

## 00:55–01:25 简历中心

- 展示通用简历和岗位定制简历。
- 说明模板、Markdown、下载/打印与版本管理能力。
- 强调截图和视频不使用真实个人简历。

## 01:25–01:55 JD 分析

- 打开星桥科技（虚构）的 AI 应用开发实习生 JD。
- 展示匹配项、技能缺口和风险：JD 中有“大模型项目经验优先”，但候选人没有该事实。

## 01:55–02:45 定制简历与申请材料

- 展示定制简历、改写说明、自我介绍、投递邮件和招聘沟通话术。
- 说明最终内容不是 seed 手写记录：seed 使用正式 Candidate Fact Registry、Plan Validator、Compiler、Grounded Schema 与 Factuality Gate。
- 指出 JD 加分项没有被写成候选人已有经验。

## 02:45–03:20 投递工作台

- 展示岗位匹配、投递漏斗和人工跟进。
- 强调系统只管理工作流，最终投递动作由用户确认和执行。

## 03:20–04:15 Plan + Compiler 架构

- LLM 只输出小型 Selection Plan，不直接写完整简历。
- Plan Schema 拒绝 JD ID、未知 ID 和自由文本。
- Compiler 控制六个 section、文本长度、数组和事实引用。
- Factuality Gate 阻止风险内容保存；Compiler 失败按代码 Bug 处理，不用第二次模型请求掩盖。

## 04:15–04:45 Evaluation、测试和 CI

- 展示 Demo badge、Provider、模型、耗时、Token、Pipeline 状态和安全计数。
- 说明 seeded 数值明确标记 Demo，不是 benchmark。
- 真实 DeepSeek 三条核心链路已单独受控验收；Demo 不调用外部 LLM。
- 展示完整自动化测试以及 Linux / Windows CI。

## 04:45–05:00 总结

- 总结工程重点：结构化事实、职责拆分、严格 Schema、可观测性和跨平台门禁。
- 下一步是扩展合规岗位导入、模板和 Evaluation 分析，而不是自动投递。
