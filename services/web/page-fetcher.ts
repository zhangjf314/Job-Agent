import { appConfig } from "@/lib/config";

export async function fetchPublicPage(url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only public http/https URLs are supported.");
  if (!appConfig.enableCompanyPageFetch) throw new Error("Company page fetch is disabled.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), appConfig.jobFetchTimeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": appConfig.userAgent } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    if (!/text\/html|text\/plain/.test(type)) throw new Error("Unsupported content type.");
    const text = await res.text();
    return text.slice(0, 2 * 1024 * 1024);
  } finally {
    clearTimeout(timer);
  }
}
