import type { CandidateFact, JobRequirementFact } from "./candidate-fact-registry";
import { AppError } from "@/lib/errors";
import {
  groundedClaimEntries,
  type GroundedTailoredResume,
  type GroundedText,
} from "./tailored-resume-grounding";

export type FactualityStatus = "pass" | "fail" | "review";

export type FactualityViolationCategory =
  | "UNKNOWN_FACT_ID"
  | "MISSING_FACT_SOURCE"
  | "UNSUPPORTED_SKILL"
  | "INVENTED_EMPLOYMENT"
  | "INVENTED_INTERNSHIP"
  | "INVENTED_AWARD"
  | "INVENTED_AI_PROJECT"
  | "INVENTED_LLM_EXPERIENCE"
  | "INVENTED_METRIC"
  | "JD_REQUIREMENT_AS_FACT"
  | "FACT_STRENGTH_ESCALATION";

export type FactualityViolation = {
  category: FactualityViolationCategory;
  path: string;
  safeSummary: string;
  severity: "fail" | "review";
};

export type FactualityReport = {
  status: FactualityStatus;
  violations: FactualityViolation[];
  groundedClaimCount: number;
  ungroundedClaimCount: number;
  unknownFactIds: number;
  missingSourceIds: number;
};

const goalLanguage = /目标|求职|希望|计划|学习|未来|后续|可迁移|可用于|希望从事|面向/;
const assertiveLanguage = /已|完成|负责|主导|开发过|接入|掌握|熟悉|精通|具备|拥有|实践|经验|实战|生产|独立/;
const completedAssertion = /已经|已完成|完成过|开发过|掌握|熟悉|精通|具备|拥有|主导|实战经验|生产实践/;
const strengthLanguage = /精通|熟练|丰富.{0,4}经验|生产实践|独立负责|主导|实战经验|专家/;
const llmTerms = /LLM|OpenAI|大模型|语言模型/i;
const aiProjectTerms = /AI\s*项目|AI\s*应用|人工智能项目|大模型应用|大模型项目/i;
const metricPattern = /\d+(?:\.\d+)?(?:%|％|人|元|万|小时|天|周|月|年|ms|秒|次|个|名|条|请求|用户|并发)/i;

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function violation(
  category: FactualityViolationCategory,
  path: string,
  severity: "fail" | "review",
  safeSummary: string,
): FactualityViolation {
  return { category, path, severity, safeSummary };
}

function factSupportsClaim(fact: CandidateFact, claim: string) {
  const normalizedClaim = normalize(claim);
  return fact.canonicalTerms.some((term) =>
    term.length >= 2 && (normalizedClaim.includes(term) || term.includes(normalizedClaim)),
  );
}

function hasCategory(facts: CandidateFact[], categories: CandidateFact["category"][]) {
  return facts.some((fact) => categories.includes(fact.category));
}

function validateGoalOrFormat(path: string, claim: GroundedText): FactualityViolation[] {
  if (claim.kind === "format") {
    if (claim.sourceFactIds.length > 0 || assertiveLanguage.test(claim.text)) {
      return [violation(
        "MISSING_FACT_SOURCE",
        path,
        "fail",
        "Format-only text contains a factual assertion or a source reference.",
      )];
    }
    return [];
  }
  if (claim.kind === "goal") {
    if (!goalLanguage.test(claim.text)) {
      return [violation(
        "JD_REQUIREMENT_AS_FACT",
        path,
        "review",
        "Goal text is ambiguous and does not clearly use future or goal language.",
      )];
    }
    if (completedAssertion.test(claim.text) && !/可迁移|可用于/.test(claim.text)) {
      return [violation(
        "JD_REQUIREMENT_AS_FACT",
        path,
        "fail",
        "Goal text also asserts completed or existing capability.",
      )];
    }
    return [];
  }
  return [];
}

