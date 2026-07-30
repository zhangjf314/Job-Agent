export type OnePageFitStatus =
  | "idle"
  | "measuring"
  | "fits_without_scaling"
  | "fitted"
  | "cannot_fit"
  | "error";

export type OnePageFitResult = {
  status: OnePageFitStatus;
  selectedScale: number;
  originalHeight: number;
  fittedHeight: number;
  overflowAmount: number;
};

export const ONE_PAGE_FIT_LIMITS = {
  minimumScale: 0.88,
  maximumScale: 1,
  maximumIterations: 12,
  precision: 0.002,
  safetyBufferMm: 2,
  minimumBodyFontPt: 9,
  minimumLineHeight: 1.15,
  minimumMarginMm: 8,
} as const;

export function calculateOnePageFit(input: {
  contentHeight: number;
  availableHeight: number;
  minimumScale?: number;
  maximumScale?: number;
  maximumIterations?: number;
  precision?: number;
}): OnePageFitResult {
  const minimumScale = input.minimumScale ?? ONE_PAGE_FIT_LIMITS.minimumScale;
  const maximumScale = input.maximumScale ?? ONE_PAGE_FIT_LIMITS.maximumScale;
  const maximumIterations =
    input.maximumIterations ?? ONE_PAGE_FIT_LIMITS.maximumIterations;
  const precision = input.precision ?? ONE_PAGE_FIT_LIMITS.precision;
  if (
    !Number.isFinite(input.contentHeight) ||
    !Number.isFinite(input.availableHeight) ||
    input.contentHeight <= 0 ||
    input.availableHeight <= 0 ||
    minimumScale <= 0 ||
    maximumScale < minimumScale
  ) {
    return {
      status: "error",
      selectedScale: 1,
      originalHeight: input.contentHeight,
      fittedHeight: input.contentHeight,
      overflowAmount: Math.max(0, input.contentHeight - input.availableHeight),
    };
  }
  if (input.contentHeight <= input.availableHeight) {
    return {
      status: "fits_without_scaling",
      selectedScale: 1,
      originalHeight: input.contentHeight,
      fittedHeight: input.contentHeight,
      overflowAmount: 0,
    };
  }
  if (input.contentHeight * minimumScale > input.availableHeight) {
    return {
      status: "cannot_fit",
      selectedScale: minimumScale,
      originalHeight: input.contentHeight,
      fittedHeight: input.contentHeight * minimumScale,
      overflowAmount: input.contentHeight * minimumScale - input.availableHeight,
    };
  }

  let low = minimumScale;
  let high = maximumScale;
  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    if (high - low <= precision) break;
    const middle = (low + high) / 2;
    if (input.contentHeight * middle <= input.availableHeight) low = middle;
    else high = middle;
  }
  const selectedScale = Math.floor((low + Number.EPSILON) * 1000) / 1000;
  const fittedHeight = input.contentHeight * selectedScale;
  return {
    status: "fitted",
    selectedScale,
    originalHeight: input.contentHeight,
    fittedHeight,
    overflowAmount: Math.max(0, fittedHeight - input.availableHeight),
  };
}
