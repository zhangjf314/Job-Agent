"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ApplicationStatus, OfferStatus } from "@prisma/client";
import type {
  ApplicationPriority,
  InterviewResult,
  InterviewRoundStatus,
  InterviewRoundType,
} from "@/types/application";
import {
  addInterviewFeedback,
  createApplicationFromJobMatch,
  createApplicationFromSavedJob,
  createApplicationTask,
  createInterviewRound,
  createManualApplication,
  createOfferRecord,
  generateApplicationInsight,
  updateApplicationStatus,
  updateApplicationTaskStatus,
  updateOfferStatus,
} from "@/services/applications/application-service";
import type { ApplicationTaskStatus } from "@/types/application";
import { parseManualApplicationFormData } from "./form-parsers";

export async function createApplicationFromJobMatchAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const jobMatchId = String(formData.get("jobMatchId") ?? "");
  const resumeId = String(formData.get("resumeId") ?? "") || undefined;
  const application = await createApplicationFromJobMatch(profileId, jobMatchId, resumeId);
  revalidatePath("/applications");
  redirect(`/applications/${application?.id}`);
}

export async function createApplicationFromSavedJobAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const savedJobId = String(formData.get("savedJobId") ?? "");
  const resumeId = String(formData.get("resumeId") ?? "") || undefined;
  const application = await createApplicationFromSavedJob(profileId, savedJobId, resumeId);
  revalidatePath("/applications");
  redirect(`/applications/${application?.id}`);
}

export async function createManualApplicationAction(formData: FormData) {
  const parsed = parseManualApplicationFormData(formData);
  const application = await createManualApplication(parsed.profileId, parsed);
  revalidatePath("/applications");
  redirect(`/applications/${application?.id}`);
}

export async function updateApplicationStatusAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const status = String(formData.get("status") ?? "planned") as ApplicationStatus;
  await updateApplicationStatus(applicationId, status);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
}

export async function createInterviewRoundAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  await createInterviewRound(applicationId, {
    roundName: String(formData.get("roundName") ?? ""),
    roundType: String(formData.get("roundType") ?? "other") as InterviewRoundType,
    status: String(formData.get("status") ?? "scheduled") as InterviewRoundStatus,
    scheduledAt: String(formData.get("scheduledAt") ?? "") ? new Date(String(formData.get("scheduledAt"))) : undefined,
    interviewer: String(formData.get("interviewer") ?? ""),
    location: String(formData.get("location") ?? ""),
    meetingLink: String(formData.get("meetingLink") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function addInterviewFeedbackAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const roundId = String(formData.get("roundId") ?? "");
  await addInterviewFeedback(roundId, {
    feedbackText: String(formData.get("feedbackText") ?? ""),
    selfRating: String(formData.get("selfRating") ?? "") ? Number(formData.get("selfRating")) : undefined,
    result: String(formData.get("result") ?? "unknown") as InterviewResult,
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function createApplicationTaskAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  await createApplicationTask(applicationId, profileId, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "other") as never,
    priority: String(formData.get("priority") ?? "medium") as ApplicationPriority,
    status: "todo",
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function updateApplicationTaskStatusAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "todo") as ApplicationTaskStatus;
  await updateApplicationTaskStatus(taskId, status);
  revalidatePath(`/applications/${applicationId}`);
}

export async function createOfferRecordAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  await createOfferRecord(applicationId, {
    company: String(formData.get("company") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    city: String(formData.get("city") ?? ""),
    salaryMin: String(formData.get("salaryMin") ?? "") ? Number(formData.get("salaryMin")) : undefined,
    salaryMax: String(formData.get("salaryMax") ?? "") ? Number(formData.get("salaryMax")) : undefined,
    salaryMonths: String(formData.get("salaryMonths") ?? "") ? Number(formData.get("salaryMonths")) : undefined,
    salaryText: String(formData.get("salaryText") ?? ""),
    benefits: String(formData.get("benefits") ?? "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
    probationInfo: String(formData.get("probationInfo") ?? ""),
    status: String(formData.get("status") ?? "pending") as never,
    pros: String(formData.get("pros") ?? "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
    cons: String(formData.get("cons") ?? "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
    notes: String(formData.get("notes") ?? ""),
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function updateOfferStatusAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const offerId = String(formData.get("offerId") ?? "");
  const status = String(formData.get("status") ?? "pending") as OfferStatus;
  await updateOfferStatus(offerId, status);
  revalidatePath(`/applications/${applicationId}`);
}

export async function generateApplicationInsightAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  await generateApplicationInsight(applicationId);
  revalidatePath(`/applications/${applicationId}`);
}
