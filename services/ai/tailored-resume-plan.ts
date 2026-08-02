import { z } from "zod";
import {
  GROUNDED_SECTION_TYPES_BY_POSITION,
} from "./grounded-tailored-resume-contract";
import {
  formatFactRegistryForPrompt,
  formatJobRequirementsForPrompt,
  formatProjectFactsForPrompt,
  type CandidateFact,
  type JobRequirementFact,
  type ProjectCandidateFact,
} from "./candidate-fact-registry";

export const TAILORED_RESUME_PLAN_LIMITS = Object.freeze({
  sectionFactIdsMax: 12,
  applicationMaterialFactIdsMax: 8,
  changedSectionsMax: 2,
  priorityFactIdsMax: 20,
  factTotalUsageMax: 6,
  projectRewritesMax: 2,
  projectBulletsTotalMax: 2,
  projectBulletFactIdsMax: 6,
});

export const PROJECT_REWRITE_PATTERNS = [
  "action_technology",
  "action_solution",
  "feature_implementation",
  "problem_solution",
  "solution_result",
  "engineering_quality",
  "responsibility_result",
] as const;

export type ProjectRewritePattern = (typeof PROJECT_REWRITE_PATTERNS)[number];

export const canonicalSectionTypeSchema = z.enum(
  GROUNDED_SECTION_TYPES_BY_POSITION,
);

const factIdSchema = z.string().trim().min(1);

const factSelectionSchema = z.object({
  factIds: z.array(factIdSchema)
    .max(TAILORED_RESUME_PLAN_LIMITS.sectionFactIdsMax),
}).strict();

const projectRewriteSchema = z.object({
  projectId: z.string().regex(/^P_PROJECT_[A-F0-9]{12}$/),
  bullets: z.array(z.object({
    pattern: z.enum(PROJECT_REWRITE_PATTERNS),
    factIds: z.array(factIdSchema)
      .min(1)
      .max(TAILORED_RESUME_PLAN_LIMITS.projectBulletFactIdsMax),
  }).strict()).min(1).max(2),
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
  projectRewrites: z.array(projectRewriteSchema)
    .max(TAILORED_RESUME_PLAN_LIMITS.projectRewritesMax),
}).strict().superRefine((value, context) => {
  const bulletCount = value.projectRewrites.reduce(
    (count, rewrite) => count + rewrite.bullets.length,
    0,
  );
  if (bulletCount > TAILORED_RESUME_PLAN_LIMITS.projectBulletsTotalMax) {
    context.addIssue({
      code: "custom",
      path: ["projectRewrites"],
      message: "project bullet total exceeds limit",
    });
  }
});

export type TailoredResumePlan = z.infer<typeof tailoredResumePlanSchema>;

export const tailoredResumePlanOutputContract = [
  "Return one strict JSON selection plan and no prose.",
  "Top-level keys exactly: sections,applicationMaterials,changedSections,priorityFactIds,projectRewrites.",
  `sections has exactly ${GROUNDED_SECTION_TYPES_BY_POSITION.join(",")}; each value is exactly {factIds:F_*[]}, max ${TAILORED_RESUME_PLAN_LIMITS.sectionFactIdsMax}.`,
  `applicationMaterials has exactly selfIntroductionFactIds,applicationEmailFactIds,recruiterMessageFactIds; each is F_*[], max ${TAILORED_RESUME_PLAN_LIMITS.applicationMaterialFactIdsMax}.`,
  `changedSections is 0..${TAILORED_RESUME_PLAN_LIMITS.changedSectionsMax} unique canonical section enums.`,
  `priorityFactIds is 0..${TAILORED_RESUME_PLAN_LIMITS.priorityFactIdsMax} selected F_* IDs in descending priority.`,
  "Only select supplied candidate F_* IDs. Never output J_REQ_* or unknown IDs.",
  `projectRewrites is 0..${TAILORED_RESUME_PLAN_LIMITS.projectRewritesMax} entries, total bullets 0..${TAILORED_RESUME_PLAN_LIMITS.projectBulletsTotalMax}; each entry exactly {projectId:P_PROJECT_*,bullets:[{pattern:${PROJECT_REWRITE_PATTERNS.join("|")},factIds:F_PROJECT_*[]}]}. Every bullet may use only atoms under that same projectId.`,
  "No resume text, titles, lines, emails, messages, GroundedText, kind, order, sourceFactIds, or arbitrary JSON paths.",
].join(" ");

export function buildTailoredResumePlanMessages(
  candidateFacts: CandidateFact[],
  jobRequirements: JobRequirementFact[],
  projectFacts: ProjectCandidateFact[] = [],
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
        "For projectRewrites, select only a fixed pattern and same-project project atom IDs. Never write a project bullet.",
        "Select only candidate project fact IDs.",
        "Do not write resume bullets.",
        "Do not paraphrase project facts.",
        "Do not add technologies, metrics, roles or results.",
        "Do not treat JD requirements as candidate experience.",
        "Return only the strict JSON plan.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        "CANDIDATE_FACTS",
        formatFactRegistryForPrompt(candidateFacts),
        "",
        "PROJECT_FACT_ATOMS",
        formatProjectFactsForPrompt(projectFacts),
        "",
        "JOB_REQUIREMENTS_ONLY",
        formatJobRequirementsForPrompt(jobRequirements),
      ].join("\n"),
    },
  ];
}
