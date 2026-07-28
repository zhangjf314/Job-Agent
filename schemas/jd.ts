import { z } from "zod";
import { resumeSectionSchema } from "@/schemas/resume";
import { seniorityLevels } from "@/types/jd";

const requiredText = (label: string) => z.string().trim().min(1, `${label}不能为空`);
const optionalUrl = z.string().trim().url("请输入有效 URL").optional().or(z.literal(""));
const stringList = z.array(z.string().trim().min(1)).default([]);
const score = z.number().int().min(0).max(100);

export const seniorityLevelSchema = z.enum(seniorityLevels);

export const jobDescriptionCreateInputSchema = z.object({
  profileId: requiredText("职业档案 ID"),
  resumeId: z.string().trim().optional().nullable(),
  title: requiredText("岗位名称"),
  company: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  rawText: requiredText("JD 原文"),
  sourceUrl: optionalUrl,
});

export const jdRequirementSchema = z.object({
  category: requiredText("要求类型"),
  items: stringList,
});

export const jdMatchScoreSchema = z.object({
  hardSkillScore: score,
  projectMatchScore: score,
  experienceMatchScore: score,
  educationMatchScore: score,
  keywordCoverageScore: score,
});

export const jdAnalysisResultSchema = z.object({
  targetRole: z.string().trim().default(""),
  seniorityLevel: seniorityLevelSchema.default("unknown"),
  internshipDuration: z.string().trim().default(""),
  conversionOpportunity: z.string().trim().default("unknown"),
  candidateProfile: stringList,
  coreResponsibilities: stringList,
  hardSkills: stringList,
  softSkills: stringList,
  experienceRequirements: stringList,
  educationRequirements: stringList,
  bonusPoints: stringList,
  keywords: stringList,
  matchScore: score,
  scoreBreakdown: jdMatchScoreSchema,
  matchedPoints: stringList,
  gaps: stringList,
  riskWarnings: stringList,
  resumeRewriteSuggestions: stringList,
});

export const tailoredResumeResultSchema = z.object({
  contentMarkdown: requiredText("定制简历内容"),
  sections: z.array(resumeSectionSchema).min(1),
  rewriteExplanation: stringList,
  changedSections: stringList,
  missingFields: stringList,
  improvementQuestions: stringList,
  qualityWarnings: stringList,
  applicationMaterials: z.object({
    selfIntroduction: requiredText("自我介绍"),
    applicationEmail: requiredText("投递邮件"),
    recruiterMessage: requiredText("招聘沟通话术"),
  }),
});

export type JobDescriptionCreateInput = z.infer<typeof jobDescriptionCreateInputSchema>;
export type JDAnalysisResultInput = z.infer<typeof jdAnalysisResultSchema>;
export type TailoredResumeResultInput = z.infer<typeof tailoredResumeResultSchema>;
