import React from "react";
import { Button } from "@/components/ui/button";

export function ErrorPanel({ title, message, details, actionLabel, onAction }: { title: string; message: string; details?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm">{message}</p>
      {details ? (
        <details className="mt-4 rounded-md border border-red-200 bg-white/60 p-3 text-xs">
          <summary className="cursor-pointer font-medium">技术细节</summary>
          <pre className="mt-2 whitespace-pre-wrap">{details}</pre>
        </details>
      ) : null}
      {actionLabel && onAction ? <Button className="mt-4" variant="outline" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
