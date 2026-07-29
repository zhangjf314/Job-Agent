import { describe, expect, it } from "vitest";
import type {
  CandidateFact,
  JobRequirementFact,
} from "@/services/ai/candidate-fact-registry";
import {
  canonicalTerms,
} from "@/services/ai/candidate-fact-registry";
import {
  evaluateTailoredResumeFactuality,
  type FactualityReport,
  type FactualityViolation,
} from "@/services/ai/tailored-resume-factuality";
import {
  applyFactualityRepairPatch,
  assertFactualityRepairScope,
  buildFactualityRepairMessages,
  buildFactualityRepairOutputContract,
  buildFactualityRepairTargets,
  classifyFactualityRepairOutcome,
  factualityRepairPatchSchema,
  FactualityRepairError,
  summarizeFactualityRepair,
  validateFactualityRepairPatch,
} from "@/services/ai/tailored-resume-factuality-repair";
import {
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
  type GroundedTailoredResume,
  type GroundedText,
} from "@/services/ai/tailored-resume-grounding";

const candidateFacts: CandidateFact[] = [
  {
    id: "F_SKL_001",
    category: "skill",
    text: "TypeScript · 基础",
    canonicalTerms: canonicalTerms("TypeScript · 基础"),
  },
  {
    id: "F_SKL_002",
    category: "skill",
    text: "Python · 基础",
    canonicalTerms: canonicalTerms("Python · 基础"),
  },
  {
    id: "F_TEC_001",
    category: "project_technology",
    text: "课程任务管理系统使用 Next.js",
    canonicalTerms: canonicalTerms("课程任务管理系统使用 Next.js"),
  },
  {
    id: "F_TEC_002",
    category: "project_technology",
    text: "课程任务管理系统使用 PostgreSQL",
    canonicalTerms: canonicalTerms("课程任务管理系统使用 PostgreSQL"),
  },
  {
    id: "F_PRJ_001",
    category: "project",
    text: "课程任务管理系统",
    canonicalTerms: canonicalTerms("课程任务管理系统"),
  },
];

const jobRequirements: JobRequirementFact[] = [
  {
    id: "J_REQ_001",
    text: "AI 应用项目经验",
    canonicalTerms: canonicalTerms("AI 应用项目经验"),
  },
  {
    id: "J_REQ_002",
    text: "OpenAI-compatible LLM API 接入经验",
    canonicalTerms: canonicalTerms("OpenAI-compatible LLM API 接入经验"),
  },
];

function baseGrounded(
  first: GroundedText = {
    text: "具备 TypeScript 基础，并完成过 LLM API 接入",
    sourceFactIds: ["F_SKL_001"],
    kind: "fact",
  },
  second?: GroundedText,
): GroundedTailoredResume {
  return groundedTailoredResumeSchema.parse({
    sections: [
      {
        type: "summary",
        title: "个人概况",
        lines: second ? [first, second] : [first],
        order: 0,
      },
      {
        type: "skills",
        title: "技能",
        lines: [{
          text: "具备 Python 基础",
          sourceFactIds: ["F_SKL_002"],
          kind: "fact",
        }],
        order: 1,
      },
      {
        type: "projects",
        title: "项目",
        lines: [{
          text: "课程任务管理系统使用 Next.js",
          sourceFactIds: ["F_TEC_001"],
          kind: "fact",
        }],
        order: 2,
      },
      { type: "experiences", title: "经历", lines: [], order: 3 },
      { type: "education", title: "教育经历", lines: [], order: 4 },
      { type: "others", title: "其他", lines: [], order: 5 },
    ],
    rewriteExplanation: ["突出已有 Web 开发基础"],
    changedSections: ["summary"],
    missingFields: ["实习经历"],
    improvementQuestions: ["是否有更多课程项目"],
    qualityWarnings: ["未将岗位要求写成候选人事实"],
    applicationMaterials: {
      selfIntroduction: [{
        text: "希望继续学习 LLM API 集成",
        sourceFactIds: [],
        kind: "goal",
      }],
      applicationEmail: [{
        text: "希望应聘 AI 应用开发实习生",
        sourceFactIds: [],
        kind: "goal",
      }],
      recruiterMessage: [{
        text: "目标方向为 AI 应用开发",
        sourceFactIds: [],
        kind: "goal",
      }],
    },
  });
}

