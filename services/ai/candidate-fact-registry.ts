import { createHash } from "node:crypto";
import type { ResumeProfile } from "@/services/resume-generator";
import { projectStableKey } from "@/services/project-facts/project-fact-atomizer";
import type {
  ProjectAssertionStrength,
  ProjectFactCategory,
} from "@/types/project-facts";
import type { JDAnalysisResult } from "@/types/jd";
import type {
  GROUNDED_SECTION_TYPES_BY_POSITION,
} from "./grounded-tailored-resume-contract";

export type CandidateFactCategory =
  | "education"
  | "skill"
  | "project"
  | "project_technology"
  | "project_responsibility"
  | "project_atom"
  | "employment"
  | "internship"
  | "award"
  | "metric"
  | "achievement";

export type CandidateFact = {
  id: string;
  category: CandidateFactCategory;
  text: string;
  canonicalTerms: string[];
  project?: {
    internalProjectId: string;
    projectReference: string;
    projectStableKey: string;
    atomStableKey: string;
    category: ProjectFactCategory;
    assertionStrength: ProjectAssertionStrength;
    projectType: string | null;
    role: string | null;
    startDate: string | null;
    endDate: string | null;
    displayOrder: number;
    renderable: boolean;
  };
};

export type ProjectCandidateFact = CandidateFact & {
  project: NonNullable<CandidateFact["project"]>;
};

export type GroundedSectionType =
  (typeof GROUNDED_SECTION_TYPES_BY_POSITION)[number];

export type CandidateFactRenderDescriptor = {
  factId: string;
  category: CandidateFactCategory;
  shortLabel: string;
  safePhrase: string;
  sectionEligibility: GroundedSectionType[];
  renderGroup: string;
  renderable: boolean;
};

export type JobRequirementFact = {
  id: string;
  text: string;
  canonicalTerms: string[];
};

const prefixes: Record<CandidateFactCategory, string> = {
  education: "EDU",
  skill: "SKL",
  project: "PRJ",
  project_technology: "TEC",
  project_responsibility: "TSK",
  project_atom: "PROJECT",
  employment: "EMP",
  internship: "INT",
  award: "AWD",
  metric: "MET",
  achievement: "ACH",
};

