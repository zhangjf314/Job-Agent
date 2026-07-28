"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateCareerStrategyPlan, updateActionPlanItemStatus } from "@/services/strategy-service";
import { parseActionStatusFormData } from "./form-parsers";

export async function generateCareerStrategyAction(profileId: string) {
  const plan = await generateCareerStrategyPlan(profileId);
  revalidatePath("/strategy");
  revalidatePath(`/profile/${profileId}`);
  redirect(`/strategy/${plan.id}`);
}

export async function generateCareerStrategyFromFormAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const plan = await generateCareerStrategyPlan(profileId);
  revalidatePath("/strategy");
  redirect(`/strategy/${plan.id}`);
}

export async function updateActionStatusAction(formData: FormData) {
  const { itemId, status } = parseActionStatusFormData(formData);
  await updateActionPlanItemStatus(itemId, status);
  revalidatePath("/strategy");
}
