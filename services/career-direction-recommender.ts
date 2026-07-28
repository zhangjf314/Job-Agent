import type { JDAnalysis, Resume } from "@prisma/client";
import type { CareerDirectionRecommendationInput } from "@/schemas/strategy";
import type { ResumeProfile } from "./resume-generator";

type DirectionRule = {
  directionName: string;
  roleFamily: CareerDirectionRecommendationInput["roleFamily"];
  skills: string[];
  projectKeywords: string[];
  experienceKeywords: string[];
  roles: string[];
  industries: string[];
  keywords: string[];
};

const rules: DirectionRule[] = [
  { directionName: "Java 后端开发", roleFamily: "engineering", skills: ["Java", "Spring Boot", "MySQL", "Redis", "RabbitMQ"], projectKeywords: ["后端", "订单", "接口", "MySQL", "Spring Boot"], experienceKeywords: ["后端", "接口", "Spring Boot", "MySQL"], roles: ["Java 后端开发", "后端开发工程师", "Java 开发实习生"], industries: ["互联网", "企业服务", "电商", "金融科技"], keywords: ["Java 后端", "Spring Boot", "MySQL", "应届生"] },
  { directionName: "软件开发工程师", roleFamily: "engineering", skills: ["Java", "Python", "TypeScript", "SQL", "Git"], projectKeywords: ["系统", "开发", "接口", "服务"], experienceKeywords: ["开发", "联调", "上线"], roles: ["软件开发工程师", "研发工程师", "开发实习生"], industries: ["软件", "互联网", "制造业数字化"], keywords: ["软件开发工程师", "校招", "应届生"] },
  { directionName: "前端开发", roleFamily: "engineering", skills: ["Vue", "React", "TypeScript", "JavaScript"], projectKeywords: ["前端", "页面", "组件", "Vue", "React"], experienceKeywords: ["前端", "页面"], roles: ["前端开发", "Web 前端开发"], industries: ["互联网", "SaaS"], keywords: ["前端开发", "React", "Vue"] },
  { directionName: "测试开发", roleFamily: "engineering", skills: ["Java", "Python", "SQL", "自动化测试"], projectKeywords: ["测试", "接口", "质量", "自动化"], experienceKeywords: ["测试", "缺陷", "问题排查"], roles: ["测试开发", "质量工程师", "测试实习生"], industries: ["互联网", "软件"], keywords: ["测试开发", "接口测试", "自动化测试"] },
  { directionName: "数据分析", roleFamily: "data", skills: ["SQL", "Python", "数据分析", "Excel"], projectKeywords: ["数据", "分析", "指标", "报表"], experienceKeywords: ["数据", "指标", "分析"], roles: ["数据分析师", "商业分析实习生"], industries: ["互联网", "零售", "金融"], keywords: ["数据分析", "SQL", "Python"] },
  { directionName: "AI 应用开发 / 大模型应用开发", roleFamily: "engineering", skills: ["Python", "TypeScript", "React", "LLM", "RAG"], projectKeywords: ["AI", "大模型", "智能", "生成"], experienceKeywords: ["AI", "智能"], roles: ["AI 应用开发", "大模型应用开发实习生"], industries: ["AI 应用", "企业服务"], keywords: ["AI 应用开发", "大模型", "RAG"] },
  { directionName: "产品经理", roleFamily: "product", skills: ["需求分析", "产品经理", "用户增长"], projectKeywords: ["需求", "用户", "流程", "产品"], experienceKeywords: ["需求", "业务", "协作"], roles: ["产品经理实习生", "助理产品经理"], industries: ["互联网", "企业服务"], keywords: ["产品经理", "需求分析", "应届生"] },
  { directionName: "运营", roleFamily: "operations", skills: ["用户增长", "数据分析", "活动运营"], projectKeywords: ["用户", "增长", "运营"], experienceKeywords: ["运营", "用户"], roles: ["运营实习生", "用户运营"], industries: ["互联网", "教育", "电商"], keywords: ["运营", "用户增长", "应届生"] },
  { directionName: "其他兜底方向", roleFamily: "other", skills: [], projectKeywords: [], experienceKeywords: [], roles: ["信息化专员", "技术支持", "实施工程师"], industries: ["软件服务", "企业信息化"], keywords: ["技术支持", "实施", "应届生"] },
];

