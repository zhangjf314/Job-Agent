import { z } from "zod";
import {
  GROUNDED_SECTION_TYPES_BY_POSITION,
} from "./grounded-tailored-resume-contract";
import {
  formatFactRegistryForPrompt,
  formatJobRequirementsForPrompt,
  type CandidateFact,
  type JobRequirementFact,
} from "./candidate-fact-registry";

export const TAILORED_RESUME_PLAN_LIMITS = Object.freeze({
  sectionFactIdsMax: 12,
  applicationMaterialFactIdsMax: 8,
  changedSectionsMax: 2,
  priorityFactIdsMax: 20,
  factTotalUsageMax: 6,
});

export const canonicalSectionTypeSchema = z.enum(
  GROUNDED_SECTION_TYPES_BY_POSITION,
);

const factIdSchema = z.string().trim().min(1);

const factSelectionSchema = z.object({
  factIds: z.array(factIdSchema)
    .max(TAILORED_RESUME_PLAN_LIMITS.sectionFactIdsMax),
}).strict();

export const tailoredResumePlanSchema = z.object({
  sections: z.object({
    summary: factSelectionSchema,
    skills: factSelectionSchema,
    projects: factSelectionSchema,
    experiences: factSelectionSchema,
    education: factSelectionSchema,
    others: factSelectionSchema,
  }).strict(),
  applicationMaterials: z.object({
    selfIntroductionFactIds: z.array(factIdSchema)
      .max(TAILORED_RESUME_PLAN_LIMITS.applicationMaterialFactIdsMax),
    applicationEmailFactIds: z.array(factIdSchema)
      .max(TAILORED_RESUME_PLAN_LIMITS.applicationMaterialFactIdsMax),
    recruiterMessageFactIds: z.array(factIdSchema)
      .max(TAILORED_RESUME_PLAN_LIMITS.applicationMaterialFactIdsMax),
  }).strict(),
  changedSections: z.array(canonicalSectionTypeSchema)
    .max(TAILORED_RESUME_PLAN_LIMITS.changedSectionsMax),
  priorityFactIds: z.array(factIdSchema)
    .max(TAILORED_RESUME_PLAN_LIMITS.priorityFactIdsMax),
}).strict();

export type TailoredResumePlan = z.infer<typeof tailoredResumePlanSchema>;

export const tailoredResumePlanOutputContract = [
  "Return one strict JSON selection plan and no prose.",
  "Top-level keys exactly: sections,applicationMaterials,changedSections,priorityFactIds.",
  `sections has exactly ${GROUNDED_SECTION_TYPES_BY_POSITION.join(",")}; each value is exactly {factIds:F_*[]}, max ${TAILORED_RESUME_PLAN_LIMITS.sectionFactIdsMax}.`,
  `applicationMaterials has exactly selfIntroductionFactIds,applicationEmailFactIds,recruiterMessageFactIds; each is F_*[], max ${TAILORED_RESUME_PLAN_LIMITS.applicationMaterialFactIdsMax}.`,
  `changedSections is 0..${TAILORED_RESUME_PLAN_LIMITS.changedSectionsMax} unique canonical section enums.`,
  `priorityFactIds is 0..${TAILORED_RESUME_PLAN_LIMITS.priorityFactIdsMax} selected F_* IDs in descending priority.`,
  "Only select supplied candidate F_* IDs. Never output J_REQ_* or unknown IDs.",
  "No resume text, titles, lines, emails, messages, GroundedText, kind, order, sourceFactIds, or arbitrary JSON paths.",
].join(" ");

export function buildTailoredResumePlanMessages(
  candidateFacts: CandidateFact[],
  jobRequirements: JobRequirementFact[],
) {
  return [
    {
      role: "system" as const,
      content: [
        "Select existing candidate facts that best match the job requirements.",
        "Return only the strict selection-plan JSON.",
        "Use only supplied F_* IDs; J_REQ_* entries are relevance signals, never candidate evidence.",
        "Do not write resume text, emails, messages, titles, lines, claims, or explanations.",
        "Prefer a small relevant set over exhaustive selection.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        "CANDIDATE_FACTS",
        formatFactRegistryForPrompt(candidateFacts),
        "",
        "JOB_REQUIREMENTS_ONLY",
        formatJobRequirementsForPrompt(jobRequirements),
      ].join("\n"),
    },
  ];
}