function violation(
  path: string,
  category: FactualityViolation["category"] = "JD_REQUIREMENT_AS_FACT",
): FactualityViolation {
  return {
    category,
    path,
    safeSummary: "Safe fixed-category summary.",
    severity: "fail",
  };
}

function patchFor(
  targets: ReturnType<typeof buildFactualityRepairTargets>,
  replacements?: Record<string, GroundedText>,
) {
  return {
    repairs: targets.map((target) => ({
      targetId: target.targetId,
      action: "replace" as const,
      replacement: replacements?.[target.targetId] ?? {
        text: "具备 TypeScript 基础",
        sourceFactIds: ["F_SKL_001"],
        kind: "fact" as const,
      },
    })),
  };
}

function expectRepairCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("Expected repair validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(FactualityRepairError);
    expect((error as FactualityRepairError).code).toBe(code);
  }
}

describe("factuality repair target grouping", () => {
  it("creates one target for one violation path", () => {
    const targets = buildFactualityRepairTargets(
      baseGrounded(),
      [violation("sections.0.lines.0")],
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      targetId: "T1",
      path: "sections.0.lines.0",
      locationKind: "section_line",
      sectionType: "summary",
      removalAllowed: false,
    });
  });

  it("groups multiple violation categories for the same path", () => {
    const targets = buildFactualityRepairTargets(baseGrounded(), [
      violation("sections.0.lines.0"),
      violation("sections.0.lines.0", "INVENTED_LLM_EXPERIENCE"),
    ]);
    expect(targets).toHaveLength(1);
    expect(targets[0].categories).toEqual([
      "INVENTED_LLM_EXPERIENCE",
      "JD_REQUIREMENT_AS_FACT",
    ]);
  });

  it("turns three violations across two paths into two targets", () => {
    const input = baseGrounded(undefined, {
      text: "开发过 AI 应用项目",
      sourceFactIds: ["F_SKL_002"],
      kind: "fact",
    });
    const targets = buildFactualityRepairTargets(input, [
      violation("sections.0.lines.1", "INVENTED_AI_PROJECT"),
      violation("sections.0.lines.0"),
      violation("sections.0.lines.0", "INVENTED_LLM_EXPERIENCE"),
    ]);
    expect(targets.map((target) => target.targetId)).toEqual(["T1", "T2"]);
    expect(targets.map((target) => target.path)).toEqual([
      "sections.0.lines.0",
      "sections.0.lines.1",
    ]);
  });

  it("keeps target order and IDs stable regardless of violation order", () => {
    const input = baseGrounded(undefined, {
      text: "开发过 AI 应用项目",
      sourceFactIds: ["F_SKL_002"],
      kind: "fact",
    });
    const items = [
      violation("applicationMaterials.recruiterMessage.0"),
      violation("sections.0.lines.1"),
      violation("sections.0.lines.0"),
    ];
    const first = buildFactualityRepairTargets(input, items);
    const second = buildFactualityRepairTargets(input, [...items].reverse());
    expect(first.map(({ targetId, path }) => ({ targetId, path })))
      .toEqual(second.map(({ targetId, path }) => ({ targetId, path })));
  });

  it("uses opaque temporary IDs without text or fact IDs", () => {
    const [target] = buildFactualityRepairTargets(
      baseGrounded(),
      [violation("sections.0.lines.0")],
    );
    expect(target.targetId).toBe("T1");
    expect(target.targetId).not.toMatch(/TypeScript|F_SKL|LLM/);
  });

  it("fails unsupported and out-of-range paths before a model call", () => {
    for (const path of [
      "rewriteExplanation.0",
      "sections.99.lines.0",
      "sections.0.title",
      "__proto__.polluted",
      "constructor.prototype",
    ]) {
      expectRepairCode(
        () => buildFactualityRepairTargets(baseGrounded(), [violation(path)]),
        "UNSUPPORTED_FACTUALITY_REPAIR_TARGET",
      );
    }
  });
});

