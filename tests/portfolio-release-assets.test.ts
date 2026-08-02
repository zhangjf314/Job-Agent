import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PORTFOLIO_SCREENSHOTS } from "@/scripts/portfolio-screenshot-manifest";

describe("portfolio release assets", () => {
  const readme = readFileSync(resolve("README.md"), "utf8");

  it("references every expected screenshot", () => {
    for (const screenshot of PORTFOLIO_SCREENSHOTS) {
      expect(readme).toContain(`docs/screenshots/${screenshot.filename}`);
    }
  });

  it("contains no duplicate screenshot filenames", () => {
    expect(new Set(
      PORTFOLIO_SCREENSHOTS.map((item) => item.filename),
    ).size).toBe(PORTFOLIO_SCREENSHOTS.length);
  });

  it("defines the stable 15-page capture flow", () => {
    expect(PORTFOLIO_SCREENSHOTS).toHaveLength(15);
  });

  it("links all required documentation", () => {
    for (const link of [
      "docs/architecture/portfolio-architecture.md",
      "docs/architecture/tailored-resume-pipeline.md",
      "docs/demo/portfolio-demo-script.md",
      "docs/demo/interview-talking-points.md",
    ]) {
      expect(readme).toContain(link);
      expect(existsSync(resolve(link))).toBe(true);
    }
  });

  it("states that Demo mode uses no external LLM", () => {
    expect(readme).toMatch(/Portfolio Demo 不会调用外部 LLM/);
  });

  it("keeps the real validation wording bounded as a smoke", () => {
    expect(readme).toContain("单次功能验收");
    expect(readme).toContain("不代表性能或成本基准");
  });

  it("keeps screenshot script free of LLM client imports", () => {
    const script = readFileSync(
      resolve("scripts/portfolio-screenshots.ts"),
      "utf8",
    );
    expect(script).not.toMatch(/LLMClient|structuredCompletion|smoke:llm/);
    expect(script).toContain("banner.boundingBox()");
    expect(script).toContain("outside the screenshot viewport");
  });
});