function stableReference(prefix: string, value: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 12).toUpperCase()}`;
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function isProjectCandidateFact(fact: CandidateFact): fact is ProjectCandidateFact {
  return fact.category === "project_atom" && Boolean(fact.project);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function key(value: string) {
  return clean(value).toLocaleLowerCase("zh-CN");
}

export function canonicalTerms(value: string) {
  const normalized = clean(value);
  const technicalTokens = normalized.match(/[A-Za-z][A-Za-z0-9.+#-]*/g) ?? [];
  const tokens = normalized
    .split(/[\s,，、;；/|()[\]（）:：]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return [...new Set([normalized, ...tokens, ...technicalTokens].map(key).filter(Boolean))].sort();
}

function hasMetric(value: string) {
  return /\d+(?:\.\d+)?(?:%|％|人|元|万|小时|天|周|月|年|ms|秒|次|个|名|条|请求|用户|并发)/i.test(value);
}

export function buildCandidateFactRegistry(
  profile: ResumeProfile,
  baseResumeMarkdown = "",
): CandidateFact[] {
  const rows: Array<{ category: CandidateFactCategory; text: string }> = [];
  const projectFacts: ProjectCandidateFact[] = [];
  const add = (category: CandidateFactCategory, value: unknown) => {
    const text = clean(value);
    if (text) rows.push({ category, text });
  };

  for (const education of profile.educationItems ?? []) {
    add(
      "education",
      [education.school, education.major, education.degree].map(clean).filter(Boolean).join(" · "),
    );
    for (const honor of education.honors ?? []) add("award", honor);
  }
  for (const skill of profile.skillItems ?? []) {
    add("skill", [skill.name, skill.level].map(clean).filter(Boolean).join(" · "));
  }
  for (const project of profile.projectItems ?? []) {
    add("project", project.name);
    const atoms = [...(project.factAtoms ?? [])].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.stableKey.localeCompare(b.stableKey),
    );
    if (atoms.length > 0) {
      const stableKey = clean(project.stableKey) || projectStableKey(project.name);
      const projectReference = stableReference("P_PROJECT", stableKey);
      for (const atom of atoms) {
        const text = clean(atom.canonicalText);
        if (!text) continue;
        projectFacts.push({
          id: stableReference("F_PROJECT", `${stableKey}:${atom.stableKey}`),
          category: "project_atom",
          text,
          canonicalTerms: canonicalTerms(text),
          project: {
            internalProjectId: project.id,
            projectReference,
            projectStableKey: stableKey,
            atomStableKey: atom.stableKey,
            category: atom.category,
            assertionStrength: atom.assertionStrength,
            projectType: clean(project.projectType) || null,
            role: clean(project.role) || null,
            startDate: dateValue(project.startDate),
            endDate: dateValue(project.endDate),
            displayOrder: atom.displayOrder,
            renderable: atom.renderable,
          },
        });
      }
      continue;
    }
    for (const technology of project.techStack ?? []) {
      add("project_technology", `${clean(project.name)}使用${clean(technology)}`);
    }
    for (const responsibility of project.responsibilities ?? []) {
      add("project_responsibility", `${clean(project.name)}：${clean(responsibility)}`);
    }
    for (const highlight of project.highlights ?? []) {
      add(hasMetric(highlight) ? "metric" : "achievement", `${clean(project.name)}：${clean(highlight)}`);
    }
    if (project.results) {
      add(hasMetric(project.results) ? "metric" : "achievement", `${clean(project.name)}：${clean(project.results)}`);
    }
    for (const metric of project.metrics ?? []) add("metric", `${clean(project.name)}：${clean(metric)}`);
  }
  for (const experience of profile.experienceItems ?? []) {
    const category: CandidateFactCategory = /实习|intern/i.test(clean(experience.role))
      ? "internship"
      : "employment";
    add(category, [experience.company, experience.role].map(clean).filter(Boolean).join(" · "));
    for (const responsibility of experience.responsibilities ?? []) {
      add(category, `${clean(experience.company)}：${clean(responsibility)}`);
    }
    for (const achievement of experience.achievements ?? []) {
      add(hasMetric(achievement) ? "metric" : "achievement", `${clean(experience.company)}：${clean(achievement)}`);
    }
    for (const metric of experience.metrics ?? []) add("metric", `${clean(experience.company)}：${clean(metric)}`);
  }
  for (const award of profile.awardItems ?? []) {
    add("award", [award.name, award.level, award.issuer].map(clean).filter(Boolean).join(" · "));
  }
  for (const certificate of profile.certificateItems ?? []) {
    add("achievement", [certificate.name, certificate.issuer].map(clean).filter(Boolean).join(" · "));
  }

  // A base resume may repeat profile facts but must never introduce a new source of truth.
  // Matching terms are attached to the existing structured facts; unmatched prose is ignored.
  const baseKey = key(baseResumeMarkdown);
  const deduped = new Map<string, { category: CandidateFactCategory; text: string }>();
  for (const row of rows) {
    const rowKey = `${row.category}:${key(row.text)}`;
    if (!deduped.has(rowKey)) deduped.set(rowKey, row);
  }
  const sorted = [...deduped.values()].sort((a, b) =>
    a.category.localeCompare(b.category) || key(a.text).localeCompare(key(b.text), "zh-CN"),
  );
  const counters = new Map<CandidateFactCategory, number>();
  const regularFacts = sorted.map((row) => {
    const index = (counters.get(row.category) ?? 0) + 1;
    counters.set(row.category, index);
    const terms = canonicalTerms(row.text);
    const repeatedInBaseResume = terms.filter((term) => term.length >= 3 && baseKey.includes(term));
    return {
      id: `F_${prefixes[row.category]}_${String(index).padStart(3, "0")}`,
      category: row.category,
      text: row.text,
      canonicalTerms: [...new Set([...terms, ...repeatedInBaseResume])].sort(),
    };
  });
  return [...regularFacts, ...projectFacts];
}

export function buildJobRequirementFacts(
  jd: JDAnalysisResult,
  candidateFacts: CandidateFact[],
): JobRequirementFact[] {
  const candidateTerms = new Set(candidateFacts.flatMap((fact) => fact.canonicalTerms));
  const explicitGapKeys = new Set(jd.gaps.map(key));
  const candidateHasAIOrLLM = candidateFacts.some((fact) => /ai|llm|openai|大模型|人工智能/i.test(fact.text));
  const requirements = [
    ...jd.coreResponsibilities,
    ...jd.hardSkills,
    ...jd.experienceRequirements,
    ...jd.educationRequirements,
    ...jd.keywords,
    ...jd.gaps,
  ].map(clean).filter(Boolean);
  const unique = [...new Map(requirements.map((text) => [key(text), text])).values()].sort((a, b) =>
    key(a).localeCompare(key(b), "zh-CN"),
  );
  return unique
    .filter((text) => {
      if (explicitGapKeys.has(key(text))) return true;
      if (/ai|llm|openai|大模型|人工智能/i.test(text) && !candidateHasAIOrLLM) return true;
      const terms = canonicalTerms(text);
      return !terms.some((term) => candidateTerms.has(term));
    })
    .map((text, index) => ({
      id: `J_REQ_${String(index + 1).padStart(3, "0")}`,
      text,
      canonicalTerms: canonicalTerms(text),
    }));
}

export function formatFactRegistryForPrompt(facts: CandidateFact[]) {
  return facts
    .filter((fact) => !isProjectCandidateFact(fact))
    .map((fact) => `[${fact.id}] ${fact.text}`)
    .join("\n");
}

export const PROJECT_PROMPT_LIMITS = {
  maxProjects: 6,
  maxAtomsPerProject: 12,
  maxAtomsTotal: 40,
} as const;

export type ProjectPromptSelection = {
  facts: ProjectCandidateFact[];
  projectCount: number;
  omittedProjectCount: number;
  omittedAtomCount: number;
};

export function selectProjectFactsForPrompt(
  facts: CandidateFact[],
): ProjectPromptSelection {
  const grouped = new Map<string, ProjectCandidateFact[]>();
  for (const fact of facts) {
    if (!isProjectCandidateFact(fact) || !fact.project.renderable) continue;
    const group = grouped.get(fact.project.projectReference) ?? [];
    group.push(fact);
    grouped.set(fact.project.projectReference, group);
  }
  const projects = [...grouped.values()];
  const selected: ProjectCandidateFact[] = [];
  let omittedAtomCount = 0;
  for (const projectFacts of projects.slice(0, PROJECT_PROMPT_LIMITS.maxProjects)) {
    const ordered = [...projectFacts].sort(
      (a, b) =>
        a.project.displayOrder - b.project.displayOrder || a.id.localeCompare(b.id),
    );
    const remaining = PROJECT_PROMPT_LIMITS.maxAtomsTotal - selected.length;
    const count = Math.max(0, Math.min(PROJECT_PROMPT_LIMITS.maxAtomsPerProject, remaining));
    selected.push(...ordered.slice(0, count));
    omittedAtomCount += ordered.length - count;
  }
  for (const projectFacts of projects.slice(PROJECT_PROMPT_LIMITS.maxProjects)) {
    omittedAtomCount += projectFacts.length;
  }
  return {
    facts: selected,
    projectCount: new Set(selected.map((fact) => fact.project.projectReference)).size,
    omittedProjectCount: Math.max(0, projects.length - PROJECT_PROMPT_LIMITS.maxProjects),
    omittedAtomCount,
  };
}

export function formatProjectFactsForPrompt(facts: ProjectCandidateFact[]) {
  const grouped = new Map<string, ProjectCandidateFact[]>();
  for (const fact of facts) {
    const group = grouped.get(fact.project.projectReference) ?? [];
    group.push(fact);
    grouped.set(fact.project.projectReference, group);
  }
  return [...grouped.values()]
    .map((projectFacts) => {
      const project = projectFacts[0].project;
      const header = [
        `[${project.projectReference}]`,
        `type=${project.projectType ?? "未填写"}`,
        `role=${project.role ?? "未填写"}`,
        `dates=${project.startDate ?? "未填写"}..${project.endDate ?? "至今"}`,
      ].join(" ");
      const lines = [...projectFacts]
        .sort((a, b) => a.project.displayOrder - b.project.displayOrder || a.id.localeCompare(b.id))
        .map(
          (fact) =>
            `[${fact.id}] category=${fact.project.category} strength=${fact.project.assertionStrength} fact=${fact.text}`,
        );
      return [header, ...lines].join("\n");
    })
    .join("\n\n");
}

export function formatJobRequirementsForPrompt(facts: JobRequirementFact[]) {
  return facts.map((fact) => `[${fact.id}] ${fact.text}`).join("\n");
}

const sectionEligibilityByCategory: Record<
  CandidateFactCategory,
  GroundedSectionType[]
> = {
  education: ["summary", "education"],
  skill: ["summary", "skills"],
  project: ["summary", "projects"],
  project_technology: ["summary", "skills", "projects"],
  project_responsibility: ["summary", "projects"],
  project_atom: ["projects"],
  employment: ["summary", "experiences"],
  internship: ["summary", "experiences"],
  award: ["summary", "others"],
  metric: ["summary", "projects", "experiences", "others"],
  achievement: ["summary", "projects", "experiences", "others"],
};

function renderGroup(fact: CandidateFact) {
  if (isProjectCandidateFact(fact)) return `project:${fact.project.projectReference}`;
  const category = fact.category;
  if (category === "skill" || category === "project_technology") {
    return "skills";
  }
  if (
    category === "project" ||
    category === "project_responsibility" ||
    category === "metric" ||
    category === "achievement"
  ) {
    return "projects";
  }
  if (category === "employment" || category === "internship") {
    return "experiences";
  }
  return category;
}

/**
 * Builds non-persistent render metadata exclusively from the structured
 * candidate registry. JD text and model output are intentionally absent.
 */
export function buildCandidateFactRenderDescriptors(
  facts: CandidateFact[],
): CandidateFactRenderDescriptor[] {
  return facts.map((fact) => {
    const safePhrase = clean(fact.text);
    return {
      factId: fact.id,
      category: fact.category,
      shortLabel: fact.category,
      safePhrase,
      sectionEligibility: [...sectionEligibilityByCategory[fact.category]],
      renderGroup: renderGroup(fact),
      renderable:
        (!isProjectCandidateFact(fact) || fact.project.renderable) &&
        safePhrase.length > 0 &&
        safePhrase.length <= 80 &&
        !/[\r\n]/.test(safePhrase),
    };
  });
}
