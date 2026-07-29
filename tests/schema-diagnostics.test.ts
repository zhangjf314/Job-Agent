import { describe, expect, it } from "vitest";
import { z, type ZodIssue } from "zod";
import {
  maximumStoredSchemaIssues,
  safeSchemaDiagnosticMetadata,
  summarizeSchemaIssues,
} from "@/services/ai/schema-diagnostics";
import { groundedTailoredResumeSchema } from "@/services/ai/tailored-resume-grounding";

function diagnose(schema: z.ZodType, input: unknown, schemaName = "test_schema") {
  const parsed = schema.safeParse(input);
  if (parsed.success) throw new Error("Fixture must fail schema validation.");
  return summarizeSchemaIssues(schemaName, parsed.error.issues, input, schema);
}

function groundedFixture() {
  const claim = {
    text: "safe fixture",
    sourceFactIds: ["F_SKL_001"],
    kind: "fact",
  };
  return {
    sections: Array.from({ length: 4 }, (_, index) => ({
      type: index === 0 ? "summary" : "skills",
      title: `section ${index}`,
      lines: [claim],
      order: index,
    })),
    rewriteExplanation: [],
    changedSections: [],
    missingFields: [],
    improvementQuestions: [],
    qualityWarnings: [],
    applicationMaterials: {
      selfIntroduction: [claim],
      applicationEmail: [claim],
      recruiterMessage: [claim],
    },
  };
}

