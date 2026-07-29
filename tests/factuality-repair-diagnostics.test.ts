import { describe, expect, it } from "vitest";
import type { CandidateFact } from "@/services/ai/candidate-fact-registry";
import {
  diagnoseFactualityRepairPatch,
  markPostRepairFactuality,
  markPostRepairSchemaFailure,
  markRepairApplicationPassed,
  markRepairEnvelopeFailure,
  markRepairJsonFailure,
  markRepairScopeFailure,
  safeRepairValueType,
} from "@/services/ai/factuality-repair-diagnostics";
import type {
  FactualityRepairPatch,
  FactualityRepairTarget,
} from "@/services/ai/tailored-resume-factuality-repair";

const facts: CandidateFact[] = Array.from({ length: 10 }, (_, index) => ({
  id: `F_SKL_${String(index + 1).padStart(3, "0")}`,
  category: "skill" as const,
  text: `SAFE_CANDIDATE_FACT_${index + 1}`,
  canonicalTerms: [`safe_term_${index + 1}`],
}));

const targets: FactualityRepairTarget[] = [
  {
    targetId: "T1",
    path: "sections.0.lines.0",
    categories: ["JD_REQUIREMENT_AS_FACT"],
    locationKind: "section_line",
    sectionType: "summary",
    removalAllowed: false,
    current: {
      text: "PRIVATE_ORIGINAL_T1",
      sourceFactIds: ["F_SKL_001"],
      kind: "fact",
    },
  },
  {
    targetId: "T2",
    path: "sections.5.lines.0",
    categories: ["JD_REQUIREMENT_AS_FACT"],
    locationKind: "section_line",
    sectionType: "others",
    removalAllowed: false,
    current: {
      text: "PRIVATE_ORIGINAL_T2",
      sourceFactIds: ["F_SKL_002"],
      kind: "fact",
    },
  },
  {
    targetId: "T3",
    path: "applicationMaterials.selfIntroduction.0",
    categories: ["JD_REQUIREMENT_AS_FACT"],
    locationKind: "self_introduction",
    sectionType: null,
    removalAllowed: false,
    current: {
      text: "PRIVATE_ORIGINAL_T3",
      sourceFactIds: ["F_SKL_003"],
      kind: "fact",
    },
  },
  {
    targetId: "T4",
    path: "applicationMaterials.applicationEmail.0",
    categories: ["JD_REQUIREMENT_AS_FACT"],
    locationKind: "application_email",
    sectionType: null,
    removalAllowed: false,
    current: {
      text: "PRIVATE_ORIGINAL_T4",
      sourceFactIds: [],
      kind: "goal",
    },
  },
  {
    targetId: "T5",
    path: "applicationMaterials.recruiterMessage.0",
    categories: ["MISSING_FACT_SOURCE"],
    locationKind: "recruiter_message",
    sectionType: null,
    removalAllowed: false,
    current: {
      text: "PRIVATE_ORIGINAL_T5",
      sourceFactIds: [],
      kind: "format",
    },
  },
];

function validPatch(): FactualityRepairPatch {
  return {
    repairs: [
      {
        targetId: "T1",
        action: "replace",
        replacement: {
          text: "SAFE_REPLACEMENT_ONE",
          sourceFactIds: ["F_SKL_001"],
          kind: "fact",
        },
      },
      {
        targetId: "T2",
        action: "replace",
        replacement: {
          text: "SAFE_REPLACEMENT_TWO",
          sourceFactIds: ["F_SKL_002"],
          kind: "fact",
        },
      },
      {
        targetId: "T3",
        action: "replace",
        replacement: {
          text: "SAFE_FUTURE_GOAL",
          sourceFactIds: [],
          kind: "goal",
        },
      },
      {
        targetId: "T4",
        action: "replace",
        replacement: {
          text: "SAFE_FUTURE_PLAN",
          sourceFactIds: [],
          kind: "goal",
        },
      },
      {
        targetId: "T5",
        action: "replace",
        replacement: {
          text: "SAFE_FORMAT_LABEL",
          sourceFactIds: [],
          kind: "format",
        },
      },
    ],
  };
}

