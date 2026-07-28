import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/markdown-to-html";

describe("markdownToHtml", () => {
  it("renders headings, bullets, inline emphasis, and escapes html", () => {
    const html = markdownToHtml("## 项目经历\n- **Java** 后端\n<script>alert(1)</script>");
    expect(html).toContain("<h3>项目经历</h3>");
    expect(html).toContain("<li><strong>Java</strong> 后端</li>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
