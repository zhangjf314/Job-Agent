import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient;

export async function getUserDataStats(userId: string, db: DbClient = prisma) {
  const profiles = await db.careerProfile.findMany({ where: { userId }, select: { id: true } });
  const profileIds = profiles.map((profile) => profile.id);
  const [resumes, savedJobs, applications, interviewFeedback] = await Promise.all([
    db.resume.count({ where: { profileId: { in: profileIds } } }),
    db.savedJob.count({ where: { profileId: { in: profileIds } } }),
    db.application.count({ where: { profileId: { in: profileIds } } }),
    db.interviewFeedback.count({ where: { profileId: { in: profileIds } } }),
  ]);
  return { profiles: profiles.length, resumes, savedJobs, applications, interviewFeedback };
}

export async function exportUserData(userId: string, db: DbClient = prisma) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profiles: {
        include: {
          basicInfo: true,
          educationItems: true,
          skillItems: true,
          projectItems: true,
          experienceItems: true,
          certificateItems: true,
          awardItems: true,
          evidenceItems: true,
          resumes: { include: { sections: true } },
          jobDescriptions: true,
          jdAnalyses: true,
          strategyPlans: { include: { recommendations: true, skillGaps: true, jobSearchStrategies: true, actionPlan: true } },
          jobMatches: { include: { jobPost: true } },
          savedJobs: { include: { jobPost: true } },
          applications: { include: { interviewRounds: true, feedback: true, tasks: true, offers: true, jobPost: true } },
        },
      },
    },
  });
  return { exportedAt: new Date().toISOString(), user };
}

export async function deleteUserData(userId: string, db: DbClient = prisma) {
  return db.user.delete({ where: { id: userId } });
}
