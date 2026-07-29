import { describe, expect, it } from "vitest";
import {
  buildCandidateFactRenderDescriptors,
  type CandidateFact,
} from "@/services/ai/candidate-fact-registry";

function fact(
  category: CandidateFact["category"],
  text: string,
  id = `F_${category.toUpperCase()}_001`,
): CandidateFact {
  return { id, category, text, canonicalTerms: [text.toLowerCase()] };
}

describe("candidate fact render descriptors", () => {
  it("preserves a skill fact as its safe phrase", () => {
    const input = fact("skill", "TypeScript · 基础");
    expect(buildCandidateFactRenderDescriptors([input])[0]).toMatchObject({
      safePhrase: input.text,
      renderable: true,
      sectionEligibility: ["summary", "skills"],
    });
  });

  it("preserves a project fact as its safe phrase", () => {
    const input = fact("project", "课程任务管理系统");
    expect(buildCandidateFactRenderDescriptors([input])[0]).toMatchObject({
      safePhrase: input.text,
      sectionEligibility: ["summary", "projects"],
    });
  });

  it("preserves an education fact as its safe phrase", () => {
    const input = fact("education", "示例大学 · 计算机科学 · 本科");
    expect(buildCandidateFactRenderDescriptors([input])[0]).toMatchObject({
      safePhrase: input.text,
      sectionEligibility: ["summary", "education"],
    });
  });

  it("preserves an experience fact as its safe phrase", () => {
    const input = fact("internship", "示例公司 · 开发实习生");
    expect(buildCandidateFactRenderDescriptors([input])[0]).toMatchObject({
      safePhrase: input.text,
      sectionEligibility: ["summary", "experiences"],
    });
  });

  it("does not upgrade skill strength", () => {
    const input = fact("skill", "Python · 了解");
    const descriptor = buildCandidateFactRenderDescriptors([input])[0];
    expect(descriptor.safePhrase).toBe("Python · 了解");
    expect(descriptor.safePhrase).not.toContain("熟练");
    expect(descriptor.safePhrase).not.toContain("精通");
  });

  it("does not invent AI or LLM experience", () => {
    const input = fact("project", "课程任务管理系统");
    const descriptor = buildCandidateFactRenderDescriptors([input])[0];
    expect(descriptor.safePhrase).not.toMatch(/AI|LLM|大模型/i);
  });

  it("marks a phrase longer than the Grounded limit unrenderable", () => {
    const input = fact("achievement", "完整事实".repeat(21));
    expect(
      buildCandidateFactRenderDescriptors([input])[0].renderable,
    ).toBe(false);
  });

  it("does not mutate registry facts", () => {
    const input = fact("project_responsibility", "课程项目：编写单元测试");
    const snapshot = structuredClone(input);
    buildCandidateFactRenderDescriptors([input]);
    expect(input).toEqual(snapshot);
  });
});
