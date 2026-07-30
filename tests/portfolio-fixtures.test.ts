import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_DEMO_MARKER,
  buildPortfolioCompiledResume,
  portfolioBaseResumeMarkdown,
  portfolioJDAnalysis,
  portfolioProfileFixture,
} from "@/scripts/portfolio-fixtures";
import { groundedTailoredResumeSchema } from "@/services/ai/tailored-resume-grounding";
import { tailoredResumePlanSchema } from "@/services/ai/tailored-resume-plan";

describe("portfolio deterministic fixtures", () => {
  const output = buildPortfolioCompiledResume();

  it("uses a fixed demo marker", () => {
    expect(PORTFOLIO_DEMO_MARKER).toBe("portfolio-demo-v1");
  });

  it("labels the base resume as fictional demo data", () => {
    expect(portfolioBaseResumeMarkdown).toContain("Demo Data / 虚构演示数据");
  });

  it("uses the fictional candidate identity", () => {
    expect(portfolioProfileFixture.basicInfo).toMatchObject({
      realName: "林知远",
      email: "lin.zhiyuan@example.com",
      phone: "138-0000-0000",
      location: "杭州",
    });
  });

  it("uses a fictional school", () => {
    expect(portfolioProfileFixture.educationItems[0].school).toContain("虚构");
  });

  it("contains exactly three explicitly bounded projects", () => {
    expect(portfolioProfileFixture.projectItems).toHaveLength(3);
    expect(
      portfolioProfileFixture.projectItems.every((project) =>
        /课程|个人|Demo/.test(
          `${project.role} ${project.background} ${project.highlights.join(" ")}`,
        ),
      ),
    ).toBe(true);
  });

  it("does not provide candidate AI or LLM project facts", () => {
    expect(
      portfolioProfileFixture.projectItems.some((project) =>
        /AI|LLM|大模型/i.test(project.name),
      ),
    ).toBe(false);
  });

  it("keeps the unsupported LLM preference in JD-only data", () => {
    expect(portfolioJDAnalysis.bonusPoints.join(" ")).toContain("大模型");
    expect(
      output.facts.some((fact) => /LLM|大模型/i.test(fact.text)),
    ).toBe(false);
  });

  it("passes the strict Plan Schema", () => {
    expect(tailoredResumePlanSchema.parse(output.plan)).toEqual(output.plan);
  });

  it("contains only candidate fact IDs in the plan", () => {
    expect(JSON.stringify(output.plan)).not.toContain("J_REQ_");
    expect(JSON.stringify(output.plan)).not.toContain('"text"');
  });

  it("passes the existing Grounded Schema", () => {
    expect(groundedTailoredResumeSchema.parse(output.grounded)).toEqual(
      output.grounded,
    );
  });

  it("passes the complete factuality gate", () => {
    expect(output.factuality.status).toBe("pass");
    expect(output.factuality.violations).toEqual([]);
    expect(output.factuality.unknownFactIds).toBe(0);
    expect(output.factuality.missingSourceIds).toBe(0);
  });

  it("emits six canonical sections within compiler budgets", () => {
    expect(output.publicResult.sections).toHaveLength(6);
    expect(Math.max(...output.compilerDiagnostics.sectionLineCounts)).toBeLessThanOrEqual(2);
    expect(output.compilerDiagnostics.maximumLineLength).toBeLessThanOrEqual(80);
    expect(output.compilerDiagnostics.maximumSourceFactIds).toBeLessThanOrEqual(8);
  });

  it("generates complete application materials through the compiler", () => {
    expect(output.publicResult.applicationMaterials.selfIntroduction).not.toBe("");
    expect(output.publicResult.applicationMaterials.applicationEmail).not.toBe("");
    expect(output.publicResult.applicationMaterials.recruiterMessage).not.toBe("");
  });

  it("does not write the unsupported JD preference as a candidate claim", () => {
    expect(output.publicResult.contentMarkdown).not.toMatch(/大模型.*(经验|项目)/);
  });

  it("is deterministic across repeated builds", () => {
    expect(buildPortfolioCompiledResume()).toEqual(output);
  });
});
