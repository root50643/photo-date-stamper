import type { AppSettings, RenderResult } from "./types";
export class ImageProcessor {
  private worker = new Worker(new URL("./image.worker.ts", import.meta.url), {
    type: "module",
  });
  private nextId = 0;
  private pending = new Map<
    number,
    { resolve(value: RenderResult): void; reject(reason: Error): void }
  >();
  private failed = false;
  constructor() {
    this.worker.onmessage = ({
      data,
    }: MessageEvent<{ id: number; result: RenderResult; error?: string }>) => {
      const request = this.pending.get(data.id);
      if (!request) return;
      this.pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    this.worker.onerror = () => {
      this.failed = true;
      for (const request of this.pending.values())
        request.reject(new Error("圖片處理程序中斷，請重新整理頁面後重試。"));
      this.pending.clear();
    };
  }
  render(
    file: File,
    settings: AppSettings,
    date: string,
    preview = false,
  ): Promise<RenderResult> {
    if (this.failed)
      return Promise.reject(new Error("圖片處理程序已中斷，請重新整理頁面。"));
    const id = ++this.nextId;
    const fontUrl = new URL(
      `${import.meta.env.BASE_URL}fonts/DSEG7Classic-Bold.woff2`,
      document.baseURI,
    ).href;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, file, settings, date, preview, fontUrl });
    });
  }
  dispose() {
    this.worker.terminate();
    for (const request of this.pending.values())
      request.reject(new Error("處理程序已關閉。"));
    this.pending.clear();
  }
}
