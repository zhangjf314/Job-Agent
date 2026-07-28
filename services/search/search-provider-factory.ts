import { appConfig } from "@/lib/config";
import type { SearchProvider } from "./search-provider";
import { FixtureSearchProvider } from "./fixture-search-provider";
import { TavilySearchProvider } from "./tavily-search-provider";

export function createSearchProvider(config = appConfig): SearchProvider {
  const provider = config.searchProvider.toLowerCase();
  if (provider === "mock" || provider === "fixture") return new FixtureSearchProvider();
  if (!config.enableRealWebSearch || !config.searchApiKey.trim()) return new FixtureSearchProvider();
  if (provider === "tavily") return new TavilySearchProvider(config);
  return new FixtureSearchProvider();
}
