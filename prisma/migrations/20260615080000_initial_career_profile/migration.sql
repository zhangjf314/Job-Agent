CREATE TYPE "TargetStatus" AS ENUM ('seeking_internship', 'seeking_fulltime', 'open_to_opportunities');
CREATE TYPE "SkillCategory" AS ENUM ('programming_language', 'framework', 'database', 'tool', 'business', 'soft_skill');
CREATE TYPE "SkillLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE "EmploymentType" AS ENUM ('internship', 'fulltime', 'parttime', 'campus');
CREATE TYPE "EvidenceType" AS ENUM ('file', 'url', 'text', 'image');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetStatus" "TargetStatus" NOT NULL DEFAULT 'open_to_opportunities',
  "targetRoles" TEXT[] NOT NULL,
  "targetCities" TEXT[] NOT NULL,
  "expectedSalaryMin" INTEGER,
  "expectedSalaryMax" INTEGER,
  "personalSummary" TEXT,
  "profileCompletenessScore" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BasicInfo" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "realName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "location" TEXT,
  "githubUrl" TEXT,
  "portfolioUrl" TEXT,
  "linkedinUrl" TEXT,
  "personalWebsite" TEXT,
  CONSTRAINT "BasicInfo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EducationItem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "school" TEXT NOT NULL,
  "major" TEXT NOT NULL,
  "degree" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "gpa" TEXT,
  "ranking" TEXT,
  "courses" TEXT[] NOT NULL,
  "honors" TEXT[] NOT NULL,
  CONSTRAINT "EducationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillItem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "SkillCategory" NOT NULL,
  "level" "SkillLevel" NOT NULL,
  "evidence" TEXT,
  "yearsOfExperience" DOUBLE PRECISION,
  CONSTRAINT "SkillItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectItem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "background" TEXT,
  "goal" TEXT,
  "responsibilities" TEXT[] NOT NULL,
  "techStack" TEXT[] NOT NULL,
  "highlights" TEXT[] NOT NULL,
  "results" TEXT,
  "metrics" TEXT[] NOT NULL,
  "links" TEXT[] NOT NULL,
  CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperienceItem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "department" TEXT,
  "role" TEXT NOT NULL,
  "employmentType" "EmploymentType" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "responsibilities" TEXT[] NOT NULL,
  "achievements" TEXT[] NOT NULL,
  "techStack" TEXT[] NOT NULL,
  "businessImpact" TEXT,
  "metrics" TEXT[] NOT NULL,
  CONSTRAINT "ExperienceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateItem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "credentialUrl" TEXT,
  CONSTRAINT "CertificateItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AwardItem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "level" TEXT,
  "awardedAt" TIMESTAMP(3),
  "description" TEXT,
  CONSTRAINT "AwardItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceItem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "type" "EvidenceType" NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "description" TEXT,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "CareerProfile_userId_idx" ON "CareerProfile"("userId");
CREATE UNIQUE INDEX "BasicInfo_profileId_key" ON "BasicInfo"("profileId");
CREATE INDEX "EducationItem_profileId_idx" ON "EducationItem"("profileId");
CREATE INDEX "SkillItem_profileId_idx" ON "SkillItem"("profileId");
CREATE INDEX "ProjectItem_profileId_idx" ON "ProjectItem"("profileId");
CREATE INDEX "ExperienceItem_profileId_idx" ON "ExperienceItem"("profileId");
CREATE INDEX "CertificateItem_profileId_idx" ON "CertificateItem"("profileId");
CREATE INDEX "AwardItem_profileId_idx" ON "AwardItem"("profileId");
CREATE INDEX "EvidenceItem_profileId_idx" ON "EvidenceItem"("profileId");

ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BasicInfo" ADD CONSTRAINT "BasicInfo_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationItem" ADD CONSTRAINT "EducationItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillItem" ADD CONSTRAINT "SkillItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperienceItem" ADD CONSTRAINT "ExperienceItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CertificateItem" ADD CONSTRAINT "CertificateItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AwardItem" ADD CONSTRAINT "AwardItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
