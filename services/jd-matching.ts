import type { JDAnalysisResult } from "@/types/jd";
import type { ResumeProfile } from "./resume-generator";

type ResumeForMatch = {
  contentMarkdown: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function contains(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function itemText(...parts: unknown[]) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter(Boolean)
    .join(" ");
}

export function calculateJDMatch(profile: ResumeProfile, resume: ResumeForMatch, jdAnalysis: JDAnalysisResult): JDAnalysisResult {
  const userSkillNames = profile.skillItems.map((skill) => skill.name);
  const matchedSkills = jdAnalysis.hardSkills.filter((skill) =>
    userSkillNames.some((userSkill) => contains(userSkill, skill) || contains(skill, userSkill)),
  );
  const missingSkills = jdAnalysis.hardSkills.filter((skill) => !matchedSkills.includes(skill));
  const hardSkillScore = jdAnalysis.hardSkills.length === 0 ? 80 : clamp((matchedSkills.length / jdAnalysis.hardSkills.length) * 100);

  const projectMatches = profile.projectItems.map((project) => {
    const text = itemText(project.name, project.background, project.goal, project.responsibilities, project.techStack, project.highlights, project.results, project.metrics);
    return jdAnalysis.keywords.filter((keyword) => contains(text, keyword)).length;
  });
  const projectMatchScore = profile.projectItems.length === 0 ? 0 : clamp((Math.max(0, ...projectMatches) / Math.max(1, jdAnalysis.keywords.length)) * 100);

  const experienceMatches = profile.experienceItems.map((experience) => {
    const text = itemText(experience.company, experience.department, experience.role, experience.responsibilities, experience.achievements, experience.techStack, experience.businessImpact, experience.metrics);
    return jdAnalysis.keywords.filter((keyword) => contains(text, keyword)).length;
  });
  const experienceMatchScore = profile.experienceItems.length === 0 ? 0 : clamp((Math.max(0, ...experienceMatches) / Math.max(1, jdAnalysis.keywords.length)) * 100);

  const educationText = itemText(profile.educationItems.map((item) => [item.school, item.major, item.degree, item.courses]));
  const educationHits = jdAnalysis.educationRequirements.filter((item) =>
    contains(educationText, item) || (/本科/.test(item) && contains(educationText, "本科")) || (/计算机|软件/.test(item) && /计算机|软件/.test(educationText)),
  ).length;
  const educationScore = jdAnalysis.educationRequirements.length === 0 ? 80 : clamp((educationHits / jdAnalysis.educationRequirements.length) * 100);

  const coveredKeywords = jdAnalysis.keywords.filter((keyword) => contains(resume.contentMarkdown, keyword));
  const keywordCoverageScore = jdAnalysis.keywords.length === 0 ? 80 : clamp((coveredKeywords.length / jdAnalysis.keywords.length) * 100);

  const matchScore = clamp(
    hardSkillScore * 0.3 +
      projectMatchScore * 0.25 +
      experienceMatchScore * 0.2 +
      educationScore * 0.1 +
      keywordCoverageScore * 0.15,
  );

  const matchedPoints = unique([
    ...matchedSkills.map((skill) => `技能匹配：已在职业档案中体现 ${skill}`),
    ...profile.projectItems
      .filter((_project, index) => projectMatches[index] > 0)
      .map((project) => `项目匹配：${project.name} 与 JD 技能/职责存在交集`),
    ...profile.experienceItems
      .filter((_experience, index) => experienceMatches[index] > 0)
      .map((experience) => `经历匹配：${experience.company} ${experience.role} 与 JD 存在相关经验`),
  ]);
  const gaps = unique(missingSkills.map((skill) => `缺少 JD 要求技能：${skill}`));
  const riskWarnings = unique([
    ...missingSkills.map((skill) => `不要在简历正文中声称已掌握 ${skill}，除非 Career Profile 后续补充了真实证据。`),
    ...jdAnalysis.educationRequirements.filter((item) => /硕士/.test(item) && !contains(educationText, "硕士")).map((item) => `学历要求可能存在风险：${item}`),
  ]);

  return {
    ...jdAnalysis,
    matchScore,
    scoreBreakdown: {
      hardSkillScore,
      projectMatchScore,
      experienceMatchScore,
      educationMatchScore: educationScore,
      keywordCoverageScore,
    },
    matchedPoints,
    gaps,
    riskWarnings,
  };
}

export function generateResumeRewriteSuggestions(profile: ResumeProfile, resume: ResumeForMatch, jdAnalysis: JDAnalysisResult) {
  const userSkills = profile.skillItems.map((skill) => skill.name);
  const suggestions: string[] = [];
  const matchedSkills = jdAnalysis.hardSkills.filter((skill) => userSkills.some((item) => contains(item, skill) || contains(skill, item)));
  if (matchedSkills.length > 0) suggestions.push(`将专业技能中与 JD 匹配的 ${matchedSkills.join("、")} 前置展示。`);
  const projectNames = profile.projectItems
    .filter((project) => jdAnalysis.keywords.some((keyword) => contains(itemText(project.name, project.techStack, project.responsibilities, project.highlights), keyword)))
    .map((project) => project.name);
  if (projectNames.length > 0) suggestions.push(`优先展示项目：${projectNames.join("、")}，强化其中已有的职责、技术栈和结果。`);
  if (profile.experienceItems.length > 0) suggestions.push("实习/工作经历中优先保留与 JD 职责相关的开发、联调、优化和业务影响描述。");
  jdAnalysis.gaps.forEach((gap) => suggestions.push(`${gap}；建议学习、补充真实项目证据或面试前准备，不要写入简历正文伪装成已掌握。`));
  if (!resume.contentMarkdown.includes("## 项目经历")) suggestions.push("基础简历缺少项目经历章节，建议先从 Career Profile 重新生成通用简历。");
  return unique(suggestions);
}
