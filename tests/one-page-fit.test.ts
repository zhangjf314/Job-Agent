import { describe, expect, it } from "vitest";
import {
  calculateOnePageFit,
  ONE_PAGE_FIT_LIMITS,
} from "@/lib/resume/one-page-fit";

describe("smart one-page fit", () => {
  it.each([
    [100, 100],
    [99, 100],
    [1, 100],
  ])("keeps fitting content at 100%% (%s/%s)", (contentHeight, availableHeight) => {
    const result = calculateOnePageFit({ contentHeight, availableHeight });
    expect(result.status).toBe("fits_without_scaling");
    expect(result.selectedScale).toBe(1);
    expect(result.overflowAmount).toBe(0);
  });

  it.each([
    [110, 100],
    [112, 100],
    [1000, 900],
    [280, 260],
  ])("finds the largest readable fitting scale (%s/%s)", (contentHeight, availableHeight) => {
    const result = calculateOnePageFit({ contentHeight, availableHeight });
    expect(result.status).toBe("fitted");
    expect(result.selectedScale).toBeGreaterThanOrEqual(ONE_PAGE_FIT_LIMITS.minimumScale);
    expect(result.fittedHeight).toBeLessThanOrEqual(availableHeight);
    expect(contentHeight * (result.selectedScale + 0.003)).toBeGreaterThan(availableHeight);
  });

  it.each([
    [120, 100],
    [1000, 870],
    [500, 400],
  ])("refuses to scale below the readability floor (%s/%s)", (contentHeight, availableHeight) => {
    const result = calculateOnePageFit({ contentHeight, availableHeight });
    expect(result.status).toBe("cannot_fit");
    expect(result.selectedScale).toBe(ONE_PAGE_FIT_LIMITS.minimumScale);
    expect(result.overflowAmount).toBeGreaterThan(0);
  });

  it.each([
    [0, 100],
    [-1, 100],
    [100, 0],
    [Number.NaN, 100],
    [100, Number.POSITIVE_INFINITY],
  ])("returns a safe error for invalid measurements (%s/%s)", (contentHeight, availableHeight) => {
    const result = calculateOnePageFit({ contentHeight, availableHeight });
    expect(result.status).toBe("error");
    expect(result.selectedScale).toBe(1);
  });

  it("honors caller-provided bounds and iteration limits", () => {
    const result = calculateOnePageFit({
      contentHeight: 105,
      availableHeight: 100,
      minimumScale: 0.9,
      maximumScale: 0.96,
      maximumIterations: 20,
      precision: 0.0001,
    });
    expect(result.status).toBe("fitted");
    expect(result.selectedScale).toBeGreaterThanOrEqual(0.95);
    expect(result.selectedScale).toBeLessThanOrEqual(0.953);
  });

  it("accepts content that fits exactly at the minimum scale boundary", () => {
    const result = calculateOnePageFit({ contentHeight: 100, availableHeight: 88 });
    expect(result.status).toBe("fitted");
    expect(result.selectedScale).toBe(0.88);
    expect(result.fittedHeight).toBe(88);
  });

  it("publishes the required readability guardrails", () => {
    expect(ONE_PAGE_FIT_LIMITS.minimumScale).toBe(0.88);
    expect(ONE_PAGE_FIT_LIMITS.minimumBodyFontPt).toBe(9);
    expect(ONE_PAGE_FIT_LIMITS.minimumLineHeight).toBe(1.15);
    expect(ONE_PAGE_FIT_LIMITS.minimumMarginMm).toBe(8);
    expect(ONE_PAGE_FIT_LIMITS.safetyBufferMm).toBe(2);
  });
});
