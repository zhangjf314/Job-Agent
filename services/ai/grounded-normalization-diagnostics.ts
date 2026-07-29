import {
  GROUNDED_APPLICATION_MATERIAL_KEYS,
  GROUNDED_ROOT_KEYS,
  GROUNDED_SECTION_COUNT,
  GROUNDED_SECTION_KEYS,
  GROUNDED_TEXT_KEYS,
} from "./grounded-tailored-resume-contract";

export const MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES = 20;
export const MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_PATH_LENGTH = 256;

export type SafeStructuralValueType =
  | "undefined"
  | "null"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "unknown";

export type GroundedNormalizationIssueCategory =
  | "UNKNOWN_KEYS_AT_NODE"
  | "KNOWN_KEY_AT_WRONG_LEVEL"
  | "EXTRA_WRAPPER_OBJECT"
  | "EXPECTED_OBJECT_RECEIVED_OTHER"
  | "EXPECTED_ARRAY_RECEIVED_OTHER"
  | "UNKNOWN_SECTION_POSITION"
  | "UNSUPPORTED_STRUCTURE"
  | "UNKNOWN_NORMALIZATION_FAILURE";

export type GroundedNormalizationNodeDiagnostic = {
  nodePath: string;
  category: GroundedNormalizationIssueCategory;
  allowedKeyCount: number;
  presentAllowedKeyCount: number;
  missingAllowedKeys: string[];
  misplacedKnownKeys: string[];
  unknownKeyCount: number;
  unknownValueTypeCounts: Partial<Record<SafeStructuralValueType, number>>;
  arrayLength: number | null;
  objectKeyCount: number | null;
};

export type GroundedNormalizationDiagnosticSummary = {
  diagnosticVersion: 1;
  issueCount: number;
  maxReportedIssues: number;
  truncated: boolean;
  issues: GroundedNormalizationNodeDiagnostic[];
};

// `resume` is not accepted by the Grounded schema. It is a fixed,
// diagnostic-only envelope token used to identify a common wrong nesting
// level without retaining any model-generated wrapper name.
const DIAGNOSTIC_ONLY_ENVELOPE_KEYS = ["resume"] as const;
const GLOBAL_SAFE_STRUCTURAL_VOCABULARY = new Set<string>([
  ...GROUNDED_ROOT_KEYS,
  ...GROUNDED_SECTION_KEYS,
  ...GROUNDED_TEXT_KEYS,
  ...GROUNDED_APPLICATION_MATERIAL_KEYS,
  ...DIAGNOSTIC_ONLY_ENVELOPE_KEYS,
]);

