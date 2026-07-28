import { toFriendlyError } from "@/lib/errors";

export type SafeActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export async function safeActionResult<T>(operation: () => Promise<T>): Promise<SafeActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const friendly = toFriendlyError(error);
    return { ok: false, error: { code: friendly.code, message: friendly.message } };
  }
}
