export const smokeCases = [
  "connection",
  "jd-analysis",
  "tailored-resume",
  "career-strategy",
] as const;

export type SmokeCase = (typeof smokeCases)[number];

export type SmokeArguments = {
  selected: Set<SmokeCase>;
  maxExternalRequests?: number;
};

export function parseSmokeArguments(args: string[]): SmokeArguments {
  const onlyArguments = args.filter((arg) => arg.startsWith("--only="));
  const maxArguments = args.filter((arg) => arg.startsWith("--max-external-requests="));
  const unsupportedArguments = args.filter(
    (arg) =>
      !arg.startsWith("--only=") &&
      !arg.startsWith("--max-external-requests="),
  );
  if (
    unsupportedArguments.length > 0 ||
    onlyArguments.length > 1 ||
    maxArguments.length > 1
  ) {
    throw new Error(
      "Smoke accepts only --only=<comma-separated-whitelist> and --max-external-requests=<1..6>.",
    );
  }
  let selected = new Set<SmokeCase>(smokeCases);
  if (onlyArguments.length === 1) {
    const values = onlyArguments[0].slice("--only=".length).split(",").map((value) => value.trim()).filter(Boolean);
    if (values.length === 0) throw new Error("Smoke --only selection cannot be empty.");
    const allowed = new Set<string>(smokeCases);
    const invalid = values.filter((value) => !allowed.has(value));
    if (invalid.length > 0) {
      throw new Error(`Unsupported smoke case: ${invalid.join(", ")}.`);
    }
    selected = new Set(values as SmokeCase[]);
  }
  const rawMax = maxArguments[0]?.slice("--max-external-requests=".length);
  const maxExternalRequests = rawMax === undefined ? undefined : Number(rawMax);
  if (
    rawMax !== undefined &&
    (!/^[1-6]$/.test(rawMax) || !Number.isSafeInteger(maxExternalRequests))
  ) {
    throw new Error("Smoke --max-external-requests must be a safe integer from 1 to 6.");
  }
  return { selected, maxExternalRequests };
}

export function parseSmokeSelection(args: string[]): Set<SmokeCase> {
  return parseSmokeArguments(args).selected;
}

export function smokeRequestBudget(
  selected: Set<SmokeCase>,
  explicitMaximum?: number,
) {
  return explicitMaximum ??
    (selected.size === 1 && selected.has("tailored-resume") ? 2 : 6);
}

export function smokeRequestPolicy(explicitMaximum?: number) {
  if (explicitMaximum === undefined) return undefined;
  return {
    allowTransportRetry: false,
    allowJsonRepair: false,
    allowFactualityRepair: explicitMaximum > 1,
    allowFinalizationRetry: false,
  };
}
