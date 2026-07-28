import type { JobSearchInput, RawJobResult } from "@/types/job";
import type { JobSourceAdapter } from "./job-source-adapter";
import { normalizeJobPost } from "./job-normalizer";

const mockJobs: RawJobResult[] = [
  { title: "Java 后端开发工程师", company: "杭州云栖科技有限公司", city: "杭州", salaryText: "15k-25k", description: "负责电商交易后端服务设计、开发和优化，参与接口联调和问题排查。", requirements: "本科及以上，应届生可投，熟悉 Java、Spring Boot、MySQL、Redis。", source: "mock", sourceUrl: "mock://java-hz" },
  { title: "Java 开发实习生", company: "上海智联软件有限公司", city: "上海", salaryText: "200-300/天", description: "参与业务系统后端接口开发、单元测试和文档维护。", requirements: "计算机相关专业，熟悉 Java、Spring Boot、MySQL，实习 4 天以上。", source: "mock", sourceUrl: "mock://java-intern-sh" },
  { title: "软件开发工程师", company: "南京数智制造科技有限公司", city: "南京", salaryText: "12k-18k", description: "参与制造业数字化平台开发，完成服务模块设计和部署。", requirements: "本科，熟悉 Java 或 Python、SQL、Git，有项目经验优先。", source: "mock", sourceUrl: "mock://sde-nj" },
  { title: "数据分析实习生", company: "杭州增长数据科技有限公司", city: "杭州", salaryText: "180-250/天", description: "负责业务数据清洗、报表分析和指标监控。", requirements: "熟悉 SQL、Excel、Python，具备数据分析思维。", source: "mock", sourceUrl: "mock://data-hz" },
  { title: "前端开发工程师", company: "上海星河互动有限公司", city: "上海", salaryText: "14k-22k", description: "负责 Web 前端页面和组件开发。", requirements: "熟悉 React、Vue、TypeScript，了解前后端联调。", source: "mock", sourceUrl: "mock://fe-sh" },
  { title: "测试开发工程师", company: "南京质量云软件有限公司", city: "南京", salaryText: "10k-16k", description: "负责接口自动化测试、质量平台工具开发。", requirements: "熟悉 Java 或 Python、SQL、接口测试，有自动化经验优先。", source: "mock", sourceUrl: "mock://test-nj" },
  { title: "AI 应用开发工程师", company: "杭州智体应用科技有限公司", city: "杭州", salaryText: "18k-28k", description: "参与大模型应用、RAG 问答和企业智能助手开发。", requirements: "熟悉 Python 或 TypeScript，了解 React、LLM、RAG，有 AI 项目经验优先。", source: "mock", sourceUrl: "mock://ai-hz" },
  { title: "高薪转行 Java，先培训后就业", company: "未来高薪教育咨询", city: "杭州", salaryText: "30k-50k", description: "零基础高薪转行 Java，包就业。", requirements: "需先缴费参加收费培训，可办理培训贷，包就业。", source: "mock", sourceUrl: "mock://risk-training" },
];

export class MockChinaJobAdapter implements JobSourceAdapter {
  source = "mock" as const;
  async search(input: JobSearchInput) {
    const query = input.query?.toLowerCase() ?? "";
    return mockJobs.filter((job) =>
      (!input.city || job.city === input.city) &&
      (!query || `${job.title} ${job.description} ${job.requirements}`.toLowerCase().includes(query)),
    );
  }
  async normalize(raw: RawJobResult) {
    return normalizeJobPost({ ...raw, source: "mock" });
  }
}
