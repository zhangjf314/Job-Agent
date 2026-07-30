import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient;

export const PROFILE_PHOTO_LIMITS = {
  maximumOriginalBytes: 5 * 1024 * 1024,
  minimumWidth: 300,
  minimumHeight: 400,
  maximumWidth: 6000,
  maximumHeight: 8000,
  outputWidth: 600,
  outputHeight: 800,
  maximumOutputBytes: 300 * 1024,
} as const;

export type PhotoCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class ProfilePhotoValidationError extends Error {
  constructor(
    public readonly code:
      | "file_too_large"
      | "unsupported_format"
      | "mime_mismatch"
      | "dimensions_too_small"
      | "dimensions_too_large"
      | "invalid_crop"
      | "damaged_image"
      | "output_too_large",
    message: string,
  ) {
    super(message);
    this.name = "ProfilePhotoValidationError";
  }
}

function detectedMimeType(input: Buffer) {
  if (
    input.length >= 12 &&
    input.subarray(0, 4).toString("ascii") === "RIFF" &&
    input.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  if (
    input.length >= 8 &&
    input.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) return "image/png";
  if (
    input.length >= 3 &&
    input[0] === 0xff &&
    input[1] === 0xd8 &&
    input[2] === 0xff
  ) return "image/jpeg";
  return null;
}

function validateCrop(crop: PhotoCrop | undefined): PhotoCrop {
  const value = crop ?? { x: 0, y: 0, width: 100, height: 100 };
  const values = [value.x, value.y, value.width, value.height];
  if (
    values.some((item) => !Number.isFinite(item)) ||
    value.x < 0 ||
    value.y < 0 ||
    value.width <= 0 ||
    value.height <= 0 ||
    value.x + value.width > 100.001 ||
    value.y + value.height > 100.001
  ) {
    throw new ProfilePhotoValidationError("invalid_crop", "裁剪区域无效。");
  }
  return value;
}

export async function processProfilePhoto(input: {
  bytes: Buffer;
  declaredMimeType: string;
  crop?: PhotoCrop;
}) {
  if (input.bytes.length > PROFILE_PHOTO_LIMITS.maximumOriginalBytes) {
    throw new ProfilePhotoValidationError("file_too_large", "图片不能超过 5 MB。");
  }
  const detected = detectedMimeType(input.bytes);
  if (!detected) {
    throw new ProfilePhotoValidationError(
      "unsupported_format",
      "仅支持 JPEG、PNG 和 WebP 图片。",
    );
  }
  if (detected !== input.declaredMimeType) {
    throw new ProfilePhotoValidationError(
      "mime_mismatch",
      "文件内容与声明格式不一致。",
    );
  }

  const crop = validateCrop(input.crop);
  let oriented: Buffer;
  let width: number;
  let height: number;
  try {
    const decoded = await sharp(input.bytes, {
      failOn: "error",
      limitInputPixels:
        PROFILE_PHOTO_LIMITS.maximumWidth *
        PROFILE_PHOTO_LIMITS.maximumHeight,
    })
      .rotate()
      .toBuffer({ resolveWithObject: true });
    oriented = decoded.data;
    width = decoded.info.width;
    height = decoded.info.height;
  } catch {
    throw new ProfilePhotoValidationError("damaged_image", "图片已损坏或无法解码。");
  }

  if (
    width < PROFILE_PHOTO_LIMITS.minimumWidth ||
    height < PROFILE_PHOTO_LIMITS.minimumHeight
  ) {
    throw new ProfilePhotoValidationError(
      "dimensions_too_small",
      "图片尺寸至少需要 300 × 400。",
    );
  }
  if (
    width > PROFILE_PHOTO_LIMITS.maximumWidth ||
    height > PROFILE_PHOTO_LIMITS.maximumHeight
  ) {
    throw new ProfilePhotoValidationError(
      "dimensions_too_large",
      "图片尺寸不能超过 6000 × 8000。",
    );
  }

  const left = Math.max(0, Math.min(width - 1, Math.round((crop.x / 100) * width)));
  const top = Math.max(0, Math.min(height - 1, Math.round((crop.y / 100) * height)));
  const extractWidth = Math.max(
    1,
    Math.min(width - left, Math.round((crop.width / 100) * width)),
  );
  const extractHeight = Math.max(
    1,
    Math.min(height - top, Math.round((crop.height / 100) * height)),
  );

  for (const quality of [86, 80, 74, 68, 62]) {
    const data = await sharp(oriented)
      .extract({ left, top, width: extractWidth, height: extractHeight })
      .resize(
        PROFILE_PHOTO_LIMITS.outputWidth,
        PROFILE_PHOTO_LIMITS.outputHeight,
        { fit: "cover", position: "centre" },
      )
      .flatten({ background: "#ffffff" })
      .webp({ quality })
      .toBuffer();
    if (data.length <= PROFILE_PHOTO_LIMITS.maximumOutputBytes) {
      return {
        data,
        mimeType: "image/webp" as const,
        width: PROFILE_PHOTO_LIMITS.outputWidth,
        height: PROFILE_PHOTO_LIMITS.outputHeight,
        byteSize: data.length,
      };
    }
  }
  throw new ProfilePhotoValidationError(
    "output_too_large",
    "处理后的图片仍然过大，请选择更简单的照片。",
  );
}

export async function saveProfilePhoto(
  profileId: string,
  processed: Awaited<ReturnType<typeof processProfilePhoto>>,
  db: DbClient = prisma,
) {
  return db.profilePhotoAsset.upsert({
    where: { profileId },
    update: processed,
    create: { profileId, ...processed },
    select: { id: true, profileId: true, byteSize: true, updatedAt: true },
  });
}

export async function deleteProfilePhoto(
  profileId: string,
  db: DbClient = prisma,
) {
  return db.profilePhotoAsset.deleteMany({ where: { profileId } });
}

export async function getProfilePhoto(
  profileId: string,
  db: DbClient = prisma,
) {
  return db.profilePhotoAsset.findUnique({ where: { profileId } });
}

export function profilePhotoEtag(data: Uint8Array) {
  return `"${createHash("sha256").update(data).digest("base64url")}"`;
}
