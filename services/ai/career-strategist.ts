import { careerStrategyGenerationResultSchema, type CareerStrategyGenerationResult } from "@/schemas/strategy";
import type { ResumeProfile } from "@/services/resume-generator";
import type { JDAnalysis, Resume } from "@prisma/client";
import { buildCareerStrategyResult } from "@/services/strategy-engine";
import { LLMClient } from "./llm-client";

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
        messages: [
          {
            role: "system",
            content:
              "Generate career direction and job-search strategy for a China mainland job seeker. Base recommendations on supplied facts. Put missing capabilities into gaps or learning actions.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      });
      return careerStrategyGenerationResultSchema.parse(result.data) as CareerStrategyGenerationResult;
    } catch {
      const mock = await this.fallback.generate(input);
      return {
        ...mock,
        warnings: [...mock.warnings, "LLM provider unavailable or invalid; used deterministic career strategist."],
      };
    }
  }
}
