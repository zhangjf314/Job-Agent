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
              "Create a Chinese JD-tailored resume and application materials from supplied Career Profile, base resume, and JD analysis. Include a factual self-introduction, application email, and recruiter message. Use only supplied facts. Missing skills stay in gaps/warnings, not resume body.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      });
      return tailoredResumeResultSchema.parse(result.data) as TailoredResumeResult;
    } catch {
      const mock = await this.fallback.write(input);
      return {
        ...mock,
        qualityWarnings: [...mock.qualityWarnings, "LLM provider unavailable or invalid; used deterministic tailored resume writer."],
      };
    }
  }
}
