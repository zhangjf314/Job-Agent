import { describe, expect, it } from "vitest";
import {
  buildCandidateFactRegistry,
  buildCandidateFactRenderDescriptors,
} from "@/services/ai/candidate-fact-registry";
import {
  tailoredResumePlanSchema,
  type TailoredResumePlan,
} from "@/services/ai/tailored-resume-plan";
import {
  TailoredResumePlanError,
  validateTailoredResumePlan,
} from "@/services/ai/tailored-resume-plan-validator";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeProfile,
} from "@/scripts/llm-smoke-fixtures";

const facts = buildCandidateFactRegistry(
  fictionalSmokeProfile,
  fictionalSmokeBaseResume,
);
const descriptors = buildCandidateFactRenderDescriptors(facts);
const first = facts[0].id;
const second = facts[1].id;

function plan(overrides: Partial<TailoredResumePlan> = {}): TailoredResumePlan {
  return {
    sections: {
      summary: { factIds: [first] },
      skills: { factIds: [second] },
      projects: { factIds: [] },
      experiences: { factIds: [] },
      education: { factIds: [] },
      others: { factIds: [] },
    },
    applicationMaterials: {
      selfIntroductionFactIds: [first],
      applicationEmailFactIds: [],
      recruiterMessageFactIds: [],
    },
    changedSections: ["summary", "skills"],
    priorityFactIds: [first, second],
    ...overrides,
  };
}

function codeFor(value: unknown) {
  try {
    validateTailoredResumePlan(value, facts, descriptors);
  } catch (error) {
    if (error instanceof TailoredResumePlanError) return error.code;
    throw error;
  }
  return "none";
}

describe("tailored resume selection plan", () => {
  it("accepts an ID-and-enum-only plan", () => {
    expect(tailoredResumePlanSchema.parse(plan())).toEqual(plan());
  });

  it("rejects arbitrary top-level text", () => {
    expect(codeFor({ ...plan(), explanation: "free text" })).toBe(
      "TAILORED_PLAN_SCHEMA_INVALID",
    );
  });

  it("rejects model-generated section fields", () => {
    const value = plan();
    expect(codeFor({
      ...value,
      sections: {
        ...value.sections,
        summary: { factIds: [first], title: "summary" },
      },
    })).toBe("TAILORED_PLAN_SCHEMA_INVALID");
  });

  it("rejects more than two changed sections", () => {
    expect(codeFor({
      ...plan(),
      changedSections: ["summary", "skills", "projects"],
    })).toBe("TAILORED_PLAN_SCHEMA_INVALID");
  });

  it("rejects unknown section enums", () => {
    expect(codeFor({
      ...plan(),
      changedSections: ["unknown"],
    })).toBe("TAILORED_PLAN_SCHEMA_INVALID");
  });

  it("rejects duplicate IDs inside a section", () => {
    const value = plan();
    expect(codeFor({
      ...value,
      sections: {
        ...value.sections,
        summary: { factIds: [first, first] },
      },
    })).toBe("TAILORED_PLAN_DUPLICATE_FACT_ID");
  });

  it("rejects duplicate application-material IDs", () => {
    const value = plan();
    expect(codeFor({
      ...value,
      applicationMaterials: {
        ...value.applicationMaterials,
        selfIntroductionFactIds: [first, first],
      },
    })).toBe("TAILORED_PLAN_DUPLICATE_FACT_ID");
  });

  it("rejects duplicate changed sections", () => {
    expect(codeFor({
      ...plan(),
      changedSections: ["summary", "summary"],
    })).toBe("TAILORED_PLAN_DUPLICATE_FACT_ID");
  });

  it("rejects JD requirement IDs", () => {
    const value = plan();
    expect(codeFor({
      ...value,
      sections: {
        ...value.sections,
        summary: { factIds: ["J_REQ_001"] },
      },
    })).toBe("TAILORED_PLAN_JD_REQUIREMENT_ID");
  });

  it("rejects unknown candidate fact IDs", () => {
    const value = plan();
    expect(codeFor({
      ...value,
      sections: {
        ...value.sections,
        summary: { factIds: ["F_SKL_999"] },
      },
    })).toBe("TAILORED_PLAN_UNKNOWN_FACT_ID");
  });

  it("requires priority IDs to be selected", () => {
    expect(codeFor({
      ...plan(),
      priorityFactIds: [facts.at(-1)!.id],
    })).toBe("TAILORED_PLAN_PRIORITY_INVALID");
  });

  it("allows the same fact in several bounded uses", () => {
    const value = plan();
    expect(validateTailoredResumePlan({
      ...value,
      sections: {
        ...value.sections,
        skills: { factIds: [first] },
      },
      applicationMaterials: {
        selfIntroductionFactIds: [first],
        applicationEmailFactIds: [first],
        recruiterMessageFactIds: [first],
      },
      priorityFactIds: [first],
    }, facts, descriptors).diagnostics.selectedFactCount).toBe(1);
  });

  it("enforces the total-use ceiling", () => {
    const value = plan();
    expect(codeFor({
      ...value,
      sections: Object.fromEntries(
        Object.keys(value.sections).map((key) => [key, { factIds: [first] }]),
      ),
      applicationMaterials: {
        selfIntroductionFactIds: [first],
        applicationEmailFactIds: [first],
        recruiterMessageFactIds: [first],
      },
      priorityFactIds: [first],
    })).toBe("TAILORED_PLAN_FACT_USAGE_LIMIT");
  });

  it("does not expose specific IDs in validation messages", () => {
    try {
      validateTailoredResumePlan({
        ...plan(),
        priorityFactIds: ["F_SECRET_001"],
      }, facts, descriptors);
    } catch (error) {
      expect(error).toBeInstanceOf(TailoredResumePlanError);
      expect((error as Error).message).not.toContain("F_SECRET_001");
    }
  });
});
