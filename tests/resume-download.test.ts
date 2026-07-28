import { describe, expect, it } from "vitest";
import { createResumeMarkdownDownload } from "@/services/resume-download";
import { renderResumeMarkdown } from "@/services/resume-templates/renderer";

describe("resume markdown download", () => {
  it("uses the selected template and matches the shared preview markdown", async () => {
    const resume = {
      templateKey: "dark",
      title: "张明 / Java:简历",
      targetRole: "Java 后端开发",
      targetCity: "杭州",
      contentMarkdown: "## 项目经历\n\n- 中文项目内容",
      profile: {
        basicInfo: {
          realName: "张明",
          phone: "13800000000",
          email: "zhangming@example.com",
        },
      },
    };

    const response = createResumeMarkdownDownload(resume);
    expect(await response.text()).toBe(renderResumeMarkdown(resume).markdown);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(response.headers.get("content-disposition")).not.toContain("/");
  });
});
