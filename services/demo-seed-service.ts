import type { PrismaClient } from "@prisma/client";
import { createMockGraduateProfile } from "@/services/mock-profile";
import { createCareerProfile } from "@/services/career-profile-service";
import { generateGeneralResumeFromProfile } from "@/services/resume-service";
import { createAnalyzeAndTailorResume, createJobDescription, analyzeJobDescription } from "@/services/jd-service";
import { generateCareerStrategyPlan } from "@/services/strategy-service";
import { createManualJobPost, saveJob } from "@/services/jobs/job-service";
import { createApplicationFromJobMatch, createInterviewRound, addInterviewFeedback, createOfferRecord, updateApplicationStatus } from "@/services/applications/application-service";

type DbClient = PrismaClient;

export const demoUserEmail = "demo@example.com";

export function buildDemoJobTexts() {
  return [
    "岗位：Java 后端开发\n公司：杭州云启科技\n城市：杭州\n薪资：15k-25k\n要求：本科 应届生 Java Spring Boot MySQL Redis，熟悉 REST API。",
    "岗位：软件开发工程师\n公司：上海数智软件\n城市：上海\n薪资：14k-22k\n要求：本科 Java MySQL，参与企业系统开发。",
    "岗位：AI 应用开发工程师\n公司：杭州智能应用实验室\n城市：杭州\n薪资：16k-28k\n要求：Python RAG Agent Docker，了解后端服务。",
    "岗位：数据分析实习生\n公司：南京零售科技\n城市：南京\n薪资：200-300/天\n要求：SQL Excel Python 数据分析。",
    "岗位：高薪转行 Java\n公司：速成教育咨询\n城市：上海\n薪资：30k-50k\n要求：先缴费，培训贷，包就业。",
  ];
}

export async function seedDemoData(db: DbClient) {
  await db.user.deleteMany({ where: { email: demoUserEmail } });
  const user = await db.user.create({ data: { name: "Demo User", email: demoUserEmail } });
  const profileInput = createMockGraduateProfile(user.id);
  const profile = await createCareerProfile({ ...profileInput, userId: user.id }, db);
  const resume = await generateGeneralResumeFromProfile(profile.id, db);

  const jdText = "Java 后端开发工程师，本科，应届生，要求 Java、Spring Boot、MySQL、Redis，负责后端接口、数据库设计和性能优化。";
  const jd = await createJobDescription({ profileId: profile.id, resumeId: resume.id, title: "Java 后端开发", company: "杭州云启科技", city: "杭州", rawText: jdText, sourceUrl: "https://example.com/jd/java" }, db);
  const jdAnalysis = await analyzeJobDescription(jd.id, db);
  const tailored = await createAnalyzeAndTailorResume({ profileId: profile.id, baseResumeId: resume.id, title: "Java 后端开发", company: "杭州云启科技", city: "杭州", rawText: jdText, sourceUrl: "https://example.com/jd/java" }, db);
  const strategy = await generateCareerStrategyPlan(profile.id, db);

  const jobs = [];
  const matches = [];
  for (const text of buildDemoJobTexts()) {
    const { job, match } = await createManualJobPost(profile.id, text, "https://example.com/jobs/demo", db);
    jobs.push(job);
    matches.push(match);
  }
  await saveJob(profile.id, jobs[0].id, "高匹配岗位，优先投递", db);
  await saveJob(profile.id, jobs[2].id, "AI 应用方向备选", db);

  const planned = await createApplicationFromJobMatch(profile.id, matches[0].id, resume.id, db);
  const applied = await createApplicationFromJobMatch(profile.id, matches[1].id, resume.id, db);
  await updateApplicationStatus(applied!.id, "applied", db);
  const interviewing = await createApplicationFromJobMatch(profile.id, matches[2].id, tailored.resume.id, db);
  await updateApplicationStatus(interviewing!.id, "interviewing", db);
  const round = await createInterviewRound(interviewing!.id, { roundName: "一面", roundType: "technical", status: "completed" }, db);
  await addInterviewFeedback(round.id, { feedbackText: "面试官问了 Redis、MySQL 索引、JVM 和项目难点。MySQL 答得不错，Redis 没答好，项目难点表达不够清楚。", selfRating: 3, result: "pending" }, db);
  await createOfferRecord(interviewing!.id, { company: "杭州智能应用实验室", jobTitle: "AI 应用开发工程师", city: "杭州", salaryMin: 16000, salaryMax: 22000, salaryMonths: 14, salaryText: "16k-22k*14", benefits: ["五险一金", "导师制"], pros: ["方向匹配", "成长性较好"], cons: ["AI 项目经验还需补充"], status: "pending" }, db);

  return { user, profile, resume, jd, jdAnalysis, tailoredResume: tailored.resume, strategy, jobs, matches, applications: [planned, applied, interviewing] };
}