function categories(value: unknown) {
  return diagnoseFactualityRepairPatch(value, targets, facts)
    .repairDiagnosticCategories;
}

describe("factuality repair pipeline stage diagnostics", () => {
  it("represents JSON failure without reaching later stages", () => {
    expect(markRepairJsonFailure(5, 200)).toMatchObject({
      repairHttpStatus: 200,
      repairJsonStatus: "failed",
      repairEnvelopeStatus: "not_reached",
      repairTargetCoverageStatus: "not_reached",
      repairPatchStructureStatus: "not_reached",
      repairPatchSemanticStatus: "not_reached",
      repairApplyStatus: "not_reached",
    });
  });

  it("represents envelope failure after JSON passes", () => {
    expect(markRepairEnvelopeFailure(5, 200)).toMatchObject({
      repairJsonStatus: "passed",
      repairEnvelopeStatus: "failed",
      repairTargetCoverageStatus: "not_reached",
      repairPatchStructureStatus: "not_reached",
      repairPatchSemanticStatus: "not_reached",
      repairDiagnosticIssueCount: 1,
    });
  });

  it("stops stages after target coverage failure", () => {
    const value = validPatch();
    value.repairs.pop();
    expect(diagnoseFactualityRepairPatch(value, targets, facts)).toMatchObject({
      repairEnvelopeStatus: "passed",
      repairTargetCoverageStatus: "failed",
      repairPatchStructureStatus: "not_reached",
      repairPatchSemanticStatus: "not_reached",
      repairApplyStatus: "not_reached",
    });
  });

  it("stops semantics after patch structure failure", () => {
    const value = validPatch() as unknown as {
      repairs: Array<Record<string, unknown>>;
    };
    delete value.repairs[0].action;
    expect(diagnoseFactualityRepairPatch(value, targets, facts)).toMatchObject({
      repairTargetCoverageStatus: "passed",
      repairPatchStructureStatus: "failed",
      repairPatchSemanticStatus: "not_reached",
      repairApplyStatus: "not_reached",
    });
  });

  it("reports semantic failure before scope or application", () => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = ["F_UNKNOWN_999"];
    expect(diagnoseFactualityRepairPatch(value, targets, facts)).toMatchObject({
      repairPatchStructureStatus: "passed",
      repairPatchSemanticStatus: "failed",
      repairScopeStatus: "not_reached",
      repairApplyStatus: "not_reached",
      repairAcceptedPatchCount: 0,
    });
  });

  it("marks scope failure without claiming application", () => {
    const result = diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    );
    markRepairScopeFailure(result);
    expect(result).toMatchObject({
      repairPatchSemanticStatus: "passed",
      repairScopeStatus: "failed",
      repairApplyStatus: "failed",
      postRepairSchemaStatus: "not_reached",
    });
  });

  it("marks successful application and post-repair schema", () => {
    const result = diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    );
    markRepairApplicationPassed(result);
    expect(result).toMatchObject({
      repairScopeStatus: "passed",
      repairApplyStatus: "passed",
      postRepairSchemaStatus: "passed",
    });
  });

  it("marks post-repair schema failure", () => {
    const result = diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    );
    markPostRepairSchemaFailure(result);
    expect(result).toMatchObject({
      repairApplyStatus: "failed",
      postRepairSchemaStatus: "failed",
      postRepairFactualityStatus: "not_reached",
    });
  });

  it.each([
    [false, "failed"],
    [true, "passed"],
  ] as const)("marks post-repair factuality %s", (passed, expected) => {
    const result = diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    );
    markRepairApplicationPassed(result);
    markPostRepairFactuality(result, passed);
    expect(result.postRepairFactualityStatus).toBe(expected);
  });

  it("passes all pre-application stages for a valid patch", () => {
    expect(diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    )).toMatchObject({
      repairJsonStatus: "passed",
      repairEnvelopeStatus: "passed",
      repairTargetCoverageStatus: "passed",
      repairPatchStructureStatus: "passed",
      repairPatchSemanticStatus: "passed",
      repairExpectedTargetCount: 5,
      repairReceivedCount: 5,
      repairAcceptedPatchCount: 5,
    });
  });
});

