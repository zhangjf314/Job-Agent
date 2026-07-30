import type { ResumeProfile } from "@/services/resume-generator";
import type { JDAnalysisResult } from "@/types/jd";
import {
  buildCandidateFactRegistry,
  buildCandidateFactRenderDescriptors,
  buildJobRequirementFacts,
} from "@/services/ai/candidate-fact-registry";
import {
  tailoredResumePlanSchema,
  type TailoredResumePlan,
} from "@/services/ai/tailored-resume-plan";
import {
  validateTailoredResumePlan,
} from "@/services/ai/tailored-resume-plan-validator";
import {
  compileGroundedTailoredResume,
} from "@/services/ai/tailored-resume-grounded-compiler";
import {
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
} from "@/services/ai/tailored-resume-grounding";
import {
  evaluateTailoredResumeFactuality,
} from "@/services/ai/tailored-resume-factuality";
import { tailoredResumeResultSchema } from "@/schemas/jd";

export const PORTFOLIO_DEMO_MARKER = "portfolio-demo-v1";

export const portfolioProfileFixture: ResumeProfile = {
  id: "portfolio-demo-profile-v1",
  userId: "portfolio-demo-user-v1",
  targetRoles: ["AI 应用开发实习生", "Web 开发实习生"],
  targetCities: ["杭州", "上海"],
  expectedSalaryMin: null,
  expectedSalaryMax: null,
  expectedSalaryMonths: null,
  jobSearchStatus: "actively_looking",
  availabilityDate: null,
  personalSummary:
    "软件工程本科生，具备 Web 应用、关系型数据库和基础数据分析项目经验。",
  basicInfo: {
    realName: "林知远",
    email: "lin.zhiyuan@example.com",
    phone: "138-0000-0000",
    location: "杭州",
    githubUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    personalWebsite: null,
  },
  educationItems: [{
    school: "东海理工大学（虚构）",
    major: "软件工程",
    degree: "本科",
    startDate: new Date("2023-09-01"),
    endDate: new Date("2027-06-30"),
    gpa: null,
    ranking: null,
    courses: ["数据结构", "数据库原理", "软件工程"],
    honors: [],
  }],
  skillItems: [
    { name: "TypeScript", level: "intermediate", evidence: "课程与个人项目" },
    { name: "React", level: "intermediate", evidence: "CampusFlow" },
    { name: "Next.js", level: "intermediate", evidence: "CampusFlow" },
    { name: "Python", level: "beginner", evidence: "InsightLite" },
    { name: "PostgreSQL", level: "intermediate", evidence: "StudyBoard" },
    { name: "Prisma", level: "intermediate", evidence: "StudyBoard" },
    { name: "Docker", level: "beginner", evidence: "本地开发环境" },
    { name: "Git", level: "intermediate", evidence: "项目版本管理" },
  ],
  projectItems: [
    {
      name: "CampusFlow 校园活动平台",
      role: "课程项目成员",
      background: "软件工程课程项目",
      goal: "实现校园活动发布、报名与状态管理",
      responsibilities: ["实现活动列表和报名流程", "使用 React 构建交互页面"],
      techStack: ["TypeScript", "React", "Next.js"],
      highlights: ["课程项目，数据与页面均为演示用途"],
      results: null,
      metrics: [],
      links: [],
      startDate: null,
      endDate: null,
    },
    {
      name: "StudyBoard 课程任务管理系统",
      role: "个人项目",
      background: "个人学习项目",
      goal: "管理课程任务与截止日期",
      responsibilities: ["实现任务增删改查", "设计 PostgreSQL 数据模型"],
      techStack: ["Next.js", "PostgreSQL", "Prisma"],
      highlights: ["个人项目，不代表商业生产系统"],
      results: null,
      metrics: [],
      links: [],
      startDate: null,
      endDate: null,
    },
    {
      name: "InsightLite 数据分析看板",
      role: "课程 Demo 项目",
      background: "数据分析课程 Demo",
      goal: "展示公开示例数据的基础统计结果",
      responsibilities: ["使用 Python 清洗示例数据", "制作基础统计图表"],
      techStack: ["Python", "PostgreSQL"],
      highlights: ["仅使用虚构和公开示例数据"],
      results: null,
      metrics: [],
      links: [],
      startDate: null,
      endDate: null,
    },
  ],
  experienceItems: [],
  certificateItems: [],
  awardItems: [],
  evidenceItems: [],
  targetStatus: "open_to_opportunities",
} as unknown as ResumeProfile;

