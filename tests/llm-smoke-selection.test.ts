import { describe, expect, it } from "vitest";
import {
  parseSmokeSelection,
  smokeCases,
  smokeRequestBudget,
} from "@/scripts/llm-smoke-selection";

describe("LLM smoke selection", () => {
  it("keeps the default full smoke behavior", () => {
    expect([...parseSmokeSelection([])]).toEqual(smokeCases);
  });

  it("selects tailored resume without connection, JD analysis, or career strategy", () => {
    const selected = parseSmokeSelection(["--only=tailored-resume"]);
    expect([...selected]).toEqual(["tailored-resume"]);
    expect(selected.has("connection")).toBe(false);
    expect(selected.has("jd-analysis")).toBe(false);
    expect(selected.has("career-strategy")).toBe(false);
    expect(smokeRequestBudget(selected)).toBe(2);
  });

  it("accepts only fixed whitelist names", () => {
    expect(() => parseSmokeSelection(["--only=../../secret"])).toThrow(/Unsupported smoke case/);
    expect(() => parseSmokeSelection(["--only=custom-module"])).toThrow(/Unsupported smoke case/);
    expect(() => parseSmokeSelection(["--file=anything"])).toThrow(/only one optional/);
    expect(() => parseSmokeSelection(["--only="])).toThrow(/cannot be empty/);
  });
});
