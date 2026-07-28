import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? <Button asChild className="mt-4"><Link href={actionHref}>{actionLabel}</Link></Button> : null}
    </div>
  );
}
