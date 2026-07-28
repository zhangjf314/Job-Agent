import { describe, expect, it } from "vitest";
import { normalizeJobPost } from "@/services/jobs/job-normalizer";
import { dedupeJobPosts } from "@/services/jobs/job-deduper";

describe("dedupeJobPosts", () => {
  it("dedupes by sourceUrl, contentHash and company title city", async () => {
    const a = await normalizeJobPost({ title: "Java 后端", company: "A 公司", city: "杭州", sourceUrl: "https://x/1", rawText: "Java MySQL 本科", source: "manual" });
    const b = { ...a, collectedAt: new Date(Date.now() + 1000) };
    const c = await normalizeJobPost({ title: "Java 后端", company: "A 公司", city: "杭州", rawText: "Java MySQL 本科 更多描述", source: "manual" });
    expect(dedupeJobPosts([a, b, c])).toHaveLength(1);
  });
});
