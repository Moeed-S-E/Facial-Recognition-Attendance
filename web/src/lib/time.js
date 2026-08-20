export const APP_TIMEZONE = "Asia/Karachi";

export function parseApiTimestamp(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return new Date(value);
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

export function localDateKey(value = new Date()) {
  const date = parseApiTimestamp(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatPakistanDate(value, options = {}) {
  return new Intl.DateTimeFormat(undefined, { timeZone: APP_TIMEZONE, ...options }).format(parseApiTimestamp(value));
}

export function formatPakistanDateTime(value) {
  return formatPakistanDate(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
