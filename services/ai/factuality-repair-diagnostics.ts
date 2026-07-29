import type { CandidateFact } from "./candidate-fact-registry";
import {
  factualityRepairPatchSchema,
  type FactualityRepairLocationKind,
  type FactualityRepairTarget,
} from "./tailored-resume-factuality-repair";

export type RepairPipelineStageStatus =
  | "not_reached"
  | "passed"
  | "failed";

export type FactualityRepairDiagnosticCategory =
  | "REPAIR_COUNT_MISMATCH"
  | "TARGET_ID_MISSING"
  | "TARGET_ID_UNKNOWN"
  | "TARGET_ID_DUPLICATED"
  | "TARGET_ORDER_MISMATCH"
  | "ACTION_MISSING"
  | "ACTION_INVALID"
  | "REPLACEMENT_MISSING"
  | "REPLACEMENT_INVALID_TYPE"
  | "REPLACEMENT_EXTRA_FIELDS"
  | "TEXT_MISSING"
  | "TEXT_INVALID_TYPE"
  | "TEXT_EMPTY"
  | "SOURCE_FACT_IDS_MISSING"
  | "SOURCE_FACT_IDS_INVALID_TYPE"
  | "SOURCE_FACT_IDS_TOO_MANY"
  | "SOURCE_FACT_IDS_DUPLICATED"
  | "SOURCE_FACT_IDS_ORDER_MISMATCH"
  | "SOURCE_FACT_ID_UNKNOWN"
  | "SOURCE_FACT_ID_IS_JD_REQUIREMENT"
  | "KIND_MISSING"
  | "KIND_INVALID"
  | "KIND_NOT_ALLOWED_AT_TARGET"
  | "GOAL_OR_FORMAT_HAS_FACT_IDS"
  | "SECTION_FACT_REPLACED_WITH_NONFACT"
  | "PATCH_SCOPE_VIOLATION"
  | "UNKNOWN_PATCH_VALIDATION_FAILURE";

export type SafeRepairValueType =
  | "undefined"
  | "null"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "unknown";

export type SafeReceivedKind =
  | "fact"
  | "goal"
  | "format"
  | "unknown";

export type SafeFactualityRepairDiagnostic = {
  category: FactualityRepairDiagnosticCategory;
  targetId: string | null;
  targetPath: string | null;
  targetLocationKind: FactualityRepairLocationKind | null;
  receivedRepairCount: number | null;
  expectedRepairCount: number | null;
  receivedType: SafeRepairValueType | null;
  expectedType: string | null;
  sourceFactIdCount: number | null;
  sourceFactIdLimit: number | null;
  duplicateSourceFactIdCount: number | null;
  unknownSourceFactIdCount: number | null;
  jdRequirementSourceIdCount: number | null;
  expectedKindClass: string | null;
  receivedKind: SafeReceivedKind | null;
};

export type FactualityRepairDiagnostics = {
  repairHttpStatus: number | null;
  repairJsonStatus: RepairPipelineStageStatus;
  repairEnvelopeStatus: RepairPipelineStageStatus;
  repairTargetCoverageStatus: RepairPipelineStageStatus;
  repairPatchStructureStatus: RepairPipelineStageStatus;
  repairPatchSemanticStatus: RepairPipelineStageStatus;
  repairScopeStatus: RepairPipelineStageStatus;
  repairApplyStatus: RepairPipelineStageStatus;
  postRepairSchemaStatus: RepairPipelineStageStatus;
  postRepairFactualityStatus: RepairPipelineStageStatus;
  repairExpectedTargetCount: number;
  repairReceivedCount: number | null;
  repairAcceptedPatchCount: number;
  repairDiagnosticIssueCount: number;
  repairReportedDiagnosticIssueCount: number;
  repairDiagnosticsTruncated: boolean;
  repairDiagnosticCategories: FactualityRepairDiagnosticCategory[];
  repairMissingTargetIds: string[];
  repairUnknownTargetCount: number;
  repairDuplicateTargetIds: string[];
  repairTargetOrderMatches: boolean | null;
  repairInvalidActionCount: number;
  repairInvalidReplacementCount: number;
  repairInvalidKindCount: number;
  repairKindLocationViolationCount: number;
  repairMaximumSourceFactIdsObserved: number | null;
  repairSourceFactIdsLimit: number;
  repairDuplicateSourceFactIdCount: number;
  repairUnknownSourceFactIdCount: number;
  repairJdRequirementSourceIdCount: number;
  repairSourceFactIdsOrderMismatchCount: number;
  repairDiagnostics: SafeFactualityRepairDiagnostic[];
};

