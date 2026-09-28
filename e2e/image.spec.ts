import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type Sample =
  | { width: number; height: number; mime: string; transparent?: boolean }
  | { filename: string; bytes: number[] };

async function fixture(filename: string): Promise<Sample> {
  return {
    filename,
    bytes: [
      ...(await readFile(new URL(`./fixtures/${filename}`, import.meta.url))),
    ],
  };
}

async function renderSample(
  page: Page,
  source: Sample,
  options: {
    preview?: boolean;
    fontSizePercent?: number;
    color?: string;
    dateFormat?: string;
  } = {},
) {
  return page.evaluate(
    async ({ source, options }) => {
      // Variable imports intentionally resolve through the Vite dev server.
      const clientPath = "/src/image-client.ts";
      const settingsPath = "/src/settings.ts";
      const { ImageProcessor } = await import(clientPath);
      const { DEFAULT_SETTINGS } = await import(settingsPath);
      let file: File;
      if ("filename" in source) {
        file = new File([new Uint8Array(source.bytes)], source.filename);
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;
        const ctx = canvas.getContext("2d")!;
        if (!source.transparent) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (result) =>
              result
                ? resolve(result)
                : reject(new Error("Fixture encoding failed")),
            source.mime,
            0.98,
          ),
        );
        const extension =
          source.mime === "image/jpeg" ? "jpg" : source.mime.split("/")[1];
        file = new File([blob], `fixture.${extension}`, { type: source.mime });
      }
      const processor = new ImageProcessor();
      try {
        const settings = { ...DEFAULT_SETTINGS };
        if (options.fontSizePercent !== undefined)
          settings.fontSizePercent = options.fontSizePercent;
        if (options.color !== undefined) settings.color = options.color;
        if (options.dateFormat !== undefined)
          settings.dateFormat = options.dateFormat;
        const rendered = await processor.render(
          file,
          settings,
          "2026-09-28",
          options.preview ?? false,
        );
        const bitmap = await createImageBitmap(rendered.blob);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(bitmap, 0, 0);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = image.data;
          const pixel = (x: number, y: number) => [
            ...ctx.getImageData(x, y, 1, 1).data,
          ];
          const columns: { x: number; ys: number[] }[] = [];
          let yellowPixels = 0;
          let cyanPixels = 0;
          for (let x = 0; x < canvas.width; x++) {
            const ys: number[] = [];
            for (let y = 0; y < canvas.height; y++) {
              const offset = (y * canvas.width + x) * 4;
              const [r, g, b, a] = pixels.subarray(offset, offset + 4);
              if (a > 160 && r > 210 && g > 160 && b < 65) {
                ys.push(y);
                yellowPixels++;
              }
              if (a > 160 && r < 35 && g > 170 && b > 170) cyanPixels++;
            }
            if (ys.length) columns.push({ x, ys });
          }
          const groups: {
            start: number;
            end: number;
            points: { x: number; y: number }[];
          }[] = [];
          for (const { x, ys } of columns) {
            let group = groups.at(-1);
            if (!group || x > group.end + 1) {
              group = { start: x, end: x, points: [] };
              groups.push(group);
            }
            group.end = x;
            for (const y of ys) group.points.push({ x, y });
          }
          const glyphs = groups.map((group) => {
            let minY = Infinity;
            let maxY = -Infinity;
            for (const point of group.points) {
              minY = Math.min(minY, point.y);
              maxY = Math.max(maxY, point.y);
            }
            const upper = group.points.filter(
              (point) => point.y <= minY + (maxY - minY) / 3,
            );
            const lower = group.points.filter(
              (point) => point.y >= maxY - (maxY - minY) / 3,
            );
            return {
              x: group.start,
              width: group.end - group.start + 1,
              height: maxY - minY + 1,
              upperX:
                upper.reduce((sum, point) => sum + point.x, 0) / upper.length,
              lowerX:
                lower.reduce((sum, point) => sum + point.x, 0) / lower.length,
            };
          });
          const digest = await crypto.subtle.digest("SHA-256", pixels.buffer);
          return {
            mime: rendered.blob.type,
            width: bitmap.width,
            height: bitmap.height,
            sourceWidth: rendered.width,
            sourceHeight: rendered.height,
            bounds: rendered.bounds,
            fontSize: rendered.fontSize,
            topLeft: pixel(0, 0),
            yellowPixels,
            cyanPixels,
            glyphs,
            quadrants: [
              pixel(
                Math.floor(bitmap.width / 4),
                Math.floor(bitmap.height / 4),
              ),
              pixel(
                Math.floor((bitmap.width * 3) / 4),
                Math.floor(bitmap.height / 4),
              ),
              pixel(
                Math.floor(bitmap.width / 4),
                Math.floor((bitmap.height * 3) / 4),
              ),
              pixel(
                Math.floor((bitmap.width * 3) / 4),
                Math.floor((bitmap.height * 3) / 4),
              ),
            ],
            digest: [...new Uint8Array(digest)]
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join(""),
          };
        } finally {
          bitmap.close();
        }
      } finally {
        processor.dispose();
      }
    },
    { source, options },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("預覽與 PNG 輸出使用相同字形、預設黃色和 YYYY/MM/DD 的兩條斜線", async ({
  page,
}) => {
  const source = { width: 1600, height: 1000, mime: "image/png" };
  const output = await renderSample(page, source, { fontSizePercent: 10 });
  const preview = await renderSample(page, source, {
    fontSizePercent: 10,
    preview: true,
  });
  expect(output.digest).toBe(preview.digest);
  expect(output.yellowPixels).toBeGreaterThan(1000);
  expect(output.glyphs).toHaveLength(10);
  for (const index of [4, 7]) {
    const slash = output.glyphs[index];
    // A real slash rises to the right; a missing-glyph square cannot pass this.
    expect(slash.upperX - slash.lowerX).toBeGreaterThan(5);
    expect(slash.height).toBeGreaterThan(slash.width);
  }
  expect(output.bounds.x + output.bounds.width).toBeCloseTo(1600 * 0.97, 3);
  expect(output.bounds.y + output.bounds.height).toBeCloseTo(1000 * 0.97, 3);
});

