import { NextResponse } from "next/server";
import {
  MAX_CSP_REPORT_BODY_BYTES,
  isCspReportOnlyEnabled,
  isJsonRecord,
  readCspReportBodyWithLimit,
  sanitizeCspReport,
} from "@/lib/security/csp-report";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * Browser CSP violation reports (Content-Security-Policy-Report-Only pilot).
 * Enabled only when CSP_REPORT_ONLY=1 on staging — see docs/c1-csp-investigation.md.
 */
export async function POST(request: Request) {
  if (!isCspReportOnlyEnabled()) {
    return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_CSP_REPORT_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large." } },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown = null;

  try {
    const rawBody = await readCspReportBodyWithLimit(request);
    body = JSON.parse(rawBody);
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json(
        { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large." } },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const report = isJsonRecord(body) && isJsonRecord(body["csp-report"])
    ? body["csp-report"]
    : body;

  if (isJsonRecord(report)) {
    console.warn("[CSP_REPORT]", JSON.stringify(sanitizeCspReport(report)));
  }

  return new NextResponse(null, {
    status: 204,
    headers: NO_STORE_HEADERS,
  });
}
