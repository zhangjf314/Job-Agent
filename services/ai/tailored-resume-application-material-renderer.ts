import type { GroundedText } from "./tailored-resume-grounding";
import type {
  CandidateFactRenderDescriptor,
} from "./candidate-fact-registry";
import type { TailoredResumePlan } from "./tailored-resume-plan";

type ApplicationMaterialKey =
  | "selfIntroduction"
  | "applicationEmail"
  | "recruiterMessage";

export type DeterministicApplicationMaterials = Record<
  ApplicationMaterialKey,
  GroundedText[]
>;

function firstFactClaim(
  factIds: string[],
  priority: Map<string, number>,
  descriptorById: Map<string, CandidateFactRenderDescriptor>,
): GroundedText | undefined {
  const descriptor = [...factIds]
    .sort(
      (left, right) =>
        (priority.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (priority.get(right) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((id) => descriptorById.get(id))
    .find((item) => item?.renderable);
  return descriptor
    ? {
        text: descriptor.safePhrase,
        sourceFactIds: [descriptor.factId],
        kind: "fact",
      }
    : undefined;
}

export function renderTailoredResumeApplicationMaterials(
  plan: TailoredResumePlan,
  descriptors: CandidateFactRenderDescriptor[],
): DeterministicApplicationMaterials {
  const descriptorById = new Map(
    descriptors.map((descriptor) => [descriptor.factId, descriptor]),
  );
  const priority = new Map(
    plan.priorityFactIds.map((factId, index) => [factId, index]),
  );
  const selfFact = firstFactClaim(
    plan.applicationMaterials.selfIntroductionFactIds,
    priority,
    descriptorById,
  );
  const emailFact = firstFactClaim(
    plan.applicationMaterials.applicationEmailFactIds,
    priority,
    descriptorById,
  );
  const recruiterFact = firstFactClaim(
    plan.applicationMaterials.recruiterMessageFactIds,
    priority,
    descriptorById,
  );

  return {
    selfIntroduction: [
      ...(selfFact ? [selfFact] : []),
      {
        text: "希望应聘该岗位，并继续提升相关专业能力。",
        sourceFactIds: [],
        kind: "goal",
      },
    ],
    applicationEmail: [
      {
        text: "您好，附件为我的简历，感谢您审阅。",
        sourceFactIds: [],
        kind: "format",
      },
      ...(emailFact ? [emailFact] : []),
    ],
    recruiterMessage: [
      {
        text: "您好，我对该岗位感兴趣，希望有机会进一步沟通。",
        sourceFactIds: [],
        kind: "goal",
      },
      ...(recruiterFact ? [recruiterFact] : []),
    ],
  };
}
