import { applicationInsightSchema, type ApplicationInsightResult } from "@/schemas/application";

type InsightApplication = {
  status: string;
  company: string;
  jobTitle: string;
  appliedAt?: Date | null;
  nextFollowUpAt?: Date | null;
  jobMatch?: {
    matchScore: number;
    gaps: string[];
    riskWarnings: string[];
    resumeSuggestions: string[];
    interviewPrepSuggestions: string[];
  } | null;
  feedback?: Array<{
    weaknesses: string[];
    knowledgeGaps: string[];
    improvementActions: string[];
    resumeImplications: string[];
    strategyImplications: string[];
  }>;
  tasks?: Array<{ title: string; status: string; dueAt?: Date | null }>;
  offers?: Array<{ status: string; salaryText?: string | null; cons: string[] }>;
};

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function generateApplicationInsightFromContext(application: InsightApplication): ApplicationInsightResult {
  const match = application.jobMatch;
  const openTasks = application.tasks?.filter((task) => !["done", "skipped"].includes(task.status)) ?? [];
  const feedback = application.feedback ?? [];
  const knowledgeGaps = unique(feedback.flatMap((item) => item.knowledgeGaps));
  const hasHighRisk = Boolean(match?.riskWarnings.length) || application.status === "rejected";
  const hasOffer = application.offers?.some((offer) => ["pending", "negotiating", "accepted"].includes(offer.status));
  const lowMatch = typeof match?.matchScore === "number" && match.matchScore < 55;

  const currentRiskLevel = hasHighRisk || lowMatch ? "high" : openTasks.length > 3 || knowledgeGaps.length > 0 ? "medium" : "low";
  const nextBestActions = unique([
    ...(application.status === "planned" ? ["确认投递简历版本与岗位要求是否一致，然后完成投递"] : []),
    ...(application.status === "applied" || application.status === "resume_screen" ? ["投递后 3-5 天准备一次礼貌跟进"] : []),
    ...(application.status === "interviewing" ? ["围绕岗位 JD、项目经历和已暴露知识缺口准备下一轮面试"] : []),
    ...(application.status === "rejected" ? ["记录失败原因，更新简历和面试准备清单"] : []),
    ...knowledgeGaps.map((gap) => `针对 ${gap} 做专项复盘和练习`),
    ...openTasks.slice(0, 3).map((task) => `完成任务：${task.title}`),
  ]);

  const resumeSuggestions = unique([
    ...(match?.resumeSuggestions ?? []),
    ...feedback.flatMap((item) => item.resumeImplications),
    ...(match?.gaps.length ? ["检查简历是否充分呈现与岗位相关的项目、技能和证据"] : []),
  ]);

  const interviewPrepSuggestions = unique([
    ...(match?.interviewPrepSuggestions ?? []),
    ...feedback.flatMap((item) => item.improvementActions),
    ...knowledgeGaps.map((gap) => `准备 ${gap} 高频追问和项目中的实际使用说明`),
  ]);

  const followUpSuggestions = unique([
    ...(application.status === "applied" ? ["若 3-5 天无反馈，可通过原投递渠道礼貌询问进展"] : []),
    ...(application.nextFollowUpAt ? [`按计划在 ${application.nextFollowUpAt.toLocaleDateString("zh-CN")} 跟进`] : []),
    ...(hasOffer ? ["确认 offer 截止时间、试用期、薪资结构和入职材料"] : []),
  ]);

  const strategyImplications = unique([
    ...feedback.flatMap((item) => item.strategyImplications),
    ...(lowMatch ? ["该岗位匹配度偏低，后续投递应优先选择技能重合度更高的岗位"] : []),
    ...(application.status === "offer" ? ["将该 offer 与目标城市、岗位方向和成长性纳入策略复盘"] : []),
  ]);

  const warnings = unique([
    ...(match?.riskWarnings ?? []),
    ...(lowMatch ? ["当前岗位匹配分偏低，投递前建议谨慎评估"] : []),
    ...(openTasks.length > 5 ? ["未完成任务较多，建议先收敛到最高优先级事项"] : []),
  ]);

  return applicationInsightSchema.parse({
    summary: `${application.company} ${application.jobTitle} 当前处于 ${application.status} 状态，建议围绕匹配差距、面试反馈和未完成任务推进。`,
    currentRiskLevel,
    nextBestActions: nextBestActions.length ? nextBestActions : ["保持记录更新，等待下一步反馈"],
    resumeSuggestions,
    interviewPrepSuggestions,
    followUpSuggestions,
    strategyImplications,
    warnings,
  });
}
