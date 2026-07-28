import type { NormalizedJobPost } from "@/schemas/job";

export function detectJobRiskFlags(job: Pick<NormalizedJobPost, "title" | "company" | "city" | "salaryMin" | "description" | "requirements">) {
  const text = `${job.title} ${job.company} ${job.city} ${job.description} ${job.requirements}`;
  const flags: string[] = [];
  if (/收费培训|培训费|付费培训/.test(text)) flags.push("收费培训");
  if (/培训贷|贷款培训|分期付款/.test(text)) flags.push("培训贷");
  if (/先缴费|先交费|缴费/.test(text)) flags.push("先缴费");
  if (/包就业|保就业|高薪转行/.test(text)) flags.push("包就业/高薪转行");
  if (job.salaryMin && job.salaryMin >= 40000 && /应届|实习|无经验|零基础/.test(text)) flags.push("薪资明显异常");
  if (!job.company || job.company === "未知公司") flags.push("公司名称缺失");
  if ((job.description + job.requirements).length < 40) flags.push("岗位描述过短");
  if (!job.city || job.city === "未知") flags.push("工作地点缺失");
  if (/外包|驻场/.test(text) && !/说明|客户现场|项目制/.test(text)) flags.push("疑似外包/驻场但未说明");
  if (/Java/.test(job.title) && /销售|运营|课程顾问/.test(job.requirements)) flags.push("岗位要求和标题不一致");
  if (/收费培训|付费培训|培训|课程/.test(text)) flags.push("training_or_paid_program");
  if (/培训贷|贷款|分期|先缴费|先交费|收费/.test(text)) flags.push("loan_or_fee_risk");
  if (/包就业|高薪转行/.test(text)) flags.push("training_or_paid_program");
  if (job.salaryMin && job.salaryMin >= 40000 && /应届|实习|无经验|零基础/.test(text)) flags.push("salary_too_high");
  if (!job.salaryMin) flags.push("salary_missing");
  if (!job.company || job.company === "未知公司" || job.company === "鏈煡鍏徃") flags.push("company_missing");
  if ((job.description + job.requirements).length < 40) flags.push("description_too_short");
  if (!job.city || job.city === "未知" || job.city === "鏈煡") flags.push("unclear_employment_type");
  if (/登录|验证码|访问受限|fetch_failed/.test(text)) flags.push("source_requires_login");
  if (/fetch_failed/.test(text)) flags.push("fetch_failed");
  return Array.from(new Set(flags));
}
