import type { JobSearchInput, RawJobResult } from "@/types/job";
import type { JobSourceAdapter } from "./job-source-adapter";
import { normalizeJobPost } from "./job-normalizer";

export class WebSearchResultAdapter implements JobSourceAdapter {
  source = "web_search" as const;
  async search(input: JobSearchInput) {
    return input.rawResults ?? [];
  }
  async normalize(raw: RawJobResult) {
    return normalizeJobPost({ ...raw, source: "web_search" });
  }
}
