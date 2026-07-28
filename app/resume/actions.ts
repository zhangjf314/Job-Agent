"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveResume,
  deleteResume,
  duplicateResume,
  generateGeneralResumeFromProfile,
  setDefaultResume,
  updateResumeContent,
} from "@/services/resume-service";

export async function generateGeneralResumeAction(profileId: string) {
  const resume = await generateGeneralResumeFromProfile(profileId);
  revalidatePath("/resume");
  revalidatePath(`/profile/${profileId}`);
  redirect(`/resume/${resume.id}`);
}

export async function generateGeneralResumeFromFormAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const resume = await generateGeneralResumeFromProfile(profileId);
  revalidatePath("/resume");
  redirect(`/resume/${resume.id}`);
}

export async function saveResumeContentAction(id: string, formData: FormData) {
  const contentMarkdown = String(formData.get("contentMarkdown") ?? "");
  await updateResumeContent(id, contentMarkdown);
  revalidatePath("/resume");
  revalidatePath(`/resume/${id}`);
}

export async function duplicateResumeAction(id: string) {
  const resume = await duplicateResume(id);
  revalidatePath("/resume");
  redirect(`/resume/${resume.id}`);
}

export async function setDefaultResumeAction(id: string) {
  await setDefaultResume(id);
  revalidatePath("/resume");
  revalidatePath(`/resume/${id}`);
}

export async function archiveResumeAction(id: string) {
  await archiveResume(id);
  revalidatePath("/resume");
  revalidatePath(`/resume/${id}`);
}

export async function deleteResumeAction(id: string) {
  await deleteResume(id);
  revalidatePath("/resume");
  redirect("/resume");
}
