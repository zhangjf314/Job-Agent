import { describe, expect, it } from "vitest";
import { parseCsv, rowsToRawJobs } from "@/services/jobs/job-file-importer";

describe("job file importer", () => {
  it("parses CSV rows with quoted multiline descriptions", () => {
    const rows = parseCsv('岗位名称,公司,城市,薪资,岗位职责,任职要求\nJava 后端实习生,示例科技,杭州,150-200元/天,"负责接口开发,\n参与代码评审",本科，熟悉 Java 和 Spring Boot');
    const jobs = rowsToRawJobs(rows);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ title: "Java 后端实习生", company: "示例科技", city: "杭州" });
    expect(jobs[0].description).toContain("代码评审");
  });

  it("requires a recognizable title column", () => {
    expect(() => rowsToRawJobs([["公司"], ["示例科技"]])).toThrow("岗位名称");
  });
});
