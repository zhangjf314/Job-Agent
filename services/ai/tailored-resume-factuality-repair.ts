import { z } from "zod";
import { AppError } from "@/lib/errors";
import type {
  CandidateFact,
  JobRequirementFact,
} from "./candidate-fact-registry";
import type { ChatMessage } from "./llm-client";
import {
  groundedTailoredResumeSchema,
  groundedTextSchema,
  type GroundedTailoredResume,
  type GroundedText,
} from "./tailored-resume-grounding";
import type {
  FactualityReport,
  FactualityViolation,
  FactualityViolationCategory,
} from "./tailored-resume-factuality";

export type FactualityRepairErrorCode =
  | "UNSUPPORTED_FACTUALITY_REPAIR_TARGET"
  | "FACTUALITY_REPAIR_RESPONSE_INVALID"
  | "FACTUALITY_REPAIR_TARGET_MISSING"
  | "FACTUALITY_REPAIR_TARGET_UNKNOWN"
  | "FACTUALITY_REPAIR_TARGET_DUPLICATED"
  | "FACTUALITY_REPAIR_SCOPE_VIOLATION"
  | "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID"
  | "FACTUALITY_REPAIR_INTRODUCED_NEW_VIOLATION"
  | "FACTUALITY_REPAIR_INCOMPLETE";

export class FactualityRepairError extends AppError {
  constructor(
    code: FactualityRepairErrorCode,
    message = "定制简历事实修复未能安全完成。",
  ) {
    super(message, code);
  }
}

export type FactualityRepairLocationKind =
  | "section_line"
  | "self_introduction"
  | "application_email"
  | "recruiter_message";

export type FactualityRepairTarget = {
  targetId: string;
  path: string;
  categories: FactualityViolationCategory[];
  locationKind: FactualityRepairLocationKind;
  sectionType: GroundedTailoredResume["sections"][number]["type"] | null;
  removalAllowed: false;
  current: GroundedText;
};

export const factualityRepairPatchSchema = z.object({
  repairs: z.array(
    z.object({
      targetId: z.string().trim().min(1),
      action: z.literal("replace"),
      replacement: groundedTextSchema,
    }).strict(),
  ),
}).strict();

export type FactualityRepairPatch = z.infer<typeof factualityRepairPatchSchema>;

export type FactualityRepairSummary = {
  factualityViolationCountBeforeRepair: number;
  factualityRepairTargetCount: number;
  factualityRepairPatchCount: number;
  factualityRepairApplied: boolean;
  factualityViolationCountAfterRepair: number;
  factualityViolationsResolved: number;
  factualityViolationsIntroduced: number;
  factualityRepairRemainingCategories: FactualityViolationCategory[];
  factualityRepairScopeViolation: boolean;
  factualityRepairTargetPaths: string[];
  factualityRepairTargetCategories: FactualityViolationCategory[];
  factualityRepairFailureCategory?: FactualityRepairErrorCode;
};

type ParsedTargetPath =
  | {
      family: "section";
      sectionIndex: number;
      itemIndex: number;
      locationKind: "section_line";
      sortKey: [number, number, number];
    }
  | {
      family: "application";
      material:
        | "selfIntroduction"
        | "applicationEmail"
        | "recruiterMessage";
      itemIndex: number;
      locationKind:
        | "self_introduction"
        | "application_email"
        | "recruiter_message";
      sortKey: [number, number, number];
    };

const applicationMaterialOrder = {
  selfIntroduction: 0,
  applicationEmail: 1,
  recruiterMessage: 2,
} as const;

function parseTargetPath(path: string): ParsedTargetPath | null {
  const sectionMatch = path.match(/^sections\.(\d+)\.lines\.(\d+)$/);
  if (sectionMatch) {
    const sectionIndex = Number(sectionMatch[1]);
    const itemIndex = Number(sectionMatch[2]);
    return {
      family: "section",
      sectionIndex,
      itemIndex,
      locationKind: "section_line",
      sortKey: [0, sectionIndex, itemIndex],
    };
  }
  const materialMatch = path.match(
    /^applicationMaterials\.(selfIntroduction|applicationEmail|recruiterMessage)\.(\d+)$/,
  );
  if (!materialMatch) return null;
  const material = materialMatch[1] as keyof typeof applicationMaterialOrder;
  const itemIndex = Number(materialMatch[2]);
  const locationKinds = {
    selfIntroduction: "self_introduction",
    applicationEmail: "application_email",
    recruiterMessage: "recruiter_message",
  } as const;
  return {
    family: "application",
    material,
    itemIndex,
    locationKind: locationKinds[material],
    sortKey: [1, applicationMaterialOrder[material], itemIndex],
  };
}

