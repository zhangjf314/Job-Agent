import type { CareerProfileWithItems } from "@/types/career-profile";

export function calculateProfileCompleteness(profile: CareerProfileWithItems): number {
  let score = 0;

  if (
    profile.basicInfo?.realName &&
    profile.basicInfo.phone &&
    profile.basicInfo.email &&
    profile.basicInfo.location
  ) {
    score += 20;
  }

  if (profile.educationItems.length >= 1) score += 15;
  if (profile.skillItems.length >= 3) score += 15;
  if (profile.projectItems.length >= 1) score += 20;
  if (profile.experienceItems.length >= 1) score += 15;
  if (profile.targetRoles.length >= 1 && profile.targetCities.length >= 1) score += 10;

  const hasSupplement =
    profile.certificateItems.length >= 1 ||
    profile.awardItems.length >= 1 ||
    profile.evidenceItems.length >= 1 ||
    Boolean(
      profile.basicInfo?.githubUrl ||
        profile.basicInfo?.portfolioUrl ||
        profile.basicInfo?.personalWebsite,
    );

  if (hasSupplement) score += 5;

  return Math.min(score, 100);
}
