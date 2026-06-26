type CspReportRules = {
  isCspReportOnlyEnabled: () => boolean;
  readCspReportBodyWithLimit: (request: Request) => Promise<string>;
  sanitizeCspReport: (report: Record<string, unknown>) => Record<string, unknown>;
};

const {
  isCspReportOnlyEnabled,
  readCspReportBodyWithLimit,
  sanitizeCspReport,
} = (await import("../src/lib/security/csp-report.ts" as string)) as CspReportRules;

function ensure(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureDeepEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

function createReportRequest(body: string) {
  return new Request("https://example.com/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": "application/csp-report" },
    body,
  });
}

async function runChecks() {
  const originalReportOnly = process.env.CSP_REPORT_ONLY;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];

  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    delete process.env.CSP_REPORT_ONLY;
    process.env.VERCEL_ENV = "preview";

    ensure(isCspReportOnlyEnabled() === false, "CSP report collection must be disabled by default");
    ensure(warnings.length === 0, "Disabled CSP report route must not log");

    process.env.CSP_REPORT_ONLY = "1";
    process.env.VERCEL_ENV = "production";

    ensure(isCspReportOnlyEnabled() === false, "CSP report collection must be disabled in production");
    ensure(warnings.length === 0, "Production CSP report route must not log");

    process.env.VERCEL_ENV = "preview";
    ensure(isCspReportOnlyEnabled() === true, "CSP report collection must be enabled in preview");

    try {
      await readCspReportBodyWithLimit(createReportRequest("x".repeat(10_001)));
      throw new Error("Expected oversized CSP report body to fail");
    } catch (error) {
      ensure(
        error instanceof Error && error.message === "PAYLOAD_TOO_LARGE",
        "CSP report body reader must reject bodies over 10KB",
      );
    }

    ensureDeepEqual(
      sanitizeCspReport({
        "document-uri": "https://app.example/invitations/accept?token=secret#hash",
        "blocked-uri": "/relative/path?token=secret#hash",
        "effective-directive": "script-src",
        "line-number": 12,
        ignored: "secret",
      }),
      {
        "document-uri": "https://app.example/invitations/accept",
        "blocked-uri": "/relative/path",
        "effective-directive": "script-src",
        "line-number": 12,
      },
      "CSP report logs must strip sensitive URL parts and omit non-allowlisted fields",
    );
  } finally {
    console.warn = originalWarn;

    if (originalReportOnly === undefined) {
      delete process.env.CSP_REPORT_ONLY;
    } else {
      process.env.CSP_REPORT_ONLY = originalReportOnly;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  }
}

runChecks()
  .then(() => {
    console.log("✅ CSP report route rules verified");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });

export {};
