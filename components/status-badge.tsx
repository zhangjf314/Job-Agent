import React from "react";
import { cn } from "@/lib/utils";

const toneMap: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  interviewing: "bg-blue-50 text-blue-700 border-blue-200",
  applied: "bg-sky-50 text-sky-700 border-sky-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  no: "bg-red-50 text-red-700 border-red-200",
  maybe: "bg-amber-50 text-amber-700 border-amber-200",
  yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  strong_yes: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const labelMap: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
  planned: "计划中",
  applied: "已投递",
  resume_screen: "简历筛选",
  written_test: "笔试",
  interviewing: "面试中",
  offer: "已获录用",
  rejected: "已拒绝",
  withdrawn: "已撤回",
  no_response: "暂无回复",
  review: "复盘",
  archived: "已归档",
  no: "不推荐",
  maybe: "可观察",
  yes: "推荐",
  strong_yes: "强推荐",
  todo: "待办",
  in_progress: "进行中",
  done: "已完成",
  skipped: "已跳过",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", toneMap[value] ?? "bg-muted text-muted-foreground border-border", className)}>
      {labelMap[value] ?? value}
    </span>
  );
}
