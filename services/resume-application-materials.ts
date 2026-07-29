export type ResumeApplicationMaterials = {
  selfIntroduction: string;
  applicationEmail: string;
  recruiterMessage: string;
};

export function getApplicationMaterials(
  value: unknown,
): ResumeApplicationMaterials | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("applicationMaterials" in value)
  ) return null;
  const materials = (value as { applicationMaterials?: unknown })
    .applicationMaterials;
  if (!materials || typeof materials !== "object") return null;
  const item = materials as Record<string, unknown>;
  if (
    ![item.selfIntroduction, item.applicationEmail, item.recruiterMessage].every(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    )
  ) return null;
  return item as ResumeApplicationMaterials;
}
