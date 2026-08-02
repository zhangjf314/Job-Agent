import type { ProjectCandidateFact } from "./candidate-fact-registry";
import {
  compileProjectDescriptions,
  type CompiledProjectBullet,
} from "./project-description-compiler";

export type ProjectFactualityViolationCategory =
  | "UNKNOWN_PROJECT_ATOM"
  | "CROSS_PROJECT_ATOM"
  | "MISSING_PROJECT_SOURCE"
  | "PROJECT_TEXT_NOT_DETERMINISTIC";

export type ProjectFactualityReport = {
  status: "pass" | "fail";
  violations: ProjectFactualityViolationCategory[];
};

export function evaluateProjectDescriptionFactuality(
  bullets: CompiledProjectBullet[],
  projectFacts: ProjectCandidateFact[],
  characterLimit = 80,
): ProjectFactualityReport {
  const factById = new Map(projectFacts.map((fact) => [fact.id, fact]));
  const violations: ProjectFactualityViolationCategory[] = [];
  for (const bullet of bullets) {
    if (bullet.sourceFactIds.length === 0) violations.push("MISSING_PROJECT_SOURCE");
    const facts = bullet.sourceFactIds.map((id) => factById.get(id));
    if (facts.some((fact) => !fact)) {
      violations.push("UNKNOWN_PROJECT_ATOM");
      continue;
    }
    if (facts.some((fact) => fact!.project.projectReference !== bullet.projectId)) {
      violations.push("CROSS_PROJECT_ATOM");
      continue;
    }
    try {
      const expected = compileProjectDescriptions({
        rewritePlans: [{
          projectId: bullet.projectId,
          bullets: [{ pattern: bullet.pattern, factIds: bullet.sourceFactIds }],
        }],
        projectFacts,
        characterLimit,
      })[0];
      if (
        !expected || expected.text !== bullet.text ||
        expected.sourceFactIds.join("|") !== bullet.sourceFactIds.join("|")
      ) {
        violations.push("PROJECT_TEXT_NOT_DETERMINISTIC");
      }
    } catch {
      violations.push("PROJECT_TEXT_NOT_DETERMINISTIC");
    }
  }
  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations: [...new Set(violations)],
  };
}

export class ProjectDescriptionFactualityError extends Error {
  readonly name = "ProjectDescriptionFactualityError";
  readonly code = "PROJECT_DESCRIPTION_FACTUALITY_VIOLATION";
  constructor(readonly report: ProjectFactualityReport) {
    super("PROJECT_DESCRIPTION_FACTUALITY_VIOLATION");
  }
}