describe("target coverage diagnostics", () => {
  it("passes five expected targets and five repairs", () => {
    const result = diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    );
    expect(result).toMatchObject({
      repairExpectedTargetCount: 5,
      repairReceivedCount: 5,
      repairAcceptedPatchCount: 5,
      repairMissingTargetIds: [],
      repairUnknownTargetCount: 0,
      repairDuplicateTargetIds: [],
      repairTargetOrderMatches: true,
    });
  });

  it("reports one missing fixed target", () => {
    const value = validPatch();
    value.repairs.pop();
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairMissingTargetIds).toEqual(["T5"]);
    expect(result.repairDiagnosticCategories).toEqual([
      "REPAIR_COUNT_MISMATCH",
      "TARGET_ID_MISSING",
    ]);
  });

  it("counts an unknown target without storing its name", () => {
    const value = validPatch();
    value.repairs[4].targetId = "PRIVATE_UNKNOWN_TARGET";
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairUnknownTargetCount).toBe(1);
    expect(result.repairMissingTargetIds).toEqual(["T5"]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_UNKNOWN_TARGET");
  });

  it("reports duplicate legal target IDs", () => {
    const value = validPatch();
    value.repairs[4].targetId = "T1";
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairDuplicateTargetIds).toEqual(["T1"]);
    expect(result.repairMissingTargetIds).toEqual(["T5"]);
  });

  it("records order mismatch without changing the existing acceptance rule", () => {
    const value = validPatch();
    [value.repairs[0], value.repairs[1]] = [
      value.repairs[1],
      value.repairs[0],
    ];
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairTargetOrderMatches).toBe(false);
    expect(result.repairDiagnosticCategories).not.toContain(
      "TARGET_ORDER_MISMATCH",
    );
    expect(result.repairAcceptedPatchCount).toBe(5);
  });

  it("keeps received and accepted counts separate", () => {
    const value = validPatch();
    value.repairs.pop();
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairReceivedCount).toBe(4);
    expect(result.repairAcceptedPatchCount).toBe(0);
  });
});

describe("per-patch structural diagnostics", () => {
  it.each([
    ["missing action", (patch: Record<string, unknown>) => delete patch.action, "ACTION_MISSING"],
    ["non-string action", (patch: Record<string, unknown>) => { patch.action = 42; }, "ACTION_INVALID"],
    ["non-replace action", (patch: Record<string, unknown>) => { patch.action = "remove"; }, "ACTION_INVALID"],
    ["missing replacement", (patch: Record<string, unknown>) => delete patch.replacement, "REPLACEMENT_MISSING"],
    ["string replacement", (patch: Record<string, unknown>) => { patch.replacement = "PRIVATE"; }, "REPLACEMENT_INVALID_TYPE"],
  ])("reports %s", (_name, mutate, category) => {
    const value = validPatch() as unknown as {
      repairs: Array<Record<string, unknown>>;
    };
    mutate(value.repairs[0]);
    expect(categories(value)).toContain(category);
  });

  it.each([
    ["extra replacement field", (replacement: Record<string, unknown>) => { replacement.extra = "PRIVATE"; }, "REPLACEMENT_EXTRA_FIELDS"],
    ["missing text", (replacement: Record<string, unknown>) => delete replacement.text, "TEXT_MISSING"],
    ["non-string text", (replacement: Record<string, unknown>) => { replacement.text = 42; }, "TEXT_INVALID_TYPE"],
    ["empty text", (replacement: Record<string, unknown>) => { replacement.text = "   "; }, "TEXT_EMPTY"],
    ["missing sourceFactIds", (replacement: Record<string, unknown>) => delete replacement.sourceFactIds, "SOURCE_FACT_IDS_MISSING"],
    ["non-array sourceFactIds", (replacement: Record<string, unknown>) => { replacement.sourceFactIds = "PRIVATE"; }, "SOURCE_FACT_IDS_INVALID_TYPE"],
    ["missing kind", (replacement: Record<string, unknown>) => delete replacement.kind, "KIND_MISSING"],
    ["invalid kind", (replacement: Record<string, unknown>) => { replacement.kind = "PRIVATE_KIND"; }, "KIND_INVALID"],
  ])("reports %s", (_name, mutate, category) => {
    const value = validPatch() as unknown as {
      repairs: Array<{ replacement: Record<string, unknown> }>;
    };
    mutate(value.repairs[0].replacement);
    expect(categories(value)).toContain(category);
  });

  it("collects multiple structural issues in one atomic result", () => {
    const value = validPatch() as unknown as {
      repairs: Array<Record<string, unknown>>;
    };
    delete value.repairs[0].action;
    value.repairs[0].replacement = {
      text: 42,
      sourceFactIds: "PRIVATE",
    };
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairDiagnosticCategories).toEqual(expect.arrayContaining([
      "ACTION_MISSING",
      "TEXT_INVALID_TYPE",
      "SOURCE_FACT_IDS_INVALID_TYPE",
      "KIND_MISSING",
    ]));
    expect(result.repairAcceptedPatchCount).toBe(0);
  });
});

