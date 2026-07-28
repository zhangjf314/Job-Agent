import type { ActionStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { careerProfileInclude } from "./career-profile-service";
import { buildCareerStrategyResult } from "./strategy-engine";
import { createCareerStrategistProvider } from "./ai/provider-factory";

type DbClient = PrismaClient;

export const strategyPlanInclude = {
  recommendations: true,
  skillGaps: true,
  jobSearchStrategies: true,
  actionPlan: true,
  profile: {
    include: { basicInfo: true },
  },
} satisfies Prisma.CareerStrategyPlanInclude;

export async function createCareerStrategyPlan(
  profileId: string,
  result: ReturnType<typeof buildCareerStrategyResult>,
  db: DbClient = prisma,
) {
  return db.careerStrategyPlan.create({
    data: {
      profileId,
      title: result.title,
      summary: result.summary,
      targetTimeframe: result.targetTimeframe,
      overallReadinessScore: result.overallReadinessScore,
      recommendedPrimaryDirection: result.recommendedPrimaryDirection,
      recommendedCities: result.recommendedCities,
      strategyNotes: [...result.strategyNotes, ...result.warnings, ...result.assumptions],
      recommendations: {
        create: result.recommendations.map((item) => ({
          profileId,
          directionName: item.directionName,
          roleFamily: item.roleFamily,
          matchScore: item.matchScore,
          confidence: item.confidence,
          priority: item.priority,
          suitableRoles: item.suitableRoles,
          suitableIndustries: item.suitableIndustries,
          recommendedCities: item.recommendedCities,
          matchedEvidence: item.matchedEvidence,
          gaps: item.gaps,
          risks: item.risks,
          resumeFocus: item.resumeFocus,
          searchKeywords: item.searchKeywords,
        })),
      },
      skillGaps: {
        create: result.skillGaps.map((item) => ({
          profileId,
          skillName: item.skillName,
          category: item.category,
          currentLevel: item.currentLevel,
          targetLevel: item.targetLevel,
          importance: item.importance,
          suggestedActions: item.suggestedActions,
          evidenceNeeded: item.evidenceNeeded,
        })),
      },
      jobSearchStrategies: {
        create: result.jobSearchStrategies.map((item) => ({
          profileId,
          targetRole: item.targetRole,
          targetCities: item.targetCities,
          targetIndustries: item.targetIndustries,
          companyTypes: item.companyTypes,
          searchKeywords: item.searchKeywords,
          negativeKeywords: item.negativeKeywords,
          weeklyApplicationTarget: item.weeklyApplicationTarget,
          resumeVersionSuggestion: item.resumeVersionSuggestion,
          applicationAdvice: item.applicationAdvice,
          interviewPrepAdvice: item.interviewPrepAdvice,
        })),
      },
      actionPlan: {
        create: result.actionPlan.map((item) => ({
          profileId,
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          estimatedHours: item.estimatedHours,
          dueInDays: item.dueInDays,
          status: item.status,
        })),
      },
    },
    include: strategyPlanInclude,
  });
}

export async function generateCareerStrategyPlan(profileId: string, db: DbClient = prisma) {
  const profile = await db.careerProfile.findUniqueOrThrow({
    where: { id: profileId },
    include: careerProfileInclude,
  });
  const resumes = await db.resume.findMany({
    where: { profileId },
    select: { qualityScore: true },
  });
  const jdAnalyses = await db.jDAnalysis.findMany({
    where: { profileId },
    select: { targetRole: true, matchScore: true },
  });
  const result = await createCareerStrategistProvider().generate({ profile, resumes, jdAnalyses });
  return createCareerStrategyPlan(profileId, result, db);
}

export async function getCareerStrategyPlanById(id: string, db: DbClient = prisma) {
  return db.careerStrategyPlan.findUnique({
    where: { id },
    include: strategyPlanInclude,
  });
}

export async function listCareerStrategyPlansByProfileId(profileId: string, db: DbClient = prisma) {
  return db.careerStrategyPlan.findMany({
    where: { profileId },
    include: strategyPlanInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function listCareerStrategyPlans(db: DbClient = prisma) {
  return db.careerStrategyPlan.findMany({
    include: strategyPlanInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getLatestCareerStrategyPlanByProfileId(profileId: string, db: DbClient = prisma) {
  return db.careerStrategyPlan.findFirst({
    where: { profileId },
    include: strategyPlanInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteCareerStrategyPlan(id: string, db: DbClient = prisma) {
  return db.careerStrategyPlan.delete({ where: { id } });
}

export async function updateActionPlanItemStatus(
  id: string,
  status: ActionStatus,
  db: DbClient = prisma,
) {
  return db.actionPlanItem.update({
    where: { id },
    data: { status },
  });
}
