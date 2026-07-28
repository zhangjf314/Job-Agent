import { interviewFeedbackAnalysisSchema } from "@/schemas/application";
import type { InterviewFeedbackAnalysis } from "@/types/application";

const knowledgeKeywords = [
  "Redis",
  "MySQL",
  "JVM",
  "Java",
  "Spring Boot",
  "Docker",
  "Agent",
  "RAG",
  "MCP",
  "A2A",
  "ANP",
  "算法",
  "项目难点",
  "实习经历",
  "自我介绍",
  "薪资期望",
  "城市意向",
  "稳定性",
] as const;

const weaknessSignals = ["不会", "不熟", "没答好", "没答上", "薄弱", "卡住", "不清楚", "表达不够", "答得一般", "需要补"];
const strengthSignals = ["答得不错", "比较清楚", "熟悉", "表达清楚", "讲得清楚", "认可", "表现好", "有亮点"];
const questionSignals = ["问", "问题", "考", "聊到", "介绍", "算法题", "为什么", "如何", "怎么"];

function splitSentences(text: string) {
  return text
    .split(/[。！？!?；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function containsAny(text: string, signals: readonly string[]) {
  return signals.some((signal) => text.includes(signal));
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function analyzeInterviewFeedback(feedbackText: string): InterviewFeedbackAnalysis {
  const text = feedbackText.trim();
  const sentences = splitSentences(text);
  const assumptions: string[] = [];
  const warnings: string[] = [];

  if (text.length < 20) {
    warnings.push("反馈文本较短，只能生成初步行动建议");
    assumptions.push("假设用户希望先补齐面试复盘中的显性问题");
  }

  const questionsAsked = unique(
    sentences.filter((sentence) => containsAny(sentence, questionSignals)).map((sentence) => sentence.replace(/^面试官/, "")),
  );
  const strengths = unique(sentences.filter((sentence) => containsAny(sentence, strengthSignals)));
  const weaknesses = unique(sentences.filter((sentence) => containsAny(sentence, weaknessSignals)));

  const knowledgeGaps = unique(
    knowledgeKeywords.filter((keyword) => {
      const lowerText = text.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      if (!lowerText.includes(lowerKeyword)) return false;
      return weaknesses.length > 0 || containsAny(text, weaknessSignals) || ["Redis", "MySQL", "JVM", "算法", "RAG", "Agent", "MCP"].includes(keyword);
    }),
  );

  const improvementActions = unique([
    ...knowledgeGaps.map((gap) => `补充 ${gap} 面试准备，并整理可讲述的项目证据`),
    ...(weaknesses.some((item) => item.includes("项目") || item.includes("表达"))
      ? ["重写项目讲述稿，按背景、职责、行动、结果梳理 2 分钟版本"]
      : []),
    ...(questionsAsked.length > 0 ? ["把本轮被问到的问题整理成复盘清单，补充标准回答"] : []),
  ]);

  const resumeImplications = unique([
    ...(text.includes("简历") ? ["检查简历中被追问的内容，确保每一项都能展开说明"] : []),
    ...(text.includes("项目") || text.includes("难点") ? ["在简历项目经历中补充技术难点、个人职责和结果证据"] : []),
    ...(text.includes("量化") ? ["补充项目或实习中的量化结果，避免只描述职责"] : []),
  ]);

  const strategyImplications = unique([
    ...(text.includes("城市") || text.includes("稳定") ? ["在求职策略中明确城市意向和稳定性表达"] : []),
    ...(text.includes("薪资") ? ["准备薪资期望区间和可接受底线"] : []),
    ...(text.includes("方向") ? ["复盘目标岗位方向是否与当前项目证据一致"] : []),
  ]);

  return interviewFeedbackAnalysisSchema.parse({
    strengths,
    weaknesses,
    questionsAsked,
    knowledgeGaps,
    improvementActions,
    resumeImplications,
    strategyImplications,
    assumptions,
    warnings,
  });
}
