import { describe, expect, it, vi } from "vitest";
import { runBatch, type BatchDependencies } from "../src/batch";
import type { AppSettings, PhotoItem } from "../src/types";

function settings(): AppSettings {
  return {
    version: 1,
    dateFormat: "YYYY/MM/DD",
    color: "#FFD700",
    fontSizePercent: 3,
    rightPercent: 3,
    bottomPercent: 3,
  };
}

function photos(count: number): PhotoItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: `照片${index}.jpg`,
    status: "pending",
    handle: {
      getFile: vi.fn(async () => new File(["photo"], `照片${index}.jpg`)),
    } as unknown as FileSystemFileHandle,
  }));
}

function dependencies(): BatchDependencies {
  return {
    render: vi.fn(async () => ({ blob: new Blob(["rendered"]) })),
    write: vi.fn(async (name) => name),
    isCancelled: vi.fn(() => false),
    onUpdate: vi.fn(),
  };
}

describe("runBatch", () => {
  it("completes the whole pipeline for one photo before reading the next", async () => {
    const items = photos(1000);
    const deps = dependencies();
    let loaded = 0;
    let written = 0;
    for (const item of items) {
      vi.mocked(item.handle.getFile).mockImplementation(async () => {
        expect(loaded).toBe(written);
        loaded++;
        return new File(["photo"], item.name);
      });
    }
    deps.write = vi.fn(async (name) => {
      written++;
      return name;
    });
    expect(await runBatch(items, settings(), "2026-09-28", deps)).toEqual({
      success: 1000,
      failed: 0,
      cancelled: false,
    });
    expect(items.every((item) => item.status === "success")).toBe(true);
    expect(deps.onUpdate).toHaveBeenLastCalledWith(items[999], 1000, 1000);
  });

  it("snapshots settings at batch start", async () => {
    const original = settings();
    const deps = dependencies();
    const seen: string[] = [];
    deps.render = vi.fn(async (_file, current, date) => {
      seen.push(current.color);
      expect(current.dateFormat).toBe("YYYY/MM/DD");
      expect(date).toBe("2026-09-28");
      original.color = "#000000";
      return { blob: new Blob(["rendered"]) };
    });
    await runBatch(photos(2), original, "2026-09-28", deps);
    expect(seen).toEqual(["#FFD700", "#FFD700"]);
  });

  it("continues past corrupt/unsupported images and reports progress", async () => {
    const items = photos(3);
    const deps = dependencies();
    vi.mocked(deps.render).mockRejectedValueOnce(new Error("不支援動畫圖片"));
    const updates: number[] = [];
    deps.onUpdate = (_item, completed) => {
      updates.push(completed);
    };
    expect(await runBatch(items, settings(), "2026-09-28", deps)).toEqual({
      success: 2,
      failed: 1,
      cancelled: false,
    });
    expect(items.map((item) => item.status)).toEqual([
      "failed",
      "success",
      "success",
    ]);
    expect(items[0].detail).toBe("不支援動畫圖片");
    expect(updates).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it("stops after any write failure and leaves remaining files unopened", async () => {
    const items = photos(3);
    const deps = dependencies();
    vi.mocked(deps.write)
      .mockResolvedValueOnce("照片0_1.jpg")
      .mockRejectedValueOnce(
        new DOMException("disk full", "QuotaExceededError"),
      );
    const result = await runBatch(items, settings(), "2026-09-28", deps);
    expect(result).toMatchObject({
      success: 1,
      failed: 1,
      cancelled: false,
      fatal: "寫入失敗：disk full",
    });
    expect(items[0].detail).toBe("照片0_1.jpg");
    expect(items[2].status).toBe("pending");
    expect(items[2].handle.getFile).not.toHaveBeenCalled();
  });

  it("continues after a missing source but stops when source permission is revoked", async () => {
    const items = photos(3);
    vi.mocked(items[0].handle.getFile).mockRejectedValue(
      new DOMException("gone", "NotFoundError"),
    );
    vi.mocked(items[1].handle.getFile).mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    const deps = dependencies();
    expect(await runBatch(items, settings(), "2026-09-28", deps)).toMatchObject(
      { success: 0, failed: 2, fatal: "讀取失敗：denied" },
    );
    expect(deps.render).not.toHaveBeenCalled();
    expect(items[2].handle.getFile).not.toHaveBeenCalled();
  });

  it("finishes the current file before cancellation and preserves its successful state", async () => {
    const items = photos(3);
    const deps = dependencies();
    let cancel = false;
    deps.isCancelled = () => cancel;
    deps.render = vi.fn(async () => {
      cancel = true;
      return { blob: new Blob(["rendered"]) };
    });
    expect(await runBatch(items, settings(), "2026-09-28", deps)).toEqual({
      success: 1,
      failed: 0,
      cancelled: true,
    });
    expect(deps.write).toHaveBeenCalledOnce();
    expect(items.map((item) => item.status)).toEqual([
      "success",
      "pending",
      "pending",
    ]);
    expect(items[1].handle.getFile).not.toHaveBeenCalled();
  });

  it("can cancel before any read and can rerun a previous batch", async () => {
    const items = photos(1);
    const deps = dependencies();
    vi.mocked(deps.isCancelled).mockReturnValue(true);
    expect(await runBatch(items, settings(), "2026-09-28", deps)).toEqual({
      success: 0,
      failed: 0,
      cancelled: true,
    });
    expect(items[0].handle.getFile).not.toHaveBeenCalled();
    vi.mocked(deps.isCancelled).mockReturnValue(false);
    await runBatch(items, settings(), "2026-09-28", deps);
    await runBatch(items, settings(), "2026-09-28", deps);
    expect(items[0].handle.getFile).toHaveBeenCalledTimes(2);
    expect(items[0].status).toBe("success");
  });

  it("accepts an empty batch without invoking dependencies", async () => {
    const deps = dependencies();
    expect(await runBatch([], settings(), "2026-09-28", deps)).toEqual({
      success: 0,
      failed: 0,
      cancelled: false,
    });
    expect(deps.onUpdate).not.toHaveBeenCalled();
  });
});
