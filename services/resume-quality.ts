import type { GeneratedResumeSection, ResumeGenerationResult } from "@/types/resume";

type QualityProfile = {
  basicInfo: { email?: string | null; phone?: string | null } | null;
  targetRoles: string[];
  targetCities: string[];
  skillItems: Array<{ name: string }>;
  projectItems: Array<{ results?: string | null; metrics: string[] }>;
  experienceItems: Array<{ achievements: string[]; metrics: string[]; businessImpact?: string | null }>;
  educationItems: unknown[];
};

function hasSection(sections: GeneratedResumeSection[], type: GeneratedResumeSection["type"]) {
  return sections.some((section) => section.type === type && section.contentMarkdown.trim().length > 0);
}

export function calculateResumeQualityScore(
  resume: Pick<ResumeGenerationResult, "sections" | "contentMarkdown"> & { profile?: QualityProfile },
) {
  const profile = resume.profile;
  let score = 0;

  const completeSections = [
    "basic_info",
    "summary",
    "education",
    "skills",
    "projects",
    "experiences",
  ].filter((type) => hasSection(resume.sections, type as GeneratedResumeSection["type"])).length;
  score += Math.round((completeSections / 6) * 30);

  const projectsWithAction = profile?.projectItems.filter(
    (project) => Boolean(project.results) || project.metrics.length > 0,
  ).length ?? 0;
  score += Math.min(20, projectsWithAction * 10);

  const strongExperiences = profile?.experienceItems.filter(
    (experience) =>
      experience.achievements.length > 0 ||
      experience.metrics.length > 0 ||
      Boolean(experience.businessImpact),
  ).length ?? 0;
  score += Math.min(15, strongExperiences * 15);

  const targetText = profile?.targetRoles.join(" ").toLowerCase() ?? "";
  const relatedSkills =
    profile?.skillItems.filter((skill) => targetText.includes(skill.name.toLowerCase())).length ?? 0;
  score += Math.min(15, relatedSkills * 5 + (profile && profile.skillItems.length >= 3 ? 5 : 0));

  const quantified =
    (profile?.projectItems.filter((project) => project.metrics.length > 0).length ?? 0) +
    (profile?.experienceItems.filter((experience) => experience.metrics.length > 0).length ?? 0);
  score += Math.min(10, quantified * 5);

  const formatClear =
    resume.contentMarkdown.includes("## 基本信息") &&
    resume.contentMarkdown.includes("## 项目经历") &&
    resume.contentMarkdown.includes("- ");
  score += formatClear ? 10 : 4;

  return Math.max(0, Math.min(100, score));
}
