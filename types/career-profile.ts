export const targetStatuses = [
  "seeking_internship",
  "seeking_fulltime",
  "open_to_opportunities",
] as const;

export const skillCategories = [
  "programming_language",
  "framework",
  "database",
  "tool",
  "business",
  "soft_skill",
] as const;

export const skillLevels = ["beginner", "intermediate", "advanced", "expert"] as const;

export const employmentTypes = ["internship", "fulltime", "parttime", "campus"] as const;

export const evidenceTypes = ["file", "url", "text", "image"] as const;

export type TargetStatus = (typeof targetStatuses)[number];
export type SkillCategory = (typeof skillCategories)[number];
export type SkillLevel = (typeof skillLevels)[number];
export type EmploymentType = (typeof employmentTypes)[number];
export type EvidenceType = (typeof evidenceTypes)[number];

export type CareerProfileWithItems = {
  id: string;
  userId: string;
  targetStatus: TargetStatus;
  targetRoles: string[];
  targetCities: string[];
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  personalSummary: string | null;
  profileCompletenessScore: number;
  basicInfo: {
    id: string;
    realName: string;
    phone: string;
    email: string;
    location: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    personalWebsite: string | null;
  } | null;
  educationItems: Array<{ id: string }>;
  skillItems: Array<{ id: string }>;
  projectItems: Array<{ id: string }>;
  experienceItems: Array<{ id: string }>;
  certificateItems: Array<{ id: string }>;
  awardItems: Array<{ id: string }>;
  evidenceItems: Array<{ id: string; url?: string | null }>;
};
