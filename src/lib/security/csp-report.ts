export type JsonRecord = Record<string, unknown>;

export const MAX_CSP_REPORT_BODY_BYTES = 10_000;

const URL_FIELDS = new Set(["blocked-uri", "document-uri", "referrer", "source-file"]);
const STRING_FIELDS = new Set([
  "disposition",
  "effective-directive",
  "original-policy",
  "script-sample",
  "violated-directive",
]);
const NUMBER_FIELDS = new Set(["column-number", "line-number", "status-code"]);

export function isCspReportOnlyEnabled() {
  return (
    (process.env.CSP_REPORT_ONLY === "1" || process.env.CSP_REPORT_ONLY === "true") &&
    process.env.VERCEL_ENV !== "production"
  );
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, maxLength = 500) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function stripQueryAndHash(value: string) {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  const endIndex = indexes.length > 0 ? Math.min(...indexes) : value.length;
  return truncate(value.slice(0, endIndex));
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return truncate(url.toString());
  } catch {
    return stripQueryAndHash(value);
  }
}

export function sanitizeCspReport(report: JsonRecord) {
  const sanitized: JsonRecord = {};

  for (const [key, value] of Object.entries(report)) {
    if (URL_FIELDS.has(key) && typeof value === "string") {
      sanitized[key] = sanitizeUrl(value);
      continue;
    }

    if (STRING_FIELDS.has(key) && typeof value === "string") {
      sanitized[key] = truncate(value);
      continue;
    }

    if (NUMBER_FIELDS.has(key) && typeof value === "number" && Number.isFinite(value)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function readCspReportBodyWithLimit(request: Request) {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    bytesRead += value.byteLength;
    if (bytesRead > MAX_CSP_REPORT_BODY_BYTES) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }

    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}
