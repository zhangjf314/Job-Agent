import type { ResumeProfile } from "@/services/resume-generator";
import type { JDAnalysisResult } from "@/types/jd";
import {
  buildCandidateFactRegistry,
  buildCandidateFactRenderDescriptors,
  buildJobRequirementFacts,
  isProjectCandidateFact,
} from "@/services/ai/candidate-fact-registry";
import {
  atomizeProject,
  projectStableKey,
} from "@/services/project-facts/project-fact-atomizer";
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
export const PORTFOLIO_DEMO_TIMESTAMP = "2026-07-30T10:08:57.000Z";

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
      projectType: "课程项目",
      role: "课程项目成员",
      background: "软件工程课程项目",
      goal: "实现校园活动发布、报名与状态管理",
      fullDescription: "- 实现活动列表、报名流程与状态管理\n- 使用 React 构建交互页面\n- 建立基础组件测试与代码检查",
      responsibilities: ["实现活动列表和报名流程", "使用 React 构建交互页面"],
      techStack: ["TypeScript", "React", "Next.js"],
      highlights: ["课程项目，数据与页面均为演示用途"],
      challenges: ["保持活动报名状态与页面展示一致"],
      solutions: ["使用明确的状态字段驱动页面渲染"],
      engineeringPractices: ["建立基础组件测试与代码检查"],
      results: "完成课程验收演示",
      metrics: [],
      links: [],
      startDate: null,
      endDate: null,
    },
    {
      name: "StudyBoard 课程任务管理系统",
      projectType: "个人学习项目",
      role: "个人项目",
      background: "个人学习项目",
      goal: "管理课程任务与截止日期",
      fullDescription: "- 实现任务增删改查\n- 设计 PostgreSQL 数据模型\n- 使用 Prisma 管理数据库访问",
      responsibilities: ["实现任务增删改查", "设计 PostgreSQL 数据模型"],
      techStack: ["Next.js", "PostgreSQL", "Prisma"],
      highlights: ["个人项目，不代表商业生产系统"],
      challenges: ["保持任务状态和截止日期数据一致"],
      solutions: ["通过 Prisma Schema 统一数据约束"],
      engineeringPractices: ["维护可重复执行的数据库迁移"],
      results: "完成个人学习场景演示",
      metrics: [],
      links: [],
      startDate: null,
      endDate: null,
    },
    {
      name: "InsightLite 数据分析看板",
      projectType: "课程 Demo",
      role: "课程 Demo 项目",
      background: "数据分析课程 Demo",
      goal: "展示公开示例数据的基础统计结果",
      fullDescription: "- 使用 Python 清洗示例数据\n- 制作基础统计图表\n- 校验输入数据字段",
      responsibilities: ["使用 Python 清洗示例数据", "制作基础统计图表"],
      techStack: ["Python", "PostgreSQL"],
      highlights: ["仅使用虚构和公开示例数据"],
      challenges: ["处理示例数据中的空值和字段差异"],
      solutions: ["在统计前执行确定性数据清洗"],
      engineeringPractices: ["增加输入字段校验"],
      results: "完成课程数据分析展示",
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
  const profileWithFacts = {
    ...portfolioProfileFixture,
    projectItems: portfolioProfileFixture.projectItems.map((project, index) => {
      const id = `portfolio-demo-project-${index + 1}`;
      const stableKey = projectStableKey(project.name);
      return {
        ...project,
        id,
        stableKey,
        factAtoms: atomizeProject({ ...project, id, stableKey }).map((atom, atomIndex) => ({
          ...atom,
          id: `${id}-atom-${atomIndex + 1}`,
          createdAt: new Date(PORTFOLIO_DEMO_TIMESTAMP),
          updatedAt: new Date(PORTFOLIO_DEMO_TIMESTAMP),
        })),
      };
    }),
  } as ResumeProfile;
  const facts = buildCandidateFactRegistry(
    profileWithFacts,
    portfolioBaseResumeMarkdown,
  );
  const descriptors = buildCandidateFactRenderDescriptors(facts);
  const skills = idsByCategory(facts, ["skill"]).slice(0, 8);
  const projects = idsByCategory(facts, [
    "project",
  ]).slice(0, 10);
  const projectFacts = facts.filter(isProjectCandidateFact);
  const firstProjectReference = projectFacts[0]?.project.projectReference;
  const secondProjectReference = projectFacts.find(
    (fact) => fact.project.projectReference !== firstProjectReference,
  )?.project.projectReference;
  const pick = (projectReference: string | undefined, category: string) =>
    projectFacts.find(
      (fact) => fact.project.projectReference === projectReference && fact.project.category === category,
    )?.id;
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
    projectRewrites: [
      {
        projectId: firstProjectReference!,
        bullets: [{
          pattern: "action_technology",
          factIds: [pick(firstProjectReference, "responsibility"), pick(firstProjectReference, "technology")].filter((id): id is string => Boolean(id)),
        }],
      },
      {
        projectId: secondProjectReference!,
        bullets: [{
          pattern: "action_solution",
          factIds: [pick(secondProjectReference, "responsibility"), pick(secondProjectReference, "solution")].filter((id): id is string => Boolean(id)),
        }],
      },
    ],
  };
  const schemaPlan = tailoredResumePlanSchema.parse(plan);
  const validated = validateTailoredResumePlan(
    schemaPlan,
    facts,
    descriptors,
    projectFacts,
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
  const parsedPublicResult = tailoredResumeResultSchema.parse(stripGroundingMetadata(grounded));
  const publicResult = {
    ...parsedPublicResult,
    projectComparison: compiled.compiledProjectBullets.map((bullet) => {
      const sourceFacts = bullet.sourceFactIds
        .map((id) => projectFacts.find((fact) => fact.id === id))
        .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));
      const sourceProject = profileWithFacts.projectItems.find(
        (project) => project.id === sourceFacts[0]?.project.internalProjectId,
      );
      return {
        projectReference: bullet.projectId,
        projectName: sourceProject?.name ?? "虚构项目",
        projectType: sourceProject?.projectType ?? null,
        role: sourceProject?.role ?? null,
        originalDescription: sourceProject?.fullDescription ?? "",
        tailoredBullets: [bullet.text],
        evidence: sourceFacts.map((fact) => ({
          category: fact.project.category,
          canonicalText: fact.text,
          assertionStrength: fact.project.assertionStrength,
        })),
        patterns: [bullet.pattern],
      };
    }),
  };
  return {
    facts,
    plan: validated.plan,
    grounded,
    factuality,
    publicResult,
    compilerDiagnostics: compiled.diagnostics,
  };
}
