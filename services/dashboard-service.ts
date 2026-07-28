import type { ApplicationStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient;

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;

const applicationStatuses: ApplicationStatus[] = [
  "planned",
  "applied",
  "resume_screen",
  "written_test",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "no_response",
  "review",
  "archived",
];

export async function getDashboardSummary(userId: string, db: DbClient = prisma) {
  const profiles = await db.careerProfile.findMany({ where: { userId }, select: { id: true } });
  const profileIds = profiles.map((profile) => profile.id);
  const [resumeCount, jdAnalysisCount, strategyPlanCount, jobMatchCount, applicationRows, applicationTasks, strategyActions] = await Promise.all([
    db.resume.count({ where: { profileId: { in: profileIds } } }),
    db.jDAnalysis.count({ where: { profileId: { in: profileIds } } }),
    db.careerStrategyPlan.count({ where: { profileId: { in: profileIds } } }),
    db.jobMatch.count({ where: { profileId: { in: profileIds } } }),
    db.application.findMany({ where: { profileId: { in: profileIds } }, select: { status: true } }),
    db.applicationTask.findMany({ where: { profileId: { in: profileIds }, status: { in: ["todo", "in_progress"] } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.actionPlanItem.findMany({ where: { profileId: { in: profileIds }, status: { in: ["todo", "in_progress"] } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const funnel = Object.fromEntries(applicationStatuses.map((status) => [status, 0])) as Record<ApplicationStatus, number>;
  for (const row of applicationRows) funnel[row.status] += 1;
  const applicationCount = applicationRows.length;
  const nextSteps = [
    profiles.length === 0 ? { label: "创建职业档案", href: "/profile/new" } : null,
    profiles.length > 0 && resumeCount === 0 ? { label: "生成通用简历", href: "/resume/new" } : null,
    resumeCount > 0 && jdAnalysisCount === 0 ? { label: "粘贴岗位描述并分析", href: "/resume/tailor" } : null,
    strategyPlanCount > 0 && jobMatchCount === 0 ? { label: "搜索岗位", href: "/jobs/search" } : null,
    jobMatchCount > 0 && applicationCount === 0 ? { label: "加入投递流程", href: "/jobs/matches" } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return {
    profileCount: profiles.length,
    resumeCount,
    jdAnalysisCount,
    strategyPlanCount,
    jobMatchCount,
    applicationCount,
    funnel,
    applicationTasks,
    strategyActions,
    nextSteps,
  };
}
