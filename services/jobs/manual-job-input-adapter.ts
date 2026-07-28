import type { JobSearchInput, RawJobResult } from "@/types/job";
import type { JobSourceAdapter } from "./job-source-adapter";
import { normalizeJobPost } from "./job-normalizer";

export class ManualJobInputAdapter implements JobSourceAdapter {
  source = "manual" as const;
  async search(input: JobSearchInput) {
    return input.rawResults ?? [];
  }
  async normalize(raw: RawJobResult) {
    return normalizeJobPost({ ...raw, source: "manual" });
  }
}
