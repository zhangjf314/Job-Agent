import { jdAnalysisResultSchema } from "@/schemas/jd";
import type { JDAnalysisResult, SeniorityLevel } from "@/types/jd";

const knownHardSkills = [
  "Java",
  "Spring Boot",
  "Spring Cloud",
  "MySQL",
  "Redis",
  "Vue",
  "React",
  "Python",
  "SQL",
  "Docker",
  "Kubernetes",
  "RabbitMQ",
  "Kafka",
  "数据分析",
  "产品经理",
  "需求分析",
  "用户增长",
  "Git",
  "Linux",
  "Node.js",
  "TypeScript",
];

const knownSoftSkills = ["沟通", "协作", "学习能力", "责任心", "执行力", "逻辑思维", "抗压", "文档"];
const roleKeywords = ["Java 后端", "后端开发", "软件开发工程师", "前端开发", "数据分析", "产品经理", "测试开发", "算法工程师"];

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function includesIgnoreCase(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function splitSentences(text: string) {
  return text
    .split(/[\n。；;]/)
    .map((line) => line.replace(/^[\s\d、.（)）-]+/, "").trim())
    .filter((line) => line.length >= 4);
}

function detectSeniority(rawText: string): SeniorityLevel {
  if (/实习|intern/i.test(rawText)) return "intern";
  if (/应届|校招|毕业生|new grad/i.test(rawText)) return "new_grad";
  if (/1\s*[-到至]\s*3\s*年|一年|二年|两年|三年/.test(rawText)) return "junior";
  if (/3\s*[-到至]\s*5\s*年|五年/.test(rawText)) return "mid";
  if (/5\s*年以上|资深|高级|专家/.test(rawText)) return "senior";
  return "unknown";
}

export function analyzeJDText(rawText: string): JDAnalysisResult {
  const sentences = splitSentences(rawText);
  const hardSkills = unique(knownHardSkills.filter((skill) => includesIgnoreCase(rawText, skill)));
  const softSkills = unique(knownSoftSkills.filter((skill) => rawText.includes(skill)));
  const targetRole =
    roleKeywords.find((role) => rawText.includes(role)) ||
    sentences.find((line) => /岗位|职位|招聘/.test(line))?.slice(0, 30) ||
    "";
  const seniorityLevel = detectSeniority(rawText);
  const coreResponsibilities = sentences.filter((line) => /负责|参与|完成|建设|设计|开发|优化|维护|推进|协作/.test(line)).slice(0, 8);
  const experienceRequirements = unique(sentences.filter((line) => /经验|应届|实习|年/.test(line)).slice(0, 6));
  const educationRequirements = unique(sentences.filter((line) => /本科|硕士|学历|计算机|软件工程/.test(line)).slice(0, 5));
  const bonusPoints = unique(sentences.filter((line) => /加分|优先|熟悉.*优先|有.*经验者/.test(line)).slice(0, 6));
  const internshipDuration = rawText.match(/(?:至少|每周)?\s*(?:实习)?\s*([一二三四五六七八九十\d]+\s*个?月|[一二三四五六七\d]+\s*天[\/／每]?周)/)?.[1] ?? "";
  const conversionOpportunity = /提供转正|可转正|转正机会|表现优秀.*转正/.test(rawText)
    ? "有转正机会"
    : /不转正|无转正/.test(rawText)
      ? "不提供转正"
      : "unknown";
  const candidateProfile = unique(
    sentences.filter((line) => /专业|能力|熟悉|掌握|具备|善于|热爱|优先|在校生|应届/.test(line)).slice(0, 8),
  );
  const keywords = unique([...hardSkills, ...softSkills, targetRole, ...roleKeywords.filter((role) => rawText.includes(role))]);

  return jdAnalysisResultSchema.parse({
    targetRole,
    seniorityLevel,
    internshipDuration,
    conversionOpportunity,
    candidateProfile,
    coreResponsibilities,
    hardSkills,
    softSkills,
    experienceRequirements,
    educationRequirements,
    bonusPoints,
    keywords,
    matchScore: 0,
    scoreBreakdown: {
      hardSkillScore: 0,
      projectMatchScore: 0,
      experienceMatchScore: 0,
      educationMatchScore: 0,
      keywordCoverageScore: 0,
    },
    matchedPoints: [],
    gaps: [],
    riskWarnings: [],
    resumeRewriteSuggestions: [],
  });
}