export const MAX_REPORTED_FACTUALITY_REPAIR_DIAGNOSTICS = 30;
export const FACTUALITY_REPAIR_SOURCE_FACT_ID_LIMIT = 8;

const patchKeys = ["targetId", "action", "replacement"] as const;
const replacementKeys = ["text", "sourceFactIds", "kind"] as const;
const fixedKinds = ["fact", "goal", "format"] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeRepairValueType(value: unknown): SafeRepairValueType {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return "unknown";
}

function safeReceivedKind(value: unknown): SafeReceivedKind {
  return fixedKinds.includes(value as typeof fixedKinds[number])
    ? value as typeof fixedKinds[number]
    : "unknown";
}

function baseDiagnostic(
  category: FactualityRepairDiagnosticCategory,
  target: FactualityRepairTarget | null,
  overrides: Partial<SafeFactualityRepairDiagnostic> = {},
): SafeFactualityRepairDiagnostic {
  return {
    category,
    targetId: target?.targetId ?? null,
    targetPath: target?.path ?? null,
    targetLocationKind: target?.locationKind ?? null,
    receivedRepairCount: null,
    expectedRepairCount: null,
    receivedType: null,
    expectedType: null,
    sourceFactIdCount: null,
    sourceFactIdLimit: null,
    duplicateSourceFactIdCount: null,
    unknownSourceFactIdCount: null,
    jdRequirementSourceIdCount: null,
    expectedKindClass: null,
    receivedKind: null,
    ...overrides,
  };
}

export function createEmptyFactualityRepairDiagnostics(
  expectedTargetCount: number,
): FactualityRepairDiagnostics {
  return {
    repairHttpStatus: null,
    repairJsonStatus: "not_reached",
    repairEnvelopeStatus: "not_reached",
    repairTargetCoverageStatus: "not_reached",
    repairPatchStructureStatus: "not_reached",
    repairPatchSemanticStatus: "not_reached",
    repairScopeStatus: "not_reached",
    repairApplyStatus: "not_reached",
    postRepairSchemaStatus: "not_reached",
    postRepairFactualityStatus: "not_reached",
    repairExpectedTargetCount: expectedTargetCount,
    repairReceivedCount: null,
    repairAcceptedPatchCount: 0,
    repairDiagnosticIssueCount: 0,
    repairReportedDiagnosticIssueCount: 0,
    repairDiagnosticsTruncated: false,
    repairDiagnosticCategories: [],
    repairMissingTargetIds: [],
    repairUnknownTargetCount: 0,
    repairDuplicateTargetIds: [],
    repairTargetOrderMatches: null,
    repairInvalidActionCount: 0,
    repairInvalidReplacementCount: 0,
    repairInvalidKindCount: 0,
    repairKindLocationViolationCount: 0,
    repairMaximumSourceFactIdsObserved: null,
    repairSourceFactIdsLimit: FACTUALITY_REPAIR_SOURCE_FACT_ID_LIMIT,
    repairDuplicateSourceFactIdCount: 0,
    repairUnknownSourceFactIdCount: 0,
    repairJdRequirementSourceIdCount: 0,
    repairSourceFactIdsOrderMismatchCount: 0,
    repairDiagnostics: [],
  };
}

function targetSortIndex(
  targetId: string | null,
  targetOrder: Map<string, number>,
) {
  return targetId === null
    ? Number.MAX_SAFE_INTEGER
    : targetOrder.get(targetId) ?? Number.MAX_SAFE_INTEGER;
}

