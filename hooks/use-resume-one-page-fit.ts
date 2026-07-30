"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  calculateOnePageFit,
  ONE_PAGE_FIT_LIMITS,
  type OnePageFitResult,
} from "@/lib/resume/one-page-fit";

const idle: OnePageFitResult = {
  status: "idle",
  selectedScale: 1,
  originalHeight: 0,
  fittedHeight: 0,
  overflowAmount: 0,
};

async function waitForImages(root: HTMLElement) {
  await Promise.all(
    [...root.querySelectorAll("img")].map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  );
}

export function useResumeOnePageFit(input: {
  enabled: boolean;
  shellRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  const [result, setResult] = useState<OnePageFitResult>(idle);

  const measure = useCallback(async () => {
    if (!input.enabled) {
      setResult(idle);
      return idle;
    }
    const shell = input.shellRef.current;
    const content = input.contentRef.current;
    if (!shell || !content) return idle;
    setResult({ ...idle, status: "measuring" });
    try {
      await document.fonts.ready;
      await waitForImages(content);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const millimeter = shell.clientHeight / 297;
      const availableHeight =
        shell.clientHeight -
        2 *
          (ONE_PAGE_FIT_LIMITS.minimumMarginMm +
            ONE_PAGE_FIT_LIMITS.safetyBufferMm) *
          millimeter;
      const next = calculateOnePageFit({
        contentHeight: content.scrollHeight,
        availableHeight,
      });
      setResult(next);
      return next;
    } catch {
      const failed = { ...idle, status: "error" as const };
      setResult(failed);
      return failed;
    }
  }, [input.contentRef, input.enabled, input.shellRef]);

  useEffect(() => {
    void measure();
  }, [measure]);

  useEffect(() => {
    const beforePrint = () => {
      void measure();
    };
    const afterPrint = () => {
      if (!input.enabled) setResult(idle);
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [input.enabled, measure]);

  return { result, remeasure: measure };
}
