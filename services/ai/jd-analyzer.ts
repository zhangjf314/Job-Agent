import type { JDAnalysisResult } from "@/types/jd";
import { analyzeJDText } from "@/services/jd-analyzer";
import { jdAnalysisResultSchema } from "@/schemas/jd";
import { LLMClient } from "./llm-client";
import { jdAnalysisOutputContract } from "./output-contracts";

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
    private readonly fallbackEnabled = false,
  ) {}

  async analyze(rawText: string): Promise<JDAnalysisResult> {
    try {
      const result = await this.client.structuredCompletion({
        schemaName: "jd_analysis_result",
        schema: jdAnalysisResultSchema,
        outputContract: jdAnalysisOutputContract,
        messages: [
          {
            role: "system",
            content:
              "Extract a Chinese internship or full-time job description into structured requirements, including internship duration, conversion opportunity, and candidate profile. Describe only the JD; do not assume candidate capabilities.",
          },
          { role: "user", content: rawText },
        ],
      });
      return jdAnalysisResultSchema.parse(result.data);
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      await this.client.recordFallback("jd_analysis_result", error);
      const mock = await this.fallback.analyze(rawText);
      return {
        ...mock,
        riskWarnings: [...mock.riskWarnings, "LLM provider unavailable or invalid; used deterministic JD analyzer."],
      };
    }
  }
}
