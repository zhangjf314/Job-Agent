import crypto from "node:crypto";
import { normalizedJobPostSchema, type NormalizedJobPost } from "@/schemas/job";
import type { RawJobResult } from "@/types/job";
import { calculateJobQualityScore } from "./job-quality";
import { detectJobRiskFlags } from "./job-risk-detector";

const skillKeywords = ["Java", "Spring Boot", "Spring Cloud", "MySQL", "Redis", "Vue", "React", "Python", "SQL", "Excel", "数据分析", "产品设计", "Axure", "Figma", "Docker", "RabbitMQ", "Kafka", "Linux", "TypeScript"];

function normalizeCity(value = "") {
  return value.replace(/市$/, "").trim() || "未知";
}

function parseSalary(text: string) {
  const raw = text.replace(/\s/g, "");
  const k = raw.match(/(\d+(?:\.\d+)?)\s*[kK千]\s*[-~到]\s*(\d+(?:\.\d+)?)\s*[kK千]/);
  if (k) return { salaryMin: Math.round(Number(k[1]) * 1000), salaryMax: Math.round(Number(k[2]) * 1000), salaryText: text };
  const yuan = raw.match(/(\d{4,6})\s*[-~到]\s*(\d{4,6})/);
  if (yuan) return { salaryMin: Number(yuan[1]), salaryMax: Number(yuan[2]), salaryText: text };
  return { salaryMin: null, salaryMax: null, salaryText: text.match(/\d/) ? text : "" };
}

function detectJobType(text: string) {
  if (/实习/.test(text)) return "internship";
  if (/校招|应届/.test(text)) return "campus";
  if (/兼职/.test(text)) return "parttime";
  if (/合同|外包/.test(text)) return "contract";
  if (/全职/.test(text)) return "fulltime";
  return "unknown";
}

function detectEducation(text: string) {
  return text.match(/本科|硕士|博士|大专|学历不限|不限/)?.[0] ?? "";
}

function detectExperience(text: string) {
  return text.match(/应届生|应届|实习|不限经验|无经验|1-3年|3-5年|5年以上|\d+年以上/)?.[0] ?? "";
}

function detectInternshipDuration(text: string) {
  return text.match(/(?:至少|连续)?\s*([一二三四五六七八九十\d]+\s*个?月|每周\s*[一二三四五六七\d]+\s*天)/)?.[1] ?? "";
}

function detectConversionOpportunity(text: string) {
  if (/提供转正|可转正|转正机会|表现优秀.*转正/.test(text)) return "有转正机会";
  if (/不转正|无转正/.test(text)) return "不提供转正";
  return "unknown";
}

function normalizeTitle(title: string) {
  if (/Java|后端/.test(title)) return "Java 后端开发";
  if (/前端|React|Vue/.test(title)) return "前端开发";
  if (/数据分析/.test(title)) return "数据分析";
  if (/测试/.test(title)) return "测试开发";
  if (/AI|大模型/.test(title)) return "AI 应用开发";
  return title.trim();
}

export function createContentHash(parts: string[]) {
  return crypto.createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex");
}

export async function normalizeJobPost(raw: RawJobResult): Promise<NormalizedJobPost> {
  const rawText = raw.rawText || `${raw.title ?? ""}\n${raw.company ?? ""}\n${raw.city ?? ""}\n${raw.salaryText ?? ""}\n${raw.description ?? ""}\n${raw.requirements ?? ""}`;
  const title = raw.title || rawText.match(/岗位[:：]\s*([^\n]+)/)?.[1] || rawText.match(/招聘\s*([^\n，。]+)/)?.[1] || "未知岗位";
  const company = raw.company || rawText.match(/公司[:：]\s*([^\n]+)/)?.[1] || "未知公司";
  const city = normalizeCity(raw.city || rawText.match(/城市[:：]\s*([^\n]+)/)?.[1] || rawText.match(/杭州|上海|南京|北京|深圳|广州/)?.[0] || "");
  const salaryMatch = raw.salaryText || rawText.match(/\d+(?:\.\d+)?\s*[kK千]\s*[-~到]\s*\d+(?:\.\d+)?\s*[kK千]|\d{4,6}\s*[-~到]\s*\d{4,6}/)?.[0] || "";
  const salary = parseSalary(salaryMatch);
  const skills = skillKeywords.filter((skill) => rawText.toLowerCase().includes(skill.toLowerCase()));
  const base = {
    title: title.trim(),
    normalizedTitle: normalizeTitle(title),
    company: company.trim(),
    companyNormalizedName: company.replace(/[（(].*?[）)]/g, "").trim(),
    city,
    district: "",
    province: "",
    salaryMin: salary.salaryMin,
    salaryMax: salary.salaryMax,
    salaryMonths: /13薪|十三薪/.test(rawText) ? 13 : null,
    salaryText: salary.salaryText,
    experienceRequirement: detectExperience(rawText),
    educationRequirement: detectEducation(rawText),
    internshipDuration: detectInternshipDuration(rawText),
    conversionOpportunity: detectConversionOpportunity(rawText),
    candidateProfile: rawText.split(/[\n。；;]/).map((line) => line.trim()).filter((line) => /能力|专业|熟悉|掌握|具备|优先|在校生|应届/.test(line)).slice(0, 8),
    jobType: detectJobType(rawText),
    workMode: /远程/.test(rawText) ? "remote" : /混合/.test(rawText) ? "hybrid" : "onsite",
    description: raw.description || rawText,
    requirements: raw.requirements || rawText,
    benefits: Array.from(new Set((rawText.match(/五险一金|双休|年终奖|餐补|弹性工作/g) ?? []))),
    skills,
    keywords: Array.from(new Set([...skills, normalizeTitle(title), city, detectEducation(rawText), detectExperience(rawText)].filter(Boolean))),
    industries: /电商/.test(rawText) ? ["电商"] : /制造/.test(rawText) ? ["制造业数字化"] : ["互联网"],
    companyType: /外包|驻场/.test(rawText) ? "software_outsourcing" : /国企|央企/.test(rawText) ? "state_owned" : /外企/.test(rawText) ? "foreign_company" : "unknown",
    headcount: null,
    source: raw.source ?? "manual",
    sourceUrl: raw.sourceUrl ?? "",
    sourcePlatform: raw.sourcePlatform ?? "",
    publishedAt: null,
    collectedAt: new Date(),
    contentHash: createContentHash([title, company, city, rawText]),
    qualityScore: 0,
    riskFlags: [],
    rawText,
    rawJson: raw.rawJson,
  } as NormalizedJobPost;
  base.qualityScore = calculateJobQualityScore(base);
  base.riskFlags = detectJobRiskFlags(base);
  return normalizedJobPostSchema.parse(base);
}
