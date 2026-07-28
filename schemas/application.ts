import { z } from "zod";
import {
  applicationChannels,
  applicationPriorities,
  applicationRiskLevels,
  applicationSources,
  applicationStatuses,
  applicationTaskCategories,
  applicationTaskStatuses,
  interviewResults,
  interviewRoundStatuses,
  interviewRoundTypes,
  offerStatuses,
} from "@/types/application";

const requiredText = (label: string) => z.string().trim().min(1, `${label}不能为空`);
const optionalText = z.string().trim().optional().nullable();
const optionalUrl = z.string().trim().url().optional().or(z.literal("")).nullable();
const stringList = z.array(z.string().trim().min(1)).default([]);
const score = z.number().int().min(0).max(100);

export const applicationSourceSchema = z.enum(applicationSources);
export const applicationChannelSchema = z.enum(applicationChannels);
export const applicationStatusSchema = z.enum(applicationStatuses);
export const applicationPrioritySchema = z.enum(applicationPriorities);
export const interviewRoundTypeSchema = z.enum(interviewRoundTypes);
export const interviewRoundStatusSchema = z.enum(interviewRoundStatuses);
export const interviewResultSchema = z.enum(interviewResults);
export const applicationTaskCategorySchema = z.enum(applicationTaskCategories);
export const applicationTaskStatusSchema = z.enum(applicationTaskStatuses);
export const offerStatusSchema = z.enum(offerStatuses);
export const applicationRiskLevelSchema = z.enum(applicationRiskLevels);

export const applicationCreateInputSchema = z.object({
  profileId: requiredText("职业档案 ID"),
  jobPostId: z.string().trim().optional().nullable(),
  jobMatchId: z.string().trim().optional().nullable(),
  resumeId: z.string().trim().optional().nullable(),
  tailoredResumeId: z.string().trim().optional().nullable(),
  jdAnalysisId: z.string().trim().optional().nullable(),
  company: requiredText("公司"),
  jobTitle: requiredText("岗位"),
  city: optionalText,
  source: applicationSourceSchema.optional().nullable(),
  sourceUrl: optionalUrl,
  channel: applicationChannelSchema.default("other"),
  status: applicationStatusSchema.default("planned"),
  priority: applicationPrioritySchema.default("medium"),
  appliedAt: z.coerce.date().optional().nullable(),
  lastContactAt: z.coerce.date().optional().nullable(),
  nextFollowUpAt: z.coerce.date().optional().nullable(),
  salaryExpectation: optionalText,
  notes: optionalText,
});

export const applicationUpdateInputSchema = applicationCreateInputSchema.partial().extend({
  id: requiredText("投递 ID"),
});

export const interviewRoundCreateInputSchema = z.object({
  roundName: requiredText("轮次名称"),
  roundType: interviewRoundTypeSchema.default("other"),
  status: interviewRoundStatusSchema.default("scheduled"),
  scheduledAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
  interviewer: optionalText,
  location: optionalText,
  meetingLink: optionalUrl,
  notes: optionalText,
});

export const interviewFeedbackCreateInputSchema = z.object({
  feedbackText: requiredText("面试反馈"),
  selfRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  result: interviewResultSchema.default("unknown"),
});

export const interviewFeedbackAnalysisSchema = z.object({
  strengths: stringList,
  weaknesses: stringList,
  questionsAsked: stringList,
  knowledgeGaps: stringList,
  improvementActions: stringList,
  resumeImplications: stringList,
  strategyImplications: stringList,
  assumptions: stringList,
  warnings: stringList,
});

export const applicationTaskSchema = z.object({
  title: requiredText("任务标题"),
  description: optionalText,
  category: applicationTaskCategorySchema.default("other"),
  priority: applicationPrioritySchema.default("medium"),
  status: applicationTaskStatusSchema.default("todo"),
  dueAt: z.coerce.date().optional().nullable(),
});

export const offerRecordSchema = z.object({
  company: requiredText("公司"),
  jobTitle: requiredText("岗位"),
  city: optionalText,
  salaryMin: z.coerce.number().int().positive().optional().nullable(),
  salaryMax: z.coerce.number().int().positive().optional().nullable(),
  salaryMonths: z.coerce.number().int().min(1).max(24).optional().nullable(),
  salaryText: optionalText,
  benefits: stringList,
  probationInfo: optionalText,
  deadline: z.coerce.date().optional().nullable(),
  status: offerStatusSchema.default("pending"),
  pros: stringList,
  cons: stringList,
  notes: optionalText,
});

export const applicationInsightSchema = z.object({
  summary: requiredText("洞察摘要"),
  currentRiskLevel: applicationRiskLevelSchema,
  nextBestActions: stringList,
  resumeSuggestions: stringList,
  interviewPrepSuggestions: stringList,
  followUpSuggestions: stringList,
  strategyImplications: stringList,
  warnings: stringList,
});

export const applicationPipelineSummarySchema = z.object({
  planned: z.number().int().min(0),
  applied: z.number().int().min(0),
  resume_screen: z.number().int().min(0),
  written_test: z.number().int().min(0),
  interviewing: z.number().int().min(0),
  offer: z.number().int().min(0),
  rejected: z.number().int().min(0),
  withdrawn: z.number().int().min(0),
  no_response: z.number().int().min(0),
  review: z.number().int().min(0),
  archived: z.number().int().min(0),
});

export const offerComparisonSchema = z.object({
  recommendedOfferId: z.string().trim().nullable(),
  reasons: stringList,
  risks: stringList,
  negotiationSuggestions: stringList,
});

export const applicationReadinessScoreSchema = score;

export type ApplicationCreateInput = z.infer<typeof applicationCreateInputSchema>;
export type ApplicationUpdateInput = z.infer<typeof applicationUpdateInputSchema>;
export type InterviewRoundCreateInput = z.infer<typeof interviewRoundCreateInputSchema>;
export type InterviewFeedbackCreateInput = z.infer<typeof interviewFeedbackCreateInputSchema>;
export type ApplicationTaskInput = z.infer<typeof applicationTaskSchema>;
export type OfferRecordInput = z.infer<typeof offerRecordSchema>;
export type ApplicationInsightResult = z.infer<typeof applicationInsightSchema>;
export type OfferComparisonResult = z.infer<typeof offerComparisonSchema>;
