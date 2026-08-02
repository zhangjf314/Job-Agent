-- Add structured project source fields while preserving every existing project.
ALTER TABLE "ProjectItem"
  ADD COLUMN "stableKey" TEXT,
  ADD COLUMN "projectType" TEXT,
  ADD COLUMN "fullDescription" TEXT,
  ADD COLUMN "challenges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "solutions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "engineeringPractices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

WITH ranked_projects AS (
  SELECT
    "id",
    md5(lower(trim("name"))) AS name_hash,
    row_number() OVER (
      PARTITION BY "profileId", lower(trim("name"))
      ORDER BY "id"
    ) AS duplicate_number
  FROM "ProjectItem"
)
UPDATE "ProjectItem" AS project
SET "stableKey" = 'project:' || ranked.name_hash ||
  CASE
    WHEN ranked.duplicate_number = 1 THEN ''
    ELSE ':' || ranked.duplicate_number::TEXT
  END
FROM ranked_projects AS ranked
WHERE project."id" = ranked."id";

ALTER TABLE "ProjectItem" ALTER COLUMN "stableKey" SET NOT NULL;
CREATE UNIQUE INDEX "ProjectItem_profileId_stableKey_key"
  ON "ProjectItem"("profileId", "stableKey");

CREATE TYPE "ProjectFactCategory" AS ENUM (
  'background', 'goal', 'role', 'technology', 'feature',
  'responsibility', 'challenge', 'solution', 'engineering', 'result', 'metric'
);

CREATE TYPE "ProjectAssertionStrength" AS ENUM (
  'learned', 'used', 'implemented', 'designed', 'led', 'achieved'
);

CREATE TABLE "ProjectFactAtom" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "category" "ProjectFactCategory" NOT NULL,
  "canonicalText" TEXT NOT NULL,
  "sourceField" TEXT,
  "sourceOrder" INTEGER,
  "displayOrder" INTEGER NOT NULL,
  "assertionStrength" "ProjectAssertionStrength" NOT NULL,
  "renderable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectFactAtom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectFactAtom_projectId_stableKey_key"
  ON "ProjectFactAtom"("projectId", "stableKey");
CREATE INDEX "ProjectFactAtom_projectId_displayOrder_idx"
  ON "ProjectFactAtom"("projectId", "displayOrder");
ALTER TABLE "ProjectFactAtom"
  ADD CONSTRAINT "ProjectFactAtom_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
