export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isNonEmptyString(value: unknown) {
  return normalizeText(value).length > 0;
}

export function isValidEmail(value: unknown) {
  const email = normalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUuid(value: unknown) {
  const normalized = normalizeText(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized,
  );
}

export function isValidNumberInRange(
  value: unknown,
  min: number,
  max: number,
) {
  const numberValue =
    typeof value === "number" ? value : Number(normalizeText(value));

  return (
    Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
  );
}

export function isValidDate(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  const date = new Date(normalized);
  return !Number.isNaN(date.getTime());
}
