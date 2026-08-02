import { describe, expect, it, vi } from "vitest";
import {
  parseSmokeArguments,
  parseSmokeSelection,
  smokeCases,
  smokeRequestBudget,
  smokeRequestPolicy,
} from "@/scripts/llm-smoke-selection";
import { createSmokeRequestLimiter } from "@/scripts/llm-smoke-request-limit";
import { fictionalProjectRewriteSmokeProfile } from "@/scripts/llm-smoke-fixtures";
import {
  buildCandidateFactRegistry,
  isProjectCandidateFact,
} from "@/services/ai/candidate-fact-registry";
import { readFileSync } from "node:fs";

describe("LLM smoke selection", () => {
  it("uses a fictional atomized project for the one-request rewrite smoke", () => {
    const facts = buildCandidateFactRegistry(fictionalProjectRewriteSmokeProfile);
    expect(facts.filter(isProjectCandidateFact).length).toBeGreaterThan(0);
    expect(fictionalProjectRewriteSmokeProfile.projectItems[0].fullDescription).toBeTruthy();
  });

  it("reports project pipeline statuses and only safe aggregate smoke fields", () => {
    const source = readFileSync("scripts/llm-smoke.ts", "utf8");
    for (const field of [
      "projectPlanStatus", "projectPlanValidationStatus", "projectCompilationStatus",
      "projectCountAvailable", "projectCountSelected", "projectRewritePlanCount",
      "projectBulletCount", "projectFactualityViolationCount", "projectEvidenceSubsetVerified",
    ]) expect(source).toContain(field);
    expect(source).not.toContain("console.log(projectFacts");
  });
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
    expect(() => parseSmokeSelection(["--file=anything"])).toThrow(/accepts only/);
    expect(() => parseSmokeSelection(["--only="])).toThrow(/cannot be empty/);
  });

  it("accepts a bounded explicit external request maximum", () => {
    const parsed = parseSmokeArguments([
      "--only=tailored-resume",
      "--max-external-requests=2",
    ]);
    expect([...parsed.selected]).toEqual(["tailored-resume"]);
    expect(parsed.maxExternalRequests).toBe(2);
    expect(smokeRequestBudget(parsed.selected, parsed.maxExternalRequests)).toBe(2);
  });

  it.each(["0", "7", "1.5", "01", "NaN", "../../secret"])(
    "rejects unsafe external request maximum %s",
    (value) => {
      expect(() => parseSmokeArguments([
        "--max-external-requests=" + value,
      ])).toThrow(/safe integer/);
    },
  );

  it("rejects duplicate arguments and path or module injection", () => {
    expect(() => parseSmokeArguments([
      "--max-external-requests=1",
      "--max-external-requests=2",
    ])).toThrow(/accepts only/);
    expect(() => parseSmokeArguments(["--module=../../secret"]))
      .toThrow(/accepts only/);
  });

  it("blocks every external request beyond the hard limit with the dedicated code", async () => {
    const transport = vi.fn(async () => new Response("ok"));
    const limited = createSmokeRequestLimiter(transport as typeof fetch, 1);
    await expect(limited("https://example.test")).resolves.toBeInstanceOf(Response);
    await expect(limited("https://example.test")).rejects.toMatchObject({
      code: "SMOKE_EXTERNAL_REQUEST_LIMIT_REACHED",
      retryable: false,
    });
    expect(transport).toHaveBeenCalledOnce();
  });

  it("reserves only factuality repair when an explicit budget has a second request", () => {
    expect(smokeRequestPolicy(1)).toEqual({
      allowTransportRetry: false,
      allowJsonRepair: false,
      allowFactualityRepair: false,
      allowFinalizationRetry: false,
    });
    expect(smokeRequestPolicy(2)).toEqual({
      allowTransportRetry: false,
      allowJsonRepair: false,
      allowFactualityRepair: true,
      allowFinalizationRetry: false,
    });
    expect(smokeRequestPolicy()).toBeUndefined();
  });
});