type ObjectNodeSpec = {
  allowedKeys: readonly string[];
  requiredKeys: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeStructuralValueType(value: unknown): SafeStructuralValueType {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return "unknown";
}

function boundedPath(path: string) {
  return path.slice(0, MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_PATH_LENGTH);
}

function createDiagnostic(input: {
  nodePath: string;
  category: GroundedNormalizationIssueCategory;
  value: unknown;
  spec?: ObjectNodeSpec;
  misplacedKnownKeys?: string[];
  unknownEntries?: Array<[string, unknown]>;
  unknownKeyCount?: number;
  unknownValueTypeCounts?: Partial<Record<SafeStructuralValueType, number>>;
}): GroundedNormalizationNodeDiagnostic {
  const objectValue = isRecord(input.value) ? input.value : null;
  const allowedKeys = input.spec?.allowedKeys ?? [];
  const requiredKeys = input.spec?.requiredKeys ?? [];
  const unknownValueTypeCounts = {
    ...(input.unknownValueTypeCounts ?? {}),
  };
  for (const [, value] of input.unknownEntries ?? []) {
    const valueType = safeStructuralValueType(value);
    unknownValueTypeCounts[valueType] =
      (unknownValueTypeCounts[valueType] ?? 0) + 1;
  }
  return {
    nodePath: boundedPath(input.nodePath),
    category: input.category,
    allowedKeyCount: allowedKeys.length,
    presentAllowedKeyCount: objectValue
      ? allowedKeys.filter((key) =>
          Object.prototype.hasOwnProperty.call(objectValue, key),
        ).length
      : 0,
    missingAllowedKeys: objectValue
      ? requiredKeys
          .filter(
            (key) => !Object.prototype.hasOwnProperty.call(objectValue, key),
          )
          .sort()
      : [...requiredKeys].sort(),
    misplacedKnownKeys: [...(input.misplacedKnownKeys ?? [])].sort(),
    unknownKeyCount:
      input.unknownKeyCount ?? input.unknownEntries?.length ?? 0,
    unknownValueTypeCounts,
    arrayLength: Array.isArray(input.value) ? input.value.length : null,
    objectKeyCount: objectValue ? Object.keys(objectValue).length : null,
  };
}

function inspectObjectNode(input: {
  issues: GroundedNormalizationNodeDiagnostic[];
  nodePath: string;
  value: unknown;
  spec: ObjectNodeSpec;
}) {
  if (!isRecord(input.value)) {
    input.issues.push(
      createDiagnostic({
        nodePath: input.nodePath,
        category: "EXPECTED_OBJECT_RECEIVED_OTHER",
        spec: input.spec,
        value: input.value,
      }),
    );
    return false;
  }

  const allowed = new Set(input.spec.allowedKeys);
  const misplacedKnownKeys: string[] = [];
  const unknownEntries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(input.value)) {
    if (allowed.has(key)) continue;
    if (GLOBAL_SAFE_STRUCTURAL_VOCABULARY.has(key)) {
      misplacedKnownKeys.push(key);
    } else {
      unknownEntries.push([key, value]);
    }
  }

  if (misplacedKnownKeys.length > 0) {
    input.issues.push(
      createDiagnostic({
        nodePath: input.nodePath,
        category: "KNOWN_KEY_AT_WRONG_LEVEL",
        spec: input.spec,
        value: input.value,
        misplacedKnownKeys,
      }),
    );
  }
  if (unknownEntries.length > 0) {
    input.issues.push(
      createDiagnostic({
        nodePath: input.nodePath,
        category: "UNKNOWN_KEYS_AT_NODE",
        spec: input.spec,
        value: input.value,
        unknownEntries,
      }),
    );
  }
  return true;
}

function inspectExpectedArray(
  issues: GroundedNormalizationNodeDiagnostic[],
  nodePath: string,
  value: unknown,
) {
  if (Array.isArray(value)) return true;
  issues.push(
    createDiagnostic({
      nodePath,
      category: "EXPECTED_ARRAY_RECEIVED_OTHER",
      value,
    }),
  );
  return false;
}

function inspectGroundedTextArray(
  issues: GroundedNormalizationNodeDiagnostic[],
  nodePath: string,
  value: unknown,
) {
  if (!inspectExpectedArray(issues, nodePath, value)) return;
  (value as unknown[]).forEach((entry, index) => {
    inspectObjectNode({
      issues,
      nodePath: `${nodePath}[${index}]`,
      value: entry,
      spec: {
        allowedKeys: GROUNDED_TEXT_KEYS,
        requiredKeys: GROUNDED_TEXT_KEYS,
      },
    });
  });
}

function inspectDiagnosticOnlyResumeEnvelope(
  issues: GroundedNormalizationNodeDiagnostic[],
  value: unknown,
) {
  if (!isRecord(value)) {
    issues.push(
      createDiagnostic({
        nodePath: "$.resume",
        category: "EXPECTED_OBJECT_RECEIVED_OTHER",
        value,
      }),
    );
    return;
  }
  const misplacedKnownKeys: string[] = [];
  const unknownEntries: Array<[string, unknown]> = [];
  for (const [key, entryValue] of Object.entries(value)) {
    if (GLOBAL_SAFE_STRUCTURAL_VOCABULARY.has(key)) {
      misplacedKnownKeys.push(key);
    } else {
      unknownEntries.push([key, entryValue]);
    }
  }
  issues.push(
    createDiagnostic({
      nodePath: "$.resume",
      category: "UNSUPPORTED_STRUCTURE",
      value,
      misplacedKnownKeys,
      unknownEntries,
    }),
  );
}

function compareDiagnostics(
  left: GroundedNormalizationNodeDiagnostic,
  right: GroundedNormalizationNodeDiagnostic,
) {
  return (
    left.nodePath.localeCompare(right.nodePath) ||
    left.category.localeCompare(right.category) ||
    left.misplacedKnownKeys
      .join(",")
      .localeCompare(right.misplacedKnownKeys.join(","))
  );
}

