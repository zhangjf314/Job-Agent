import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { markdownToHtml } from "@/lib/markdown-to-html";
import {
  deleteProfilePhoto,
  getProfilePhoto,
  saveProfilePhoto,
} from "@/services/profile-photo-service";
import {
  renderResumeMarkdown,
  type ResumeTemplateData,
} from "@/services/resume-templates/renderer";

function source(file: string) {
  return readFileSync(resolve(file), "utf8");
}

function resume(overrides: Partial<ResumeTemplateData> = {}): ResumeTemplateData {
  return {
    title: "演示简历",
    contentMarkdown: "## 项目经历\n\n- 完成可靠交付",
    templateKey: "photo",
    showPhoto: true,
    profile: {
      id: "profile_demo",
      photoAsset: { id: "photo_demo", updatedAt: new Date(1_700_000_000_000) },
      basicInfo: { realName: "演示用户" },
    },
    ...overrides,
  };
}

describe("profile photo UI and persistence wiring", () => {
  it("shows the editor on the career profile detail", () => {
    expect(source("app/profile/[id]/page.tsx")).toContain("<ProfilePhotoEditor");
  });

  it("shows the same profile photo entry on the resume detail", () => {
    expect(source("app/resume/[id]/page.tsx")).toContain("<ProfilePhotoEditor");
  });

  it("offers JPEG, PNG, and WebP selection", () => {
    const editor = source("components/profile-photo-editor.tsx");
    expect(editor).toContain("image/jpeg");
    expect(editor).toContain("image/png");
    expect(editor).toContain("image/webp");
  });

  it("fixes the cropper aspect ratio to 3:4", () => {
    expect(source("components/profile-photo-editor.tsx")).toContain("aspect={3 / 4}");
  });

  it("uploads with multipart form data and never serializes image Base64", () => {
    const editor = source("components/profile-photo-editor.tsx");
    expect(editor).toContain("new FormData()");
    expect(editor).not.toContain("readAsDataURL");
  });

  it("supports replacement through a stable profile-scoped endpoint", () => {
    const upsert = vi.fn().mockResolvedValue({ id: "photo_demo" });
    const db = { profilePhotoAsset: { upsert } } as unknown as PrismaClient;
    const processed = {
      data: Buffer.from("webp"),
      mimeType: "image/webp" as const,
      width: 600 as const,
      height: 800 as const,
      byteSize: 4,
    };
    return saveProfilePhoto("profile_demo", processed, db).then(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { profileId: "profile_demo" },
      }));
    });
  });

  it("supports deletion without deleting the profile or resume", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { profilePhotoAsset: { deleteMany } } as unknown as PrismaClient;
    await deleteProfilePhoto("profile_demo", db);
    expect(deleteMany).toHaveBeenCalledWith({ where: { profileId: "profile_demo" } });
  });

  it("loads the asset by profile id", async () => {
    const findUnique = vi.fn().mockResolvedValue({ profileId: "profile_demo" });
    const db = { profilePhotoAsset: { findUnique } } as unknown as PrismaClient;
    await getProfilePhoto("profile_demo", db);
    expect(findUnique).toHaveBeenCalledWith({ where: { profileId: "profile_demo" } });
  });

  it("renders the photo only in a photo-capable template", () => {
    const photo = renderResumeMarkdown(resume());
    const minimal = renderResumeMarkdown(resume({ templateKey: "minimal" }));
    expect(markdownToHtml(photo.markdown)).toContain("resume-profile-photo");
    expect(markdownToHtml(minimal.markdown)).not.toContain("<img");
  });

  it("honors per-resume photo visibility", () => {
    const rendered = renderResumeMarkdown(resume({ showPhoto: false }));
    expect(markdownToHtml(rendered.markdown)).not.toContain("<img");
  });

  it("falls back cleanly when the asset is missing", () => {
    const rendered = renderResumeMarkdown(resume({
      profile: { id: "profile_demo", photoAsset: null, basicInfo: { realName: "演示用户" } },
    }));
    expect(rendered.markdown).not.toContain("PROFILE_PHOTO");
    expect(markdownToHtml(rendered.markdown)).not.toContain("<img");
  });

  it("only converts the strict internal photo token, not arbitrary user URLs", () => {
    const html = markdownToHtml(
      "[[PROFILE_PHOTO:https://attacker.example/photo.jpg]]\n\n[[PROFILE_PHOTO:/api/profile/photo/profile_demo?v=1700000000000]]",
    );
    expect(html).not.toContain('src="https://attacker.example');
    expect(html).toContain('src="/api/profile/photo/profile_demo?v=1700000000000"');
  });
});
