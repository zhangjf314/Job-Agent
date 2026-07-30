"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResumeDocument } from "@/components/resume-document";
import { useResumeOnePageFit } from "@/hooks/use-resume-one-page-fit";
import type { ResumeTemplateKey } from "@/types/resume";

type PrintMode = "standard" | "smart";

function statusText(status: string, scale: number) {
  if (status === "measuring") return "正在等待字体和图片并测量…";
  if (status === "fits_without_scaling") return "内容已经适合一页，无需缩放。";
  if (status === "fitted") return `已适配一页 · 缩放 ${Math.round(scale * 100)}%`;
  if (status === "cannot_fit") {
    return "内容过多，无法在保证可读性的情况下压缩为一页。请切换标准分页或精简内容。";
  }
  if (status === "error") return "测量失败，将保留标准分页。";
  return "智能一页不会删除任何内容。";
}

export function ResumePrintShell({
  resumeId,
  markdown,
  templateKey,
}: {
  resumeId: string;
  markdown: string;
  templateKey: ResumeTemplateKey;
}) {
  const [mode, setMode] = useState<PrintMode>("standard");
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const enabled = mode === "smart";
  const { result, remeasure } = useResumeOnePageFit({
    enabled,
    shellRef,
    contentRef,
  });
  const smartSucceeded =
    enabled &&
    (result.status === "fitted" ||
      result.status === "fits_without_scaling");

  useEffect(() => {
    const stored = window.localStorage.getItem(`resume-print-mode:${resumeId}`);
    if (stored === "smart") setMode("smart");
  }, [resumeId]);

  function selectMode(next: PrintMode) {
    setMode(next);
    window.localStorage.setItem(`resume-print-mode:${resumeId}`, next);
  }

  async function print() {
    if (enabled) await remeasure();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    window.print();
  }

  return (
    <>
      <section
        className="print-controls mx-auto mb-4 max-w-[900px] rounded-lg border bg-white p-4 print:hidden"
        data-print-controls
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <fieldset className="flex gap-4 text-sm">
            <legend className="mb-2 font-medium">打印模式</legend>
            <label className="flex items-center gap-2">
              <input data-print-mode-option="standard" type="radio" checked={mode === "standard"} onChange={() => selectMode("standard")} />
              标准分页
            </label>
            <label className="flex items-center gap-2">
              <input data-print-mode-option="smart" type="radio" checked={mode === "smart"} onChange={() => selectMode("smart")} />
              智能一页
            </label>
          </fieldset>
          <Button type="button" onClick={print}>
            <Printer className="size-4" />
            打印或保存为 PDF
          </Button>
        </div>
        <p className={`mt-3 text-sm ${result.status === "cannot_fit" ? "text-destructive" : "text-muted-foreground"}`}>
          {mode === "standard"
            ? "标准分页不缩放内容，并保留原有分页行为。"
            : statusText(result.status, result.selectedScale)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          保存 PDF 时建议：纸张选择 A4、缩放 100%、边距“无”、启用背景图形。智能一页已由应用完成缩放，请勿二次缩放。
        </p>
      </section>

      <style media="print">
        {smartSucceeded
          ? "@page { size: A4 portrait; margin: 0; }"
          : "@page { size: A4 portrait; margin: 16mm 14mm; }"}
      </style>
      <div
        ref={shellRef}
        className={`resume-a4-shell ${enabled ? "resume-a4-shell--smart" : "resume-a4-shell--standard"} ${smartSucceeded ? "resume-a4-shell--one-page" : ""}`}
        data-print-mode={smartSucceeded ? "smart-success" : mode}
        data-fit-status={result.status}
        data-fit-scale={result.selectedScale.toFixed(3)}
      >
        <div
          ref={contentRef}
          className={`resume-fit-content ${enabled ? "resume-fit-content--compact" : ""}`}
          style={
            smartSucceeded
              ? {
                  zoom: result.selectedScale,
                  width: `${100 / result.selectedScale}%`,
                }
              : undefined
          }
        >
          <ResumeDocument markdown={markdown} templateKey={templateKey} />
        </div>
      </div>
    </>
  );
}
