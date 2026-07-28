import type { GeneratedResumeSection } from "./resume";

export const seniorityLevels = ["intern", "new_grad", "junior", "mid", "senior", "unknown"] as const;

export type SeniorityLevel = (typeof seniorityLevels)[number];

export type JDScoreBreakdown = {
  hardSkillScore: number;
  projectMatchScore: number;
  experienceMatchScore: number;
  educationMatchScore: number;
  keywordCoverageScore: number;
};

export type JDAnalysisResult = {
  targetRole: string;
  seniorityLevel: SeniorityLevel;
  internshipDuration: string;
  conversionOpportunity: string;
  candidateProfile: string[];
  coreResponsibilities: string[];
  hardSkills: string[];
  softSkills: string[];
  experienceRequirements: string[];
  educationRequirements: string[];
  bonusPoints: string[];
  keywords: string[];
  matchScore: number;
  scoreBreakdown: JDScoreBreakdown;
  matchedPoints: string[];
  gaps: string[];
  riskWarnings: string[];
  resumeRewriteSuggestions: string[];
};

export type TailoredResumeResult = {
  contentMarkdown: string;
  sections: GeneratedResumeSection[];
  rewriteExplanation: string[];
  changedSections: string[];
  missingFields: string[];
  improvementQuestions: string[];
  qualityWarnings: string[];
  applicationMaterials: {
    selfIntroduction: string;
    applicationEmail: string;
    recruiterMessage: string;
  };
};
