import { describe, expect, it } from "vitest";
import type { ResumeProfile } from "@/services/resume-generator";
import {
  atomizeProject,
  projectStableKey,
} from "@/services/project-facts/project-fact-atomizer";
import {
  buildCandidateFactRegistry,
  buildCandidateFactRenderDescriptors,
  formatProjectFactsForPrompt,
  isProjectCandidateFact,
  selectProjectFactsForPrompt,
  type ProjectCandidateFact,
} from "@/services/ai/candidate-fact-registry";
import {
  compileProjectDescriptions,
} from "@/services/ai/project-description-compiler";
import type { TailoredResumePlan } from "@/services/ai/tailored-resume-plan";
import {
  validateTailoredResumePlan,
} from "@/services/ai/tailored-resume-plan-validator";
import { compileGroundedTailoredResume } from "@/services/ai/tailored-resume-grounded-compiler";
import { evaluateTailoredResumeFactuality } from "@/services/ai/tailored-resume-factuality";
import { evaluateProjectDescriptionFactuality } from "@/services/ai/project-description-factuality";
import { fictionalSmokeJD } from "@/scripts/llm-smoke-fixtures";
import { backfillProjectFactAtoms } from "@/services/project-facts/project-fact-service";

function project(id: string, name: string, projectType: string) {
  const stableKey = projectStableKey(name);
  const atoms = atomizeProject({
    id,
    stableKey,
    projectType,
    role: "课程项目成员",
    responsibilities: ["开发任务筛选模块"],
    techStack: ["TypeScript"],
    highlights: ["任务筛选功能"],
    challenges: ["多条件筛选状态同步"],
    solutions: ["统一查询参数校验"],
    engineeringPractices: ["单元测试与类型检查"],
    results: "完成课程验收",
    metrics: ["通过 20 条测试用例"],
    fullDescription: "- 开发任务筛选模块\n- 编写单元测试",
  });
  return {
    id,
    profileId: "profile_demo",
    stableKey,
    name,
    projectType,
    role: "课程项目成员",
    startDate: null,
    endDate: null,
    background: "课程项目",
    goal: "完成课程验收",
    fullDescription: "- 开发任务筛选模块\n- 编写单元测试",
    responsibilities: ["开发任务筛选模块"],
    techStack: ["TypeScript"],
    highlights: ["任务筛选功能"],
    challenges: ["多条件筛选状态同步"],
    solutions: ["统一查询参数校验"],
    engineeringPractices: ["单元测试与类型检查"],
    results: "完成课程验收",
    metrics: ["通过 20 条测试用例"],
    links: [],
    factAtoms: atoms.map((atom, index) => ({
      ...atom,
      id: `${id}_atom_${index}`,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })),
  };
}

function profile(): ResumeProfile {
  return {
    id: "profile_demo",
    userId: null,
    targetRoles: ["前端开发实习生"],
    targetCities: ["上海"],
    expectedSalaryMin: null,
    expectedSalaryMax: null,
    expectedSalaryMonths: null,
    targetStatus: "actively_looking",
    availabilityDate: null,
    personalSummary: null,
    basicInfo: null,
    educationItems: [],
    skillItems: [],
    projectItems: [
      project("project_alpha_internal", "CampusFlow（虚构）", "课程项目"),
      project("project_beta_internal", "StudyBoard（虚构）", "个人项目"),
    ],
    experienceItems: [],
    certificateItems: [],
    awardItems: [],
    evidenceItems: [],
    languageItems: [],
    preference: null,
  } as unknown as ResumeProfile;
}

function emptyPlan(): TailoredResumePlan {
  return {
    sections: {
      summary: { factIds: [] }, skills: { factIds: [] }, projects: { factIds: [] },
      experiences: { factIds: [] }, education: { factIds: [] }, others: { factIds: [] },
    },
    applicationMaterials: {
      selfIntroductionFactIds: [], applicationEmailFactIds: [], recruiterMessageFactIds: [],
    },
    changedSections: ["projects"],
    priorityFactIds: [],
    projectRewrites: [],
  };
}

