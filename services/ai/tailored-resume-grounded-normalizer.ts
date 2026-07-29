import { assertGroundedNormalizationTopology } from "./grounded-normalization-diagnostics";

export const GROUNDED_SOURCE_FACT_ID_LIMIT = 8;

export const GROUNDED_SECTION_TYPES_BY_POSITION = [
  "summary",
  "skills",
  "projects",
  "experiences",
  "education",
  "others",
] as const;

export const REQUIRED_APPLICATION_MATERIAL_PATHS = [
  "applicationMaterials.selfIntroduction",
  "applicationMaterials.applicationEmail",
  "applicationMaterials.recruiterMessage",
] as const;

export type GroundedNormalizationSummary = {
  groundedNormalizationApplied: boolean;
  defaultedApplicationMaterialArrays: string[];
  canonicalizedSectionTypes: number;
  deduplicatedFactIdCount: number;
  sourceFactIdLimit: number;
};

export type GroundedNormalizationResult = {
  normalized: unknown;
  summary: GroundedNormalizationSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error("Grounded output contains an unsupported field.");
  }
}

function deduplicateClaimSourceIds(
  value: unknown,
  summary: GroundedNormalizationSummary,
) {
  if (!isRecord(value)) return value;
  assertAllowedKeys(value, ["text", "sourceFactIds", "kind"]);
  if (!Array.isArray(value.sourceFactIds)) return value;
  if (!value.sourceFactIds.every((item) => typeof item === "string")) return value;

  const sourceFactIds = [...new Set(value.sourceFactIds)];
  summary.deduplicatedFactIdCount += value.sourceFactIds.length - sourceFactIds.length;
  return sourceFactIds.length === value.sourceFactIds.length
    ? value
    : { ...value, sourceFactIds };
}

function normalizeKnownClaims(
  value: unknown,
  summary: GroundedNormalizationSummary,
) {
  if (!Array.isArray(value)) return value;
  return value.map((claim) => deduplicateClaimSourceIds(claim, summary));
}

/**
 * Normalizes only deterministic Grounded transport details. It intentionally
 * does not synthesize missing application-material content: all three arrays
 * are required to contain business text by both the Grounded and public
 * schemas, so a missing array remains a schema failure.
 */
export function normalizeGroundedTailoredResume(
  value: unknown,
): GroundedNormalizationResult {
  // Structural validation is deliberately completed before any summary state,
  // cloning, canonicalization, or deduplication work begins.
  assertGroundedNormalizationTopology(value);

  const summary: GroundedNormalizationSummary = {
    groundedNormalizationApplied: false,
    defaultedApplicationMaterialArrays: [],
    canonicalizedSectionTypes: 0,
    deduplicatedFactIdCount: 0,
    sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
  };
  if (!isRecord(value)) return { normalized: value, summary };
  assertAllowedKeys(value, [
    "sections",
    "rewriteExplanation",
    "changedSections",
    "missingFields",
    "improvementQuestions",
    "qualityWarnings",
    "applicationMaterials",
  ]);

  let normalized: Record<string, unknown> = value;

  if (Array.isArray(value.sections)) {
    const sections = value.sections.map((section, index) => {
      if (!isRecord(section)) return section;
      assertAllowedKeys(section, ["type", "title", "lines", "order"]);
      const canonicalType = GROUNDED_SECTION_TYPES_BY_POSITION[index];
      if (!canonicalType) return section;
      const lines = normalizeKnownClaims(section.lines, summary);
      if (section.type !== canonicalType) summary.canonicalizedSectionTypes += 1;
      return {
        ...section,
        type: canonicalType,
        ...(lines === section.lines ? {} : { lines }),
      };
    });
    normalized = { ...normalized, sections };
  }

  if (isRecord(value.applicationMaterials)) {
    assertAllowedKeys(value.applicationMaterials, [
      "selfIntroduction",
      "applicationEmail",
      "recruiterMessage",
    ]);
    const applicationMaterials = { ...value.applicationMaterials };
    for (const key of [
      "selfIntroduction",
      "applicationEmail",
      "recruiterMessage",
    ] as const) {
      if (Object.prototype.hasOwnProperty.call(applicationMaterials, key)) {
        applicationMaterials[key] = normalizeKnownClaims(
          applicationMaterials[key],
          summary,
        );
      }
    }
    normalized = { ...normalized, applicationMaterials };
  }

  summary.groundedNormalizationApplied =
    summary.defaultedApplicationMaterialArrays.length > 0 ||
    summary.canonicalizedSectionTypes > 0 ||
    summary.deduplicatedFactIdCount > 0;

  return { normalized, summary };
}

export function safeGroundedNormalizationMetadata(
  summary?: GroundedNormalizationSummary,
) {
  if (!summary) return {};
  return {
    groundedNormalizationApplied: summary.groundedNormalizationApplied,
    defaultedApplicationMaterialArrayCount:
      summary.defaultedApplicationMaterialArrays.length,
    defaultedApplicationMaterialPaths:
      summary.defaultedApplicationMaterialArrays,
    canonicalizedSectionTypeCount: summary.canonicalizedSectionTypes,
    deduplicatedSourceFactIdCount: summary.deduplicatedFactIdCount,
    sourceFactIdLimit: summary.sourceFactIdLimit,
  };
}
