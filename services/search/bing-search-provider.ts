import { appConfig } from "@/lib/config";
import type { SearchProvider, SearchProviderInput } from "./search-provider";

type GenericSearchItem = {
  name?: string;
  title?: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  displayUrl?: string;
  datePublished?: string;
};

export class GenericWebSearchProvider implements SearchProvider {
  name = "generic_web";

  async search(input: SearchProviderInput) {
    if (!appConfig.enableRealWebSearch || !appConfig.searchApiKey) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(appConfig.searchBaseUrl || appConfig.searchApiBaseUrl || "https://api.bing.microsoft.com/v7.0/search");
      url.searchParams.set("q", input.query);
      url.searchParams.set("count", String(input.limit ?? 10));
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": appConfig.userAgent,
          "Ocp-Apim-Subscription-Key": appConfig.searchApiKey,
        },
      });
      if (!res.ok) return [];
      const json = await res.json();
      const values = json.webPages?.value ?? json.results ?? [];
      return (values as GenericSearchItem[]).map((item) => ({
        title: item.name ?? item.title ?? "",
        url: item.url ?? item.link ?? "",
        snippet: item.snippet ?? item.description ?? "",
        displayUrl: item.displayUrl ?? item.url ?? item.link ?? "",
        sourceName: "web_search",
        publishedAt: item.datePublished ? new Date(item.datePublished) : null,
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
