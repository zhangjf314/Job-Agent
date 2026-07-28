import { z } from "zod";
import {
  resumeLanguages,
  resumeSectionTypes,
  resumeStatuses,
  resumeTemplateKeys,
  resumeTypes,
} from "@/types/resume";

const requiredText = (label: string) => z.string().trim().min(1, `${label}不能为空`);

export const resumeTypeSchema = z.enum(resumeTypes);
export const resumeStatusSchema = z.enum(resumeStatuses);
export const resumeSectionTypeSchema = z.enum(resumeSectionTypes);
export const resumeLanguageSchema = z.enum(resumeLanguages);
export const resumeTemplateKeySchema = z.enum(resumeTemplateKeys);

export const resumeSectionSchema = z.object({
  type: resumeSectionTypeSchema,
  title: requiredText("章节标题"),
  contentMarkdown: z.string().trim(),
  order: z.number().int().min(0),
});

export const generatedResumeSchema = z.object({
  title: requiredText("简历标题"),
  targetRole: z.string().trim().default(""),
  targetCity: z.string().trim().default(""),
  language: resumeLanguageSchema.default("zh-CN"),
  contentMarkdown: requiredText("简历内容"),
  sections: z.array(resumeSectionSchema).min(1),
  missingFields: z.array(z.string().trim().min(1)).default([]),
  improvementQuestions: z.array(z.string().trim().min(1)).default([]),
  qualityWarnings: z.array(z.string().trim().min(1)).default([]),
  generationNotes: z.array(z.string().trim().min(1)).default([]),
  qualityScore: z.number().int().min(0).max(100),
});

export const resumeCreateInputSchema = z.object({
  profileId: requiredText("职业档案 ID"),
  title: requiredText("简历标题"),
  targetRole: z.string().trim().optional().default(""),
  targetCity: z.string().trim().optional().default(""),
  language: resumeLanguageSchema.default("zh-CN"),
  type: resumeTypeSchema.default("general"),
  status: resumeStatusSchema.default("draft"),
  templateKey: resumeTemplateKeySchema.default("minimal"),
  contentMarkdown: requiredText("简历内容"),
  contentJson: z.unknown().optional(),
  sourceProfileSnapshot: z.unknown().optional(),
  sourceProfileVersion: z.string().trim().optional().default(""),
  completenessScore: z.number().int().min(0).max(100).optional().nullable(),
  qualityScore: z.number().int().min(0).max(100).optional().nullable(),
  missingFields: z.array(z.string().trim().min(1)).default([]),
  improvementQuestions: z.array(z.string().trim().min(1)).default([]),
  qualityWarnings: z.array(z.string().trim().min(1)).default([]),
  generationNotes: z.array(z.string().trim().min(1)).default([]),
  changeLog: z.string().trim().optional().default(""),
  isDefault: z.boolean().default(false),
  sections: z.array(resumeSectionSchema).default([]),
});

export const resumeUpdateInputSchema = resumeCreateInputSchema.partial().extend({
  id: requiredText("简历 ID"),
});

export const resumeGenerationResultSchema = generatedResumeSchema;

export type ResumeCreateInput = z.infer<typeof resumeCreateInputSchema>;
export type ResumeUpdateInput = z.infer<typeof resumeUpdateInputSchema>;
export type ResumeSectionInput = z.infer<typeof resumeSectionSchema>;
export type GeneratedResume = z.infer<typeof generatedResumeSchema>;
export type ResumeGenerationResultInput = z.infer<typeof resumeGenerationResultSchema>;
