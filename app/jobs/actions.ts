"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createJDFromJobPost,
  fetchAndParseCompanyCareerPage,
  createManualJobPost,
  importSearchResultsJson,
  matchJobToProfile,
  saveJob,
  searchRealJobsForProfile,
  searchJobsForProfile,
  updateSavedJobStatus,
} from "@/services/jobs/job-service";
import { searchJobsWithProviders } from "@/services/jobs/job-search-service";
import type { SavedJobStatus } from "@/types/job";
import { parseJobSearchFormData } from "./form-parsers";
import { importJobFile } from "@/services/jobs/job-file-importer";

export async function searchJobsAction(formData: FormData) {
  const source = String(formData.get("source") ?? "mock");
  if (["manual_jd", "manual_url", "company_career_page", "web_search"].includes(source)) {
    await searchJobsWithProviders({ ...parseJobSearchFormData(formData), source });
  } else {
    await searchJobsForProfile(parseJobSearchFormData(formData));
  }
  revalidatePath("/jobs");
  revalidatePath("/jobs/matches");
  redirect("/jobs/matches");
}

export async function searchRealJobsAction(formData: FormData) {
  await searchRealJobsForProfile(parseJobSearchFormData(formData));
  revalidatePath("/jobs");
  revalidatePath("/jobs/matches");
  redirect("/jobs/matches");
}

export async function importSearchResultsJsonAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const jsonText = String(formData.get("jsonText") ?? "");
  await importSearchResultsJson(profileId, jsonText);
  revalidatePath("/jobs");
  revalidatePath("/jobs/matches");
  redirect("/jobs/matches");
}

export async function fetchCompanyCareerPageAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const url = String(formData.get("url") ?? "");
  await fetchAndParseCompanyCareerPage(url, profileId || undefined);
  revalidatePath("/jobs");
  redirect("/jobs");
}

export async function createManualJobPostAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const rawText = String(formData.get("rawText") ?? "");
  const sourceUrl = String(formData.get("sourceUrl") ?? "");
  const { job } = await createManualJobPost(profileId, rawText, sourceUrl);
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function importJobPostAction(formData: FormData) {
  const source = String(formData.get("source") ?? "manual_jd");
  const result = await searchJobsWithProviders({ ...parseJobSearchFormData(formData), source });
  revalidatePath("/jobs");
  revalidatePath("/jobs/matches");
  const job = result.jobs[0];
  redirect(job ? `/jobs/${job.id}` : "/jobs");
}

export async function importJobFileAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("请选择 CSV 或 Excel 文件。");
  if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("仅支持 .csv 和 .xlsx 文件。");
  await importJobFile(profileId, file.name, Buffer.from(await file.arrayBuffer()));
  revalidatePath("/jobs");
  revalidatePath("/jobs/matches");
  redirect("/jobs/matches");
}

export async function matchJobAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const jobPostId = String(formData.get("jobPostId") ?? "");
  await matchJobToProfile(profileId, jobPostId);
  revalidatePath(`/jobs/${jobPostId}`);
}

export async function saveJobAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const jobPostId = String(formData.get("jobPostId") ?? "");
  await saveJob(profileId, jobPostId);
  revalidatePath("/jobs/saved");
  revalidatePath(`/jobs/${jobPostId}`);
}

export async function updateSavedJobStatusAction(formData: FormData) {
  const savedJobId = String(formData.get("savedJobId") ?? "");
  const status = String(formData.get("status") ?? "saved") as SavedJobStatus;
  await updateSavedJobStatus(savedJobId, status);
  revalidatePath("/jobs/saved");
}

export async function createJDFromJobPostAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const jobPostId = String(formData.get("jobPostId") ?? "");
  await createJDFromJobPost(profileId, jobPostId);
  revalidatePath("/jd");
  redirect(`/jd`);
}
