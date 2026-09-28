export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
/** Inspect container headers, including animation chunks; never silently flatten an animation. */
export function inspectImage(bytes: Uint8Array, name: string): ImageMime {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  let mime: ImageMime;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mime = "image/jpeg";
  } else if (
    bytes.length >= 8 &&
    ascii(1, 3) === "PNG" &&
    bytes[0] === 137 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  ) {
    mime = "image/png";
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      const type = ascii(offset + 4, 4);
      if (offset + 12 + length > bytes.length)
        throw new Error("PNG 檔案不完整。");
      if (type === "acTL") throw new Error("不支援動畫 PNG；請改用靜態照片。");
      offset += length + 12;
      if (type === "IEND") break;
    }
  } else if (
    bytes.length >= 12 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 4) === "WEBP"
  ) {
    mime = "image/webp";
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = ascii(offset, 4);
      const length = view.getUint32(offset + 4, true);
      if (offset + 8 + length > bytes.length)
        throw new Error("WebP 檔案不完整。");
      if (
        type === "ANIM" ||
        type === "ANMF" ||
        (type === "VP8X" && length > 0 && bytes[offset + 8] & 2)
      ) {
        throw new Error("不支援動畫 WebP；請改用靜態照片。");
      }
      offset += 8 + length + (length % 2);
    }
  } else {
    throw new Error("不是有效的 JPEG、PNG 或 WebP 圖片。");
  }
  const extension = name.split(".").pop()?.toLowerCase();
  const expected =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : `image/${extension}`;
  if (mime !== expected)
    throw new Error("圖片內容與副檔名不一致，請先修正副檔名。");
  return mime;
}
