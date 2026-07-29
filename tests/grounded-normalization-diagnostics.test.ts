import { describe, expect, it } from "vitest";
import {
  assertGroundedNormalizationTopology,
  createUnknownGroundedNormalizationDiagnosticSummary,
  diagnoseGroundedNormalizationTopology,
  GroundedNormalizationDiagnosticError,
  MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES,
  MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_PATH_LENGTH,
  safeGroundedNormalizationDiagnosticMetadata,
} from "@/services/ai/grounded-normalization-diagnostics";
import { normalizeGroundedTailoredResume } from "@/services/ai/tailored-resume-grounded-normalizer";

function groundedText(text = "candidate-private-text") {
  return {
    text,
    sourceFactIds: ["F_SKL_001"],
    kind: "fact",
  };
}

function fixture() {
  return {
    sections: [
      {
        type: "summary",
        title: "candidate-private-title",
        lines: [groundedText()],
        order: 0,
      },
    ],
    rewriteExplanation: [],
    changedSections: [],
    missingFields: [],
    improvementQuestions: [],
    qualityWarnings: [],
    applicationMaterials: {
      selfIntroduction: [groundedText()],
      applicationEmail: [groundedText()],
      recruiterMessage: [groundedText()],
    },
  };
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

describe("safe grounded normalization topology diagnostics", () => {
  it("reports a root unknown key without retaining its name or value", () => {
    const input = { ...fixture(), confidentialRootName: "root-secret-value" };
    const summary = diagnoseGroundedNormalizationTopology(input);
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        nodePath: "$",
        category: "UNKNOWN_KEYS_AT_NODE",
        unknownKeyCount: 1,
        unknownValueTypeCounts: { string: 1 },
      }),
    );
    expect(serialized(summary)).not.toContain("confidentialRootName");
    expect(serialized(summary)).not.toContain("root-secret-value");
  });

  it("reports applicationMaterials unknown keys only as aggregate types", () => {
    const input = fixture();
    Object.assign(input.applicationMaterials, {
      confidentialMaterialName: { nested: "material-secret-value" },
    });
    const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
      (item) => item.nodePath === "$.applicationMaterials",
    );
    expect(issue).toMatchObject({
      category: "UNKNOWN_KEYS_AT_NODE",
      unknownKeyCount: 1,
      unknownValueTypeCounts: { object: 1 },
    });
    expect(serialized(issue)).not.toContain("confidentialMaterialName");
    expect(serialized(issue)).not.toContain("material-secret-value");
    expect(serialized(issue)).not.toContain("nested");
  });

  it("reports a section unknown key at a fixed indexed path", () => {
    const input = fixture();
    Object.assign(input.sections[0], {
      confidentialSectionName: ["section-secret-value"],
    });
    const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
      (item) => item.nodePath === "$.sections[0]",
    );
    expect(issue).toMatchObject({
      category: "UNKNOWN_KEYS_AT_NODE",
      unknownKeyCount: 1,
      unknownValueTypeCounts: { array: 1 },
    });
    expect(serialized(issue)).not.toContain("confidentialSectionName");
    expect(serialized(issue)).not.toContain("section-secret-value");
  });

  it("reports a section line unknown key without model content", () => {
    const input = fixture();
    Object.assign(input.sections[0].lines[0], {
      confidentialLineName: 314,
    });
    const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
      (item) => item.nodePath === "$.sections[0].lines[0]",
    );
    expect(issue).toMatchObject({
      category: "UNKNOWN_KEYS_AT_NODE",
      unknownKeyCount: 1,
      unknownValueTypeCounts: { number: 1 },
    });
    expect(serialized(issue)).not.toContain("confidentialLineName");
    expect(serialized(issue)).not.toContain("candidate-private-text");
  });

  it("reports application material item unknown keys at a fixed path", () => {
    const input = fixture();
    Object.assign(input.applicationMaterials.applicationEmail[0], {
      confidentialEmailName: true,
    });
    const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
      (item) =>
        item.nodePath === "$.applicationMaterials.applicationEmail[0]",
    );
    expect(issue).toMatchObject({
      category: "UNKNOWN_KEYS_AT_NODE",
      unknownValueTypeCounts: { boolean: 1 },
    });
    expect(serialized(issue)).not.toContain("confidentialEmailName");
  });

  it("reports safe known keys that are misplaced at the root", () => {
    const input = { ...fixture(), text: "private-known-key-value" };
    const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
      (item) => item.category === "KNOWN_KEY_AT_WRONG_LEVEL",
    );
    expect(issue?.misplacedKnownKeys).toEqual(["text"]);
    expect(serialized(issue)).not.toContain("private-known-key-value");
  });

  it.each([
    [
      "$.applicationMaterials",
      (input: ReturnType<typeof fixture>) =>
        Object.assign(input.applicationMaterials, {
          lines: "private-misplaced-value",
        }),
      ["lines"],
    ],
    [
      "$.sections[0]",
      (input: ReturnType<typeof fixture>) =>
        Object.assign(input.sections[0], {
          applicationMaterials: "private-misplaced-value",
        }),
      ["applicationMaterials"],
    ],
    [
      "$.sections[0].lines[0]",
      (input: ReturnType<typeof fixture>) =>
        Object.assign(input.sections[0].lines[0], {
          title: "private-misplaced-value",
        }),
      ["title"],
    ],
  ])(
    "reports known keys at the wrong fixed node %s",
    (nodePath, alter, expectedKeys) => {
      const input = fixture();
      alter(input);
      const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
        (item) => item.nodePath === nodePath,
      );
      expect(issue).toMatchObject({
        category: "KNOWN_KEY_AT_WRONG_LEVEL",
        misplacedKnownKeys: expectedKeys,
      });
      expect(serialized(issue)).not.toContain("private-misplaced-value");
    },
  );

  it("detects a one-level extra wrapper without retaining its name", () => {
    const input = {
      confidentialWrapperName: {
        resume: { sections: fixture().sections },
        applicationMaterials: fixture().applicationMaterials,
        confidentialNestedName: "nested-secret-value",
      },
    };
    const summary = diagnoseGroundedNormalizationTopology(input);
    expect(summary.issues).toEqual([
      expect.objectContaining({
        nodePath: "$",
        category: "EXTRA_WRAPPER_OBJECT",
        misplacedKnownKeys: ["applicationMaterials", "resume"],
        unknownKeyCount: 1,
        unknownValueTypeCounts: { object: 1 },
      }),
    ]);
    expect(serialized(summary)).not.toContain("confidentialWrapperName");
    expect(serialized(summary)).not.toContain("confidentialNestedName");
    expect(serialized(summary)).not.toContain("nested-secret-value");
  });

  it("rejects a multi-level unknown wrapper without traversing it", () => {
    const input = {
      confidentialOuterName: {
        confidentialInnerName: {
          resume: fixture(),
          applicationMaterials: fixture().applicationMaterials,
        },
      },
    };
    const summary = diagnoseGroundedNormalizationTopology(input);
    expect(summary.issues).toEqual([
      expect.objectContaining({
        nodePath: "$",
        category: "UNKNOWN_KEYS_AT_NODE",
        unknownKeyCount: 1,
        unknownValueTypeCounts: { object: 1 },
      }),
    ]);
    expect(() => assertGroundedNormalizationTopology(input)).toThrow(
      GroundedNormalizationDiagnosticError,
    );
    expect(serialized(summary)).not.toContain("confidentialOuterName");
    expect(serialized(summary)).not.toContain("confidentialInnerName");
  });

  it("marks resume as a diagnostic-only unsupported envelope", () => {
    const summary = diagnoseGroundedNormalizationTopology({
      ...fixture(),
      resume: {
        sections: fixture().sections,
        confidentialResumeName: "resume-secret-value",
      },
    });
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        nodePath: "$",
        category: "KNOWN_KEY_AT_WRONG_LEVEL",
        misplacedKnownKeys: ["resume"],
      }),
    );
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        nodePath: "$.resume",
        category: "UNSUPPORTED_STRUCTURE",
        misplacedKnownKeys: ["sections"],
        unknownKeyCount: 1,
      }),
    );
    expect(serialized(summary)).not.toContain("confidentialResumeName");
    expect(serialized(summary)).not.toContain("resume-secret-value");
  });

  it.each([
    [null, "EXPECTED_OBJECT_RECEIVED_OTHER"],
    ["not-an-object", "EXPECTED_OBJECT_RECEIVED_OTHER"],
    [[], "EXPECTED_OBJECT_RECEIVED_OTHER"],
  ])("classifies a non-object root: %j", (value, category) => {
    expect(diagnoseGroundedNormalizationTopology(value).issues[0].category)
      .toBe(category);
  });

  it("classifies expected arrays that receive another type", () => {
    const input = { ...fixture(), sections: { private: "value" } };
    expect(diagnoseGroundedNormalizationTopology(input).issues).toContainEqual(
      expect.objectContaining({
        nodePath: "$.sections",
        category: "EXPECTED_ARRAY_RECEIVED_OTHER",
      }),
    );
  });

  it("classifies an unknown section position without changing acceptance", () => {
    const input = fixture();
    input.sections = Array.from({ length: 7 }, (_, index) => ({
      type: "summary",
      title: "private-title",
      lines: [groundedText()],
      order: index,
    }));
    expect(diagnoseGroundedNormalizationTopology(input).issues).toContainEqual(
      expect.objectContaining({
        nodePath: "$.sections[6]",
        category: "UNKNOWN_SECTION_POSITION",
      }),
    );
    expect(() => normalizeGroundedTailoredResume(input)).not.toThrow();
  });

  it("reports all three missing required application material keys safely", () => {
    const input = fixture();
    (input as unknown as { applicationMaterials: Record<string, unknown> })
      .applicationMaterials = {
      confidentialMaterialName: "private-material-value",
    };
    const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
      (item) => item.nodePath === "$.applicationMaterials",
    );
    expect(issue?.missingAllowedKeys).toEqual([
      "applicationEmail",
      "recruiterMessage",
      "selfIntroduction",
    ]);
    expect(serialized(issue)).not.toContain("confidentialMaterialName");
    expect(serialized(issue)).not.toContain("private-material-value");
  });

  it("counts every safe structural value type without values", () => {
    const input = {
      ...fixture(),
      privateUndefined: undefined,
      privateNull: null,
      privateString: "type-secret",
      privateNumber: 1,
      privateBoolean: false,
      privateArray: ["array-secret"],
      privateObject: { nested: "object-secret" },
      privateUnknown: Symbol("symbol-secret"),
    };
    const issue = diagnoseGroundedNormalizationTopology(input).issues.find(
      (item) => item.nodePath === "$" && item.category === "UNKNOWN_KEYS_AT_NODE",
    );
    expect(issue?.unknownValueTypeCounts).toEqual({
      undefined: 1,
      null: 1,
      string: 1,
      number: 1,
      boolean: 1,
      array: 1,
      object: 1,
      unknown: 1,
    });
    const output = serialized(issue);
    for (const secret of [
      "type-secret",
      "array-secret",
      "nested",
      "object-secret",
      "symbol-secret",
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it("caps reports at 20 while retaining the actual issue count", () => {
    const input = fixture();
    input.sections = Array.from({ length: 30 }, (_, index) => ({
      type: "summary",
      title: "private-title",
      lines: [groundedText()],
      order: index,
      [`confidentialSectionName${index}`]: `private-value-${index}`,
    }));
    const first = diagnoseGroundedNormalizationTopology(input);
    const second = diagnoseGroundedNormalizationTopology(input);
    expect(first.issueCount).toBeGreaterThan(
      MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES,
    );
    expect(first.issues).toHaveLength(
      MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES,
    );
    expect(first.truncated).toBe(true);
    expect(first).toEqual(second);
    expect(serialized(first)).not.toContain("confidentialSectionName");
    expect(serialized(first)).not.toContain("private-value");
  });

  it("still blocks atomically when the blocking issue sorts after the report cap", () => {
    const input = fixture();
    input.sections = Array.from({ length: 30 }, (_, index) => ({
      type: "summary",
      title: "private-title",
      lines: [groundedText()],
      order: index,
    }));
    Object.assign(input.sections[9].lines[0], {
      privateLateName: "private-late-value",
    });
    const summary = diagnoseGroundedNormalizationTopology(input);
    expect(summary.truncated).toBe(true);
    expect(summary.issues).toHaveLength(
      MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_ISSUES,
    );
    expect(summary.issues.some(
      (issue) => issue.category === "UNKNOWN_KEYS_AT_NODE",
    )).toBe(false);
    const before = structuredClone(input);
    expect(() => normalizeGroundedTailoredResume(input)).toThrow(
      GroundedNormalizationDiagnosticError,
    );
    expect(input).toEqual(before);
  });

  it("uses only bounded fixed paths", () => {
    const input = fixture();
    Object.assign(input.applicationMaterials.recruiterMessage[0], {
      privateName: "private-value",
    });
    const summary = diagnoseGroundedNormalizationTopology(input);
    expect(summary.issues.every(
      (issue) =>
        issue.nodePath.startsWith("$") &&
        issue.nodePath.length <=
          MAX_GROUNDED_NORMALIZATION_DIAGNOSTIC_PATH_LENGTH,
    )).toBe(true);
  });

  it("throws the full safe summary for an unsupported field", () => {
    const input = { ...fixture(), privateName: "private-value" };
    try {
      assertGroundedNormalizationTopology(input);
      throw new Error("expected diagnostic error");
    } catch (error) {
      expect(error).toBeInstanceOf(GroundedNormalizationDiagnosticError);
      const diagnosticError = error as GroundedNormalizationDiagnosticError;
      expect(diagnosticError.code).toBe("GROUNDED_NORMALIZATION_FAILED");
      expect(diagnosticError.message).toBe(
        "Grounded output contains an unsupported field.",
      );
      expect(diagnosticError.diagnosticSummary.issueCount).toBe(1);
      expect(serialized(diagnosticError)).not.toContain("privateName");
      expect(serialized(diagnosticError)).not.toContain("private-value");
    }
  });

  it("provides a generic diagnostic for an unknown normalization failure", () => {
    expect(createUnknownGroundedNormalizationDiagnosticSummary()).toMatchObject({
      diagnosticVersion: 1,
      issueCount: 1,
      truncated: false,
      issues: [
        {
          nodePath: "$",
          category: "UNKNOWN_NORMALIZATION_FAILURE",
          unknownKeyCount: 0,
        },
      ],
    });
  });

  it("keeps diagnostics atomic when a late unknown field is found", () => {
    const input = fixture();
    input.sections[0].type = "private-wrong-type";
    input.sections[0].lines[0].sourceFactIds = [
      "F_SKL_001",
      "F_SKL_001",
    ];
    Object.assign(input.applicationMaterials.recruiterMessage[0], {
      privateLateName: "private-late-value",
    });
    const before = structuredClone(input);
    expect(() => normalizeGroundedTailoredResume(input)).toThrow(
      GroundedNormalizationDiagnosticError,
    );
    expect(input).toEqual(before);
  });

  it("does not change successful normalization behavior", () => {
    const input = fixture();
    input.sections[0].type = "projects";
    input.sections[0].lines[0].sourceFactIds = [
      "F_SKL_001",
      "F_SKL_001",
    ];
    const result = normalizeGroundedTailoredResume(input);
    expect(
      (result.normalized as ReturnType<typeof fixture>).sections[0].type,
    ).toBe("summary");
    expect(
      (result.normalized as ReturnType<typeof fixture>).sections[0].lines[0]
        .sourceFactIds,
    ).toEqual(["F_SKL_001"]);
    expect(result.summary).toMatchObject({
      groundedNormalizationApplied: true,
      canonicalizedSectionTypes: 1,
      deduplicatedFactIdCount: 1,
    });
  });

  it("flattens only safe aggregate metadata", () => {
    const summary = diagnoseGroundedNormalizationTopology({
      ...fixture(),
      privateName: "private-value",
      text: "known-but-private-value",
    });
    const metadata = safeGroundedNormalizationDiagnosticMetadata(summary);
    expect(metadata).toMatchObject({
      normalizationDiagnosticVersion: 1,
      normalizationIssueCount: 2,
      normalizationReportedIssueCount: 2,
      normalizationIssuesTruncated: false,
      normalizationNodePaths: ["$"],
      normalizationIssueCategories: [
        "KNOWN_KEY_AT_WRONG_LEVEL",
        "UNKNOWN_KEYS_AT_NODE",
      ],
      normalizationMisplacedKnownKeys: ["text"],
      normalizationUnknownKeyCount: 1,
      normalizationUnknownValueTypeCounts: { string: 1 },
      groundedNormalizationDiagnosticSummary: summary,
    });
    expect(serialized(metadata)).not.toContain("privateName");
    expect(serialized(metadata)).not.toContain("private-value");
    expect(serialized(metadata)).not.toContain("known-but-private-value");
  });
});