describe("strict factuality repair patch contract", () => {
  const input = baseGrounded();
  const targets = buildFactualityRepairTargets(
    input,
    [violation("sections.0.lines.0")],
  );

  it("accepts exactly one replacement per target", () => {
    const value = validateFactualityRepairPatch(
      patchFor(targets),
      targets,
      candidateFacts,
    );
    expect(value.repairs).toHaveLength(1);
  });

  it("rejects missing targets", () => {
    expectRepairCode(
      () => validateFactualityRepairPatch({ repairs: [] }, targets, candidateFacts),
      "FACTUALITY_REPAIR_TARGET_MISSING",
    );
  });

  it.each(["T2", "UNKNOWN"])("rejects an extra or unknown target %s", (targetId) => {
    const value = patchFor(targets);
    value.repairs.push({ ...value.repairs[0], targetId });
    expectRepairCode(
      () => validateFactualityRepairPatch(value, targets, candidateFacts),
      "FACTUALITY_REPAIR_TARGET_UNKNOWN",
    );
  });

  it("rejects duplicate targets", () => {
    const value = patchFor(targets);
    value.repairs.push(structuredClone(value.repairs[0]));
    expectRepairCode(
      () => validateFactualityRepairPatch(value, targets, candidateFacts),
      "FACTUALITY_REPAIR_TARGET_DUPLICATED",
    );
  });

  it.each([
    ["missing text", { sourceFactIds: ["F_SKL_001"], kind: "fact" }],
    ["missing sourceFactIds", { text: "具备 TypeScript 基础", kind: "fact" }],
    ["invalid kind", { text: "具备 TypeScript 基础", sourceFactIds: ["F_SKL_001"], kind: "future" }],
    ["extra field", { text: "具备 TypeScript 基础", sourceFactIds: ["F_SKL_001"], kind: "fact", path: "sections.0.lines.0" }],
  ])("rejects replacement with %s", (_name, replacement) => {
    expectRepairCode(
      () => validateFactualityRepairPatch({
        repairs: [{ targetId: "T1", action: "replace", replacement }],
      }, targets, candidateFacts),
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
    );
  });

  it("rejects more than eight source fact IDs", () => {
    expect(factualityRepairPatchSchema.safeParse({
      repairs: [{
        targetId: "T1",
        action: "replace",
        replacement: {
          text: "具备 TypeScript 基础",
          sourceFactIds: Array.from({ length: 9 }, (_, index) => `F_SKL_${index}`),
          kind: "fact",
        },
      }],
    }).success).toBe(false);
  });

  it.each(["J_REQ_001", "F_UNKNOWN_999"])("rejects forbidden fact ID %s", (id) => {
    const value = patchFor(targets);
    value.repairs[0].replacement.sourceFactIds = [id];
    expectRepairCode(
      () => validateFactualityRepairPatch(value, targets, candidateFacts),
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
    );
  });

  it.each([
    ["duplicate", ["F_SKL_001", "F_SKL_001"]],
    ["out of registry order", ["F_SKL_002", "F_SKL_001"]],
  ])("rejects %s source fact IDs", (_name, sourceFactIds) => {
    const value = patchFor(targets);
    value.repairs[0].replacement.sourceFactIds = sourceFactIds;
    expectRepairCode(
      () => validateFactualityRepairPatch(value, targets, candidateFacts),
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
    );
  });

  it("rejects a full grounded resume response", () => {
    expectRepairCode(
      () => validateFactualityRepairPatch(input, targets, candidateFacts),
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
    );
  });

  it("rejects arbitrary paths and top-level extra fields", () => {
    expectRepairCode(
      () => validateFactualityRepairPatch({
        ...patchFor(targets),
        path: "sections.0.lines.0",
      }, targets, candidateFacts),
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
    );
  });

  it("declares patch-only JSON without the full Grounded contract", () => {
    const contract = buildFactualityRepairOutputContract(targets);
    expect(contract).toContain('"repairs"');
    expect(contract).toContain("Exactly once each:T1");
    expect(contract).toContain("No extra IDs,paths,fields,full resume");
    expect(contract).not.toContain("rewriteExplanation");
    expect(contract).not.toContain("changedSections");
    expect(contract).not.toContain("applicationMaterials require");
  });
});