function finalizeDiagnostics(
  diagnostics: FactualityRepairDiagnostics,
  issues: SafeFactualityRepairDiagnostic[],
  targets: FactualityRepairTarget[],
) {
  const targetOrder = new Map(
    targets.map((target, index) => [target.targetId, index]),
  );
  const sorted = [...issues].sort((left, right) =>
    targetSortIndex(left.targetId, targetOrder) -
      targetSortIndex(right.targetId, targetOrder) ||
    left.category.localeCompare(right.category)
  );
  diagnostics.repairDiagnosticIssueCount = sorted.length;
  diagnostics.repairDiagnostics = sorted.slice(
    0,
    MAX_REPORTED_FACTUALITY_REPAIR_DIAGNOSTICS,
  );
  diagnostics.repairReportedDiagnosticIssueCount =
    diagnostics.repairDiagnostics.length;
  diagnostics.repairDiagnosticsTruncated =
    sorted.length > diagnostics.repairDiagnostics.length;
  diagnostics.repairDiagnosticCategories = [
    ...new Set(sorted.map((issue) => issue.category)),
  ].sort();
  diagnostics.repairInvalidActionCount = sorted.filter((issue) =>
    issue.category === "ACTION_MISSING" ||
    issue.category === "ACTION_INVALID"
  ).length;
  diagnostics.repairInvalidReplacementCount = sorted.filter((issue) =>
    issue.category.startsWith("REPLACEMENT_") ||
    issue.category.startsWith("TEXT_") ||
    issue.category === "SOURCE_FACT_IDS_MISSING" ||
    issue.category === "SOURCE_FACT_IDS_INVALID_TYPE"
  ).length;
  diagnostics.repairInvalidKindCount = sorted.filter((issue) =>
    issue.category === "KIND_MISSING" ||
    issue.category === "KIND_INVALID"
  ).length;
  diagnostics.repairKindLocationViolationCount = sorted.filter((issue) =>
    issue.category === "KIND_NOT_ALLOWED_AT_TARGET" ||
    issue.category === "SECTION_FACT_REPLACED_WITH_NONFACT" ||
    issue.category === "GOAL_OR_FORMAT_HAS_FACT_IDS"
  ).length;
  diagnostics.repairAcceptedPatchCount = sorted.length === 0
    ? diagnostics.repairReceivedCount ?? 0
    : 0;
  return diagnostics;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]) {
  return Object.keys(record).every((key) => allowed.includes(key));
}

function duplicateCount(values: string[]) {
  return values.length - new Set(values).size;
}

function expectedKindClass(target: FactualityRepairTarget) {
  if (target.current.kind === "goal") return "goal";
  if (target.current.kind === "format") return "format";
  if (target.locationKind === "section_line") return "fact";
  return "fact_or_goal";
}