function resolveClaim(
  input: GroundedTailoredResume,
  path: string,
): {
  claim: GroundedText;
  parsedPath: ParsedTargetPath;
  sectionType: FactualityRepairTarget["sectionType"];
} | null {
  const parsedPath = parseTargetPath(path);
  if (!parsedPath) return null;
  if (parsedPath.family === "section") {
    const section = input.sections[parsedPath.sectionIndex];
    const claim = section?.lines[parsedPath.itemIndex];
    return section && claim
      ? { claim, parsedPath, sectionType: section.type }
      : null;
  }
  const claim = input.applicationMaterials[parsedPath.material][parsedPath.itemIndex];
  return claim ? { claim, parsedPath, sectionType: null } : null;
}

function compareParsedPaths(left: ParsedTargetPath, right: ParsedTargetPath) {
  for (let index = 0; index < left.sortKey.length; index += 1) {
    const difference = left.sortKey[index] - right.sortKey[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

export function buildFactualityRepairTargets(
  input: GroundedTailoredResume,
  violations: FactualityViolation[],
): FactualityRepairTarget[] {
  const grouped = new Map<string, FactualityViolationCategory[]>();
  for (const item of violations) {
    const categories = grouped.get(item.path) ?? [];
    if (!categories.includes(item.category)) categories.push(item.category);
    grouped.set(item.path, categories);
  }

  const resolved = [...grouped.entries()].map(([path, categories]) => {
    const target = resolveClaim(input, path);
    if (!target) {
      throw new FactualityRepairError(
        "UNSUPPORTED_FACTUALITY_REPAIR_TARGET",
        "事实违规路径不属于允许的定制简历文本节点。",
      );
    }
    return { path, categories: [...categories].sort(), ...target };
  }).sort((left, right) => compareParsedPaths(left.parsedPath, right.parsedPath));

  return resolved.map((item, index) => ({
    targetId: `T${index + 1}`,
    path: item.path,
    categories: item.categories,
    locationKind: item.parsedPath.locationKind,
    sectionType: item.sectionType,
    removalAllowed: false,
    current: structuredClone(item.claim),
  }));
}

export function buildFactualityRepairOutputContract(
  targets: FactualityRepairTarget[],
) {
  return [
    'Return exactly {"repairs":[{"targetId":"T1","action":"replace","replacement":{"text":"...","sourceFactIds":["F_..."],"kind":"fact|goal|format"}}]}.',
    `Exactly once each:${targets.map((target) => target.targetId).join(",")}.`,
    "No extra IDs,paths,fields,full resume,Markdown,or explanation.",
    "replacement is GroundedText:text 1..80 chars,sourceFactIds max8 supplied F_*,kind fact|goal|format.",
  ].join(" ");
}

export function buildFactualityRepairMessages(
  candidateFacts: CandidateFact[],
  jobRequirements: JobRequirementFact[],
  targets: FactualityRepairTarget[],
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Patch only the supplied targets, each exactly once.",
        "Only F_* candidate facts prove existing capability or completed work; J_REQ_* are job requirements and never evidence.",
        "For JD_REQUIREMENT_AS_FACT remove the unsupported clause, or rewrite solely from F_* facts.",
        "Never invent AI/LLM/API or production experience, projects, jobs, internships, awards, metrics, skills, or stronger levels.",
        "section_line:kind=fact with minimal F_* evidence.",
        "Application material may use kind=goal only with explicit hope/target/learning/plan/future wording and no source IDs.",
        "Use only fact|goal|format; never turn a plan into an existing fact.",
        "Keep minimum relevant F_* IDs in registry order; no J_REQ_*, unknown, or duplicate IDs. JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "CANDIDATE_FACTS",
        candidateFacts.map((fact) => `[${fact.id}]${fact.text}`).join("\n"),
        "JD_ONLY_REQUIREMENTS",
        jobRequirements.map((requirement) =>
          `[${requirement.id}]${requirement.text}`
        ).join("\n"),
        "REPAIR_TARGETS",
        JSON.stringify(targets.map((target) => ({
          targetId: target.targetId,
          path: target.path,
          locationKind: target.locationKind,
          sectionType: target.sectionType,
          violationCategories: target.categories,
          current: target.current,
          removalAllowed: target.removalAllowed,
        }))),
      ].join("\n"),
    },
  ];
}

