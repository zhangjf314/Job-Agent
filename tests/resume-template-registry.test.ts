import { describe, expect, it } from "vitest";
import { defaultResumeTemplateKey } from "@/types/resume";
import {
  getResumeTemplate,
  listResumeTemplates,
  resolveResumeTemplateKey,
} from "@/services/resume-templates/registry";

describe("resume template registry", () => {
  it("contains the four supported templates", () => {
    expect(listResumeTemplates().map((template) => template.key)).toEqual([
      "minimal",
      "elegant",
      "dark",
      "photo",
    ]);
  });

  it("uses minimal as the default template", () => {
    expect(defaultResumeTemplateKey).toBe("minimal");
    expect(getResumeTemplate(undefined).key).toBe("minimal");
  });

  it("resolves valid keys and safely falls back for invalid legacy values", () => {
    expect(getResumeTemplate("dark").name).toBe("深色");
    expect(resolveResumeTemplateKey("removed-template")).toBe("minimal");
  });

  it("declares photo support only on the photo template", () => {
    expect(listResumeTemplates().filter((template) => template.supportsPhoto).map((template) => template.key)).toEqual([
      "photo",
    ]);
  });
});
