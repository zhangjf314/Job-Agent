import type {
  SafeSchemaDiagnosticSummary,
} from "./schema-diagnostics";

export const GROUNDED_TAILORED_RESUME_LIMITS = Object.freeze({
  changedSectionsMax: 2,
  sourceFactIdsMax: 8,
  rewriteExplanationMax: 2,
  rewriteExplanationItemMinChars: 1,
  sectionLinesMin: 0,
  sectionLinesMax: 2,
});

export const GROUNDED_SOURCE_FACT_ID_LIMIT =
  GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax;

export const GROUNDED_ROOT_KEYS = [
  "sections",
  "rewriteExplanation",
  "changedSections",
  "missingFields",
  "improvementQuestions",
  "qualityWarnings",
  "applicationMaterials",
] as const;

export const GROUNDED_SECTION_KEYS = [
  "type",
  "title",
  "lines",
  "order",
] as const;

export const GROUNDED_TEXT_KEYS = [
  "text",
  "sourceFactIds",
  "kind",
] as const;

export const GROUNDED_APPLICATION_MATERIAL_KEYS = [
  "selfIntroduction",
  "applicationEmail",
  "recruiterMessage",
] as const;

export const GROUNDED_SECTION_TYPES_BY_POSITION = [
  "summary",
  "skills",
  "projects",
  "experiences",
  "education",
  "others",
] as const;

export const GROUNDED_SECTION_COUNT =
  GROUNDED_SECTION_TYPES_BY_POSITION.length;

export const GROUNDED_SKILLS_SECTION_EXAMPLE = Object.freeze({
  type: "skills",
  title: "S",
  lines: [{
    text: "group",
    sourceFactIds: ["F_X"],
    kind: "fact",
  }],
  order: 1,
});

export const REQUIRED_APPLICATION_MATERIAL_PATHS =
  GROUNDED_APPLICATION_MATERIAL_KEYS.map(
    (key) => `applicationMaterials.${key}`,
  );

export const GROUNDED_CONTRACT_SHAPE = Object.freeze({
  topLevelKeys: GROUNDED_ROOT_KEYS,
  sectionKeys: GROUNDED_SECTION_KEYS,
  groundedTextKeys: GROUNDED_TEXT_KEYS,
  applicationMaterialKeys: GROUNDED_APPLICATION_MATERIAL_KEYS,
  sectionTypesByPosition: GROUNDED_SECTION_TYPES_BY_POSITION,
  sectionCount: GROUNDED_SECTION_COUNT,
  changedSectionsLimit:
    GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax,
  sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
  sectionLinesMinimum: GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMin,
  sectionLinesLimit: GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax,
});

export const GROUNDED_TOP_LEVEL_CONTRACT = Object.freeze({
  rewriteExplanation: Object.freeze({
    type: "string_array",
    minItems: 0,
    maxItems: GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationMax,
    itemMinChars:
      GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationItemMinChars,
    itemMaxChars: null,
  }),
});

export type RewriteExplanationReceivedType =
  | "array"
  | "string"
  | "null"
  | "object"
  | "other";

export function rewriteExplanationReceivedType(
  value: unknown,
): RewriteExplanationReceivedType {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "object") return "object";
  return "other";
}

export function buildGroundedSectionOutputContract() {
  const {
    sectionLinesMin,
    sectionLinesMax,
  } = GROUNDED_TAILORED_RESUME_LIMITS;
  return [
    `sections:exactly ${GROUNDED_SECTION_COUNT},fixed order ${GROUNDED_SECTION_TYPES_BY_POSITION.join(",")};`,
    `each exactly {${GROUNDED_SECTION_KEYS.join(",")}};type/order fixed by position;title non-empty;lines:${sectionLinesMin}..${sectionLinesMax} GroundedText;no aliases/extra fields.`,
    `Selective/not exhaustive;${sectionLinesMin}..${sectionLinesMax} each:summary core;skills group relevant,no per-skill lines/all facts;projects relevant;experiences real;education grouped;others supported/no overflow.Ex:${JSON.stringify(GROUNDED_SKILLS_SECTION_EXAMPLE)}.`,
  ].join(" ");
}

export function buildRewriteExplanationOutputContract() {
  return [
    `rewriteExplanation:JSON string array,0..${GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationMax} concise non-empty items;never a single string/joined paragraph.`,
    'Example:"rewriteExplanation":["突出虚构岗位相关的已有事实","弱化无事实依据的虚构关键词"].',
  ].join(" ");
}

export function classifyGroundedSchemaFailure(
  schemaName: string,
  summary?: SafeSchemaDiagnosticSummary,
) {
  if (
    schemaName !== "grounded_tailored_resume_result" ||
    summary?.issueCount !== 1 ||
    summary.issues.length !== 1
  ) {
    return undefined;
  }
  const issue = summary.issues[0];
  if (
    issue.category === "ARRAY_TOO_LARGE" &&
    /^sections\[\d+\]\.lines$/.test(issue.path) &&
    issue.maximum === GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax
  ) {
    return "SECTION_LINES_CARDINALITY_VIOLATION";
  }
  if (issue.path !== "rewriteExplanation") return undefined;
  if (
    issue.category === "INVALID_TYPE" &&
    issue.expectedType === "array" &&
    issue.receivedType === "string"
  ) {
    return "REWRITE_EXPLANATION_TYPE_VIOLATION";
  }
  if (issue.category === "ARRAY_TOO_LARGE") {
    return "REWRITE_EXPLANATION_CARDINALITY_VIOLATION";
  }
  return undefined;
}

export function buildGroundedArrayCardinalityOutputContract() {
  const canonicalTypes = GROUNDED_SECTION_TYPES_BY_POSITION.join("|");
  return [
    `changedSections:0..${GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax} unique canonical ${canonicalTypes}; only most materially changed, not exhaustive.`,
    `Each sourceFactIds:0..${GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax} unique supplied F_*; no J_REQ_*; minimum sufficient evidence.`,
    `Each selected line must stay complete within ${GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax} evidence IDs; do not emit extra lines merely to use every fact.`,
  ].join(" ");
}
