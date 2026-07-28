CREATE TYPE "ApplicationSource" AS ENUM ('boss','liepin','company_site','school_career_center','referral','email','manual','other');
CREATE TYPE "ApplicationChannel" AS ENUM ('online_platform','company_website','referral','email','campus_event','wechat','other');
CREATE TYPE "ApplicationStatus" AS ENUM ('planned','applied','resume_screen','written_test','interviewing','offer','rejected','withdrawn','no_response','archived');
CREATE TYPE "InterviewRoundType" AS ENUM ('phone','video','onsite','written_test','technical','hr','manager','group','other');
CREATE TYPE "InterviewRoundStatus" AS ENUM ('scheduled','completed','cancelled','no_show','passed','failed','unknown');
CREATE TYPE "InterviewResult" AS ENUM ('passed','failed','pending','unknown');
CREATE TYPE "ApplicationTaskCategory" AS ENUM ('follow_up','resume_update','interview_prep','written_test_prep','networking','document','other');
CREATE TYPE "OfferStatus" AS ENUM ('pending','accepted','declined','expired','negotiating');

CREATE TABLE "Application" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "jobPostId" TEXT, "jobMatchId" TEXT, "resumeId" TEXT, "tailoredResumeId" TEXT, "jdAnalysisId" TEXT,
  "company" TEXT NOT NULL, "jobTitle" TEXT NOT NULL, "city" TEXT, "source" "ApplicationSource", "sourceUrl" TEXT,
  "channel" "ApplicationChannel" NOT NULL DEFAULT 'other', "status" "ApplicationStatus" NOT NULL DEFAULT 'planned',
  "priority" "StrategyPriority" NOT NULL DEFAULT 'medium', "appliedAt" TIMESTAMP(3), "lastContactAt" TIMESTAMP(3), "nextFollowUpAt" TIMESTAMP(3),
  "salaryExpectation" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InterviewRound" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "roundName" TEXT NOT NULL, "roundType" "InterviewRoundType" NOT NULL DEFAULT 'other',
  "status" "InterviewRoundStatus" NOT NULL DEFAULT 'unknown', "scheduledAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "interviewer" TEXT, "location" TEXT, "meetingLink" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InterviewFeedback" (
  "id" TEXT NOT NULL, "interviewRoundId" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "profileId" TEXT NOT NULL,
  "feedbackText" TEXT NOT NULL, "selfRating" INTEGER, "result" "InterviewResult" NOT NULL DEFAULT 'unknown',
  "strengths" TEXT[], "weaknesses" TEXT[], "questionsAsked" TEXT[], "knowledgeGaps" TEXT[], "improvementActions" TEXT[],
  "resumeImplications" TEXT[], "strategyImplications" TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApplicationTask" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "profileId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "category" "ApplicationTaskCategory" NOT NULL DEFAULT 'other', "priority" "StrategyPriority" NOT NULL DEFAULT 'medium',
  "status" "ActionStatus" NOT NULL DEFAULT 'todo', "dueAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationTask_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OfferRecord" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "profileId" TEXT NOT NULL, "company" TEXT NOT NULL, "jobTitle" TEXT NOT NULL, "city" TEXT,
  "salaryMin" INTEGER, "salaryMax" INTEGER, "salaryMonths" INTEGER, "salaryText" TEXT, "benefits" TEXT[], "probationInfo" TEXT,
  "deadline" TIMESTAMP(3), "status" "OfferStatus" NOT NULL DEFAULT 'pending', "pros" TEXT[], "cons" TEXT[], "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OfferRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Application_profileId_idx" ON "Application"("profileId");
CREATE INDEX "Application_jobPostId_idx" ON "Application"("jobPostId");
CREATE INDEX "Application_jobMatchId_idx" ON "Application"("jobMatchId");
CREATE INDEX "Application_status_idx" ON "Application"("status");
CREATE INDEX "InterviewRound_applicationId_idx" ON "InterviewRound"("applicationId");
CREATE INDEX "InterviewFeedback_interviewRoundId_idx" ON "InterviewFeedback"("interviewRoundId");
CREATE INDEX "InterviewFeedback_applicationId_idx" ON "InterviewFeedback"("applicationId");
CREATE INDEX "InterviewFeedback_profileId_idx" ON "InterviewFeedback"("profileId");
CREATE INDEX "ApplicationTask_applicationId_idx" ON "ApplicationTask"("applicationId");
CREATE INDEX "ApplicationTask_profileId_idx" ON "ApplicationTask"("profileId");
CREATE INDEX "OfferRecord_applicationId_idx" ON "OfferRecord"("applicationId");
CREATE INDEX "OfferRecord_profileId_idx" ON "OfferRecord"("profileId");
ALTER TABLE "Application" ADD CONSTRAINT "Application_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationTask" ADD CONSTRAINT "ApplicationTask_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationTask" ADD CONSTRAINT "ApplicationTask_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferRecord" ADD CONSTRAINT "OfferRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferRecord" ADD CONSTRAINT "OfferRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