function collectGroundedNormalizationTopologyIssues(
  value: unknown,
): GroundedNormalizationNodeDiagnostic[] {
  const issues: GroundedNormalizationNodeDiagnostic[] = [];
  const rootSpec = {
    allowedKeys: GROUNDED_ROOT_KEYS,
    requiredKeys: GROUNDED_ROOT_KEYS,
  };

  if (!isRecord(value)) {
    issues.push(
      createDiagnostic({
        nodePath: "$",
        category: "EXPECTED_OBJECT_RECEIVED_OTHER",
        spec: rootSpec,
        value,
      }),
    );
  } else {
    const rootKeys = Object.keys(value);
    const presentRootKeyCount = GROUNDED_ROOT_KEYS.filter((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ).length;
    const soleRootEntry =
      rootKeys.length === 1 ? ([rootKeys[0], value[rootKeys[0]]] as const) : null;
    const knownKeysInsideSoleUnknownObject =
      soleRootEntry &&
      !GLOBAL_SAFE_STRUCTURAL_VOCABULARY.has(soleRootEntry[0]) &&
      isRecord(soleRootEntry[1])
        ? Object.keys(soleRootEntry[1])
            .filter((key) => GLOBAL_SAFE_STRUCTURAL_VOCABULARY.has(key))
            .sort()
        : [];

    if (
      presentRootKeyCount === 0 &&
      soleRootEntry &&
      isRecord(soleRootEntry[1]) &&
      knownKeysInsideSoleUnknownObject.length >= 2
    ) {
      issues.push(
        createDiagnostic({
          nodePath: "$",
          category: "EXTRA_WRAPPER_OBJECT",
          spec: rootSpec,
          value,
          misplacedKnownKeys: knownKeysInsideSoleUnknownObject,
          unknownKeyCount: 1,
          unknownValueTypeCounts: { object: 1 },
        }),
      );
    } else {
      inspectObjectNode({
        issues,
        nodePath: "$",
        value,
        spec: rootSpec,
      });

      if (Object.prototype.hasOwnProperty.call(value, "resume")) {
        inspectDiagnosticOnlyResumeEnvelope(issues, value.resume);
      }

      if (
        Object.prototype.hasOwnProperty.call(value, "sections") &&
        inspectExpectedArray(issues, "$.sections", value.sections)
      ) {
        (value.sections as unknown[]).forEach((section, index) => {
          const sectionPath = `$.sections[${index}]`;
          if (index >= GROUNDED_SECTION_COUNT) {
            issues.push(
              createDiagnostic({
                nodePath: sectionPath,
                category: "UNKNOWN_SECTION_POSITION",
                spec: {
                  allowedKeys: GROUNDED_SECTION_KEYS,
                  requiredKeys: GROUNDED_SECTION_KEYS,
                },
                value: section,
              }),
            );
          }
          if (
            inspectObjectNode({
              issues,
              nodePath: sectionPath,
              value: section,
              spec: {
                allowedKeys: GROUNDED_SECTION_KEYS,
                requiredKeys: GROUNDED_SECTION_KEYS,
              },
            }) &&
            Object.prototype.hasOwnProperty.call(section, "lines")
          ) {
            inspectGroundedTextArray(
              issues,
              `${sectionPath}.lines`,
              (section as Record<string, unknown>).lines,
            );
          }
        });
      }

      for (const key of [
        "rewriteExplanation",
        "changedSections",
        "missingFields",
        "improvementQuestions",
        "qualityWarnings",
      ] as const) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          inspectExpectedArray(issues, `$.${key}`, value[key]);
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(value, "applicationMaterials") &&
        inspectObjectNode({
          issues,
          nodePath: "$.applicationMaterials",
          value: value.applicationMaterials,
          spec: {
            allowedKeys: GROUNDED_APPLICATION_MATERIAL_KEYS,
            requiredKeys: GROUNDED_APPLICATION_MATERIAL_KEYS,
          },
        })
      ) {
        const applicationMaterials =
          value.applicationMaterials as Record<string, unknown>;
        for (const key of GROUNDED_APPLICATION_MATERIAL_KEYS) {
          if (Object.prototype.hasOwnProperty.call(applicationMaterials, key)) {
            inspectGroundedTextArray(
              issues,
              `$.applicationMaterials.${key}`,
              applicationMaterials[key],
            );
          }
        }
      }
    }
  }

  issues.sort(compareDiagnostics);
  return issues;
}

