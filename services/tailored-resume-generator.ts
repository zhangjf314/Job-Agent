import { tailoredResumeResultSchema } from "@/schemas/jd";
import type { JDAnalysisResult, TailoredResumeResult } from "@/types/jd";
import type { GeneratedResumeSection } from "@/types/resume";
import type { ResumeProfile } from "./resume-generator";
import { optimizeExperienceBullets, optimizeProjectBullets } from "./resume-generator";
import { buildMarkdownFromSections, linesToMarkdownList } from "./resume-markdown";

type BaseResume = {
  contentMarkdown: string;
};

function contains(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function itemText(...parts: unknown[]) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter(Boolean)
    .join(" ");
}

function scoreText(text: string, keywords: string[]) {
  return keywords.filter((keyword) => contains(text, keyword)).length;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "至今";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function period(start?: Date | string | null, end?: Date | string | null) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function buildBasic(profile: ResumeProfile) {
  const basic = profile.basicInfo;
  if (!basic) return "";
  return [
    `姓名：${basic.realName}`,
    `手机：${basic.phone}`,
    `邮箱：${basic.email}`,
    basic.location ? `所在地：${basic.location}` : "",
    basic.githubUrl ? `GitHub：${basic.githubUrl}` : "",
    basic.personalWebsite ? `个人网站：${basic.personalWebsite}` : "",
  ].filter(Boolean).join("  \n");
}

function redactGapSkills(text: string, gaps: string[]) {
  return gaps.reduce((current, gap) => {
    const skill = gap.replace(/^缺少 JD 要求技能：/, "").trim();
    return skill ? current.replaceAll(skill, "") : current;
  }, text);
}

function matchedSkillNames(profile: ResumeProfile, jdAnalysis: JDAnalysisResult) {
  return profile.skillItems.filter((skill) =>
    jdAnalysis.hardSkills.some((requiredSkill) => contains(skill.name, requiredSkill) || contains(requiredSkill, skill.name)),
  );
}

function buildApplicationMaterials(profile: ResumeProfile, jdAnalysis: JDAnalysisResult) {
  const name = profile.basicInfo?.realName || "候选人";
  const education = profile.educationItems[0];
  const skills = matchedSkillNames(profile, jdAnalysis).map((item) => item.name).slice(0, 4);
  const project = profile.projectItems[0];
  const factualSummary = [
    education ? `${education.school}${education.major}${education.degree}` : "",
    skills.length ? `具备${skills.join("、")}相关实践` : "",
    project ? `完成过${project.name}项目` : "",
  ].filter(Boolean).join("，");
  const role = jdAnalysis.targetRole || profile.targetRoles[0] || "该岗位";

  return {
    selfIntroduction: `您好，我是${name}，${factualSummary || "正在寻找与个人经历匹配的实习机会"}。我希望应聘${role}，并愿意结合已有项目与经历进一步介绍我的岗位匹配点。`,
    applicationEmail: `主题：应聘${role} - ${name}\n\n您好，\n\n我希望应聘贵公司的${role}。${factualSummary || "我的职业档案与简历已随信附上"}。附件为针对该岗位整理的简历，期待获得进一步沟通机会。\n\n谢谢！\n${name}`,
    recruiterMessage: `您好，我想应聘${role}。${factualSummary || "我已根据岗位要求整理了个人经历"}，方便的话希望进一步了解岗位职责、实习安排和后续流程，谢谢。`,
  };
}

export function generateTailoredResumeContent(
  profile: ResumeProfile,
  baseResume: BaseResume,
  jdAnalysis: JDAnalysisResult,
): TailoredResumeResult {
  const matchedSkills = matchedSkillNames(profile, jdAnalysis);
  const otherSkills = profile.skillItems.filter((skill) => !matchedSkills.some((matched) => matched.id === skill.id));
  const orderedProjects = [...profile.projectItems].sort(
    (left, right) =>
      scoreText(itemText(right.name, right.techStack, right.responsibilities, right.highlights, right.results), jdAnalysis.keywords) -
      scoreText(itemText(left.name, left.techStack, left.responsibilities, left.highlights, left.results), jdAnalysis.keywords),
  );
  const orderedExperiences = [...profile.experienceItems].sort(
    (left, right) =>
      scoreText(itemText(right.role, right.techStack, right.responsibilities, right.achievements, right.businessImpact), jdAnalysis.keywords) -
      scoreText(itemText(left.role, left.techStack, left.responsibilities, left.achievements, left.businessImpact), jdAnalysis.keywords),
  );

  const sections: GeneratedResumeSection[] = [
    { type: "basic_info", title: "基本信息", contentMarkdown: buildBasic(profile), order: 0 },
    {
      type: "summary",
      title: "求职意向",
      contentMarkdown: linesToMarkdownList([
        jdAnalysis.targetRole ? `目标岗位：${jdAnalysis.targetRole}` : `目标岗位：${profile.targetRoles.join(" / ")}`,
        profile.targetCities.length ? `目标城市：${profile.targetCities.join(" / ")}` : "",
      ]),
      order: 1,
    },
    {
      type: "summary",
      title: "个人优势 / 岗位匹配摘要",
      contentMarkdown:
        (profile.personalSummary ? redactGapSkills(profile.personalSummary, jdAnalysis.gaps) : "") ||
        `围绕${jdAnalysis.targetRole || "目标岗位"}，具备${matchedSkills.map((skill) => skill.name).join("、") || profile.skillItems.slice(0, 3).map((skill) => skill.name).join("、")}等已验证能力。`,
      order: 2,
    },
    {
      type: "skills",
      title: "专业技能",
      contentMarkdown: linesToMarkdownList(
        [...matchedSkills, ...otherSkills].map((skill) =>
          `${skill.name}：${skill.level}${skill.evidence ? `，${skill.evidence}` : ""}`,
        ),
      ),
      order: 3,
    },
    {
      type: "projects",
      title: "项目经历",
      contentMarkdown: orderedProjects
        .map((project) =>
          [
            `**${project.name}**${project.role ? ` · ${project.role}` : ""}（${period(project.startDate, project.endDate)}）`,
            linesToMarkdownList(optimizeProjectBullets(project)),
            project.links.length ? `链接：${project.links.join("、")}` : "",
          ].filter(Boolean).join("\n"),
        )
        .join("\n\n"),
      order: 4,
    },
    {
      type: "experiences",
      title: "实习/工作经历",
      contentMarkdown: orderedExperiences
        .map((experience) =>
          [
            `**${experience.company}** · ${experience.role}（${period(experience.startDate, experience.endDate)}）`,
            linesToMarkdownList(optimizeExperienceBullets(experience)),
          ].filter(Boolean).join("\n"),
        )
        .join("\n\n"),
      order: 5,
    },
    {
      type: "education",
      title: "教育经历",
      contentMarkdown: profile.educationItems
        .map((item) =>
          [
            `**${item.school}** · ${item.major} · ${item.degree}（${period(item.startDate, item.endDate)}）`,
            item.courses.length ? `核心课程：${item.courses.join("、")}` : "",
            item.honors.length ? `荣誉：${item.honors.join("、")}` : "",
          ].filter(Boolean).join("\n"),
        )
        .join("\n\n"),
      order: 6,
    },
    {
      type: "certificates",
      title: "证书与获奖",
      contentMarkdown: linesToMarkdownList([
        ...profile.certificateItems.map((item) => `${item.name}${item.issuer ? ` · ${item.issuer}` : ""}`),
        ...profile.awardItems.map((item) => `${item.name}${item.level ? ` · ${item.level}` : ""}`),
      ]),
      order: 7,
    },
    {
      type: "others",
      title: "作品链接 / 其他",
      contentMarkdown: linesToMarkdownList(profile.evidenceItems.map((item) => `${item.title}${item.url ? `：${item.url}` : ""}`)),
      order: 8,
    },
  ];

  const changedSections = ["专业技能", "项目经历", "实习/工作经历", "求职意向"];
  const rewriteExplanation = [
    "将与 JD 硬技能匹配的技能前置展示。",
    "按 JD 关键词与项目事实的匹配度调整项目顺序。",
    "保留 Career Profile 中已有教育、项目、经历、证书和获奖事实，未补写不存在的技能或指标。",
  ];
  if (baseResume.contentMarkdown.includes("## 专业技能")) {
    rewriteExplanation.push("基于基础简历结构生成岗位定制版本，并保留 Markdown 可编辑格式。");
  }

  return tailoredResumeResultSchema.parse({
    contentMarkdown: buildMarkdownFromSections(sections),
    sections,
    rewriteExplanation,
    changedSections,
    missingFields: jdAnalysis.gaps,
    improvementQuestions: jdAnalysis.gaps.map((gap) => `${gap} 是否可以通过真实学习记录、项目证据或面试准备来补充？`),
    qualityWarnings: jdAnalysis.riskWarnings,
    applicationMaterials: buildApplicationMaterials(profile, jdAnalysis),
  });
}
