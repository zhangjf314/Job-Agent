import { createHash } from "node:crypto";
import type {
  ProjectAssertionStrength,
  ProjectFactCategory,
  ProjectFactAtomValue,
} from "@/types/project-facts";

export type AtomizableProject = {
  id: string;
  stableKey: string;
  projectType?: string | null;
  role?: string | null;
  background?: string | null;
  goal?: string | null;
  fullDescription?: string | null;
  responsibilities?: string[];
  techStack?: string[];
  highlights?: string[];
  challenges?: string[];
  solutions?: string[];
  engineeringPractices?: string[];
  results?: string | null;
  metrics?: string[];
};

type DraftAtom = Omit<ProjectFactAtomValue, "stableKey" | "displayOrder">;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function projectStableKey(name: string, duplicateNumber = 1) {
  const base = `project:${digest(clean(name).toLocaleLowerCase("zh-CN"))}`;
  return duplicateNumber > 1 ? `${base}:${duplicateNumber}` : base;
}

export function projectAtomStableKey(
  category: ProjectFactCategory,
  canonicalText: string,
) {
  const normalized = clean(canonicalText).toLocaleLowerCase("zh-CN");
  const readable = normalized
    .replace(/[^a-z0-9+#.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return `${category}:${readable || digest(normalized)}`;
}

function strengthFor(category: ProjectFactCategory): ProjectAssertionStrength {
  if (category === "technology") return "used";
  if (category === "background" || category === "goal" || category === "role") {
    return "learned";
  }
  if (category === "result" || category === "metric") return "achieved";
  if (category === "challenge") return "used";
  if (category === "solution" || category === "engineering") return "designed";
  return "implemented";
}

function bulletLines(value: string | null | undefined) {
  if (!value?.trim()) return [];
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

export function atomizeProject(project: AtomizableProject) {
  const drafts: DraftAtom[] = [];
  const add = (
    category: ProjectFactCategory,
    value: unknown,
    sourceField: string,
    sourceOrder: number | null,
    renderable = true,
  ) => {
    const canonicalText = clean(value);
    if (!canonicalText) return;
    drafts.push({
      projectId: project.id,
      category,
      canonicalText,
      sourceField,
      sourceOrder,
      assertionStrength: strengthFor(category),
      renderable,
    });
  };
  const addList = (
    category: ProjectFactCategory,
    values: string[] | undefined,
    sourceField: string,
  ) => (values ?? []).forEach((value, index) =>
    add(category, value, sourceField, index));

  add("background", project.background, "background", null);
  add("goal", project.goal, "goal", null);
  add("role", project.role, "role", null);
  addList("technology", project.techStack, "techStack");
  addList("responsibility", project.responsibilities, "responsibilities");
  addList("feature", project.highlights, "highlights");
  addList("challenge", project.challenges, "challenges");
  addList("solution", project.solutions, "solutions");
  addList("engineering", project.engineeringPractices, "engineeringPractices");
  add("result", project.results, "results", null);
  addList("metric", project.metrics, "metrics");

  const importedBullets = bulletLines(project.fullDescription);
  importedBullets.forEach((value, index) =>
    add("responsibility", value, "fullDescription", index));
  if (
    clean(project.fullDescription) &&
    importedBullets.length === 0
  ) {
    add(
      "background",
      project.fullDescription,
      "fullDescription",
      null,
      false,
    );
  }

  const unique = new Map<string, DraftAtom>();
  for (const draft of drafts) {
    const duplicateKey = `${draft.category}:${clean(draft.canonicalText).toLocaleLowerCase("zh-CN")}`;
    if (!unique.has(duplicateKey)) unique.set(duplicateKey, draft);
  }
  return [...unique.values()].map((draft, displayOrder) => ({
    ...draft,
    stableKey: projectAtomStableKey(draft.category, draft.canonicalText),
    displayOrder,
  }));
}
