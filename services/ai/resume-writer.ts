import { z } from "zod";
import { LLMClient } from "./llm-client";

export type ResumeWriterInput = {
  section: string;
  facts: string[];
};

export interface ResumeWriter {
  writeBullets(input: ResumeWriterInput): string[];
}

export class MockResumeWriter implements ResumeWriter {
  writeBullets(input: ResumeWriterInput): string[] {
    return input.facts.filter(Boolean).map((fact) => fact.trim());
  }
}

const resumeBulletsSchema = z.object({
  bullets: z.array(z.string().trim().min(1)).default([]),
  warnings: z.array(z.string().trim().min(1)).default([]),
});

export class LLMResumeWriterProvider implements ResumeWriter {
  constructor(
    private readonly client = new LLMClient(),
    private readonly fallback = new MockResumeWriter(),
  ) {}

  writeBullets(input: ResumeWriterInput): string[] {
    return this.fallback.writeBullets(input);
  }

  async writeBulletsAsync(input: ResumeWriterInput): Promise<string[]> {
    try {
      const result = await this.client.structuredCompletion({
        schemaName: "resume_bullets",
        schema: resumeBulletsSchema,
        messages: [
          {
            role: "system",
            content:
              "Rewrite Chinese resume bullets. Use only supplied facts. Never invent companies, schools, skills, awards, metrics, or credentials.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      });
      const bullets = result.data.bullets ?? [];
      return bullets.length ? bullets : this.fallback.writeBullets(input);
    } catch {
      return this.fallback.writeBullets(input);
    }
  }
}
