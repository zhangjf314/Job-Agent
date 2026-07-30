import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { PNG } from "pngjs";
import { PORTFOLIO_SCREENSHOTS } from "./portfolio-screenshot-manifest";

const screenshotDirectory = resolve("docs/screenshots");
const expected = PORTFOLIO_SCREENSHOTS.map((item) => item.filename).sort();
const forbidden = [
  /D:\\Agents/i,
  /localhost password/i,
  /sk-[A-Za-z0-9_-]+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /Authorization\s*:/i,
];

function assertNotBlank(png: PNG, filename: string) {
  const colors = new Set<string>();
  let minimum = 255;
  let maximum = 0;
  const pixelCount = png.width * png.height;
  const step = Math.max(1, Math.floor(pixelCount / 20_000));
  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const index = pixel * 4;
    const red = png.data[index];
    const green = png.data[index + 1];
    const blue = png.data[index + 2];
    colors.add(`${red},${green},${blue}`);
    const brightness = Math.round((red + green + blue) / 3);
    minimum = Math.min(minimum, brightness);
    maximum = Math.max(maximum, brightness);
  }
  if (colors.size < 10 || maximum - minimum < 20) {
    throw new Error(`${filename} appears blank or visually uniform.`);
  }
}

function main() {
  if (!existsSync(screenshotDirectory)) {
    throw new Error("docs/screenshots does not exist.");
  }
  const actual = readdirSync(screenshotDirectory)
    .filter((filename) => filename.toLowerCase().endsWith(".png"))
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Screenshot set mismatch. Expected ${expected.join(", ")}; received ${actual.join(", ")}.`,
    );
  }

  const imageHashes = new Map<string, string>();
  for (const filename of expected) {
    const filePath = resolve(screenshotDirectory, filename);
    const bytes = readFileSync(filePath);
    if (statSync(filePath).size < 15_000) {
      throw new Error(`${filename} is unexpectedly small.`);
    }
    const png = PNG.sync.read(bytes);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const duplicate = imageHashes.get(hash);
    if (duplicate) {
      throw new Error(`${filename} duplicates ${duplicate}.`);
    }
    imageHashes.set(hash, filename);
    if (png.width !== 1440 || png.height !== 1024) {
      throw new Error(
        `${filename} has ${png.width}x${png.height}; expected 1440x1024.`,
      );
    }
    assertNotBlank(png, filename);
    const searchable = `${basename(filePath)}\n${bytes.toString("latin1")}`;
    for (const pattern of forbidden) {
      if (pattern.test(searchable)) {
        throw new Error(`${filename} contains a forbidden marker.`);
      }
    }
  }

  const readme = readFileSync(resolve("README.md"), "utf8");
  for (const filename of expected) {
    if (!readme.includes(`docs/screenshots/${filename}`)) {
      throw new Error(`README does not reference ${filename}.`);
    }
  }
  console.log(JSON.stringify({
    status: "passed",
    screenshots: expected.length,
    dimensions: "1440x1024",
    blankImages: 0,
    unexpectedImages: 0,
    missingReadmeReferences: 0,
  }));
}

main();
