import type { JDAnalysisResult } from "@/types/jd";
import {
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_TAILORED_RESUME_LIMITS,
} from "./grounded-tailored-resume-contract";
import type {
  CandidateFact,
  CandidateFactRenderDescriptor,
  GroundedSectionType,
} from "./candidate-fact-registry";
import {
  groundedTailoredResumeSchema,
  type GroundedTailoredResume,
  type GroundedText,
} from "./tailored-resume-grounding";
import {
  normalizeGroundedTailoredResume,
  type GroundedNormalizationSummary,
} from "./tailored-resume-grounded-normalizer";
import type { TailoredResumePlan } from "./tailored-resume-plan";
import { planSelectionArrays } from "./tailored-resume-plan-validator";
import {
  renderTailoredResumeApplicationMaterials,
} from "./tailored-resume-application-material-renderer";

export type GroundedCompilerDiagnostics = {
  selectedFactCount: number;
  renderedFactCount: number;
  omittedFactCount: number;
  unrenderableFactCount: number;
  sectionFactSelectionCounts: number[];
  sectionLineCounts: number[];
  maximumLineLength: number;
  maximumSourceFactIds: number;
  applicationMaterialLineCounts: number[];
};

export class DeterministicGroundedCompilerError extends Error {
  readonly name = "DeterministicGroundedCompilerError";

  constructor(
    readonly code:
      | "DETERMINISTIC_COMPILER_SCHEMA_BUG"
      | "DETERMINISTIC_COMPILER_FACTUALITY_BUG",
    readonly diagnostics?: GroundedCompilerDiagnostics,
  ) {
    super(code);
  }
}

const titles: Record<GroundedSectionType, string> = {
  summary: "个人概况",
  skills: "技能",
  projects: "项目经历",
  experiences: "工作与实习经历",
  education: "教育经历",
  others: "其他",
};

function orderedDescriptors(
  factIds: string[],
  descriptorById: Map<string, CandidateFactRenderDescriptor>,
  priority: Map<string, number>,
  registryOrder: Map<string, number>,
) {
  return factIds
    .map((id) => descriptorById.get(id))
    .filter(
      (descriptor): descriptor is CandidateFactRenderDescriptor =>
        descriptor !== undefined && descriptor.renderable,
    )
    .sort(
      (left, right) =>
        (priority.get(left.factId) ?? Number.MAX_SAFE_INTEGER) -
          (priority.get(right.factId) ?? Number.MAX_SAFE_INTEGER) ||
        (registryOrder.get(left.factId) ?? Number.MAX_SAFE_INTEGER) -
          (registryOrder.get(right.factId) ?? Number.MAX_SAFE_INTEGER),
    );
}

/**
 * Greedily packs complete registry phrases. It never truncates a phrase,
 * creates ellipses, or cites a fact that was not included in the line.
 */
export function renderFactGroups(
  descriptors: CandidateFactRenderDescriptor[],
  maximumCharacters = 80,
): GroundedText[] {
  const lines: GroundedText[] = [];
  let current: CandidateFactRenderDescriptor[] = [];
  const flush = () => {
    if (current.length === 0) return;
    lines.push({
      text: current.map((item) => item.safePhrase).join("；"),
      sourceFactIds: current.map((item) => item.factId),
      kind: "fact",
    });
    current = [];
  };

  for (const descriptor of descriptors) {
    if (lines.length >= GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax) break;
    if (
      current.length > 0 &&
      current[0].renderGroup !== descriptor.renderGroup
    ) {
      flush();
      if (lines.length >= GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax) break;
    }
    const next = [...current, descriptor];
    const nextText = next.map((item) => item.safePhrase).join("；");
    if (
      next.length > GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax ||
      nextText.length > maximumCharacters
    ) {
      flush();
      if (lines.length >= GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax) break;
    }
    current.push(descriptor);
  }
  if (lines.length < GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax) flush();
  return lines;
}

function deterministicMissingFields(facts: CandidateFact[]) {
  const categories = new Set(facts.map((fact) => fact.category));
  const missing: string[] = [];
  if (!categories.has("employment") && !categories.has("internship")) {
    missing.push("缺少工作或实习事实");
  }
  if (!categories.has("project")) missing.push("缺少项目事实");
  return missing.slice(0, 2);
}

