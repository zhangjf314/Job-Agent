import { inflateRawSync } from "node:zlib";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RawJobResult } from "@/types/job";
import { normalizeJobPost } from "./job-normalizer";
import { normalizeAndSaveJobPosts, matchJobsForProfile } from "./job-service";

type DbClient = PrismaClient;

const headerAliases: Record<string, string[]> = {
  title: ["岗位名称", "职位名称", "岗位", "职位", "title", "jobtitle"],
  company: ["公司", "公司名称", "企业", "company"],
  city: ["城市", "工作城市", "地点", "city", "location"],
  salaryText: ["薪资", "薪资范围", "salary"],
  description: ["岗位职责", "职责", "职位描述", "description", "responsibilities"],
  requirements: ["任职要求", "要求", "岗位要求", "requirements"],
  sourceUrl: ["来源链接", "岗位链接", "链接", "url", "sourceurl"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, "");
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function unzipEntries(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  for (let offset = 0; offset + 46 <= buffer.length;) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      offset += 1;
      continue;
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) files.set(name, compressed);
    if (method === 8) files.set(name, inflateRawSync(compressed));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return files;
}

function columnIndex(reference: string) {
  return reference.replace(/\d/g, "").split("").reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

export function parseXlsx(buffer: Buffer): string[][] {
  const files = unzipEntries(buffer);
  const sharedXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const shared = Array.from(sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)).map((match) =>
    decodeXml(Array.from(match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((item) => item[1]).join("")),
  );
  const sheetName = Array.from(files.keys()).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort()[0];
  if (!sheetName) throw new Error("Excel 文件中未找到工作表。");
  const sheet = files.get(sheetName)?.toString("utf8") ?? "";
  return Array.from(sheet.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)).map((rowMatch) => {
    const row: string[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = cell[1].match(/\br="([A-Z]+\d+)"/)?.[1] ?? "A1";
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1] ?? "";
      const raw = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]
        ?? cell[2].match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/)?.[1]
        ?? "";
      row[columnIndex(reference)] = type === "s" ? shared[Number(raw)] ?? "" : decodeXml(raw);
    }
    return row.map((value) => value ?? "");
  }).filter((row) => row.some(Boolean));
}

export function rowsToRawJobs(rows: string[][]): RawJobResult[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const find = (field: keyof typeof headerAliases) => headers.findIndex((header) => headerAliases[field].includes(header));
  const indexes = Object.fromEntries(Object.keys(headerAliases).map((field) => [field, find(field as keyof typeof headerAliases)]));
  if (indexes.title < 0) throw new Error("导入文件缺少“岗位名称”列。");
  return rows.slice(1, 201).filter((row) => row[indexes.title]?.trim()).map((row) => {
    const value = (field: string) => indexes[field] >= 0 ? row[indexes[field]]?.trim() ?? "" : "";
    const description = value("description");
    const requirements = value("requirements");
    return {
      title: value("title"),
      company: value("company"),
      city: value("city"),
      salaryText: value("salaryText"),
      description: description || requirements,
      requirements,
      sourceUrl: value("sourceUrl"),
      source: "manual",
      sourcePlatform: "批量文件导入",
      rawText: [value("title"), value("company"), value("city"), value("salaryText"), description, requirements].filter(Boolean).join("\n"),
    };
  });
}

export async function importJobFile(profileId: string, fileName: string, content: Buffer, db: DbClient = prisma) {
  const extension = fileName.toLowerCase().split(".").pop();
  const rows = extension === "xlsx" ? parseXlsx(content) : parseCsv(content.toString("utf8"));
  const rawJobs = rowsToRawJobs(rows);
  if (!rawJobs.length) throw new Error("导入文件中没有可识别的岗位记录。");
  const normalized = await Promise.all(rawJobs.map(normalizeJobPost));
  const jobs = await normalizeAndSaveJobPosts(normalized, db);
  const matches = profileId ? await matchJobsForProfile(profileId, jobs.map((job) => job.id), db) : [];
  return { totalFound: rawJobs.length, totalSaved: jobs.length, jobs, matches };
}