describe("deterministic patch application and full revalidation", () => {
  it("replaces only a targeted GroundedText and passes the full gate", () => {
    const before = baseGrounded();
    const reportBefore = evaluateTailoredResumeFactuality(
      before,
      candidateFacts,
      jobRequirements,
    );
    const targets = buildFactualityRepairTargets(before, reportBefore.violations);
    const patch = validateFactualityRepairPatch(
      patchFor(targets),
      targets,
      candidateFacts,
    );
    const after = applyFactualityRepairPatch(before, targets, patch);
    const reportAfter = evaluateTailoredResumeFactuality(
      after,
      candidateFacts,
      jobRequirements,
    );
    expect(reportBefore.status).toBe("fail");
    expect(reportAfter).toMatchObject({
      status: "pass",
      violations: [],
      ungroundedClaimCount: 0,
      unknownFactIds: 0,
      missingSourceIds: 0,
    });
    expect(groundedTailoredResumeSchema.safeParse(after).success).toBe(true);
    expect(() => stripGroundingMetadata(after)).not.toThrow();
    expect(before.sections[0].lines[0].text).toContain("LLM API");
    expect(after.sections[0].lines[0].text).not.toContain("LLM API");
  });

  it("keeps every non-target field byte-for-byte equivalent", () => {
    const before = baseGrounded();
    const targets = buildFactualityRepairTargets(
      before,
      [violation("sections.0.lines.0")],
    );
    const after = applyFactualityRepairPatch(
      before,
      targets,
      patchFor(targets),
    );
    expect(() => assertFactualityRepairScope(before, after, targets)).not.toThrow();
    expect(after.sections.slice(1)).toEqual(before.sections.slice(1));
    expect(after.sections[0]).toMatchObject({
      type: before.sections[0].type,
      title: before.sections[0].title,
      order: before.sections[0].order,
    });
    expect(after.applicationMaterials).toEqual(before.applicationMaterials);
    expect(after.changedSections).toEqual(before.changedSections);
    expect(after.rewriteExplanation).toEqual(before.rewriteExplanation);
    expect(after.missingFields).toEqual(before.missingFields);
    expect(after.improvementQuestions).toEqual(before.improvementQuestions);
    expect(after.qualityWarnings).toEqual(before.qualityWarnings);
  });

  it("does not mutate the initial object", () => {
    const before = baseGrounded();
    const snapshot = structuredClone(before);
    const targets = buildFactualityRepairTargets(
      before,
      [violation("sections.0.lines.0")],
    );
    applyFactualityRepairPatch(before, targets, patchFor(targets));
    expect(before).toEqual(snapshot);
  });

  it("detects a defensive scope violation", () => {
    const before = baseGrounded();
    const targets = buildFactualityRepairTargets(
      before,
      [violation("sections.0.lines.0")],
    );
    const changed = structuredClone(before);
    changed.changedSections = ["skills"];
    expectRepairCode(
      () => assertFactualityRepairScope(before, changed, targets),
      "FACTUALITY_REPAIR_SCOPE_VIOLATION",
    );
  });

  it("classifies a still-unsupported replacement as incomplete", () => {
    const before = baseGrounded();
    const reportBefore = evaluateTailoredResumeFactuality(
      before,
      candidateFacts,
      jobRequirements,
    );
    const targets = buildFactualityRepairTargets(before, reportBefore.violations);
    const after = applyFactualityRepairPatch(before, targets, patchFor(targets, {
      T1: {
        text: "具备 TypeScript 基础，并完成过 LLM API 接入",
        sourceFactIds: ["F_SKL_001"],
        kind: "fact",
      },
    }));
    const reportAfter = evaluateTailoredResumeFactuality(
      after,
      candidateFacts,
      jobRequirements,
    );
    expect(classifyFactualityRepairOutcome(reportBefore, reportAfter))
      .toBe("FACTUALITY_REPAIR_INCOMPLETE");
  });

  it("detects a violation moved into another targeted node", () => {
    const before = baseGrounded(undefined, {
      text: "TypeScript",
      sourceFactIds: [],
      kind: "fact",
    });
    const reportBefore = evaluateTailoredResumeFactuality(
      before,
      candidateFacts,
      jobRequirements,
    );
    const targets = buildFactualityRepairTargets(before, reportBefore.violations);
    const after = applyFactualityRepairPatch(before, targets, patchFor(targets, {
      T1: {
        text: "具备 TypeScript 基础",
        sourceFactIds: ["F_SKL_001"],
        kind: "fact",
      },
      T2: {
        text: "将接口性能提升 40%",
        sourceFactIds: ["F_SKL_002"],
        kind: "fact",
      },
    }));
    const reportAfter = evaluateTailoredResumeFactuality(
      after,
      candidateFacts,
      jobRequirements,
    );
    expect(reportAfter.violations.map((item) => item.category))
      .toContain("INVENTED_METRIC");
    expect(classifyFactualityRepairOutcome(reportBefore, reportAfter))
      .toBe("FACTUALITY_REPAIR_INTRODUCED_NEW_VIOLATION");
  });

  it("reports violation counts separately from grouped target counts", () => {
    const before: FactualityReport = {
      status: "fail",
      violations: [
        violation("sections.0.lines.0"),
        violation("sections.0.lines.0", "INVENTED_LLM_EXPERIENCE"),
        violation("sections.0.lines.1", "INVENTED_AI_PROJECT"),
      ],
      groundedClaimCount: 0,
      ungroundedClaimCount: 2,
      unknownFactIds: 0,
      missingSourceIds: 0,
    };
    const input = baseGrounded(undefined, {
      text: "开发过 AI 应用项目",
      sourceFactIds: ["F_SKL_002"],
      kind: "fact",
    });
    const targets = buildFactualityRepairTargets(input, before.violations);
    const after: FactualityReport = {
      status: "pass",
      violations: [],
      groundedClaimCount: 2,
      ungroundedClaimCount: 0,
      unknownFactIds: 0,
      missingSourceIds: 0,
    };
    const summary = summarizeFactualityRepair(
      before,
      after,
      targets,
      2,
      true,
    );
    expect(summary).toMatchObject({
      factualityViolationCountBeforeRepair: 3,
      factualityRepairTargetCount: 2,
      factualityRepairPatchCount: 2,
      factualityViolationCountAfterRepair: 0,
      factualityViolationsResolved: 3,
      factualityViolationsIntroduced: 0,
      factualityRepairScopeViolation: false,
    });
    expect(JSON.stringify(summary)).not.toContain("完成过");
    expect(JSON.stringify(summary)).not.toContain("F_SKL_");
  });
});

