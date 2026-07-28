import type { NormalizedJobPost } from "@/schemas/job";

export function calculateJobQualityScore(job: Pick<NormalizedJobPost, "title" | "company" | "city" | "salaryText" | "description" | "requirements" | "source" | "publishedAt" | "collectedAt">) {
  let score = 0;
  if (job.title) score += 10;
  if (job.company) score += 10;
  if (job.city) score += 10;
  if (job.salaryText) score += 10;
  if (job.description.length >= 30) score += 20;
  if (job.requirements.length >= 20) score += 20;
  if (["company_career_page", "official_employment_platform", "manual", "mock"].includes(job.source)) score += 10;
  if (job.publishedAt || job.collectedAt) score += 10;
  return Math.max(0, Math.min(100, score));
}