describe("safe schema diagnostics", () => {
  it("classifies missing required fields without storing a value", () => {
    expect(diagnose(z.object({ required: z.string() }), {})).toMatchObject({
      issues: [{
        category: "MISSING_REQUIRED_FIELD",
        path: "required",
        expectedType: "string",
        receivedType: "undefined",
      }],
    });
  });

  it.each([
    [z.object({ value: z.object({}) }), { value: "private" }, "object", "string"],
    [z.object({ value: z.array(z.string()) }), { value: "private" }, "array", "string"],
    [z.object({ value: z.object({}) }), { value: [] }, "object", "array"],
  ])(
    "classifies invalid type without retaining input",
    (schema, input, expectedType, receivedType) => {
      expect(diagnose(schema, input).issues[0]).toMatchObject({
        category: "INVALID_TYPE",
        expectedType,
        receivedType,
      });
    },
  );

  it("classifies enum and literal failures without storing received values", () => {
    const summary = diagnose(
      z.object({
        kind: z.enum(["fact", "goal", "format"]),
        version: z.literal("v1"),
      }),
      { kind: "PRIVATE_ENUM_VALUE", version: "PRIVATE_LITERAL_VALUE" },
    );
    expect(summary.issues.map((issue) => issue.category)).toEqual([
      "INVALID_ENUM",
      "INVALID_LITERAL",
    ]);
    expect(JSON.stringify(summary)).not.toContain("PRIVATE");
  });

  it("records only safe string and array size metadata", () => {
    const summary = diagnose(
      z.object({
        shortText: z.string().min(3),
        longText: z.string().max(3),
        smallArray: z.array(z.string()).min(2),
        largeArray: z.array(z.string()).max(1),
      }),
      {
        shortText: "x",
        longText: "private",
        smallArray: [],
        largeArray: ["private", "private"],
      },
    );
    expect(summary.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: "STRING_TOO_SHORT",
        minimum: 3,
        actualSize: 1,
      }),
      expect.objectContaining({
        category: "STRING_TOO_LONG",
        maximum: 3,
        actualSize: 7,
      }),
      expect.objectContaining({
        category: "ARRAY_TOO_SMALL",
        minimum: 2,
        actualSize: 0,
      }),
      expect.objectContaining({
        category: "ARRAY_TOO_LARGE",
        maximum: 1,
        actualSize: 2,
      }),
    ]));
    expect(JSON.stringify(summary)).not.toContain("private");
  });

  it("classifies numeric bounds without storing the actual number", () => {
    const summary = diagnose(
      z.object({ low: z.number().min(10), high: z.number().max(20) }),
      { low: 1, high: 99 },
    );
    expect(summary.issues).toEqual([
      expect.objectContaining({
        category: "NUMBER_TOO_LARGE",
        path: "high",
        maximum: 20,
        actualSize: null,
      }),
      expect.objectContaining({
        category: "NUMBER_TOO_SMALL",
        path: "low",
        minimum: 10,
        actualSize: null,
      }),
    ]);
    expect(JSON.stringify(summary)).not.toContain("99");
  });

  it("counts unknown keys without retaining their names", () => {
    const summary = diagnose(
      z.object({ allowed: z.string() }).strict(),
      {
        allowed: "safe",
        PRIVATE_UNKNOWN_KEY: "private",
        ANOTHER_PRIVATE_KEY: "private",
      },
    );
    expect(summary.issues[0]).toMatchObject({
      category: "UNRECOGNIZED_KEYS",
      path: "(root)",
      unknownKeyCount: 2,
    });
    expect(JSON.stringify(summary)).not.toContain("PRIVATE_UNKNOWN_KEY");
    expect(JSON.stringify(summary)).not.toContain("ANOTHER_PRIVATE_KEY");
  });

  it("summarizes union and custom validation without raw branch or custom messages", () => {
    const summary = diagnose(
      z.object({
        union: z.union([z.string(), z.number()]),
        custom: z.string().refine(() => false, "PRIVATE CUSTOM MESSAGE"),
      }),
      { union: {}, custom: "PRIVATE CUSTOM INPUT" },
    );
    expect(summary.issues.map((issue) => issue.category)).toEqual([
      "CUSTOM_VALIDATION",
      "INVALID_UNION",
    ]);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("PRIVATE CUSTOM MESSAGE");
    expect(serialized).not.toContain("PRIVATE CUSTOM INPUT");
  });

  it("falls back to an unknown category for future Zod issue codes", () => {
    const issue = {
      code: "future_issue_code",
      path: ["field"],
      message: "PRIVATE RAW MESSAGE",
      input: "PRIVATE RAW INPUT",
    } as unknown as ZodIssue;
    const summary = summarizeSchemaIssues(
      "test_schema",
      [issue],
      { field: "PRIVATE VALUE" },
      z.object({ field: z.string() }),
    );
    expect(summary.issues[0]).toMatchObject({
      category: "UNKNOWN_SCHEMA_ISSUE",
      path: "field",
      receivedType: "string",
    });
    expect(JSON.stringify(summary)).not.toContain("PRIVATE");
  });

  it("formats nested object and array paths without values", () => {
    const summary = diagnose(
      z.object({
        resume: z.object({
          sections: z.array(z.object({
            lines: z.array(z.object({
              sourceFactIds: z.array(z.string()),
            })),
          })),
        }),
      }),
      {
        resume: {
          sections: [{ lines: [{ sourceFactIds: "PRIVATE VALUE" }] }],
        },
      },
    );
    expect(summary.issues[0].path)
      .toBe("resume.sections[0].lines[0].sourceFactIds");
  });

  it("replaces unsafe path segments and caps paths at 256 characters", () => {
    const issue = {
      code: "invalid_type",
      expected: "string",
      received: "number",
      path: [
        "PRIVATE unsafe path",
        ...Array.from({ length: 40 }, (_, index) => `safeSegment${index}`),
      ],
      message: "PRIVATE MESSAGE",
    } as ZodIssue;
    const summary = summarizeSchemaIssues("test_schema", [issue], {});
    expect(summary.issues[0].path).toContain("[field]");
    expect(summary.issues[0].path).toContain("<path-truncated>");
    expect(summary.issues[0].path.length).toBeLessThanOrEqual(256);
    expect(summary.issues[0].path).not.toContain("PRIVATE");
  });

  it("sorts issues deterministically and truncates at twenty", () => {
    const schema = z.object(Object.fromEntries(
      Array.from({ length: 25 }, (_, index) => [
        `field${String(index).padStart(2, "0")}`,
        z.string(),
      ]),
    ));
    const summary = diagnose(schema, {});
    expect(summary).toMatchObject({
      issueCount: 25,
      reportedIssueCount: maximumStoredSchemaIssues,
      truncated: true,
    });
    expect(summary.issues.map((issue) => issue.path)).toEqual(
      [...summary.issues.map((issue) => issue.path)].sort(),
    );
  });

  it("explicitly serializes only safe diagnostic fields", () => {
    const summary = diagnose(
      z.object({ field: z.string().max(2) }),
      { field: "PRIVATE CANDIDATE NAME demo@example.invalid" },
      "grounded_tailored_resume_result",
    );
    const metadata = safeSchemaDiagnosticMetadata(summary);
    expect(metadata).toMatchObject({
      schemaName: "grounded_tailored_resume_result",
      schemaIssueCount: 1,
      schemaReportedIssueCount: 1,
      schemaIssuesTruncated: false,
      schemaIssueCategories: ["STRING_TOO_LONG"],
      schemaIssuePaths: ["field"],
      schemaExpectedTypes: ["string"],
      schemaReceivedTypes: ["string"],
    });
    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toContain("PRIVATE");
    expect(serialized).not.toContain("demo@example.invalid");
    expect(serialized).not.toContain("message");
    expect(serialized).not.toContain("input");
  });
});

