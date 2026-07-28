CREATE TYPE "TargetTimeframe" AS ENUM ('immediate', 'one_month', 'three_months', 'six_months');
CREATE TYPE "RoleFamily" AS ENUM ('engineering', 'data', 'product', 'operations', 'design', 'sales', 'other');
CREATE TYPE "StrategyPriority" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "SkillGapCategory" AS ENUM ('hard_skill', 'soft_skill', 'domain_knowledge', 'tool', 'project_experience', 'interview');
CREATE TYPE "SkillLevelForGap" AS ENUM ('none', 'beginner', 'intermediate', 'advanced');
CREATE TYPE "ActionCategory" AS ENUM ('resume', 'skill', 'project', 'application', 'interview', 'networking');
CREATE TYPE "ActionStatus" AS ENUM ('todo', 'in_progress', 'done', 'skipped');

CREATE TABLE "CareerStrategyPlan" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "targetTimeframe" "TargetTimeframe" NOT NULL DEFAULT 'one_month',
  "overallReadinessScore" INTEGER NOT NULL,
  "recommendedPrimaryDirection" TEXT NOT NULL,
  "recommendedCities" TEXT[],
  "strategyNotes" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerStrategyPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerDirectionRecommendation" (
  "id" TEXT NOT NULL,
  "strategyPlanId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "directionName" TEXT NOT NULL,
  "roleFamily" "RoleFamily" NOT NULL,
  "matchScore" INTEGER NOT NULL,
  "confidence" INTEGER NOT NULL,
  "priority" "StrategyPriority" NOT NULL,
  "suitableRoles" TEXT[],
  "suitableIndustries" TEXT[],
  "recommendedCities" TEXT[],
  "matchedEvidence" TEXT[],
  "gaps" TEXT[],
  "risks" TEXT[],
  "resumeFocus" TEXT[],
  "searchKeywords" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerDirectionRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillGap" (
  "id" TEXT NOT NULL,
  "strategyPlanId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "directionRecommendationId" TEXT,
  "skillName" TEXT NOT NULL,
  "category" "SkillGapCategory" NOT NULL,
  "currentLevel" "SkillLevelForGap" NOT NULL,
  "targetLevel" "SkillLevelForGap" NOT NULL,
  "importance" INTEGER NOT NULL,
  "suggestedActions" TEXT[],
  "evidenceNeeded" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SkillGap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobSearchStrategy" (
  "id" TEXT NOT NULL,
  "strategyPlanId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "directionRecommendationId" TEXT,
  "targetRole" TEXT NOT NULL,
  "targetCities" TEXT[],
  "targetIndustries" TEXT[],
  "companyTypes" TEXT[],
  "searchKeywords" TEXT[],
  "negativeKeywords" TEXT[],
  "weeklyApplicationTarget" INTEGER NOT NULL,
  "resumeVersionSuggestion" TEXT NOT NULL,
  "applicationAdvice" TEXT[],
  "interviewPrepAdvice" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobSearchStrategy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionPlanItem" (
  "id" TEXT NOT NULL,
  "strategyPlanId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "ActionCategory" NOT NULL,
  "priority" "StrategyPriority" NOT NULL,
  "estimatedHours" INTEGER NOT NULL,
  "dueInDays" INTEGER NOT NULL,
  "status" "ActionStatus" NOT NULL DEFAULT 'todo',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareerStrategyPlan_profileId_idx" ON "CareerStrategyPlan"("profileId");
CREATE INDEX "CareerDirectionRecommendation_strategyPlanId_idx" ON "CareerDirectionRecommendation"("strategyPlanId");
CREATE INDEX "CareerDirectionRecommendation_profileId_idx" ON "CareerDirectionRecommendation"("profileId");
CREATE INDEX "SkillGap_strategyPlanId_idx" ON "SkillGap"("strategyPlanId");
CREATE INDEX "SkillGap_profileId_idx" ON "SkillGap"("profileId");
CREATE INDEX "SkillGap_directionRecommendationId_idx" ON "SkillGap"("directionRecommendationId");
CREATE INDEX "JobSearchStrategy_strategyPlanId_idx" ON "JobSearchStrategy"("strategyPlanId");
CREATE INDEX "JobSearchStrategy_profileId_idx" ON "JobSearchStrategy"("profileId");
CREATE INDEX "JobSearchStrategy_directionRecommendationId_idx" ON "JobSearchStrategy"("directionRecommendationId");
CREATE INDEX "ActionPlanItem_strategyPlanId_idx" ON "ActionPlanItem"("strategyPlanId");
CREATE INDEX "ActionPlanItem_profileId_idx" ON "ActionPlanItem"("profileId");

ALTER TABLE "CareerStrategyPlan" ADD CONSTRAINT "CareerStrategyPlan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerDirectionRecommendation" ADD CONSTRAINT "CareerDirectionRecommendation_strategyPlanId_fkey" FOREIGN KEY ("strategyPlanId") REFERENCES "CareerStrategyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerDirectionRecommendation" ADD CONSTRAINT "CareerDirectionRecommendation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillGap" ADD CONSTRAINT "SkillGap_strategyPlanId_fkey" FOREIGN KEY ("strategyPlanId") REFERENCES "CareerStrategyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillGap" ADD CONSTRAINT "SkillGap_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillGap" ADD CONSTRAINT "SkillGap_directionRecommendationId_fkey" FOREIGN KEY ("directionRecommendationId") REFERENCES "CareerDirectionRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobSearchStrategy" ADD CONSTRAINT "JobSearchStrategy_strategyPlanId_fkey" FOREIGN KEY ("strategyPlanId") REFERENCES "CareerStrategyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobSearchStrategy" ADD CONSTRAINT "JobSearchStrategy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobSearchStrategy" ADD CONSTRAINT "JobSearchStrategy_directionRecommendationId_fkey" FOREIGN KEY ("directionRecommendationId") REFERENCES "CareerDirectionRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlanItem" ADD CONSTRAINT "ActionPlanItem_strategyPlanId_fkey" FOREIGN KEY ("strategyPlanId") REFERENCES "CareerStrategyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionPlanItem" ADD CONSTRAINT "ActionPlanItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
