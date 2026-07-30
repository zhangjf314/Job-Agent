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
