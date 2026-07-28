export const applicationSources = ["boss", "liepin", "company_site", "school_career_center", "referral", "email", "manual", "other"] as const;
export const applicationChannels = ["online_platform", "company_website", "referral", "email", "campus_event", "wechat", "other"] as const;
export const applicationStatuses = ["planned", "applied", "resume_screen", "written_test", "interviewing", "offer", "rejected", "withdrawn", "no_response", "review", "archived"] as const;
export const applicationPriorities = ["high", "medium", "low"] as const;
export const interviewRoundTypes = ["phone", "video", "onsite", "written_test", "technical", "hr", "manager", "group", "other"] as const;
export const interviewRoundStatuses = ["scheduled", "completed", "cancelled", "no_show", "passed", "failed", "unknown"] as const;
export const interviewResults = ["passed", "failed", "pending", "unknown"] as const;
export const applicationTaskCategories = ["follow_up", "resume_update", "interview_prep", "written_test_prep", "networking", "document", "other"] as const;
export const applicationTaskStatuses = ["todo", "in_progress", "done", "skipped"] as const;
export const offerStatuses = ["pending", "accepted", "declined", "expired", "negotiating"] as const;
export const applicationRiskLevels = ["low", "medium", "high"] as const;

export type ApplicationSource = (typeof applicationSources)[number];
export type ApplicationChannel = (typeof applicationChannels)[number];
export type ApplicationStatus = (typeof applicationStatuses)[number];
export type ApplicationPriority = (typeof applicationPriorities)[number];
export type InterviewRoundType = (typeof interviewRoundTypes)[number];
export type InterviewRoundStatus = (typeof interviewRoundStatuses)[number];
export type InterviewResult = (typeof interviewResults)[number];
export type ApplicationTaskCategory = (typeof applicationTaskCategories)[number];
export type ApplicationTaskStatus = (typeof applicationTaskStatuses)[number];
export type OfferStatus = (typeof offerStatuses)[number];
export type ApplicationRiskLevel = (typeof applicationRiskLevels)[number];

export type InterviewFeedbackAnalysis = {
  strengths: string[];
  weaknesses: string[];
  questionsAsked: string[];
  knowledgeGaps: string[];
  improvementActions: string[];
  resumeImplications: string[];
  strategyImplications: string[];
  assumptions: string[];
  warnings: string[];
};

export type ApplicationInsight = {
  summary: string;
  currentRiskLevel: ApplicationRiskLevel;
  nextBestActions: string[];
  resumeSuggestions: string[];
  interviewPrepSuggestions: string[];
  followUpSuggestions: string[];
  strategyImplications: string[];
  warnings: string[];
};

export type OfferComparison = {
  recommendedOfferId: string | null;
  reasons: string[];
  risks: string[];
  negotiationSuggestions: string[];
};