function improvementQuestions(missingFields: string[]) {
  return missingFields.map((field) =>
    field.includes("工作或实习")
      ? "是否可以补充真实的工作或实习经历？"
      : "是否可以补充真实的项目经历？",
  );
}

function allClaims(input: GroundedTailoredResume) {
  return [
    ...input.sections.flatMap((section) => section.lines),
    ...Object.values(input.applicationMaterials).flat(),
  ];
}

export function compileGroundedTailoredResume(input: {
  plan: TailoredResumePlan;
  factRegistry: CandidateFact[];
  renderDescriptors: CandidateFactRenderDescriptor[];
  jdAnalysis: JDAnalysisResult;
}): {
  grounded: GroundedTailoredResume;
  diagnostics: GroundedCompilerDiagnostics;
  normalizationSummary: GroundedNormalizationSummary;
} {
  void input.jdAnalysis;
  const descriptorById = new Map(
    input.renderDescriptors.map((descriptor) => [
      descriptor.factId,
      descriptor,
    ]),
  );
  const priority = new Map(
    input.plan.priorityFactIds.map((factId, index) => [factId, index]),
  );
  const registryOrder = new Map(
    input.factRegistry.map((fact, index) => [fact.id, index]),
  );
  const sectionFactSelectionCounts: number[] = [];

  const sections = GROUNDED_SECTION_TYPES_BY_POSITION.map(
    (sectionType, order) => {
      const eligible = orderedDescriptors(
        input.plan.sections[sectionType].factIds,
        descriptorById,
        priority,
        registryOrder,
      ).filter((descriptor) =>
        descriptor.sectionEligibility.includes(sectionType),
      );
      sectionFactSelectionCounts.push(eligible.length);
      const lines = renderFactGroups(eligible);
      return {
        type: sectionType,
        title: titles[sectionType],
        lines,
        order,
      };
    },
  );

  const applicationMaterials =
    renderTailoredResumeApplicationMaterials(
      input.plan,
      input.renderDescriptors,
    );
  const missingFields = deterministicMissingFields(input.factRegistry);
  const selectedIds = new Set(planSelectionArrays(input.plan).flat());
  const unrenderableFactCount = [...selectedIds].filter(
    (id) => !descriptorById.get(id)?.renderable,
  ).length;
  const qualityWarnings: string[] = [];
  if (unrenderableFactCount > 0) {
    qualityWarnings.push("部分事实无法安全渲染");
  }

  const raw = {
    sections,
    rewriteExplanation: input.plan.changedSections.map(
      (sectionType) => `突出与岗位最相关的${titles[sectionType]}事实`,
    ),
    changedSections: [...input.plan.changedSections].sort(
      (left, right) =>
        GROUNDED_SECTION_TYPES_BY_POSITION.indexOf(left) -
        GROUNDED_SECTION_TYPES_BY_POSITION.indexOf(right),
    ),
    missingFields,
    improvementQuestions: improvementQuestions(missingFields),
    qualityWarnings,
    applicationMaterials,
  };

  try {
    const normalized = normalizeGroundedTailoredResume(raw);
    const grounded = groundedTailoredResumeSchema.parse(normalized.normalized);
    const claims = allClaims(grounded);
    const renderedIds = new Set(
      claims.flatMap((claim) => claim.sourceFactIds),
    );
    const diagnostics: GroundedCompilerDiagnostics = {
      selectedFactCount: selectedIds.size,
      renderedFactCount: renderedIds.size,
      omittedFactCount: [...selectedIds].filter(
        (id) => !renderedIds.has(id),
      ).length,
      unrenderableFactCount,
      sectionFactSelectionCounts,
      sectionLineCounts: sections.map((section) => section.lines.length),
      maximumLineLength: Math.max(
        0,
        ...claims.map((claim) => claim.text.length),
      ),
      maximumSourceFactIds: Math.max(
        0,
        ...claims.map((claim) => claim.sourceFactIds.length),
      ),
      applicationMaterialLineCounts: [
        applicationMaterials.selfIntroduction.length,
        applicationMaterials.applicationEmail.length,
        applicationMaterials.recruiterMessage.length,
      ],
    };
    return {
      grounded,
      diagnostics,
      normalizationSummary: normalized.summary,
    };
  } catch {
    throw new DeterministicGroundedCompilerError(
      "DETERMINISTIC_COMPILER_SCHEMA_BUG",
    );
  }
}
