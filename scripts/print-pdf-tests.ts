import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";
import {
  calculateOnePageFit,
  ONE_PAGE_FIT_LIMITS,
} from "../lib/resume/one-page-fit";

function browserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fixtureHtml(input: {
  heightMm: number;
  mode: "standard" | "smart";
  scale?: number;
  photo?: string;
}) {
  const smart = input.mode === "smart";
  const scale = input.scale ?? 1;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { size: A4 portrait; margin: ${smart ? "0" : "16mm 14mm"}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #172033; }
.shell { ${smart ? "width:210mm;height:296mm;padding:8mm;" : ""} }
.content { width:${100 / scale}%; height:${input.heightMm}mm; zoom:${scale};
  background:linear-gradient(#fff,#f8fafc); font-size:10.5pt; line-height:1.3; }
h1 { margin:0 0 5mm; font-size:22pt; } h2 { margin:6mm 0 2mm; border-bottom:1px solid #94a3b8; }
.photo { float:right; width:28mm; height:37.333mm; object-fit:cover; margin-left:7mm; }
.marker { position:absolute; top:${Math.max(0, input.heightMm - 7)}mm; height:4mm; background:#0f766e; width:30mm; }
</style></head><body><main class="shell"><article class="content">
${input.photo ? `<img class="photo" src="${input.photo}" alt="fixture photo">` : ""}
<h1>个人求职助手 · PDF 验证样例</h1><h2>项目经历</h2>
<p>该夹具验证真实 Chromium PDF 页数、照片解码与末尾内容不被裁切。</p>
<div class="marker" data-end-marker></div>
</article></main></body></html>`;
}

async function pageCount(page: import("playwright").Page, html: string, path: string) {
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) =>
      image.complete ? Promise.resolve() : new Promise<void>((done) => {
        image.addEventListener("load", () => done(), { once: true });
        image.addEventListener("error", () => done(), { once: true });
      })));
  });
  const bytes = await page.pdf({ path, format: "A4", printBackground: true });
  return (await PDFDocument.load(bytes)).getPageCount();
}

async function main() {
  const executablePath = browserExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const directory = mkdtempSync(join(tmpdir(), "job-agent-print-"));
  const output: Record<string, number | string> = {};
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: "print" });
    const demoBytes = readFileSync(resolve("public/demo/fictional-profile-photo.webp"));
    const photo = "data:" + "image/webp;base64," + demoBytes.toString("base64");

    output.shortStandard = await pageCount(
      page,
      fixtureHtml({ heightMm: 240, mode: "standard", photo }),
      join(directory, "short-standard.pdf"),
    );
    output.shortSmart = await pageCount(
      page,
      fixtureHtml({ heightMm: 240, mode: "smart", photo }),
      join(directory, "short-smart.pdf"),
    );

    const fit = calculateOnePageFit({ contentHeight: 300, availableHeight: 277 });
    assert(fit.status === "fitted", "Expected the medium fixture to be fitted.");
    assert(fit.selectedScale >= ONE_PAGE_FIT_LIMITS.minimumScale, "Scale floor violated.");
    output.mediumScale = fit.selectedScale;
    output.mediumStandard = await pageCount(
      page,
      fixtureHtml({ heightMm: 300, mode: "standard" }),
      join(directory, "medium-standard.pdf"),
    );
    output.mediumSmart = await pageCount(
      page,
      fixtureHtml({ heightMm: 300, mode: "smart", scale: fit.selectedScale }),
      join(directory, "medium-smart.pdf"),
    );

    const overflow = calculateOnePageFit({ contentHeight: 360, availableHeight: 277 });
    assert(overflow.status === "cannot_fit", "Expected the long fixture to refuse unsafe scaling.");
    output.longStatus = overflow.status;
    output.longFallback = await pageCount(
      page,
      fixtureHtml({ heightMm: 360, mode: "standard", photo }),
      join(directory, "long-fallback.pdf"),
    );

    assert(output.shortStandard === 1, "Short standard fixture must be one page.");
    assert(output.shortSmart === 1, "Short smart fixture must be one page.");
    assert(Number(output.mediumStandard) >= 2, "Medium standard fixture must span pages.");
    assert(
      output.mediumSmart === 1,
      `Medium smart fixture must be exactly one page; received ${output.mediumSmart}.`,
    );
    assert(Number(output.longFallback) >= 2, "Cannot-fit fixture must retain standard pagination.");
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } finally {
    await browser.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
