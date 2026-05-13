import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");
const REPORT_PATH = path.join(ROOT_DIR, "docs", "i18n-audit-report.md");
const TARGET_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const EXCLUDED_DIRS = new Set([
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "public",
]);
const EXCLUDED_FILES = new Set([
  path.normalize(path.join("src", "lib", "i18n", "messages.ts")),
]);
const KOREAN_PATTERN = /[가-힣]/;

function formatTimestamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toReportPath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
}

function shouldSkip(filePath, dirent) {
  const relativePath = path.normalize(path.relative(ROOT_DIR, filePath));

  if (dirent.isDirectory()) {
    return EXCLUDED_DIRS.has(dirent.name);
  }

  if (EXCLUDED_FILES.has(relativePath)) {
    return true;
  }

  return !TARGET_EXTENSIONS.has(path.extname(dirent.name));
}

async function walk(directory, files = []) {
  const dirents = await readdir(directory, { withFileTypes: true });

  for (const dirent of dirents) {
    const filePath = path.join(directory, dirent.name);

    if (shouldSkip(filePath, dirent)) {
      continue;
    }

    if (dirent.isDirectory()) {
      await walk(filePath, files);
    } else {
      files.push(filePath);
    }
  }

  return files;
}

async function collectMatches() {
  const files = await walk(SRC_DIR);
  const matches = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (KOREAN_PATTERN.test(line)) {
        matches.push({
          filePath: toReportPath(filePath),
          line: index + 1,
          text: line.trim(),
        });
      }
    });
  }

  return matches;
}

function buildReport(matches) {
  const timestamp = formatTimestamp();
  const grouped = new Map();

  for (const match of matches) {
    const list = grouped.get(match.filePath) ?? [];
    list.push(match);
    grouped.set(match.filePath, list);
  }

  const lines = [
    "# i18n 잔여 한글 문구 점검 리포트",
    "",
    `실행일: ${timestamp}`,
    "",
    "자동 탐지 결과이며, 사용자 입력값/DB 값/주석은 수동 판단 필요합니다.",
    "",
    "## 요약",
    `- 총 발견 라인: ${matches.length}`,
    `- 대상 파일 수: ${grouped.size}`,
    "",
    "## 발견 목록",
    "",
  ];

  if (matches.length === 0) {
    lines.push("잔여 한글 문구가 발견되지 않았습니다.", "");
  } else {
    for (const [filePath, fileMatches] of [...grouped.entries()].sort()) {
      lines.push(`### ${filePath}`, "");

      for (const match of fileMatches) {
        lines.push(`- L${match.line}: ${match.text}`);
      }

      lines.push("");
    }
  }

  lines.push(
    "## 수동 판단 필요",
    "- 주석",
    "- 사용자 데이터 예시",
    "- DB enum fallback",
    "- 개발자 로그 메시지",
    "- API 응답 메시지",
    "",
  );

  return lines.join("\n");
}

async function main() {
  const matches = await collectMatches();
  const report = buildReport(matches);

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report, "utf8");

  console.log(report);
}

main().catch((error) => {
  console.error("i18n audit failed.");
  console.error(error);
  process.exit(1);
});
