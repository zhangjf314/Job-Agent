export type PipelineStageStatus = "not_reached" | "passed" | "failed";

export type TailoredResumePipelineStageStatuses = {
  planJsonStatus: PipelineStageStatus;
  planSchemaStatus: PipelineStageStatus;
  planValidationStatus: PipelineStageStatus;
  compilerStatus: PipelineStageStatus;
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
      planJsonStatus: "passed",
      planSchemaStatus: "passed",
      planValidationStatus: "passed",
      compilerStatus: "passed",
      jsonStatus: "passed",
      normalizationStatus: "passed",
      schemaStatus: "passed",
      factualityStatus: "passed",
    };
  }
  if (input.factualityStatus) {
    return {
      planJsonStatus: "passed",
      planSchemaStatus: "passed",
      planValidationStatus: "passed",
      compilerStatus: "passed",
      jsonStatus: "passed",
      normalizationStatus: "passed",
      schemaStatus: "passed",
      factualityStatus:
        input.factualityStatus === "pass" ? "passed" : "failed",
    };
  }
  if (input.errorCategory === "LLM_SCHEMA_VALIDATION_FAILED") {
    return {
      planJsonStatus: "passed",
      planSchemaStatus: "failed",
      planValidationStatus: "not_reached",
      compilerStatus: "not_reached",
      jsonStatus: "not_reached",
      normalizationStatus: "not_reached",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
    };
  }
  if (input.errorCategory === "GROUNDED_NORMALIZATION_FAILED") {
    return {
      planJsonStatus: "passed",
      planSchemaStatus: "passed",
      planValidationStatus: "passed",
      compilerStatus: "failed",
      jsonStatus: "passed",
      normalizationStatus: "failed",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
    };
  }
  if (input.errorCategory === "LLM_STRUCTURED_OUTPUT_INVALID") {
    return {
      planJsonStatus: "failed",
      planSchemaStatus: "not_reached",
      planValidationStatus: "not_reached",
      compilerStatus: "not_reached",
      jsonStatus: "not_reached",
      normalizationStatus: "not_reached",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
    };
  }
  if (input.errorCategory?.startsWith("TAILORED_PLAN_")) {
    return {
      planJsonStatus: "passed",
      planSchemaStatus:
        input.errorCategory === "TAILORED_PLAN_SCHEMA_INVALID"
          ? "failed"
          : "passed",
      planValidationStatus:
        input.errorCategory === "TAILORED_PLAN_SCHEMA_INVALID"
          ? "not_reached"
          : "failed",
      compilerStatus: "not_reached",
      jsonStatus: "not_reached",
      normalizationStatus: "not_reached",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
    };
  }
  if (input.errorCategory?.startsWith("DETERMINISTIC_COMPILER_")) {
    return {
      planJsonStatus: "passed",
      planSchemaStatus: "passed",
      planValidationStatus: "passed",
      compilerStatus: "failed",
      jsonStatus: "not_reached",
      normalizationStatus: "not_reached",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
    };
  }
  return {
    planJsonStatus: "not_reached",
    planSchemaStatus: "not_reached",
    planValidationStatus: "not_reached",
    compilerStatus: "not_reached",
    jsonStatus: "not_reached",
    normalizationStatus: "not_reached",
    schemaStatus: "not_reached",
    factualityStatus: "not_reached",
  };
}
