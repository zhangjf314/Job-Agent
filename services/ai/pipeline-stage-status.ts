export type PipelineStageStatus = "not_reached" | "passed" | "failed";

export type TailoredResumePipelineStageStatuses = {
  jsonStatus: PipelineStageStatus;
  normalizationStatus: PipelineStageStatus;
  schemaStatus: PipelineStageStatus;
  factualityStatus: PipelineStageStatus;
};

type StageStatusInput = {
  success: boolean;
  errorCategory?: string;
  normalizationSummaryPresent?: boolean;
  factualityStatus?: "pass" | "review" | "fail";
};

export function tailoredResumePipelineStageStatuses(
  input: StageStatusInput,
): TailoredResumePipelineStageStatuses {
  if (input.success) {
    return {
      jsonStatus: "passed",
      normalizationStatus: "passed",
      schemaStatus: "passed",
      factualityStatus: "passed",
    };
  }
  if (input.factualityStatus) {
    return {
      jsonStatus: "passed",
      normalizationStatus: "passed",
      schemaStatus: "passed",
      factualityStatus:
        input.factualityStatus === "pass" ? "passed" : "failed",
    };
  }
  if (input.errorCategory === "LLM_SCHEMA_VALIDATION_FAILED") {
    return {
      jsonStatus: "passed",
      normalizationStatus: input.normalizationSummaryPresent
        ? "passed"
        : "not_reached",
      schemaStatus: "failed",
      factualityStatus: "not_reached",
    };
  }
  if (input.errorCategory === "GROUNDED_NORMALIZATION_FAILED") {
    return {
      jsonStatus: "passed",
      normalizationStatus: "failed",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
    };
  }
  if (input.errorCategory === "LLM_STRUCTURED_OUTPUT_INVALID") {
    return {
      jsonStatus: "failed",
      normalizationStatus: "not_reached",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
    };
  }
  return {
    jsonStatus: "not_reached",
    normalizationStatus: "not_reached",
    schemaStatus: "not_reached",
    factualityStatus: "not_reached",
  };
}
