/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { analyzeInterviewFeedback } from "@/services/applications/interview-feedback-analyzer";
import { compareOfferRecords } from "@/services/applications/offer-comparator";
import {
  addInterviewFeedback,
  createApplicationFromJobMatch,
  createApplicationTask,
  createInterviewRound,
  createOfferRecord,
  generateApplicationInsight,
  updateApplicationStatus,
  updateApplicationTaskStatus,
  updateOfferStatus,
} from "@/services/applications/application-service";

function createDb() {
  const jobPost = {
    id: "job_1",
    company: "Example Tech",
    title: "Java 后端开发",
    normalizedTitle: "Java 后端开发",
    city: "杭州",
    sourceUrl: "https://example.com/jobs/1",
  };
  const jobMatch = {
    id: "match_1",
    profileId: "profile_1",
    jobPostId: "job_1",
    resumeId: "resume_1",
    matchScore: 72,
    gaps: ["Redis 证据不足"],
    riskWarnings: [],
    resumeSuggestions: ["突出 Spring Boot + MySQL 项目"],
    interviewPrepSuggestions: ["准备 Java 集合、JVM、MySQL 索引"],
    jobPost,
  };
  const applications: any[] = [];
  const tasks: any[] = [];
  const rounds: any[] = [];
  const feedback: any[] = [];
  const offers: any[] = [];
  const db = {
    jobMatch: {
      findUniqueOrThrow: async () => jobMatch,
      findUnique: async () => jobMatch,
    },
    resume: { findUnique: async () => ({ id: "resume_1", qualityScore: 80 }) },
    jDAnalysis: { findUnique: async () => null },
    application: {
      findFirst: async ({ where }: any) => applications.find((item) => item.profileId === where.profileId && item.jobPostId === where.jobPostId && !["rejected", "withdrawn", "archived"].includes(item.status)) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `app_${applications.length + 1}`, createdAt: new Date(), updatedAt: new Date(), interviewRounds: [], feedback: [], tasks: [], offers: [], jobPost, ...data };
        applications.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const app = applications.find((item) => item.id === where.id);
        return app ? { ...app, tasks, interviewRounds: rounds.map((round) => ({ ...round, feedback: feedback.filter((item) => item.interviewRoundId === round.id) })), feedback, offers } : null;
      },
      findUniqueOrThrow: async ({ where }: any) => applications.find((item) => item.id === where.id),
      update: async ({ where, data }: any) => {
        const index = applications.findIndex((item) => item.id === where.id);
        applications[index] = { ...applications[index], ...data };
        return { ...applications[index], tasks, interviewRounds: rounds, feedback, offers };
      },
    },
    applicationTask: {
      create: async ({ data }: any) => {
        const row = { id: `task_${tasks.length + 1}`, ...data };
        tasks.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const index = tasks.findIndex((item) => item.id === where.id);
        tasks[index] = { ...tasks[index], ...data };
        return tasks[index];
      },
    },
    interviewRound: {
      create: async ({ data }: any) => {
        const row = { id: `round_${rounds.length + 1}`, createdAt: new Date(), updatedAt: new Date(), feedback: [], ...data };
        rounds.push(row);
        return row;
      },
      findUniqueOrThrow: async ({ where }: any) => ({ ...rounds.find((item) => item.id === where.id), application: applications[0] }),
      update: async ({ where, data }: any) => {
        const index = rounds.findIndex((item) => item.id === where.id);
        rounds[index] = { ...rounds[index], ...data };
        return rounds[index];
      },
    },
    interviewFeedback: {
      create: async ({ data }: any) => {
        const row = { id: `feedback_${feedback.length + 1}`, ...data };
        feedback.push(row);
        return row;
      },
    },
    offerRecord: {
      create: async ({ data }: any) => {
        const row = { id: `offer_${offers.length + 1}`, benefits: [], pros: [], cons: [], ...data };
        offers.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const index = offers.findIndex((item) => item.id === where.id);
        offers[index] = { ...offers[index], ...data };
        return offers[index];
      },
      findMany: async () => offers,
    },
  } as any;
  return { db, applications, tasks, rounds, feedback, offers };
}