export function validateFactualityRepairPatch(
  value: unknown,
  targets: FactualityRepairTarget[],
  candidateFacts: CandidateFact[],
): FactualityRepairPatch {
  const parsed = factualityRepairPatchSchema.safeParse(value);
  if (!parsed.success) {
    throw new FactualityRepairError(
      "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
      "事实修复补丁不符合严格 Schema。",
    );
  }
  const expectedIds = new Set(targets.map((target) => target.targetId));
  const seenIds = new Set<string>();
  for (const repair of parsed.data.repairs) {
    if (seenIds.has(repair.targetId)) {
      throw new FactualityRepairError("FACTUALITY_REPAIR_TARGET_DUPLICATED");
    }
    seenIds.add(repair.targetId);
    if (!expectedIds.has(repair.targetId)) {
      throw new FactualityRepairError("FACTUALITY_REPAIR_TARGET_UNKNOWN");
    }
  }
  if (targets.some((target) => !seenIds.has(target.targetId))) {
    throw new FactualityRepairError("FACTUALITY_REPAIR_TARGET_MISSING");
  }

  const candidateOrder = new Map(
    candidateFacts.map((fact, index) => [fact.id, index]),
  );
  const candidateIds = new Set(candidateOrder.keys());
  const targetById = new Map(targets.map((target) => [target.targetId, target]));
  for (const repair of parsed.data.repairs) {
    const target = targetById.get(repair.targetId)!;
    if (repair.replacement.sourceFactIds.some((id) =>
      id.startsWith("J_REQ_") || !candidateIds.has(id)
    )) {
      throw new FactualityRepairError(
        "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
        "事实修复补丁包含不允许的事实 ID。",
      );
    }
    if (
      new Set(repair.replacement.sourceFactIds).size !==
        repair.replacement.sourceFactIds.length ||
      repair.replacement.sourceFactIds.some((id, index, ids) =>
        index > 0 &&
        candidateOrder.get(ids[index - 1])! >= candidateOrder.get(id)!
      )
    ) {
      throw new FactualityRepairError(
        "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
        "事实修复补丁中的事实 ID 必须按注册表顺序且不得重复。",
      );
    }
    if (
      repair.replacement.kind !== "fact" &&
      repair.replacement.sourceFactIds.length > 0
    ) {
      throw new FactualityRepairError(
        "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
        "目标或格式文本不得绑定候选人事实 ID。",
      );
    }
    if (
      target.current.kind === "goal" &&
      repair.replacement.kind !== "goal"
    ) {
      throw new FactualityRepairError(
        "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
        "目标声明不得被改写为已有事实。",
      );
    }
    if (
      target.current.kind === "format" &&
      repair.replacement.kind !== "format"
    ) {
      throw new FactualityRepairError(
        "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
        "格式声明不得改变语义种类。",
      );
    }
    if (
      target.locationKind === "section_line" &&
      target.current.kind === "fact" &&
      repair.replacement.kind !== "fact"
    ) {
      throw new FactualityRepairError(
        "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID",
        "事实 section 不得使用未来目标替代事实。",
      );
    }
  }

  const repairsById = new Map(
    parsed.data.repairs.map((repair) => [repair.targetId, repair]),
  );
  return {
    repairs: targets.map((target) => repairsById.get(target.targetId)!),
  };
}

function replaceClaimAtPath(
  input: GroundedTailoredResume,
  path: string,
  replacement: GroundedText,
) {
  const parsedPath = parseTargetPath(path);
  if (!parsedPath) {
    throw new FactualityRepairError("UNSUPPORTED_FACTUALITY_REPAIR_TARGET");
  }
  if (parsedPath.family === "section") {
    const section = input.sections[parsedPath.sectionIndex];
    if (!section?.lines[parsedPath.itemIndex]) {
      throw new FactualityRepairError("UNSUPPORTED_FACTUALITY_REPAIR_TARGET");
    }
    section.lines[parsedPath.itemIndex] = structuredClone(replacement);
    return;
  }
  const items = input.applicationMaterials[parsedPath.material];
  if (!items[parsedPath.itemIndex]) {
    throw new FactualityRepairError("UNSUPPORTED_FACTUALITY_REPAIR_TARGET");
  }
  items[parsedPath.itemIndex] = structuredClone(replacement);
}

