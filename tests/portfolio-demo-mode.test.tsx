import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  PortfolioDemoBanner,
  isPortfolioDemoMode,
} from "@/components/portfolio-demo-banner";

const originalValue = process.env.PORTFOLIO_DEMO_MODE;

afterEach(() => {
  if (originalValue === undefined) delete process.env.PORTFOLIO_DEMO_MODE;
  else process.env.PORTFOLIO_DEMO_MODE = originalValue;
});

describe("portfolio demo mode", () => {
  it("recognizes true without exposing the raw environment value", () => {
    expect(isPortfolioDemoMode({ PORTFOLIO_DEMO_MODE: "true" })).toBe(true);
  });

  it("is disabled for false or missing values", () => {
    expect(isPortfolioDemoMode({ PORTFOLIO_DEMO_MODE: "false" })).toBe(false);
    expect(isPortfolioDemoMode({})).toBe(false);
  });

  it("shows a bilingual fictional-data banner", () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    render(<PortfolioDemoBanner />);
    expect(screen.getByText(/All data is fictional/)).toBeTruthy();
    expect(screen.getByText(/所有数据均为虚构/)).toBeTruthy();
  });

  it("renders nothing outside Demo mode", () => {
    process.env.PORTFOLIO_DEMO_MODE = "false";
    const { container } = render(<PortfolioDemoBanner />);
    expect(container.childElementCount).toBe(0);
  });
});
