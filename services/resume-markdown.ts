import type { GeneratedResumeSection } from "@/types/resume";

export function linesToMarkdownList(lines: string[]) {
  return lines.filter(Boolean).map((line) => `- ${line}`).join("\n");
}

export function joinSection(title: string, body: string) {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle || !cleanBody) return "";
  return `## ${cleanTitle}\n\n${cleanBody}`;
}

export function buildMarkdownFromSections(sections: GeneratedResumeSection[]) {
  return sections
    .sort((left, right) => left.order - right.order)
    .map((section) => joinSection(section.title, section.contentMarkdown))
    .filter(Boolean)
    .join("\n\n");
}
