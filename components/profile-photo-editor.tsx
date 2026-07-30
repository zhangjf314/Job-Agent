"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumBytes = 5 * 1024 * 1024;

export function ProfilePhotoEditor({
  profileId,
  initialHasPhoto,
  compact = false,
}: {
  profileId: string;
  initialHasPhoto: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasPhoto, setHasPhoto] = useState(initialHasPhoto);
  const [version, setVersion] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHasPhoto(initialHasPhoto);
  }, [initialHasPhoto]);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  function chooseFile(selected: File | undefined) {
    setError("");
    if (!selected) return;
    if (!acceptedTypes.includes(selected.type)) {
      setError("格式不支持，请选择 JPG、PNG 或 WebP。");
      return;
    }
    if (selected.size > maximumBytes) {
      setError("文件过大，图片不能超过 5 MB。");
      return;
    }
    if (source) URL.revokeObjectURL(source);
    setFile(selected);
    setSource(URL.createObjectURL(selected));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  }

  function closeCrop() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setFile(null);
    setCroppedArea(null);
    setSaving(false);
  }

  async function save() {
    if (!file || !croppedArea) return;
    setSaving(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("crop", JSON.stringify(croppedArea));
    try {
      const response = await fetch(`/api/profile/photo/${profileId}`, {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "照片保存失败。");
      setHasPhoto(true);
      setVersion(Date.now());
      closeCrop();
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "照片保存失败。");
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("确定删除职业档案主证件照吗？所有简历将自动回退为无照片布局。")) return;
    setError("");
    const response = await fetch(`/api/profile/photo/${profileId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("照片删除失败，请稍后重试。");
      return;
    }
    setHasPhoto(false);
    setVersion(Date.now());
    router.refresh();
  }

  return (
    <div
      data-profile-photo-editor
      className={compact ? "space-y-3" : "rounded-lg border p-4"}
    >
      <div className="flex flex-wrap items-start gap-4">
        {hasPhoto ? (
          <Image
            src={`/api/profile/photo/${profileId}?v=${version}`}
            alt="当前职业档案证件照"
            width={96}
            height={128}
            unoptimized
            className="h-32 w-24 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-md border border-dashed bg-muted text-xs text-muted-foreground">
            暂无照片
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          {!compact ? <div className="font-medium">证件照</div> : null}
          <p className="text-muted-foreground">
            建议使用近期正面证件照。支持 JPG、PNG、WebP，最大 5 MB，图片将裁剪为 3:4。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <Camera className="size-4" />
              {hasPhoto ? "替换照片" : "上传照片"}
            </Button>
            {hasPhoto ? (
              <Button type="button" variant="outline" onClick={remove}>
                <Trash2 className="size-4" />
                删除照片
              </Button>
            ) : null}
          </div>
          <Input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              chooseFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>

      {source ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl space-y-4 rounded-lg bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">裁剪证件照</h2>
                <p className="text-sm text-muted-foreground">拖动图片并调整缩放，保存区域固定为 3:4。</p>
              </div>
              <Button type="button" variant="outline" onClick={closeCrop} aria-label="取消裁剪">
                <X className="size-4" />
              </Button>
            </div>
            <div className="relative h-[480px] overflow-hidden rounded-md bg-neutral-900">
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                aspect={3 / 4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(area) => setCroppedArea(area)}
                objectFit="contain"
              />
            </div>
            <label className="block text-sm">
              缩放
              <input
                className="mt-2 w-full"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCrop}>取消</Button>
              <Button type="button" onClick={save} disabled={!croppedArea || saving}>
                {saving ? "保存中…" : "保存照片"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
