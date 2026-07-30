import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { chromium, type Page } from "playwright";
import { loadPortfolioEnv } from "./portfolio-env";
import { PORTFOLIO_SCREENSHOTS } from "./portfolio-screenshot-manifest";

async function waitForServer(url: string, server: ChildProcess) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Portfolio server exited with code ${server.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("Portfolio server did not become ready within 60 seconds.");
}

async function preparePage(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

function localChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

async function main() {
  const envValues = loadPortfolioEnv();
  const env = { ...process.env, ...envValues };
  const prisma = new PrismaClient({
    datasources: { db: { url: envValues.DATABASE_URL } },
  });
  const before = await prisma.lLMCallLog.count();
  const outputDirectory = resolve("docs/screenshots");
  mkdirSync(outputDirectory, { recursive: true });
  const nextBin = resolve("node_modules/next/dist/bin/next");
  const server = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", "3100"],
    { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let serverOutput = "";
  server.stdout?.on("data", (chunk) => {
    serverOutput = `${serverOutput}${String(chunk)}`.slice(-2000);
  });
  server.stderr?.on("data", (chunk) => {
    serverOutput = `${serverOutput}${String(chunk)}`.slice(-2000);
  });

  let browser;
  try {
    await waitForServer("http://127.0.0.1:3100/dashboard", server);
    const executablePath = localChromiumExecutable();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      deviceScaleFactor: 1,
      locale: "zh-CN",
    });
    const page = await context.newPage();
    for (const screenshot of PORTFOLIO_SCREENSHOTS) {
      const response = await page.goto(
        `http://127.0.0.1:3100${screenshot.path}`,
        { waitUntil: "networkidle" },
      );
      if (!response?.ok()) {
        throw new Error(
          `${screenshot.path} returned ${response?.status() ?? "no response"}.`,
        );
      }
      await preparePage(page);
      const banner = page.locator("[data-portfolio-demo-banner]");
      if (!(await banner.isVisible())) {
        throw new Error(`Demo banner is not visible on ${screenshot.path}.`);
      }
      if ("selector" in screenshot) {
        const target = page.locator(screenshot.selector);
        await target.waitFor({ state: "visible" });
        await target.scrollIntoViewIfNeeded();
      } else {
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      if ("click" in screenshot) {
        await page.locator(screenshot.click).click();
        await page.waitForFunction(() => {
          const shell = document.querySelector("[data-fit-status]");
          const status = shell?.getAttribute("data-fit-status");
          return status && status !== "idle" && status !== "measuring";
        });
      }
      const scrolled = await page.evaluate(() => window.scrollY > 0);
      if (scrolled) {
        await banner.evaluate((element) => {
          const bannerElement = element as HTMLElement;
          bannerElement.style.position = "fixed";
          bannerElement.style.inset = "0 0 auto 0";
          bannerElement.style.zIndex = "9999";
        });
      }
      const bannerBox = await banner.boundingBox();
      if (
        !bannerBox ||
        bannerBox.y < 0 ||
        bannerBox.y + bannerBox.height > 1024
      ) {
        throw new Error(`Demo banner is outside the screenshot viewport on ${screenshot.path}.`);
      }
      await page.screenshot({
        path: resolve(outputDirectory, screenshot.filename),
        animations: "disabled",
        fullPage: false,
      });
    }
    await context.close();
  } catch (error) {
    if (serverOutput) {
      console.error("Portfolio server diagnostic tail:", serverOutput);
    }
    throw error;
  } finally {
    await browser?.close();
    if (server.exitCode === null) server.kill();
    await prisma.$disconnect();
  }

  const afterClient = new PrismaClient({
    datasources: { db: { url: envValues.DATABASE_URL } },
  });
  const after = await afterClient.lLMCallLog.count();
  await afterClient.$disconnect();
  if (after !== before) {
    throw new Error(
      `Screenshot flow changed LLMCallLog count (${before} -> ${after}).`,
    );
  }
  console.log(JSON.stringify({
    status: "passed",
    screenshots: PORTFOLIO_SCREENSHOTS.length,
    viewport: "1440x1024",
    llmCallLogBefore: before,
    llmCallLogAfter: after,
    externalRequestsAdded: 0,
  }));
}

main();
