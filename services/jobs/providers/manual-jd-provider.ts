import type { JobSearchInput, RawJobResult } from "@/types/job";
import type { JobSourceAdapter } from "../job-source-adapter";
import { normalizeJobPost } from "../job-normalizer";

export class ManualJDProvider implements JobSourceAdapter {
  source = "manual" as const;
  name = "manual_jd";

  async search(input: JobSearchInput): Promise<RawJobResult[]> {
    const rawText = input.rawText || input.rawResults?.[0]?.rawText || "";
    if (!rawText.trim()) return [];
    return [{
      title: input.query,
      city: input.city,
      description: rawText,
      requirements: rawText,
      rawText,
      source: "manual",
      sourceUrl: input.url,
    }];
  }

  async normalize(raw: RawJobResult) {
    return normalizeJobPost({ ...raw, source: "manual" });
  }
}
