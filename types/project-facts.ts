export const projectFactCategories = [
  "background",
  "goal",
  "role",
  "technology",
  "feature",
  "responsibility",
  "challenge",
  "solution",
  "engineering",
  "result",
  "metric",
] as const;

export const projectAssertionStrengths = [
  "learned",
  "used",
  "implemented",
  "designed",
  "led",
  "achieved",
] as const;

export type ProjectFactCategory = (typeof projectFactCategories)[number];
export type ProjectAssertionStrength =
  (typeof projectAssertionStrengths)[number];

export type ProjectFactAtomValue = {
  id?: string;
  projectId: string;
  stableKey: string;
  category: ProjectFactCategory;
  canonicalText: string;
  sourceField: string | null;
  sourceOrder: number | null;
  displayOrder: number;
  assertionStrength: ProjectAssertionStrength;
  renderable: boolean;
};
