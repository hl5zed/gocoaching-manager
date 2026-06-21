import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const KO_PATH = path.join(ROOT_DIR, "src", "lib", "i18n", "ko.ts");
const EN_PATH = path.join(ROOT_DIR, "src", "lib", "i18n", "en.ts");
const REPORT_PATH = path.join(ROOT_DIR, "docs", "i18n-missing-keys-report.md");

function formatTimestamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function findObjectBlock(source, locale) {
  const marker = `${locale}:`;
  const markerIndex = source.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`Could not find ${locale} locale block.`);
  }

  const start = source.indexOf("{", markerIndex);

  if (start === -1) {
    throw new Error(`Could not find ${locale} locale object start.`);
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = "";
      }

      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Could not find ${locale} locale object end.`);
}

function extractKeys(block) {
  const keys = new Set();
  const keyPattern = /["']([^"']+)["']\s*:/g;
  let match = keyPattern.exec(block);

  while (match) {
    keys.add(match[1]);
    match = keyPattern.exec(block);
  }

  return keys;
}

function compareKeys(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}

function buildReport({ missingInEn, missingInKo }) {
  const failed = missingInEn.length > 0 || missingInKo.length > 0;
  const lines = [
    "# i18n ko/en 누락 키 점검 리포트",
    "",
    `실행일: ${formatTimestamp()}`,
    "",
    "## 요약",
    `- 결과: ${failed ? "실패" : "성공"}`,
    `- en 누락 키: ${missingInEn.length}`,
    `- ko 누락 키: ${missingInKo.length}`,
    "",
    "## Missing in en",
  ];

  lines.push(
    missingInEn.length > 0
      ? missingInEn.map((key) => `- ${key}`).join("\n")
      : "- 없음",
  );

  lines.push("", "## Missing in ko");
  lines.push(
    missingInKo.length > 0
      ? missingInKo.map((key) => `- ${key}`).join("\n")
      : "- 없음",
  );
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const koSource = await readFile(KO_PATH, "utf8");
  const enSource = await readFile(EN_PATH, "utf8");
  const koKeys = extractKeys(findObjectBlock(koSource, "ko"));
  const enKeys = extractKeys(findObjectBlock(enSource, "en"));
  const missingInEn = compareKeys(koKeys, enKeys);
  const missingInKo = compareKeys(enKeys, koKeys);
  const report = buildReport({ missingInEn, missingInKo });

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report, "utf8");

  if (missingInEn.length > 0 || missingInKo.length > 0) {
    console.error("i18n key check failed.");
    console.error(report);
    process.exit(1);
  }

  console.log("i18n key check passed. ko/en keys are in sync.");
  console.log(report);
}

main().catch((error) => {
  console.error("i18n key check failed.");
  console.error(error);
  process.exit(1);
});
