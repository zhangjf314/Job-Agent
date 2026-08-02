import { describe, expect, it, vi } from "vitest";
import {
  buildCandidateFactRegistry,
} from "@/services/ai/candidate-fact-registry";
import {
  LLMTailoredResumeWriterProvider,
} from "@/services/ai/tailored-resume-writer";
import {
  TailoredResumePlanError,
} from "@/services/ai/tailored-resume-plan-validator";
import type {
  LLMClient,
  LLMCompletionMetadata,
} from "@/services/ai/llm-client";
import type { TailoredResumePlan } from "@/services/ai/tailored-resume-plan";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeJD,
  fictionalSmokeProfile,
} from "@/scripts/llm-smoke-fixtures";

const facts = buildCandidateFactRegistry(
  fictionalSmokeProfile,
  fictionalSmokeBaseResume,
);
const education = facts.find((fact) => fact.category === "education")!.id;
const skill = facts.find((fact) => fact.category === "skill")!.id;
const project = facts.find((fact) => fact.category === "project")!.id;

function validPlan(): TailoredResumePlan {
  return {
    sections: {
      summary: { factIds: [skill] },
      skills: { factIds: [skill] },
      projects: { factIds: [project] },
      experiences: { factIds: [] },
      education: { factIds: [education] },
      others: { factIds: [] },
    },
    applicationMaterials: {
      selfIntroductionFactIds: [skill],
      applicationEmailFactIds: [project],
      recruiterMessageFactIds: [education],
    },
    changedSections: ["skills", "projects"],
    priorityFactIds: [skill, project, education],
    projectRewrites: [],
  };
}

function metadata(): LLMCompletionMetadata {
  return {
    requestId: "plan-request",
    model: "test-model",
    latencyMs: 12,
    retryCount: 0,
    repairCount: 0,
    finalizationRetryCount: 0,
    externalRequestCount: 1,
    reasoningFieldPresent: false,
    thinkingModeRequested: "disabled",
    httpStatus: 200,
    jsonStatus: "passed",
    normalizationStatus: "not_reached",
    schemaStatus: "passed",
    factualityStatus: "not_reached",
    schemaValidationStatus: "passed",
    responseSafetySummary: {
      responseId: "response",
      choiceCount: 1,
      firstChoicePresent: true,
      messagePresent: true,
      contentState: "present",
      contentCharacterLength: 200,
      contentByteLength: 200,
      reasoningFieldPresent: false,
      finishReason: "stop",
      promptTokens: 200,
      completionTokens: 80,
      totalTokens: 280,
      outputLimitReached: false,
    },
  };
}

function fakeClient(data: unknown) {
  const structuredCompletion = vi.fn().mockResolvedValue({
    data,
    usage: {
      prompt_tokens: 200,
      completion_tokens: 80,
      total_tokens: 280,
    },
    metadata: metadata(),
  });
  const recordSafeObservation = vi.fn().mockResolvedValue(undefined);
  return {
    client: {
      structuredCompletion,
      recordSafeObservation,
    } as unknown as LLMClient,
    structuredCompletion,
    recordSafeObservation,
  };
}

