import { describe, expect, it } from "vitest";
import {
  tailoredResumePipelineStageStatuses,
} from "@/services/ai/pipeline-stage-status";

describe("tailored-resume pipeline stage statuses", () => {
  it.each([
    [
      "JSON failure",
      { success: false, errorCategory: "LLM_STRUCTURED_OUTPUT_INVALID" },
      ["failed", "not_reached", "not_reached", "not_reached", "not_reached", "not_reached", "not_reached", "not_reached"],
    ],
    [
      "normalization failure",
      { success: false, errorCategory: "GROUNDED_NORMALIZATION_FAILED" },
      ["passed", "passed", "passed", "failed", "passed", "failed", "not_reached", "not_reached"],
    ],
    [
      "schema failure after normalization",
      {
        success: false,
        errorCategory: "LLM_SCHEMA_VALIDATION_FAILED",
        normalizationSummaryPresent: true,
      },
      ["passed", "failed", "not_reached", "not_reached", "not_reached", "not_reached", "not_reached", "not_reached"],
    ],
    [
      "factuality failure",
      { success: false, factualityStatus: "fail" as const },
      ["passed", "passed", "passed", "passed", "passed", "passed", "passed", "failed"],
    ],
    [
      "success",
      { success: true },
      ["passed", "passed", "passed", "passed", "passed", "passed", "passed", "passed"],
    ],
  ])("reports %s without collapsing earlier stages", (_name, input, expected) => {
    const statuses = tailoredResumePipelineStageStatuses(input);
    expect([
      statuses.planJsonStatus,
      statuses.planSchemaStatus,
      statuses.planValidationStatus,
      statuses.compilerStatus,
      statuses.jsonStatus,
      statuses.normalizationStatus,
      statuses.schemaStatus,
      statuses.factualityStatus,
    ]).toEqual(expected);
  });
});
