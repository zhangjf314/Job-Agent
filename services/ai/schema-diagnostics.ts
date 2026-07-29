import { z, type ZodIssue, type ZodTypeAny } from "zod";

export const maximumStoredSchemaIssues = 20;

export type SafeSchemaIssueCategory =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_TYPE"
  | "INVALID_ENUM"
  | "ARRAY_TOO_SMALL"
  | "ARRAY_TOO_LARGE"
  | "STRING_TOO_SHORT"
  | "STRING_TOO_LONG"
  | "NUMBER_TOO_SMALL"
  | "NUMBER_TOO_LARGE"
  | "UNRECOGNIZED_KEYS"
  | "INVALID_UNION"
  | "INVALID_LITERAL"
  | "CUSTOM_VALIDATION"
  | "UNKNOWN_SCHEMA_ISSUE";

export type SafeSchemaIssue = {
  category: SafeSchemaIssueCategory;
  path: string;
  expectedType: string | null;
  receivedType: string | null;
  minimum: number | null;
  maximum: number | null;
  actualSize: number | null;
  unknownKeyCount: number | null;
};

export type SafeSchemaDiagnosticSummary = {
  schemaName: string;
  issueCount: number;
  reportedIssueCount: number;
  truncated: boolean;
  issues: SafeSchemaIssue[];
};

const safePathSegment = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const maximumPathLength = 256;

function safeSchemaName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_.-]{0,99}$/.test(value)
    ? value
    : "unknown_schema";
}

function collectSchemaPathSegments(
  schema: ZodTypeAny | undefined,
  result = new Set<string>(),
  visited = new Set<ZodTypeAny>(),
) {
  if (!schema || visited.has(schema)) return result;
  visited.add(schema);
  if (schema instanceof z.ZodObject) {
    for (const [key, child] of Object.entries(schema.shape)) {
      if (safePathSegment.test(key)) result.add(key);
      collectSchemaPathSegments(child as ZodTypeAny, result, visited);
    }
  } else if (schema instanceof z.ZodArray) {
    collectSchemaPathSegments(schema.element, result, visited);
  } else if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    collectSchemaPathSegments(schema.unwrap(), result, visited);
  } else if (schema instanceof z.ZodDefault) {
    collectSchemaPathSegments(schema.removeDefault(), result, visited);
  } else if (schema instanceof z.ZodEffects) {
    collectSchemaPathSegments(schema.innerType(), result, visited);
  }
  return result;
}

function safePath(
  path: Array<string | number>,
  allowedSegments: ReadonlySet<string>,
) {
  if (path.length === 0) return "(root)";
  let result = "";
  for (const segment of path) {
    const token = typeof segment === "number" &&
        Number.isSafeInteger(segment) &&
        segment >= 0
      ? `[${segment}]`
      : typeof segment === "string" &&
          safePathSegment.test(segment) &&
          allowedSegments.has(segment)
        ? `${result ? "." : ""}${segment}`
        : `${result ? "." : ""}[field]`;
    if (result.length + token.length > maximumPathLength) {
      const marker = `${result ? "." : ""}<path-truncated>`;
      return `${result.slice(0, maximumPathLength - marker.length)}${marker}`;
    }
    result += token;
  }
  return result || "(root)";
}

