import type { JobPost } from "@prisma/client";
import { jobMatchResultSchema, type JobMatchResult } from "@/schemas/job";
import type { ResumeProfile } from "@/services/resume-generator";

type ResumeLike = { contentMarkdown?: string } | null;
type StrategyLike = { recommendedCities?: string[] } | null;
type DirectionLike = { directionName?: string; searchKeywords?: string[] } | null;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function contains(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function textOf(parts: unknown[]) {
  return parts.flatMap((p) => Array.isArray(p) ? p : [p]).filter(Boolean).join(" ");
}

export function calculateJobMatch(
  profile: ResumeProfile,
  resume: ResumeLike,
  strategyPlan: StrategyLike,
  directionRecommendation: DirectionLike,
  jobPost: Pick<JobPost, "title" | "normalizedTitle" | "company" | "city" | "salaryMin" | "description" | "requirements" | "educationRequirement" | "experienceRequirement" | "jobType" | "skills" | "keywords" | "qualityScore" | "riskFlags" | "publishedAt" | "collectedAt">
    & Partial<Pick<JobPost, "internshipDuration" | "conversionOpportunity">>,
): JobMatchResult {
  const profileSkillText = profile.skillItems.map((s) => s.name).join(" ");
  const projectText = profile.projectItems.map((p) => textOf([p.name, p.techStack, p.responsibilities, p.highlights, p.results, p.metrics])).join(" ");
  const experienceText = profile.experienceItems.map((e) => textOf([e.company, e.role, e.techStack, e.responsibilities, e.achievements, e.businessImpact])).join(" ");
  const educationText = profile.educationItems.map((e) => `${e.degree} ${e.major} ${e.courses.join(" ")}`).join(" ");
  const resumeText = resume?.contentMarkdown ?? "";

  const matchedSkills = jobPost.skills.filter((skill) => contains(profileSkillText, skill) || contains(projectText, skill) || contains(experienceText, skill));
  const missingSkills = jobPost.skills.filter((skill) => !matchedSkills.includes(skill));
  const skillMatchScore = jobPost.skills.length ? clamp((matchedSkills.length / jobPost.skills.length) * 100) : 70;
  const projectMatchScore = jobPost.keywords.length ? clamp(jobPost.keywords.filter((kw) => contains(projectText, kw)).length / jobPost.keywords.length * 100) : 50;
  const experienceMatchScore = jobPost.keywords.length ? clamp(jobPost.keywords.filter((kw) => contains(experienceText, kw)).length / jobPost.keywords.length * 100) : 50;
  const educationOk = !jobPost.educationRequirement || contains(educationText, jobPost.educationRequirement) || (/本科|不限/.test(jobPost.educationRequirement) && /本科/.test(educationText));
  const educationMatchScore = educationOk ? 90 : 30;
  const hardRequirementScore = clamp((educationMatchScore * 0.5) + (/应届|实习|不限|无经验/.test(jobPost.experienceRequirement ?? "") ? 50 : 40));
  const preferredCities = [...profile.targetCities, ...(strategyPlan?.recommendedCities ?? [])];
  const preferenceMatchScore = preferredCities.length === 0 || preferredCities.includes(jobPost.city) ? 90 : 45;
  const growthValueScore = /导师|培养|核心业务|技术成长|轮岗|培训体系|复杂系统|高并发/.test(`${jobPost.description} ${jobPost.requirements}`) ? 85 : 55;
  const conversionOpportunity = jobPost.conversionOpportunity ?? "unknown";
  const conversionOpportunityScore = /有转正机会/.test(conversionOpportunity) ? 90 : /不提供转正/.test(conversionOpportunity) ? 20 : 50;
  const directionText = `${profile.targetRoles.join(" ")} ${directionRecommendation?.directionName ?? ""}`;
  const directionMatchScore = contains(directionText, jobPost.normalizedTitle) || contains(directionText, jobPost.title) || jobPost.keywords.some((keyword) => contains(directionText, keyword)) ? 90 : 50;
  const ageDays = Math.max(0, (Date.now() - new Date(jobPost.publishedAt ?? jobPost.collectedAt).getTime()) / 86400000);
  const freshnessScore = clamp(100 - ageDays * 2);
  const qualityScore = jobPost.qualityScore;
  const severeRisk = jobPost.riskFlags.some((flag) => /收费培训|培训贷|先缴费/.test(flag));
  const riskPenalty = severeRisk ? 30 : Math.min(30, jobPost.riskFlags.length * 8);
  const rawScore = hardRequirementScore * 0.1 + skillMatchScore * 0.25 + projectMatchScore * 0.15 + experienceMatchScore * 0.1 + educationMatchScore * 0.1 + preferenceMatchScore * 0.1 + growthValueScore * 0.07 + conversionOpportunityScore * 0.05 + directionMatchScore * 0.05 + freshnessScore * 0.015 + qualityScore * 0.015 - riskPenalty;
  const matchScore = clamp(rawScore);
  const recommendation = severeRisk ? "no" : matchScore >= 85 ? "strong_yes" : matchScore >= 70 ? "yes" : matchScore >= 50 ? "maybe" : "no";
  const gaps = [
    ...missingSkills.map((skill) => `缺少岗位要求技能：${skill}`),
    ...(preferredCities.length && !preferredCities.includes(jobPost.city) ? [`城市不符合偏好：${jobPost.city}`] : []),
  ];
  return jobMatchResultSchema.parse({
    matchScore,
    hardRequirementScore,
    skillMatchScore,
    projectMatchScore,
    experienceMatchScore,
    educationMatchScore,
    growthValueScore,
    conversionOpportunityScore,
    directionMatchScore,
    preferenceMatchScore,
    freshnessScore,
    qualityScore,
    riskPenalty,
    recommendation,
    matchedPoints: [
      ...matchedSkills.map((skill) => `技能/项目证据匹配：${skill}`),
      ...(projectMatchScore > 0 ? ["项目经历与岗位关键词存在交集"] : []),
      ...(resumeText && directionRecommendation?.directionName ? [`可基于 ${directionRecommendation.directionName} 方向简历投递`] : []),
    ],
    gaps,
    riskWarnings: jobPost.riskFlags.map((flag) => `岗位风险：${flag}`),
    resumeSuggestions: matchedSkills.length ? [`简历中前置展示 ${matchedSkills.join("、")} 的真实项目/实习证据。`] : ["先补充真实技能或项目证据，再考虑投递。"],
    interviewPrepSuggestions: [`准备 ${jobPost.normalizedTitle} 相关项目讲述。`, ...matchedSkills.slice(0, 4).map((skill) => `复习 ${skill} 常见面试题。`)],
  });
}
