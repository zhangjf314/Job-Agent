import {
  defaultResumeTemplateKey,
  resumeTemplateKeys,
  type ResumeTemplateKey,
} from "@/types/resume";

export interface ResumeTemplateDefinition {
  key: ResumeTemplateKey;
  name: string;
  description: string;
  fileName: string;
  supportsPhoto: boolean;
}

export const resumeTemplateRegistry: readonly ResumeTemplateDefinition[] = [
  {
    key: "minimal",
    name: "极简",
    description: "留白充足、层级清晰，适合大多数岗位和打印场景。",
    fileName: "极简-互联网通用简历模板.md",
    supportsPhoto: false,
  },
  {
    key: "elegant",
    name: "简洁大方",
    description: "强调标题与分区层次，适合正式、稳健的求职表达。",
    fileName: "简洁大方-互联网通用简历模板.md",
    supportsPhoto: false,
  },
  {
    key: "dark",
    name: "深色",
    description: "屏幕预览采用深色视觉，打印时自动切换为高对比浅色。",
    fileName: "深色-互联网通用简历模板.md",
    supportsPhoto: false,
  },
  {
    key: "photo",
    name: "带证件照",
    description: "预留证件照版式；当前无照片来源时自动使用无照片布局。",
    fileName: "互联网通用简历模板-带证件照.md",
    supportsPhoto: true,
  },
] as const;

const templatesByKey = new Map(resumeTemplateRegistry.map((template) => [template.key, template]));

export function isResumeTemplateKey(value: unknown): value is ResumeTemplateKey {
  return typeof value === "string" && (resumeTemplateKeys as readonly string[]).includes(value);
}

export function resolveResumeTemplateKey(value: unknown): ResumeTemplateKey {
  return isResumeTemplateKey(value) ? value : defaultResumeTemplateKey;
}

export function getResumeTemplate(value: unknown): ResumeTemplateDefinition {
  return templatesByKey.get(resolveResumeTemplateKey(value)) ?? templatesByKey.get(defaultResumeTemplateKey)!;
}

export function listResumeTemplates() {
  return [...resumeTemplateRegistry];
}
