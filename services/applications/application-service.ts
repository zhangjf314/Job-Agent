import type { ApplicationStatus, InterviewRoundStatus, OfferStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applicationCreateInputSchema,
  applicationPipelineSummarySchema,
  applicationTaskSchema,
  applicationUpdateInputSchema,
  interviewFeedbackCreateInputSchema,
  interviewRoundCreateInputSchema,
  offerRecordSchema,
  type ApplicationCreateInput,
  type ApplicationTaskInput,
  type InterviewFeedbackCreateInput,
  type InterviewRoundCreateInput,
  type OfferRecordInput,
} from "@/schemas/application";
import type { ApplicationTaskStatus } from "@/types/application";
import { MockApplicationCoachProvider } from "@/services/ai/application-coach";

type DbClient = PrismaClient;

const terminalStatuses: ApplicationStatus[] = ["rejected", "withdrawn", "archived"];

export const applicationInclude = {
  jobPost: true,
  interviewRounds: { include: { feedback: true }, orderBy: { createdAt: "desc" as const } },
  feedback: { orderBy: { createdAt: "desc" as const } },
  tasks: { orderBy: { createdAt: "desc" as const } },
  offers: { orderBy: { createdAt: "desc" as const } },
} as const;

function clean(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

function dateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function mapApplicationCreate(input: ApplicationCreateInput) {
  return {
    profileId: input.profileId,
    jobPostId: clean(input.jobPostId),
    jobMatchId: clean(input.jobMatchId),
    resumeId: clean(input.resumeId),
    tailoredResumeId: clean(input.tailoredResumeId),
    jdAnalysisId: clean(input.jdAnalysisId),
    company: input.company,
    jobTitle: input.jobTitle,
    city: clean(input.city),
    source: input.source ?? null,
    sourceUrl: clean(input.sourceUrl),
    channel: input.channel,
    status: input.status,
    priority: input.priority,
    appliedAt: input.appliedAt ?? null,
    lastContactAt: input.lastContactAt ?? null,
    nextFollowUpAt: input.nextFollowUpAt ?? null,
    salaryExpectation: clean(input.salaryExpectation),
    notes: clean(input.notes),
  };
}

async function createInitialTasks(applicationId: string, profileId: string, db: DbClient) {
  const tasks: ApplicationTaskInput[] = [
    {
      title: "检查岗位 JD 与投递简历匹配度",
      description: "确认简历中只呈现真实具备的技能、项目和经历。",
      category: "resume_update",
      priority: "high",
      status: "todo",
    },
    {
      title: "准备投递版本",
      description: "确认文件名、联系方式、目标岗位和项目顺序。",
      category: "document",
      priority: "medium",
      status: "todo",
    },
    {
      title: "投递后 3-5 天跟进",
      description: "若无反馈，可通过原渠道礼貌询问进展。",
      category: "follow_up",
      priority: "medium",
      status: "todo",
      dueAt: dateAfterDays(5),
    },
  ];
  for (const task of tasks) {
    await createApplicationTask(applicationId, profileId, task, db);
  }
}

export async function createApplicationFromJobMatch(profileId: string, jobMatchId: string, resumeId?: string, db: DbClient = prisma) {
  const jobMatch = await db.jobMatch.findUniqueOrThrow({ where: { id: jobMatchId }, include: { jobPost: true } });
  const existing = await db.application.findFirst({
    where: {
      profileId,
      jobPostId: jobMatch.jobPostId,
      NOT: { status: { in: terminalStatuses } },
    },
    include: applicationInclude,
  });
  if (existing) return existing;

  const application = await db.application.create({
    data: mapApplicationCreate(applicationCreateInputSchema.parse({
      profileId,
      jobPostId: jobMatch.jobPostId,
      jobMatchId,
      resumeId: resumeId || jobMatch.resumeId || undefined,
      company: jobMatch.jobPost.company,
      jobTitle: jobMatch.jobPost.normalizedTitle || jobMatch.jobPost.title,
      city: jobMatch.jobPost.city,
      source: "manual",
      sourceUrl: jobMatch.jobPost.sourceUrl ?? "",
      channel: "online_platform",
      status: "planned",
      priority: jobMatch.matchScore >= 75 ? "high" : jobMatch.matchScore >= 55 ? "medium" : "low",
      notes: `由岗位匹配创建，匹配分 ${jobMatch.matchScore}/100。`,
    })),
    include: applicationInclude,
  });
  await createInitialTasks(application.id, profileId, db);
  return getApplicationById(application.id, db);
}

export async function createApplicationFromSavedJob(profileId: string, savedJobId: string, resumeId?: string, db: DbClient = prisma) {
  const saved = await db.savedJob.findUniqueOrThrow({ where: { id: savedJobId }, include: { jobPost: true } });
  const existing = await db.application.findFirst({
    where: {
      profileId,
      jobPostId: saved.jobPostId,
      NOT: { status: { in: terminalStatuses } },
    },
    include: applicationInclude,
  });
  if (existing) return existing;
  return createManualApplication(profileId, {
    profileId,
    jobPostId: saved.jobPostId,
    resumeId,
    company: saved.jobPost.company,
    jobTitle: saved.jobPost.normalizedTitle || saved.jobPost.title,
    city: saved.jobPost.city,
    source: "manual",
    sourceUrl: saved.jobPost.sourceUrl ?? "",
    channel: "online_platform",
    priority: "medium",
    notes: saved.notes ?? "",
  }, db);
}

export async function createManualApplication(profileId: string, input: Partial<ApplicationCreateInput>, db: DbClient = prisma) {
  const parsed = applicationCreateInputSchema.parse({ ...input, profileId });
  const existing = parsed.jobPostId
    ? await db.application.findFirst({
        where: { profileId, jobPostId: parsed.jobPostId, NOT: { status: { in: terminalStatuses } } },
        include: applicationInclude,
      })
    : null;
  if (existing) return existing;
  const application = await db.application.create({
    data: mapApplicationCreate(parsed),
    include: applicationInclude,
  });
  await createInitialTasks(application.id, profileId, db);
  return getApplicationById(application.id, db);
}

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus, db: DbClient = prisma) {
  const current = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  return db.application.update({
    where: { id: applicationId },
    data: {
      status,
      appliedAt: status === "applied" && !current.appliedAt ? new Date() : current.appliedAt,
      lastContactAt: ["applied", "resume_screen", "written_test", "interviewing", "offer", "rejected"].includes(status)
        ? new Date()
        : current.lastContactAt,
    },
    include: applicationInclude,
  });
}

