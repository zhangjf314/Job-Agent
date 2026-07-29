export const smokeCases = [
  "connection",
  "jd-analysis",
  "tailored-resume",
  "career-strategy",
] as const;

export type SmokeCase = (typeof smokeCases)[number];

export function parseSmokeSelection(args: string[]): Set<SmokeCase> {
  const onlyArguments = args.filter((arg) => arg.startsWith("--only="));
  const unsupportedArguments = args.filter((arg) => !arg.startsWith("--only="));
  if (unsupportedArguments.length > 0 || onlyArguments.length > 1) {
    throw new Error("Smoke accepts only one optional --only=<comma-separated-whitelist> argument.");
  }
  if (onlyArguments.length === 0) return new Set(smokeCases);
  const values = onlyArguments[0].slice("--only=".length).split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) throw new Error("Smoke --only selection cannot be empty.");
  const allowed = new Set<string>(smokeCases);
  const invalid = values.filter((value) => !allowed.has(value));
  if (invalid.length > 0) {
    throw new Error(`Unsupported smoke case: ${invalid.join(", ")}.`);
  }
  return new Set(values as SmokeCase[]);
}

export function smokeRequestBudget(selected: Set<SmokeCase>) {
  return selected.size === 1 && selected.has("tailored-resume") ? 2 : 6;
}
