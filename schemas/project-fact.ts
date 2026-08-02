import { z } from "zod";
import {
  projectAssertionStrengths,
  projectFactCategories,
} from "@/types/project-facts";

export const projectFactCategorySchema = z.enum(projectFactCategories);
export const projectAssertionStrengthSchema = z.enum(
  projectAssertionStrengths,
);

const metricWithContext = /\d+(?:\.\d+)?\s*(?:%|ms|s|秒|分钟|小时|天|项|个|条|次|人|用户|请求|数据|测试|接口|页面|模块|倍)/i;

export const projectFactAtomInputSchema = z.object({
  category: projectFactCategorySchema,
  canonicalText: z.string().trim().min(1, "事实内容不能为空").max(240),
  assertionStrength: projectAssertionStrengthSchema,
  renderable: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  if (/^(?:J_REQ_|F_)/.test(value.canonicalText)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["canonicalText"],
      message: "事实内容不能填写系统内部 ID。",
    });
  }
  if (value.category === "metric" && !metricWithContext.test(value.canonicalText)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["canonicalText"],
      message: "量化事实必须包含明确数值和上下文单位。",
    });
  }
});

export type ProjectFactAtomInput = z.infer<typeof projectFactAtomInputSchema>;
