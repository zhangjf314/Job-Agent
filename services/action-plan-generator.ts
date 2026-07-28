import type { ActionPlanItemInput, CareerDirectionRecommendationInput, SkillGapInput } from "@/schemas/strategy";
import type { ResumeProfile } from "./resume-generator";

export function generateActionPlan(
  profile: ResumeProfile,
  recommendations: CareerDirectionRecommendationInput[],
  gaps: SkillGapInput[],
): ActionPlanItemInput[] {
  const primary = recommendations[0];
  const cityText = profile.targetCities.length ? profile.targetCities.join("/") : "目标城市";
  const items: ActionPlanItemInput[] = [
    {
      title: `优化 ${primary.directionName} 方向简历`,
      description: `突出 ${primary.resumeFocus.join("；")}，保持所有表述基于 Career Profile 事实。`,
      category: "resume",
      priority: "high",
      estimatedHours: 3,
      dueInDays: 3,
      status: "todo",
    },
    {
      title: `每周投递 ${primary.directionName} 相关岗位`,
      description: `围绕 ${cityText} 和关键词 ${primary.searchKeywords.slice(0, 4).join("、")} 建立投递清单。`,
      category: "application",
      priority: "high",
      estimatedHours: 6,
      dueInDays: 7,
      status: "todo",
    },
    {
      title: `准备 ${primary.directionName} 面试题`,
      description: "准备项目讲述、基础知识和简历追问，优先覆盖已写入简历的技能。",
      category: "interview",
      priority: "medium",
      estimatedHours: 8,
      dueInDays: 14,
      status: "todo",
    },
  ];
  const importantGap = gaps[0];
  if (importantGap) {
    items.splice(1, 0, {
      title: `补齐 ${importantGap.skillName} 证据`,
      description: importantGap.suggestedActions.join("；"),
      category: "skill",
      priority: "high",
      estimatedHours: 8,
      dueInDays: 10,
      status: "todo",
    });
  }
  return items;
}
