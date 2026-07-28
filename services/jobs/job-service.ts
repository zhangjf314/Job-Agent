import type { PrismaClient, SavedJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { careerProfileInclude } from "@/services/career-profile-service";
import { createJobDescription } from "@/services/jd-service";
import { jobSearchInputSchema, normalizedJobPostSchema, savedJobSchema, type NormalizedJobPost } from "@/schemas/job";
import type { JobSearchInput, RawJobResult } from "@/types/job";
import { MockChinaJobAdapter } from "./mock-china-job-adapter";
import { ManualJobInputAdapter } from "./manual-job-input-adapter";
import { WebSearchJobAdapter } from "./web-search-job-adapter";
import { normalizeJobPost } from "./job-normalizer";
import { dedupeJobPosts } from "./job-deduper";
import { calculateJobMatch } from "./job-matcher";
import { fetchPublicPage } from "@/services/web/page-fetcher";
import { extractPageText } from "@/services/web/page-text-extractor";
import { parseCompanyCareerPageText } from "./company-page-job-parser";

type DbClient = PrismaClient;
type ImportedSearchItem = {
  title?: string;
  name?: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  displayUrl?: string;
  sourceName?: string;
  publishedAt?: string;
};

export const jobPostInclude = {
  matches: true,
  savedJobs: true,
} as const;

function clean(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

function mapJobCreate(job: NormalizedJobPost) {
  return {
    title: job.title,
    normalizedTitle: job.normalizedTitle,
    company: job.company,
    companyNormalizedName: job.companyNormalizedName,
    city: job.city,
    district: clean(job.district),
    province: clean(job.province),
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryMonths: job.salaryMonths ?? null,
    salaryText: clean(job.salaryText),
    experienceRequirement: clean(job.experienceRequirement),
    educationRequirement: clean(job.educationRequirement),
    internshipDuration: clean(job.internshipDuration),
    conversionOpportunity: job.conversionOpportunity,
    candidateProfile: job.candidateProfile,
    jobType: job.jobType,
    workMode: job.workMode,
    description: job.description,
    requirements: job.requirements,
    benefits: job.benefits,
    skills: job.skills,
    keywords: job.keywords,
    industries: job.industries,
    companyType: job.companyType,
    headcount: job.headcount ?? null,
    source: job.source,
    sourceUrl: clean(job.sourceUrl),
    sourcePlatform: clean(job.sourcePlatform),
    publishedAt: job.publishedAt ?? null,
    collectedAt: job.collectedAt,
    contentHash: job.contentHash,
    qualityScore: job.qualityScore,
    riskFlags: job.riskFlags,
    rawText: clean(job.rawText),
    rawJson: job.rawJson === undefined ? undefined : JSON.parse(JSON.stringify(job.rawJson)),
  };
}

export async function normalizeAndSaveJobPosts(posts: NormalizedJobPost[], db: DbClient = prisma) {
  const unique = dedupeJobPosts(posts.map((post) => normalizedJobPostSchema.parse(post)));
  const saved = [];
  for (const job of unique) {
    const existing = await db.jobPost.findFirst({
      where: {
        OR: [
          { contentHash: job.contentHash },
          ...(job.sourceUrl ? [{ sourceUrl: job.sourceUrl }] : []),
        ],
      },
    });
    if (existing) {
      saved.push(existing);
    } else {
      saved.push(await db.jobPost.create({ data: mapJobCreate(job) }));
    }
  }
  return saved;
}

export async function searchJobsForProfile(input: JobSearchInput, db: DbClient = prisma) {
  const parsed = jobSearchInputSchema.parse({ ...input, source: "mock" });
  const adapter = new MockChinaJobAdapter();
  const run = await db.jobSearchRun.create({
    data: {
      profileId: clean(parsed.profileId),
      strategyPlanId: clean(parsed.strategyPlanId),
      directionRecommendationId: clean(parsed.directionRecommendationId),
      query: parsed.query,
      city: clean(parsed.city),
      filters: { education: parsed.education, experience: parsed.experience },
      source: "mock",
      status: "running",
    },
  });
  const raw = await adapter.search(parsed);
  const normalized = await Promise.all(raw.map((job) => adapter.normalize(job)));
  const saved = await normalizeAndSaveJobPosts(normalized, db);
  const matches = parsed.profileId ? await matchJobsForProfile(parsed.profileId, saved.map((job) => job.id), db) : [];
  await db.jobSearchRun.update({
    where: { id: run.id },
    data: { status: "completed", totalFound: raw.length, totalSaved: saved.length },
  });
  return { run, jobs: saved, matches };
}

export async function searchRealJobsForProfile(input: JobSearchInput, db: DbClient = prisma) {
  const parsed = jobSearchInputSchema.parse({ ...input, source: "web_search" });
  const adapter = new WebSearchJobAdapter();
  const run = await db.jobSearchRun.create({
    data: {
      profileId: clean(parsed.profileId),
      strategyPlanId: clean(parsed.strategyPlanId),
      directionRecommendationId: clean(parsed.directionRecommendationId),
      query: parsed.query,
      city: clean(parsed.city),
      filters: { education: parsed.education, experience: parsed.experience },
      source: "web_search",
      status: "running",
    },
  });
  const raw = await adapter.search(parsed);
  const normalized = await Promise.all(raw.map((job) => adapter.normalize(job)));
  const saved = await normalizeAndSaveJobPosts(normalized, db);
  const matches = parsed.profileId ? await matchJobsForProfile(parsed.profileId, saved.map((job) => job.id), db) : [];
  await db.jobSearchRun.update({
    where: { id: run.id },
    data: { status: "completed", totalFound: raw.length, totalSaved: saved.length },
  });
  return { run, jobs: saved, matches };
}

export async function searchJobsByStrategy(strategyPlanId: string, db: DbClient = prisma) {
  const strategy = await db.jobSearchStrategy.findFirst({ where: { strategyPlanId } });
  return searchJobsForProfile({
    profileId: strategy?.profileId,
    strategyPlanId,
    query: strategy?.searchKeywords.slice(0, 3).join(" ") || "Java 后端",
    city: strategy?.targetCities[0] ?? "",
  }, db);
}

export async function searchJobsByStrategyWithSource(strategyPlanId: string, source: "mock" | "web_search", db: DbClient = prisma) {
  const strategy = await db.jobSearchStrategy.findFirst({ where: { strategyPlanId } });
  const input = {
    profileId: strategy?.profileId,
    strategyPlanId,
    query: strategy?.searchKeywords.slice(0, 3).join(" ") || "Java 后端",
    city: strategy?.targetCities[0] ?? "",
  };
  return source === "web_search" ? searchRealJobsForProfile(input, db) : searchJobsForProfile(input, db);
}

export async function createManualJobPost(profileId: string, rawText: string, sourceUrl = "", db: DbClient = prisma) {
  const adapter = new ManualJobInputAdapter();
  const normalized = await adapter.normalize({ rawText, sourceUrl, source: "manual" });
  const [job] = await normalizeAndSaveJobPosts([normalized], db);
  const match = await matchJobToProfile(profileId, job.id, db);
  return { job, match };
}

export async function listJobPosts(db: DbClient = prisma) {
  return db.jobPost.findMany({ orderBy: { collectedAt: "desc" }, include: jobPostInclude });
}

export async function getJobPostById(id: string, db: DbClient = prisma) {
  return db.jobPost.findUnique({ where: { id }, include: jobPostInclude });
}

export async function deleteJobPost(id: string, db: DbClient = prisma) {
  return db.jobPost.delete({ where: { id } });
}

export async function matchJobToProfile(profileId: string, jobPostId: string, db: DbClient = prisma) {
  const profile = await db.careerProfile.findUniqueOrThrow({ where: { id: profileId }, include: careerProfileInclude });
  const job = await db.jobPost.findUniqueOrThrow({ where: { id: jobPostId } });
  const resume = await db.resume.findFirst({ where: { profileId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  const result = calculateJobMatch(profile, resume, { recommendedCities: profile.targetCities }, null, job);
  return db.jobMatch.create({
    data: {
      profileId,
      resumeId: resume?.id ?? null,
      jobPostId,
      ...result,
    },
  });
}

export async function matchJobsForProfile(profileId: string, jobPostIds: string[], db: DbClient = prisma) {
  const matches = [];
  for (const id of jobPostIds) matches.push(await matchJobToProfile(profileId, id, db));
  return matches;
}

export async function listJobMatchesByProfileId(profileId: string, db: DbClient = prisma) {
  return db.jobMatch.findMany({ where: { profileId }, include: { jobPost: true }, orderBy: { matchScore: "desc" } });
}

export async function getJobMatchById(id: string, db: DbClient = prisma) {
  return db.jobMatch.findUnique({ where: { id }, include: { jobPost: true } });
}

export async function saveJob(profileId: string, jobPostId: string, notes = "", db: DbClient = prisma) {
  const parsed = savedJobSchema.parse({ profileId, jobPostId, status: "saved", notes });
  return db.savedJob.upsert({
    where: { profileId_jobPostId: { profileId, jobPostId } },
    update: { notes: parsed.notes, status: parsed.status },
    create: parsed,
    include: { jobPost: true },
  });
}

export async function updateSavedJobStatus(id: string, status: SavedJobStatus, db: DbClient = prisma) {
  return db.savedJob.update({ where: { id }, data: { status }, include: { jobPost: true } });
}

export async function listSavedJobsByProfileId(profileId: string, db: DbClient = prisma) {
  return db.savedJob.findMany({ where: { profileId }, include: { jobPost: true }, orderBy: { updatedAt: "desc" } });
}

export async function createJDFromJobPost(profileId: string, jobPostId: string, resumeId?: string, db: DbClient = prisma) {
  const job = await db.jobPost.findUniqueOrThrow({ where: { id: jobPostId } });
  return createJobDescription({
    profileId,
    resumeId,
    title: job.normalizedTitle || job.title,
    company: job.company,
    city: job.city,
    sourceUrl: job.sourceUrl ?? "",
    rawText: [job.title, job.company, job.city, job.salaryText, job.description, job.requirements, job.skills.join("、")].filter(Boolean).join("\n"),
  }, db);
}

export async function createManualRawJob(raw: RawJobResult) {
  return new ManualJobInputAdapter().normalize(raw);
}

export async function importSearchResultsJson(profileId: string, jsonText: string, db: DbClient = prisma) {
  const parsed = JSON.parse(jsonText);
  const results = Array.isArray(parsed) ? parsed : parsed.results ?? parsed.webPages?.value ?? [];
  const adapter = new WebSearchJobAdapter({
    name: "imported_fixture",
    async search() {
      return (results as ImportedSearchItem[]).map((item) => ({
        title: item.title ?? item.name ?? "",
        url: item.url ?? item.link ?? "",
        snippet: item.snippet ?? item.description ?? "",
        displayUrl: item.displayUrl ?? item.url ?? "",
        sourceName: item.sourceName ?? "imported",
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      }));
    },
  });
  const raw = await adapter.search({ query: "", profileId });
  const normalized = await Promise.all(raw.map((job) => adapter.normalize(job)));
  const saved = await normalizeAndSaveJobPosts(normalized, db);
  const matches = profileId ? await matchJobsForProfile(profileId, saved.map((job) => job.id), db) : [];
  return { jobs: saved, matches };
}

export async function fetchAndParseCompanyCareerPage(url: string, profileId?: string, db: DbClient = prisma) {
  const html = await fetchPublicPage(url);
  const rawJobs = parseCompanyCareerPageText(extractPageText(html), url);
  const normalized = await Promise.all(rawJobs.map((job) => normalizeJobPost(job)));
  const saved = await normalizeAndSaveJobPosts(normalized, db);
  const matches = profileId ? await matchJobsForProfile(profileId, saved.map((job) => job.id), db) : [];
  return { jobs: saved, matches };
}
