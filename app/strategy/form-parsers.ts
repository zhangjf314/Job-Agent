import type { ActionStatus } from "@/types/strategy";

export function parseActionStatusFormData(formData: FormData) {
  return {
    itemId: String(formData.get("itemId") ?? ""),
    status: String(formData.get("status") ?? "todo") as ActionStatus,
  };
}