function valueAtPath(input: unknown, path: Array<string | number>) {
  let current = input;
  for (const segment of path) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

function normalizedType(value: unknown) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return typeof value;
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

function expectedType(value: unknown) {
  if (typeof value !== "string") return null;
  if (["string", "number", "boolean", "array", "object", "null", "undefined"].includes(value)) {
    return value;
  }
  if (["integer", "float", "nan", "bigint"].includes(value)) return "number";
  if (["date", "map", "set"].includes(value)) return "object";
  return "unknown";
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeActualSize(value: unknown) {
  if (typeof value === "string") return Array.from(value).length;
  if (Array.isArray(value)) return value.length;
  if (value instanceof Set) return value.size;
  return null;
}

function baseIssue(
  issue: ZodIssue,
  input: unknown,
  allowedPathSegments: ReadonlySet<string>,
): SafeSchemaIssue {
  const actual = valueAtPath(input, issue.path);
  return {
    category: "UNKNOWN_SCHEMA_ISSUE",
    path: safePath(issue.path, allowedPathSegments),
    expectedType: null,
    receivedType: normalizedType(actual),
    minimum: null,
    maximum: null,
    actualSize: null,
    unknownKeyCount: null,
  };
}

function summarizeIssue(
  issue: ZodIssue,
  input: unknown,
  allowedPathSegments: ReadonlySet<string>,
): SafeSchemaIssue {
  const result = baseIssue(issue, input, allowedPathSegments);
  const actual = valueAtPath(input, issue.path);

  switch (issue.code) {
    case "invalid_type":
      result.category = issue.received === "undefined"
        ? "MISSING_REQUIRED_FIELD"
        : "INVALID_TYPE";
      result.expectedType = expectedType(issue.expected);
      return result;
    case "invalid_enum_value":
      result.category = "INVALID_ENUM";
      result.expectedType = "enum";
      return result;
    case "too_small":
      result.minimum = finiteNumber(issue.minimum);
      result.actualSize = safeActualSize(actual);
      result.expectedType = expectedType(issue.type);
      result.category = issue.type === "array" || issue.type === "set"
        ? "ARRAY_TOO_SMALL"
        : issue.type === "string"
          ? "STRING_TOO_SHORT"
          : "NUMBER_TOO_SMALL";
      return result;
    case "too_big":
      result.maximum = finiteNumber(issue.maximum);
      result.actualSize = safeActualSize(actual);
      result.expectedType = expectedType(issue.type);
      result.category = issue.type === "array" || issue.type === "set"
        ? "ARRAY_TOO_LARGE"
        : issue.type === "string"
          ? "STRING_TOO_LONG"
          : "NUMBER_TOO_LARGE";
      return result;
    case "unrecognized_keys":
      result.category = "UNRECOGNIZED_KEYS";
      result.expectedType = "object";
      result.unknownKeyCount = issue.keys.length;
      return result;
    case "invalid_union":
      result.category = "INVALID_UNION";
      result.expectedType = "union";
      return result;
    case "invalid_literal":
      result.category = "INVALID_LITERAL";
      result.expectedType = "literal";
      return result;
    case "custom":
      result.category = "CUSTOM_VALIDATION";
      return result;
    default:
      return result;
  }
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function summarizeSchemaIssues(
  schemaName: string,
  issues: readonly ZodIssue[],
  input: unknown,
  schema?: ZodTypeAny,
  maximumIssues = maximumStoredSchemaIssues,
): SafeSchemaDiagnosticSummary {
  const safeMaximum = Number.isSafeInteger(maximumIssues) && maximumIssues >= 0
    ? Math.min(maximumIssues, maximumStoredSchemaIssues)
    : maximumStoredSchemaIssues;
  const allowedPathSegments = collectSchemaPathSegments(schema);
  const summarized = issues
    .map((issue) => summarizeIssue(issue, input, allowedPathSegments))
    .sort((left, right) =>
      compareText(left.path, right.path) ||
      compareText(left.category, right.category));
  const reported = summarized.slice(0, safeMaximum);
  return {
    schemaName: safeSchemaName(schemaName),
    issueCount: summarized.length,
    reportedIssueCount: reported.length,
    truncated: reported.length < summarized.length,
    issues: reported,
  };
}

export function safeSchemaDiagnosticMetadata(
  summary?: SafeSchemaDiagnosticSummary,
) {
  if (!summary) return {};
  const issues = summary.issues.map((issue) => ({
    category: issue.category,
    path: issue.path,
    expectedType: issue.expectedType,
    receivedType: issue.receivedType,
    minimum: issue.minimum,
    maximum: issue.maximum,
    actualSize: issue.actualSize,
    unknownKeyCount: issue.unknownKeyCount,
  }));
  return {
    schemaName: summary.schemaName,
    schemaIssueCount: summary.issueCount,
    schemaReportedIssueCount: summary.reportedIssueCount,
    schemaIssuesTruncated: summary.truncated,
    schemaIssueCategories: issues.map((issue) => issue.category),
    schemaIssuePaths: issues.map((issue) => issue.path),
    schemaExpectedTypes: issues.map((issue) => issue.expectedType),
    schemaReceivedTypes: issues.map((issue) => issue.receivedType),
    schemaDiagnosticSummary: {
      schemaName: summary.schemaName,
      issueCount: summary.issueCount,
      reportedIssueCount: summary.reportedIssueCount,
      truncated: summary.truncated,
      issues,
    },
  };
}
