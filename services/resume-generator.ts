import type { Prisma } from "@prisma/client";
import { careerProfileInclude } from "@/services/career-profile-service";
import { resumeGenerationResultSchema } from "@/schemas/resume";
import type { GeneratedResumeSection, ResumeGenerationResult } from "@/types/resume";
import { buildMarkdownFromSections, linesToMarkdownList } from "./resume-markdown";
import { calculateResumeQualityScore } from "./resume-quality";

export type ResumeProfile = Prisma.CareerProfileGetPayload<{
  include: typeof careerProfileInclude;
}>;

function formatDate(value?: Date | string | null) {
  if (!value) return "至今";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function period(start?: Date | string | null, end?: Date | string | null) {
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (!startText && !endText) return "";
  return `${startText} - ${endText}`;
}

function sentenceJoin(items: string[]) {
  return items.filter(Boolean).join("；");
}

export function optimizeProjectBullets(project: ResumeProfile["projectItems"][number]) {
  const bullets: string[] = [];
  const context = sentenceJoin([project.background ?? "", project.goal ?? ""]);
  if (context) bullets.push(`围绕${context}，参与并推进项目落地。`);
  if (project.role) bullets.push(`担任${project.role}，负责${project.responsibilities.join("、") || "核心功能实现"}。`);
  if (project.techStack.length > 0) bullets.push(`基于${project.techStack.join("、")}完成相关模块开发与联调。`);
  project.highlights.forEach((highlight) => bullets.push(`实现${highlight}。`));
  if (project.results) bullets.push(`项目结果：${project.results}。`);
  project.metrics.forEach((metric) => bullets.push(`量化结果：${metric}。`));
  return bullets;
}

export function optimizeExperienceBullets(experience: ResumeProfile["experienceItems"][number]) {
  const bullets: string[] = [];
  if (experience.department) bullets.push(`在${experience.department}担任${experience.role}，参与业务需求开发与交付。`);
  experience.responsibilities.forEach((item) => bullets.push(`负责${item}。`));
  if (experience.techStack.length > 0) bullets.push(`使用${experience.techStack.join("、")}完成开发、联调和问题排查。`);
  experience.achievements.forEach((item) => bullets.push(`取得成果：${item}。`));
  if (experience.businessImpact) bullets.push(`业务影响：${experience.businessImpact}。`);
  experience.metrics.forEach((metric) => bullets.push(`量化结果：${metric}。`));
  return bullets;
}

export function detectResumeMissingFields(profile: ResumeProfile) {
  const missing: string[] = [];
  const basic = profile.basicInfo;
  if (!basic?.realName || !basic.phone || !basic.email) missing.push("基本联系方式不完整");
  if (profile.targetRoles.length === 0 || profile.targetCities.length === 0) missing.push("求职目标不明确");
  if (profile.educationItems.length === 0) missing.push("缺少教育经历");
  if (profile.skillItems.length < 3) missing.push("技能数量不足，建议至少 3 项");
  if (profile.projectItems.length === 0) missing.push("缺少项目经历");
  profile.projectItems.forEach((project) => {
    if (!project.results) missing.push(`项目「${project.name}」缺少结果描述`);
    if (project.metrics.length === 0) missing.push(`项目「${project.name}」缺少量化指标`);
  });
  profile.experienceItems.forEach((experience) => {
    if (experience.achievements.length === 0) missing.push(`经历「${experience.company}」缺少成果描述`);
  });
  const hasEvidence =
    profile.evidenceItems.length > 0 ||
    Boolean(basic?.githubUrl || basic?.portfolioUrl || basic?.personalWebsite);
  if (!hasEvidence) missing.push("缺少作品链接或证据材料");
  return missing;
}

export function generateImprovementQuestions(profile: ResumeProfile) {
  const questions: string[] = [];
  if (profile.targetRoles.length === 0) questions.push("你的目标岗位是 Java 后端、软件开发还是其他方向？");
  if (profile.targetCities.length === 0) questions.push("你优先考虑哪些求职城市？");
  profile.projectItems.forEach((project) => {
    if (project.metrics.length === 0) questions.push(`你的「${project.name}」项目最终支持了多少用户、请求量或数据量？`);
    if (!project.results) questions.push(`「${project.name}」项目最终交付了什么结果，是否上线、内测或获得课程/团队反馈？`);
  });
  profile.experienceItems.forEach((experience) => {
    if (experience.achievements.length === 0 && experience.metrics.length === 0) {
      questions.push(`你在「${experience.company}」实习中有没有可以量化的结果，例如耗时下降、缺陷减少或上线需求数量？`);
    }
  });
  if (profile.skillItems.length < 3) questions.push("你还掌握哪些编程语言、框架、数据库、工具或业务技能？");
  if (profile.evidenceItems.length === 0) questions.push("是否有 GitHub、作品集、项目截图或证书链接可以作为证明材料？");
  return questions;
}

function buildBasicInfo(profile: ResumeProfile) {
  const basic = profile.basicInfo;
  if (!basic) return "";
  return [
    `姓名：${basic.realName}`,
    `手机：${basic.phone}`,
    `邮箱：${basic.email}`,
    basic.location ? `所在地：${basic.location}` : "",
    basic.githubUrl ? `GitHub：${basic.githubUrl}` : "",
    basic.portfolioUrl ? `作品集：${basic.portfolioUrl}` : "",
    basic.personalWebsite ? `个人网站：${basic.personalWebsite}` : "",
  ].filter(Boolean).join("  \n");
}

export function buildResumeSections(profile: ResumeProfile): GeneratedResumeSection[] {
  const sections: GeneratedResumeSection[] = [];
  const targetRole = profile.targetRoles[0] ?? "";
  const targetCity = profile.targetCities[0] ?? "";

  sections.push({ type: "basic_info", title: "基本信息", contentMarkdown: buildBasicInfo(profile), order: 0 });
  sections.push({
    type: "summary",
    title: "求职意向",
    contentMarkdown: linesToMarkdownList([
      targetRole ? `目标岗位：${profile.targetRoles.join(" / ")}` : "",
      targetCity ? `目标城市：${profile.targetCities.join(" / ")}` : "",
      profile.expectedSalaryMin && profile.expectedSalaryMax
        ? `期望薪资：${profile.expectedSalaryMin}-${profile.expectedSalaryMax} 元/月`
        : "",
    ]),
    order: 1,
  });
  sections.push({
    type: "summary",
    title: "个人优势 / 个人简介",
    contentMarkdown:
      profile.personalSummary ||
      `具备${profile.skillItems.slice(0, 4).map((skill) => skill.name).join("、")}等能力，关注工程实践与业务交付。`,
    order: 2,
  });
  sections.push({
    type: "education",
    title: "教育经历",
    contentMarkdown: profile.educationItems
      .map((item) =>
        [
          `**${item.school}** · ${item.major} · ${item.degree}（${period(item.startDate, item.endDate)}）`,
          item.gpa ? `GPA：${item.gpa}` : "",
          item.ranking ? `排名：${item.ranking}` : "",
          item.courses.length ? `核心课程：${item.courses.join("、")}` : "",
          item.honors.length ? `荣誉：${item.honors.join("、")}` : "",
        ].filter(Boolean).join("\n"),
      )
      .join("\n\n"),
    order: 3,
  });
  sections.push({
    type: "skills",
    title: "专业技能",
    contentMarkdown: linesToMarkdownList(
      profile.skillItems.map((skill) =>
        `${skill.name}：${skill.level}${skill.evidence ? `，${skill.evidence}` : ""}`,
      ),
    ),
    order: 4,
  });
  sections.push({
    type: "projects",
    title: "项目经历",
    contentMarkdown: profile.projectItems
      .map((project) =>
        [
          `**${project.name}**${project.role ? ` · ${project.role}` : ""}${period(project.startDate, project.endDate) ? `（${period(project.startDate, project.endDate)}）` : ""}`,
          linesToMarkdownList(optimizeProjectBullets(project)),
          project.links.length ? `链接：${project.links.join("、")}` : "",
        ].filter(Boolean).join("\n"),
      )
      .join("\n\n"),
    order: 5,
  });
  sections.push({
    type: "experiences",
    title: "实习/工作经历",
    contentMarkdown: profile.experienceItems
      .map((experience) =>
        [
          `**${experience.company}** · ${experience.role}（${period(experience.startDate, experience.endDate)}）`,
          linesToMarkdownList(optimizeExperienceBullets(experience)),
        ].filter(Boolean).join("\n"),
      )
      .join("\n\n"),
    order: 6,
  });
  sections.push({
    type: "certificates",
    title: "证书与获奖",
    contentMarkdown: linesToMarkdownList([
      ...profile.certificateItems.map((item) => `${item.name}${item.issuer ? ` · ${item.issuer}` : ""}`),
      ...profile.awardItems.map((item) => `${item.name}${item.level ? ` · ${item.level}` : ""}${item.issuer ? ` · ${item.issuer}` : ""}`),
    ]),
    order: 7,
  });
  sections.push({
    type: "others",
    title: "作品链接 / 其他",
    contentMarkdown: linesToMarkdownList([
      ...profile.evidenceItems.map((item) => `${item.title}${item.url ? `：${item.url}` : ""}`),
      profile.basicInfo?.linkedinUrl ? `LinkedIn：${profile.basicInfo.linkedinUrl}` : "",
    ]),
    order: 8,
  });

  return sections;
}

export function buildResumeMarkdown(profile: ResumeProfile) {
  return buildMarkdownFromSections(buildResumeSections(profile));
}

export function generateResumeFromProfile(profile: ResumeProfile): ResumeGenerationResult {
  const sections = buildResumeSections(profile);
  const contentMarkdown = buildMarkdownFromSections(sections);
  const targetRole = profile.targetRoles[0] ?? "";
  const targetCity = profile.targetCities[0] ?? "";
  const missingFields = detectResumeMissingFields(profile);
  const improvementQuestions = generateImprovementQuestions(profile);
  const result: ResumeGenerationResult = {
    title: `${profile.basicInfo?.realName ?? "未命名"} - ${targetRole || "通用"}简历`,
    targetRole,
    targetCity,
    language: "zh-CN",
    contentMarkdown,
    sections,
    missingFields,
    improvementQuestions,
    qualityWarnings: missingFields.slice(0, 5),
    generationNotes: ["基于 Career Profile 规则生成，未使用 JD 定制。", "生成过程不添加未出现在职业档案中的事实或数字。"],
    qualityScore: 0,
  };
  result.qualityScore = calculateResumeQualityScore({ ...result, profile });
  return resumeGenerationResultSchema.parse(result);
}
