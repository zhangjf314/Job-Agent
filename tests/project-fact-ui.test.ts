import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return readFileSync(resolve(file), "utf8");
}

describe("project fact UI and persistence wiring", () => {
  const editor = source("components/project-fact-atom-editor.tsx");
  const profileForm = source("components/career-profile-form.tsx");
  const profileService = source("services/career-profile-service.ts");
  const resumePage = source("app/resume/[id]/page.tsx");

  it("keeps the complete project description as a distinct editable field", () => {
    expect(profileForm).toContain('register(`projectItems.${index}.fullDescription`)');
    expect(profileForm).toContain("完整项目描述");
  });

  it("supports create, edit, delete, ordering and structured sync", () => {
    expect(editor).toContain("createProjectFactAtomAction");
    expect(editor).toContain("updateProjectFactAtomAction");
    expect(editor).toContain("deleteProjectFactAtomAction");
    expect(editor).toContain("moveProjectFactAtomAction");
    expect(editor).toContain("syncProjectFactAtomsAction");
    expect(editor).toContain("上移");
    expect(editor).toContain("下移");
  });

  it("shows completeness hints and the explicit truthful-fact instruction", () => {
    expect(editor).toContain("项目事实完整度");
    expect(editor).toContain("只填写自己真实完成、能够在面试中解释的内容");
    expect(editor).toContain("该项目缺少");
  });

  it("preserves retained project IDs and atoms during profile saves", () => {
    expect(profileService).toContain("retainedIds");
    expect(profileService).toContain("transaction.projectItem.update");
    expect(profileService).not.toContain("projectFactAtom.deleteMany");
  });

  it("renders complete and tailored project descriptions separately without Fact IDs", () => {
    expect(resumePage).toContain("完整项目描述与岗位定制描述");
    expect(resumePage).toContain("职业档案完整描述");
    expect(resumePage).toContain("岗位定制项目描述");
    expect(resumePage).toContain("事实依据摘要");
    expect(resumePage).not.toContain("F_PROJECT_");
  });
});
