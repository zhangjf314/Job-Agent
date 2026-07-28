import { renderResumeMarkdown, type ResumeTemplateData } from "@/services/resume-templates/renderer";

export function safeResumeFileName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, "-").trim();
  return cleaned || "resume";
}

export function createResumeMarkdownDownload(resume: ResumeTemplateData) {
  const rendered = renderResumeMarkdown(resume);
  const fileName = `${safeResumeFileName(resume.title)}-${rendered.template.name}.md`;
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, "") || "resume.md";

  return new Response(rendered.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
