export const GROUNDED_SOURCE_FACT_ID_LIMIT = 8;

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
  sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
});

export function buildGroundedSectionOutputContract() {
  return [
    `sections:exactly ${GROUNDED_SECTION_COUNT} objects in fixed order ${GROUNDED_SECTION_TYPES_BY_POSITION.join(",")};`,
    `each section object must contain exactly:${GROUNDED_SECTION_KEYS.join(",")};`,
    "title:non-empty string; order:integer; type:canonical value for its position;",
    "type/order are canonicalized by position;",
    "lines:0..2 GroundedText. Do not rename lines or add fields.",
  ].join(" ");
}
