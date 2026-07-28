export type SourceClassification = {
  sourcePlatform: string;
  sourceTrustLevel: "high" | "medium" | "low" | "unknown";
  sourceWarnings: string[];
  source: "web_search" | "company_career_page" | "official_employment_platform" | "other";
};

export function classifyJobSource(input: { url?: string; title?: string; snippet?: string }): SourceClassification {
  const text = `${input.url ?? ""} ${input.title ?? ""} ${input.snippet ?? ""}`.toLowerCase();
  if (/training|培训|课程|招生|加盟|贷款/.test(text)) return { sourcePlatform: "培训/广告页", sourceTrustLevel: "low", sourceWarnings: ["疑似培训广告或课程页"], source: "other" };
  if (/university|career\.edu|就业|高校|大学/.test(text)) return { sourcePlatform: "学校就业网", sourceTrustLevel: "high", sourceWarnings: [], source: "official_employment_platform" };
  if (/talent|人才|人社|gov/.test(text)) return { sourcePlatform: "地方人才网/官方平台", sourceTrustLevel: "high", sourceWarnings: [], source: "official_employment_platform" };
  if (/career|careers|join|jobs|招聘/.test(text) && !/search|资讯|攻略/.test(text)) return { sourcePlatform: "企业官网招聘页", sourceTrustLevel: "high", sourceWarnings: [], source: "company_career_page" };
  if (/广告|推广|资讯|攻略/.test(text)) return { sourcePlatform: "普通资讯/广告页", sourceTrustLevel: "low", sourceWarnings: ["可能不是岗位详情页"], source: "web_search" };
  return { sourcePlatform: "Web Search", sourceTrustLevel: "medium", sourceWarnings: [], source: "web_search" };
}
