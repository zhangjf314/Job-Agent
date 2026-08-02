import { describe, expect, it } from "vitest";
import {
  buildCandidateFactRegistry,
  buildCandidateFactRenderDescriptors,
} from "@/services/ai/candidate-fact-registry";
import {
  compileGroundedTailoredResume,
  renderFactGroups,
} from "@/services/ai/tailored-resume-grounded-compiler";
import {
  evaluateTailoredResumeFactuality,
} from "@/services/ai/tailored-resume-factuality";
import {
  buildJobRequirementFacts,
} from "@/services/ai/candidate-fact-registry";
import {
  GROUNDED_SECTION_TYPES_BY_POSITION,
} from "@/services/ai/grounded-tailored-resume-contract";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeJD,
  fictionalSmokeProfile,
} from "@/scripts/llm-smoke-fixtures";
import type { TailoredResumePlan } from "@/services/ai/tailored-resume-plan";

const facts = buildCandidateFactRegistry(
  fictionalSmokeProfile,
  fictionalSmokeBaseResume,
);
const descriptors = buildCandidateFactRenderDescriptors(facts);
const byCategory = (category: string) =>
  facts.filter((fact) => fact.category === category).map((fact) => fact.id);

function plan(): TailoredResumePlan {
  const skills = byCategory("skill");
  const projects = facts
    .filter((fact) => fact.category.startsWith("project"))
    .map((fact) => fact.id);
  const education = byCategory("education");
  const selected = [...skills, ...projects, ...education];
  return {
    sections: {
      summary: { factIds: selected.slice(0, 5) },
      skills: { factIds: skills },
      projects: { factIds: projects },
      experiences: { factIds: [] },
      education: { factIds: education },
      others: { factIds: [] },
    },
    applicationMaterials: {
      selfIntroductionFactIds: skills.slice(0, 2),
      applicationEmailFactIds: projects.slice(0, 8),
      recruiterMessageFactIds: education.slice(0, 1),
    },
    changedSections: ["projects", "skills"],
    priorityFactIds: selected.slice(0, 20),
    projectRewrites: [],
  };
}

describe("deterministic grounded compiler", () => {
  const output = compileGroundedTailoredResume({
    plan: plan(),
    factRegistry: facts,
    renderDescriptors: descriptors,
    jdAnalysis: fictionalSmokeJD,
  });

  it("always emits exactly six canonical sections", () => {
    expect(output.grounded.sections.map((section) => section.type)).toEqual(
      GROUNDED_SECTION_TYPES_BY_POSITION,
    );
    expect(output.grounded.sections.map((section) => section.order)).toEqual(
      [0, 1, 2, 3, 4, 5],
    );
  });

  it("emits no more than two lines per section", () => {
    expect(Math.max(...output.diagnostics.sectionLineCounts)).toBeLessThanOrEqual(2);
  });

  it("keeps every compiled claim within 80 characters", () => {
    expect(output.diagnostics.maximumLineLength).toBeLessThanOrEqual(80);
  });

  it("keeps each source list within eight IDs", () => {
    expect(output.diagnostics.maximumSourceFactIds).toBeLessThanOrEqual(8);
  });

  it("uses only fact, goal, and format claim kinds", () => {
    const kinds = [
      ...output.grounded.sections.flatMap((section) => section.lines),
      ...Object.values(output.grounded.applicationMaterials).flat(),
    ].map((claim) => claim.kind);
    expect(kinds.every((kind) =>
      ["fact", "goal", "format"].includes(kind),
    )).toBe(true);
  });

  it("builds complete application-material arrays", () => {
    expect(output.diagnostics.applicationMaterialLineCounts).toEqual([2, 2, 2]);
  });

  it("sorts changed sections canonically", () => {
    expect(output.grounded.changedSections).toEqual(["skills", "projects"]);
  });

  it("creates rewrite explanations as an array", () => {
    expect(Array.isArray(output.grounded.rewriteExplanation)).toBe(true);
    expect(output.grounded.rewriteExplanation).toHaveLength(2);
  });

  it("leaves experience lines empty when no experience facts exist", () => {
    expect(output.grounded.sections[3].lines).toEqual([]);
  });

  it("reports missing real experience deterministically", () => {
    expect(output.grounded.missingFields).toContain("缺少工作或实习事实");
  });

  it("passes the existing complete factuality gate", () => {
    const report = evaluateTailoredResumeFactuality(
      output.grounded,
      facts,
      buildJobRequirementFacts(fictionalSmokeJD, facts),
    );
    expect(report.status).toBe("pass");
    expect(report.violations).toEqual([]);
  });

  it("never cites a fact omitted from rendered text", () => {
    const factLines = output.grounded.sections
      .flatMap((section) => section.lines)
      .filter((line) => line.kind === "fact");
    for (const line of factLines) {
      for (const id of line.sourceFactIds) {
        expect(line.text).toContain(
          descriptors.find((descriptor) => descriptor.factId === id)!.safePhrase,
        );
      }
    }
  });

  it("packs complete phrases without truncation or ellipses", () => {
    const selected = descriptors.filter((descriptor) => descriptor.renderable).slice(0, 4);
    const lines = renderFactGroups(selected, 30);
    expect(lines.every((line) => !line.text.includes("…"))).toBe(true);
    expect(lines.every((line) =>
      line.sourceFactIds.every((id) =>
        line.text.includes(
          selected.find((descriptor) => descriptor.factId === id)!.safePhrase,
        ),
      ),
    )).toBe(true);
  });

  it("is byte-for-byte deterministic for the same inputs", () => {
    const repeated = compileGroundedTailoredResume({
      plan: plan(),
      factRegistry: facts,
      renderDescriptors: descriptors,
      jdAnalysis: fictionalSmokeJD,
    });
    expect(repeated).toEqual(output);
  });
});
