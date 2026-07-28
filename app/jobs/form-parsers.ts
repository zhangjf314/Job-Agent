export function parseJobSearchFormData(formData: FormData) {
  return {
    profileId: String(formData.get("profileId") ?? ""),
    strategyPlanId: String(formData.get("strategyPlanId") ?? ""),
    directionRecommendationId: String(formData.get("directionRecommendationId") ?? ""),
    query: String(formData.get("query") ?? ""),
    city: String(formData.get("city") ?? ""),
    education: String(formData.get("education") ?? ""),
    experience: String(formData.get("experience") ?? ""),
    keywords: String(formData.get("keywords") ?? ""),
    limit: Number(formData.get("limit") ?? 20),
    rawText: String(formData.get("rawText") ?? ""),
    url: String(formData.get("url") ?? ""),
  };
}
