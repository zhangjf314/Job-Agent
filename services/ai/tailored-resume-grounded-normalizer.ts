import { assertGroundedNormalizationTopology } from "./grounded-normalization-diagnostics";
import {
  GROUNDED_APPLICATION_MATERIAL_KEYS,
  GROUNDED_ROOT_KEYS,
  GROUNDED_SECTION_KEYS,
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_SOURCE_FACT_ID_LIMIT,
  GROUNDED_TEXT_KEYS,
} from "./grounded-tailored-resume-contract";

export {
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_SOURCE_FACT_ID_LIMIT,
  REQUIRED_APPLICATION_MATERIAL_PATHS,
} from "./grounded-tailored-resume-contract";

export type GroundedNormalizationSummary = {
  groundedNormalizationApplied: boolean;
  defaultedApplicationMaterialArrays: string[];
  canonicalizedSectionTypes: number;
  canonicalizedSectionOrders: number;
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
  assertAllowedKeys(value, GROUNDED_TEXT_KEYS);
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
    canonicalizedSectionOrders: 0,
    deduplicatedFactIdCount: 0,
    sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
  };
  if (!isRecord(value)) return { normalized: value, summary };
  assertAllowedKeys(value, GROUNDED_ROOT_KEYS);

  let normalized: Record<string, unknown> = value;

  if (Array.isArray(value.sections)) {
    const sections = value.sections.map((section, index) => {
      if (!isRecord(section)) return section;
      assertAllowedKeys(section, GROUNDED_SECTION_KEYS);
      const canonicalType = GROUNDED_SECTION_TYPES_BY_POSITION[index];
      if (!canonicalType) return section;
      const lines = normalizeKnownClaims(section.lines, summary);
      if (section.type !== canonicalType) summary.canonicalizedSectionTypes += 1;
      if (section.order !== index) summary.canonicalizedSectionOrders += 1;
      return {
        ...section,
        type: canonicalType,
        order: index,
        ...(lines === section.lines ? {} : { lines }),
      };
    });
    normalized = { ...normalized, sections };
  }

  if (isRecord(value.applicationMaterials)) {
    assertAllowedKeys(
      value.applicationMaterials,
      GROUNDED_APPLICATION_MATERIAL_KEYS,
    );
    const applicationMaterials = { ...value.applicationMaterials };
    for (const key of GROUNDED_APPLICATION_MATERIAL_KEYS) {
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
    summary.canonicalizedSectionOrders > 0 ||
    summary.deduplicatedFactIdCount > 0;

  return { normalized, summary };
}

export function safeGroundedNormalizationMetadata(
  summary?: GroundedNormalizationSummary,
) {
  if (!summary) return {};
  return {
    groundedNormalizationStatus: "passed",
    groundedNormalizationApplied: summary.groundedNormalizationApplied,
    normalizationIssueCount: 0,
    normalizationNodePaths: [],
    normalizationUnknownKeyCount: 0,
    normalizationUnknownValueTypeCounts: {},
    defaultedApplicationMaterialArrayCount:
      summary.defaultedApplicationMaterialArrays.length,
    defaultedApplicationMaterialPaths:
      summary.defaultedApplicationMaterialArrays,
    canonicalizedSectionTypeCount: summary.canonicalizedSectionTypes,
    canonicalizedSectionOrderCount: summary.canonicalizedSectionOrders,
    deduplicatedSourceFactIdCount: summary.deduplicatedFactIdCount,
    sourceFactIdLimit: summary.sourceFactIdLimit,
  };
}
