import type { JobPost } from "@prisma/client";
import { calculateJobMatch } from "./job-matcher";

type Profile = Parameters<typeof calculateJobMatch>[0];
type Resume = Parameters<typeof calculateJobMatch>[1];

export async function rankJobForProfile(profile: Profile, resume: Resume, jobPost: JobPost) {
  const result = await calculateJobMatch(profile, resume, null, null, jobPost);
  return {
    finalScore: result.matchScore,
    matchedPoints: result.matchedPoints,
    gaps: result.gaps,
    recommendation: result.recommendation,
    resumeSuggestion: result.resumeSuggestions[0] ?? "",
    detail: result,
  };
}
