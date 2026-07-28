import { describe, expect, it } from "vitest";
import { parseTailorResumeFormData } from "@/app/jd/form-parsers";

describe("jd actions", () => {
  it("parses tailor resume form data", () => {
    const formData = new FormData();
    formData.set("profileId", "profile_1");
    formData.set("baseResumeId", "resume_1");
    formData.set("title", "Java 后端");
    formData.set("company", "测试公司");
    formData.set("city", "杭州");
    formData.set("sourceUrl", "https://example.com/jd");
    formData.set("rawText", "Java Spring Boot MySQL");

    expect(parseTailorResumeFormData(formData)).toMatchObject({
      profileId: "profile_1",
      baseResumeId: "resume_1",
      resumeId: "resume_1",
      title: "Java 后端",
      rawText: "Java Spring Boot MySQL",
    });
  });
});
