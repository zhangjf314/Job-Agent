import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { renderResumeMarkdown, type ResumeTemplateData } from "@/services/resume-templates/renderer";
import { resumeTemplateKeys } from "@/types/resume";

function resume(overrides: Partial<ResumeTemplateData> = {}): ResumeTemplateData {
  return {
    title: "张明 - Java 后端简历",
    targetRole: "Java 后端开发",
    targetCity: "杭州",
    contentMarkdown: "## 项目经历\n\n- 完成中文求职助手开发",
    profile: {
      basicInfo: {
        realName: "张明",
        phone: "13800000000",
        email: "zhangming@example.com",
        location: "杭州",
      },
    },
    ...overrides,
  };
}

describe("resume template renderer", () => {
  it.each(resumeTemplateKeys)("renders the %s template through one entry point", (templateKey) => {
    const rendered = renderResumeMarkdown(resume({ templateKey }));

    expect(rendered.template.key).toBe(templateKey);
    expect(rendered.markdown).toContain("张明");
    expect(rendered.markdown).toContain("完成中文求职助手开发");
    expect(rendered.markdown).not.toMatch(/\{\{[A-Za-z][A-Za-z0-9]*\}\}/);
    expect(rendered.markdown).not.toContain("undefined");
    expect(rendered.markdown).not.toContain("null");
  });

  it("omits missing optional values without empty placeholders", () => {
    const rendered = renderResumeMarkdown(resume({
      targetRole: null,
      targetCity: null,
      profile: { basicInfo: { realName: "张明" } },
    }));

    expect(rendered.markdown).not.toContain("undefined");
    expect(rendered.markdown).not.toContain("null");
    expect(rendered.markdown).not.toMatch(/\{\{.+\}\}/);
  });

  it("escapes user HTML when the shared preview renderer produces HTML", () => {
    const rendered = renderResumeMarkdown(resume({
      title: "<script>alert(1)</script>",
      contentMarkdown: "## 项目\n\n<script>alert(2)</script> & 特殊字符",
    }));
    const html = markdownToHtml(rendered.markdown);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).toContain("&amp; 特殊字符");
  });

  it("uses the default for an old resume without templateKey", () => {
    expect(renderResumeMarkdown(resume()).template.key).toBe("minimal");
  });

  it("falls back for an invalid persisted template key", () => {
    expect(renderResumeMarkdown(resume({ templateKey: "retired" })).template.key).toBe("minimal");
  });

  it("renders the photo template without a broken image when no photo exists", () => {
    const rendered = renderResumeMarkdown(resume({ templateKey: "photo" }));

    expect(rendered.template.supportsPhoto).toBe(true);
    expect(rendered.markdown).not.toMatch(/!\[[^\]]*\]\([^)]*\)/);
    expect(markdownToHtml(rendered.markdown)).not.toContain("<img");
  });
});
