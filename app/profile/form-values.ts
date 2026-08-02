import type { Prisma } from "@prisma/client";
import type { CareerProfileFormValues } from "@/components/career-profile-form";
import { careerProfileInclude } from "@/services/career-profile-service";
import type { CareerProfileInput } from "@/schemas/career-profile";

type PersistedProfile = Prisma.CareerProfileGetPayload<{
  include: typeof careerProfileInclude;
}>;

type ProfileFormSource = PersistedProfile | CareerProfileInput;

function dateInput(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function join(value: unknown) {
  return Array.isArray(value) ? value.join("，") : "";
}

export function toCareerProfileFormValues(profile: ProfileFormSource): CareerProfileFormValues {
  return {
    userId: profile.userId,
    targetStatus: profile.targetStatus,
    targetRolesText: join(profile.targetRoles),
    targetCitiesText: join(profile.targetCities),
    expectedSalaryMin: profile.expectedSalaryMin ?? "",
    expectedSalaryMax: profile.expectedSalaryMax ?? "",
    personalSummary: profile.personalSummary ?? "",
    basicInfo: {
      realName: profile.basicInfo?.realName ?? "",
      phone: profile.basicInfo?.phone ?? "",
      email: profile.basicInfo?.email ?? "",
      location: profile.basicInfo?.location ?? "",
      githubUrl: profile.basicInfo?.githubUrl ?? "",
      portfolioUrl: profile.basicInfo?.portfolioUrl ?? "",
      linkedinUrl: profile.basicInfo?.linkedinUrl ?? "",
      personalWebsite: profile.basicInfo?.personalWebsite ?? "",
    },
    educationItems: profile.educationItems.map((item) => ({
      ...item,
      startDate: dateInput(item.startDate),
      endDate: dateInput(item.endDate),
      coursesText: join(item.courses),
      honorsText: join(item.honors),
    })),
    skillItems: profile.skillItems.map((item) => ({ ...item })),
    projectItems: profile.projectItems.map((item) => ({
      ...item,
      startDate: dateInput(item.startDate),
      endDate: dateInput(item.endDate),
      responsibilitiesText: join(item.responsibilities),
      techStackText: join(item.techStack),
      highlightsText: join(item.highlights),
      challengesText: join(item.challenges),
      solutionsText: join(item.solutions),
      engineeringPracticesText: join(item.engineeringPractices),
      metricsText: join(item.metrics),
      linksText: join(item.links),
    })),
    experienceItems: profile.experienceItems.map((item) => ({
      ...item,
      startDate: dateInput(item.startDate),
      endDate: dateInput(item.endDate),
      responsibilitiesText: join(item.responsibilities),
      achievementsText: join(item.achievements),
      techStackText: join(item.techStack),
      metricsText: join(item.metrics),
    })),
    certificateItems: profile.certificateItems.map((item) => ({
      ...item,
      issuedAt: dateInput(item.issuedAt),
      expiresAt: dateInput(item.expiresAt),
    })),
    awardItems: profile.awardItems.map((item) => ({
      ...item,
      awardedAt: dateInput(item.awardedAt),
    })),
    evidenceItems: profile.evidenceItems.map((item) => ({ ...item })),
  };
}
