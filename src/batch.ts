import type { AppSettings, PhotoItem } from "./types";

export interface BatchDependencies {
  render(
    file: File,
    settings: AppSettings,
    date: string,
  ): Promise<{ blob: Blob }>;
  write(name: string, blob: Blob): Promise<string>;
  isCancelled(): boolean;
  onUpdate(item: PhotoItem, completed: number, total: number): void;
}

export interface BatchResult {
  success: number;
  failed: number;
  cancelled: boolean;
  fatal?: string;
}

function message(error: unknown): string {
  if (error && typeof error === "object" && "message" in error)
    return String(error.message);
  return String(error);
}

function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  return error.name === "NotAllowedError" || error.name === "SecurityError";
}

/** Finish reading/rendering/writing one image before opening the next. */
export async function runBatch(
  items: PhotoItem[],
  settings: AppSettings,
  date: string,
  dependencies: BatchDependencies,
): Promise<BatchResult> {
  const snapshot = Object.freeze({ ...settings });
  const queue = [...items];
  const result: BatchResult = { success: 0, failed: 0, cancelled: false };
  for (const item of queue) {
    item.status = "pending";
    delete item.detail;
  }

  for (const item of queue) {
    if (dependencies.isCancelled()) {
      result.cancelled = true;
      break;
    }
    item.status = "processing";
    dependencies.onUpdate(item, result.success + result.failed, queue.length);
    let stage: "read" | "render" | "write" = "read";
    try {
      const file = await item.handle.getFile();
      stage = "render";
      const { blob } = await dependencies.render(file, snapshot, date);
      stage = "write";
      const outputName = await dependencies.write(item.name, blob);
      item.status = "success";
      item.detail = outputName;
      result.success++;
    } catch (error) {
      item.status = "failed";
      const reason = message(error);
      item.detail =
        stage === "write"
          ? `寫入失敗：${reason}`
          : stage === "read"
            ? `讀取失敗：${reason}`
            : reason;
      result.failed++;
      // A broken output directory is likely to affect every subsequent image.
      if (stage === "write" || (stage === "read" && isPermissionError(error))) {
        result.fatal = item.detail;
      }
    }
    dependencies.onUpdate(item, result.success + result.failed, queue.length);
    if (result.fatal) break;
  }
  return result;
}
