import { describe, expect, it } from "vitest";
import { normalizedJobPostSchema } from "@/schemas/job";
import { normalizeJobPost } from "@/services/jobs/job-normalizer";
import { detectJobRiskFlags } from "@/services/jobs/job-risk-detector";
import { calculateJobQualityScore } from "@/services/jobs/job-quality";

const rawText = "岗位：Java 后端开发\n公司：杭州云栖科技\n城市：杭州\n薪资：15k-25k\n要求：本科，熟悉 Java、Spring Boot、MySQL、Redis。";

describe("job schema and normalizer", () => {
  it("validates normalized job post", async () => {
    const job = await normalizeJobPost({ rawText, source: "manual" });
    expect(normalizedJobPostSchema.safeParse(job).success).toBe(true);
  });

  it("extracts Chinese job fields", async () => {
    const job = await normalizeJobPost({ rawText, source: "manual" });
    expect(job.skills).toEqual(expect.arrayContaining(["Java", "Spring Boot", "MySQL", "Redis"]));
    expect(job.educationRequirement).toBe("本科");
    expect(job.city).toBe("杭州");
    expect(job.salaryMin).toBe(15000);
    expect(job.salaryMax).toBe(25000);
  });

  it("detects training loan and fee risks", async () => {
    const job = await normalizeJobPost({ rawText: "高薪转行 Java，先缴费，收费培训，可办理培训贷，包就业。", source: "manual" });
    expect(detectJobRiskFlags(job)).toEqual(expect.arrayContaining(["收费培训", "培训贷", "先缴费", "包就业/高薪转行"]));
  });

  it("calculates quality score within 0-100", async () => {
    const job = await normalizeJobPost({ rawText, source: "manual" });
    expect(calculateJobQualityScore(job)).toBeGreaterThanOrEqual(0);
    expect(calculateJobQualityScore(job)).toBeLessThanOrEqual(100);
  });
});
