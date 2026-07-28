import Link from "next/link";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ModuleCard({ title, description, href, metric }: { title: string; description: string; href: string; metric?: string | number }) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:border-primary">
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{description}</p>
          {metric !== undefined ? <div className="text-2xl font-semibold text-foreground">{metric}</div> : null}
        </CardContent>
      </Card>
    </Link>
  );
}
