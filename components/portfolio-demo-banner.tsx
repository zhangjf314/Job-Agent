import React from "react";
import { BRAND } from "@/lib/branding";

export function isPortfolioDemoMode(
  env: Partial<NodeJS.ProcessEnv> = process.env,
) {
  return env.PORTFOLIO_DEMO_MODE?.toLowerCase() === "true";
}

export function PortfolioDemoBanner() {
  if (!isPortfolioDemoMode()) return null;
  return (
    <div
      data-portfolio-demo-banner
      className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-center text-sm font-medium text-amber-950 print:hidden"
    >
      {BRAND.productNameZh} Portfolio Demo · All data is fictional
      <span className="mx-2 text-amber-500">·</span>
      作品集演示 · 所有数据均为虚构
    </div>
  );
}
