import type { JobSource, JobSearchInput, RawJobDetail, RawJobResult } from "@/types/job";
import type { NormalizedJobPost } from "@/schemas/job";

export interface JobSourceAdapter {
  source: JobSource;
  search(input: JobSearchInput): Promise<RawJobResult[]>;
  fetchDetail?(url: string): Promise<RawJobDetail>;
  normalize(raw: RawJobResult | RawJobDetail): Promise<NormalizedJobPost>;
}
