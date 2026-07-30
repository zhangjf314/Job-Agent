import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resumeCreateInputSchema,
  resumeUpdateInputSchema,
  type ResumeCreateInput,
  type ResumeUpdateInput,
} from "@/schemas/resume";
import { careerProfileInclude } from "./career-profile-service";
import { generateResumeFromProfile } from "./resume-generator";
import { calculateResumeQualityScore } from "./resume-quality";
import { resolveResumeTemplateKey } from "./resume-templates/registry";
import type { ResumeTemplateKey } from "@/types/resume";

type DbClient = PrismaClient;

export const resumeInclude = {
  sections: {
    orderBy: { order: "asc" as const },
  },
  profile: {
    include: {
      ...careerProfileInclude,
      photoAsset: {
        select: { id: true, updatedAt: true },
      },
    },
  },
} as const;

function toDbLanguage(language?: string): "zh_CN" {
  return language === "zh-CN" ? "zh_CN" : "zh_CN";
}

function fromDbLanguage(language: string) {
  return language === "zh_CN" ? "zh-CN" : language;
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function snapshot(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function mapCreate(input: ResumeCreateInput) {
  return {
    profileId: input.profileId,
    title: input.title,
    targetRole: cleanText(input.targetRole),
    targetCity: cleanText(input.targetCity),
    language: toDbLanguage(input.language),
    type: input.type,
    status: input.status,
    templateKey: input.templateKey,
    contentMarkdown: input.contentMarkdown,
    contentJson: input.contentJson === undefined ? undefined : snapshot(input.contentJson),
    sourceProfileSnapshot:
      input.sourceProfileSnapshot === undefined ? undefined : snapshot(input.sourceProfileSnapshot),
    sourceProfileVersion: cleanText(input.sourceProfileVersion),
    completenessScore: input.completenessScore ?? null,
    qualityScore: input.qualityScore ?? null,
    missingFields: input.missingFields,
    improvementQuestions: input.improvementQuestions,
    qualityWarnings: input.qualityWarnings,
    generationNotes: input.generationNotes,
    changeLog: cleanText(input.changeLog),
    isDefault: input.isDefault,
    showPhoto: input.showPhoto ?? true,
    sections: {
      create: input.sections.map((section) => ({
        type: section.type,
        title: section.title,
        contentMarkdown: section.contentMarkdown,
        order: section.order,
      })),
    },
  };
}

export async function createResume(input: ResumeCreateInput, db: DbClient = prisma) {
  const parsed = resumeCreateInputSchema.parse(input);
  if (parsed.isDefault) {
    await db.resume.updateMany({
      where: { profileId: parsed.profileId },
      data: { isDefault: false },
    });
  }

  return db.resume.create({
    data: mapCreate(parsed),
    include: resumeInclude,
  });
}

export async function getResumeById(id: string, db: DbClient = prisma) {
  return db.resume.findUnique({
    where: { id },
    include: resumeInclude,
  });
}

export async function listResumesByProfileId(profileId: string, db: DbClient = prisma) {
  return db.resume.findMany({
    where: { profileId },
    include: { sections: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listResumes(db: DbClient = prisma) {
  return db.resume.findMany({
    include: {
      sections: { orderBy: { order: "asc" } },
      profile: { include: { basicInfo: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateResume(input: ResumeUpdateInput, db: DbClient = prisma) {
  const parsed = resumeUpdateInputSchema.parse(input);
  const { id, sections, language, contentJson, sourceProfileSnapshot, ...data } = parsed;

  if (data.isDefault) {
    const current = await db.resume.findUniqueOrThrow({ where: { id } });
    await db.resume.updateMany({
      where: { profileId: current.profileId, NOT: { id } },
      data: { isDefault: false },
    });
  }

  if (sections) {
    await db.resumeSection.deleteMany({ where: { resumeId: id } });
  }

  return db.resume.update({
    where: { id },
    data: {
      ...data,
      language: language ? toDbLanguage(language) : undefined,
      contentJson: contentJson === undefined ? undefined : snapshot(contentJson),
      sourceProfileSnapshot:
        sourceProfileSnapshot === undefined ? undefined : snapshot(sourceProfileSnapshot),
      sections: sections
        ? {
            create: sections.map((section) => ({
              type: section.type,
              title: section.title,
              contentMarkdown: section.contentMarkdown,
              order: section.order,
            })),
          }
        : undefined,
    },
    include: resumeInclude,
  });
}

export async function updateResumeContent(
  id: string,
  contentMarkdown: string,
  db: DbClient = prisma,
) {
  const resume = await db.resume.findUniqueOrThrow({
    where: { id },
    include: resumeInclude,
  });
  const qualityScore = calculateResumeQualityScore({
    contentMarkdown,
    sections: resume.sections.map((section) => ({
      type: section.type,
      title: section.title,
      contentMarkdown: section.contentMarkdown,
      order: section.order,
    })),
  });

  return db.resume.update({
    where: { id },
    data: {
      contentMarkdown,
      qualityScore,
      changeLog: `手动更新于 ${new Date().toISOString()}`,
    },
    include: resumeInclude,
  });
}

export async function deleteResume(id: string, db: DbClient = prisma) {
  return db.resume.delete({ where: { id } });
}

export async function duplicateResume(id: string, db: DbClient = prisma) {
  const resume = await db.resume.findUniqueOrThrow({
    where: { id },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  return createResume(
    {
      profileId: resume.profileId,
      title: `${resume.title} 副本`,
      targetRole: resume.targetRole ?? "",
      targetCity: resume.targetCity ?? "",
      language: fromDbLanguage(String(resume.language)) as "zh-CN",
      type: resume.type,
      status: "draft",
      templateKey: resolveResumeTemplateKey(resume.templateKey),
      contentMarkdown: resume.contentMarkdown,
      contentJson: resume.contentJson ?? undefined,
      sourceProfileSnapshot: resume.sourceProfileSnapshot ?? undefined,
      sourceProfileVersion: resume.sourceProfileVersion ?? "",
      completenessScore: resume.completenessScore,
      qualityScore: resume.qualityScore,
      missingFields: resume.missingFields,
      improvementQuestions: resume.improvementQuestions,
      qualityWarnings: resume.qualityWarnings,
      generationNotes: [...resume.generationNotes, "由已有简历复制生成新版本。"],
      changeLog: resume.changeLog ?? "",
      isDefault: false,
      showPhoto: resume.showPhoto,
      sections: resume.sections.map((section) => ({
        type: section.type,
        title: section.title,
        contentMarkdown: section.contentMarkdown,
        order: section.order,
      })),
    },
    db,
  );
}

export async function setDefaultResume(id: string, db: DbClient = prisma) {
  const resume = await db.resume.findUniqueOrThrow({ where: { id } });
  await db.resume.updateMany({
    where: { profileId: resume.profileId },
    data: { isDefault: false },
  });
  return db.resume.update({
    where: { id },
    data: { isDefault: true, status: "active" },
    include: resumeInclude,
  });
}

export async function archiveResume(id: string, db: DbClient = prisma) {
  return db.resume.update({
    where: { id },
    data: { status: "archived", isDefault: false },
    include: resumeInclude,
  });
}

export async function updateResumeTemplate(
  id: string,
  templateKey: ResumeTemplateKey,
  db: DbClient = prisma,
) {
  return db.resume.update({
    where: { id },
    data: { templateKey },
    include: resumeInclude,
  });
}

export async function updateResumePhotoVisibility(
  id: string,
  showPhoto: boolean,
  db: DbClient = prisma,
) {
  return db.resume.update({
    where: { id },
    data: { showPhoto },
    include: resumeInclude,
  });
}

export async function generateGeneralResumeFromProfile(
  profileId: string,
  templateKeyOrDb: ResumeTemplateKey | DbClient = "minimal",
  suppliedDb: DbClient = prisma,
) {
  const templateKey = typeof templateKeyOrDb === "string" ? templateKeyOrDb : "minimal";
  const db = typeof templateKeyOrDb === "string" ? suppliedDb : templateKeyOrDb;
  const profile = await db.careerProfile.findUniqueOrThrow({
    where: { id: profileId },
    include: careerProfileInclude,
  });
  const generated = generateResumeFromProfile(profile);
  const existingCount = await db.resume.count({ where: { profileId } });

  return createResume(
    {
      profileId,
      title: generated.title,
      targetRole: generated.targetRole,
      targetCity: generated.targetCity,
      language: generated.language,
      type: "general",
      status: "draft",
      templateKey,
      contentMarkdown: generated.contentMarkdown,
      contentJson: { sections: generated.sections },
      sourceProfileSnapshot: snapshot(profile),
      sourceProfileVersion: profile.updatedAt?.toISOString?.() ?? "",
      completenessScore: profile.profileCompletenessScore,
      qualityScore: generated.qualityScore,
      missingFields: generated.missingFields,
      improvementQuestions: generated.improvementQuestions,
      qualityWarnings: generated.qualityWarnings,
      generationNotes: generated.generationNotes,
      changeLog: "从 Career Profile 生成通用简历。",
      isDefault: existingCount === 0,
      sections: generated.sections,
    },
    db,
  );
}
