-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('intern', 'new_grad', 'junior', 'mid', 'senior', 'unknown');

-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "resumeId" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "city" TEXT,
    "rawText" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JDAnalysis" (
    "id" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "resumeId" TEXT,
    "targetRole" TEXT NOT NULL,
    "seniorityLevel" "SeniorityLevel" NOT NULL DEFAULT 'unknown',
    "coreResponsibilities" TEXT[],
    "hardSkills" TEXT[],
    "softSkills" TEXT[],
    "experienceRequirements" TEXT[],
    "educationRequirements" TEXT[],
    "bonusPoints" TEXT[],
    "keywords" TEXT[],
    "matchScore" INTEGER NOT NULL,
    "hardSkillScore" INTEGER NOT NULL,
    "projectMatchScore" INTEGER NOT NULL,
    "experienceMatchScore" INTEGER NOT NULL,
    "educationMatchScore" INTEGER NOT NULL,
    "keywordCoverageScore" INTEGER NOT NULL,
    "matchedPoints" TEXT[],
    "gaps" TEXT[],
    "riskWarnings" TEXT[],
    "resumeRewriteSuggestions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JDAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TailoredResume" (
    "id" TEXT NOT NULL,
    "jdAnalysisId" TEXT NOT NULL,
    "baseResumeId" TEXT NOT NULL,
    "tailoredResumeId" TEXT NOT NULL,
    "rewriteExplanation" TEXT[],
    "changedSections" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TailoredResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobDescription_profileId_idx" ON "JobDescription"("profileId");

-- CreateIndex
CREATE INDEX "JobDescription_resumeId_idx" ON "JobDescription"("resumeId");

-- CreateIndex
CREATE INDEX "JDAnalysis_jobDescriptionId_idx" ON "JDAnalysis"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "JDAnalysis_profileId_idx" ON "JDAnalysis"("profileId");

-- CreateIndex
CREATE INDEX "JDAnalysis_resumeId_idx" ON "JDAnalysis"("resumeId");

-- CreateIndex
CREATE INDEX "TailoredResume_jdAnalysisId_idx" ON "TailoredResume"("jdAnalysisId");

-- CreateIndex
CREATE INDEX "TailoredResume_baseResumeId_idx" ON "TailoredResume"("baseResumeId");

-- CreateIndex
CREATE INDEX "TailoredResume_tailoredResumeId_idx" ON "TailoredResume"("tailoredResumeId");

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JDAnalysis" ADD CONSTRAINT "JDAnalysis_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JDAnalysis" ADD CONSTRAINT "JDAnalysis_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JDAnalysis" ADD CONSTRAINT "JDAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_jdAnalysisId_fkey" FOREIGN KEY ("jdAnalysisId") REFERENCES "JDAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_baseResumeId_fkey" FOREIGN KEY ("baseResumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_tailoredResumeId_fkey" FOREIGN KEY ("tailoredResumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