export const portfolioBaseResumeMarkdown = [
  "# 林知远",
  "",
  "Demo Data / 虚构演示数据",
  "",
  "## 教育经历",
  "东海理工大学（虚构） · 软件工程 · 本科 · 2027 年毕业",
  "",
  "## 技能",
  "TypeScript、React、Next.js、Python、PostgreSQL、Prisma、Docker、Git",
  "",
  "## 项目经历",
  "CampusFlow 校园活动平台（课程项目）",
  "StudyBoard 课程任务管理系统（个人项目）",
  "InsightLite 数据分析看板（课程 Demo）",
].join("\n");

export const portfolioJDAnalysis: JDAnalysisResult = {
  targetRole: "AI 应用开发实习生",
  seniorityLevel: "intern",
  internshipDuration: "3 个月以上",
  conversionOpportunity: "unknown",
  candidateProfile: ["具备 Web 应用开发基础的在校生"],
  coreResponsibilities: [
    "使用 Python 或 TypeScript 开发 Web 应用",
    "参与 API 集成和 PostgreSQL 数据建模",
  ],
  hardSkills: ["Python", "TypeScript", "Web 应用开发", "PostgreSQL", "Git"],
  softSkills: ["良好沟通能力"],
  experienceRequirements: [],
  educationRequirements: ["软件工程或相关专业本科在读"],
  bonusPoints: ["有大模型应用项目经验者优先"],
  keywords: ["Python", "TypeScript", "PostgreSQL", "Git", "API"],
  matchScore: 78,
  scoreBreakdown: {
    hardSkillScore: 82,
    projectMatchScore: 80,
    experienceMatchScore: 45,
    educationMatchScore: 90,
    keywordCoverageScore: 78,
  },
  matchedPoints: ["TypeScript", "Python", "PostgreSQL", "Git"],
  gaps: ["尚无大模型应用项目事实", "缺少真实实习经历"],
  riskWarnings: ["不得将岗位加分项写成候选人已有经历"],
  resumeRewriteSuggestions: ["突出已有 Web、数据库和课程项目事实"],
};

function idsByCategory(
  facts: ReturnType<typeof buildCandidateFactRegistry>,
  categories: string[],
) {
  return facts
    .filter((fact) => categories.includes(fact.category))
    .map((fact) => fact.id);
}

export function buildPortfolioCompiledResume() {
  const facts = buildCandidateFactRegistry(
    portfolioProfileFixture,
    portfolioBaseResumeMarkdown,
  );
  const descriptors = buildCandidateFactRenderDescriptors(facts);
  const skills = idsByCategory(facts, ["skill"]).slice(0, 8);
  const projects = idsByCategory(facts, [
    "project",
    "project_technology",
    "project_responsibility",
  ]).slice(0, 10);
  const education = idsByCategory(facts, ["education"]);
  const plan: TailoredResumePlan = {
    sections: {
      summary: { factIds: [education[0], skills[0]].filter(Boolean) },
      skills: { factIds: skills },
      projects: { factIds: projects },
      experiences: { factIds: [] },
      education: { factIds: education },
      others: { factIds: [] },
    },
    applicationMaterials: {
      selfIntroductionFactIds: skills.slice(0, 2),
      applicationEmailFactIds: projects.slice(0, 2),
      recruiterMessageFactIds: education.slice(0, 1),
    },
    changedSections: ["skills", "projects"],
    priorityFactIds: [...skills, ...projects, ...education].slice(0, 20),
  };
  const schemaPlan = tailoredResumePlanSchema.parse(plan);
  const validated = validateTailoredResumePlan(
    schemaPlan,
    facts,
    descriptors,
  );
  const compiled = compileGroundedTailoredResume({
    plan: validated.plan,
    factRegistry: facts,
    renderDescriptors: descriptors,
    jdAnalysis: portfolioJDAnalysis,
  });
  const grounded = groundedTailoredResumeSchema.parse(compiled.grounded);
  const requirements = buildJobRequirementFacts(portfolioJDAnalysis, facts);
  const factuality = evaluateTailoredResumeFactuality(
    grounded,
    facts,
    requirements,
  );
  if (factuality.status !== "pass" || factuality.violations.length > 0) {
    throw new Error("Portfolio compiler fixture failed factuality gate.");
  }
  const publicResult = tailoredResumeResultSchema.parse(
    stripGroundingMetadata(grounded),
  );
  return {
    facts,
    plan: validated.plan,
    grounded,
    factuality,
    publicResult,
    compilerDiagnostics: compiled.diagnostics,
  };
}