describe("sourceFactIds safety diagnostics", () => {
  it("allows zero IDs for goal and format", () => {
    const result = diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    );
    expect(result.repairPatchSemanticStatus).toBe("passed");
  });

  it.each([1, 8])("allows %i ordered IDs for fact", (count) => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = facts
      .slice(0, count)
      .map((fact) => fact.id);
    expect(diagnoseFactualityRepairPatch(value, targets, facts)
      .repairPatchSemanticStatus).toBe("passed");
  });

  it("reports nine IDs without storing them", () => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = facts
      .slice(0, 9)
      .map((fact) => fact.id);
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairMaximumSourceFactIdsObserved).toBe(9);
    expect(result.repairDiagnosticCategories).toContain(
      "SOURCE_FACT_IDS_TOO_MANY",
    );
    expect(result.repairDiagnostics[0].sourceFactIdLimit).toBe(8);
  });

  it("reports duplicate IDs by count only", () => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = [
      "F_SKL_001",
      "F_SKL_001",
    ];
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairDuplicateSourceFactIdCount).toBeGreaterThan(0);
    expect(result.repairDiagnosticCategories).toContain(
      "SOURCE_FACT_IDS_DUPLICATED",
    );
  });

  it("reports registry-order mismatch", () => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = [
      "F_SKL_002",
      "F_SKL_001",
    ];
    expect(categories(value)).toContain("SOURCE_FACT_IDS_ORDER_MISMATCH");
  });

  it("reports unknown IDs by count without storing the ID", () => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = ["F_PRIVATE_UNKNOWN"];
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairUnknownSourceFactIdCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain("F_PRIVATE_UNKNOWN");
  });

  it("reports JD IDs by count without storing the ID", () => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = ["J_REQ_PRIVATE"];
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairJdRequirementSourceIdCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain("J_REQ_PRIVATE");
  });

  it("collects multiple source ID problems together", () => {
    const value = validPatch();
    value.repairs[0].replacement.sourceFactIds = [
      "F_SKL_002",
      "F_SKL_001",
      "F_SKL_001",
      "F_PRIVATE_UNKNOWN",
      "J_REQ_PRIVATE",
    ];
    expect(categories(value)).toEqual(expect.arrayContaining([
      "SOURCE_FACT_IDS_DUPLICATED",
      "SOURCE_FACT_IDS_ORDER_MISMATCH",
      "SOURCE_FACT_ID_UNKNOWN",
      "SOURCE_FACT_ID_IS_JD_REQUIREMENT",
    ]));
  });
});

