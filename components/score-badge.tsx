import React from "react";
import { cn } from "@/lib/utils";

export function ScoreBadge({ label, score }: { label: string; score: number | null | undefined }) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const tone = value >= 75 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : value >= 55 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700";
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tone)}>{label} {value}/100</span>;
}
