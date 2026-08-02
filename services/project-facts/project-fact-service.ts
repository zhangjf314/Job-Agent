import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  projectFactAtomInputSchema,
  type ProjectFactAtomInput,
} from "@/schemas/project-fact";
import { atomizeProject, projectAtomStableKey } from "./project-fact-atomizer";

type DbClient = PrismaClient;

export type ProjectFactBackfillSummary = {
  projectsScanned: number;
  projectsWithStructuredFacts: number;
  atomsCreated: number;
  atomsReused: number;
  unrenderableDescriptions: number;
  projectsRequiringManualReview: number;
};

export async function backfillProjectFactAtoms(input: {
  profileId?: string;
  dryRun?: boolean;
  db?: DbClient;
} = {}): Promise<ProjectFactBackfillSummary> {
  const db = input.db ?? prisma;
  const projects = await db.projectItem.findMany({
    where: input.profileId ? { profileId: input.profileId } : undefined,
    include: { factAtoms: true },
    orderBy: [{ profileId: "asc" }, { id: "asc" }],
  });
  const summary: ProjectFactBackfillSummary = {
    projectsScanned: projects.length,
    projectsWithStructuredFacts: 0,
    atomsCreated: 0,
    atomsReused: 0,
    unrenderableDescriptions: 0,
    projectsRequiringManualReview: 0,
  };

  for (const project of projects) {
    const generated = atomizeProject(project);
    const existingKeys = new Set(project.factAtoms.map((atom) => atom.stableKey));
    if (generated.some((atom) => atom.renderable)) {
      summary.projectsWithStructuredFacts += 1;
    }
    const hasUnrenderable = generated.some((atom) => !atom.renderable);
    if (hasUnrenderable) summary.unrenderableDescriptions += 1;
    if (generated.length === 0 || hasUnrenderable) {
      summary.projectsRequiringManualReview += 1;
    }
    for (const atom of generated) {
      if (existingKeys.has(atom.stableKey)) {
        summary.atomsReused += 1;
        continue;
      }
      summary.atomsCreated += 1;
      if (!input.dryRun) {
        await db.projectFactAtom.create({ data: atom });
      }
    }
  }
  return summary;
}

export async function syncProjectFactAtoms(
  projectId: string,
  db: DbClient = prisma,
) {
  const project = await db.projectItem.findUniqueOrThrow({
    where: { id: projectId },
    include: { factAtoms: true },
  });
  const generated = atomizeProject(project);
  const existingKeys = new Set(project.factAtoms.map((atom) => atom.stableKey));
  const missing = generated.filter((atom) => !existingKeys.has(atom.stableKey));
  if (missing.length > 0) {
    await db.projectFactAtom.createMany({ data: missing, skipDuplicates: true });
  }
  return { created: missing.length, reused: generated.length - missing.length };
}

export async function createProjectFactAtom(
  projectId: string,
  input: ProjectFactAtomInput,
  db: DbClient = prisma,
) {
  const parsed = projectFactAtomInputSchema.parse(input);
  const duplicate = await db.projectFactAtom.findFirst({
    where: {
      projectId,
      canonicalText: { equals: parsed.canonicalText, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) throw new Error("PROJECT_FACT_DUPLICATE");
  const maximum = await db.projectFactAtom.aggregate({
    where: { projectId },
    _max: { displayOrder: true },
  });
  return db.projectFactAtom.create({
    data: {
      projectId,
      stableKey: projectAtomStableKey(parsed.category, parsed.canonicalText),
      category: parsed.category,
      canonicalText: parsed.canonicalText,
      sourceField: "manual",
      sourceOrder: null,
      displayOrder: (maximum._max.displayOrder ?? -1) + 1,
      assertionStrength: parsed.assertionStrength,
      renderable: parsed.renderable,
    },
  });
}

export async function updateProjectFactAtom(
  id: string,
  input: ProjectFactAtomInput,
  db: DbClient = prisma,
) {
  const parsed = projectFactAtomInputSchema.parse(input);
  const current = await db.projectFactAtom.findUniqueOrThrow({ where: { id } });
  const duplicate = await db.projectFactAtom.findFirst({
    where: {
      projectId: current.projectId,
      id: { not: id },
      canonicalText: { equals: parsed.canonicalText, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) throw new Error("PROJECT_FACT_DUPLICATE");
  return db.projectFactAtom.update({
    where: { id },
    data: {
      category: parsed.category,
      canonicalText: parsed.canonicalText,
      stableKey: projectAtomStableKey(parsed.category, parsed.canonicalText),
      assertionStrength: parsed.assertionStrength,
      renderable: parsed.renderable,
      sourceField: "manual",
      sourceOrder: null,
    },
  });
}

export async function deleteProjectFactAtom(id: string, db: DbClient = prisma) {
  return db.projectFactAtom.delete({ where: { id } });
}

export async function moveProjectFactAtom(
  id: string,
  direction: "up" | "down",
  db: DbClient = prisma,
) {
  const atom = await db.projectFactAtom.findUniqueOrThrow({ where: { id } });
  const neighbor = await db.projectFactAtom.findFirst({
    where: {
      projectId: atom.projectId,
      displayOrder: direction === "up"
        ? { lt: atom.displayOrder }
        : { gt: atom.displayOrder },
    },
    orderBy: { displayOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return atom;
  await db.$transaction([
    db.projectFactAtom.update({
      where: { id: atom.id },
      data: { displayOrder: neighbor.displayOrder },
    }),
    db.projectFactAtom.update({
      where: { id: neighbor.id },
      data: { displayOrder: atom.displayOrder },
    }),
  ]);
  return atom;
}
