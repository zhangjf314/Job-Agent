import { describe, expect, it } from "vitest";
import { extractPageText } from "@/services/web/page-text-extractor";
import { parseCompanyCareerPageText } from "@/services/jobs/company-page-job-parser";
import { classifyJobSource } from "@/services/jobs/job-source-classifier";

describe("web page parsing and source classification", () => {
  it("extracts text from simple HTML", () => {
    const text = extractPageText("<html><script>x</script><body><h1>Java 后端工程师</h1><p>本科 Spring Boot MySQL</p></body></html>");
    expect(text).toContain("Java 后端工程师");
    expect(text).not.toContain("script");
  });

  it("parses company career page text", () => {
    const jobs = parseCompanyCareerPageText("Java 后端工程师\n公司：测试公司\n杭州\n职责：负责接口开发\n要求：本科 Java Spring Boot MySQL", "https://company.example/careers");
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].title).toContain("Java");
  });

  it("classifies common sources", () => {
    expect(classifyJobSource({ url: "https://company.example/careers/java" }).sourcePlatform).toContain("企业官网");
    expect(classifyJobSource({ url: "https://university.example/jobs/java" }).sourcePlatform).toContain("学校就业网");
    expect(classifyJobSource({ url: "https://talent.hangzhou.gov.example/job" }).sourcePlatform).toContain("地方人才");
    expect(classifyJobSource({ url: "https://training.example/java", snippet: "培训贷 包就业" }).sourceTrustLevel).toBe("low");
  });
});