function summarizeGroundedNormalizationTopologyIssues(
  issues: GroundedNormalizationNodeDiagnostic[],
): GroundedNormalizationDiagnosticSummary {
  const issueCount = issues.length;
  return {
    diagnosticVersion: 1,
    issueCount,
    maxReportedIssues: MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES,
    truncated: issueCount > MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES,
    issues: issues.slice(0, MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES),
  };
}

export function diagnoseGroundedNormalizationTopology(
  value: unknown,
): GroundedNormalizationDiagnosticSummary {
  return summarizeGroundedNormalizationTopologyIssues(
    collectGroundedNormalizationTopologyIssues(value),
  );
}

export class GroundedNormalizationDiagnosticError extends Error {
  readonly code = "GROUNDED_NORMALIZATION_FAILED";

  constructor(
    readonly diagnosticSummary: GroundedNormalizationDiagnosticSummary,
  ) {
    super("Grounded output contains an unsupported field.");
    this.name = "GroundedNormalizationDiagnosticError";
  }
}

export function createUnknownGroundedNormalizationDiagnosticSummary(): GroundedNormalizationDiagnosticSummary {
  return {
    diagnosticVersion: 1,
    issueCount: 1,
    maxReportedIssues: MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES,
    truncated: false,
    issues: [
      {
        nodePath: "$",
        category: "UNKNOWN_NORMALIZATION_FAILURE",
        allowedKeyCount: GROUNDED_ROOT_KEYS.length,
        presentAllowedKeyCount: 0,
        missingAllowedKeys: [],
        misplacedKnownKeys: [],
        unknownKeyCount: 0,
        unknownValueTypeCounts: {},
        arrayLength: null,
        objectKeyCount: null,
      },
    ],
  };
}

export function assertGroundedNormalizationTopology(value: unknown) {
  const allIssues = collectGroundedNormalizationTopologyIssues(value);
  const hasUnsupportedFieldTopology = allIssues.some((issue) =>
    [
      "UNKNOWN_KEYS_AT_NODE",
      "KNOWN_KEY_AT_WRONG_LEVEL",
      "EXTRA_WRAPPER_OBJECT",
      "UNSUPPORTED_STRUCTURE",
    ].includes(issue.category),
  );
  if (hasUnsupportedFieldTopology) {
    throw new GroundedNormalizationDiagnosticError(
      summarizeGroundedNormalizationTopologyIssues(allIssues),
    );
  }
}

export function safeGroundedNormalizationDiagnosticMetadata(
  summary?: GroundedNormalizationDiagnosticSummary,
) {
  if (!summary) return {};
  const missingAllowedKeys = new Set<string>();
  const misplacedKnownKeys = new Set<string>();
  const issueCategories = new Set<GroundedNormalizationIssueCategory>();
  const nodePaths = new Set<string>();
  const unknownValueTypeCounts: Partial<
    Record<SafeStructuralValueType, number>
  > = {};
  let unknownKeyCount = 0;

  for (const issue of summary.issues) {
    nodePaths.add(issue.nodePath);
    issueCategories.add(issue.category);
    issue.missingAllowedKeys.forEach((key) => missingAllowedKeys.add(key));
    issue.misplacedKnownKeys.forEach((key) => misplacedKnownKeys.add(key));
    unknownKeyCount += issue.unknownKeyCount;
    for (const [valueType, count] of Object.entries(
      issue.unknownValueTypeCounts,
    )) {
      const safeValueType = valueType as SafeStructuralValueType;
      unknownValueTypeCounts[safeValueType] =
        (unknownValueTypeCounts[safeValueType] ?? 0) + count;
    }
  }

  return {
    normalizationDiagnosticVersion: summary.diagnosticVersion,
    normalizationIssueCount: summary.issueCount,
    normalizationReportedIssueCount: summary.issues.length,
    normalizationIssuesTruncated: summary.truncated,
    normalizationNodePaths: [...nodePaths].sort(),
    normalizationIssueCategories: [...issueCategories].sort(),
    normalizationMissingAllowedKeys: [...missingAllowedKeys].sort(),
    normalizationMisplacedKnownKeys: [...misplacedKnownKeys].sort(),
    normalizationUnknownKeyCount: unknownKeyCount,
    normalizationUnknownValueTypeCounts: unknownValueTypeCounts,
    groundedNormalizationDiagnosticSummary: summary,
  };
}