describe("application service", () => {
  it("creates planned application from JobMatch and prevents duplicates", async () => {
    const { db, applications, tasks } = createDb();
    const first = await createApplicationFromJobMatch("profile_1", "match_1", undefined, db);
    const second = await createApplicationFromJobMatch("profile_1", "match_1", undefined, db);
    expect(first?.status).toBe("planned");
    expect(second?.id).toBe(first?.id);
    expect(applications).toHaveLength(1);
    expect(tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("sets appliedAt when application becomes applied", async () => {
    const { db } = createDb();
    const app = await createApplicationFromJobMatch("profile_1", "match_1", undefined, db);
    const updated = await updateApplicationStatus(app!.id, "applied", db);
    expect(updated.appliedAt).toBeInstanceOf(Date);
  });

  it("creates interview round and analyzes Chinese feedback", async () => {
    const { db } = createDb();
    const app = await createApplicationFromJobMatch("profile_1", "match_1", undefined, db);
    const round = await createInterviewRound(app!.id, { roundName: "一面", roundType: "technical", status: "completed" }, db);
    const saved = await addInterviewFeedback(round.id, {
      feedbackText: "面试官问了 Redis 缓存一致性、MySQL 索引和 JVM。Redis 没答好，项目难点表达不够清楚。",
      selfRating: 3,
      result: "pending",
    }, db);
    expect(saved.questionsAsked.join("\n")).toContain("Redis");
    expect(saved.weaknesses.join("\n")).toContain("Redis");
    expect(saved.knowledgeGaps).toEqual(expect.arrayContaining(["Redis", "MySQL", "JVM"]));
    expect(saved.improvementActions.length).toBeGreaterThan(0);
  });

  it("generates insight from JobMatch gaps and feedback", async () => {
    const { db } = createDb();
    const app = await createApplicationFromJobMatch("profile_1", "match_1", undefined, db);
    const round = await createInterviewRound(app!.id, { roundName: "一面", roundType: "technical", status: "completed" }, db);
    await addInterviewFeedback(round.id, { feedbackText: "问了 JVM，JVM 没答好。", result: "pending" }, db);
    const insight = await generateApplicationInsight(app!.id, db);
    expect(insight.nextBestActions.join("\n")).toContain("JVM");
    expect(insight.interviewPrepSuggestions.join("\n")).toContain("JVM");
  });

  it("creates and updates tasks", async () => {
    const { db } = createDb();
    const task = await createApplicationTask("app_1", "profile_1", { title: "准备 JVM", category: "interview_prep", priority: "high", status: "todo" }, db);
    const updated = await updateApplicationTaskStatus(task.id, "done", db);
    expect(updated.status).toBe("done");
  });

  it("creates and updates offer records and compares offers", async () => {
    const { db, offers } = createDb();
    await createApplicationFromJobMatch("profile_1", "match_1", undefined, db);
    const offer = await createOfferRecord("app_1", {
      company: "Example Tech",
      jobTitle: "Java 后端开发",
      salaryMin: 18000,
      salaryMax: 22000,
      salaryMonths: 14,
      salaryText: "18k-22k*14",
      benefits: ["五险一金"],
      pros: ["技术栈匹配"],
      cons: [],
      status: "pending",
    }, db);
    const updated = await updateOfferStatus(offer.id, "negotiating", db);
    const comparison = compareOfferRecords(offers);
    expect(updated.status).toBe("negotiating");
    expect(comparison.recommendedOfferId).toBe(offer.id);
    expect(comparison.reasons.length).toBeGreaterThan(0);
  });

  it("extracts feedback directly", () => {
    const analysis = analyzeInterviewFeedback("HR 问了城市意向和薪资期望，自我介绍表达清楚，但稳定性解释不够。");
    expect(analysis.questionsAsked.join("\n")).toContain("城市");
    expect(analysis.strategyImplications.join("\n")).toContain("城市");
  });
});
