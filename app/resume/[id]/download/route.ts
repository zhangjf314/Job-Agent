import { notFound } from "next/navigation";
import { createResumeMarkdownDownload } from "@/services/resume-download";
import { getResumeById } from "@/services/resume-service";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const resume = await getResumeById(id);
  if (!resume) notFound();

  return createResumeMarkdownDownload(resume);
}
