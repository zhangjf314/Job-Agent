import { careerStrategyGenerationResultSchema, type CareerStrategyGenerationResult } from "@/schemas/strategy";
import type { ResumeProfile } from "@/services/resume-generator";
import type { JDAnalysis, Resume } from "@prisma/client";
import { buildCareerStrategyResult } from "@/services/strategy-engine";
import { LLMClient } from "./llm-client";
import { careerStrategyOutputContract } from "./output-contracts";

export interface CareerStrategistProvider {
  generate(input: {
    profile: ResumeProfile;
    resumes: Array<Pick<Resume, "qualityScore">>;
    jdAnalyses: Array<Pick<JDAnalysis, "targetRole" | "matchScore">>;
  }): Promise<CareerStrategyGenerationResult>;
}

export class MockCareerStrategistProvider implements CareerStrategistProvider {
  async generate(input: {
    profile: ResumeProfile;
    resumes: Array<Pick<Resume, "qualityScore">>;
    jdAnalyses: Array<Pick<JDAnalysis, "targetRole" | "matchScore">>;
  }) {
    return buildCareerStrategyResult(input.profile, input.resumes, input.jdAnalyses);
  }
}

export class LLMCareerStrategistProvider implements CareerStrategistProvider {
  constructor(
    private readonly client = new LLMClient(),
    private readonly fallback = new MockCareerStrategistProvider(),
    private readonly fallbackEnabled = false,
  ) {}

  async generate(input: {
    profile: ResumeProfile;
    resumes: Array<Pick<Resume, "qualityScore">>;
    jdAnalyses: Array<Pick<JDAnalysis, "targetRole" | "matchScore">>;
  }): Promise<CareerStrategyGenerationResult> {
    try {
      const result = await this.client.structuredCompletion({
        schemaName: "career_strategy_generation_result",
        schema: careerStrategyGenerationResultSchema,
        outputContract: careerStrategyOutputContract,
        messages: [
          {
            role: "system",
            content:
              "Generate career direction and job-search strategy for a China mainland job seeker. Candidate facts and market evidence are separate inputs. Use only supplied candidate facts as existing capabilities. Never invent employers, projects, internships, education, skills, credentials, metrics, or achievements. Treat unmet requirements conservatively as gaps, risks, or learning actions, and label recommendations as recommendations.",
          },
          {
            role: "user",
            content: JSON.stringify({
              candidateFacts: input.profile,
              marketEvidence: {
                resumeQualityScores: input.resumes,
                analyzedRoles: input.jdAnalyses,
              },
              requestedOutput: "recommendations, gaps, priorities, actions, risks, and assumptions",
            }),
          },
        ],
      });
      return careerStrategyGenerationResultSchema.parse(result.data);
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      await this.client.recordFallback("career_strategy_generation_result", error);
      const mock = await this.fallback.generate(input);
      return {
        ...mock,
        warnings: [...mock.warnings, "LLM provider unavailable or invalid; used deterministic career strategist."],
      };
    }
  }
}
