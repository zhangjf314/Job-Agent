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
  updateResumePhotoVisibility,
  updateResumeTemplate,
} from "@/services/resume-service";
import { resumeTemplateKeySchema } from "@/schemas/resume";

export async function generateGeneralResumeAction(profileId: string) {
  const resume = await generateGeneralResumeFromProfile(profileId);
  revalidatePath("/resume");
  revalidatePath(`/profile/${profileId}`);
  redirect(`/resume/${resume.id}`);
}

export async function generateGeneralResumeFromFormAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const templateKey = resumeTemplateKeySchema.parse(formData.get("templateKey"));
  const resume = await generateGeneralResumeFromProfile(profileId, templateKey);
  revalidatePath("/resume");
  redirect(`/resume/${resume.id}`);
}

export async function saveResumeTemplateAction(id: string, formData: FormData) {
  const templateKey = resumeTemplateKeySchema.parse(formData.get("templateKey"));
  await updateResumeTemplate(id, templateKey);
  revalidatePath("/resume");
  revalidatePath(`/resume/${id}`);
  revalidatePath(`/resume/${id}/download`);
  revalidatePath(`/resume/${id}/pdf`);
}

export async function saveResumePhotoVisibilityAction(id: string, formData: FormData) {
  await updateResumePhotoVisibility(id, formData.get("showPhoto") === "on");
  revalidatePath(`/resume/${id}`);
  revalidatePath(`/resume/${id}/pdf`);
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
