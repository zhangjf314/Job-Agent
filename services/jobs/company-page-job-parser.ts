import type { RawJobResult } from "@/types/job";

export function parseCompanyCareerPageText(text: string, sourceUrl = ""): RawJobResult[] {
  if (!/招聘|岗位|职位|职责|要求|Java|前端|数据|AI|测试/.test(text)) return [];
  const chunks = text.split(/\n(?=.*?(工程师|实习生|开发|分析|测试|产品|运营))/).map((x) => x.trim()).filter(Boolean);
  const candidates = chunks.length > 1 ? chunks : [text];
  return candidates
    .filter((chunk) => /岗位|职位|职责|要求|Java|前端|数据|AI|测试/.test(chunk))
    .slice(0, 10)
    .map((chunk) => ({
      title: chunk.match(/(Java后端|Java 后端|前端开发|数据分析|测试开发|AI 应用开发|软件开发工程师|[\u4e00-\u9fa5A-Za-z ]{2,20}(工程师|实习生))/)?.[0] ?? "企业招聘岗位",
      company: chunk.match(/公司[:：]\s*([^\n]+)/)?.[1] ?? "",
      city: chunk.match(/杭州|上海|南京|北京|深圳|广州/)?.[0] ?? "",
      description: chunk,
      requirements: chunk,
      rawText: chunk,
      source: "company_career_page",
      sourceUrl,
      sourcePlatform: "企业官网招聘页",
    }));
}
