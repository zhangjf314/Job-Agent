import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  jdAnalysisResultSchema,
  jobDescriptionCreateInputSchema,
  type JobDescriptionCreateInput,
} from "@/schemas/jd";
import { createResume, resumeInclude } from "./resume-service";
import { careerProfileInclude } from "./career-profile-service";
import { createJDAnalyzerProvider, createTailoredResumeWriterProvider } from "./ai/provider-factory";
import { resolveResumeTemplateKey } from "./resume-templates/registry";
import { calculateJDMatch, generateResumeRewriteSuggestions } from "./jd-matching";

type DbClient = PrismaClient;

export const jdAnalysisInclude = {
  jobDescription: true,
  profile: {
    include: careerProfileInclude,
  },
  resume: true,
  tailoredResumes: {
    include: {
      tailoredResume: true,
      baseResume: true,
    },
  },
} as const;

function clean(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

function snapshot(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function createJobDescription(input: JobDescriptionCreateInput, db: DbClient = prisma) {
  const parsed = jobDescriptionCreateInputSchema.parse(input);
  return db.jobDescription.create({
    data: {
      profileId: parsed.profileId,
      resumeId: clean(parsed.resumeId),
      title: parsed.title,
      company: clean(parsed.company),
      city: clean(parsed.city),
      rawText: parsed.rawText,
      sourceUrl: clean(parsed.sourceUrl),
    },
  });
}

export async function analyzeJobDescription(jobDescriptionId: string, db: DbClient = prisma) {
  const jd = await db.jobDescription.findUniqueOrThrow({
    where: { id: jobDescriptionId },
  });
  const profile = await db.careerProfile.findUniqueOrThrow({
    where: { id: jd.profileId },
    include: careerProfileInclude,
  });
  const resume = jd.resumeId
    ? await db.resume.findUniqueOrThrow({ where: { id: jd.resumeId }, include: resumeInclude })
    : await db.resume.findFirst({
        where: { profileId: jd.profileId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        include: resumeInclude,
      });

  const extracted = await createJDAnalyzerProvider().analyze(jd.rawText);
  const matched = calculateJDMatch(profile, { contentMarkdown: resume?.contentMarkdown ?? "" }, extracted);
  const suggestions = generateResumeRewriteSuggestions(profile, { contentMarkdown: resume?.contentMarkdown ?? "" }, matched);
  const result = jdAnalysisResultSchema.parse({
    ...matched,
    resumeRewriteSuggestions: suggestions,
  });

  return db.jDAnalysis.create({
    data: {
      jobDescriptionId: jd.id,
      profileId: jd.profileId,
      resumeId: resume?.id ?? jd.resumeId,
      targetRole: result.targetRole || jd.title,
      seniorityLevel: result.seniorityLevel,
      coreResponsibilities: result.coreResponsibilities,
      internshipDuration: result.internshipDuration || null,
      conversionOpportunity: result.conversionOpportunity,
      candidateProfile: result.candidateProfile,
      hardSkills: result.hardSkills,
      softSkills: result.softSkills,
      experienceRequirements: result.experienceRequirements,
      educationRequirements: result.educationRequirements,
      bonusPoints: result.bonusPoints,
      keywords: result.keywords,
      matchScore: result.matchScore,
      hardSkillScore: result.scoreBreakdown.hardSkillScore,
      projectMatchScore: result.scoreBreakdown.projectMatchScore,
      experienceMatchScore: result.scoreBreakdown.experienceMatchScore,
      educationMatchScore: result.scoreBreakdown.educationMatchScore,
      keywordCoverageScore: result.scoreBreakdown.keywordCoverageScore,
      matchedPoints: result.matchedPoints,
      gaps: result.gaps,
      riskWarnings: result.riskWarnings,
      resumeRewriteSuggestions: result.resumeRewriteSuggestions,
    },
    include: jdAnalysisInclude,
  });
}

export async function getJDAnalysisById(id: string, db: DbClient = prisma) {
  return db.jDAnalysis.findUnique({
    where: { id },
    include: jdAnalysisInclude,
  });
}

export async function listJDAnalyses(db: DbClient = prisma) {
  return db.jDAnalysis.findMany({
    include: {
      jobDescription: true,
      resume: true,
      tailoredResumes: { include: { tailoredResume: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listTailoredResumesByBaseResume(baseResumeId: string, db: DbClient = prisma) {
  return db.tailoredResume.findMany({
    where: { baseResumeId },
    include: {
      jdAnalysis: { include: { jobDescription: true } },
      tailoredResume: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTailoredResumeByResumeId(resumeId: string, db: DbClient = prisma) {
  return db.tailoredResume.findFirst({
    where: { tailoredResumeId: resumeId },
    include: {
      jdAnalysis: {
        include: {
          jobDescription: true,
        },
      },
      baseResume: true,
      tailoredResume: true,
    },
  });
}

export async function generateTailoredResume(
  profileId: string,
  baseResumeId: string,
  jobDescriptionId: string,
  db: DbClient = prisma,
) {
  const profile = await db.careerProfile.findUniqueOrThrow({
    where: { id: profileId },
    include: careerProfileInclude,
  });
  const baseResume = await db.resume.findUniqueOrThrow({
    where: { id: baseResumeId },
    include: resumeInclude,
  });
  const jd = await db.jobDescription.findUniqueOrThrow({
    where: { id: jobDescriptionId },
  });

  const extracted = await createJDAnalyzerProvider().analyze(jd.rawText);
  const matched = calculateJDMatch(profile, { contentMarkdown: baseResume.contentMarkdown }, extracted);
  const suggestions = generateResumeRewriteSuggestions(profile, { contentMarkdown: baseResume.contentMarkdown }, matched);
  const analysisResult = jdAnalysisResultSchema.parse({ ...matched, resumeRewriteSuggestions: suggestions });
  const analysis = await db.jDAnalysis.create({
    data: {
      jobDescriptionId,
      profileId,
      resumeId: baseResumeId,
      targetRole: analysisResult.targetRole || jd.title,
      seniorityLevel: analysisResult.seniorityLevel,
      coreResponsibilities: analysisResult.coreResponsibilities,
      internshipDuration: analysisResult.internshipDuration || null,
      conversionOpportunity: analysisResult.conversionOpportunity,
      candidateProfile: analysisResult.candidateProfile,
      hardSkills: analysisResult.hardSkills,
      softSkills: analysisResult.softSkills,
      experienceRequirements: analysisResult.experienceRequirements,
      educationRequirements: analysisResult.educationRequirements,
      bonusPoints: analysisResult.bonusPoints,
      keywords: analysisResult.keywords,
      matchScore: analysisResult.matchScore,
      hardSkillScore: analysisResult.scoreBreakdown.hardSkillScore,
      projectMatchScore: analysisResult.scoreBreakdown.projectMatchScore,
      experienceMatchScore: analysisResult.scoreBreakdown.experienceMatchScore,
      educationMatchScore: analysisResult.scoreBreakdown.educationMatchScore,
      keywordCoverageScore: analysisResult.scoreBreakdown.keywordCoverageScore,
      matchedPoints: analysisResult.matchedPoints,
      gaps: analysisResult.gaps,
      riskWarnings: analysisResult.riskWarnings,
      resumeRewriteSuggestions: analysisResult.resumeRewriteSuggestions,
    },
  });
  const tailored = await createTailoredResumeWriterProvider().write({
    profile,
    baseResumeMarkdown: baseResume.contentMarkdown,
    jdAnalysis: analysisResult,
  });
  const date = new Date().toISOString().slice(0, 10);
  const resume = await createResume(
    {
      profileId,
      title: `${analysisResult.targetRole || jd.title} 定制版 - ${date}`,
      targetRole: analysisResult.targetRole || jd.title,
      targetCity: jd.city ?? baseResume.targetCity ?? "",
      language: "zh-CN",
      type: "jd_tailored",
      status: "draft",
      templateKey: resolveResumeTemplateKey(baseResume.templateKey),
      contentMarkdown: tailored.contentMarkdown,
      contentJson: { sections: tailored.sections, jdAnalysisId: analysis.id, applicationMaterials: tailored.applicationMaterials },
      sourceProfileSnapshot: snapshot(profile),
      sourceProfileVersion: profile.updatedAt?.toISOString?.() ?? "",
      completenessScore: profile.profileCompletenessScore,
      qualityScore: Math.max(0, Math.min(100, analysisResult.matchScore)),
      missingFields: tailored.missingFields,
      improvementQuestions: tailored.improvementQuestions,
      qualityWarnings: tailored.qualityWarnings,
      generationNotes: ["基于 JD 分析生成岗位定制版简历。", "未写入 Career Profile 中不存在的技能、经历或指标。"],
      changeLog: "从基础简历和 JD 分析生成岗位定制版本。",
      isDefault: false,
      sections: tailored.sections,
    },
    db,
  );
  const tailoredRecord = await db.tailoredResume.create({
    data: {
      jdAnalysisId: analysis.id,
      baseResumeId,
      tailoredResumeId: resume.id,
      rewriteExplanation: tailored.rewriteExplanation,
      changedSections: tailored.changedSections,
    },
    include: {
      jdAnalysis: { include: { jobDescription: true } },
      baseResume: true,
      tailoredResume: true,
    },
  });

  return {
    resume,
    jdAnalysis: await getJDAnalysisById(analysis.id, db),
    tailoredResume: tailoredRecord,
    matchScore: analysisResult.matchScore,
    gaps: analysisResult.gaps,
    rewriteExplanation: tailored.rewriteExplanation,
    applicationMaterials: tailored.applicationMaterials,
  };
}

export async function createAnalyzeAndTailorResume(
  input: JobDescriptionCreateInput & { baseResumeId: string },
  db: DbClient = prisma,
) {
  const jd = await createJobDescription({ ...input, resumeId: input.baseResumeId }, db);
  return generateTailoredResume(input.profileId, input.baseResumeId, jd.id, db);
}