function setup() {
  const registry = buildCandidateFactRegistry(profile());
  const projects = registry.filter(isProjectCandidateFact);
  const descriptors = buildCandidateFactRenderDescriptors(registry);
  return { registry, projects, descriptors };
}

function fact(projects: ProjectCandidateFact[], projectIndex: number, category: string) {
  const references = [...new Set(projects.map((item) => item.project.projectReference))].sort();
  return projects.find(
    (item) => item.project.projectReference === references[projectIndex] && item.project.category === category,
  )!;
}

describe("project fact atomization and registry", () => {
  it("maps every supported structured project field and deduplicates facts", () => {
    const atoms = atomizeProject({
      id: "p", stableKey: "stable", techStack: ["TypeScript", "TypeScript"],
      responsibilities: ["开发模块"], highlights: ["筛选功能"], challenges: ["状态同步"],
      solutions: ["统一校验"], engineeringPractices: ["单元测试"], results: "完成验收",
      metrics: ["通过 20 条用例"],
    });
    expect(new Set(atoms.map((atom) => atom.category))).toEqual(new Set([
      "technology", "responsibility", "feature", "challenge", "solution", "engineering", "result", "metric",
    ]));
    expect(atoms.filter((atom) => atom.canonicalText === "TypeScript")).toHaveLength(1);
    expect(atomizeProject({ id: "p", stableKey: "stable", techStack: ["TypeScript"] })[0].stableKey)
      .toBe(atomizeProject({ id: "p", stableKey: "stable", techStack: ["TypeScript"] })[0].stableKey);
  });

  it("atomizes only structured fields and keeps prose descriptions unrenderable", () => {
    const atoms = atomizeProject({
      id: "p", stableKey: "stable", fullDescription: "这是一段不应自动拆分的完整项目描述。",
    });
    expect(atoms).toHaveLength(1);
    expect(atoms[0]).toMatchObject({ category: "background", renderable: false });
  });

  it("produces stable project fact IDs and preserves project ownership metadata", () => {
    const first = setup().projects;
    const second = buildCandidateFactRegistry({
      ...profile(),
      skillItems: [{ name: "Git", level: "基础", evidence: "课程项目" }],
    } as unknown as ResumeProfile).filter(isProjectCandidateFact);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
    expect(first.every((item) => item.id.startsWith("F_PROJECT_"))).toBe(true);
    expect(first.every((item) => item.project.internalProjectId.includes("internal"))).toBe(true);
  });

  it("limits project prompt facts without exposing internal IDs or full descriptions", () => {
    const { projects } = setup();
    const selected = selectProjectFactsForPrompt(projects);
    const prompt = formatProjectFactsForPrompt(selected.facts);
    expect(selected.projectCount).toBe(2);
    expect(prompt).not.toContain("project_alpha_internal");
    expect(prompt).not.toContain("完整项目描述");
    expect(prompt).not.toContain("J_REQ_");
  });

  it("backfills idempotently without any LLM dependency", async () => {
    const source = project("project_backfill", "Backfill Demo（虚构）", "课程项目");
    const stored: Array<Record<string, unknown>> = [];
    const db = {
      projectItem: { findMany: async () => [{ ...source, factAtoms: stored }] },
      projectFactAtom: { create: async ({ data }: { data: Record<string, unknown> }) => {
        stored.push({ id: `created_${stored.length}`, ...data });
        return data;
      } },
    };
    const first = await backfillProjectFactAtoms({ db: db as never });
    const second = await backfillProjectFactAtoms({ db: db as never });
    expect(first.atomsCreated).toBeGreaterThan(0);
    expect(second.atomsCreated).toBe(0);
    expect(second.atomsReused).toBe(first.atomsCreated);
  });
});

