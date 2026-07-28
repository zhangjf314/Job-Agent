export function parseTailorResumeFormData(formData: FormData) {
  return {
    profileId: String(formData.get("profileId") ?? ""),
    baseResumeId: String(formData.get("baseResumeId") ?? ""),
    resumeId: String(formData.get("baseResumeId") ?? ""),
    title: String(formData.get("title") ?? ""),
    company: String(formData.get("company") ?? ""),
    city: String(formData.get("city") ?? ""),
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    rawText: String(formData.get("rawText") ?? ""),
  };
}
