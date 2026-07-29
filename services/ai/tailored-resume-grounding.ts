import { z } from "zod";
import { tailoredResumeResultSchema } from "@/schemas/jd";
import type { TailoredResumeResult } from "@/types/jd";
import {
  buildGroundedArrayCardinalityOutputContract,
  buildGroundedSectionOutputContract,
  buildRewriteExplanationOutputContract,
  GROUNDED_SECTION_COUNT,
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_TAILORED_RESUME_LIMITS,
} from "./grounded-tailored-resume-contract";

export const groundedClaimKinds = ["fact", "goal", "format"] as const;

export const groundedTextSchema = z.object({
  text: z.string().trim().min(1).max(80),
  sourceFactIds: z.array(z.string().trim().min(1))
    .max(GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax),
  kind: z.enum(groundedClaimKinds),
}).strict();

export const groundedSectionSchema = z.object({
    type: z.enum(GROUNDED_SECTION_TYPES_BY_POSITION),
    title: z.string().trim().min(1),
    lines: z.array(groundedTextSchema).max(2),
    order: z.number().int().min(0),
  }).strict();

export const groundedApplicationMaterialsSchema = z.object({
  selfIntroduction: z.array(groundedTextSchema).min(1).max(2),
  applicationEmail: z.array(groundedTextSchema).min(1).max(2),
  recruiterMessage: z.array(groundedTextSchema).min(1).max(2),
}).strict();

export const groundedTailoredResumeSchema = z.object({
  sections: z.array(groundedSectionSchema).length(GROUNDED_SECTION_COUNT),
  rewriteExplanation: z.array(
    z.string().trim().min(
      GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationItemMinChars,
    ),
  ).max(GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationMax),
  changedSections: z.array(z.enum(GROUNDED_SECTION_TYPES_BY_POSITION))
    .max(GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax)
    .refine((values) => new Set(values).size === values.length, {
      message: "changedSections must contain unique canonical section types.",
    }),
  missingFields: z.array(z.string().trim().min(1)).max(2),
  improvementQuestions: z.array(z.string().trim().min(1)).max(2),
  qualityWarnings: z.array(z.string().trim().min(1)).max(2),
  applicationMaterials: groundedApplicationMaterialsSchema,
}).strict();

export type GroundedText = z.infer<typeof groundedTextSchema>;
export type GroundedTailoredResume = z.infer<typeof groundedTailoredResumeSchema>;

function renderLines(lines: GroundedText[]) {
  return lines.map((line) => line.text).join("\n");
}

export function stripGroundingMetadata(input: GroundedTailoredResume): TailoredResumeResult {
  const sections = input.sections.map((section) => ({
    type: section.type,
    title: section.title,
    contentMarkdown: renderLines(section.lines),
    order: section.order,
  }));
  const contentMarkdown = sections
    .map((section) => `## ${section.title}\n${section.contentMarkdown}`)
    .join("\n\n");
  return tailoredResumeResultSchema.parse({
    contentMarkdown,
    sections,
    rewriteExplanation: input.rewriteExplanation,
    changedSections: input.changedSections,
    missingFields: input.missingFields,
    improvementQuestions: input.improvementQuestions,
    qualityWarnings: input.qualityWarnings,
    applicationMaterials: {
      selfIntroduction: renderLines(input.applicationMaterials.selfIntroduction),
      applicationEmail: renderLines(input.applicationMaterials.applicationEmail),
      recruiterMessage: renderLines(input.applicationMaterials.recruiterMessage),
    },
  });
}

export function groundedClaimEntries(input: GroundedTailoredResume) {
  const entries: Array<{ path: string; claim: GroundedText }> = [];
  input.sections.forEach((section, sectionIndex) => {
    section.lines.forEach((claim, lineIndex) => {
      entries.push({ path: `sections.${sectionIndex}.lines.${lineIndex}`, claim });
    });
  });
  for (const [key, claims] of Object.entries(input.applicationMaterials)) {
    claims.forEach((claim, index) => {
      entries.push({ path: `applicationMaterials.${key}.${index}`, claim });
    });
  }
  return entries;
}

export const groundedTailoredResumeOutputContract = [
  "keys:sections,rewriteExplanation,changedSections,missingFields,improvementQuestions,qualityWarnings,applicationMaterials.",
  buildGroundedSectionOutputContract(),
  "GroundedText:{text:max80 Chinese chars,sourceFactIds,kind:fact|goal|format}.",
  buildGroundedArrayCardinalityOutputContract(),
  buildRewriteExplanationOutputContract(),
  "Every factual line uses kind=fact and supplied candidate evidence.",
  "kind=goal must state target/plan/hope/learning/future; kind=format is only heading/label.",
  "missingFields,improvementQuestions,qualityWarnings:0..2 short strings. applicationMaterials require selfIntroduction,applicationEmail,recruiterMessage, each 1..2 GroundedText.",
  "JSON only; <=1600 tokens.",
].join(" ");
