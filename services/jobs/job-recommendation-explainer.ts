import type { JobMatchResult } from "@/schemas/job";

export function explainJobRecommendation(match: JobMatchResult) {
  return [
    `推荐等级：${match.recommendation}，综合分 ${match.matchScore}/100。`,
    match.matchedPoints.length ? `匹配点：${match.matchedPoints.join("；")}` : "缺少明确匹配点。",
    match.gaps.length ? `差距：${match.gaps.join("；")}` : "关键差距较少。",
    match.riskWarnings.length ? `风险：${match.riskWarnings.join("；")}` : "未发现明显岗位风险。",
  ];
}