test("設定的青色與替代日期格式反映在實際輸出像素", async ({ page }) => {
  const result = await renderSample(
    page,
    { width: 640, height: 400, mime: "image/png" },
    {
      fontSizePercent: 10,
      color: "#00FFFF",
      dateFormat: "YYYY-MM-DD",
    },
  );
  expect(result.cyanPixels).toBeGreaterThan(500);
  expect(result.yellowPixels).toBe(0);
});

for (let orientation = 1; orientation <= 8; orientation++) {
  test(`EXIF 方向 ${orientation} 校正後尺寸與四象限內容正確`, async ({
    page,
  }) => {
    const result = await renderSample(
      page,
      await fixture(`orientation-${orientation}.jpg`),
    );
    expect([
      result.width,
      result.height,
      result.sourceWidth,
      result.sourceHeight,
    ]).toEqual([320, 240, 320, 240]);
    const expected = [
      [230, 30, 40],
      [20, 180, 60],
      [30, 60, 220],
      [230, 190, 30],
    ];
    for (let quadrant = 0; quadrant < expected.length; quadrant++) {
      for (let channel = 0; channel < 3; channel++) {
        expect(
          Math.abs(
            result.quadrants[quadrant][channel] - expected[quadrant][channel],
          ),
        ).toBeLessThanOrEqual(5);
      }
    }
    expect(result.mime).toBe("image/jpeg");
  });
}

for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
  test(`${mime} 輸出保留格式及原始像素尺寸`, async ({ page }) => {
    // Keep the codec assertion independent of platform-specific antialiasing
    // and chroma subsampling at the default ~11 px size on this small fixture.
    // Default sizing is covered by the layout, EXIF and transparency cases.
    const result = await renderSample(
      page,
      { width: 641, height: 359, mime },
      { fontSizePercent: 10 },
    );
    expect(result.mime).toBe(mime);
    expect([result.width, result.height]).toEqual([641, 359]);
    expect(result.yellowPixels).toBeGreaterThan(10);
  });
}

for (const mime of ["image/png", "image/webp"]) {
  test(`${mime} 透明照片保留透明背景並繪出日期`, async ({ page }) => {
    const result = await renderSample(page, {
      width: 640,
      height: 400,
      mime,
      transparent: true,
    });
    expect(result.topLeft[3]).toBe(0);
    expect(result.yellowPixels).toBeGreaterThan(10);
  });
}

test("大型橫式與直式預覽最大邊為 1800，輸出保留原尺寸", async ({ page }) => {
  for (const [width, height] of [
    [2400, 1200],
    [900, 2400],
  ]) {
    const preview = await renderSample(
      page,
      { width, height, mime: "image/png" },
      { preview: true },
    );
    expect(Math.max(preview.width, preview.height)).toBe(1800);
    expect([preview.sourceWidth, preview.sourceHeight]).toEqual([
      width,
      height,
    ]);
    expect(preview.width / preview.height).toBeCloseTo(width / height, 2);
    const output = await renderSample(page, {
      width,
      height,
      mime: "image/png",
    });
    expect([output.width, output.height]).toEqual([width, height]);
    expect(output.bounds).toEqual(preview.bounds);
  }
});

test("極小照片依實際文字邊界縮小日期且不超出畫布", async ({ page }) => {
  for (const [width, height] of [
    [1, 1],
    [2, 3],
    [7, 5],
  ]) {
    const result = await renderSample(
      page,
      { width, height, mime: "image/png" },
      { fontSizePercent: 15 },
    );
    expect([result.width, result.height]).toEqual([width, height]);
    expect(result.fontSize).toBeGreaterThan(0);
    expect(result.bounds.x).toBeGreaterThanOrEqual(-0.001);
    expect(result.bounds.y).toBeGreaterThanOrEqual(-0.001);
    expect(result.bounds.x + result.bounds.width).toBeLessThanOrEqual(width);
    expect(result.bounds.y + result.bounds.height).toBeLessThanOrEqual(height);
  }
});

for (const [filename, expected] of [
  ["corrupt.jpg", /decode|decoded|解碼|圖片/i],
  ["animated.png", /動畫 PNG/],
  ["animated.webp", /動畫 WebP/],
] as const) {
  test(`${filename} 明確拒絕而不輸出扁平化或損壞檔案`, async ({ page }) => {
    await expect(renderSample(page, await fixture(filename))).rejects.toThrow(
      expected,
    );
  });
}
