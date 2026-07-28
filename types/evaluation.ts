export const evaluationTypes = ["jd_parsing", "match_scoring", "resume_suggestion"] as const;
export const llmCallStatuses = ["success", "failed", "fallback"] as const;

export type EvaluationType = (typeof evaluationTypes)[number];
export type LLMCallStatus = (typeof llmCallStatuses)[number];
