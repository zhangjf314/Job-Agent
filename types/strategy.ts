export const targetTimeframes = ["immediate", "one_month", "three_months", "six_months"] as const;
export const roleFamilies = ["engineering", "data", "product", "operations", "design", "sales", "other"] as const;
export const strategyPriorities = ["high", "medium", "low"] as const;
export const skillGapCategories = ["hard_skill", "soft_skill", "domain_knowledge", "tool", "project_experience", "interview"] as const;
export const strategySkillLevels = ["none", "beginner", "intermediate", "advanced"] as const;
export const actionCategories = ["resume", "skill", "project", "application", "interview", "networking"] as const;
export const actionStatuses = ["todo", "in_progress", "done", "skipped"] as const;

export type TargetTimeframe = (typeof targetTimeframes)[number];
export type RoleFamily = (typeof roleFamilies)[number];
export type StrategyPriority = (typeof strategyPriorities)[number];
export type SkillGapCategory = (typeof skillGapCategories)[number];
export type StrategySkillLevel = (typeof strategySkillLevels)[number];
export type ActionCategory = (typeof actionCategories)[number];
export type ActionStatus = (typeof actionStatuses)[number];
