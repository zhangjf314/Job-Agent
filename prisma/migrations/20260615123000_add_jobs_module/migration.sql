CREATE TYPE "JobType" AS ENUM ('fulltime', 'internship', 'parttime', 'campus', 'contract', 'unknown');
CREATE TYPE "WorkMode" AS ENUM ('onsite', 'hybrid', 'remote', 'unknown');
CREATE TYPE "JobSource" AS ENUM ('mock', 'manual', 'web_search', 'company_career_page', 'official_employment_platform', 'other');
CREATE TYPE "JobSearchRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE "JobRecommendation" AS ENUM ('strong_yes', 'yes', 'maybe', 'no');
CREATE TYPE "SavedJobStatus" AS ENUM ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'ignored');
CREATE TYPE "CompanyType" AS ENUM ('internet', 'software_outsourcing', 'state_owned', 'foreign_company', 'manufacturing_digital', 'startup', 'unknown');

CREATE TABLE "JobPost" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "companyNormalizedName" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT,
  "province" TEXT,
  "salaryMin" INTEGER,
  "salaryMax" INTEGER,
  "salaryMonths" INTEGER,
  "salaryText" TEXT,
  "experienceRequirement" TEXT,
  "educationRequirement" TEXT,
  "jobType" "JobType" NOT NULL DEFAULT 'unknown',
  "workMode" "WorkMode" NOT NULL DEFAULT 'unknown',
  "description" TEXT NOT NULL,
  "requirements" TEXT NOT NULL,
  "benefits" TEXT[],
  "skills" TEXT[],
  "keywords" TEXT[],
  "industries" TEXT[],
  "companyType" "CompanyType" NOT NULL DEFAULT 'unknown',
  "headcount" INTEGER,
  "source" "JobSource" NOT NULL,
  "sourceUrl" TEXT,
  "sourcePlatform" TEXT,
  "publishedAt" TIMESTAMP(3),
  "collectedAt" TIMESTAMP(3) NOT NULL,
  "contentHash" TEXT NOT NULL,
  "qualityScore" INTEGER NOT NULL,
  "riskFlags" TEXT[],
  "rawText" TEXT,
  "rawJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobSearchRun" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "strategyPlanId" TEXT,
  "directionRecommendationId" TEXT,
  "query" TEXT NOT NULL,
  "city" TEXT,
  "filters" JSONB,
  "source" "JobSource" NOT NULL,
  "status" "JobSearchRunStatus" NOT NULL DEFAULT 'pending',
  "totalFound" INTEGER NOT NULL DEFAULT 0,
  "totalSaved" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobSearchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobMatch" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "resumeId" TEXT,
  "strategyPlanId" TEXT,
  "directionRecommendationId" TEXT,
  "jobPostId" TEXT NOT NULL,
  "matchScore" INTEGER NOT NULL,
  "hardRequirementScore" INTEGER NOT NULL,
  "skillMatchScore" INTEGER NOT NULL,
  "projectMatchScore" INTEGER NOT NULL,
  "experienceMatchScore" INTEGER NOT NULL,
  "educationMatchScore" INTEGER NOT NULL,
  "preferenceMatchScore" INTEGER NOT NULL,
  "freshnessScore" INTEGER NOT NULL,
  "qualityScore" INTEGER NOT NULL,
  "riskPenalty" INTEGER NOT NULL,
  "recommendation" "JobRecommendation" NOT NULL,
  "matchedPoints" TEXT[],
  "gaps" TEXT[],
  "riskWarnings" TEXT[],
  "resumeSuggestions" TEXT[],
  "interviewPrepSuggestions" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedJob" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "jobPostId" TEXT NOT NULL,
  "status" "SavedJobStatus" NOT NULL DEFAULT 'saved',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobPost_city_idx" ON "JobPost"("city");
CREATE INDEX "JobPost_normalizedTitle_idx" ON "JobPost"("normalizedTitle");
CREATE INDEX "JobPost_contentHash_idx" ON "JobPost"("contentHash");
CREATE INDEX "JobPost_sourceUrl_idx" ON "JobPost"("sourceUrl");
CREATE INDEX "JobSearchRun_profileId_idx" ON "JobSearchRun"("profileId");
CREATE INDEX "JobSearchRun_strategyPlanId_idx" ON "JobSearchRun"("strategyPlanId");
CREATE INDEX "JobSearchRun_directionRecommendationId_idx" ON "JobSearchRun"("directionRecommendationId");
CREATE INDEX "JobMatch_profileId_idx" ON "JobMatch"("profileId");
CREATE INDEX "JobMatch_jobPostId_idx" ON "JobMatch"("jobPostId");
CREATE INDEX "JobMatch_matchScore_idx" ON "JobMatch"("matchScore");
CREATE UNIQUE INDEX "SavedJob_profileId_jobPostId_key" ON "SavedJob"("profileId", "jobPostId");
CREATE INDEX "SavedJob_profileId_idx" ON "SavedJob"("profileId");
CREATE INDEX "SavedJob_jobPostId_idx" ON "SavedJob"("jobPostId");

ALTER TABLE "JobSearchRun" ADD CONSTRAINT "JobSearchRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
