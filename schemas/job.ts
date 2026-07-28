import { z } from "zod";
import {
  companyTypes,
  jobRecommendations,
  jobSearchRunStatuses,
  jobSources,
  jobTypes,
  savedJobStatuses,
  workModes,
} from "@/types/job";

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);
const stringList = z.array(z.string().trim().min(1)).default([]);
const score = z.number().int().min(0).max(100);
const optionalUrl = z.string().trim().url().optional().or(z.literal(""));

export const jobTypeSchema = z.enum(jobTypes);
export const workModeSchema = z.enum(workModes);
export const jobSourceSchema = z.enum(jobSources);
export const jobSearchRunStatusSchema = z.enum(jobSearchRunStatuses);
export const jobRecommendationSchema = z.enum(jobRecommendations);
export const savedJobStatusSchema = z.enum(savedJobStatuses);
export const companyTypeSchema = z.enum(companyTypes);

export const normalizedJobPostSchema = z.object({
  title: requiredText("job title"),
  normalizedTitle: requiredText("normalized title"),
  company: requiredText("company"),
  companyNormalizedName: requiredText("normalized company"),
  city: requiredText("city"),
  district: z.string().trim().optional().default(""),
  province: z.string().trim().optional().default(""),
  salaryMin: z.number().int().positive().optional().nullable(),
  salaryMax: z.number().int().positive().optional().nullable(),
  salaryMonths: z.number().int().min(1).max(24).optional().nullable(),
  salaryText: z.string().trim().optional().default(""),
  experienceRequirement: z.string().trim().optional().default(""),
  educationRequirement: z.string().trim().optional().default(""),
  internshipDuration: z.string().trim().optional().default(""),
  conversionOpportunity: z.string().trim().optional().default("unknown"),
  candidateProfile: stringList,
  jobType: jobTypeSchema.default("unknown"),
  workMode: workModeSchema.default("unknown"),
  description: requiredText("description"),
  requirements: z.string().trim().default(""),
  benefits: stringList,
  skills: stringList,
  keywords: stringList,
  industries: stringList,
  companyType: companyTypeSchema.default("unknown"),
  headcount: z.number().int().positive().optional().nullable(),
  source: jobSourceSchema,
  sourceUrl: optionalUrl,
  sourcePlatform: z.string().trim().optional().default(""),
  publishedAt: z.coerce.date().optional().nullable(),
  collectedAt: z.coerce.date(),
  contentHash: requiredText("content hash"),
  qualityScore: score,
  riskFlags: stringList,
  rawText: z.string().trim().optional().default(""),
  rawJson: z.unknown().optional(),
});

export const jobPostSchema = normalizedJobPostSchema;

export const jobSearchInputSchema = z.object({
  profileId: z.string().trim().optional().default(""),
  strategyPlanId: z.string().trim().optional().default(""),
  directionRecommendationId: z.string().trim().optional().default(""),
  query: requiredText("query"),
  city: z.string().trim().optional().default(""),
  education: z.string().trim().optional().default(""),
  experience: z.string().trim().optional().default(""),
  salaryMin: z.coerce.number().int().positive().optional(),
  salaryMax: z.coerce.number().int().positive().optional(),
  keywords: z.union([z.string(), z.array(z.string())]).optional().default(""),
  sourceTypes: z.array(z.string()).optional().default([]),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  rawText: z.string().trim().optional().default(""),
  url: optionalUrl,
  source: jobSourceSchema.default("mock"),
});

export const jobSearchRunSchema = z.object({
  profileId: z.string().trim().optional().nullable(),
  strategyPlanId: z.string().trim().optional().nullable(),
  directionRecommendationId: z.string().trim().optional().nullable(),
  query: requiredText("query"),
  city: z.string().trim().optional().nullable(),
  filters: z.unknown().optional(),
  source: jobSourceSchema,
  status: jobSearchRunStatusSchema,
  totalFound: z.number().int().min(0),
  totalSaved: z.number().int().min(0),
  notes: z.string().trim().optional().nullable(),
});

export const jobMatchResultSchema = z.object({
  matchScore: score,
  hardRequirementScore: score,
  skillMatchScore: score,
  projectMatchScore: score,
  experienceMatchScore: score,
  educationMatchScore: score,
  growthValueScore: score,
  conversionOpportunityScore: score,
  directionMatchScore: score,
  preferenceMatchScore: score,
  freshnessScore: score,
  qualityScore: score,
  riskPenalty: z.number().int().min(0).max(30),
  recommendation: jobRecommendationSchema,
  matchedPoints: stringList,
  gaps: stringList,
  riskWarnings: stringList,
  resumeSuggestions: stringList,
  interviewPrepSuggestions: stringList,
});

export const savedJobSchema = z.object({
  profileId: requiredText("profile ID"),
  jobPostId: requiredText("job post ID"),
  status: savedJobStatusSchema.default("saved"),
  notes: z.string().trim().optional().default(""),
});

export type NormalizedJobPost = z.infer<typeof normalizedJobPostSchema>;
export type JobSearchInputParsed = z.infer<typeof jobSearchInputSchema>;
export type JobMatchResult = z.infer<typeof jobMatchResultSchema>;
export type SavedJobInput = z.infer<typeof savedJobSchema>;
