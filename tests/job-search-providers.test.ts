import { describe, expect, it } from "vitest";
import { parseJobSearchFormData } from "@/app/jobs/form-parsers";
import { createMockGraduateProfile } from "@/services/mock-profile";
import { ManualJDProvider } from "@/services/jobs/providers/manual-jd-provider";
import { CompanyCareerPageProvider } from "@/services/jobs/providers/company-career-page-provider";
import { WebSearchProvider } from "@/services/jobs/providers/web-search-provider";
import { dedupeJobPosts } from "@/services/jobs/job-deduper";
import { normalizeJobPost } from "@/services/jobs/job-normalizer";
import { detectJobRiskFlags } from "@/services/jobs/job-risk-detector";
import { rankJobForProfile } from "@/services/jobs/job-ranker";

function profileFixture() {
  const input = createMockGraduateProfile("u1");
  return {
    id: "p1",
    userId: "u1",
    targetStatus: input.targetStatus,
    targetRoles: input.targetRoles,
    targetCities: input.targetCities,
    expectedSalaryMin: input.expectedSalaryMin,
    expectedSalaryMax: input.expectedSalaryMax,
    personalSummary: input.personalSummary,
    profileCompletenessScore: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    basicInfo: { id: "b1", profileId: "p1", ...input.basicInfo! },
    educationItems: input.educationItems.map((item, index) => ({ id: `e${index}`, profileId: "p1", ...item })),
    skillItems: input.skillItems.map((item, index) => ({ id: `s${index}`, profileId: "p1", ...item })),
    projectItems: input.projectItems.map((item, index) => ({ id: `pr${index}`, profileId: "p1", ...item })),
    experienceItems: input.experienceItems.map((item, index) => ({ id: `x${index}`, profileId: "p1", ...item })),
    certificateItems: [],
    awardItems: [],
    evidenceItems: [],
  };
}

describe("job search providers", () => {
  it("ManualJDProvider converts pasted JD to normalized job", async () => {
    const provider = new ManualJDProvider();
    const [raw] = await provider.search({
      query: "Java 后端开发",
      city: "杭州",
      rawText: "公司：杭州云栖科技\n岗位：Java 后端开发\n要求：本科 Java Spring Boot MySQL Redis 15k-25k",
    });
    const job = await provider.normalize(raw);
    expect(job.title).toContain("Java");
    expect(job.skills).toEqual(expect.arrayContaining(["Java", "Spring Boot", "MySQL", "Redis"]));
  });

  it("CompanyCareerPageProvider extracts jobs from pasted page text", async () => {
    const provider = new CompanyCareerPageProvider();
    const raws = await provider.search({
      query: "前端开发",
      city: "上海",
      rawText: "职位：前端开发工程师\n公司：上海星河科技\n地点：上海\n要求：React TypeScript 本科 校招",
      url: "https://careers.example/jobs",
    });
    expect(raws.length).toBeGreaterThan(0);
    const job = await provider.normalize(raws[0]);
    expect(job.source).toBe("company_career_page");
  });

  it("WebSearchProvider falls back to fixture/mock results without API key", async () => {
    const provider = new WebSearchProvider();
    const raws = await provider.search({ query: "Java 后端", city: "杭州" });
    expect(raws.length).toBeGreaterThan(0);
  });

  it("normalizer, deduper, risk detector, and ranker work together", async () => {
    const job = await normalizeJobPost({
      rawText: "岗位：Java 后端开发\n公司：杭州云栖科技\n城市：杭州\n薪资：15k-25k\n要求：本科 Java Spring Boot MySQL",
      source: "manual",
      sourceUrl: "https://careers.example/java",
    });
    const duplicate = await normalizeJobPost({ ...job, rawText: job.rawText, source: "manual", sourceUrl: "https://careers.example/java" });
    expect(dedupeJobPosts([job, duplicate])).toHaveLength(1);

    const riskJob = await normalizeJobPost({ rawText: "高薪转行 Java，先缴费，收费培训，培训贷，包就业。", source: "manual" });
    expect(detectJobRiskFlags(riskJob)).toEqual(expect.arrayContaining(["training_or_paid_program", "loan_or_fee_risk"]));
    const shortJob = await normalizeJobPost({ rawText: "Java", source: "manual" });
    expect(detectJobRiskFlags(shortJob)).toContain("description_too_short");

    const ranked = await rankJobForProfile(profileFixture() as never, null, { id: "job1", ...job } as never);
    expect(ranked.finalScore).toBeGreaterThanOrEqual(0);
    expect(ranked.finalScore).toBeLessThanOrEqual(100);
  });

  it("jobs search action parser includes new provider fields", () => {
    const form = new FormData();
    form.set("profileId", "p1");
    form.set("query", "Java");
    form.set("source", "manual_jd");
    form.set("keywords", "Spring Boot MySQL");
    form.set("limit", "5");
    form.set("rawText", "JD text");
    const parsed = parseJobSearchFormData(form);
    expect(parsed.keywords).toBe("Spring Boot MySQL");
    expect(parsed.limit).toBe(5);
    expect(parsed.rawText).toBe("JD text");
  });
});
