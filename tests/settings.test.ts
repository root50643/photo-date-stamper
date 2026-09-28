import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  saveSettings,
} from "../src/settings";
import type { AppSettings } from "../src/types";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("settings persistence", () => {
  it("uses independent defaults on first use", () => {
    const first = loadSettings(memoryStorage());
    expect(first.warning).toBeUndefined();
    expect(first.settings).toEqual(DEFAULT_SETTINGS);
    first.settings.color = "#000000";
    expect(loadSettings(memoryStorage()).settings.color).toBe("#FFD700");
  });

  it("round trips valid preferences without persisting dates or directory handles", () => {
    const storage = memoryStorage();
    const input = {
      ...DEFAULT_SETTINGS,
      color: "#aabbcc",
      rightPercent: 12.5,
      date: "2026-01-01",
      handle: { name: "private" },
    };
    expect(saveSettings(input, storage)).toBe(true);
    expect(loadSettings(storage).settings).toEqual({
      ...DEFAULT_SETTINGS,
      color: "#AABBCC",
      rightPercent: 12.5,
    });
    expect(JSON.parse(storage.getItem()!)).not.toHaveProperty("date");
    expect(JSON.parse(storage.getItem()!)).not.toHaveProperty("handle");
  });

  it("recovers from corrupt or future settings without overwriting the saved data", () => {
    for (const invalid of [
      "{broken",
      JSON.stringify({ ...DEFAULT_SETTINGS, version: 2 }),
    ]) {
      const storage = memoryStorage(invalid);
      expect(loadSettings(storage)).toEqual({
        settings: DEFAULT_SETTINGS,
        warning: expect.any(String),
      });
      expect(storage.getItem()).toBe(invalid);
    }
  });

  it("keeps the app usable when browser storage is blocked or full", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(loadSettings(storage).settings).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(storage).warning).toBeTruthy();
    expect(saveSettings({ ...DEFAULT_SETTINGS }, storage)).toBe(false);
  });

  it("does not write invalid preferences", () => {
    const storage = memoryStorage("untouched");
    expect(
      saveSettings({ ...DEFAULT_SETTINGS, fontSizePercent: NaN }, storage),
    ).toBe(false);
    expect(storage.getItem()).toBe("untouched");
  });
});

describe("settings import validation", () => {
  it.each(["YYYY/MM/DD", "YYYY.MM.DD", "YYYY-MM-DD", "YY.MM.DD"])(
    "accepts supported format %s",
    (dateFormat) => {
      expect(
        parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, dateFormat }))
          .dateFormat,
      ).toBe(dateFormat);
    },
  );

  it("accepts exact limits and decimal preferences", () => {
    expect(
      parseSettings(
        JSON.stringify({
          ...DEFAULT_SETTINGS,
          fontSizePercent: 0.5,
          rightPercent: 0,
          bottomPercent: 95,
        }),
      ),
    ).toMatchObject({
      fontSizePercent: 0.5,
      rightPercent: 0,
      bottomPercent: 95,
    });
    expect(
      parseSettings(
        JSON.stringify({ ...DEFAULT_SETTINGS, fontSizePercent: 15 }),
      ),
    ).toMatchObject({ fontSizePercent: 15 });
  });

  it.each([
    ["version", "1"],
    ["version", 2],
    ["color", "#FFF"],
    ["color", "#GG0000"],
    ["dateFormat", "DD/MM/YYYY"],
    ["fontSizePercent", 0.49],
    ["fontSizePercent", 15.01],
    ["fontSizePercent", "3"],
    ["rightPercent", -1],
    ["rightPercent", 95.1],
    ["bottomPercent", null],
  ])("rejects invalid %s = %s", (key, value) => {
    expect(() =>
      parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, [key]: value })),
    ).toThrow();
  });

  it.each(["null", "[]", "true", "42", "{}", "{bad"])(
    "rejects invalid document %s",
    (json) => {
      expect(() => parseSettings(json)).toThrow();
    },
  );

  it("rejects missing fields and unexpected session state", () => {
    const missing: Partial<AppSettings> = { ...DEFAULT_SETTINGS };
    delete missing.bottomPercent;
    expect(() => parseSettings(JSON.stringify(missing))).toThrow();
    expect(() =>
      parseSettings(
        JSON.stringify({ ...DEFAULT_SETTINGS, date: "2026-01-01" }),
      ),
    ).toThrow();
  });
});
