import { z } from "zod";
import {
  actionCategories,
  actionStatuses,
  roleFamilies,
  skillGapCategories,
  strategyPriorities,
  strategySkillLevels,
  targetTimeframes,
} from "@/types/strategy";

const requiredText = (label: string) => z.string().trim().min(1, `${label}不能为空`);
const score = z.number().int().min(0).max(100);
const stringList = z.array(z.string().trim().min(1)).default([]);

export const targetTimeframeSchema = z.enum(targetTimeframes);
export const roleFamilySchema = z.enum(roleFamilies);
export const prioritySchema = z.enum(strategyPriorities);
export const skillGapCategorySchema = z.enum(skillGapCategories);
export const actionCategorySchema = z.enum(actionCategories);
export const actionStatusSchema = z.enum(actionStatuses);
export const strategySkillLevelSchema = z.enum(strategySkillLevels);

export const careerDirectionRecommendationSchema = z.object({
  directionName: requiredText("方向名称"),
  roleFamily: roleFamilySchema,
  matchScore: score,
  confidence: score,
  priority: prioritySchema,
  suitableRoles: stringList,
  suitableIndustries: stringList,
  recommendedCities: stringList,
  matchedEvidence: stringList,
  gaps: stringList,
  risks: stringList,
  resumeFocus: stringList,
  searchKeywords: stringList,
});

export const skillGapSchema = z.object({
  directionName: z.string().trim().optional().default(""),
  skillName: requiredText("技能名称"),
  category: skillGapCategorySchema,
  currentLevel: strategySkillLevelSchema,
  targetLevel: strategySkillLevelSchema,
  importance: score,
  suggestedActions: stringList,
  evidenceNeeded: stringList,
});

export const jobSearchStrategySchema = z.object({
  directionName: z.string().trim().optional().default(""),
  targetRole: requiredText("目标岗位"),
  targetCities: stringList,
  targetIndustries: stringList,
  companyTypes: stringList,
  searchKeywords: stringList,
  negativeKeywords: stringList,
  weeklyApplicationTarget: z.number().int().min(1).max(200),
  resumeVersionSuggestion: requiredText("简历版本建议"),
  applicationAdvice: stringList,
  interviewPrepAdvice: stringList,
});

export const actionPlanItemSchema = z.object({
  title: requiredText("行动标题"),
  description: requiredText("行动描述"),
  category: actionCategorySchema,
  priority: prioritySchema,
  estimatedHours: z.number().int().min(1).max(200),
  dueInDays: z.number().int().min(0).max(180),
  status: actionStatusSchema.default("todo"),
});

export const careerStrategyPlanSchema = z.object({
  profileId: requiredText("职业档案 ID"),
  title: requiredText("计划标题"),
  summary: requiredText("摘要"),
  targetTimeframe: targetTimeframeSchema.default("one_month"),
  overallReadinessScore: score,
  recommendedPrimaryDirection: requiredText("首推方向"),
  recommendedCities: stringList,
  strategyNotes: stringList,
});

export const careerStrategyGenerationResultSchema = z.object({
  title: requiredText("计划标题"),
  summary: requiredText("策略摘要"),
  targetTimeframe: targetTimeframeSchema.default("one_month"),
  overallReadinessScore: score,
  recommendedPrimaryDirection: requiredText("首推方向"),
  recommendedCities: stringList,
  strategyNotes: stringList,
  recommendations: z.array(careerDirectionRecommendationSchema).min(1),
  skillGaps: z.array(skillGapSchema).default([]),
  jobSearchStrategies: z.array(jobSearchStrategySchema).default([]),
  actionPlan: z.array(actionPlanItemSchema).default([]),
  warnings: stringList,
  assumptions: stringList,
});

export type CareerDirectionRecommendationInput = z.infer<typeof careerDirectionRecommendationSchema>;
export type SkillGapInput = z.infer<typeof skillGapSchema>;
export type JobSearchStrategyInput = z.infer<typeof jobSearchStrategySchema>;
export type ActionPlanItemInput = z.infer<typeof actionPlanItemSchema>;
export type CareerStrategyGenerationResult = z.infer<typeof careerStrategyGenerationResultSchema>;
