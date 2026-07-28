import type { JobSearchInput, RawJobResult } from "@/types/job";
import type { JobSourceAdapter } from "./job-source-adapter";
import { normalizeJobPost } from "./job-normalizer";

export class CompanyCareerPageAdapter implements JobSourceAdapter {
  source = "company_career_page" as const;
  async search(input: JobSearchInput) {
    return input.rawResults ?? [];
  }
  async normalize(raw: RawJobResult) {
    return normalizeJobPost({ ...raw, source: "company_career_page" });
  }
}
