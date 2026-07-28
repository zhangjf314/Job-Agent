import { appConfig, type AppConfig } from "@/lib/config";
import type { SearchProvider, SearchProviderInput, SearchProviderResult } from "./search-provider";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  score?: number;
  published_date?: string;
  raw_content?: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

export class TavilySearchProvider implements SearchProvider {
  name = "tavily";

  constructor(
    private readonly config: AppConfig = appConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async search(input: SearchProviderInput): Promise<SearchProviderResult[]> {
    if (!this.config.enableRealWebSearch || !this.config.searchApiKey.trim()) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await this.fetcher(this.config.searchBaseUrl || this.config.searchApiBaseUrl || "https://api.tavily.com/search", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": this.config.userAgent,
        },
        body: JSON.stringify({
          api_key: this.config.searchApiKey,
          query: input.query,
          max_results: input.limit ?? this.config.jobSearchDefaultLimit,
          search_depth: "basic",
          include_answer: false,
          include_raw_content: false,
          include_images: false,
          days: input.freshnessDays,
          include_domains: input.domains,
          exclude_domains: input.excludeDomains,
        }),
      });

      if (!response.ok) return [];
      const json = (await response.json()) as TavilyResponse;
      return (json.results ?? []).map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: item.content ?? item.snippet ?? item.raw_content ?? "",
        displayUrl: item.url ?? "",
        sourceName: "tavily",
        publishedAt: item.published_date ? new Date(item.published_date) : null,
      })).filter((item) => item.title && item.url);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
