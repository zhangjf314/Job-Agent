import type { JobSearchInput, RawJobResult } from "@/types/job";
import { fetchPublicPage } from "@/services/web/page-fetcher";
import { extractPageText } from "@/services/web/page-text-extractor";
import { parseCompanyCareerPageText } from "../company-page-job-parser";
import type { JobSourceAdapter } from "../job-source-adapter";
import { normalizeJobPost } from "../job-normalizer";

export class CompanyCareerPageProvider implements JobSourceAdapter {
  source = "company_career_page" as const;
  name = "company_career_page";

  async search(input: JobSearchInput): Promise<RawJobResult[]> {
    if (input.rawText?.trim()) return parseCompanyCareerPageText(input.rawText, input.url);
    if (!input.url) return [];
    const html = await fetchPublicPage(input.url);
    const text = extractPageText(html);
    const parsed = parseCompanyCareerPageText(text, input.url);
    return parsed.length ? parsed : [{
      title: input.query,
      city: input.city,
      description: text,
      requirements: text,
      rawText: text,
      source: "company_career_page",
      sourceUrl: input.url,
    }];
  }

  async normalize(raw: RawJobResult) {
    return normalizeJobPost({ ...raw, source: "company_career_page" });
  }
}
