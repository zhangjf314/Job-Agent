import type { GeneratedResumeSection } from "@/types/resume";

export function linesToMarkdownList(lines: string[]) {
  return lines.filter(Boolean).map((line) => `- ${line}`).join("\n");
}

export function joinSection(title: string, body: string) {
  return [`## ${title}`, body.trim()].filter(Boolean).join("\n\n");
}

export function buildMarkdownFromSections(sections: GeneratedResumeSection[]) {
  return sections
    .sort((left, right) => left.order - right.order)
    .map((section) => joinSection(section.title, section.contentMarkdown))
    .join("\n\n");
}
