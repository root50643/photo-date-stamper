import { describe, expect, it } from "vitest";
import {
  computeLayout,
  type StampLayout,
  type TextMeasurement,
} from "../src/layout";
import { DEFAULT_SETTINGS } from "../src/settings";

const measure = (text: string, size: number): TextMeasurement => ({
  width: text.length * size * 0.6,
  ascent: size * 0.8,
  descent: size * 0.2,
});
const stamp = "2026/09/28";

function expectInside(layout: StampLayout, width: number, height: number) {
  expect(layout.fontSize).toBeGreaterThan(0);
  expect(layout.bounds.x).toBeGreaterThanOrEqual(0);
  expect(layout.bounds.y).toBeGreaterThanOrEqual(0);
  expect(layout.bounds.x + layout.bounds.width).toBeLessThanOrEqual(
    width + 1e-9,
  );
  expect(layout.bounds.y + layout.bounds.height).toBeLessThanOrEqual(
    height + 1e-9,
  );
}

describe("date stamp layout", () => {
  it.each([
    [4000, 3000],
    [3000, 4000],
    [3000, 3000],
  ])(
    "scales text from the short side and reserves proportional margins for %s×%s",
    (width, height) => {
      const layout = computeLayout(
        width,
        height,
        { ...DEFAULT_SETTINGS },
        stamp,
        measure,
      );
      expect(layout.fontSize).toBe(Math.min(width, height) * 0.03);
      expect(layout.bounds.x + layout.bounds.width).toBeCloseTo(width * 0.97);
      expect(layout.bounds.y + layout.bounds.height).toBeCloseTo(height * 0.97);
      expectInside(layout, width, height);
    },
  );

  it.each([
    { left: 0.12, right: 6.3, ascent: 0.7, descent: 0.3 },
    { left: -0.1, right: 5.8, ascent: 0.9, descent: 0.1 },
    { left: 0.2, right: 5.6, ascent: 1.2, descent: -0.2 },
  ])("uses actual ink bounds including signed bearings: %j", (metric) => {
    const actualMeasure = (_text: string, size: number) => ({
      width: size * 6,
      left: size * metric.left,
      right: size * metric.right,
      ascent: size * metric.ascent,
      descent: size * metric.descent,
    });
    const layout = computeLayout(
      2000,
      1000,
      { ...DEFAULT_SETTINGS },
      stamp,
      actualMeasure,
    );
    const ink = actualMeasure(stamp, layout.fontSize);
    const padding = layout.strokeWidth / 2;
    expect(layout.x - ink.left - padding).toBeCloseTo(layout.bounds.x);
    expect(layout.x + ink.right + padding).toBeCloseTo(
      layout.bounds.x + layout.bounds.width,
    );
    expect(layout.y - ink.ascent - padding).toBeCloseTo(layout.bounds.y);
    expect(layout.y + ink.descent + padding).toBeCloseTo(
      layout.bounds.y + layout.bounds.height,
    );
    expectInside(layout, 2000, 1000);
  });

  it("fits the entire text and stroke when custom offsets leave very little space", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      fontSizePercent: 15,
      rightPercent: 95,
      bottomPercent: 95,
    };
    const layout = computeLayout(120, 100, settings, stamp, measure);
    expect(layout.fontSize).toBeLessThan(15);
    expectInside(layout, 6, 5);
    expect(layout.bounds.x + layout.bounds.width).toBeCloseTo(6);
    expect(layout.bounds.y + layout.bounds.height).toBeCloseTo(5);
  });

  it.each([
    [1, 1],
    [1, 100],
    [100, 1],
    [12, 8],
  ])("keeps tiny or narrow image %s×%s unclipped", (width, height) => {
    const layout = computeLayout(
      width,
      height,
      {
        ...DEFAULT_SETTINGS,
        fontSizePercent: 15,
        rightPercent: 0,
        bottomPercent: 0,
      },
      stamp,
      measure,
    );
    expectInside(layout, width, height);
    expect(layout.strokeWidth).toBeLessThan(1);
  });

  it("fits nonlinear hinted glyph measurements", () => {
    const layout = computeLayout(
      100,
      100,
      { ...DEFAULT_SETTINGS, fontSizePercent: 15, rightPercent: 90 },
      stamp,
      (_text, size) => ({
        width: Math.ceil(size * 6),
        ascent: Math.ceil(size * 0.8),
        descent: Math.ceil(size * 0.2),
      }),
    );
    expectInside(layout, 10, 97);
  });

  it.each([
    [0, 100],
    [100, -1],
    [NaN, 100],
    [100, Infinity],
  ])("rejects invalid image dimensions %s×%s", (width, height) => {
    expect(() =>
      computeLayout(width, height, { ...DEFAULT_SETTINGS }, stamp, measure),
    ).toThrow();
  });

  it("rejects unusable measurements and empty text", () => {
    expect(() =>
      computeLayout(100, 100, { ...DEFAULT_SETTINGS }, stamp, () => ({
        width: NaN,
        ascent: 1,
        descent: 0,
      })),
    ).toThrow();
    expect(() =>
      computeLayout(100, 100, { ...DEFAULT_SETTINGS }, "", measure),
    ).toThrow();
    expect(() =>
      computeLayout(
        100,
        100,
        { ...DEFAULT_SETTINGS, rightPercent: 100 },
        stamp,
        measure,
      ),
    ).toThrow();
  });
});
