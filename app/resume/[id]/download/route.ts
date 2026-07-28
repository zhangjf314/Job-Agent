import { notFound } from "next/navigation";
import { getResumeById } from "@/services/resume-service";

type Context = {
  params: Promise<{ id: string }>;
};

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const resume = await getResumeById(id);
  if (!resume) notFound();

  return new Response(resume.contentMarkdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeFileName(resume.title))}.md"`,
    },
  });
}