describe("project rewrite plan validation", () => {
  it("accepts same-project atoms and reports project diagnostics", () => {
    const { registry, projects, descriptors } = setup();
    const action = fact(projects, 0, "responsibility");
    const technology = fact(projects, 0, "technology");
    const plan = emptyPlan();
    plan.projectRewrites = [{
      projectId: action.project.projectReference,
      bullets: [{ pattern: "action_technology", factIds: [action.id, technology.id] }],
    }];
    const validated = validateTailoredResumePlan(plan, registry, descriptors, projects);
    expect(validated.diagnostics).toMatchObject({ selectedProjectCount: 1, selectedProjectAtomCount: 2 });
  });

  it.each([
    ["unknown project", "PROJECT_REWRITE_UNKNOWN_PROJECT"],
    ["cross project", "PROJECT_REWRITE_CROSS_PROJECT_FACT"],
    ["JD fact", "PROJECT_REWRITE_JD_REQUIREMENT_FACT"],
    ["duplicate atom", "PROJECT_REWRITE_DUPLICATE_ATOM"],
    ["pattern mismatch", "PROJECT_REWRITE_PATTERN_INVALID"],
  ])("rejects %s", (_, expectedCode) => {
    const { registry, projects, descriptors } = setup();
    const action = fact(projects, 0, "responsibility");
    const technology = fact(projects, 0, "technology");
    const otherTechnology = fact(projects, 1, "technology");
    const plan = emptyPlan();
    plan.projectRewrites = [{
      projectId: expectedCode === "PROJECT_REWRITE_UNKNOWN_PROJECT" ? "P_PROJECT_AAAAAAAAAAAA" : action.project.projectReference,
      bullets: [{
        pattern: expectedCode === "PROJECT_REWRITE_PATTERN_INVALID" ? "problem_solution" : "action_technology",
        factIds: expectedCode === "PROJECT_REWRITE_JD_REQUIREMENT_FACT"
          ? ["J_REQ_001", technology.id]
          : expectedCode === "PROJECT_REWRITE_CROSS_PROJECT_FACT"
            ? [action.id, otherTechnology.id]
            : expectedCode === "PROJECT_REWRITE_DUPLICATE_ATOM"
              ? [action.id, action.id]
              : [action.id, technology.id],
      }],
    }];
    expect(() => validateTailoredResumePlan(plan, registry, descriptors, projects))
      .toThrowError(expectedCode);
  });

  it.each([
    ["unknown atom", "PROJECT_REWRITE_UNKNOWN_ATOM"],
    ["unrenderable atom", "PROJECT_REWRITE_UNRENDERABLE_ATOM"],
  ])("rejects %s", (_, expectedCode) => {
    const { registry, projects, descriptors } = setup();
    const action = fact(projects, 0, "responsibility");
    const technology = fact(projects, 0, "technology");
    const selectedProjects = expectedCode === "PROJECT_REWRITE_UNRENDERABLE_ATOM"
      ? projects.map((item) => item.id === technology.id
        ? { ...item, project: { ...item.project, renderable: false } }
        : item)
      : projects;
    const selectedRegistry = registry.map((item) =>
      selectedProjects.find((projectFact) => projectFact.id === item.id) ?? item,
    );
    const plan = emptyPlan();
    plan.projectRewrites = [{
      projectId: action.project.projectReference,
      bullets: [{
        pattern: "action_technology",
        factIds: [action.id, expectedCode === "PROJECT_REWRITE_UNKNOWN_ATOM" ? "F_PROJECT_AAAAAAAAAAAA" : technology.id],
      }],
    }];
    expect(() => validateTailoredResumePlan(plan, selectedRegistry, descriptors, selectedProjects))
      .toThrowError(expectedCode);
  });

  it.each([
    ["illegal pattern", (plan: Record<string, unknown>) => {
      const rewrite = (plan.projectRewrites as Array<Record<string, unknown>>)[0];
      ((rewrite.bullets as Array<Record<string, unknown>>)[0]).pattern = "free_text";
    }, "PROJECT_REWRITE_PATTERN_INVALID"],
    ["too many bullets", (plan: Record<string, unknown>) => {
      const rewrite = (plan.projectRewrites as Array<Record<string, unknown>>)[0];
      rewrite.bullets = Array.from({ length: 3 }, () => ({ pattern: "action_technology", factIds: [] }));
    }, "PROJECT_REWRITE_CARDINALITY_INVALID"],
    ["too many atoms", (plan: Record<string, unknown>) => {
      const rewrite = (plan.projectRewrites as Array<Record<string, unknown>>)[0];
      ((rewrite.bullets as Array<Record<string, unknown>>)[0]).factIds = Array.from({ length: 7 }, () => "F_PROJECT_AAAAAAAAAAAA");
    }, "PROJECT_REWRITE_CARDINALITY_INVALID"],
    ["extra project field", (plan: Record<string, unknown>) => {
      (plan.projectRewrites as Array<Record<string, unknown>>)[0].description = "自由正文";
    }, "PROJECT_REWRITE_PLAN_SCHEMA_INVALID"],
  ] as const)("rejects schema case: %s", (_, mutate, expectedCode) => {
    const { registry, projects, descriptors } = setup();
    const action = fact(projects, 0, "responsibility");
    const technology = fact(projects, 0, "technology");
    const plan: Record<string, unknown> = {
      ...emptyPlan(),
      projectRewrites: [{
        projectId: action.project.projectReference,
        bullets: [{ pattern: "action_technology", factIds: [action.id, technology.id] }],
      }],
    };
    mutate(plan);
    expect(() => validateTailoredResumePlan(plan, registry, descriptors, projects))
      .toThrowError(expectedCode);
  });
});