export function diagnoseFactualityRepairPatch(
  value: unknown,
  targets: FactualityRepairTarget[],
  candidateFacts: CandidateFact[],
): FactualityRepairDiagnostics {
  const diagnostics = createEmptyFactualityRepairDiagnostics(targets.length);
  diagnostics.repairJsonStatus = "passed";
  const issues: SafeFactualityRepairDiagnostic[] = [];

  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["repairs"]) ||
    !Array.isArray(value.repairs)
  ) {
    diagnostics.repairEnvelopeStatus = "failed";
    issues.push(baseDiagnostic(
      "UNKNOWN_PATCH_VALIDATION_FAILURE",
      null,
      {
        receivedType: safeRepairValueType(
          isRecord(value) ? value.repairs : value,
        ),
        expectedType: "object_with_repairs_array",
      },
    ));
    return finalizeDiagnostics(diagnostics, issues, targets);
  }

  diagnostics.repairEnvelopeStatus = "passed";
  const repairs = value.repairs;
  diagnostics.repairReceivedCount = repairs.length;
  const targetById = new Map(
    targets.map((target) => [target.targetId, target]),
  );
  const expectedIds = targets.map((target) => target.targetId);
  const receivedKnownIds = repairs.flatMap((repair) =>
    isRecord(repair) &&
    typeof repair.targetId === "string" &&
    targetById.has(repair.targetId)
      ? [repair.targetId]
      : []
  );
  const receivedIdCounts = new Map<string, number>();
  for (const targetId of receivedKnownIds) {
    receivedIdCounts.set(targetId, (receivedIdCounts.get(targetId) ?? 0) + 1);
  }
  diagnostics.repairMissingTargetIds = expectedIds.filter(
    (targetId) => !receivedIdCounts.has(targetId),
  );
  diagnostics.repairDuplicateTargetIds = expectedIds.filter(
    (targetId) => (receivedIdCounts.get(targetId) ?? 0) > 1,
  );
  diagnostics.repairUnknownTargetCount = repairs.filter((repair) =>
    isRecord(repair) &&
    typeof repair.targetId === "string" &&
    !targetById.has(repair.targetId)
  ).length;
  diagnostics.repairTargetOrderMatches =
    receivedKnownIds.length === expectedIds.length &&
    receivedKnownIds.every((targetId, index) => targetId === expectedIds[index]);

  if (repairs.length !== targets.length) {
    issues.push(baseDiagnostic("REPAIR_COUNT_MISMATCH", null, {
      receivedRepairCount: repairs.length,
      expectedRepairCount: targets.length,
    }));
  }
  for (const targetId of diagnostics.repairMissingTargetIds) {
    issues.push(baseDiagnostic(
      "TARGET_ID_MISSING",
      targetById.get(targetId)!,
    ));
  }
  for (const targetId of diagnostics.repairDuplicateTargetIds) {
    issues.push(baseDiagnostic(
      "TARGET_ID_DUPLICATED",
      targetById.get(targetId)!,
    ));
  }
  for (let index = 0; index < diagnostics.repairUnknownTargetCount; index += 1) {
    issues.push(baseDiagnostic("TARGET_ID_UNKNOWN", null));
  }
  const targetIdMissingCount = repairs.filter((repair) =>
    !isRecord(repair) || !Object.hasOwn(repair, "targetId")
  ).length;
  for (let index = 0; index < targetIdMissingCount; index += 1) {
    issues.push(baseDiagnostic("TARGET_ID_MISSING", null, {
      receivedType: "undefined",
      expectedType: "string",
    }));
  }

  if (
    diagnostics.repairMissingTargetIds.length > 0 ||
    diagnostics.repairDuplicateTargetIds.length > 0 ||
    diagnostics.repairUnknownTargetCount > 0 ||
    targetIdMissingCount > 0 ||
    repairs.length !== targets.length
  ) {
    diagnostics.repairTargetCoverageStatus = "failed";
    return finalizeDiagnostics(diagnostics, issues, targets);
  }
  diagnostics.repairTargetCoverageStatus = "passed";

  for (const repair of repairs) {
    if (!isRecord(repair)) {
      issues.push(baseDiagnostic(
        "REPLACEMENT_INVALID_TYPE",
        null,
        {
          receivedType: safeRepairValueType(repair),
          expectedType: "object",
        },
      ));
      continue;
    }
    const target = typeof repair.targetId === "string"
      ? targetById.get(repair.targetId) ?? null
      : null;
    if (!hasOnlyKeys(repair, patchKeys)) {
      issues.push(baseDiagnostic(
        "REPLACEMENT_EXTRA_FIELDS",
        target,
        { receivedType: "object", expectedType: "targetId,action,replacement" },
      ));
    }
    if (!Object.hasOwn(repair, "action")) {
      issues.push(baseDiagnostic(
        "ACTION_MISSING",
        target,
        { receivedType: "undefined", expectedType: "string_literal_replace" },
      ));
    } else if (
      typeof repair.action !== "string" ||
      repair.action !== "replace"
    ) {
      issues.push(baseDiagnostic(
        "ACTION_INVALID",
        target,
        {
          receivedType: safeRepairValueType(repair.action),
          expectedType: "string_literal_replace",
        },
      ));
    }
    if (!Object.hasOwn(repair, "replacement")) {
      issues.push(baseDiagnostic(
        "REPLACEMENT_MISSING",
        target,
        { receivedType: "undefined", expectedType: "object" },
      ));
      continue;
    }
    if (!isRecord(repair.replacement)) {
      issues.push(baseDiagnostic(
        "REPLACEMENT_INVALID_TYPE",
        target,
        {
          receivedType: safeRepairValueType(repair.replacement),
          expectedType: "object",
        },
      ));
      continue;
    }
    const replacement = repair.replacement;
    if (!hasOnlyKeys(replacement, replacementKeys)) {
      issues.push(baseDiagnostic(
        "REPLACEMENT_EXTRA_FIELDS",
        target,
        { receivedType: "object", expectedType: "text,sourceFactIds,kind" },
      ));
    }
    if (!Object.hasOwn(replacement, "text")) {
      issues.push(baseDiagnostic(
        "TEXT_MISSING",
        target,
        { receivedType: "undefined", expectedType: "string" },
      ));
    } else if (typeof replacement.text !== "string") {
      issues.push(baseDiagnostic(
        "TEXT_INVALID_TYPE",
        target,
        {
          receivedType: safeRepairValueType(replacement.text),
          expectedType: "string",
        },
      ));
    } else if (replacement.text.trim().length === 0) {
      issues.push(baseDiagnostic(
        "TEXT_EMPTY",
        target,
        { receivedType: "string", expectedType: "non_empty_string" },
      ));
    } else if (replacement.text.trim().length > 80) {
      issues.push(baseDiagnostic(
        "UNKNOWN_PATCH_VALIDATION_FAILURE",
        target,
        { receivedType: "string", expectedType: "string_max_80" },
      ));
    }
    if (!Object.hasOwn(replacement, "sourceFactIds")) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_IDS_MISSING",
        target,
        { receivedType: "undefined", expectedType: "array" },
      ));
    } else if (!Array.isArray(replacement.sourceFactIds)) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_IDS_INVALID_TYPE",
        target,
        {
          receivedType: safeRepairValueType(replacement.sourceFactIds),
          expectedType: "array",
        },
      ));
    } else if (
      replacement.sourceFactIds.some((id) =>
        typeof id !== "string" || id.trim().length === 0
      )
    ) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_IDS_INVALID_TYPE",
        target,
        {
          receivedType: "array",
          expectedType: "non_empty_string_array",
          sourceFactIdCount: replacement.sourceFactIds.length,
          sourceFactIdLimit: FACTUALITY_REPAIR_SOURCE_FACT_ID_LIMIT,
        },
      ));
    }
    if (!Object.hasOwn(replacement, "kind")) {
      issues.push(baseDiagnostic(
        "KIND_MISSING",
        target,
        {
          receivedType: "undefined",
          expectedType: expectedKindClass(target!),
          receivedKind: "unknown",
        },
      ));
    } else if (!fixedKinds.includes(
      replacement.kind as typeof fixedKinds[number],
    )) {
      issues.push(baseDiagnostic(
        "KIND_INVALID",
        target,
        {
          receivedType: safeRepairValueType(replacement.kind),
          expectedType: "fact|goal|format",
          expectedKindClass: target ? expectedKindClass(target) : null,
          receivedKind: "unknown",
        },
      ));
    }
  }

  if (issues.length > 0) {
    diagnostics.repairPatchStructureStatus = "failed";
    return finalizeDiagnostics(diagnostics, issues, targets);
  }
  diagnostics.repairPatchStructureStatus = "passed";

  const candidateOrder = new Map(
    candidateFacts.map((fact, index) => [fact.id, index]),
  );
  const candidateIds = new Set(candidateOrder.keys());
  for (const repair of repairs as Array<{
    targetId: string;
    action: "replace";
    replacement: {
      text: string;
      sourceFactIds: string[];
      kind: "fact" | "goal" | "format";
    };
  }>) {
    const target = targetById.get(repair.targetId)!;
    const ids = repair.replacement.sourceFactIds;
    diagnostics.repairMaximumSourceFactIdsObserved = Math.max(
      diagnostics.repairMaximumSourceFactIdsObserved ?? 0,
      ids.length,
    );
    const duplicateIds = duplicateCount(ids);
    const jdIds = ids.filter((id) => id.startsWith("J_REQ_")).length;
    const unknownIds = ids.filter((id) =>
      !id.startsWith("J_REQ_") && !candidateIds.has(id)
    ).length;
    const orderMismatch = ids.some((id, index) =>
      index > 0 &&
      candidateOrder.get(ids[index - 1])! >= candidateOrder.get(id)!
    );
    diagnostics.repairDuplicateSourceFactIdCount += duplicateIds;
    diagnostics.repairUnknownSourceFactIdCount += unknownIds;
    diagnostics.repairJdRequirementSourceIdCount += jdIds;
    if (orderMismatch) {
      diagnostics.repairSourceFactIdsOrderMismatchCount += 1;
    }
    const sharedCounts = {
      sourceFactIdCount: ids.length,
      sourceFactIdLimit: FACTUALITY_REPAIR_SOURCE_FACT_ID_LIMIT,
      duplicateSourceFactIdCount: duplicateIds,
      unknownSourceFactIdCount: unknownIds,
      jdRequirementSourceIdCount: jdIds,
    };
    if (ids.length > FACTUALITY_REPAIR_SOURCE_FACT_ID_LIMIT) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_IDS_TOO_MANY",
        target,
        sharedCounts,
      ));
    }
    if (duplicateIds > 0) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_IDS_DUPLICATED",
        target,
        sharedCounts,
      ));
    }
    if (orderMismatch) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_IDS_ORDER_MISMATCH",
        target,
        sharedCounts,
      ));
    }
    if (unknownIds > 0) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_ID_UNKNOWN",
        target,
        sharedCounts,
      ));
    }
    if (jdIds > 0) {
      issues.push(baseDiagnostic(
        "SOURCE_FACT_ID_IS_JD_REQUIREMENT",
        target,
        sharedCounts,
      ));
    }
    const receivedKind = safeReceivedKind(repair.replacement.kind);
    const kindDetails = {
      expectedKindClass: expectedKindClass(target),
      receivedKind,
      sourceFactIdCount: ids.length,
      sourceFactIdLimit: FACTUALITY_REPAIR_SOURCE_FACT_ID_LIMIT,
    };
    if (
      repair.replacement.kind !== "fact" &&
      ids.length > 0
    ) {
      issues.push(baseDiagnostic(
        "GOAL_OR_FORMAT_HAS_FACT_IDS",
        target,
        kindDetails,
      ));
    }
    if (
      target.current.kind === "goal" &&
      repair.replacement.kind !== "goal"
    ) {
      issues.push(baseDiagnostic(
        "KIND_NOT_ALLOWED_AT_TARGET",
        target,
        kindDetails,
      ));
    }
    if (
      target.current.kind === "format" &&
      repair.replacement.kind !== "format"
    ) {
      issues.push(baseDiagnostic(
        "KIND_NOT_ALLOWED_AT_TARGET",
        target,
        kindDetails,
      ));
    }
    if (
      target.locationKind === "section_line" &&
      target.current.kind === "fact" &&
      repair.replacement.kind !== "fact"
    ) {
      issues.push(baseDiagnostic(
        "SECTION_FACT_REPLACED_WITH_NONFACT",
        target,
        kindDetails,
      ));
    }
  }

  if (
    issues.length === 0 &&
    !factualityRepairPatchSchema.safeParse(value).success
  ) {
    issues.push(baseDiagnostic(
      "UNKNOWN_PATCH_VALIDATION_FAILURE",
      null,
    ));
  }
  diagnostics.repairPatchSemanticStatus =
    issues.length > 0 ? "failed" : "passed";
  return finalizeDiagnostics(diagnostics, issues, targets);
}

