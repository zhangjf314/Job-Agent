import { describe, expect, it } from "vitest";
import { getAppConfig } from "@/lib/config";
import { FixtureSearchProvider } from "@/services/search/fixture-search-provider";
import { createSearchProvider } from "@/services/search/search-provider-factory";
import { TavilySearchProvider } from "@/services/search/tavily-search-provider";

describe("search providers", () => {
  it("fixture provider returns job-like results", async () => {
    const results = await new FixtureSearchProvider().search({ query: "Java 后端", city: "杭州" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title + results[0].snippet).toContain("Java");
  });

  it("factory defaults to fixture without api key", () => {
    expect(createSearchProvider().name).toBe("fixture");
  });

  it("factory selects tavily when configured and enabled", () => {
    const config = getAppConfig({
      SEARCH_PROVIDER: "tavily",
      SEARCH_API_KEY: "test-key",
      ENABLE_REAL_WEB_SEARCH: "true",
      SEARCH_BASE_URL: "https://api.tavily.com/search",
    });
    expect(createSearchProvider(config).name).toBe("tavily");
  });

  it("tavily provider maps API results without leaking api key", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        results: [
          {
            title: "杭州 Java 后端开发",
            url: "https://careers.example/java",
            content: "本科 Spring Boot MySQL Redis",
            published_date: "2026-06-01",
          },
        ],
      }), { status: 200 });
    }) as typeof fetch;
    const config = getAppConfig({
      SEARCH_PROVIDER: "tavily",
      SEARCH_API_KEY: "secret-search-key",
      ENABLE_REAL_WEB_SEARCH: "true",
      SEARCH_BASE_URL: "https://api.tavily.com/search",
    });
    const results = await new TavilySearchProvider(config, fetcher).search({ query: "杭州 Java 后端", limit: 3 });

    expect(results[0]).toMatchObject({
      title: "杭州 Java 后端开发",
      url: "https://careers.example/java",
      sourceName: "tavily",
    });
    expect(calls[0].init?.headers).not.toEqual(expect.objectContaining({ Authorization: expect.stringContaining("secret-search-key") }));
    expect(String(calls[0].init?.body)).toContain("secret-search-key");
  });
});
