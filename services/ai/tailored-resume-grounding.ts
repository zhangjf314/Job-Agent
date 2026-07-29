import { z } from "zod";
import { tailoredResumeResultSchema } from "@/schemas/jd";
import type { TailoredResumeResult } from "@/types/jd";

export const groundedClaimKinds = ["fact", "goal", "format"] as const;

export const groundedTextSchema = z.object({
  text: z.string().trim().min(1).max(80),
  sourceFactIds: z.array(z.string().trim().min(1)).max(4),
  kind: z.enum(groundedClaimKinds),
});

export const groundedTailoredResumeSchema = z.object({
  sections: z.array(z.object({
    type: z.enum([
      "basic_info",
      "summary",
      "education",
      "skills",
      "projects",
      "experiences",
      "certificates",
      "awards",
      "others",
    ]),
    title: z.string().trim().min(1),
    lines: z.array(groundedTextSchema).max(2),
    order: z.number().int().min(0),
  })).min(4).max(6),
  rewriteExplanation: z.array(z.string().trim().min(1)).max(2),
  changedSections: z.array(z.string().trim().min(1)).max(2),
  missingFields: z.array(z.string().trim().min(1)).max(2),
  improvementQuestions: z.array(z.string().trim().min(1)).max(2),
  qualityWarnings: z.array(z.string().trim().min(1)).max(2),
  applicationMaterials: z.object({
    selfIntroduction: z.array(groundedTextSchema).min(1).max(2),
    applicationEmail: z.array(groundedTextSchema).min(1).max(2),
    recruiterMessage: z.array(groundedTextSchema).min(1).max(2),
  }),
});

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
  "Return one compact JSON object with sections,rewriteExplanation,changedSections,missingFields,improvementQuestions,qualityWarnings,applicationMaterials.",
  "sections:4..6 items {type,title,lines:0..2 GroundedText,order}; GroundedText:{text:max 80 Chinese characters,sourceFactIds:0..4,kind:fact|goal|format}.",
  "Every factual line must use kind=fact and cite only supplied F_* candidate IDs. Never cite J_REQ_* IDs.",
  "Goal text must use kind=goal and must clearly say target, plan, hope, learning, or future. Format text is only a heading or label.",
  "Each explanatory/warning array has at most 2 short strings. Each application material has 1..2 GroundedText items.",
  "Keep every text concise, keep the full result within 1600 output tokens, and return JSON only.",
].join(" ");
