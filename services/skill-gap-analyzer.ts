import type { SkillGapInput, CareerDirectionRecommendationInput } from "@/schemas/strategy";
import type { ResumeProfile } from "./resume-generator";

export function analyzeSkillGaps(profile: ResumeProfile, direction: CareerDirectionRecommendationInput): SkillGapInput[] {
  const userSkillText = profile.skillItems.map((skill) => skill.name).join(" ");
  return direction.gaps.map((gap) => {
    const skillName = gap.replace("需要补齐或证明：", "");
    const isTool = /Docker|Git|Linux|Kubernetes/.test(skillName);
    const isProject = /项目|实战|系统/.test(skillName);
    return {
      directionName: direction.directionName,
      skillName,
      category: isProject ? "project_experience" : isTool ? "tool" : "hard_skill",
      currentLevel: userSkillText.includes(skillName) ? "beginner" : "none",
      targetLevel: "intermediate",
      importance: direction.priority === "high" ? 90 : 75,
      suggestedActions: [
        `学习并整理 ${skillName} 的核心概念和常见面试题。`,
        `在已有项目中补充真实的 ${skillName} 使用证据，若没有使用则不要写入简历正文。`,
      ],
      evidenceNeeded: [`在项目经历或学习记录中形成可描述的 ${skillName} 证据。`],
    };
  });
}
