export const GROUNDED_TAILORED_RESUME_LIMITS = Object.freeze({
  changedSectionsMax: 2,
  sourceFactIdsMax: 8,
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
});

export function buildGroundedSectionOutputContract() {
  return [
    `sections:exactly ${GROUNDED_SECTION_COUNT}, fixed order ${GROUNDED_SECTION_TYPES_BY_POSITION.join(",")};`,
    `each exactly {${GROUNDED_SECTION_KEYS.join(",")}}; type/order match position; title non-empty; lines:0..2 GroundedText; no aliases/extra fields.`,
  ].join(" ");
}

export function buildGroundedArrayCardinalityOutputContract() {
  const canonicalTypes = GROUNDED_SECTION_TYPES_BY_POSITION.join("|");
  return [
    `changedSections:0..${GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax} unique canonical ${canonicalTypes}; only most materially changed, not exhaustive.`,
    `Each sourceFactIds:0..${GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax} unique supplied F_*; no J_REQ_*; minimum sufficient evidence.`,
    `Need >${GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax} evidence IDs: split into independent understandable GroundedText lines; drop none; each line <=${GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax}.`,
  ].join(" ");
}
