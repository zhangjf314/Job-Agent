import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseManualApplicationFormData } from "@/app/applications/form-parsers";

describe("application actions", () => {
  it("parses manual application form data", () => {
    const form = new FormData();
    form.set("profileId", "profile_1");
    form.set("company", "Example Tech");
    form.set("jobTitle", "Java 后端开发");
    form.set("city", "杭州");
    form.set("channel", "online_platform");
    form.set("priority", "high");
    expect(parseManualApplicationFormData(form)).toMatchObject({
      profileId: "profile_1",
      company: "Example Tech",
      jobTitle: "Java 后端开发",
      priority: "high",
    });
  });

  it("keeps Application cascade under CareerProfile but not JobPost", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("applications             Application[]");
    expect(schema).toMatch(/profile\s+CareerProfile\s+@relation\(fields: \[profileId\], references: \[id\], onDelete: Cascade\)/);
    expect(schema).toMatch(/jobPost\s+JobPost\?\s+@relation\(fields: \[jobPostId\], references: \[id\], onDelete: SetNull\)/);
  });

  it("does not define automatic external delivery integrations", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).not.toContain("EmailDelivery");
    expect(schema).not.toContain("AutoApply");
    expect(schema).not.toContain("PlatformLogin");
  });
});
