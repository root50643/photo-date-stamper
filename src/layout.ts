import type { AppSettings } from "./types";

export interface TextMeasurement {
  width: number;
  ascent: number;
  descent: number;
  /** Canvas actualBoundingBoxLeft: positive means ink extends left of the origin. */
  left?: number;
  /** Canvas actualBoundingBoxRight: distance right of the origin, not advance width. */
  right?: number;
}

export interface StampLayout {
  fontSize: number;
  x: number;
  y: number;
  bounds: { x: number; y: number; width: number; height: number };
  strokeWidth: number;
}

/** Return coordinates for textAlign='left', textBaseline='alphabetic', lineJoin='round'. */
export function computeLayout(
  width: number,
  height: number,
  settings: AppSettings,
  text: string,
  measure: (text: string, fontSize: number) => TextMeasurement,
): StampLayout {
  if (![width, height].every((size) => Number.isFinite(size) && size > 0)) {
    throw new Error("照片尺寸必須大於零。");
  }
  if (
    !Number.isFinite(settings.fontSizePercent) ||
    settings.fontSizePercent < 0.5 ||
    settings.fontSizePercent > 15 ||
    ![settings.rightPercent, settings.bottomPercent].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 95,
    )
  ) {
    throw new Error("字體大小或位置設定超出範圍。");
  }
  if (!text) throw new Error("日期文字不可為空白。");

  const rightEdge = width * (1 - settings.rightPercent / 100);
  const bottomEdge = height * (1 - settings.bottomPercent / 100);
  const requestedSize =
    (Math.min(width, height) * settings.fontSizePercent) / 100;

  function atSize(fontSize: number): StampLayout {
    const metric = measure(text, fontSize);
    const left = metric.left ?? 0;
    const right = metric.right ?? metric.width;
    if (
      ![metric.width, metric.ascent, metric.descent, left, right].every(
        Number.isFinite,
      ) ||
      metric.width < 0 ||
      left + right < 0 ||
      metric.ascent + metric.descent < 0
    ) {
      throw new Error("無法取得有效的字體尺寸。");
    }
    const strokeWidth = fontSize * 0.045;
    const padding = strokeWidth / 2;
    const boxWidth = left + right + strokeWidth;
    const boxHeight = metric.ascent + metric.descent + strokeWidth;
    const boxX = rightEdge - boxWidth;
    const boxY = bottomEdge - boxHeight;
    return {
      fontSize,
      x: boxX + left + padding,
      y: boxY + metric.ascent + padding,
      bounds: { x: boxX, y: boxY, width: boxWidth, height: boxHeight },
      strokeWidth,
    };
  }

  const fits = (layout: StampLayout) =>
    layout.bounds.width <= rightEdge && layout.bounds.height <= bottomEdge;
  const requested = atSize(requestedSize);
  if (fits(requested)) return requested;

  // Search the actual measured bounds: proportional font metrics are not assumed.
  let low = 0;
  let high = requestedSize;
  let best: StampLayout | undefined;
  for (let attempt = 0; attempt < 48; attempt++) {
    const candidate = atSize((low + high) / 2);
    if (fits(candidate)) {
      best = candidate;
      low = candidate.fontSize;
    } else {
      high = candidate.fontSize;
    }
  }
  if (!best) throw new Error("照片太小，無法完整放入日期文字。");
  return best;
}
