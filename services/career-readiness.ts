import type { JDAnalysis, Resume } from "@prisma/client";
import type { ResumeProfile } from "./resume-generator";
import type { CareerDirectionRecommendationInput } from "@/schemas/strategy";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateCareerReadiness(
  profile: ResumeProfile,
  direction: Pick<CareerDirectionRecommendationInput, "matchScore">,
  resumes: Array<Pick<Resume, "qualityScore">> = [],
  jdAnalyses: Array<Pick<JDAnalysis, "matchScore">> = [],
) {
  const profileScore = profile.profileCompletenessScore ?? 0;
  const projectStrength = profile.projectItems.length > 0 ? Math.min(100, profile.projectItems.length * 35) : 0;
  const experienceStrength = profile.experienceItems.length > 0 ? 85 : 25;
  const resumeQuality = resumes.length
    ? Math.round(resumes.reduce((sum, resume) => sum + (resume.qualityScore ?? 0), 0) / resumes.length)
    : 40;
  const jdMatch = jdAnalyses.length
    ? Math.round(jdAnalyses.reduce((sum, item) => sum + item.matchScore, 0) / jdAnalyses.length)
    : direction.matchScore;

  return clamp(
    profileScore * 0.25 +
      direction.matchScore * 0.25 +
      projectStrength * 0.2 +
      experienceStrength * 0.15 +
      resumeQuality * 0.1 +
      jdMatch * 0.05,
  );
}
