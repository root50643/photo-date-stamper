import { describe, expect, it } from "vitest";
import { inspectImage } from "../src/image-format";
const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((p) =>
      typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p,
    ),
  );
describe("container inspection", () => {
  it("accepts JPEG signatures and uppercase extension", () =>
    expect(
      inspectImage(new Uint8Array([255, 216, 255, 224]), "照片.JPEG"),
    ).toBe("image/jpeg"));
  it("rejects renamed containers", () =>
    expect(() =>
      inspectImage(new Uint8Array([255, 216, 255, 224]), "照片.png"),
    ).toThrow("副檔名"));
  it("rejects unrelated or empty files", () => {
    expect(() => inspectImage(new Uint8Array(), "x.jpg")).toThrow("有效");
    expect(() => inspectImage(bytes("not an image"), "x.jpg")).toThrow("有效");
  });
  it("rejects animation even when only VP8X flags identify it", () =>
    expect(() =>
      inspectImage(
        bytes(
          "RIFF",
          [22, 0, 0, 0],
          "WEBPVP8X",
          [10, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ),
        "x.webp",
      ),
    ).toThrow("動畫"));
  it("rejects truncated RIFF chunks", () =>
    expect(() =>
      inspectImage(
        bytes("RIFF", [30, 0, 0, 0], "WEBPVP8 ", [50, 0, 0, 0]),
        "x.webp",
      ),
    ).toThrow("不完整"));
});
