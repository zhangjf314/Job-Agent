/* eslint-disable no-console, @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const email = process.env.DEMO_USER_EMAIL || "demo@example.com";

async function main() {
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email,
      profiles: {
        create: {
          targetStatus: "seeking_fulltime",
          targetRoles: ["Java 后端开发", "软件开发工程师"],
          targetCities: ["杭州", "上海", "南京"],
          expectedSalaryMin: 12000,
          expectedSalaryMax: 25000,
          personalSummary: "计算机科学与技术应届生，关注 Java 后端、Spring Boot、MySQL 和 AI 应用开发。",
          profileCompletenessScore: 95,
          basicInfo: { create: { realName: "张同学", phone: "13800138000", email: "demo@example.com", location: "杭州", githubUrl: "https://github.com/demo-student", portfolioUrl: "https://example.com/portfolio", personalWebsite: "https://example.com" } },
          educationItems: { create: [{ school: "浙江示例大学", major: "计算机科学与技术", degree: "本科", startDate: new Date("2022-09-01"), endDate: new Date("2026-06-30"), gpa: "3.6/4.0", ranking: "前20%", courses: ["数据结构", "操作系统", "数据库系统"], honors: ["校级优秀学生"] }] },
          skillItems: { create: [
            { name: "Java", category: "programming_language", level: "advanced", evidence: "课程设计与项目后端服务", yearsOfExperience: 2 },
            { name: "Spring Boot", category: "framework", level: "intermediate", evidence: "校园二手交易平台", yearsOfExperience: 1 },
            { name: "MySQL", category: "database", level: "intermediate", evidence: "项目数据库设计", yearsOfExperience: 1 },
            { name: "Docker", category: "tool", level: "beginner", evidence: "本地部署实践", yearsOfExperience: 0.5 },
            { name: "Python", category: "programming_language", level: "intermediate", evidence: "数据处理脚本", yearsOfExperience: 1 },
          ] },
          projectItems: { create: [
            { name: "校园二手交易平台", role: "后端开发", startDate: new Date("2025-02-01"), endDate: new Date("2025-06-01"), background: "校内交易信息分散", goal: "提供商品发布、搜索、订单沟通能力", responsibilities: ["负责用户、商品、订单模块接口"], techStack: ["Java", "Spring Boot", "MySQL"], highlights: ["设计 REST API", "优化商品查询条件"], results: "完成核心后端模块并支持演示部署", metrics: ["支持 500+ 条商品测试数据"], links: ["https://github.com/demo-student/campus-market"] },
            { name: "AI 简历优化助手", role: "全栈开发", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-01"), background: "求职材料整理效率低", goal: "基于用户档案生成中文简历", responsibilities: ["实现档案建模与简历模板生成"], techStack: ["TypeScript", "Next.js", "Prisma"], highlights: ["构建规则生成器", "输出 Markdown 简历"], results: "完成 MVP 原型", metrics: [], links: ["https://example.com/resume-ai"] },
          ] },
          experienceItems: { create: [{ company: "杭州示例科技有限公司", department: "研发部", role: "Java 后端实习生", employmentType: "internship", startDate: new Date("2025-07-01"), endDate: new Date("2025-10-01"), responsibilities: ["参与内部管理系统接口开发", "编写单元测试"], achievements: ["完成 3 个业务接口联调"], techStack: ["Java", "Spring Boot", "MySQL"], businessImpact: "提升后台录入效率", metrics: ["减少重复录入步骤"] }] },
          certificateItems: { create: [{ name: "大学英语六级", issuer: "教育部考试中心", issuedAt: new Date("2024-06-01"), credentialUrl: "https://example.com/cet6" }] },
          awardItems: { create: [{ name: "蓝桥杯省赛三等奖", issuer: "蓝桥杯大赛组委会", level: "省级", awardedAt: new Date("2024-04-01"), description: "程序设计竞赛" }] },
          evidenceItems: { create: [{ type: "url", title: "GitHub 项目集", url: "https://github.com/demo-student", description: "项目代码与说明" }] },
        },
      },
    },
    include: { profiles: true },
  });
  const profile = user.profiles[0];
  const resume = await prisma.resume.create({
    data: {
      profileId: profile.id,
      title: "张同学 Java 后端通用简历",
      targetRole: "Java 后端开发",
      targetCity: "杭州",
      type: "general",
      status: "active",
      contentMarkdown: "# 张同学\n\n## 求职意向\nJava 后端开发 / 软件开发工程师\n\n## 项目经历\n校园二手交易平台：Java、Spring Boot、MySQL。\n\n## 实习经历\n杭州示例科技 Java 后端实习生。",
      completenessScore: 95,
      qualityScore: 82,
      missingFields: [],
      improvementQuestions: ["Redis 是否有真实项目证据？"],
      qualityWarnings: [],
      generationNotes: ["Seed 通用简历"],
      isDefault: true,
      sections: { create: [{ type: "summary", title: "个人简介", contentMarkdown: "计算机应届生，具备 Java 后端项目与实习经历。", order: 1 }] },
    },
  });
  const jd = await prisma.jobDescription.create({ data: { profileId: profile.id, resumeId: resume.id, title: "Java 后端开发", company: "杭州云启科技", city: "杭州", rawText: "本科 应届生 Java Spring Boot MySQL Redis，负责后端接口和数据库设计。", sourceUrl: "https://example.com/jd/java" } });
  const analysis = await prisma.jDAnalysis.create({ data: { jobDescriptionId: jd.id, profileId: profile.id, resumeId: resume.id, targetRole: "Java 后端开发", seniorityLevel: "new_grad", coreResponsibilities: ["后端接口开发", "数据库设计"], hardSkills: ["Java", "Spring Boot", "MySQL", "Redis"], softSkills: ["沟通协作"], experienceRequirements: ["应届生"], educationRequirements: ["本科"], bonusPoints: ["有项目经验"], keywords: ["Java", "Spring Boot", "MySQL", "Redis"], matchScore: 78, hardSkillScore: 75, projectMatchScore: 80, experienceMatchScore: 70, educationMatchScore: 90, keywordCoverageScore: 75, matchedPoints: ["Java/Spring Boot/MySQL 项目匹配"], gaps: ["Redis 项目证据不足"], riskWarnings: [], resumeRewriteSuggestions: ["突出校园二手交易平台后端职责"] } });
  const tailoredResume = await prisma.resume.create({ data: { profileId: profile.id, title: "Java 后端开发 定制版", targetRole: "Java 后端开发", targetCity: "杭州", type: "jd_tailored", status: "draft", contentMarkdown: `${resume.contentMarkdown}\n\n## JD 定制重点\n突出 Java、Spring Boot、MySQL，不写入未具备的 Redis 掌握声明。`, completenessScore: 95, qualityScore: 78, missingFields: ["Redis 项目证据不足"], improvementQuestions: ["是否可以补充 Redis 学习或项目证据？"], qualityWarnings: [], generationNotes: ["Seed JD 定制简历"], isDefault: false, sections: { create: [{ type: "projects", title: "项目经历", contentMarkdown: "优先展示校园二手交易平台。", order: 1 }] } } });
  await prisma.tailoredResume.create({ data: { jdAnalysisId: analysis.id, baseResumeId: resume.id, tailoredResumeId: tailoredResume.id, rewriteExplanation: ["调整技能与项目顺序"], changedSections: ["skills", "projects"] } });
  const strategy = await prisma.careerStrategyPlan.create({ data: { profileId: profile.id, title: "Java 后端求职策略", summary: "优先 Java 后端与软件开发工程师，AI 应用开发作为拓展方向。", targetTimeframe: "one_month", overallReadinessScore: 76, recommendedPrimaryDirection: "Java 后端开发", recommendedCities: ["杭州", "上海", "南京"], strategyNotes: ["补齐 Redis/MQ 证据"], recommendations: { create: [{ profileId: profile.id, directionName: "Java 后端开发", roleFamily: "engineering", matchScore: 82, confidence: 80, priority: "high", suitableRoles: ["Java 后端开发", "软件开发工程师"], suitableIndustries: ["互联网", "企业软件"], recommendedCities: ["杭州", "上海"], matchedEvidence: ["Java/Spring Boot/MySQL 项目"], gaps: ["Redis", "MQ"], risks: ["量化结果较少"], resumeFocus: ["突出后端接口和数据库设计"], searchKeywords: ["Java 后端", "Spring Boot", "应届生"] }] }, skillGaps: { create: [{ profileId: profile.id, skillName: "Redis", category: "hard_skill", currentLevel: "none", targetLevel: "beginner", importance: 85, suggestedActions: ["完成缓存设计学习"], evidenceNeeded: ["在项目中补充缓存设计说明"] }] }, jobSearchStrategies: { create: [{ profileId: profile.id, targetRole: "Java 后端开发", targetCities: ["杭州", "上海"], targetIndustries: ["互联网", "软件"], companyTypes: ["大厂", "中厂"], searchKeywords: ["Java 后端", "Spring Boot", "应届生", "杭州", "上海"], negativeKeywords: ["培训", "贷款"], weeklyApplicationTarget: 30, resumeVersionSuggestion: "使用 Java 后端定制版", applicationAdvice: ["优先投递匹配分高的岗位"], interviewPrepAdvice: ["准备 JVM、MySQL 索引、Spring Boot"] }] }, actionPlan: { create: [{ profileId: profile.id, title: "优化 Java 后端简历", description: "突出 Spring Boot + MySQL 项目", category: "resume", priority: "high", estimatedHours: 3, dueInDays: 3, status: "todo" }] } } });
  const jobTexts = [
    ["Java 后端开发", "杭州云启科技", "杭州", 86, []],
    ["软件开发工程师", "上海数智软件", "上海", 68, []],
    ["AI 应用开发工程师", "杭州智能应用实验室", "杭州", 62, []],
    ["数据分析实习生", "南京零售科技", "南京", 45, []],
    ["高薪转行 Java", "速成教育咨询", "上海", 20, ["收费培训", "培训贷", "先缴费", "包就业"]],
  ];
  const matches = [];
  for (let i = 0; i < jobTexts.length; i += 1) {
    const [title, company, city, score, risks] = jobTexts[i];
    const job = await prisma.jobPost.create({ data: { title, normalizedTitle: title, company, companyNormalizedName: company, city, salaryText: i === 4 ? "30k-50k" : "15k-25k", experienceRequirement: "应届生", educationRequirement: "本科", jobType: i === 3 ? "internship" : "fulltime", workMode: "onsite", description: `${title} 岗位描述，要求 Java Spring Boot MySQL。`, requirements: i === 4 ? "先缴费，培训贷，包就业。" : "本科，应届生，Java Spring Boot MySQL。", benefits: ["五险一金"], skills: ["Java", "Spring Boot", "MySQL"], keywords: ["Java", "后端"], industries: ["软件"], source: "manual", sourceUrl: `https://example.com/jobs/${i}`, sourcePlatform: "demo", collectedAt: new Date(), contentHash: `demo-job-${i}`, qualityScore: i === 4 ? 40 : 80, riskFlags: risks } });
    const match = await prisma.jobMatch.create({ data: { profileId: profile.id, resumeId: resume.id, strategyPlanId: strategy.id, jobPostId: job.id, matchScore: score, hardRequirementScore: score, skillMatchScore: score, projectMatchScore: score, experienceMatchScore: score, educationMatchScore: 90, preferenceMatchScore: 80, freshnessScore: 80, qualityScore: i === 4 ? 40 : 80, riskPenalty: i === 4 ? 30 : 0, recommendation: i === 0 ? "strong_yes" : i === 4 ? "no" : "yes", matchedPoints: i === 4 ? [] : ["技能与项目匹配"], gaps: i === 0 ? ["Redis 项目证据不足"] : [], riskWarnings: risks, resumeSuggestions: ["突出相关项目"], interviewPrepSuggestions: ["准备 Java 基础"] } });
    matches.push(match);
    if (i === 0 || i === 2) await prisma.savedJob.create({ data: { profileId: profile.id, jobPostId: job.id, notes: "Seed 收藏岗位" } });
  }
  const planned = await prisma.application.create({ data: { profileId: profile.id, jobPostId: matches[0].jobPostId, jobMatchId: matches[0].id, resumeId: resume.id, company: "杭州云启科技", jobTitle: "Java 后端开发", city: "杭州", source: "manual", channel: "online_platform", status: "planned", priority: "high", tasks: { create: [{ profileId: profile.id, title: "检查岗位 JD 与简历匹配", category: "resume_update", priority: "high" }] } } });
  await prisma.application.create({ data: { profileId: profile.id, jobPostId: matches[1].jobPostId, jobMatchId: matches[1].id, resumeId: resume.id, company: "上海数智软件", jobTitle: "软件开发工程师", city: "上海", source: "manual", channel: "online_platform", status: "applied", priority: "medium", appliedAt: new Date() } });
  const interviewing = await prisma.application.create({ data: { profileId: profile.id, jobPostId: matches[2].jobPostId, jobMatchId: matches[2].id, resumeId: tailoredResume.id, company: "杭州智能应用实验室", jobTitle: "AI 应用开发工程师", city: "杭州", source: "manual", channel: "online_platform", status: "interviewing", priority: "medium" } });
  const round = await prisma.interviewRound.create({ data: { applicationId: interviewing.id, roundName: "一面", roundType: "technical", status: "completed", completedAt: new Date() } });
  await prisma.interviewFeedback.create({ data: { interviewRoundId: round.id, applicationId: interviewing.id, profileId: profile.id, feedbackText: "问了 Redis、MySQL 索引和 JVM，Redis 没答好，项目难点表达不够清楚。", selfRating: 3, result: "pending", strengths: ["MySQL 索引回答较清楚"], weaknesses: ["Redis 没答好"], questionsAsked: ["Redis", "MySQL 索引", "JVM"], knowledgeGaps: ["Redis", "JVM"], improvementActions: ["补充 Redis 面试准备"], resumeImplications: ["补充项目难点"], strategyImplications: [] } });
  await prisma.offerRecord.create({ data: { applicationId: interviewing.id, profileId: profile.id, company: "杭州智能应用实验室", jobTitle: "AI 应用开发工程师", city: "杭州", salaryMin: 16000, salaryMax: 22000, salaryMonths: 14, salaryText: "16k-22k*14", benefits: ["五险一金"], status: "pending", pros: ["方向匹配"], cons: ["AI 项目证据需补充"] } });
  console.log(`Seeded demo user ${email}. Planned application: ${planned.id}`);
}

main().finally(async () => prisma.$disconnect());
