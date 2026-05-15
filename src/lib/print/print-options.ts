export const PRINT_PAPER_SIZES = ["a4"] as const;
export const PRINT_ORIENTATIONS = ["portrait", "landscape"] as const;
export const PRINT_MARGINS = ["compact", "normal", "wide"] as const;

export type PrintPaperSize = (typeof PRINT_PAPER_SIZES)[number];
export type PrintOrientation = (typeof PRINT_ORIENTATIONS)[number];
export type PrintMargin = (typeof PRINT_MARGINS)[number];

export type PrintOptions = {
  margin: PrintMargin;
  orientation: PrintOrientation;
  paper_size: PrintPaperSize;
  show_date: boolean;
  show_logo: boolean;
  show_page_numbers: boolean;
  show_people_info: boolean;
  show_signature: boolean;
  show_title: boolean;
};

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  margin: "normal",
  orientation: "portrait",
  paper_size: "a4",
  show_date: true,
  show_logo: true,
  show_page_numbers: false,
  show_people_info: true,
  show_signature: false,
  show_title: true,
};

const PRINT_OPTION_KEYS = Object.keys(DEFAULT_PRINT_OPTIONS) as Array<
  keyof PrintOptions
>;

const marginSize: Record<PrintMargin, string> = {
  compact: "6mm",
  normal: "10mm",
  wide: "15mm",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  options: T,
): value is T[number] {
  return typeof value === "string" && options.includes(value);
}

export function getPrintMarginSize(margin: PrintMargin) {
  return marginSize[margin];
}

export function normalizePrintOptions(value: unknown): PrintOptions {
  if (!isRecord(value)) {
    return { ...DEFAULT_PRINT_OPTIONS };
  }

  return {
    margin: isOneOf(value.margin, PRINT_MARGINS)
      ? value.margin
      : DEFAULT_PRINT_OPTIONS.margin,
    orientation: isOneOf(value.orientation, PRINT_ORIENTATIONS)
      ? value.orientation
      : DEFAULT_PRINT_OPTIONS.orientation,
    paper_size: isOneOf(value.paper_size, PRINT_PAPER_SIZES)
      ? value.paper_size
      : DEFAULT_PRINT_OPTIONS.paper_size,
    show_date:
      typeof value.show_date === "boolean"
        ? value.show_date
        : DEFAULT_PRINT_OPTIONS.show_date,
    show_logo:
      typeof value.show_logo === "boolean"
        ? value.show_logo
        : DEFAULT_PRINT_OPTIONS.show_logo,
    show_page_numbers:
      typeof value.show_page_numbers === "boolean"
        ? value.show_page_numbers
        : DEFAULT_PRINT_OPTIONS.show_page_numbers,
    show_people_info:
      typeof value.show_people_info === "boolean"
        ? value.show_people_info
        : DEFAULT_PRINT_OPTIONS.show_people_info,
    show_signature:
      typeof value.show_signature === "boolean"
        ? value.show_signature
        : DEFAULT_PRINT_OPTIONS.show_signature,
    show_title:
      typeof value.show_title === "boolean"
        ? value.show_title
        : DEFAULT_PRINT_OPTIONS.show_title,
  };
}

export function validatePrintOptionsInput(
  value: unknown,
): { ok: true; value: PrintOptions } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "인쇄 옵션 형식이 올바르지 않습니다." };
  }

  const unknownKeys = Object.keys(value).filter(
    (key) => !PRINT_OPTION_KEYS.includes(key as keyof PrintOptions),
  );

  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `허용되지 않은 인쇄 옵션입니다: ${unknownKeys.join(", ")}`,
    };
  }

  if ("paper_size" in value && !isOneOf(value.paper_size, PRINT_PAPER_SIZES)) {
    return { ok: false, error: "용지 크기는 a4만 허용됩니다." };
  }

  if (
    "orientation" in value &&
    !isOneOf(value.orientation, PRINT_ORIENTATIONS)
  ) {
    return { ok: false, error: "인쇄 방향을 확인해 주세요." };
  }

  if ("margin" in value && !isOneOf(value.margin, PRINT_MARGINS)) {
    return { ok: false, error: "인쇄 여백을 확인해 주세요." };
  }

  const booleanKeys: Array<keyof PrintOptions> = [
    "show_date",
    "show_logo",
    "show_page_numbers",
    "show_people_info",
    "show_signature",
    "show_title",
  ];

  for (const key of booleanKeys) {
    if (key in value && typeof value[key] !== "boolean") {
      return { ok: false, error: "인쇄 표시 옵션을 확인해 주세요." };
    }
  }

  return {
    ok: true,
    value: normalizePrintOptions(value),
  };
}