describe("deterministic project description compiler", () => {
  it.each([
    ["action_technology", "responsibility", "technology"],
    ["action_solution", "responsibility", "solution"],
    ["feature_implementation", "feature", "technology"],
    ["problem_solution", "challenge", "solution"],
    ["solution_result", "solution", "result"],
    ["engineering_quality", "engineering", "metric"],
    ["responsibility_result", "responsibility", "result"],
  ] as const)("compiles %s with exact evidence", (pattern, firstCategory, secondCategory) => {
    const { projects } = setup();
    const first = fact(projects, 0, firstCategory);
    const second = fact(projects, 0, secondCategory);
    const [compiled] = compileProjectDescriptions({
      rewritePlans: [{ projectId: first.project.projectReference, bullets: [{ pattern, factIds: [first.id, second.id] }] }],
      projectFacts: projects,
      characterLimit: 80,
    });
    expect(compiled.sourceFactIds).toEqual([first.id, second.id]);
    expect(compiled.text).toContain(first.text);
    expect(compiled.text).toContain(second.text);
    expect(compiled.text.length).toBeLessThanOrEqual(80);
    expect(compiled.text).not.toMatch(/F_PROJECT_|P_PROJECT_|…/);
  });

  it.each([
    ["action_technology", "responsibility"],
    ["action_solution", "responsibility"],
    ["feature_implementation", "feature"],
    ["problem_solution", "challenge"],
    ["solution_result", "solution"],
    ["engineering_quality", "engineering"],
    ["responsibility_result", "responsibility"],
  ] as const)("rejects %s when a required category is missing", (pattern, category) => {
    const { projects } = setup();
    const selected = fact(projects, 0, category);
    expect(() => compileProjectDescriptions({
      rewritePlans: [{ projectId: selected.project.projectReference, bullets: [{ pattern, factIds: [selected.id] }] }],
      projectFacts: projects,
      characterLimit: 80,
    })).toThrowError("PROJECT_DESCRIPTION_PATTERN_FACT_MISMATCH");
  });

  it("produces different grounded text for AI, backend and frontend selections from one project", () => {
    const { registry, projects, descriptors } = setup();
    const reference = fact(projects, 0, "responsibility").project.projectReference;
    const cases = [
      ["action_technology", "responsibility", "technology"],
      ["action_solution", "responsibility", "solution"],
      ["problem_solution", "challenge", "solution"],
    ] as const;
    const texts = cases.map(([pattern, firstCategory, secondCategory]) => {
      const first = fact(projects, 0, firstCategory);
      const second = fact(projects, 0, secondCategory);
      const plan = emptyPlan();
      plan.projectRewrites = [{ projectId: reference, bullets: [{ pattern, factIds: [first.id, second.id] }] }];
      const output = compileGroundedTailoredResume({
        plan, factRegistry: registry, renderDescriptors: descriptors, jdAnalysis: fictionalSmokeJD,
      });
      expect(evaluateTailoredResumeFactuality(output.grounded, registry, []).status).toBe("pass");
      return output.grounded.sections.find((section) => section.type === "projects")!.lines[0].text;
    });
    expect(new Set(texts).size).toBe(3);
  });

  it("fails instead of truncating the minimum legal combination", () => {
    const { projects } = setup();
    const first = fact(projects, 0, "responsibility");
    const second = fact(projects, 0, "technology");
    expect(() => compileProjectDescriptions({
      rewritePlans: [{ projectId: first.project.projectReference, bullets: [{ pattern: "action_technology", factIds: [first.id, second.id] }] }],
      projectFacts: projects,
      characterLimit: 5,
    })).toThrowError("PROJECT_DESCRIPTION_LENGTH_BUDGET_FAILED");
  });

  it("integrates compiled project bullets into Grounded output and passes factuality", () => {
    const { registry, projects, descriptors } = setup();
    const first = fact(projects, 0, "responsibility");
    const second = fact(projects, 0, "technology");
    const plan = emptyPlan();
    plan.projectRewrites = [{
      projectId: first.project.projectReference,
      bullets: [{ pattern: "action_technology", factIds: [first.id, second.id] }],
    }];
    const compiled = compileGroundedTailoredResume({
      plan, factRegistry: registry, renderDescriptors: descriptors, jdAnalysis: fictionalSmokeJD,
    });
    const projectLines = compiled.grounded.sections.find((section) => section.type === "projects")!.lines;
    expect(projectLines).toHaveLength(1);
    expect(projectLines[0].sourceFactIds).toEqual([first.id, second.id]);
    expect(evaluateTailoredResumeFactuality(compiled.grounded, registry, []).status).toBe("pass");
  });

  it.each([
    ["invented technology", "，使用Redis"],
    ["invented metric", "，提升99%"],
    ["project type escalation", "，生产系统"],
    ["role escalation", "，负责整体架构"],
    ["strength escalation", "，熟练掌握"],
    ["unsupported result", "，取得商业成功"],
  ])("project factuality rejects %s", (_, inventedText) => {
    const { projects } = setup();
    const first = fact(projects, 0, "responsibility");
    const second = fact(projects, 0, "technology");
    const [compiled] = compileProjectDescriptions({
      rewritePlans: [{ projectId: first.project.projectReference, bullets: [{ pattern: "action_technology", factIds: [first.id, second.id] }] }],
      projectFacts: projects,
      characterLimit: 80,
    });
    const report = evaluateProjectDescriptionFactuality(
      [{ ...compiled, text: compiled.text + inventedText }],
      projects,
    );
    expect(report).toMatchObject({ status: "fail", violations: ["PROJECT_TEXT_NOT_DETERMINISTIC"] });
  });

  it("project factuality rejects unknown, missing and cross-project evidence", () => {
    const { projects } = setup();
    const first = fact(projects, 0, "responsibility");
    const second = fact(projects, 0, "technology");
    const other = fact(projects, 1, "technology");
    const base = {
      projectId: first.project.projectReference,
      text: `${first.text}，使用${second.text}`,
      sourceFactIds: [first.id, second.id],
      kind: "fact" as const,
      pattern: "action_technology" as const,
    };
    expect(evaluateProjectDescriptionFactuality([{ ...base, sourceFactIds: [] }], projects).violations)
      .toContain("MISSING_PROJECT_SOURCE");
    expect(evaluateProjectDescriptionFactuality([{ ...base, sourceFactIds: [first.id, "F_PROJECT_AAAAAAAAAAAA"] }], projects).violations)
      .toContain("UNKNOWN_PROJECT_ATOM");
    expect(evaluateProjectDescriptionFactuality([{ ...base, sourceFactIds: [first.id, other.id] }], projects).violations)
      .toContain("CROSS_PROJECT_ATOM");
  });
});
