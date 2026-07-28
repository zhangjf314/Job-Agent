import { describe, expect, it } from "vitest";
import { analyzeJDText } from "@/services/jd-analyzer";

const javaJD = `
岗位：Java 后端开发工程师（应届生）
实习至少 3 个月，每周 4 天，表现优秀可转正。
职责：负责交易平台后端服务设计、开发和优化，参与接口联调和问题排查。
要求：本科及以上学历，计算机或软件工程相关专业。
熟悉 Java、Spring Boot、MySQL、Redis，了解 SQL 优化。
具备良好的沟通协作能力和学习能力。
`;

describe("analyzeJDText", () => {
  it("extracts skills, education and seniority from a Chinese Java backend JD", () => {
    const result = analyzeJDText(javaJD);

    expect(result.hardSkills).toEqual(expect.arrayContaining(["Java", "Spring Boot", "MySQL", "Redis"]));
    expect(result.educationRequirements.join(" ")).toContain("本科");
    expect(["new_grad", "intern"]).toContain(result.seniorityLevel);
    expect(result.internshipDuration).toContain("3");
    expect(result.conversionOpportunity).toBe("有转正机会");
    expect(result.candidateProfile.length).toBeGreaterThan(0);
  });
});
