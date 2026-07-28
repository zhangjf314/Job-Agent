import { describe, expect, it } from "vitest";
import { resumeCreateInputSchema, resumeGenerationResultSchema } from "@/schemas/resume";

describe("resume schema", () => {
  it("validates a generated resume result", () => {
    const result = resumeGenerationResultSchema.safeParse({
      title: "李明 - Java 后端开发简历",
      targetRole: "Java 后端开发",
      targetCity: "杭州",
      language: "zh-CN",
      contentMarkdown: "## 基本信息\n\n李明",
      sections: [{ type: "basic_info", title: "基本信息", contentMarkdown: "李明", order: 0 }],
      missingFields: [],
      improvementQuestions: [],
      qualityWarnings: [],
      generationNotes: ["规则生成"],
      qualityScore: 80,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid quality score and language", () => {
    const result = resumeGenerationResultSchema.safeParse({
      title: "简历",
      targetRole: "",
      targetCity: "",
      language: "en-US",
      contentMarkdown: "content",
      sections: [{ type: "basic_info", title: "基本信息", contentMarkdown: "", order: 0 }],
      missingFields: [],
      improvementQuestions: [],
      qualityWarnings: [],
      generationNotes: [],
      qualityScore: 101,
    });

    expect(result.success).toBe(false);
  });

  it("defaults old create inputs to the minimal template", () => {
    const result = resumeCreateInputSchema.parse({
      profileId: "profile_1",
      title: "旧简历",
      contentMarkdown: "## 简历内容\n\n正文",
    });

    expect(result.templateKey).toBe("minimal");
  });
});
