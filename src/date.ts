import type { DateFormat } from "./types";

export function localToday(): string {
  const today = new Date();
  return `${String(today.getFullYear()).padStart(4, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function parseDate(value: string): string {
  const match = /^(\d{4})([-/.])(\d{2})\2(\d{2})$/.exec(value.trim());
  if (!match)
    throw new Error(
      "請輸入有效日期，格式為 YYYY-MM-DD、YYYY/MM/DD 或 YYYY.MM.DD。",
    );
  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (year < 1 || month < 1 || month > 12)
    throw new Error("日期不存在，請確認年、月、日。");
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (day < 1 || day > monthDays[month - 1]!)
    throw new Error("日期不存在，請確認年、月、日。");
  return `${match[1]}-${match[3]}-${match[4]}`;
}

export function formatDate(canonical: string, format: DateFormat): string {
  const date = parseDate(canonical);
  switch (format) {
    case "YYYY/MM/DD":
      return date.replaceAll("-", "/");
    case "YYYY.MM.DD":
      return date.replaceAll("-", ".");
    case "YYYY-MM-DD":
      return date;
    case "YY.MM.DD":
      return date.slice(2).replaceAll("-", ".");
    default:
      throw new Error("日期格式不受支援。");
  }
}
