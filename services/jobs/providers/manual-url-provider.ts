import type { JobSearchInput, RawJobResult } from "@/types/job";
import { fetchPublicPage } from "@/services/web/page-fetcher";
import { extractPageText } from "@/services/web/page-text-extractor";
import type { JobSourceAdapter } from "../job-source-adapter";
import { normalizeJobPost } from "../job-normalizer";

export class ManualUrlProvider implements JobSourceAdapter {
  source = "web_search" as const;
  name = "manual_url";

  async search(input: JobSearchInput): Promise<RawJobResult[]> {
    if (!input.url) return [];
    try {
      const html = await fetchPublicPage(input.url);
      const rawText = extractPageText(html);
      return [{
        title: input.query,
        city: input.city,
        description: rawText,
        requirements: rawText,
        rawText,
        source: "web_search",
        sourceUrl: input.url,
      }];
    } catch {
      return [{
        title: input.query || "Fetch failed job candidate",
        city: input.city,
        description: "fetch_failed",
        requirements: "",
        rawText: "fetch_failed",
        source: "web_search",
        sourceUrl: input.url,
      }];
    }
  }

  async normalize(raw: RawJobResult) {
    return normalizeJobPost(raw);
  }
}
