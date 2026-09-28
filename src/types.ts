export type DateFormat =
  "YYYY/MM/DD" | "YYYY.MM.DD" | "YYYY-MM-DD" | "YY.MM.DD";
export interface AppSettings {
  version: 1;
  dateFormat: DateFormat;
  color: string;
  fontSizePercent: number;
  rightPercent: number;
  bottomPercent: number;
}
export interface PhotoItem {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
  status: "pending" | "processing" | "success" | "failed";
  detail?: string;
}
export interface RenderResult {
  blob: Blob;
  width: number;
  height: number;
  bounds: { x: number; y: number; width: number; height: number };
  fontSize: number;
}