describe("goal semantics and repair request safety", () => {
  it.each([
    "希望进一步学习 LLM API 集成",
    "目标方向为 AI 应用开发",
    "计划继续学习大模型应用开发",
  ])("allows explicit future language as goal without fake evidence: %s", (text) => {
    const input = baseGrounded();
    const claim = { text, sourceFactIds: [], kind: "goal" as const };
    const report = evaluateTailoredResumeFactuality(
      {
        ...input,
        applicationMaterials: {
          ...input.applicationMaterials,
          recruiterMessage: [claim],
        },
      },
      candidateFacts,
      jobRequirements,
    );
    expect(
      report.violations.filter((item) =>
        item.path === "applicationMaterials.recruiterMessage.0"
      ),
    ).toEqual([]);
  });

  it("does not allow a fact assertion to masquerade as a future goal", () => {
    const input = baseGrounded();
    const report = evaluateTailoredResumeFactuality(
      {
        ...input,
        applicationMaterials: {
          ...input.applicationMaterials,
          recruiterMessage: [{
            text: "计划学习但已完成 LLM API 接入",
            sourceFactIds: [],
            kind: "goal",
          }],
        },
      },
      candidateFacts,
      jobRequirements,
    );
    expect(report.violations.map((item) => item.category))
      .toContain("JD_REQUIREMENT_AS_FACT");
  });

  it("rejects replacing a factual section line with future language", () => {
    const input = baseGrounded();
    const targets = buildFactualityRepairTargets(
      input,
      [violation("sections.0.lines.0")],
    );
    expectRepairCode(
      () => validateFactualityRepairPatch({
        repairs: [{
          targetId: "T1",
          action: "replace",
          replacement: {
            text: "计划继续学习 LLM API 集成",
            sourceFactIds: [],
            kind: "goal",
          },
        }],
      }, targets, candidateFacts),
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
    );
  });

  it("allows explicit future language in an application-material target", () => {
    const input = baseGrounded();
    input.applicationMaterials.recruiterMessage[0] = {
      text: "完成过 LLM API 接入",
      sourceFactIds: ["F_SKL_001"],
      kind: "fact",
    };
    const targets = buildFactualityRepairTargets(
      input,
      [violation("applicationMaterials.recruiterMessage.0")],
    );
    const patch = validateFactualityRepairPatch({
      repairs: [{
        targetId: "T1",
        action: "replace",
        replacement: {
          text: "计划继续学习 LLM API 集成",
          sourceFactIds: [],
          kind: "goal",
        },
      }],
    }, targets, candidateFacts);
    const after = applyFactualityRepairPatch(input, targets, patch);
    const targetViolations = evaluateTailoredResumeFactuality(
      after,
      candidateFacts,
      jobRequirements,
    ).violations.filter((item) =>
      item.path === "applicationMaterials.recruiterMessage.0"
    );
    expect(targetViolations).toEqual([]);
  });

  it("rejects candidate fact IDs attached to goal language", () => {
    const input = baseGrounded();
    input.applicationMaterials.recruiterMessage[0] = {
      text: "完成过 LLM API 接入",
      sourceFactIds: ["F_SKL_001"],
      kind: "fact",
    };
    const targets = buildFactualityRepairTargets(
      input,
      [violation("applicationMaterials.recruiterMessage.0")],
    );
    expectRepairCode(
      () => validateFactualityRepairPatch({
        repairs: [{
          targetId: "T1",
          action: "replace",
          replacement: {
            text: "计划继续学习 LLM API 集成",
            sourceFactIds: ["F_SKL_001"],
            kind: "goal",
          },
        }],
      }, targets, candidateFacts),
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
    );
  });

  it("sends only facts, requirements, targets, and the patch contract", () => {
    const input = baseGrounded();
    const targets = buildFactualityRepairTargets(
      input,
      [violation("sections.0.lines.0")],
    );
    const messages = buildFactualityRepairMessages(
      candidateFacts,
      jobRequirements,
      targets,
    );
    const serialized = JSON.stringify(messages);
    expect(serialized).toContain("CANDIDATE_FACTS");
    expect(serialized).toContain("JD_ONLY_REQUIREMENTS");
    expect(serialized).toContain("REPAIR_TARGETS");
    expect(serialized).toContain("sections.0.lines.0");
    expect(serialized).toContain("具备 TypeScript 基础，并完成过 LLM API 接入");
    expect(serialized).not.toContain("currentStructuredResult");
    expect(serialized).not.toContain("rewriteExplanation");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("API Key");
    expect(serialized).not.toContain("reasoning_content");
  });
});
