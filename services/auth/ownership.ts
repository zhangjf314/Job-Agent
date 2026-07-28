import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

type DbClient = PrismaClient;

export async function assertProfileOwnership(userId: string, profileId: string, db: DbClient = prisma) {
  const profile = await db.careerProfile.findUnique({ where: { id: profileId }, select: { id: true, userId: true } });
  if (!profile) throw new NotFoundError();
  if (profile.userId !== userId) throw new ForbiddenError();
  return profile;
}

export async function assertResumeOwnership(userId: string, resumeId: string, db: DbClient = prisma) {
  const resume = await db.resume.findUnique({ where: { id: resumeId }, select: { id: true, profile: { select: { userId: true } } } });
  if (!resume) throw new NotFoundError();
  if (resume.profile.userId !== userId) throw new ForbiddenError();
  return resume;
}

export async function assertApplicationOwnership(userId: string, applicationId: string, db: DbClient = prisma) {
  const application = await db.application.findUnique({ where: { id: applicationId }, select: { id: true, profile: { select: { userId: true } } } });
  if (!application) throw new NotFoundError();
  if (application.profile.userId !== userId) throw new ForbiddenError();
  return application;
}
