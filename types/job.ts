export const jobTypes = ["fulltime", "internship", "parttime", "campus", "contract", "unknown"] as const;
export const workModes = ["onsite", "hybrid", "remote", "unknown"] as const;
export const jobSources = ["mock", "manual", "web_search", "company_career_page", "official_employment_platform", "other"] as const;
export const jobSearchRunStatuses = ["pending", "running", "completed", "failed"] as const;
export const jobRecommendations = ["strong_yes", "yes", "maybe", "no"] as const;
export const savedJobStatuses = ["saved", "applied", "interviewing", "offer", "rejected", "ignored"] as const;
export const companyTypes = ["internet", "software_outsourcing", "state_owned", "foreign_company", "manufacturing_digital", "startup", "unknown"] as const;

export type JobType = (typeof jobTypes)[number];
export type WorkMode = (typeof workModes)[number];
export type JobSource = (typeof jobSources)[number];
export type JobSearchRunStatus = (typeof jobSearchRunStatuses)[number];
export type JobRecommendation = (typeof jobRecommendations)[number];
export type SavedJobStatus = (typeof savedJobStatuses)[number];
export type CompanyType = (typeof companyTypes)[number];

export type RawJobResult = {
  title?: string;
  company?: string;
  city?: string;
  salaryText?: string;
  description?: string;
  requirements?: string;
  source?: JobSource;
  sourceUrl?: string;
  sourcePlatform?: string;
  rawText?: string;
  rawJson?: unknown;
};

export type RawJobDetail = RawJobResult;

export type JobSearchInput = {
  query: string;
  city?: string;
  education?: string;
  experience?: string;
  salaryMin?: number;
  salaryMax?: number;
  keywords?: string[] | string;
  sourceTypes?: string[];
  limit?: number;
  rawText?: string;
  url?: string;
  profileId?: string;
  strategyPlanId?: string;
  directionRecommendationId?: string;
  rawResults?: RawJobResult[];
};

export type JobSearchSourceType = "mock" | "manual_jd" | "manual_url" | "company_career_page" | "web_search";
