"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAnalyzeAndTailorResume, generateTailoredResume, getJDAnalysisById } from "@/services/jd-service";
import { parseTailorResumeFormData } from "./form-parsers";

export async function tailorResumeAction(formData: FormData) {
  const result = await createAnalyzeAndTailorResume({
    ...parseTailorResumeFormData(formData),
  });

  revalidatePath("/jd");
  revalidatePath("/resume");
  redirect(`/jd/${result.jdAnalysis?.id}`);
}

export async function generateTailoredResumeFromAnalysisAction(id: string) {
  const analysis = await getJDAnalysisById(id);
  if (!analysis?.resumeId) {
    throw new Error("该 JD 分析缺少基础简历，无法生成定制简历。");
  }
  const result = await generateTailoredResume(
    analysis.profileId,
    analysis.resumeId,
    analysis.jobDescriptionId,
  );
  revalidatePath("/jd");
  revalidatePath(`/jd/${id}`);
  revalidatePath("/resume");
  redirect(`/resume/${result.resume.id}`);
}
