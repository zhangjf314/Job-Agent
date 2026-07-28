import type { JDAnalysisResult } from "@/types/jd";
import { analyzeJDText } from "@/services/jd-analyzer";
import { jdAnalysisResultSchema } from "@/schemas/jd";
import { LLMClient } from "./llm-client";

export interface JDAnalyzerProvider {
  analyze(rawText: string): Promise<JDAnalysisResult>;
}

export class MockJDAnalyzerProvider implements JDAnalyzerProvider {
  async analyze(rawText: string): Promise<JDAnalysisResult> {
    return analyzeJDText(rawText);
  }
}

export class LLMJDAnalyzerProvider implements JDAnalyzerProvider {
  constructor(
    private readonly client = new LLMClient(),
    private readonly fallback = new MockJDAnalyzerProvider(),
  ) {}

  async analyze(rawText: string): Promise<JDAnalysisResult> {
    try {
      const result = await this.client.structuredCompletion({
        schemaName: "jd_analysis_result",
        schema: jdAnalysisResultSchema,
        messages: [
          {
            role: "system",
            content:
              "Extract a Chinese internship or full-time job description into structured requirements, including internship duration, conversion opportunity, and candidate profile. Describe only the JD; do not assume candidate capabilities.",
          },
          { role: "user", content: rawText },
        ],
      });
      return jdAnalysisResultSchema.parse(result.data) as JDAnalysisResult;
    } catch {
      const mock = await this.fallback.analyze(rawText);
      return {
        ...mock,
        riskWarnings: [...mock.riskWarnings, "LLM provider unavailable or invalid; used deterministic JD analyzer."],
      };
    }
  }
}
