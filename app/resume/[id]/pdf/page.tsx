import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { getResumeById } from "@/services/resume-service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ResumePdfPage({ params }: Props) {
  const { id } = await params;
  const resume = await getResumeById(id);
  if (!resume) notFound();

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-900">
      <div className="mx-auto mb-4 flex max-w-[900px] flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold">{resume.title}</h1>
          <p className="text-sm text-muted-foreground">在打印对话框中选择“另存为 PDF”。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/resume/${resume.id}`}>
              <ArrowLeft className="size-4" />
              返回
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/resume/${resume.id}/download`}>
              <Download className="size-4" />
              下载原文
            </Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      <article
        className="resume-print mx-auto max-w-[900px] bg-white px-14 py-12 shadow-sm print:max-w-none print:p-0 print:shadow-none"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(resume.contentMarkdown) }}
      />
    </main>
  );
}
