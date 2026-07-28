import type { JobSearchStrategyInput, CareerDirectionRecommendationInput } from "@/schemas/strategy";
import type { ResumeProfile } from "./resume-generator";

export function generateJobSearchStrategy(profile: ResumeProfile, direction: CareerDirectionRecommendationInput): JobSearchStrategyInput {
  const cities = direction.recommendedCities.length ? direction.recommendedCities : profile.targetCities;
  return {
    directionName: direction.directionName,
    targetRole: direction.suitableRoles[0] ?? direction.directionName,
    targetCities: cities,
    targetIndustries: direction.suitableIndustries,
    companyTypes: ["中厂", "大厂", "制造业数字化", "软件外包", "初创公司"],
    searchKeywords: [...direction.searchKeywords, "应届生", ...cities],
    negativeKeywords: ["高级", "资深", "5年以上"],
    weeklyApplicationTarget: direction.priority === "high" ? 30 : 20,
    resumeVersionSuggestion: `为「${direction.directionName}」准备一版方向简历，优先突出：${direction.resumeFocus.join("；")}`,
    applicationAdvice: [
      `优先投递 ${cities.join("、")} 的 ${direction.suitableRoles.slice(0, 2).join("、")} 岗位。`,
      "记录投递渠道、JD 关键词、匹配分和反馈，下一轮迭代简历。",
    ],
    interviewPrepAdvice: [
      "准备项目 STAR 讲述，明确背景、职责、行动、结果。",
      `围绕 ${direction.searchKeywords.slice(0, 4).join("、")} 准备高频面试题。`,
    ],
  };
}
