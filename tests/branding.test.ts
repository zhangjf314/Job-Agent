import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/branding";

describe("Chinese product branding", () => {
  it("uses one canonical Chinese name", () => {
    expect(BRAND.productNameZh).toBe("个人求职助手");
  });

  it.each([
    "app/layout.tsx",
    "components/app-shell.tsx",
    "components/portfolio-demo-banner.tsx",
  ])("routes user-visible branding through the shared constant in %s", (file) => {
    expect(readFileSync(resolve(file), "utf8")).toContain("BRAND.productNameZh");
  });

  it("does not retain the old product label in user-visible application files", () => {
    const sources = [
      "app/layout.tsx",
      "components/app-shell.tsx",
      "components/portfolio-demo-banner.tsx",
    ].map((file) => readFileSync(resolve(file), "utf8")).join("\n");
    expect(sources).not.toContain(["中国大陆", "个人求职助手"].join(""));
  });
});