export function evaluateGroundedClaim(
  path: string,
  claim: GroundedText,
  candidateFacts: CandidateFact[],
  jobRequirements: JobRequirementFact[],
): FactualityViolation[] {
  if (claim.kind !== "fact") return validateGoalOrFormat(path, claim);

  const violations: FactualityViolation[] = [];
  const factById = new Map(candidateFacts.map((fact) => [fact.id, fact]));
  if (claim.sourceFactIds.length === 0) {
    violations.push(violation(
      "MISSING_FACT_SOURCE",
      path,
      "fail",
      "Factual text has no candidate fact source.",
    ));
  }
  const unknownIds = claim.sourceFactIds.filter((id) => !factById.has(id));
  for (const id of unknownIds) {
    violations.push(violation(
      id.startsWith("J_REQ_") ? "JD_REQUIREMENT_AS_FACT" : "UNKNOWN_FACT_ID",
      path,
      "fail",
      id.startsWith("J_REQ_")
        ? "A job requirement ID was used as candidate evidence."
        : "An unknown candidate fact ID was used.",
    ));
  }
  const supportingFacts = claim.sourceFactIds
    .map((id) => factById.get(id))
    .filter((fact): fact is CandidateFact => Boolean(fact));

  if (supportingFacts.length > 0 && !supportingFacts.some((fact) => factSupportsClaim(fact, claim.text))) {
    violations.push(violation(
      "MISSING_FACT_SOURCE",
      path,
      "fail",
      "Referenced candidate facts do not support the generated wording.",
    ));
  }

  const normalizedClaim = normalize(claim.text);
  const candidateTerms = new Set(candidateFacts.flatMap((fact) => fact.canonicalTerms));
  const unsupportedRequirement = jobRequirements.some((requirement) =>
    requirement.canonicalTerms.some((term) =>
      term.length >= 2 && normalizedClaim.includes(term) && !candidateTerms.has(term),
    ),
  );
  if (unsupportedRequirement && assertiveLanguage.test(claim.text) && !goalLanguage.test(claim.text)) {
    violations.push(violation(
      "JD_REQUIREMENT_AS_FACT",
      path,
      "fail",
      "A JD-only requirement is expressed as an existing candidate fact.",
    ));
  }
  if (llmTerms.test(claim.text) && assertiveLanguage.test(claim.text) && !goalLanguage.test(claim.text)) {
    const hasLlmFact = candidateFacts.some((fact) =>
      fact.canonicalTerms.some((term) => /llm|openai|大模型|语言模型/i.test(term)),
    );
    if (!hasLlmFact) {
      violations.push(violation(
        "INVENTED_LLM_EXPERIENCE",
        path,
        "fail",
        "LLM or compatible API experience is asserted without candidate evidence.",
      ));
    }
  }
  if (aiProjectTerms.test(claim.text) && assertiveLanguage.test(claim.text) && !goalLanguage.test(claim.text)) {
    const hasAiProject = candidateFacts.some((fact) =>
      ["project", "project_technology", "project_responsibility"].includes(fact.category) &&
      /ai|人工智能|大模型/i.test(fact.text),
    );
    if (!hasAiProject) {
      violations.push(violation(
        "INVENTED_AI_PROJECT",
        path,
        "fail",
        "AI project experience is asserted without a candidate project fact.",
      ));
    }
  }
  if (metricPattern.test(claim.text)) {
    const supportedMetric = supportingFacts.some((fact) =>
      fact.category === "metric" && metricPattern.test(fact.text) &&
      [...fact.text.matchAll(/\d+(?:\.\d+)?/g)].every((match) => claim.text.includes(match[0])),
    );
    if (!supportedMetric) {
      violations.push(violation(
        "INVENTED_METRIC",
        path,
        "fail",
        "A quantitative claim has no matching metric fact.",
      ));
    }
  }
  if (strengthLanguage.test(claim.text) && !supportingFacts.some((fact) => strengthLanguage.test(fact.text))) {
    violations.push(violation(
      "FACT_STRENGTH_ESCALATION",
      path,
      "fail",
      "Candidate capability strength was escalated beyond its source fact.",
    ));
  }
  if (/实习/.test(claim.text) && assertiveLanguage.test(claim.text) &&
      !hasCategory(supportingFacts, ["internship"])) {
    violations.push(violation(
      "INVENTED_INTERNSHIP",
      path,
      "fail",
      "Internship experience is asserted without an internship fact.",
    ));
  }
  if (/任职|就职|工作于|公司经历|企业经历/.test(claim.text) &&
      !hasCategory(supportingFacts, ["employment", "internship"])) {
    violations.push(violation(
      "INVENTED_EMPLOYMENT",
      path,
      "fail",
      "Employment is asserted without an employment fact.",
    ));
  }
  if (/获奖|荣获|奖项|竞赛奖/.test(claim.text) && !hasCategory(supportingFacts, ["award"])) {
    violations.push(violation(
      "INVENTED_AWARD",
      path,
      "fail",
      "An award is asserted without an award fact.",
    ));
  }

  const knownSkillTerms = candidateFacts
    .filter((fact) => ["skill", "project_technology"].includes(fact.category))
    .flatMap((fact) => fact.canonicalTerms);
  const jdOnlySkills = jobRequirements.flatMap((fact) => fact.canonicalTerms)
    .filter((term) => !candidateTerms.has(term));
  if (
    assertiveLanguage.test(claim.text) &&
    jdOnlySkills.some((term) => term.length >= 2 && normalizedClaim.includes(term)) &&
    !knownSkillTerms.some((term) => term.length >= 2 && normalizedClaim.includes(term))
  ) {
    violations.push(violation(
      "UNSUPPORTED_SKILL",
      path,
      "fail",
      "A skill is asserted without candidate skill or project evidence.",
    ));
  }
  return violations;
}

export function evaluateTailoredResumeFactuality(
  input: GroundedTailoredResume,
  candidateFacts: CandidateFact[],
  jobRequirements: JobRequirementFact[],
): FactualityReport {
  const entries = groundedClaimEntries(input);
  const violations = entries.flatMap(({ path, claim }) =>
    evaluateGroundedClaim(path, claim, candidateFacts, jobRequirements),
  );
  const failCount = violations.filter((item) => item.severity === "fail").length;
  const reviewCount = violations.filter((item) => item.severity === "review").length;
  const ungroundedPaths = new Set(
    violations
      .filter((item) => item.severity === "fail")
      .map((item) => item.path),
  );
  return {
    status: failCount > 0 ? "fail" : reviewCount > 0 ? "review" : "pass",
    violations,
    groundedClaimCount: entries.length - ungroundedPaths.size,
    ungroundedClaimCount: ungroundedPaths.size,
    unknownFactIds: violations.filter((item) => item.category === "UNKNOWN_FACT_ID").length,
    missingSourceIds: violations.filter((item) => item.category === "MISSING_FACT_SOURCE").length,
  };
}

export class TailoredResumeFactualityError extends AppError {
  public diagnostics?: unknown;

  constructor(public readonly report: FactualityReport) {
    super(
      "定制简历包含无法由候选人事实支持的内容，已阻止保存。",
      "TAILORED_RESUME_FACTUALITY_VIOLATION",
    );
    this.name = "TailoredResumeFactualityError";
  }
}