export function markRepairJsonFailure(
  expectedTargetCount: number,
  httpStatus: number | null,
) {
  const diagnostics = createEmptyFactualityRepairDiagnostics(
    expectedTargetCount,
  );
  diagnostics.repairHttpStatus = httpStatus;
  diagnostics.repairJsonStatus = "failed";
  return diagnostics;
}

export function markRepairEnvelopeFailure(
  expectedTargetCount: number,
  httpStatus: number | null,
) {
  const diagnostics = createEmptyFactualityRepairDiagnostics(
    expectedTargetCount,
  );
  diagnostics.repairHttpStatus = httpStatus;
  diagnostics.repairJsonStatus = "passed";
  diagnostics.repairEnvelopeStatus = "failed";
  diagnostics.repairDiagnosticIssueCount = 1;
  diagnostics.repairReportedDiagnosticIssueCount = 1;
  diagnostics.repairDiagnosticCategories = [
    "UNKNOWN_PATCH_VALIDATION_FAILURE",
  ];
  diagnostics.repairDiagnostics = [
    baseDiagnostic("UNKNOWN_PATCH_VALIDATION_FAILURE", null),
  ];
  return diagnostics;
}

export function markRepairApplicationPassed(
  diagnostics: FactualityRepairDiagnostics,
) {
  diagnostics.repairScopeStatus = "passed";
  diagnostics.repairApplyStatus = "passed";
  diagnostics.postRepairSchemaStatus = "passed";
}

export function markRepairScopeFailure(
  diagnostics: FactualityRepairDiagnostics,
) {
  diagnostics.repairScopeStatus = "failed";
  diagnostics.repairApplyStatus = "failed";
}

export function markPostRepairSchemaFailure(
  diagnostics: FactualityRepairDiagnostics,
) {
  diagnostics.repairApplyStatus = "failed";
  diagnostics.postRepairSchemaStatus = "failed";
}

export function markPostRepairFactuality(
  diagnostics: FactualityRepairDiagnostics,
  passed: boolean,
) {
  diagnostics.postRepairFactualityStatus = passed ? "passed" : "failed";
}
