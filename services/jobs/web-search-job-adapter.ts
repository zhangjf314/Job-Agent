import { appConfig } from "@/lib/config";
import type { JobSearchInput, RawJobResult } from "@/types/job";
import type { SearchProvider, SearchProviderResult } from "@/services/search/search-provider";
import { createSearchProvider } from "@/services/search/search-provider-factory";
import { FixtureSearchProvider } from "@/services/search/fixture-search-provider";
import { fetchPublicPage } from "@/services/web/page-fetcher";
import { extractPageText } from "@/services/web/page-text-extractor";
import { parseCompanyCareerPageText } from "./company-page-job-parser";
import { classifyJobSource } from "./job-source-classifier";
import type { JobSourceAdapter } from "./job-source-adapter";
import { normalizeJobPost } from "./job-normalizer";

export function buildChineseJobSearchQuery(input: JobSearchInput) {
  return [
    input.city,
    input.query,
    input.education,
    input.experience,
    "招聘",
    "校招",
    "实习",
    "应届生",
  ].filter(Boolean).join(" ");
}

function isLikelyJob(result: SearchProviderResult) {
  const text = `${result.title} ${result.snippet}`;
  if (/培训|招生|课程|加盟|贷款|攻略|怎么找工作/.test(text)) return false;
  return /招聘|校招|实习|岗位|职位|工程师|开发|分析|Java|React|Python|SQL/.test(text);
}

export class WebSearchJobAdapter implements JobSourceAdapter {
  source = "web_search" as const;
  constructor(private provider: SearchProvider = createSearchProvider()) {}

  async search(input: JobSearchInput): Promise<RawJobResult[]> {
    let results = await this.provider.search({
      query: buildChineseJobSearchQuery(input),
      city: input.city,
      role: input.query,
      keywords: [input.education ?? "", input.experience ?? ""].filter(Boolean),
      limit: 10,
      excludeDomains: ["training", "course"],
    });
    if (results.length === 0 && this.provider.name !== "fixture") {
      results = await new FixtureSearchProvider().search({
        query: buildChineseJobSearchQuery(input),
        city: input.city,
        role: input.query,
        keywords: [input.education ?? "", input.experience ?? ""].filter(Boolean),
        limit: 10,
      });
    }
    const raws: RawJobResult[] = [];
    for (const result of results.filter(isLikelyJob)) {
      const classified = classifyJobSource({ url: result.url, title: result.title, snippet: result.snippet });
      if (appConfig.enableCompanyPageFetch && classified.source === "company_career_page") {
        try {
          const html = await fetchPublicPage(result.url);
          raws.push(...parseCompanyCareerPageText(extractPageText(html), result.url));
          continue;
        } catch {
          // Fall back to snippet-only candidate.
        }
      }
      raws.push({
        title: result.title,
        city: input.city,
        description: result.snippet,
        requirements: result.snippet,
        rawText: `${result.title}\n${result.snippet}`,
        source: classified.source,
        sourceUrl: result.url,
        sourcePlatform: classified.sourcePlatform,
      });
    }
    return raws;
  }

  async normalize(raw: RawJobResult) {
    return normalizeJobPost(raw);
  }
}