export async function updateApplication(input: { id: string } & Partial<ApplicationCreateInput>, db: DbClient = prisma) {
  const parsed = applicationUpdateInputSchema.parse(input);
  const { id, ...data } = parsed;
  return db.application.update({
    where: { id },
    data: {
      ...data,
      jobPostId: clean(data.jobPostId),
      jobMatchId: clean(data.jobMatchId),
      resumeId: clean(data.resumeId),
      tailoredResumeId: clean(data.tailoredResumeId),
      jdAnalysisId: clean(data.jdAnalysisId),
      city: clean(data.city),
      sourceUrl: clean(data.sourceUrl),
      salaryExpectation: clean(data.salaryExpectation),
      notes: clean(data.notes),
    },
    include: applicationInclude,
  });
}

export async function listApplicationsByProfileId(
  profileId: string,
  filters: { status?: ApplicationStatus; priority?: "high" | "medium" | "low"; company?: string } = {},
  db: DbClient = prisma,
) {
  return db.application.findMany({
    where: {
      profileId,
      status: filters.status,
      priority: filters.priority,
      company: filters.company ? { contains: filters.company, mode: "insensitive" } : undefined,
    },
    include: applicationInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function listApplicationsByResumeId(resumeId: string, db: DbClient = prisma) {
  return db.application.findMany({
    where: { OR: [{ resumeId }, { tailoredResumeId: resumeId }] },
    include: applicationInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getApplicationById(applicationId: string, db: DbClient = prisma) {
  const application = await db.application.findUnique({ where: { id: applicationId }, include: applicationInclude });
  if (!application) return null;
  const [jobMatch, resume, jdAnalysis] = await Promise.all([
    application.jobMatchId ? db.jobMatch.findUnique({ where: { id: application.jobMatchId }, include: { jobPost: true } }) : null,
    application.resumeId ? db.resume.findUnique({ where: { id: application.resumeId } }) : null,
    application.jdAnalysisId ? db.jDAnalysis.findUnique({ where: { id: application.jdAnalysisId } }) : null,
  ]);
  return { ...application, jobMatch, resume, jdAnalysis };
}

export async function createInterviewRound(applicationId: string, input: InterviewRoundCreateInput, db: DbClient = prisma) {
  const parsed = interviewRoundCreateInputSchema.parse(input);
  return db.interviewRound.create({
    data: {
      applicationId,
      roundName: parsed.roundName,
      roundType: parsed.roundType,
      status: parsed.status,
      scheduledAt: parsed.scheduledAt ?? null,
      completedAt: parsed.completedAt ?? null,
      interviewer: clean(parsed.interviewer),
      location: clean(parsed.location),
      meetingLink: clean(parsed.meetingLink),
      notes: clean(parsed.notes),
    },
  });
}

export async function updateInterviewRoundStatus(roundId: string, status: InterviewRoundStatus, db: DbClient = prisma) {
  return db.interviewRound.update({
    where: { id: roundId },
    data: { status, completedAt: ["completed", "passed", "failed"].includes(status) ? new Date() : undefined },
  });
}

export async function addInterviewFeedback(roundId: string, input: InterviewFeedbackCreateInput, db: DbClient = prisma) {
  const parsed = interviewFeedbackCreateInputSchema.parse(input);
  const round = await db.interviewRound.findUniqueOrThrow({ where: { id: roundId }, include: { application: true } });
  const coach = new MockApplicationCoachProvider();
  const analysis = await coach.analyzeInterviewFeedback(parsed.feedbackText);
  const feedback = await db.interviewFeedback.create({
    data: {
      interviewRoundId: roundId,
      applicationId: round.applicationId,
      profileId: round.application.profileId,
      feedbackText: parsed.feedbackText,
      selfRating: parsed.selfRating ?? null,
      result: parsed.result,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      questionsAsked: analysis.questionsAsked,
      knowledgeGaps: analysis.knowledgeGaps,
      improvementActions: analysis.improvementActions,
      resumeImplications: analysis.resumeImplications,
      strategyImplications: analysis.strategyImplications,
    },
  });
  for (const action of analysis.improvementActions.slice(0, 5)) {
    await createApplicationTask(round.applicationId, round.application.profileId, {
      title: action,
      category: action.includes("简历") || action.includes("项目") ? "resume_update" : "interview_prep",
      priority: "high",
      status: "todo",
      dueAt: dateAfterDays(7),
    }, db);
  }
  return feedback;
}

export async function createApplicationTask(applicationId: string, profileId: string, input: ApplicationTaskInput, db: DbClient = prisma) {
  const parsed = applicationTaskSchema.parse(input);
  return db.applicationTask.create({
    data: {
      applicationId,
      profileId,
      title: parsed.title,
      description: clean(parsed.description),
      category: parsed.category,
      priority: parsed.priority,
      status: parsed.status,
      dueAt: parsed.dueAt ?? null,
    },
  });
}

export async function updateApplicationTaskStatus(taskId: string, status: ApplicationTaskStatus, db: DbClient = prisma) {
  return db.applicationTask.update({ where: { id: taskId }, data: { status } });
}

export async function createOfferRecord(applicationId: string, input: OfferRecordInput, db: DbClient = prisma) {
  const application = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  const parsed = offerRecordSchema.parse({
    ...input,
    company: input.company || application.company,
    jobTitle: input.jobTitle || application.jobTitle,
    city: input.city || application.city,
  });
  return db.offerRecord.create({
    data: {
      applicationId,
      profileId: application.profileId,
      company: parsed.company,
      jobTitle: parsed.jobTitle,
      city: clean(parsed.city),
      salaryMin: parsed.salaryMin ?? null,
      salaryMax: parsed.salaryMax ?? null,
      salaryMonths: parsed.salaryMonths ?? null,
      salaryText: clean(parsed.salaryText),
      benefits: parsed.benefits,
      probationInfo: clean(parsed.probationInfo),
      deadline: parsed.deadline ?? null,
      status: parsed.status,
      pros: parsed.pros,
      cons: parsed.cons,
      notes: clean(parsed.notes),
    },
  });
}

export async function updateOfferStatus(offerId: string, status: OfferStatus, db: DbClient = prisma) {
  return db.offerRecord.update({ where: { id: offerId }, data: { status } });
}

export async function generateApplicationInsight(applicationId: string, db: DbClient = prisma) {
  const application = await getApplicationById(applicationId, db);
  if (!application) throw new Error("Application not found");
  const coach = new MockApplicationCoachProvider();
  return coach.generateApplicationInsight(application);
}

export async function compareOffers(profileId: string, db: DbClient = prisma) {
  const offers = await db.offerRecord.findMany({
    where: { profileId, status: { in: ["pending", "accepted", "negotiating"] } },
    orderBy: { updatedAt: "desc" },
  });
  const coach = new MockApplicationCoachProvider();
  return coach.compareOffers(profileId, offers);
}

export async function getApplicationPipelineSummary(profileId: string, db: DbClient = prisma) {
  const applications = await db.application.findMany({ where: { profileId }, select: { status: true } });
  const summary = {
    planned: 0,
    applied: 0,
    resume_screen: 0,
    written_test: 0,
    interviewing: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
    no_response: 0,
    review: 0,
    archived: 0,
  };
  for (const application of applications) summary[application.status] += 1;
  return applicationPipelineSummarySchema.parse(summary);
}
