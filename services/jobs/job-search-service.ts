import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jobSearchInputSchema } from "@/schemas/job";
import type { JobSearchInput, JobSearchSourceType } from "@/types/job";
import type { JobSourceAdapter } from "./job-source-adapter";
import { normalizeAndSaveJobPosts, matchJobsForProfile, searchJobsForProfile, searchRealJobsForProfile } from "./job-service";
import { ManualJDProvider } from "./providers/manual-jd-provider";
import { ManualUrlProvider } from "./providers/manual-url-provider";
import { CompanyCareerPageProvider } from "./providers/company-career-page-provider";
import { WebSearchProvider } from "./providers/web-search-provider";

type DbClient = PrismaClient;

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function sourceType(input: JobSearchInput & { source?: string }): JobSearchSourceType {
  const first = input.sourceTypes?.[0] ?? input.source;
  if (first === "manual_jd" || first === "manual_url" || first === "company_career_page" || first === "web_search") return first;
  return "mock";
}

export function getJobSourceAdapter(type: JobSearchSourceType): JobSourceAdapter | null {
  if (type === "manual_jd") return new ManualJDProvider();
  if (type === "manual_url") return new ManualUrlProvider();
  if (type === "company_career_page") return new CompanyCareerPageProvider();
  if (type === "web_search") return new WebSearchProvider();
  return null;
}

export async function searchJobsWithProviders(input: JobSearchInput & { source?: string }, db: DbClient = prisma) {
  const parsed = jobSearchInputSchema.parse({
    ...input,
    keywords: stringArray(input.keywords),
    sourceTypes: input.sourceTypes ?? [],
  });
  const selected = sourceType({ ...parsed, source: input.source });

  if (selected === "mock") return searchJobsForProfile(parsed, db);
  if (selected === "web_search" && !parsed.rawText && !parsed.url) return searchRealJobsForProfile(parsed, db);

  const adapter = getJobSourceAdapter(selected);
  if (!adapter) return searchJobsForProfile(parsed, db);

  const run = await db.jobSearchRun.create({
    data: {
      profileId: parsed.profileId || null,
      strategyPlanId: parsed.strategyPlanId || null,
      directionRecommendationId: parsed.directionRecommendationId || null,
      query: parsed.query,
      city: parsed.city || null,
      filters: {
        education: parsed.education,
        experience: parsed.experience,
        keywords: stringArray(parsed.keywords),
        sourceType: selected,
      },
      source: adapter.source,
      status: "running",
    },
  });

  try {
    const raws = await adapter.search({
      ...parsed,
      keywords: stringArray(parsed.keywords),
      sourceTypes: [selected],
    });
    const normalized = await Promise.all(raws.slice(0, parsed.limit).map((raw) => adapter.normalize(raw)));
    const jobs = await normalizeAndSaveJobPosts(normalized, db);
    const matches = parsed.profileId ? await matchJobsForProfile(parsed.profileId, jobs.map((job) => job.id), db) : [];
    await db.jobSearchRun.update({
      where: { id: run.id },
      data: { status: "completed", totalFound: raws.length, totalSaved: jobs.length },
    });
    return { run: { ...run, status: "completed", totalFound: raws.length, totalSaved: jobs.length }, jobs, matches };
  } catch (error) {
    await db.jobSearchRun.update({
      where: { id: run.id },
      data: { status: "failed", notes: error instanceof Error ? error.message : "Job search failed" },
    });
    throw error;
  }
}
