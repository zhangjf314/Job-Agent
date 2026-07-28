import type { TailoredResumeResult } from "@/types/jd";
import type { JDAnalysisResult } from "@/types/jd";
import type { ResumeProfile } from "@/services/resume-generator";
import { tailoredResumeResultSchema } from "@/schemas/jd";
import { generateTailoredResumeContent } from "@/services/tailored-resume-generator";
import { LLMClient } from "./llm-client";

export type TailoredResumeWriterInput = {
  profile: ResumeProfile;
  baseResumeMarkdown: string;
  jdAnalysis: JDAnalysisResult;
};

export interface TailoredResumeWriterProvider {
  write(input: TailoredResumeWriterInput): Promise<TailoredResumeResult>;
}

export class MockTailoredResumeWriterProvider implements TailoredResumeWriterProvider {
  async write(input: TailoredResumeWriterInput): Promise<TailoredResumeResult> {
    return generateTailoredResumeContent(input.profile, { contentMarkdown: input.baseResumeMarkdown }, input.jdAnalysis);
  }
}

export class LLMTailoredResumeWriterProvider implements TailoredResumeWriterProvider {
  constructor(
    private readonly client = new LLMClient(),
    private readonly fallback = new MockTailoredResumeWriterProvider(),
    private readonly fallbackEnabled = false,
  ) {}

  async write(input: TailoredResumeWriterInput): Promise<TailoredResumeResult> {
    try {
      const result = await this.client.structuredCompletion({
        schemaName: "tailored_resume_result",
        schema: tailoredResumeResultSchema,
        messages: [
          {
            role: "system",
            content:
              "Create a Chinese JD-tailored resume and application materials. Candidate facts and JD requirements are separate inputs. Only reorganize, compress, and emphasize supplied candidate facts. Never invent employers, projects, internships, education, skills, credentials, metrics, or achievements. Never present a JD requirement as a candidate capability. Put unsupported or missing requirements in gaps, questions, or warnings.",
          },
          {
            role: "user",
            content: JSON.stringify({
              candidateFacts: input.profile,
              baseResumeFacts: input.baseResumeMarkdown,
              jdRequirements: input.jdAnalysis,
              requestedOutput: "tailored resume plus application materials and explicit warnings",
            }),
          },
        ],
      });
      return tailoredResumeResultSchema.parse(result.data);
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      await this.client.recordFallback("tailored_resume_result", error);
      const mock = await this.fallback.write(input);
      return {
        ...mock,
        qualityWarnings: [...mock.qualityWarnings, "LLM provider unavailable or invalid; used deterministic tailored resume writer."],
      };
    }
  }
}
