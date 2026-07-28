"use server";

import { revalidatePath } from "next/cache";
import { createEvaluationRecord } from "@/services/evaluation-service";

export async function createEvaluationAction(formData: FormData) {
  await createEvaluationRecord({
    profileId: String(formData.get("profileId") ?? ""),
    type: String(formData.get("type") ?? "jd_parsing") as "jd_parsing" | "match_scoring" | "resume_suggestion",
    entityId: String(formData.get("entityId") ?? ""),
    humanScore: Number(formData.get("humanScore") ?? 0),
    reviewerNotes: String(formData.get("reviewerNotes") ?? ""),
    tags: [],
  });
  revalidatePath("/evaluation");
}