describe("grounded shape diagnostics with synthetic fixtures", () => {
  it.each([
    [
      "missing sourceFactIds",
      (fixture: ReturnType<typeof groundedFixture>) => {
        delete (fixture.sections[0].lines[0] as Partial<typeof fixture.sections[0]["lines"][0]>)
          .sourceFactIds;
      },
      "sections[0].lines[0].sourceFactIds",
      "MISSING_REQUIRED_FIELD",
    ],
    [
      "sourceFactIds as string",
      (fixture: ReturnType<typeof groundedFixture>) => {
        (fixture.sections[0].lines[0] as unknown as { sourceFactIds: string }).sourceFactIds =
          "PRIVATE FACT IDS";
      },
      "sections[0].lines[0].sourceFactIds",
      "INVALID_TYPE",
    ],
    [
      "missing kind",
      (fixture: ReturnType<typeof groundedFixture>) => {
        delete (fixture.sections[0].lines[0] as Partial<typeof fixture.sections[0]["lines"][0]>)
          .kind;
      },
      "sections[0].lines[0].kind",
      "MISSING_REQUIRED_FIELD",
    ],
    [
      "invalid kind",
      (fixture: ReturnType<typeof groundedFixture>) => {
        (fixture.sections[0].lines[0] as unknown as { kind: string }).kind =
          "PRIVATE KIND";
      },
      "sections[0].lines[0].kind",
      "INVALID_ENUM",
    ],
    [
      "application material as public string",
      (fixture: ReturnType<typeof groundedFixture>) => {
        (fixture.applicationMaterials as unknown as { selfIntroduction: string })
          .selfIntroduction = "PRIVATE PUBLIC BUSINESS FIELD";
      },
      "applicationMaterials.selfIntroduction",
      "INVALID_TYPE",
    ],
    [
      "missing application materials wrapper",
      (fixture: ReturnType<typeof groundedFixture>) => {
        delete (fixture as Partial<ReturnType<typeof groundedFixture>>)
          .applicationMaterials;
      },
      "applicationMaterials",
      "MISSING_REQUIRED_FIELD",
    ],
    [
      "sections as object",
      (fixture: ReturnType<typeof groundedFixture>) => {
        (fixture as unknown as { sections: object }).sections = {};
      },
      "sections",
      "INVALID_TYPE",
    ],
    [
      "section lines as object",
      (fixture: ReturnType<typeof groundedFixture>) => {
        (fixture.sections[0] as unknown as { lines: object }).lines = {};
      },
      "sections[0].lines",
      "INVALID_TYPE",
    ],
  ])(
    "diagnoses %s without exposing fixture values",
    (_name, mutate, expectedPath, category) => {
      const fixture = groundedFixture();
      mutate(fixture);
      const summary = diagnose(
        groundedTailoredResumeSchema,
        fixture,
        "grounded_tailored_resume_result",
      );
      expect(summary.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: expectedPath, category }),
      ]));
      const serialized = JSON.stringify(summary);
      expect(serialized).not.toContain("PRIVATE");
      expect(serialized).not.toContain("F_SKL_001");
      expect(serialized).not.toContain("safe fixture");
    },
  );
});
