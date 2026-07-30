import { PrismaClient } from "@prisma/client";
import {
  PORTFOLIO_DEMO_MARKER,
  buildPortfolioCompiledResume,
  portfolioBaseResumeMarkdown,
  portfolioJDAnalysis,
  portfolioProfileFixture,
} from "./portfolio-fixtures";
import { assertPortfolioDatabaseUrl } from "./portfolio-env";

const prisma = new PrismaClient();
const ids = {
  user: "portfolio-demo-user-v1",
  profile: "portfolio-demo-profile-v1",
  baseResume: "portfolio-demo-base-resume-v1",
  tailoredResume: "portfolio-demo-tailored-resume-v1",
  jd: "portfolio-demo-jd-v1",
  analysis: "portfolio-demo-jd-analysis-v1",
  tailored: "portfolio-demo-tailored-link-v1",
  strategy: "portfolio-demo-strategy-v1",
  direction: "portfolio-demo-direction-v1",
  gap: "portfolio-demo-gap-v1",
  search: "portfolio-demo-search-v1",
  action: "portfolio-demo-action-v1",
  job: "portfolio-demo-job-v1",
  match: "portfolio-demo-match-v1",
  application: "portfolio-demo-application-v1",
  evaluation: "portfolio-demo-evaluation-v1",
  logJD: "portfolio-demo-log-jd-v1",
  logStrategy: "portfolio-demo-log-strategy-v1",
  logTailored: "portfolio-demo-log-tailored-v1",
};

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function seed() {
  assertPortfolioDatabaseUrl(process.env.DATABASE_URL);
  const compiled = buildPortfolioCompiledResume();
  const basicInfo = portfolioProfileFixture.basicInfo;
  if (!basicInfo) throw new Error("Portfolio fixture basicInfo is required.");
  const markerMetadata = {
    demo: true,
    generatedBy: "portfolio-seed",
    marker: PORTFOLIO_DEMO_MARKER,
  };

  await prisma.lLMCallLog.deleteMany({
    where: { id: { in: [ids.logJD, ids.logStrategy, ids.logTailored] } },
  });
  await prisma.user.deleteMany({
    where: { email: basicInfo.email },
  });
  await prisma.jobPost.deleteMany({
    where: { contentHash: PORTFOLIO_DEMO_MARKER },
  });

  await prisma.user.create({
    data: {
      id: ids.user,
      name: "林知远（虚构演示）",
      email: basicInfo.email,
      profiles: {
        create: {
          id: ids.profile,
          targetStatus: "seeking_internship",
          targetRoles: portfolioProfileFixture.targetRoles,
          targetCities: portfolioProfileFixture.targetCities,
          personalSummary: portfolioProfileFixture.personalSummary,
          profileCompletenessScore: 92,
          basicInfo: {
            create: {
              realName: basicInfo.realName,
              phone: basicInfo.phone,
              email: basicInfo.email,
              location: basicInfo.location,
            },
          },
          educationItems: {
            create: [{
              school: "东海理工大学（虚构）",
              major: "软件工程",
              degree: "本科",
              startDate: new Date("2023-09-01"),
              endDate: new Date("2027-06-30"),
              courses: ["数据结构", "数据库原理", "软件工程"],
              honors: [],
            }],
          },
          skillItems: {
            create: [
              ["TypeScript", "programming_language", "intermediate", "课程与个人项目"],
              ["React", "framework", "intermediate", "CampusFlow"],
              ["Next.js", "framework", "intermediate", "CampusFlow"],
              ["Python", "programming_language", "beginner", "InsightLite"],
              ["PostgreSQL", "database", "intermediate", "StudyBoard"],
              ["Prisma", "tool", "intermediate", "StudyBoard"],
              ["Docker", "tool", "beginner", "本地开发环境"],
              ["Git", "tool", "intermediate", "项目版本管理"],
            ].map(([name, category, level, evidence]) => ({
              name,
              category: category as never,
              level: level as never,
              evidence,
            })),
          },
          projectItems: {
            create: portfolioProfileFixture.projectItems.map((project) => ({
              name: project.name,
              role: project.role,
              background: project.background,
              goal: project.goal,
              responsibilities: project.responsibilities,
              techStack: project.techStack,
              highlights: project.highlights,
              results: project.results,
              metrics: project.metrics,
              links: project.links,
            })),
          },
        },
      },
    },
  });

  await prisma.resume.create({
    data: {
      id: ids.baseResume,
      profileId: ids.profile,
      title: "林知远 Web 开发通用简历（虚构演示）",
      targetRole: "Web 开发实习生",
      targetCity: "杭州",
      type: "general",
      status: "active",
      templateKey: "minimal",
      contentMarkdown: portfolioBaseResumeMarkdown,
      contentJson: json({ ...markerMetadata }),
      sourceProfileSnapshot: json({ ...markerMetadata }),
      sourceProfileVersion: PORTFOLIO_DEMO_MARKER,
      completenessScore: 92,
      qualityScore: 88,
      missingFields: ["缺少真实实习经历"],
      improvementQuestions: ["是否可以补充真实的工作或实习经历？"],
      qualityWarnings: [],
      generationNotes: ["Demo Data / 虚构演示数据"],
      isDefault: true,
      sections: {
        create: [
          { type: "education", title: "教育经历", contentMarkdown: "东海理工大学（虚构） · 软件工程 · 本科", order: 0 },
          { type: "skills", title: "技能", contentMarkdown: "TypeScript、React、Next.js、Python、PostgreSQL、Prisma、Docker、Git", order: 1 },
          { type: "projects", title: "项目经历", contentMarkdown: "三个课程、个人与 Demo 项目", order: 2 },
        ],
      },
    },
  });

  await prisma.jobDescription.create({
    data: {
      id: ids.jd,
      profileId: ids.profile,
      resumeId: ids.baseResume,
      title: "AI 应用开发实习生",
      company: "星桥科技（虚构）",
      city: "杭州",
      rawText:
        "Demo JD：使用 Python 或 TypeScript 开发 Web 应用，参与 API 集成和 PostgreSQL 数据建模；有大模型应用项目经验者优先。",
      sourceUrl: "https://example.com/portfolio-demo-job",
    },
  });
  await prisma.jDAnalysis.create({
    data: {
      id: ids.analysis,
      jobDescriptionId: ids.jd,
      profileId: ids.profile,
      resumeId: ids.baseResume,
      targetRole: portfolioJDAnalysis.targetRole,
      seniorityLevel: "intern",
      internshipDuration: portfolioJDAnalysis.internshipDuration,
      conversionOpportunity: "unknown",
      candidateProfile: portfolioJDAnalysis.candidateProfile,
      coreResponsibilities: portfolioJDAnalysis.coreResponsibilities,
      hardSkills: portfolioJDAnalysis.hardSkills,
      softSkills: portfolioJDAnalysis.softSkills,
      experienceRequirements: portfolioJDAnalysis.experienceRequirements,
      educationRequirements: portfolioJDAnalysis.educationRequirements,
      bonusPoints: portfolioJDAnalysis.bonusPoints,
      keywords: portfolioJDAnalysis.keywords,
      matchScore: portfolioJDAnalysis.matchScore,
      hardSkillScore: portfolioJDAnalysis.scoreBreakdown.hardSkillScore,
      projectMatchScore: portfolioJDAnalysis.scoreBreakdown.projectMatchScore,
      experienceMatchScore: portfolioJDAnalysis.scoreBreakdown.experienceMatchScore,
      educationMatchScore: portfolioJDAnalysis.scoreBreakdown.educationMatchScore,
      keywordCoverageScore: portfolioJDAnalysis.scoreBreakdown.keywordCoverageScore,
      matchedPoints: portfolioJDAnalysis.matchedPoints,
      gaps: portfolioJDAnalysis.gaps,
      riskWarnings: portfolioJDAnalysis.riskWarnings,
      resumeRewriteSuggestions: portfolioJDAnalysis.resumeRewriteSuggestions,
    },
  });

  await prisma.resume.create({
    data: {
      id: ids.tailoredResume,
      profileId: ids.profile,
      title: "AI 应用开发实习生定制简历（虚构演示）",
      targetRole: portfolioJDAnalysis.targetRole,
      targetCity: "杭州",
      type: "jd_tailored",
      status: "active",
      templateKey: "clean",
      contentMarkdown: compiled.publicResult.contentMarkdown,
      contentJson: json({
        ...markerMetadata,
        applicationMaterials: compiled.publicResult.applicationMaterials,
        compilerDiagnostics: compiled.compilerDiagnostics,
      }),
      sourceProfileSnapshot: json({ ...markerMetadata }),
      sourceProfileVersion: PORTFOLIO_DEMO_MARKER,
      completenessScore: 92,
      qualityScore: 91,
      missingFields: compiled.publicResult.missingFields,
      improvementQuestions: compiled.publicResult.improvementQuestions,
      qualityWarnings: compiled.publicResult.qualityWarnings,
      generationNotes: [
        "由正式 Deterministic Grounded Compiler 生成",
        "Demo Data / 虚构演示数据",
      ],
      isDefault: false,
      sections: {
        create: compiled.publicResult.sections.map((section) => ({
          type: section.type as never,
          title: section.title,
          contentMarkdown: section.contentMarkdown,
          order: section.order,
        })),
      },
    },
  });
  await prisma.tailoredResume.create({
    data: {
      id: ids.tailored,
      jdAnalysisId: ids.analysis,
      baseResumeId: ids.baseResume,
      tailoredResumeId: ids.tailoredResume,
      rewriteExplanation: compiled.publicResult.rewriteExplanation,
      changedSections: compiled.publicResult.changedSections,
    },
  });

  await prisma.careerStrategyPlan.create({
    data: {
      id: ids.strategy,
      profileId: ids.profile,
      title: "林知远 30 天实习求职策略（虚构演示）",
      summary: "优先准备 Web 与 AI 应用开发实习岗位，补充 API 集成和面试表达证据。",
      targetTimeframe: "one_month",
      overallReadinessScore: 78,
      recommendedPrimaryDirection: "Web / AI 应用开发实习生",
      recommendedCities: ["杭州", "上海"],
      strategyNotes: ["静态 Demo 结果，不冒充真实模型输出", "30 天内完成简历、项目讲述和面试准备"],
      recommendations: {
        create: [{
          id: ids.direction,
          profileId: ids.profile,
          directionName: "Web / AI 应用开发实习",
          roleFamily: "engineering",
          matchScore: 82,
          confidence: 80,
          priority: "high",
          suitableRoles: ["Web 开发实习生", "AI 应用开发实习生"],
          suitableIndustries: ["企业软件", "教育科技"],
          recommendedCities: ["杭州", "上海"],
          matchedEvidence: ["三个课程、个人与 Demo 项目"],
          gaps: ["大模型应用项目事实", "真实实习经历"],
          risks: ["不得将岗位加分项写成已有事实"],
          resumeFocus: ["突出 Web、数据库和项目工程能力"],
          searchKeywords: ["TypeScript 实习", "Next.js 实习", "Python Web 实习"],
        }],
      },
      skillGaps: {
        create: [{
          id: ids.gap,
          profileId: ids.profile,
          skillName: "API 集成与错误处理",
          category: "tool",
          currentLevel: "beginner",
          targetLevel: "intermediate",
          importance: 85,
          suggestedActions: ["完成一个公开 API 集成练习", "整理超时、重试与错误边界"],
          evidenceNeeded: ["代码仓库", "测试记录"],
        }],
      },
      jobSearchStrategies: {
        create: [{
          id: ids.search,
          profileId: ids.profile,
          targetRole: "Web / AI 应用开发实习生",
          targetCities: ["杭州", "上海"],
          targetIndustries: ["企业软件", "教育科技"],
          companyTypes: ["软件公司", "技术团队"],
          searchKeywords: ["TypeScript", "Next.js", "Python", "PostgreSQL"],
          negativeKeywords: ["付费培训", "自动投递"],
          weeklyApplicationTarget: 12,
          resumeVersionSuggestion: "使用岗位定制版本并保留事实引用边界",
          applicationAdvice: ["人工确认岗位与简历后再投递"],
          interviewPrepAdvice: ["准备项目目标、职责、权衡和测试说明"],
        }],
      },
      actionPlan: {
        create: [{
          id: ids.action,
          profileId: ids.profile,
          title: "完成 30 天项目与面试准备计划",
          description: "每周复盘项目证据、岗位匹配和面试问题。",
          category: "interview",
          priority: "high",
          estimatedHours: 12,
          dueInDays: 30,
          status: "in_progress",
        }],
      },
    },
  });

  await prisma.jobPost.create({
    data: {
      id: ids.job,
      title: "AI 应用开发实习生",
      normalizedTitle: "AI 应用开发实习生",
      company: "星桥科技（虚构）",
      companyNormalizedName: "星桥科技（虚构）",
      city: "杭州",
      salaryText: "Demo，不展示真实薪资",
      experienceRequirement: "在校生",
      educationRequirement: "本科",
      internshipDuration: "3 个月以上",
      conversionOpportunity: "unknown",
      candidateProfile: portfolioJDAnalysis.candidateProfile,
      jobType: "internship",
      workMode: "hybrid",
      description: "虚构 Demo 岗位，用于展示求职工作流。",
      requirements: "Python / TypeScript、Web、API、PostgreSQL、Git",
      benefits: ["虚构演示数据"],
      skills: portfolioJDAnalysis.hardSkills,
      keywords: portfolioJDAnalysis.keywords,
      industries: ["企业软件"],
      companyType: "startup",
      source: "manual",
      sourceUrl: "https://example.com/portfolio-demo-job",
      sourcePlatform: "portfolio-demo",
      collectedAt: new Date("2026-07-30T00:00:00.000Z"),
      contentHash: PORTFOLIO_DEMO_MARKER,
      qualityScore: 90,
      riskFlags: [],
      rawJson: json(markerMetadata),
    },
  });
  await prisma.jobMatch.create({
    data: {
      id: ids.match,
      profileId: ids.profile,
      resumeId: ids.tailoredResume,
      strategyPlanId: ids.strategy,
      directionRecommendationId: ids.direction,
      jobPostId: ids.job,
      matchScore: 78,
      hardRequirementScore: 82,
      skillMatchScore: 82,
      projectMatchScore: 80,
      experienceMatchScore: 45,
      educationMatchScore: 90,
      growthValueScore: 88,
      conversionOpportunityScore: 60,
      directionMatchScore: 85,
      preferenceMatchScore: 85,
      freshnessScore: 100,
      qualityScore: 90,
      riskPenalty: 0,
      recommendation: "yes",
      matchedPoints: portfolioJDAnalysis.matchedPoints,
      gaps: portfolioJDAnalysis.gaps,
      riskWarnings: portfolioJDAnalysis.riskWarnings,
      resumeSuggestions: portfolioJDAnalysis.resumeRewriteSuggestions,
      interviewPrepSuggestions: ["说明课程项目边界", "准备 API 错误处理问题"],
    },
  });
  await prisma.application.create({
    data: {
      id: ids.application,
      profileId: ids.profile,
      jobPostId: ids.job,
      jobMatchId: ids.match,
      resumeId: ids.tailoredResume,
      tailoredResumeId: ids.tailored,
      jdAnalysisId: ids.analysis,
      company: "星桥科技（虚构）",
      jobTitle: "AI 应用开发实习生",
      city: "杭州",
      source: "manual",
      channel: "company_website",
      status: "interviewing",
      priority: "high",
      appliedAt: new Date("2026-07-25T00:00:00.000Z"),
      notes: "Demo Data / 虚构演示数据；项目不会自动投递。",
    },
  });

  await prisma.evaluationRecord.create({
    data: {
      id: ids.evaluation,
      profileId: ids.profile,
      type: "resume_suggestion",
      entityId: ids.tailoredResume,
      expectedOutput: json(markerMetadata),
      actualOutput: json({
        ...markerMetadata,
        schemaStatus: "passed",
        factualityStatus: "passed",
      }),
      humanScore: 5,
      reviewerNotes: "确定性 Demo：Schema 与事实门禁均通过。",
      tags: [PORTFOLIO_DEMO_MARKER, "compiler"],
    },
  });

  const logs = [
    {
      id: ids.logJD,
      profileId: null,
      operation: "jd_analysis_result",
      durationMs: 860,
      promptTokens: 520,
      completionTokens: 180,
      totalTokens: 700,
      metadata: { ...markerMetadata, seededMetrics: true },
    },
    {
      id: ids.logStrategy,
      profileId: ids.profile,
      operation: "career_strategy_generation_result",
      durationMs: 1240,
      promptTokens: 610,
      completionTokens: 260,
      totalTokens: 870,
      metadata: { ...markerMetadata, seededMetrics: true },
    },
    {
      id: ids.logTailored,
      profileId: ids.profile,
      operation: "tailored_resume_result",
      durationMs: 980,
      promptTokens: 690,
      completionTokens: 230,
      totalTokens: 920,
      metadata: {
        ...markerMetadata,
        seededMetrics: true,
        planJsonStatus: "passed",
        planSchemaStatus: "passed",
        planValidationStatus: "passed",
        compilerStatus: "passed",
        schemaStatus: "passed",
        factualityStatus: "pass",
        selectedFactCount: compiled.compilerDiagnostics.selectedFactCount,
        renderedFactCount: compiled.compilerDiagnostics.renderedFactCount,
        omittedFactCount: compiled.compilerDiagnostics.omittedFactCount,
        sectionLineCounts: compiled.compilerDiagnostics.sectionLineCounts,
        maximumLineLength: compiled.compilerDiagnostics.maximumLineLength,
        maximumSourceFactIds: compiled.compilerDiagnostics.maximumSourceFactIds,
        factualityViolationCount: 0,
      },
    },
  ];
  for (const log of logs) {
    await prisma.lLMCallLog.create({
      data: {
        ...log,
        provider: "llm_provider",
        model: "deepseek-v4-flash",
        status: "success",
        fallbackUsed: false,
        metadata: json(log.metadata),
      },
    });
  }

  console.log(
    "Portfolio seed complete: 1 profile, 2 resumes, 1 job, 1 tailored resume, 1 application, 3 demo logs.",
  );
}

seed()
  .finally(async () => prisma.$disconnect());
