import { ZodError } from "zod";
import {
  GROUNDED_SECTION_TYPES_BY_POSITION,
} from "./grounded-tailored-resume-contract";
import type {
  CandidateFact,
  CandidateFactRenderDescriptor,
} from "./candidate-fact-registry";
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
  | "TAILORED_PLAN_UNRENDERABLE_FACT";

export type TailoredResumePlanValidationDiagnostics = {
  selectedFactCount: number;
  selectedReferenceCount: number;
  unrenderableSelectedFactCount: number;
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
): {
  plan: TailoredResumePlan;
  diagnostics: TailoredResumePlanValidationDiagnostics;
} {
  let plan: TailoredResumePlan;
  try {
    plan = tailoredResumePlanSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) fail("TAILORED_PLAN_SCHEMA_INVALID");
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

  return {
    plan,
    diagnostics: {
      selectedFactCount: selectedIds.size,
      selectedReferenceCount: selectedReferences.length,
      unrenderableSelectedFactCount,
    },
  };
}
