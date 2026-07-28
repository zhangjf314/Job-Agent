import { describe, expect, it } from "vitest";
import { careerProfileSchema } from "@/schemas/career-profile";
import { createMockGraduateProfile } from "@/services/mock-profile";

describe("careerProfileSchema", () => {
  it("accepts the mainland China graduate mock profile", () => {
    const result = careerProfileSchema.safeParse(createMockGraduateProfile("user_1"));
    expect(result.success).toBe(true);
  });

  it("rejects invalid email, phone and url", () => {
    const input = createMockGraduateProfile("user_1");
    input.basicInfo = {
      ...input.basicInfo!,
      phone: "12345",
      email: "bad-email",
      githubUrl: "not-a-url",
    };

    const result = careerProfileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("requires target roles and target cities", () => {
    const input = createMockGraduateProfile("user_1");
    input.targetRoles = [];
    input.targetCities = [];

    const result = careerProfileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
