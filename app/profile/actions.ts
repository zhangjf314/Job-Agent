"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CareerProfileInput } from "@/schemas/career-profile";
import {
  createCareerProfile,
  deleteCareerProfile,
  replaceCareerProfileSections,
} from "@/services/career-profile-service";
import { getCurrentUser } from "@/services/auth/current-user";
import { createMockGraduateProfile } from "@/services/mock-profile";
import {
  createProjectFactAtom,
  deleteProjectFactAtom,
  moveProjectFactAtom,
  syncProjectFactAtoms,
  updateProjectFactAtom,
} from "@/services/project-facts/project-fact-service";
import { projectFactAtomInputSchema } from "@/schemas/project-fact";
import { prisma } from "@/lib/prisma";

async function assertProfileOwnership(profileId: string, projectId?: string, atomId?: string) {
  const user = await getCurrentUser();
  const profile = await prisma.careerProfile.findFirst({
    where: {
      id: profileId,
      userId: user.id,
      ...(projectId ? { projectItems: { some: { id: projectId } } } : {}),
      ...(atomId ? { projectItems: { some: { factAtoms: { some: { id: atomId } } } } } : {}),
    },
    select: { id: true },
  });
  if (!profile) throw new Error("PROJECT_FACT_ACCESS_DENIED");
}

function projectFactInput(formData: FormData) {
  return projectFactAtomInputSchema.parse({
    category: formData.get("category"),
    canonicalText: formData.get("canonicalText"),
    assertionStrength: formData.get("assertionStrength"),
    renderable: formData.get("renderable") === "on",
  });
}

function revalidateProfile(profileId: string) {
  revalidatePath(`/profile/${profileId}`);
}

export async function createCareerProfileAction(payload: CareerProfileInput) {
  const profile = await createCareerProfile(payload);
  revalidatePath("/profile");
  redirect(`/profile/${profile.id}`);
}

export async function updateCareerProfileAction(id: string, payload: CareerProfileInput) {
  await replaceCareerProfileSections({ ...payload, id });
  revalidatePath("/profile");
  revalidatePath(`/profile/${id}`);
}

export async function deleteCareerProfileAction(id: string) {
  await deleteCareerProfile(id);
  revalidatePath("/profile");
  redirect("/profile");
}

export async function createMockProfileAction() {
  const user = await getCurrentUser();
  const profile = await createCareerProfile(createMockGraduateProfile(user.id));
  revalidatePath("/profile");
  redirect(`/profile/${profile.id}`);
}

export async function createProjectFactAtomAction(profileId: string, projectId: string, formData: FormData) {
  await assertProfileOwnership(profileId, projectId);
  await createProjectFactAtom(projectId, projectFactInput(formData));
  revalidateProfile(profileId);
}

export async function updateProjectFactAtomAction(profileId: string, atomId: string, formData: FormData) {
  await assertProfileOwnership(profileId, undefined, atomId);
  await updateProjectFactAtom(atomId, projectFactInput(formData));
  revalidateProfile(profileId);
}

export async function deleteProjectFactAtomAction(profileId: string, atomId: string) {
  await assertProfileOwnership(profileId, undefined, atomId);
  await deleteProjectFactAtom(atomId);
  revalidateProfile(profileId);
}

export async function moveProjectFactAtomAction(profileId: string, atomId: string, direction: "up" | "down") {
  await assertProfileOwnership(profileId, undefined, atomId);
  await moveProjectFactAtom(atomId, direction);
  revalidateProfile(profileId);
}

export async function syncProjectFactAtomsAction(profileId: string, projectId: string) {
  await assertProfileOwnership(profileId, projectId);
  await syncProjectFactAtoms(projectId);
  revalidateProfile(profileId);
}
