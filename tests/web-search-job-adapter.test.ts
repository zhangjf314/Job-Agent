import { describe, expect, it } from "vitest";
import { WebSearchJobAdapter, buildChineseJobSearchQuery } from "@/services/jobs/web-search-job-adapter";
import type { SearchProvider } from "@/services/search/search-provider";

describe("WebSearchJobAdapter", () => {
  it("builds Chinese job search query", () => {
    const query = buildChineseJobSearchQuery({ query: "Java 后端 Spring Boot MySQL", city: "杭州", education: "本科", experience: "应届生" });
    expect(query).toContain("杭州");
    expect(query).toContain("Java 后端");
    expect(query).toContain("应届生");
    expect(query).toContain("实习");
  });

  it("creates raw job candidates from search results", async () => {
    const provider: SearchProvider = {
      name: "test",
      async search() {
        return [{ title: "杭州 Java 后端招聘", url: "https://careers.example/job/1", displayUrl: "careers.example", sourceName: "企业官网", snippet: "本科 Java Spring Boot MySQL Redis 15k-25k" }];
      },
    };
    const raws = await new WebSearchJobAdapter(provider).search({ query: "Java", city: "杭州" });
    expect(raws).toHaveLength(1);
    expect(raws[0].rawText).toContain("Java");
  });
});
