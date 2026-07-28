export const jdAnalysisOutputContract = [
  "Return one object containing every key below.",
  "targetRole:string; seniorityLevel:intern|new_grad|junior|mid|senior|unknown;",
  "internshipDuration:string; conversionOpportunity:string;",
  "candidateProfile:string[]; coreResponsibilities:string[]; hardSkills:string[];",
  "softSkills:string[]; experienceRequirements:string[]; educationRequirements:string[];",
  "bonusPoints:string[]; keywords:string[]; matchScore:integer 0..100;",
  "scoreBreakdown:{hardSkillScore:integer 0..100,projectMatchScore:integer 0..100,experienceMatchScore:integer 0..100,educationMatchScore:integer 0..100,keywordCoverageScore:integer 0..100};",
  "matchedPoints:string[]; gaps:string[]; riskWarnings:string[]; resumeRewriteSuggestions:string[].",
  "Never omit scoreBreakdown fields. Use conservative empty arrays, empty strings, unknown, or zero when evidence is unavailable.",
].join(" ");

export const tailoredResumeOutputContract = [
  "Return one object containing every key below.",
  "contentMarkdown:non-empty string;",
  "sections:non-empty array of {type:basic_info|summary|education|skills|projects|experiences|certificates|awards|others,title:non-empty string,contentMarkdown:string,order:non-negative integer};",
  "rewriteExplanation:string[]; changedSections:string[]; missingFields:string[];",
  "improvementQuestions:string[]; qualityWarnings:string[];",
  "applicationMaterials:{selfIntroduction:non-empty string,applicationEmail:non-empty string,recruiterMessage:non-empty string}.",
  "Use only supplied candidate facts. Unsupported JD requirements belong in missingFields, improvementQuestions, or qualityWarnings.",
].join(" ");

export const careerStrategyOutputContract = [
  "Return one object containing every key below.",
  "title:non-empty string; summary:non-empty string; targetTimeframe:immediate|one_month|three_months|six_months;",
  "overallReadinessScore:integer 0..100; recommendedPrimaryDirection:non-empty string;",
  "recommendedCities:string[]; strategyNotes:string[];",
  "recommendations:non-empty array of objects with directionName,roleFamily:engineering|data|product|operations|design|sales|other,matchScore:integer 0..100,confidence:integer 0..100,priority:high|medium|low,suitableRoles:string[],suitableIndustries:string[],recommendedCities:string[],matchedEvidence:string[],gaps:string[],risks:string[],resumeFocus:string[],searchKeywords:string[];",
  "skillGaps:array of objects with directionName,skillName,category:hard_skill|soft_skill|domain_knowledge|tool|project_experience|interview,currentLevel:none|beginner|intermediate|advanced,targetLevel:none|beginner|intermediate|advanced,importance:integer 0..100,suggestedActions:string[],evidenceNeeded:string[];",
  "jobSearchStrategies:array of objects with directionName,targetRole,targetCities:string[],targetIndustries:string[],companyTypes:string[],searchKeywords:string[],negativeKeywords:string[],weeklyApplicationTarget:integer 1..200,resumeVersionSuggestion,applicationAdvice:string[],interviewPrepAdvice:string[];",
  "actionPlan:array of objects with title,description,category:resume|skill|project|application|interview|networking,priority:high|medium|low,estimatedHours:integer 1..200,dueInDays:integer 0..180,status:todo|in_progress|done|skipped;",
  "warnings:string[]; assumptions:string[].",
  "Use the exact enum values required by the application and never omit required nested fields.",
].join(" ");
