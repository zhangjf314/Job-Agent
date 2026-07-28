export const resumeTypes = ["general", "role_specific", "jd_tailored"] as const;
export const resumeStatuses = ["draft", "active", "archived"] as const;
export const resumeSectionTypes = [
  "basic_info",
  "summary",
  "education",
  "skills",
  "projects",
  "experiences",
  "certificates",
  "awards",
  "others",
] as const;
export const resumeLanguages = ["zh-CN"] as const;
export const resumeTemplateKeys = ["minimal", "elegant", "dark", "photo"] as const;
export const defaultResumeTemplateKey = "minimal" as const;

export type ResumeType = (typeof resumeTypes)[number];
export type ResumeStatus = (typeof resumeStatuses)[number];
export type ResumeSectionType = (typeof resumeSectionTypes)[number];
export type ResumeLanguage = (typeof resumeLanguages)[number];
export type ResumeTemplateKey = (typeof resumeTemplateKeys)[number];

export type GeneratedResumeSection = {
  type: ResumeSectionType;
  title: string;
  contentMarkdown: string;
  order: number;
};

export type ResumeGenerationResult = {
  title: string;
  targetRole: string;
  targetCity: string;
  language: ResumeLanguage;
  contentMarkdown: string;
  sections: GeneratedResumeSection[];
  missingFields: string[];
  improvementQuestions: string[];
  qualityWarnings: string[];
  generationNotes: string[];
  qualityScore: number;
};