function contains(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function evidenceText(profile: ResumeProfile) {
  return [
    profile.skillItems.map((skill) => `${skill.name} ${skill.evidence ?? ""}`).join(" "),
    profile.projectItems.map((item) => `${item.name} ${item.role ?? ""} ${item.techStack.join(" ")} ${item.responsibilities.join(" ")} ${item.highlights.join(" ")} ${item.results ?? ""}`).join(" "),
    profile.experienceItems.map((item) => `${item.company} ${item.role} ${item.techStack.join(" ")} ${item.responsibilities.join(" ")} ${item.achievements.join(" ")}`).join(" "),
    profile.educationItems.map((item) => `${item.major} ${item.degree} ${item.courses.join(" ")}`).join(" "),
  ].join(" ");
}

export function recommendCareerDirections(
  profile: ResumeProfile,
  resumes: Array<Pick<Resume, "qualityScore">> = [],
  jdAnalyses: Array<Pick<JDAnalysis, "targetRole" | "matchScore">> = [],
) {
  void resumes;
  const allText = evidenceText(profile);
  const userSkills = profile.skillItems.map((skill) => skill.name);
  const targetText = profile.targetRoles.join(" ");
  const cityFallback = profile.targetCities.length ? profile.targetCities : ["杭州", "上海", "南京"];

  return rules
    .map((rule): CareerDirectionRecommendationInput => {
      const matchedSkills = rule.skills.filter((skill) => userSkills.some((userSkill) => contains(userSkill, skill) || contains(skill, userSkill)));
      const skillScore = rule.skills.length ? (matchedSkills.length / rule.skills.length) * 100 : 35;
      const projectHits = profile.projectItems.filter((project) => rule.projectKeywords.some((keyword) => contains(`${project.name} ${project.techStack.join(" ")} ${project.responsibilities.join(" ")} ${project.highlights.join(" ")}`, keyword))).length;
      const projectScore = profile.projectItems.length ? (projectHits / profile.projectItems.length) * 100 : 0;
      const experienceHits = profile.experienceItems.filter((experience) => rule.experienceKeywords.some((keyword) => contains(`${experience.role} ${experience.techStack.join(" ")} ${experience.responsibilities.join(" ")} ${experience.achievements.join(" ")}`, keyword))).length;
      const experienceScore = profile.experienceItems.length ? (experienceHits / profile.experienceItems.length) * 100 : 20;
      const educationScore = /计算机|软件|数据|信息/.test(allText) ? 90 : 45;
      const preferenceScore = contains(targetText, rule.directionName) || rule.roles.some((role) => contains(targetText, role)) ? 100 : 40;
      const jdScore = jdAnalyses.filter((item) => contains(item.targetRole, rule.directionName) || rule.roles.some((role) => contains(item.targetRole, role))).at(0)?.matchScore ?? 50;
      const matchScore = clamp(skillScore * 0.3 + projectScore * 0.25 + experienceScore * 0.2 + educationScore * 0.1 + preferenceScore * 0.1 + jdScore * 0.05);
      const gaps = rule.skills.filter((skill) => !matchedSkills.includes(skill)).map((skill) => `需要补齐或证明：${skill}`);
      const matchedEvidence = [
        ...matchedSkills.map((skill) => `已有技能：${skill}`),
        ...profile.projectItems.filter((project) => rule.projectKeywords.some((keyword) => contains(`${project.name} ${project.techStack.join(" ")} ${project.responsibilities.join(" ")}`, keyword))).map((project) => `项目证据：${project.name}`),
        ...profile.experienceItems.filter((experience) => rule.experienceKeywords.some((keyword) => contains(`${experience.role} ${experience.techStack.join(" ")} ${experience.responsibilities.join(" ")}`, keyword))).map((experience) => `经历证据：${experience.company} ${experience.role}`),
      ];
      return {
        directionName: rule.directionName,
        roleFamily: rule.roleFamily,
        matchScore,
        confidence: clamp((matchedEvidence.length * 18) + (profile.profileCompletenessScore ?? 0) * 0.4),
        priority: matchScore >= 70 ? "high" : matchScore >= 45 ? "medium" : "low",
        suitableRoles: rule.roles,
        suitableIndustries: rule.industries,
        recommendedCities: cityFallback,
        matchedEvidence,
        gaps,
        risks: gaps.length >= 3 ? ["关键技能证据不足，建议先补齐项目或学习证明再集中投递。"] : [],
        resumeFocus: matchedSkills.length ? [`突出 ${matchedSkills.join("、")} 与项目/实习证据。`] : ["先补充可验证技能与项目证据，再制作方向简历。"],
        searchKeywords: [...rule.keywords, ...cityFallback],
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}
