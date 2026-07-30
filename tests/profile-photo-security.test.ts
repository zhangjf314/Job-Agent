import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  PROFILE_PHOTO_LIMITS,
  ProfilePhotoValidationError,
  processProfilePhoto,
  profilePhotoEtag,
} from "@/services/profile-photo-service";

async function image(
  format: "jpeg" | "png" | "webp" = "jpeg",
  width = 900,
  height = 1200,
) {
  return sharp({
    create: { width, height, channels: 3, background: "#7aa6a1" },
  })[format]().toBuffer();
}

async function errorCode(task: Promise<unknown>) {
  try {
    await task;
    return "none";
  } catch (error) {
    expect(error).toBeInstanceOf(ProfilePhotoValidationError);
    return (error as ProfilePhotoValidationError).code;
  }
}

describe("profile photo security and normalization", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)("accepts genuine %s input and always normalizes it", async (format, mime) => {
    const result = await processProfilePhoto({
      bytes: await image(format),
      declaredMimeType: mime,
    });
    const metadata = await sharp(result.data).metadata();

    expect(result.mimeType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(PROFILE_PHOTO_LIMITS.outputWidth);
    expect(metadata.height).toBe(PROFILE_PHOTO_LIMITS.outputHeight);
    expect(result.byteSize).toBeLessThanOrEqual(PROFILE_PHOTO_LIMITS.maximumOutputBytes);
  });

  it("rejects input larger than 5 MB before decoding", async () => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: Buffer.alloc(PROFILE_PHOTO_LIMITS.maximumOriginalBytes + 1),
        declaredMimeType: "image/jpeg",
      })),
    ).toBe("file_too_large");
  });

  it("rejects unsupported file signatures", async () => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: Buffer.from("not an image"),
        declaredMimeType: "image/jpeg",
      })),
    ).toBe("unsupported_format");
  });

  it("rejects a fake extension/MIME declaration", async () => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: await image("png"),
        declaredMimeType: "image/jpeg",
      })),
    ).toBe("mime_mismatch");
  });

  it("rejects damaged image payloads with a valid magic header", async () => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]),
        declaredMimeType: "image/jpeg",
      })),
    ).toBe("damaged_image");
  });

  it("rejects dimensions below 300 x 400", async () => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: await image("jpeg", 299, 400),
        declaredMimeType: "image/jpeg",
      })),
    ).toBe("dimensions_too_small");
  });

  it("rejects dimensions above 6000 x 8000", async () => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: await image("jpeg", 6001, 400),
        declaredMimeType: "image/jpeg",
      })),
    ).toBe("dimensions_too_large");
  });

  it.each([
    { x: -1, y: 0, width: 50, height: 50 },
    { x: 0, y: 0, width: 0, height: 50 },
    { x: 80, y: 0, width: 30, height: 50 },
    { x: 0, y: Number.NaN, width: 50, height: 50 },
  ])("rejects invalid percent crop %#", async (crop) => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: await image(),
        declaredMimeType: "image/jpeg",
        crop,
      })),
    ).toBe("invalid_crop");
  });

  it("honors EXIF orientation and strips source metadata", async () => {
    const source = await sharp({
      create: { width: 600, height: 400, channels: 3, background: "#334155" },
    }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await processProfilePhoto({
      bytes: source,
      declaredMimeType: "image/jpeg",
    });
    const metadata = await sharp(result.data).metadata();

    expect(metadata.width).toBe(600);
    expect(metadata.height).toBe(800);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("accepts a valid bounded crop and still emits 3:4 output", async () => {
    const result = await processProfilePhoto({
      bytes: await image("png"),
      declaredMimeType: "image/png",
      crop: { x: 10, y: 10, width: 60, height: 70 },
    });
    expect([result.width, result.height]).toEqual([600, 800]);
  });

  it("rejects a generic binary MIME even when image bytes are genuine", async () => {
    expect(
      await errorCode(processProfilePhoto({
        bytes: await image("jpeg"),
        declaredMimeType: "application/octet-stream",
      })),
    ).toBe("mime_mismatch");
  });

  it("produces deterministic bytes for the same source and crop", async () => {
    const bytes = await image("webp");
    const first = await processProfilePhoto({ bytes, declaredMimeType: "image/webp" });
    const second = await processProfilePhoto({ bytes, declaredMimeType: "image/webp" });
    expect(first.data.equals(second.data)).toBe(true);
  });

  it("does not retain an alpha channel from a transparent PNG", async () => {
    const transparent = await sharp({
      create: { width: 600, height: 800, channels: 4, background: "#7aa6a180" },
    }).png().toBuffer();
    const result = await processProfilePhoto({
      bytes: transparent,
      declaredMimeType: "image/png",
    });
    expect((await sharp(result.data).metadata()).hasAlpha).toBe(false);
  });

  it("uses a stable strong ETag without exposing bytes", async () => {
    const data = await image("webp");
    expect(profilePhotoEtag(data)).toMatch(/^"[A-Za-z0-9_-]{43}"$/);
    expect(profilePhotoEtag(data)).toBe(profilePhotoEtag(Buffer.from(data)));
    expect(profilePhotoEtag(Buffer.from("different"))).not.toBe(profilePhotoEtag(data));
  });

  it("contains no remote image fetch, image logging, or committed Base64 image", () => {
    const service = readFileSync(resolve("services/profile-photo-service.ts"), "utf8");
    const route = readFileSync(resolve("app/api/profile/photo/[profileId]/route.ts"), "utf8");

    expect(service).not.toMatch(/\bfetch\s*\(/);
    expect(service).not.toMatch(/console\.(log|info|debug)/);
    expect(route).not.toMatch(/console\.(log|info|debug)/);
    expect(`${service}\n${route}`).not.toContain(["data:", "image/"].join(""));
  });
});
