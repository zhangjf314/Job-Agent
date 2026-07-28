import { z } from "zod";
import {
  employmentTypes,
  evidenceTypes,
  skillCategories,
  skillLevels,
  targetStatuses,
} from "@/types/career-profile";

const optionalUrl = z
  .string()
  .trim()
  .url("请输入有效 URL")
  .optional()
  .or(z.literal(""));

const requiredText = (label: string) => z.string().trim().min(1, `${label}不能为空`);
const stringList = z.array(z.string().trim().min(1)).default([]);
const phoneRegex = /^(\+?86[- ]?)?1[3-9]\d{9}$/;

export const targetStatusSchema = z.enum(targetStatuses);
export const skillCategorySchema = z.enum(skillCategories);
export const skillLevelSchema = z.enum(skillLevels);
export const employmentTypeSchema = z.enum(employmentTypes);
export const evidenceTypeSchema = z.enum(evidenceTypes);

export const basicInfoSchema = z.object({
  realName: requiredText("姓名"),
  phone: z.string().trim().regex(phoneRegex, "请输入中国大陆手机号"),
  email: z.string().trim().email("请输入有效邮箱"),
  location: z.string().trim().optional().default(""),
  githubUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  personalWebsite: optionalUrl,
});

export const educationItemSchema = z.object({
  school: requiredText("学校"),
  major: requiredText("专业"),
  degree: requiredText("学历"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  gpa: z.string().trim().optional().default(""),
  ranking: z.string().trim().optional().default(""),
  courses: stringList,
  honors: stringList,
});

export const skillItemSchema = z.object({
  name: requiredText("技能名称"),
  category: skillCategorySchema,
  level: skillLevelSchema,
  evidence: z.string().trim().optional().default(""),
  yearsOfExperience: z.coerce.number().min(0).max(60).optional().nullable(),
});

export const projectItemSchema = z.object({
  name: requiredText("项目名称"),
  role: z.string().trim().optional().default(""),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  background: z.string().trim().optional().default(""),
  goal: z.string().trim().optional().default(""),
  responsibilities: stringList,
  techStack: stringList,
  highlights: stringList,
  results: z.string().trim().optional().default(""),
  metrics: stringList,
  links: z.array(z.string().trim().url()).default([]),
});

export const experienceItemSchema = z.object({
  company: requiredText("公司"),
  department: z.string().trim().optional().default(""),
  role: requiredText("职位"),
  employmentType: employmentTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  responsibilities: stringList,
  achievements: stringList,
  techStack: stringList,
  businessImpact: z.string().trim().optional().default(""),
  metrics: stringList,
});

export const certificateItemSchema = z.object({
  name: requiredText("证书名称"),
  issuer: requiredText("颁发机构"),
  issuedAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  credentialUrl: optionalUrl,
});

export const awardItemSchema = z.object({
  name: requiredText("奖项名称"),
  issuer: z.string().trim().optional().default(""),
  level: z.string().trim().optional().default(""),
  awardedAt: z.coerce.date().optional().nullable(),
  description: z.string().trim().optional().default(""),
});

export const evidenceItemSchema = z.object({
  type: evidenceTypeSchema,
  title: requiredText("材料标题"),
  url: optionalUrl,
  description: z.string().trim().optional().default(""),
  relatedEntityType: z.string().trim().optional().default(""),
  relatedEntityId: z.string().trim().optional().default(""),
});

export const careerProfileBaseSchema = z.object({
    userId: requiredText("用户 ID"),
    targetStatus: targetStatusSchema.default("open_to_opportunities"),
    targetRoles: z.array(requiredText("目标岗位")).min(1, "至少填写一个目标岗位"),
    targetCities: z.array(requiredText("目标城市")).min(1, "至少填写一个目标城市"),
    expectedSalaryMin: z.coerce.number().int().positive().optional().nullable(),
    expectedSalaryMax: z.coerce.number().int().positive().optional().nullable(),
    personalSummary: z.string().trim().max(1000).optional().default(""),
    basicInfo: basicInfoSchema.optional(),
    educationItems: z.array(educationItemSchema).default([]),
    skillItems: z.array(skillItemSchema).default([]),
    projectItems: z.array(projectItemSchema).default([]),
    experienceItems: z.array(experienceItemSchema).default([]),
    certificateItems: z.array(certificateItemSchema).default([]),
    awardItems: z.array(awardItemSchema).default([]),
    evidenceItems: z.array(evidenceItemSchema).default([]),
  });

export const careerProfileSchema = careerProfileBaseSchema.refine(
    (value) =>
      !value.expectedSalaryMin ||
      !value.expectedSalaryMax ||
      value.expectedSalaryMin <= value.expectedSalaryMax,
    {
      message: "最低期望薪资不能高于最高期望薪资",
      path: ["expectedSalaryMax"],
    },
  );

export const updateCareerProfileSchema = careerProfileBaseSchema.partial().extend({
  id: requiredText("档案 ID"),
});

export type BasicInfoInput = z.infer<typeof basicInfoSchema>;
export type CareerProfileInput = z.infer<typeof careerProfileSchema>;
export type EducationItemInput = z.infer<typeof educationItemSchema>;
export type SkillItemInput = z.infer<typeof skillItemSchema>;
export type ProjectItemInput = z.infer<typeof projectItemSchema>;
export type ExperienceItemInput = z.infer<typeof experienceItemSchema>;
export type CertificateItemInput = z.infer<typeof certificateItemSchema>;
export type AwardItemInput = z.infer<typeof awardItemSchema>;
export type EvidenceItemInput = z.infer<typeof evidenceItemSchema>;
