import type { JDAnalysis, Resume } from "@prisma/client";
import { careerStrategyGenerationResultSchema } from "@/schemas/strategy";
import type { CareerStrategyGenerationResult } from "@/schemas/strategy";
import type { ResumeProfile } from "./resume-generator";
import { recommendCareerDirections } from "./career-direction-recommender";
import { calculateCareerReadiness } from "./career-readiness";
import { analyzeSkillGaps } from "./skill-gap-analyzer";
import { generateJobSearchStrategy } from "./job-search-strategy-generator";
import { generateActionPlan } from "./action-plan-generator";

export function buildCareerStrategyResult(
  profile: ResumeProfile,
  resumes: Array<Pick<Resume, "qualityScore">> = [],
  jdAnalyses: Array<Pick<JDAnalysis, "targetRole" | "matchScore">> = [],
): CareerStrategyGenerationResult {
  const recommendations = recommendCareerDirections(profile, resumes, jdAnalyses);
  const primary = recommendations[0];
  const skillGaps = recommendations.flatMap((direction) => analyzeSkillGaps(profile, direction)).slice(0, 12);
  const jobSearchStrategies = recommendations.slice(0, 3).map((direction) => generateJobSearchStrategy(profile, direction));
  const actionPlan = generateActionPlan(profile, recommendations, skillGaps);
  const overallReadinessScore = calculateCareerReadiness(profile, primary, resumes, jdAnalyses);
  const warnings = [
    ...(profile.projectItems.length === 0 ? ["缺少项目经历，方向推荐置信度会下降。"] : []),
    ...(resumes.length === 0 ? ["尚未发现简历版本，建议先生成通用简历。"] : []),
    ...(jdAnalyses.length === 0 ? ["暂无历史 JDAnalysis，历史岗位匹配表现未纳入。"] : []),
  ];
  const assumptions = [
    "本策略基于 Career Profile、已有 Resume 和历史 JDAnalysis 的确定性规则生成。",
    "不会把缺失技能当成用户已掌握能力，缺口会体现在 gaps 和 learningAction 中。",
  ];

  return careerStrategyGenerationResultSchema.parse({
    title: `${profile.basicInfo?.realName ?? "用户"} - 职业方向与求职策略`,
    summary: `当前最推荐方向为「${primary.directionName}」，整体准备度 ${overallReadinessScore}/100。建议优先围绕 ${primary.recommendedCities.join("、")} 制作方向简历并按周投递。`,
    targetTimeframe: "one_month",
    overallReadinessScore,
    recommendedPrimaryDirection: primary.directionName,
    recommendedCities: primary.recommendedCities,
    strategyNotes: [
      `首推方向：${primary.directionName}，匹配分 ${primary.matchScore}/100。`,
      `重点简历优化：${primary.resumeFocus.join("；")}`,
    ],
    recommendations,
    skillGaps,
    jobSearchStrategies,
    actionPlan,
    warnings,
    assumptions,
  });
}
