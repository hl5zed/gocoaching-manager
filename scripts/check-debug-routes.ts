const { existsSync, readdirSync, readFileSync, statSync } =
  require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");

const routeSegmentNames = new Set([
  "debug",
  "test-page",
  "dev",
  "__test",
  "playground",
  "sandbox",
  "_debug",
  "api-test",
]);

const ignoredDirectories = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
]);

const appRoots = ["app", path.join("src", "app")];
const strictMode =
  process.argv.includes("--strict") || process.env.NODE_ENV === "production";

type DebugRouteFinding = {
  absolutePath: string;
  relativePath: string;
  guarded: boolean;
  guardReasons: string[];
};

function walkDirectory(directoryPath: string, results: string[]) {
  if (!existsSync(directoryPath)) {
    return;
  }

  for (const entry of readdirSync(directoryPath)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      walkDirectory(entryPath, results);
      continue;
    }

    results.push(entryPath);
  }
}

function hasMatchingRouteSegment(filePath: string, appRoot: string) {
  const relativePath = path.relative(appRoot, filePath);
  const segments = relativePath.split(path.sep);

  return segments.some((segment, index) => {
    if (index === segments.length - 1) {
      return false;
    }

    return routeSegmentNames.has(segment);
  });
}

function isRouteFile(filePath: string) {
  const baseName = path.basename(filePath);
  return (
    baseName === "page.tsx" ||
    baseName === "page.ts" ||
    baseName === "route.ts" ||
    baseName === "route.tsx"
  );
}

function detectGuardReasons(fileContents: string) {
  const reasons: string[] = [];

  if (
    fileContents.includes('process.env.NODE_ENV === "production"') ||
    fileContents.includes("process.env.NODE_ENV === 'production'")
  ) {
    reasons.push("NODE_ENV production guard");
  }

  if (fileContents.includes("notFound(")) {
    reasons.push("notFound()");
  }

  if (fileContents.includes("super_admin")) {
    reasons.push("super_admin");
  }

  if (fileContents.includes("getUserRoles")) {
    reasons.push("getUserRoles");
  }

  return reasons;
}

function findDebugRoutes() {
  const findings: DebugRouteFinding[] = [];

  for (const appRoot of appRoots) {
    if (!existsSync(appRoot)) {
      continue;
    }

    const files: string[] = [];
    walkDirectory(appRoot, files);

    for (const filePath of files) {
      if (!isRouteFile(filePath)) {
        continue;
      }

      if (!hasMatchingRouteSegment(filePath, appRoot)) {
        continue;
      }

      const fileContents = readFileSync(filePath, "utf8");
      const guardReasons = detectGuardReasons(fileContents);

      findings.push({
        absolutePath: path.resolve(filePath),
        relativePath: filePath,
        guarded: guardReasons.length > 0,
        guardReasons,
      });
    }
  }

  return findings;
}

function main() {
  const findings = findDebugRoutes();

  if (findings.length === 0) {
    console.log("No debug or development-only routes found.");
    return;
  }

  console.warn("Debug or development-only routes found:");

  for (const finding of findings) {
    const guardLabel =
      finding.guarded && finding.guardReasons.length > 0
        ? `guarded by ${finding.guardReasons.join(", ")}`
        : "UNGUARDED";
    console.warn(`- ${finding.relativePath} -> ${guardLabel}`);
  }

  const unguarded = findings.filter((finding) => !finding.guarded);

  if (strictMode && unguarded.length > 0) {
    console.error(
      `Found ${unguarded.length} unguarded debug route(s). Failing because strict mode is enabled.`,
    );
    process.exit(1);
  }
}

main();
