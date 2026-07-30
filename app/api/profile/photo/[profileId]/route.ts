import { getCurrentUser } from "@/services/auth/current-user";
import {
  deleteProfilePhoto,
  getProfilePhoto,
  processProfilePhoto,
  profilePhotoEtag,
  ProfilePhotoValidationError,
  saveProfilePhoto,
  type PhotoCrop,
} from "@/services/profile-photo-service";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ profileId: string }> };

async function ownedProfile(profileId: string) {
  const user = await getCurrentUser();
  return prisma.careerProfile.findFirst({
    where: { id: profileId, userId: user.id },
    select: { id: true },
  });
}

export async function GET(request: Request, { params }: Context) {
  const { profileId } = await params;
  if (!(await ownedProfile(profileId))) return new Response(null, { status: 404 });
  const asset = await getProfilePhoto(profileId);
  if (!asset) return new Response(null, { status: 404 });
  const etag = profilePhotoEtag(asset.data);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }
  return new Response(asset.data, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(asset.byteSize),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
      ETag: etag,
    },
  });
}

export async function POST(request: Request, { params }: Context) {
  const { profileId } = await params;
  if (!(await ownedProfile(profileId))) return Response.json({ error: "未找到职业档案。" }, { status: 404 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "请选择图片。" }, { status: 400 });
    }
    let crop: PhotoCrop;
    try {
      crop = JSON.parse(String(form.get("crop") ?? "{}")) as PhotoCrop;
    } catch {
      throw new ProfilePhotoValidationError("invalid_crop", "裁剪区域无效。");
    }
    const processed = await processProfilePhoto({
      bytes: Buffer.from(await file.arrayBuffer()),
      declaredMimeType: file.type,
      crop,
    });
    const saved = await saveProfilePhoto(profileId, processed);
    return Response.json({ ok: true, updatedAt: saved.updatedAt.toISOString() });
  } catch (error) {
    if (error instanceof ProfilePhotoValidationError) {
      return Response.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return Response.json({ error: "照片保存失败，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { profileId } = await params;
  if (!(await ownedProfile(profileId))) return Response.json({ error: "未找到职业档案。" }, { status: 404 });
  await deleteProfilePhoto(profileId);
  return Response.json({ ok: true });
}
