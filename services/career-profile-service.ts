import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  careerProfileSchema,
  educationItemSchema,
  experienceItemSchema,
  projectItemSchema,
  updateCareerProfileSchema,
  type CareerProfileInput,
  type EducationItemInput,
  type ExperienceItemInput,
  type ProjectItemInput,
} from "@/schemas/career-profile";
import type { CareerProfileWithItems } from "@/types/career-profile";
import { calculateProfileCompleteness } from "./profile-completeness";

export const careerProfileInclude = {
  basicInfo: true,
  educationItems: true,
  skillItems: true,
  projectItems: true,
  experienceItems: true,
  certificateItems: true,
  awardItems: true,
  evidenceItems: true,
} as const;

type DbClient = PrismaClient;

function emptyToNull(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function mapBasicInfo(input: NonNullable<CareerProfileInput["basicInfo"]>) {
  return {
    realName: input.realName,
    phone: input.phone,
    email: input.email,
    location: emptyToNull(input.location),
    githubUrl: emptyToNull(input.githubUrl),
    portfolioUrl: emptyToNull(input.portfolioUrl),
    linkedinUrl: emptyToNull(input.linkedinUrl),
    personalWebsite: emptyToNull(input.personalWebsite),
  };
}

function mapCareerProfileCreate(input: CareerProfileInput) {
  return {
    userId: input.userId,
    targetStatus: input.targetStatus,
    targetRoles: input.targetRoles,
    targetCities: input.targetCities,
    expectedSalaryMin: input.expectedSalaryMin ?? null,
    expectedSalaryMax: input.expectedSalaryMax ?? null,
    personalSummary: emptyToNull(input.personalSummary),
    basicInfo: input.basicInfo ? { create: mapBasicInfo(input.basicInfo) } : undefined,
    educationItems: { create: input.educationItems },
    skillItems: { create: input.skillItems },
    projectItems: { create: input.projectItems },
    experienceItems: { create: input.experienceItems },
    certificateItems: { create: input.certificateItems },
    awardItems: { create: input.awardItems },
    evidenceItems: { create: input.evidenceItems },
  };
}

async function refreshCompleteness(id: string, db: DbClient = prisma) {
  const profile = await db.careerProfile.findUniqueOrThrow({
    where: { id },
    include: careerProfileInclude,
  });
  const score = calculateProfileCompleteness(profile as CareerProfileWithItems);

  return db.careerProfile.update({
    where: { id },
    data: { profileCompletenessScore: score },
    include: careerProfileInclude,
  });
}

export async function createCareerProfile(input: CareerProfileInput, db: DbClient = prisma) {
  const parsed = careerProfileSchema.parse(input);
  const created = await db.careerProfile.create({
    data: mapCareerProfileCreate(parsed),
    include: careerProfileInclude,
  });

  return refreshCompleteness(created.id, db);
}

export async function getCareerProfiles(userId: string, db: DbClient = prisma) {
  return db.careerProfile.findMany({
    where: { userId },
    include: careerProfileInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCareerProfileById(id: string, db: DbClient = prisma) {
  return db.careerProfile.findUnique({
    where: { id },
    include: careerProfileInclude,
  });
}

export async function updateCareerProfile(
  input: Partial<CareerProfileInput> & { id: string },
  db: DbClient = prisma,
) {
  const parsed = updateCareerProfileSchema.parse(input);
  const { id, basicInfo, ...profileInput } = parsed;

  await db.careerProfile.update({
    where: { id },
    data: {
      targetStatus: profileInput.targetStatus,
      targetRoles: profileInput.targetRoles,
      targetCities: profileInput.targetCities,
      expectedSalaryMin: profileInput.expectedSalaryMin,
      expectedSalaryMax: profileInput.expectedSalaryMax,
      personalSummary: profileInput.personalSummary,
      basicInfo: basicInfo
        ? {
            upsert: {
              create: mapBasicInfo(basicInfo),
              update: mapBasicInfo(basicInfo),
            },
          }
        : undefined,
    },
  });

  return refreshCompleteness(id, db);
}

export async function deleteCareerProfile(id: string, db: DbClient = prisma) {
  return db.careerProfile.delete({ where: { id } });
}

export async function getOrCreateDemoUser(db: DbClient = prisma) {
  return db.user.upsert({
    where: { email: "demo.student@example.com" },
    update: { name: "演示应届生" },
    create: {
      name: "演示应届生",
      email: "demo.student@example.com",
    },
  });
}

export async function replaceCareerProfileSections(
  input: CareerProfileInput & { id: string },
  db: DbClient = prisma,
) {
  const parsed = careerProfileSchema.parse(input);
  const { id } = input;

  await db.$transaction([
    db.educationItem.deleteMany({ where: { profileId: id } }),
    db.skillItem.deleteMany({ where: { profileId: id } }),
    db.projectItem.deleteMany({ where: { profileId: id } }),
    db.experienceItem.deleteMany({ where: { profileId: id } }),
    db.certificateItem.deleteMany({ where: { profileId: id } }),
    db.awardItem.deleteMany({ where: { profileId: id } }),
    db.evidenceItem.deleteMany({ where: { profileId: id } }),
  ]);

  await db.careerProfile.update({
    where: { id },
    data: {
      targetStatus: parsed.targetStatus,
      targetRoles: parsed.targetRoles,
      targetCities: parsed.targetCities,
      expectedSalaryMin: parsed.expectedSalaryMin ?? null,
      expectedSalaryMax: parsed.expectedSalaryMax ?? null,
      personalSummary: emptyToNull(parsed.personalSummary),
      basicInfo: parsed.basicInfo
        ? {
            upsert: {
              create: mapBasicInfo(parsed.basicInfo),
              update: mapBasicInfo(parsed.basicInfo),
            },
          }
        : undefined,
      educationItems: { create: parsed.educationItems },
      skillItems: { create: parsed.skillItems },
      projectItems: { create: parsed.projectItems },
      experienceItems: { create: parsed.experienceItems },
      certificateItems: { create: parsed.certificateItems },
      awardItems: { create: parsed.awardItems },
      evidenceItems: { create: parsed.evidenceItems },
    },
  });

  return refreshCompleteness(id, db);
}

export async function addEducationItem(
  profileId: string,
  input: EducationItemInput,
  db: DbClient = prisma,
) {
  const item = await db.educationItem.create({
    data: { ...educationItemSchema.parse(input), profileId },
  });
  await refreshCompleteness(profileId, db);
  return item;
}

export async function updateEducationItem(
  id: string,
  input: EducationItemInput,
  db: DbClient = prisma,
) {
  const item = await db.educationItem.update({
    where: { id },
    data: educationItemSchema.parse(input),
  });
  await refreshCompleteness(item.profileId, db);
  return item;
}

export async function deleteEducationItem(id: string, db: DbClient = prisma) {
  const item = await db.educationItem.delete({ where: { id } });
  await refreshCompleteness(item.profileId, db);
  return item;
}

export async function addProjectItem(
  profileId: string,
  input: ProjectItemInput,
  db: DbClient = prisma,
) {
  const item = await db.projectItem.create({
    data: { ...projectItemSchema.parse(input), profileId },
  });
  await refreshCompleteness(profileId, db);
  return item;
}

export async function updateProjectItem(
  id: string,
  input: ProjectItemInput,
  db: DbClient = prisma,
) {
  const item = await db.projectItem.update({
    where: { id },
    data: projectItemSchema.parse(input),
  });
  await refreshCompleteness(item.profileId, db);
  return item;
}

export async function deleteProjectItem(id: string, db: DbClient = prisma) {
  const item = await db.projectItem.delete({ where: { id } });
  await refreshCompleteness(item.profileId, db);
  return item;
}

export async function addExperienceItem(
  profileId: string,
  input: ExperienceItemInput,
  db: DbClient = prisma,
) {
  const item = await db.experienceItem.create({
    data: { ...experienceItemSchema.parse(input), profileId },
  });
  await refreshCompleteness(profileId, db);
  return item;
}

export async function updateExperienceItem(
  id: string,
  input: ExperienceItemInput,
  db: DbClient = prisma,
) {
  const item = await db.experienceItem.update({
    where: { id },
    data: experienceItemSchema.parse(input),
  });
  await refreshCompleteness(item.profileId, db);
  return item;
}

export async function deleteExperienceItem(id: string, db: DbClient = prisma) {
  const item = await db.experienceItem.delete({ where: { id } });
  await refreshCompleteness(item.profileId, db);
  return item;
}

export { calculateProfileCompleteness };