function scopeSnapshot(
  input: GroundedTailoredResume,
  targetPaths: string[],
) {
  const snapshot = structuredClone(input);
  for (const path of targetPaths) {
    replaceClaimAtPath(snapshot, path, {
      text: "__REPAIR_TARGET__",
      sourceFactIds: [],
      kind: "format",
    });
  }
  return JSON.stringify(snapshot);
}

export function assertFactualityRepairScope(
  before: GroundedTailoredResume,
  after: GroundedTailoredResume,
  targets: FactualityRepairTarget[],
) {
  const paths = targets.map((target) => target.path);
  if (scopeSnapshot(before, paths) !== scopeSnapshot(after, paths)) {
    throw new FactualityRepairError("FACTUALITY_REPAIR_SCOPE_VIOLATION");
  }
}

export function applyFactualityRepairPatch(
  input: GroundedTailoredResume,
  targets: FactualityRepairTarget[],
  patch: FactualityRepairPatch,
) {
  const output = structuredClone(input);
  const targetById = new Map(targets.map((target) => [target.targetId, target]));
  for (const repair of patch.repairs) {
    const target = targetById.get(repair.targetId);
    if (!target) {
      throw new FactualityRepairError("FACTUALITY_REPAIR_TARGET_UNKNOWN");
    }
    replaceClaimAtPath(output, target.path, repair.replacement);
  }
  const parsed = groundedTailoredResumeSchema.parse(output);
  assertFactualityRepairScope(input, parsed, targets);
  return parsed;
}

function violationKey(item: FactualityViolation) {
  return `${item.path}\u0000${item.category}\u0000${item.severity}`;
}

function violationCounts(items: FactualityViolation[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = violationKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function summarizeFactualityRepair(
  before: FactualityReport,
  after: FactualityReport,
  targets: FactualityRepairTarget[],
  patchCount: number,
  applied: boolean,
  failureCategory?: FactualityRepairErrorCode,
): FactualityRepairSummary {
  const beforeCounts = violationCounts(before.violations);
  const afterCounts = violationCounts(after.violations);
  const keys = new Set([...beforeCounts.keys(), ...afterCounts.keys()]);
  let resolved = 0;
  let introduced = 0;
  for (const key of keys) {
    const beforeCount = beforeCounts.get(key) ?? 0;
    const afterCount = afterCounts.get(key) ?? 0;
    resolved += Math.max(0, beforeCount - afterCount);
    introduced += Math.max(0, afterCount - beforeCount);
  }
  return {
    factualityViolationCountBeforeRepair: before.violations.length,
    factualityRepairTargetCount: targets.length,
    factualityRepairPatchCount: patchCount,
    factualityRepairApplied: applied,
    factualityViolationCountAfterRepair: after.violations.length,
    factualityViolationsResolved: resolved,
    factualityViolationsIntroduced: introduced,
    factualityRepairRemainingCategories: [
      ...new Set(after.violations.map((item) => item.category)),
    ].sort(),
    factualityRepairScopeViolation:
      failureCategory === "FACTUALITY_REPAIR_SCOPE_VIOLATION",
    factualityRepairTargetPaths: targets.map((target) => target.path),
    factualityRepairTargetCategories: [
      ...new Set(targets.flatMap((target) => target.categories)),
    ].sort(),
    factualityRepairFailureCategory: failureCategory,
  };
}

export function classifyFactualityRepairOutcome(
  before: FactualityReport,
  after: FactualityReport,
): FactualityRepairErrorCode | undefined {
  const beforeKeys = new Set(before.violations.map(violationKey));
  if (after.violations.some((item) => !beforeKeys.has(violationKey(item)))) {
    return "FACTUALITY_REPAIR_INTRODUCED_NEW_VIOLATION";
  }
  if (after.violations.length > 0) return "FACTUALITY_REPAIR_INCOMPLETE";
  return undefined;
}
