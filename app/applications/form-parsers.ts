import type {
  ApplicationChannel,
  ApplicationPriority,
  ApplicationSource,
} from "@/types/application";

export function parseManualApplicationFormData(formData: FormData) {
  return {
    profileId: String(formData.get("profileId") ?? ""),
    jobPostId: String(formData.get("jobPostId") ?? "") || undefined,
    jobMatchId: String(formData.get("jobMatchId") ?? "") || undefined,
    resumeId: String(formData.get("resumeId") ?? "") || undefined,
    company: String(formData.get("company") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    city: String(formData.get("city") ?? ""),
    source: String(formData.get("source") ?? "manual") as ApplicationSource,
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    channel: String(formData.get("channel") ?? "other") as ApplicationChannel,
    priority: String(formData.get("priority") ?? "medium") as ApplicationPriority,
    salaryExpectation: String(formData.get("salaryExpectation") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}
