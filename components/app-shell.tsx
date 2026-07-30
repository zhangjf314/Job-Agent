import React from "react";
import { MainNav } from "@/components/main-nav";
import { PortfolioDemoBanner } from "@/components/portfolio-demo-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PortfolioDemoBanner />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-semibold">求职助手</div>
            <div className="text-sm text-muted-foreground">中国大陆个人求职助手</div>
          </div>
          <MainNav />
        </div>
      </header>
      {children}
    </div>
  );
}
