import type { SearchProvider, SearchProviderInput, SearchProviderResult } from "./search-provider";

const fixtures: SearchProviderResult[] = [
  { title: "杭州云栖科技 Java 后端开发 校招", url: "https://careers.yunqi.example/jobs/java-backend-hz", displayUrl: "careers.yunqi.example", sourceName: "企业官网", snippet: "杭州 Java 后端开发，应届生，本科，Spring Boot、MySQL、Redis，15k-25k。" },
  { title: "上海 Java 开发实习生招聘", url: "https://jobs.university.example/sh-java-intern", displayUrl: "jobs.university.example", sourceName: "学校就业网", snippet: "上海 Java 开发实习，校招，Spring Boot MySQL，每周 4 天。" },
  { title: "南京软件开发工程师校园招聘", url: "https://talent.nanjing.gov.example/jobs/sde", displayUrl: "talent.nanjing.gov.example", sourceName: "地方人才网", snippet: "南京 软件开发工程师 本科 Java Python SQL 制造业数字化。" },
  { title: "杭州数据分析实习生", url: "https://career.data.example/jobs/data-intern", displayUrl: "career.data.example", sourceName: "企业官网", snippet: "杭州 数据分析实习生 SQL Excel Python，应届生可投。" },
  { title: "上海前端开发工程师 React Vue", url: "https://search.example/jobs/frontend-sh", displayUrl: "search.example", sourceName: "搜索结果", snippet: "上海 前端开发 React Vue TypeScript，14k-22k。" },
  { title: "杭州 AI 应用开发工程师", url: "https://ai.example/careers/llm-app", displayUrl: "ai.example", sourceName: "企业官网", snippet: "AI 应用开发 大模型 RAG Python TypeScript 杭州。" },
  { title: "高薪转行 Java 包就业", url: "https://training.example/java", displayUrl: "training.example", sourceName: "培训广告", snippet: "零基础高薪转行 Java，先缴费，培训贷，包就业。" },
];

export class FixtureSearchProvider implements SearchProvider {
  name = "fixture";
  async search(input: SearchProviderInput) {
    const text = `${input.query} ${input.city ?? ""} ${input.role ?? ""} ${(input.keywords ?? []).join(" ")}`.toLowerCase();
    return fixtures
      .filter((item) => `${item.title} ${item.snippet}`.toLowerCase().split(/\s+/).some((part) => text.includes(part) || text.length === 0))
      .slice(0, input.limit ?? 10);
  }
}
