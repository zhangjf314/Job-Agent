import { ZodError } from "zod";
import {
  GROUNDED_SECTION_TYPES_BY_POSITION,
} from "./grounded-tailored-resume-contract";
import type {
  CandidateFact,
  CandidateFactRenderDescriptor,
  ProjectCandidateFact,
} from "./candidate-fact-registry";
import { isProjectCandidateFact } from "./candidate-fact-registry";
import { patternMatchesFacts } from "./project-description-compiler";
import {
  TAILORED_RESUME_PLAN_LIMITS,
  tailoredResumePlanSchema,
  type TailoredResumePlan,
} from "./tailored-resume-plan";

export type TailoredResumePlanErrorCode =
  | "TAILORED_PLAN_SCHEMA_INVALID"
  | "TAILORED_PLAN_UNKNOWN_FACT_ID"
  | "TAILORED_PLAN_JD_REQUIREMENT_ID"
  | "TAILORED_PLAN_DUPLICATE_FACT_ID"
  | "TAILORED_PLAN_PRIORITY_INVALID"
  | "TAILORED_PLAN_FACT_USAGE_LIMIT"
  | "TAILORED_PLAN_UNRENDERABLE_FACT"
  | "PROJECT_REWRITE_PLAN_SCHEMA_INVALID"
  | "PROJECT_REWRITE_UNKNOWN_PROJECT"
  | "PROJECT_REWRITE_UNKNOWN_ATOM"
  | "PROJECT_REWRITE_CROSS_PROJECT_FACT"
  | "PROJECT_REWRITE_JD_REQUIREMENT_FACT"
  | "PROJECT_REWRITE_DUPLICATE_ATOM"
  | "PROJECT_REWRITE_UNRENDERABLE_ATOM"
  | "PROJECT_REWRITE_PATTERN_INVALID"
  | "PROJECT_REWRITE_CARDINALITY_INVALID";

export type TailoredResumePlanValidationDiagnostics = {
  selectedFactCount: number;
  selectedReferenceCount: number;
  unrenderableSelectedFactCount: number;
  selectedProjectCount: number;
  selectedProjectAtomCount: number;
};

export class TailoredResumePlanError extends Error {
  readonly name = "TailoredResumePlanError";

  constructor(
    readonly code: TailoredResumePlanErrorCode,
    readonly diagnostics?: Partial<TailoredResumePlanValidationDiagnostics>,
  ) {
    super(code);
  }
}

export function planSelectionArrays(plan: TailoredResumePlan) {
  return [
    ...GROUNDED_SECTION_TYPES_BY_POSITION.map(
      (sectionType) => plan.sections[sectionType].factIds,
    ),
    plan.applicationMaterials.selfIntroductionFactIds,
    plan.applicationMaterials.applicationEmailFactIds,
    plan.applicationMaterials.recruiterMessageFactIds,
  ];
}

function fail(
  code: TailoredResumePlanErrorCode,
  diagnostics?: Partial<TailoredResumePlanValidationDiagnostics>,
): never {
  throw new TailoredResumePlanError(code, diagnostics);
}

