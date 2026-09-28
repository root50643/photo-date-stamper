import type { AppSettings, DateFormat } from "./types";

const STORAGE_KEY = "photo-date-stamper.settings.v1";
const DATE_FORMATS: readonly DateFormat[] = [
  "YYYY/MM/DD",
  "YYYY.MM.DD",
  "YYYY-MM-DD",
  "YY.MM.DD",
];
const SETTING_KEYS = [
  "version",
  "dateFormat",
  "color",
  "fontSizePercent",
  "rightPercent",
  "bottomPercent",
];
type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export const DEFAULT_SETTINGS: Readonly<AppSettings> = Object.freeze({
  version: 1,
  dateFormat: "YYYY/MM/DD",
  color: "#FFD700",
  fontSizePercent: 3,
  rightPercent: 3,
  bottomPercent: 3,
});

function numberInRange(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${label}必須是 ${min} 至 ${max} 之間的數字。`);
  }
  return value;
}

/** Validate and copy the supported settings only; dates and file handles are session state. */
export function parseSettings(json: string): AppSettings {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("設定檔不是有效的 JSON。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("設定檔必須是 JSON 物件。");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !SETTING_KEYS.includes(key))) {
    throw new Error("設定檔含有不支援的欄位。");
  }
  if (input.version !== 1) throw new Error("不支援此設定檔版本。");
  if (
    typeof input.dateFormat !== "string" ||
    !DATE_FORMATS.includes(input.dateFormat as DateFormat)
  ) {
    throw new Error("日期格式不受支援。");
  }
  if (typeof input.color !== "string" || !/^#[0-9a-f]{6}$/i.test(input.color)) {
    throw new Error("字體顏色必須使用 #RRGGBB 格式。");
  }
  return {
    version: 1,
    dateFormat: input.dateFormat as DateFormat,
    color: input.color.toUpperCase(),
    fontSizePercent: numberInRange(input.fontSizePercent, 0.5, 15, "字體大小"),
    rightPercent: numberInRange(input.rightPercent, 0, 95, "右側留白"),
    bottomPercent: numberInRange(input.bottomPercent, 0, 95, "下方留白"),
  };
}

export function loadSettings(storage?: SettingsStorage): {
  settings: AppSettings;
  warning?: string;
} {
  try {
    const stored = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    return {
      settings:
        stored === null ? { ...DEFAULT_SETTINGS } : parseSettings(stored),
    };
  } catch {
    return {
      settings: { ...DEFAULT_SETTINGS },
      warning:
        "無法讀取已儲存的設定，已使用預設值。你仍可調整設定並繼續處理照片。",
    };
  }
}

export function saveSettings(
  settings: AppSettings,
  storage?: SettingsStorage,
): boolean {
  try {
    // Pick fields explicitly so extra runtime properties (including dates/handles) cannot persist.
    const clean = parseSettings(
      JSON.stringify({
        version: settings.version,
        dateFormat: settings.dateFormat,
        color: settings.color,
        fontSizePercent: settings.fontSizePercent,
        rightPercent: settings.rightPercent,
        bottomPercent: settings.bottomPercent,
      }),
    );
    (storage ?? globalThis.localStorage).setItem(
      STORAGE_KEY,
      JSON.stringify(clean),
    );
    return true;
  } catch {
    return false;
  }
}
