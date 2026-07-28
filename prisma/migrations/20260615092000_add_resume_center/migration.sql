-- CreateEnum
CREATE TYPE "ResumeType" AS ENUM ('general', 'role_specific', 'jd_tailored');

-- CreateEnum
CREATE TYPE "ResumeStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ResumeSectionType" AS ENUM ('basic_info', 'summary', 'education', 'skills', 'projects', 'experiences', 'certificates', 'awards', 'others');

-- CreateEnum
CREATE TYPE "ResumeLanguage" AS ENUM ('zh_CN');

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetRole" TEXT,
    "targetCity" TEXT,
    "language" "ResumeLanguage" NOT NULL DEFAULT 'zh_CN',
    "type" "ResumeType" NOT NULL DEFAULT 'general',
    "status" "ResumeStatus" NOT NULL DEFAULT 'draft',
    "contentMarkdown" TEXT NOT NULL,
    "contentJson" JSONB,
    "sourceProfileSnapshot" JSONB,
    "sourceProfileVersion" TEXT,
    "completenessScore" INTEGER,
    "qualityScore" INTEGER,
    "missingFields" TEXT[],
    "improvementQuestions" TEXT[],
    "qualityWarnings" TEXT[],
    "generationNotes" TEXT[],
    "changeLog" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeSection" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "type" "ResumeSectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resume_profileId_idx" ON "Resume"("profileId");

-- CreateIndex
CREATE INDEX "Resume_profileId_isDefault_idx" ON "Resume"("profileId", "isDefault");

-- CreateIndex
CREATE INDEX "ResumeSection_resumeId_idx" ON "ResumeSection"("resumeId");

-- CreateIndex
CREATE INDEX "ResumeSection_resumeId_order_idx" ON "ResumeSection"("resumeId", "order");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeSection" ADD CONSTRAINT "ResumeSection_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