export function validateTailoredResumePlan(
  input: unknown,
  facts: CandidateFact[],
  descriptors: CandidateFactRenderDescriptor[],
  projectFacts: ProjectCandidateFact[] = facts.filter(isProjectCandidateFact),
): {
  plan: TailoredResumePlan;
  diagnostics: TailoredResumePlanValidationDiagnostics;
} {
  let plan: TailoredResumePlan;
  try {
    plan = tailoredResumePlanSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const projectIssue = error.issues.find((issue) => issue.path[0] === "projectRewrites");
      if (projectIssue) {
        if (projectIssue.path.includes("pattern")) fail("PROJECT_REWRITE_PATTERN_INVALID");
        if (projectIssue.code === "too_big" || projectIssue.code === "custom") {
          fail("PROJECT_REWRITE_CARDINALITY_INVALID");
        }
        fail("PROJECT_REWRITE_PLAN_SCHEMA_INVALID");
      }
      fail("TAILORED_PLAN_SCHEMA_INVALID");
    }
    throw error;
  }

  const arrays = [...planSelectionArrays(plan), plan.priorityFactIds];
  if (
    arrays.some((values) => new Set(values).size !== values.length) ||
    new Set(plan.changedSections).size !== plan.changedSections.length
  ) {
    fail("TAILORED_PLAN_DUPLICATE_FACT_ID");
  }

  const allReferences = arrays.flat();
  if (allReferences.some((id) => id.startsWith("J_REQ_"))) {
    fail("TAILORED_PLAN_JD_REQUIREMENT_ID");
  }

  const factIds = new Set(facts.map((fact) => fact.id));
  if (allReferences.some((id) => !factIds.has(id))) {
    fail("TAILORED_PLAN_UNKNOWN_FACT_ID");
  }

  const selectedReferences = planSelectionArrays(plan).flat();
  const projectFactIdSet = new Set(projectFacts.map((fact) => fact.id));
  if (selectedReferences.some((id) => projectFactIdSet.has(id))) {
    fail("PROJECT_REWRITE_PLAN_SCHEMA_INVALID");
  }
  const selectedIds = new Set(selectedReferences);
  if (plan.priorityFactIds.some((id) => !selectedIds.has(id))) {
    fail("TAILORED_PLAN_PRIORITY_INVALID", {
      selectedFactCount: selectedIds.size,
      selectedReferenceCount: selectedReferences.length,
    });
  }

  const usage = new Map<string, number>();
  for (const id of selectedReferences) {
    usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  if (
    [...usage.values()].some(
      (count) => count > TAILORED_RESUME_PLAN_LIMITS.factTotalUsageMax,
    )
  ) {
    fail("TAILORED_PLAN_FACT_USAGE_LIMIT", {
      selectedFactCount: selectedIds.size,
      selectedReferenceCount: selectedReferences.length,
    });
  }

  const descriptorById = new Map(
    descriptors.map((descriptor) => [descriptor.factId, descriptor]),
  );
  const unrenderableSelectedFactCount = [...selectedIds].filter(
    (id) => !descriptorById.get(id)?.renderable,
  ).length;
  if (unrenderableSelectedFactCount > 0) {
    fail("TAILORED_PLAN_UNRENDERABLE_FACT", {
      selectedFactCount: selectedIds.size,
      selectedReferenceCount: selectedReferences.length,
      unrenderableSelectedFactCount,
    });
  }

  const projectReferences = new Map<string, ProjectCandidateFact[]>();
  const projectFactById = new Map(projectFacts.map((fact) => [fact.id, fact]));
  for (const fact of projectFacts) {
    const group = projectReferences.get(fact.project.projectReference) ?? [];
    group.push(fact);
    projectReferences.set(fact.project.projectReference, group);
  }
  if (new Set(plan.projectRewrites.map((rewrite) => rewrite.projectId)).size !== plan.projectRewrites.length) {
    fail("PROJECT_REWRITE_CARDINALITY_INVALID");
  }
  const projectAtomIds = plan.projectRewrites.flatMap((rewrite) =>
    rewrite.bullets.flatMap((bullet) => bullet.factIds),
  );
  if (projectAtomIds.some((id) => id.startsWith("J_REQ_"))) {
    fail("PROJECT_REWRITE_JD_REQUIREMENT_FACT");
  }
  if (new Set(projectAtomIds).size !== projectAtomIds.length) {
    fail("PROJECT_REWRITE_DUPLICATE_ATOM");
  }
  for (const rewrite of plan.projectRewrites) {
    if (!projectReferences.has(rewrite.projectId)) {
      fail("PROJECT_REWRITE_UNKNOWN_PROJECT");
    }
    for (const id of rewrite.bullets.flatMap((bullet) => bullet.factIds)) {
      const fact = projectFactById.get(id);
      if (!fact) fail("PROJECT_REWRITE_UNKNOWN_ATOM");
      if (fact.project.projectReference !== rewrite.projectId) {
        fail("PROJECT_REWRITE_CROSS_PROJECT_FACT");
      }
      if (!fact.project.renderable) fail("PROJECT_REWRITE_UNRENDERABLE_ATOM");
    }
    for (const bullet of rewrite.bullets) {
      const bulletFacts = bullet.factIds
        .map((id) => projectFactById.get(id))
        .filter((fact): fact is ProjectCandidateFact => Boolean(fact));
      if (!patternMatchesFacts(bullet.pattern, bulletFacts)) {
        fail("PROJECT_REWRITE_PATTERN_INVALID");
      }
    }
  }

  return {
    plan,
    diagnostics: {
      selectedFactCount: selectedIds.size,
      selectedReferenceCount: selectedReferences.length,
      unrenderableSelectedFactCount,
      selectedProjectCount: plan.projectRewrites.length,
      selectedProjectAtomCount: new Set(projectAtomIds).size,
    },
  };
}
