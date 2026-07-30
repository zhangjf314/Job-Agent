import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResumeTemplateKey } from "@/types/resume";
import { getResumeTemplate, type ResumeTemplateDefinition } from "./registry";

const supportedPlaceholders = ["title", "name", "headline", "contactLine", "photo", "body"] as const;
type SupportedPlaceholder = (typeof supportedPlaceholders)[number];

export type ResumeTemplateData = {
  templateKey?: string | null;
  title: string;
  targetRole?: string | null;
  targetCity?: string | null;
  contentMarkdown: string;
  showPhoto?: boolean;
  profile?: {
    id?: string;
    photoAsset?: {
      id: string;
      updatedAt: Date;
    } | null;
    basicInfo?: {
      realName?: string | null;
      phone?: string | null;
      email?: string | null;
      location?: string | null;
      githubUrl?: string | null;
      portfolioUrl?: string | null;
      linkedinUrl?: string | null;
      personalWebsite?: string | null;
    } | null;
  } | null;
};

export type RenderedResumeMarkdown = {
  markdown: string;
  template: ResumeTemplateDefinition;
};

const sourceCache = new Map<ResumeTemplateKey, string>();

function loadTemplateSource(template: ResumeTemplateDefinition) {
  const cached = sourceCache.get(template.key);
  if (cached) return cached;

  const source = readFileSync(join(process.cwd(), "template", template.fileName), "utf8");
  const unknownPlaceholders = [...source.matchAll(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g)]
    .map((match) => match[1])
    .filter((key) => !(supportedPlaceholders as readonly string[]).includes(key));
  if (unknownPlaceholders.length > 0) {
    throw new Error(`模板 ${template.name} 包含不支持的占位符：${unknownPlaceholders.join("、")}`);
  }
  sourceCache.set(template.key, source);
  return source;
}

function inlineText(value: string | null | undefined) {
  return value?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function compactMarkdown(value: string) {
  return value.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

function buildPlaceholders(
  resume: ResumeTemplateData,
  template: ResumeTemplateDefinition,
): Record<SupportedPlaceholder, string> {
  const basic = resume.profile?.basicInfo;
  const name = inlineText(basic?.realName) || inlineText(resume.title) || "未命名";
  const targetRole = inlineText(resume.targetRole);
  const targetCity = inlineText(resume.targetCity);
  const headline = [targetRole, targetCity].filter(Boolean).join(" · ");
  const contactLine = [
    inlineText(basic?.phone),
    inlineText(basic?.email),
    inlineText(basic?.location),
    inlineText(basic?.githubUrl),
    inlineText(basic?.portfolioUrl),
    inlineText(basic?.linkedinUrl),
    inlineText(basic?.personalWebsite),
  ].filter(Boolean).join(" | ");

  const photo =
    template.supportsPhoto &&
    resume.showPhoto !== false &&
    resume.profile?.id &&
    resume.profile.photoAsset
      ? `[[PROFILE_PHOTO:/api/profile/photo/${encodeURIComponent(resume.profile.id)}?v=${resume.profile.photoAsset.updatedAt.getTime()}]]`
      : "";

  return {
    title: inlineText(resume.title) || `${name}${targetRole ? ` - ${targetRole}` : ""}`,
    name,
    headline,
    contactLine,
    photo,
    body: resume.contentMarkdown.trim(),
  };
}

export function renderResumeMarkdown(resume: ResumeTemplateData): RenderedResumeMarkdown {
  const template = getResumeTemplate(resume.templateKey);
  const source = loadTemplateSource(template);
  const placeholders = buildPlaceholders(resume, template);
  const markdown = source.replace(
    /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g,
    (_match, key: SupportedPlaceholder) => placeholders[key],
  );

  return { markdown: compactMarkdown(markdown), template };
}