describe("kind semantics and atomic safety", () => {
  it("allows section fact to remain fact", () => {
    expect(diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    ).repairPatchSemanticStatus).toBe("passed");
  });

  it.each(["goal", "format"] as const)(
    "rejects section fact replaced with %s",
    (kind) => {
      const value = validPatch();
      value.repairs[0].replacement = {
        text: "SAFE_NONFACT",
        sourceFactIds: [],
        kind,
      };
      expect(categories(value)).toContain(
        "SECTION_FACT_REPLACED_WITH_NONFACT",
      );
    },
  );

  it("allows an application-material fact to become a goal", () => {
    expect(diagnoseFactualityRepairPatch(
      validPatch(),
      targets,
      facts,
    ).repairPatchSemanticStatus).toBe("passed");
  });

  it.each(["goal", "format"] as const)(
    "rejects %s carrying fact IDs",
    (kind) => {
      const value = validPatch();
      const index = kind === "goal" ? 2 : 4;
      value.repairs[index].replacement.sourceFactIds = ["F_SKL_001"];
      expect(categories(value)).toContain(
        "GOAL_OR_FORMAT_HAS_FACT_IDS",
      );
    },
  );

  it("rejects changing an existing goal target into fact", () => {
    const value = validPatch();
    value.repairs[3].replacement = {
      text: "SAFE_FACT",
      sourceFactIds: ["F_SKL_001"],
      kind: "fact",
    };
    expect(categories(value)).toContain("KIND_NOT_ALLOWED_AT_TARGET");
  });

  it("atomically accepts zero patches when one of five is invalid", () => {
    const value = validPatch();
    value.repairs[4].replacement.sourceFactIds = ["F_SKL_001"];
    const inputSnapshot = structuredClone(value);
    const targetSnapshot = structuredClone(targets);
    const result = diagnoseFactualityRepairPatch(value, targets, facts);
    expect(result.repairReceivedCount).toBe(5);
    expect(result.repairAcceptedPatchCount).toBe(0);
    expect(result.repairApplyStatus).toBe("not_reached");
    expect(result.postRepairFactualityStatus).toBe("not_reached");
    expect(value).toEqual(inputSnapshot);
    expect(targets).toEqual(targetSnapshot);
  });

  it("caps and stably sorts reported diagnostics at 30", () => {
    const extendedTargets = [
      ...targets,
      {
        ...structuredClone(targets[4]),
        targetId: "T6",
        path: "applicationMaterials.recruiterMessage.1",
      },
    ];
    const value = validPatch() as unknown as {
      repairs: Array<Record<string, unknown>>;
    };
    value.repairs.push({
      ...structuredClone(value.repairs[4]),
      targetId: "T6",
    });
    for (const repair of value.repairs) {
      repair.action = 42;
      repair.extra = "PRIVATE_EXTRA";
      repair.replacement = {
        text: " ",
        sourceFactIds: "PRIVATE_IDS",
        kind: "PRIVATE_KIND",
        extra: "PRIVATE_EXTRA",
      };
    }
    const first = diagnoseFactualityRepairPatch(
      value,
      extendedTargets,
      facts,
    );
    const second = diagnoseFactualityRepairPatch(
      value,
      extendedTargets,
      facts,
    );
    expect(first.repairDiagnosticIssueCount).toBeGreaterThan(30);
    expect(first.repairReportedDiagnosticIssueCount).toBe(30);
    expect(first.repairDiagnosticsTruncated).toBe(true);
    expect(first.repairDiagnostics).toEqual(second.repairDiagnostics);
  });

  it("never stores text, IDs, prompts, secrets, hashes, or encoded values", () => {
    const value = validPatch();
    value.repairs[0].replacement = {
      text: "PRIVATE_REPLACEMENT_TEXT",
      sourceFactIds: ["F_PRIVATE_UNKNOWN", "J_REQ_PRIVATE"],
      kind: "goal",
    };
    const serialized = JSON.stringify(
      diagnoseFactualityRepairPatch(value, targets, facts),
    );
    for (const forbidden of [
      "PRIVATE_REPLACEMENT_TEXT",
      "PRIVATE_ORIGINAL",
      "F_PRIVATE_UNKNOWN",
      "J_REQ_PRIVATE",
      "SAFE_CANDIDATE_FACT",
      "API Key",
      "Authorization",
      "reasoning_content",
      "Prompt",
      "Response",
      "base64",
      "hash",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("safe received types", () => {
  it.each([
    [undefined, "undefined"],
    [null, "null"],
    ["value", "string"],
    [1, "number"],
    [true, "boolean"],
    [[], "array"],
    [{}, "object"],
    [Symbol("safe"), "unknown"],
  ] as const)("classifies without preserving values", (value, expected) => {
    expect(safeRepairValueType(value)).toBe(expected);
  });
});
