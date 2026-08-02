import type { Prisma, PrismaClient } from "@prisma/client";
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
import { projectStableKey } from "./project-facts/project-fact-atomizer";

export const careerProfileInclude = {
  basicInfo: true,
  educationItems: true,
  skillItems: true,
  projectItems: {
    include: {
      factAtoms: { orderBy: { displayOrder: "asc" as const } },
    },
  },
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

function mapProjectItem(input: ProjectItemInput) {
  const { id, ...value } = input;
  void id;
  return {
    ...value,
    challenges: value.challenges ?? [],
    solutions: value.solutions ?? [],
    engineeringPractices: value.engineeringPractices ?? [],
    projectType: emptyToNull(value.projectType),
    role: emptyToNull(value.role),
    background: emptyToNull(value.background),
    goal: emptyToNull(value.goal),
    fullDescription: emptyToNull(value.fullDescription),
    results: emptyToNull(value.results),
  };
}

function mapProjectCreates(items: ProjectItemInput[]) {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const normalizedName = item.name.trim().toLocaleLowerCase("zh-CN");
    const duplicateNumber = (occurrences.get(normalizedName) ?? 0) + 1;
    occurrences.set(normalizedName, duplicateNumber);
    return {
      ...(item.id ? { id: item.id } : {}),
      ...mapProjectItem(item),
      stableKey: projectStableKey(item.name, duplicateNumber),
    };
  });
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
    projectItems: { create: mapProjectCreates(input.projectItems) },
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
    include: {
      ...careerProfileInclude,
      photoAsset: {
        select: { id: true, updatedAt: true },
      },
    },
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

  await db.$transaction(async (transaction: Prisma.TransactionClient) => {
    const existingProjects = await transaction.projectItem.findMany({
      where: { profileId: id },
      select: { id: true, stableKey: true },
    });
    const existingIds = new Set(existingProjects.map((project) => project.id));
    const retainedIds = parsed.projectItems
      .map((project) => project.id)
      .filter((projectId): projectId is string =>
        Boolean(projectId && existingIds.has(projectId)));

    await Promise.all([
      transaction.educationItem.deleteMany({ where: { profileId: id } }),
      transaction.skillItem.deleteMany({ where: { profileId: id } }),
      transaction.projectItem.deleteMany({
        where: { profileId: id, id: { notIn: retainedIds } },
      }),
      transaction.experienceItem.deleteMany({ where: { profileId: id } }),
      transaction.certificateItem.deleteMany({ where: { profileId: id } }),
      transaction.awardItem.deleteMany({ where: { profileId: id } }),
      transaction.evidenceItem.deleteMany({ where: { profileId: id } }),
    ]);

    const mappedProjects = mapProjectCreates(parsed.projectItems);
    const newProjects = mappedProjects.filter(
      (project) => !project.id || !existingIds.has(project.id),
    );
    for (const project of parsed.projectItems) {
      if (project.id && existingIds.has(project.id)) {
        await transaction.projectItem.update({
          where: { id: project.id },
          data: mapProjectItem(project),
        });
      }
    }

    await transaction.careerProfile.update({
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
        projectItems: { create: newProjects },
        experienceItems: { create: parsed.experienceItems },
        certificateItems: { create: parsed.certificateItems },
        awardItems: { create: parsed.awardItems },
        evidenceItems: { create: parsed.evidenceItems },
      },
    });
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
  const duplicateCount = await db.projectItem.count({
    where: {
      profileId,
      name: { equals: input.name.trim(), mode: "insensitive" },
    },
  });
  const item = await db.projectItem.create({
    data: {
      ...mapProjectItem(projectItemSchema.parse(input)),
      profileId,
      stableKey: projectStableKey(input.name, duplicateCount + 1),
    },
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
    data: mapProjectItem(projectItemSchema.parse(input)),
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
