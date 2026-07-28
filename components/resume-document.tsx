import { markdownToHtml } from "@/lib/markdown-to-html";
import { cn } from "@/lib/utils";
import type { ResumeTemplateKey } from "@/types/resume";

export function ResumeDocument({
  markdown,
  templateKey,
  className,
}: {
  markdown: string;
  templateKey: ResumeTemplateKey;
  className?: string;
}) {
  return (
    <article
      className={cn("resume-print resume-template", className)}
      data-resume-template={templateKey}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }}
    />
  );
}