describe("plan-based tailored resume writer", () => {
  it("uses one plan request and compiles a factual public result", async () => {
    const fake = fakeClient(validPlan());
    const output = await new LLMTailoredResumeWriterProvider(
      fake.client,
    ).write({
      profile: fictionalSmokeProfile,
      baseResumeMarkdown: fictionalSmokeBaseResume,
      jdAnalysis: fictionalSmokeJD,
      requestPolicy: {
        allowTransportRetry: false,
        allowJsonRepair: false,
        allowFactualityRepair: false,
        allowFinalizationRetry: false,
      },
    });

    expect(fake.structuredCompletion).toHaveBeenCalledTimes(1);
    expect(fake.structuredCompletion.mock.calls[0][0].schemaName).toBe(
      "tailored_resume_selection_plan",
    );
    expect(fake.structuredCompletion.mock.calls[0][0]).toMatchObject({
      allowTransportRetry: false,
      allowJsonRepair: false,
      allowFinalizationRetry: false,
    });
    expect(output.result.sections).toHaveLength(6);
    expect(output.diagnostics).toMatchObject({
      planJsonStatus: "passed",
      planSchemaStatus: "passed",
      planValidationStatus: "passed",
      projectPlanStatus: "passed",
      projectPlanValidationStatus: "passed",
      projectCompilationStatus: "passed",
      compilerStatus: "passed",
      factualityStatus: "pass",
      factualityRepairCount: 0,
      externalRequestCount: 1,
      compilerMaximumLineLength: expect.any(Number),
    });
  });

  it("does not provide finalization retry messages to the plan call", async () => {
    const fake = fakeClient(validPlan());
    await new LLMTailoredResumeWriterProvider(fake.client).write({
      profile: fictionalSmokeProfile,
      baseResumeMarkdown: fictionalSmokeBaseResume,
      jdAnalysis: fictionalSmokeJD,
    });
    expect(
      fake.structuredCompletion.mock.calls[0][0].finalizationRetryMessages,
    ).toBeUndefined();
  });

  it("records only aggregate compiler diagnostics", async () => {
    const fake = fakeClient(validPlan());
    await new LLMTailoredResumeWriterProvider(fake.client).write({
      profile: fictionalSmokeProfile,
      baseResumeMarkdown: fictionalSmokeBaseResume,
      jdAnalysis: fictionalSmokeJD,
    });
    const observation = fake.recordSafeObservation.mock.calls[0][0];
    expect(observation.metadata.selectedFactCount).toBeGreaterThan(0);
    expect(JSON.stringify(observation.metadata)).not.toContain("F_SKL_");
  });

  it("blocks an unknown fact before compilation and save", async () => {
    const fake = fakeClient({
      ...validPlan(),
      sections: {
        ...validPlan().sections,
        summary: { factIds: ["F_SKL_999"] },
      },
    });
    await expect(
      new LLMTailoredResumeWriterProvider(fake.client).write({
        profile: fictionalSmokeProfile,
        baseResumeMarkdown: fictionalSmokeBaseResume,
        jdAnalysis: fictionalSmokeJD,
      }),
    ).rejects.toMatchObject({
      code: "TAILORED_PLAN_UNKNOWN_FACT_ID",
    } satisfies Partial<TailoredResumePlanError>);
    expect(fake.recordSafeObservation).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(fake.recordSafeObservation.mock.calls[0][0].metadata),
    ).not.toContain("F_SKL_999");
  });

  it("blocks a JD-only requirement ID", async () => {
    const fake = fakeClient({
      ...validPlan(),
      sections: {
        ...validPlan().sections,
        skills: { factIds: ["J_REQ_001"] },
      },
    });
    await expect(
      new LLMTailoredResumeWriterProvider(fake.client).write({
        profile: fictionalSmokeProfile,
        baseResumeMarkdown: fictionalSmokeBaseResume,
        jdAnalysis: fictionalSmokeJD,
      }),
    ).rejects.toMatchObject({
      code: "TAILORED_PLAN_JD_REQUIREMENT_ID",
    } satisfies Partial<TailoredResumePlanError>);
  });

  it("renders application materials without model-authored text", async () => {
    const fake = fakeClient(validPlan());
    const output = await new LLMTailoredResumeWriterProvider(
      fake.client,
    ).write({
      profile: fictionalSmokeProfile,
      baseResumeMarkdown: fictionalSmokeBaseResume,
      jdAnalysis: fictionalSmokeJD,
    });
    expect(output.result.applicationMaterials.applicationEmail).toContain(
      "附件为我的简历",
    );
    expect(output.result.applicationMaterials.recruiterMessage).toContain(
      "希望有机会进一步沟通",
    );
  });
});
