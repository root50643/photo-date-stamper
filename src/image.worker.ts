import { inspectImage } from "./image-format";
import { computeLayout } from "./layout";
import { formatDate } from "./date";
import type { AppSettings, RenderResult } from "./types";

interface Job {
  id: number;
  file: File;
  settings: AppSettings;
  date: string;
  preview: boolean;
  fontUrl: string;
}
// A structural worker type avoids mixing the DOM and WebWorker ambient libraries.
const scope = self as unknown as {
  fonts: FontFaceSet;
  onmessage: ((event: MessageEvent<Job>) => void) | null;
  postMessage(message: unknown): void;
};
let fontReady: Promise<void> | undefined;
function loadFont(url: string): Promise<void> {
  return (fontReady ??= (async () => {
    const face = new FontFace("PhotoDate", `url("${url}")`, { weight: "700" });
    await face.load();
    scope.fonts.add(face);
  })().catch(() => {
    fontReady = undefined;
    throw new Error("日期字型載入失敗，請重新整理網頁後再試。");
  }));
}
async function render(job: Job): Promise<RenderResult> {
  const mime = inspectImage(
    new Uint8Array(await job.file.arrayBuffer()),
    job.file.name,
  );
  await loadFont(job.fontUrl);
  const bitmap = await createImageBitmap(job.file, {
    imageOrientation: "from-image",
  });
  let canvas: OffscreenCanvas | undefined;
  try {
    const { width, height } = bitmap;
    const scale = job.preview ? Math.min(1, 1800 / Math.max(width, height)) : 1;
    canvas = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("無法建立圖片畫布，照片可能超過瀏覽器可處理的尺寸。");
    const text = formatDate(job.date, job.settings.dateFormat);
    // DSEG does not contain '/'. The locally available monospace fallback supplies it.
    const font = (size: number) => `700 ${size}px PhotoDate, monospace`;
    const layout = computeLayout(
      width,
      height,
      job.settings,
      text,
      (value, size) => {
        context.font = font(size);
        const m = context.measureText(value);
        return {
          width: m.width,
          ascent: m.actualBoundingBoxAscent,
          descent: m.actualBoundingBoxDescent,
          left: m.actualBoundingBoxLeft,
          right: m.actualBoundingBoxRight,
        };
      },
    );
    context.scale(canvas.width / width, canvas.height / height);
    context.drawImage(bitmap, 0, 0, width, height);
    context.font = font(layout.fontSize);
    context.textBaseline = "alphabetic";
    context.textAlign = "left";
    context.lineJoin = "round";
    context.lineWidth = layout.strokeWidth;
    context.strokeStyle = "rgba(0, 0, 0, 0.72)";
    context.fillStyle = job.settings.color;
    context.strokeText(text, layout.x, layout.y);
    context.fillText(text, layout.x, layout.y);
    const requested = job.preview ? "image/png" : mime;
    const blob = await canvas.convertToBlob({ type: requested, quality: 0.95 });
    if (blob.type !== requested)
      throw new Error("此瀏覽器無法輸出原圖片格式；未產生替代格式檔案。");
    return {
      blob,
      width,
      height,
      bounds: layout.bounds,
      fontSize: layout.fontSize,
    };
  } finally {
    bitmap.close();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}
scope.onmessage = async ({ data }) => {
  try {
    scope.postMessage({ id: data.id, result: await render(data) });
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : "圖片處理失敗。",
    });
  }
};
