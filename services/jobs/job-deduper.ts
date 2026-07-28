import type { NormalizedJobPost } from "@/schemas/job";

function completeness(job: NormalizedJobPost) {
  return [job.title, job.company, job.city, job.salaryText, job.description, job.requirements, ...job.skills].filter(Boolean).length;
}

export function dedupeJobPosts(jobPosts: NormalizedJobPost[]) {
  const result: NormalizedJobPost[] = [];
  for (const job of jobPosts) {
    const existingIndex = result.findIndex((item) =>
      (job.sourceUrl && item.sourceUrl === job.sourceUrl) ||
      item.contentHash === job.contentHash ||
      (item.companyNormalizedName === job.companyNormalizedName && item.normalizedTitle === job.normalizedTitle && item.city === job.city),
    );
    if (existingIndex === -1) {
      result.push(job);
    } else {
      const existing = result[existingIndex];
      result[existingIndex] = completeness(job) >= completeness(existing) || job.collectedAt > existing.collectedAt ? job : existing;
    }
  }
  return result;
}
