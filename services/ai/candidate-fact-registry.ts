import type { ResumeProfile } from "@/services/resume-generator";
import type { JDAnalysisResult } from "@/types/jd";

export type CandidateFactCategory =
  | "education"
  | "skill"
  | "project"
  | "project_technology"
  | "project_responsibility"
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
  employment: "EMP",
  internship: "INT",
  award: "AWD",
  metric: "MET",
  achievement: "ACH",
};

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
  return sorted.map((row) => {
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
  return facts.map((fact) => `[${fact.id}] ${fact.text}`).join("\n");
}

export function formatJobRequirementsForPrompt(facts: JobRequirementFact[]) {
  return facts.map((fact) => `[${fact.id}] ${fact.text}`).join("\n");
}
