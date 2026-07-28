-- Extend internship-oriented JD and job data.
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'review';

ALTER TABLE "JDAnalysis"
  ADD COLUMN "internshipDuration" TEXT,
  ADD COLUMN "conversionOpportunity" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "candidateProfile" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "JobPost"
  ADD COLUMN "internshipDuration" TEXT,
  ADD COLUMN "conversionOpportunity" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "candidateProfile" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "JobMatch"
  ADD COLUMN "growthValueScore" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "conversionOpportunityScore" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "directionMatchScore" INTEGER NOT NULL DEFAULT 50;

CREATE TYPE "EvaluationType" AS ENUM ('jd_parsing', 'match_scoring', 'resume_suggestion');
CREATE TYPE "LLMCallStatus" AS ENUM ('success', 'failed', 'fallback');

CREATE TABLE "EvaluationRecord" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "type" "EvaluationType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "expectedOutput" JSONB,
  "actualOutput" JSONB,
  "humanScore" INTEGER,
  "reviewerNotes" TEXT,
  "tags" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvaluationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LLMCallLog" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "operation" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "LLMCallStatus" NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "estimatedCostMicros" INTEGER,
  "errorCode" TEXT,
  "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LLMCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvaluationRecord_profileId_idx" ON "EvaluationRecord"("profileId");
CREATE INDEX "EvaluationRecord_type_idx" ON "EvaluationRecord"("type");
CREATE INDEX "EvaluationRecord_entityId_idx" ON "EvaluationRecord"("entityId");
CREATE INDEX "LLMCallLog_profileId_idx" ON "LLMCallLog"("profileId");
CREATE INDEX "LLMCallLog_operation_idx" ON "LLMCallLog"("operation");
CREATE INDEX "LLMCallLog_createdAt_idx" ON "LLMCallLog"("createdAt");

ALTER TABLE "EvaluationRecord" ADD CONSTRAINT "EvaluationRecord_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LLMCallLog" ADD CONSTRAINT "LLMCallLog_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
