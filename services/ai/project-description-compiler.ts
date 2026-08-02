import type { ProjectFactCategory } from "@/types/project-facts";
import type { ProjectCandidateFact } from "./candidate-fact-registry";
import type {
  ProjectRewritePattern,
  TailoredResumePlan,
} from "./tailored-resume-plan";

export type CompiledProjectBullet = {
  projectId: string;
  text: string;
  sourceFactIds: string[];
  kind: "fact";
  pattern: ProjectRewritePattern;
};

export type ProjectDescriptionCompilerErrorCode =
  | "PROJECT_DESCRIPTION_COMPILATION_FAILED"
  | "PROJECT_DESCRIPTION_PATTERN_FACT_MISMATCH"
  | "PROJECT_DESCRIPTION_LENGTH_BUDGET_FAILED"
  | "PROJECT_DESCRIPTION_EMPTY";

export class ProjectDescriptionCompilerError extends Error {
  readonly name = "ProjectDescriptionCompilerError";
  constructor(readonly code: ProjectDescriptionCompilerErrorCode) {
    super(code);
  }
}

type Slot = {
  categories: ProjectFactCategory[];
  strengths?: ProjectCandidateFact["project"]["assertionStrength"][];
};

const actionStrengths = ["implemented", "designed", "led", "achieved"] as const;
const useStrengths = ["used", "implemented", "designed", "led", "achieved"] as const;
const resultStrengths = ["achieved"] as const;

const patternSlots: Record<ProjectRewritePattern, [Slot, Slot]> = {
  action_technology: [
    { categories: ["responsibility", "feature", "solution", "engineering"] },
    { categories: ["technology"], strengths: [...useStrengths] },
  ],
  action_solution: [
    { categories: ["responsibility", "feature", "challenge"] },
    { categories: ["solution"], strengths: [...useStrengths] },
  ],
  feature_implementation: [
    { categories: ["feature"], strengths: [...actionStrengths] },
    { categories: ["technology"], strengths: [...useStrengths] },
  ],
  problem_solution: [
    { categories: ["challenge"] },
    { categories: ["solution"], strengths: [...useStrengths] },
  ],
  solution_result: [
    { categories: ["solution"], strengths: [...useStrengths] },
    { categories: ["result", "metric"], strengths: [...resultStrengths] },
  ],
  engineering_quality: [
    { categories: ["engineering"], strengths: ["designed", "led", "achieved"] },
    { categories: ["result", "metric"], strengths: [...resultStrengths] },
  ],
  responsibility_result: [
    { categories: ["responsibility"], strengths: [...actionStrengths] },
    { categories: ["result", "metric"], strengths: [...resultStrengths] },
  ],
};

function renderPattern(
  pattern: ProjectRewritePattern,
  first: string,
  second: string,
) {
  switch (pattern) {
    case "action_technology": return `${first}，使用${second}`;
    case "action_solution": return `${first}，结合${second}`;
    case "feature_implementation": return `实现${first}，使用${second}`;
    case "problem_solution": return `针对${first}，采用${second}`;
    case "solution_result": return `采用${first}，达到${second}`;
    case "engineering_quality": return `建立${first}，并达到${second}`;
    case "responsibility_result": return `负责${first}，并取得${second}`;
  }
}

export function patternMatchesFacts(
  pattern: ProjectRewritePattern,
  facts: ProjectCandidateFact[],
) {
  const [first, second] = patternSlots[pattern];
  const matches = (fact: ProjectCandidateFact, slot: Slot) =>
    slot.categories.includes(fact.project.category) &&
    (!slot.strengths || slot.strengths.includes(fact.project.assertionStrength));
  return Boolean(
    facts.some((fact) => matches(fact, first)) &&
    facts.some((fact) => matches(fact, second)),
  );
}

export function compileProjectDescriptions(input: {
  rewritePlans: TailoredResumePlan["projectRewrites"];
  projectFacts: ProjectCandidateFact[];
  characterLimit: number;
}): CompiledProjectBullet[] {
  const factById = new Map(input.projectFacts.map((fact) => [fact.id, fact]));
  const compiled: CompiledProjectBullet[] = [];
  for (const rewrite of input.rewritePlans) {
    for (const bullet of rewrite.bullets) {
      const selected = bullet.factIds
        .map((id) => factById.get(id))
        .filter((fact): fact is ProjectCandidateFact => Boolean(fact));
      if (selected.length === 0) {
        throw new ProjectDescriptionCompilerError("PROJECT_DESCRIPTION_EMPTY");
      }
      const [firstSlot, secondSlot] = patternSlots[bullet.pattern];
      const slotMatches = (fact: ProjectCandidateFact, slot: Slot) =>
        slot.categories.includes(fact.project.category) &&
        (!slot.strengths || slot.strengths.includes(fact.project.assertionStrength));
      const first = selected.find((fact) => slotMatches(fact, firstSlot));
      const second = selected.find(
        (fact) => slotMatches(fact, secondSlot) && fact.id !== first?.id,
      );
      if (!first || !second) {
        throw new ProjectDescriptionCompilerError("PROJECT_DESCRIPTION_PATTERN_FACT_MISMATCH");
      }
      const text = renderPattern(bullet.pattern, first.text, second.text);
      if (!text.trim()) {
        throw new ProjectDescriptionCompilerError("PROJECT_DESCRIPTION_EMPTY");
      }
      if (text.length > input.characterLimit) {
        throw new ProjectDescriptionCompilerError("PROJECT_DESCRIPTION_LENGTH_BUDGET_FAILED");
      }
      if (/\.\.\.|…|F_PROJECT_|P_PROJECT_/.test(text)) {
        throw new ProjectDescriptionCompilerError("PROJECT_DESCRIPTION_COMPILATION_FAILED");
      }
      compiled.push({
        projectId: rewrite.projectId,
        text,
        sourceFactIds: [first.id, second.id],
        kind: "fact",
        pattern: bullet.pattern,
      });
    }
  }
  return compiled;
}
