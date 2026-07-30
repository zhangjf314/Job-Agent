import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { ErrorPanel } from "@/components/error-panel";
import { Button } from "@/components/ui/button";
import { ResumePrintShell } from "@/components/resume-print-shell";
import { getResumeById } from "@/services/resume-service";
import { renderResumeMarkdown, type RenderedResumeMarkdown } from "@/services/resume-templates/renderer";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ResumePdfPage({ params }: Props) {
  const { id } = await params;
  const resume = await getResumeById(id);
  if (!resume) notFound();
  let rendered: RenderedResumeMarkdown | null = null;
  let renderError = "";
  try {
    rendered = renderResumeMarkdown(resume);
  } catch (error) {
    renderError = error instanceof Error ? error.message : "未知模板渲染错误";
  }

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
        </div>
      </div>

      {rendered ? (
        <ResumePrintShell
          resumeId={resume.id}
          markdown={rendered.markdown}
          templateKey={rendered.template.key}
        />
      ) : (
        <div className="mx-auto max-w-[900px]">
          <ErrorPanel title="简历模板渲染失败" message="当前简历暂时无法生成打印页面。" details={renderError} />
        </div>
      )}
    </main>
  );
}
