import "./style.css";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  saveSettings,
} from "./settings";
import { localToday, parseDate, formatDate } from "./date";
import {
  scanDirectory,
  ensureWritePermission,
  createWriter,
} from "./filesystem";
import { runBatch } from "./batch";
import { ImageProcessor } from "./image-client";
import type { AppSettings, PhotoItem, RenderResult } from "./types";

const folderIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/><path d="M3 10h18"/></svg>';
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="topbar"><div class="brand"><span class="brand-mark">${folderIcon}</span><div><h1>照片加日期</h1><span class="brand-en">PHOTO DATE</span></div></div><div class="privacy">照片留在你的電腦<span>無需上傳 · 批次處理</span></div></header>
  <main>
    <div id="compatibility" class="notice" hidden></div>
    <div id="message" class="notice" role="status" aria-live="polite" hidden></div>
    <div class="workspace">
      <aside class="settings-panel" aria-label="照片處理設定">
        <fieldset id="controls"><legend class="sr-only">設定</legend>
          <section class="setting-section"><div class="section-heading"><span class="step">01</span><h2>選擇照片</h2></div>
            <button id="choose-source" class="folder-button">${folderIcon}<span><strong>選擇工作目錄</strong><small id="source-name">JPEG、PNG、WebP · 不含子目錄</small></span><span class="plus">＋</span></button>
            <div class="output-row"><div><label>輸出目錄</label><p id="output-name">選擇工作目錄後自動設定</p></div><button id="choose-output" class="text-button" disabled>變更</button></div>
            <button id="default-output" class="text-button small" hidden>使用預設 dated 子目錄</button>
          </section>
          <section class="setting-section"><div class="section-heading"><span class="step">02</span><h2>設定日期</h2></div>
            <label for="date-text">照片上的日期</label><div class="date-row"><input id="date-text" type="text" inputmode="numeric" placeholder="YYYY/MM/DD" aria-describedby="date-error"/><input id="date-picker" type="date" aria-label="用日曆選擇日期" title="用日曆選擇日期"/></div>
            <p id="date-error" class="field-error" hidden></p>
            <div class="format-row"><label for="date-format">顯示格式</label><select id="date-format"><option>YYYY/MM/DD</option><option>YYYY.MM.DD</option><option>YYYY-MM-DD</option><option>YY.MM.DD</option></select></div>
            <div class="stamp-sample"><span id="date-sample"></span><small>日期樣式</small></div>
          </section>
          <section class="setting-section"><div class="section-heading"><span class="step">03</span><h2>調整樣式</h2><button id="reset-all" class="text-button small">全部重設</button></div>
            <div class="control-heading"><label for="font-number">字體大小</label><button id="reset-size" class="text-button small">恢復預設</button></div>
            <div class="slider-row"><input id="font-slider" type="range" min="0.5" max="15" step="0.1" aria-label="字體大小百分比"/><div class="number-unit"><input id="font-number" type="number" min="0.5" max="15" step="0.1"/><span>%</span></div></div><p class="hint">依照片短邊比例計算，大小隨照片調整</p>
            <div class="control-heading"><label>右下角留白</label><button id="reset-position" class="text-button small">恢復預設</button></div>
            <div class="position-grid"><label for="right-number">右側<div class="number-unit"><input id="right-number" type="number" min="0" max="95" step="0.1"/><span>%</span></div></label><label for="bottom-number">底部<div class="number-unit"><input id="bottom-number" type="number" min="0" max="95" step="0.1"/><span>%</span></div></label></div>
            <input id="right-slider" type="range" min="0" max="95" step="0.1" aria-label="右側留白百分比"/><input id="bottom-slider" type="range" min="0" max="95" step="0.1" aria-label="底部留白百分比"/>
            <p class="hint">也可以直接拖曳預覽中的日期</p>
            <div class="control-heading"><label for="color">字體顏色</label><button id="reset-color" class="text-button small">恢復預設</button></div><div class="color-row"><input id="color" type="color"/><input id="color-text" type="text" aria-label="字體顏色色碼" pattern="#[0-9A-Fa-f]{6}" maxlength="7"/><span class="hint">附暗色描邊</span></div>
            <p id="style-error" class="field-error" role="status" hidden></p>
          </section>
          <div class="settings-footer"><span id="save-status">設定自動保存</span><div><button id="import-settings" class="text-button small">匯入設定</button><button id="export-settings" class="text-button small">匯出設定</button></div></div>
        </fieldset><input id="settings-file" type="file" accept="application/json,.json" hidden/>
      </aside>
      <div class="work-panel">
        <section class="preview-panel"><div class="panel-header"><div><h2>照片預覽</h2><p id="preview-name">調整一次，套用整批照片</p></div><span class="tag">原尺寸輸出</span></div>
          <div id="preview-stage" class="preview-stage"><div id="empty-preview" class="empty-preview"><span class="frame-icon">${folderIcon}</span><h3>從一個資料夾開始</h3><p>選擇工作目錄，即可預覽照片與日期效果。</p><button id="empty-choose" class="secondary">選擇工作目錄</button></div><div id="image-wrap" class="image-wrap" hidden><img id="preview-image" alt="照片加上日期的預覽" draggable="false"/><button id="stamp-drag" class="stamp-drag" aria-label="拖曳日期位置，也可使用方向鍵微調" title="拖曳移動 · 方向鍵微調"></button></div><span id="preview-loading" class="loading-badge" hidden>正在產生預覽…</span></div>
          <div class="preview-footer"><span id="preview-info">依照片尺寸自動調整文字與留白</span><span>預覽縮圖 · 輸出保留原像素</span></div>
        </section>
        <section class="files-panel"><div class="panel-header"><div><h2>處理清單 <span id="photo-count" class="count">0</span></h2><p id="scan-info">只處理工作目錄中的靜態照片</p></div><span id="list-summary" class="muted">尚未載入</span></div><div id="file-list" class="file-list" role="list" aria-label="照片清單"><p class="list-empty">載入後，點選檔名即可切換預覽。</p></div></section>
        <section class="run-panel"><div class="progress-heading"><strong id="progress-title">準備開始</strong><span id="progress-count">0 / 0</span></div><progress id="progress" max="1" value="0" aria-label="照片處理進度"></progress><div class="run-bottom"><div><p id="progress-detail" aria-live="polite">請先選擇工作目錄。</p><small>原照片保留，同名輸出自動編號。</small></div><button id="cancel" class="secondary" hidden>取消處理</button><button id="start" class="primary" disabled>開始批次處理 <span aria-hidden="true">→</span></button></div></section>
      </div>
    </div><footer class="page-footer">支援電腦 Chrome / Edge<span>純前端處理 · 不讀取子目錄</span></footer>
  </main>`;

const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const supported =
  window.isSecureContext &&
  "showDirectoryPicker" in window &&
  "OffscreenCanvas" in window &&
  "Worker" in window;
const loaded = loadSettings();
let settings = loaded.settings;
let date = localToday();
let dateValid = true;
let source: FileSystemDirectoryHandle | undefined;
let output: FileSystemDirectoryHandle | undefined;
let photos: PhotoItem[] = [];
let selected = -1;
let busy = false;
let running = false;
let cancelling = false;
let processor: ImageProcessor | undefined;
let previewResult: RenderResult | undefined;
let previewUrl: string | undefined;
let previewRevision = 0;
let previewPending = false;
let previewTask: Promise<void> | undefined;
let previewTimer: ReturnType<typeof setTimeout> | undefined;
const fileRows = new Map<PhotoItem, HTMLButtonElement>();
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "發生未預期的錯誤，請重試。";
const validStyles = () =>
  ["font-number", "right-number", "bottom-number", "color-text"].every(
    (id) => input(id).validity.valid,
  );
function notify(text: string, error = false) {
  const box = element("message");
  box.textContent = text;
  box.hidden = false;
  box.classList.toggle("error", error);
}
function controlsState() {
  element<HTMLFieldSetElement>("controls").disabled = busy || running;
  element<HTMLButtonElement>("choose-source").disabled = !supported;
  element<HTMLButtonElement>("empty-choose").disabled =
    !supported || busy || running;
  element<HTMLButtonElement>("choose-output").disabled = !source;
  element<HTMLButtonElement>("start").disabled =
    !supported ||
    busy ||
    running ||
    !dateValid ||
    !validStyles() ||
    !photos.length;
  element("cancel").hidden = !running;
  element<HTMLButtonElement>("cancel").disabled = cancelling;
  element<HTMLButtonElement>("stamp-drag").disabled = busy || running;
  const invalidStyle = [
    "font-number",
    "right-number",
    "bottom-number",
    "color-text",
  ]
    .map(input)
    .find((field) => !field.validity.valid);
  element("style-error").hidden = !invalidStyle;
  element("style-error").textContent = invalidStyle?.validationMessage ?? "";
}
function persist() {
  element("save-status").textContent = saveSettings(settings)
    ? "設定已自動保存"
    : "瀏覽器無法保存，請匯出備份";
}
function syncSettings() {
  for (const id of [
    "font-number",
    "right-number",
    "bottom-number",
    "color-text",
  ])
    input(id).setCustomValidity("");
  input("font-slider").value = input("font-number").value = String(
    settings.fontSizePercent,
  );
  input("right-slider").value = input("right-number").value = String(
    settings.rightPercent,
  );
  input("bottom-slider").value = input("bottom-number").value = String(
    settings.bottomPercent,
  );
  input("color").value = input("color-text").value = settings.color;
  element<HTMLSelectElement>("date-format").value = settings.dateFormat;
  element("date-sample").style.color = settings.color;
  if (dateValid)
    element("date-sample").textContent = formatDate(date, settings.dateFormat);
}
function changed() {
  persist();
  syncSettings();
  controlsState();
  schedulePreview();
}
function updateDate(value: string) {
  try {
    date = parseDate(value);
    dateValid = true;
    input("date-picker").value = date;
    input("date-text").setAttribute("aria-invalid", "false");
    element("date-error").hidden = true;
    syncSettings();
    schedulePreview();
  } catch (e) {
    dateValid = false;
    previewRevision++;
    input("date-text").setAttribute("aria-invalid", "true");
    element("date-error").textContent = errorText(e);
    element("date-error").hidden = false;
  }
  controlsState();
}
function updateOutput() {
  element("output-name").textContent = output
    ? output.name
    : source
      ? `${source.name} / dated`
      : "選擇工作目錄後自動設定";
  element("default-output").hidden = !output;
}
function renderList() {
  const list = element("file-list");
  list.replaceChildren();
  fileRows.clear();
  if (!photos.length) {
    const p = document.createElement("p");
    p.className = "list-empty";
    p.textContent = "此目錄沒有可處理的 JPEG、PNG 或 WebP 照片。";
    list.append(p);
  }
  for (const [index, photo] of photos.entries()) {
    const row = document.createElement("button");
    row.className = "file-row";
    row.dataset.index = String(index);
    row.setAttribute("role", "listitem");
    const number = document.createElement("span");
    number.className = "file-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.className = "file-label";
    const name = document.createElement("strong");
    name.textContent = photo.name;
    label.append(name);
    const detail = document.createElement("small");
    detail.className = "file-detail";
    label.append(detail);
    const status = document.createElement("span");
    status.className = "file-status";
    row.append(number, label, status);
    row.addEventListener("click", () => {
      if (running || busy) return;
      selected = index;
      updateRows();
      schedulePreview();
    });
    list.append(row);
    fileRows.set(photo, row);
  }
  updateRows();
}
function updateRows() {
  for (const photo of photos) updateRow(photo);
}
function updateRow(photo: PhotoItem) {
  const states = {
    pending: "待處理",
    processing: "處理中",
    success: "已完成",
    failed: "失敗",
  };
  const row = fileRows.get(photo);
  if (row) {
    const index = Number(row.dataset.index);
    row.classList.toggle("selected", index === selected);
    row.disabled = busy || running;
    row.setAttribute("aria-pressed", String(index === selected));
    row.dataset.status = photo.status;
    row.querySelector(".file-status")!.textContent = states[photo.status];
    row.querySelector(".file-detail")!.textContent = photo.detail ?? "";
    row.title = photo.detail ? `${photo.name} — ${photo.detail}` : photo.name;
  }
}
function clearPreview() {
  previewRevision++;
  previewResult = undefined;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  element("image-wrap").hidden = true;
  element("empty-preview").hidden = false;
  element<HTMLImageElement>("preview-image").onload = null;
  element<HTMLImageElement>("preview-image").removeAttribute("src");
}
function schedulePreview() {
  previewRevision++;
  previewPending = true;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    previewTimer = undefined;
    if (!previewTask && !running)
      previewTask = drainPreviews().finally(() => {
        previewTask = undefined;
      });
  }, 80);
}
async function drainPreviews() {
  while (previewPending && !running) {
    previewPending = false;
    const revision = previewRevision;
    const item = photos[selected];
    if (!item || !dateValid) continue;
    element("preview-loading").hidden = false;
    element("preview-name").textContent = item.name;
    try {
      processor ??= new ImageProcessor();
      const result = await processor.render(
        await item.handle.getFile(),
        { ...settings },
        date,
        true,
      );
      if (revision !== previewRevision || running) continue;
      previewResult = result;
      const url = URL.createObjectURL(result.blob);
      const img = element<HTMLImageElement>("preview-image");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = url;
      img.onload = () => {
        if (previewUrl === url) positionDrag();
      };
      img.src = url;
      element("image-wrap").hidden = false;
      element("empty-preview").hidden = true;
      element("preview-info").textContent =
        `${result.width.toLocaleString()} × ${result.height.toLocaleString()} px · 字級 ${Math.round(result.fontSize)} px`;
      positionDrag();
    } catch (e) {
      if (revision !== previewRevision) continue;
      clearPreview();
      element("empty-preview").querySelector("h3")!.textContent =
        "無法預覽這張照片";
      element("empty-preview").querySelector("p")!.textContent = errorText(e);
      element("preview-info").textContent =
        "可選擇其他照片；批次時會記錄無法處理的檔案。";
    } finally {
      element("preview-loading").hidden = true;
    }
  }
}
function positionDrag() {
  if (!previewResult) return;
  const { bounds, width, height } = previewResult;
  Object.assign(element("stamp-drag").style, {
    left: `${(bounds.x / width) * 100}%`,
    top: `${(bounds.y / height) * 100}%`,
    width: `${(bounds.width / width) * 100}%`,
    height: `${(bounds.height / height) * 100}%`,
  });
}
async function chooseSource() {
  try {
    const chosen = await window.showDirectoryPicker({
      id: "photo-date-source",
      mode: "read",
    });
    busy = true;
    controlsState();
    const scan = await scanDirectory(chosen);
    source = chosen;
    output = undefined;
    photos = scan.photos;
    selected = photos.length ? 0 : -1;
    clearPreview();
    renderList();
    updateOutput();
    element("source-name").textContent = chosen.name;
    element("photo-count").textContent = String(photos.length);
    element("scan-info").textContent =
      `${scan.ignored} 個非支援檔案未載入 · ${scan.subdirectories} 個子目錄未讀取`;
    element("list-summary").textContent = `${photos.length} 張照片`;
    element("progress-title").textContent = photos.length
      ? "準備開始"
      : "沒有可處理的照片";
    element("progress-detail").textContent = photos.length
      ? "確認日期與預覽效果後，即可開始。"
      : "請選擇包含 JPEG、PNG 或 WebP 的目錄。";
    element("progress-count").textContent = `0 / ${photos.length}`;
    element<HTMLProgressElement>("progress").value = 0;
    element("message").hidden = true;
    element("empty-preview").querySelector("h3")!.textContent =
      "從一個資料夾開始";
    element("empty-preview").querySelector("p")!.textContent =
      "選擇工作目錄，即可預覽照片與日期效果。";
    schedulePreview();
  } catch (e) {
    if (!(e instanceof DOMException && e.name === "AbortError"))
      notify(`無法載入工作目錄：${errorText(e)}`, true);
  } finally {
    busy = false;
    controlsState();
    updateRows();
  }
}
element("choose-source").addEventListener("click", chooseSource);
element("empty-choose").addEventListener("click", chooseSource);
element("choose-output").addEventListener("click", async () => {
  try {
    output = await window.showDirectoryPicker({
      id: "photo-date-output",
      mode: "readwrite",
    });
    updateOutput();
  } catch (e) {
    if (!(e instanceof DOMException && e.name === "AbortError"))
      notify(`無法選擇輸出目錄：${errorText(e)}`, true);
  }
});
element("default-output").addEventListener("click", () => {
  output = undefined;
  updateOutput();
});
input("date-text").addEventListener("input", () =>
  updateDate(input("date-text").value),
);
input("date-text").addEventListener("blur", () => {
  if (dateValid) input("date-text").value = date.replaceAll("-", "/");
});
input("date-picker").addEventListener("change", () => {
  input("date-text").value = input("date-picker").value.replaceAll("-", "/");
  updateDate(input("date-picker").value);
});
element("date-format").addEventListener("change", () => {
  settings.dateFormat = element<HTMLSelectElement>("date-format")
    .value as AppSettings["dateFormat"];
  changed();
});
for (const [prefix, key, min, max] of [
  ["font", "fontSizePercent", 0.5, 15],
  ["right", "rightPercent", 0, 95],
  ["bottom", "bottomPercent", 0, 95],
] as const) {
  for (const suffix of ["slider", "number"])
    input(`${prefix}-${suffix}`).addEventListener("input", () => {
      const field = input(`${prefix}-${suffix}`);
      const value = field.valueAsNumber;
      if (!Number.isFinite(value) || value < min || value > max) {
        field.setCustomValidity(`請輸入 ${min} 到 ${max}。`);
        controlsState();
        return;
      }
      field.setCustomValidity("");
      settings[key] = value;
      changed();
    });
}
input("color").addEventListener("input", () => {
  settings.color = input("color").value.toUpperCase();
  input("color-text").setCustomValidity("");
  changed();
});
input("color-text").addEventListener("input", () => {
  const value = input("color-text").value;
  if (!/^#[\da-f]{6}$/i.test(value)) {
    input("color-text").setCustomValidity("請輸入完整色碼，例如 #FFD700。");
    controlsState();
    return;
  }
  input("color-text").setCustomValidity("");
  settings.color = value.toUpperCase();
  changed();
});
element("reset-size").addEventListener("click", () => {
  settings.fontSizePercent = DEFAULT_SETTINGS.fontSizePercent;
  changed();
});
element("reset-position").addEventListener("click", () => {
  settings.rightPercent = DEFAULT_SETTINGS.rightPercent;
  settings.bottomPercent = DEFAULT_SETTINGS.bottomPercent;
  changed();
});
element("reset-color").addEventListener("click", () => {
  settings.color = DEFAULT_SETTINGS.color;
  changed();
});
element("reset-all").addEventListener("click", () => {
  settings = { ...DEFAULT_SETTINGS };
  changed();
});
element("export-settings").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "photo-date-settings.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
element("import-settings").addEventListener("click", () =>
  input("settings-file").click(),
);
input("settings-file").addEventListener("change", async () => {
  const file = input("settings-file").files?.[0];
  try {
    if (file) {
      if (file.size > 64 * 1024)
        throw new Error("設定檔過大，請選擇本工具匯出的 JSON。");
      settings = parseSettings(await file.text());
      changed();
      notify("已匯入設定，預覽已更新。");
    }
  } catch (e) {
    notify(errorText(e), true);
  } finally {
    input("settings-file").value = "";
  }
});

let drag:
  | {
      pointer: number;
      x: number;
      y: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    }
  | undefined;
element("stamp-drag").addEventListener("pointerdown", (e) => {
  if (running || busy || !previewResult) return;
  const rect = element("image-wrap").getBoundingClientRect();
  drag = {
    pointer: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    right: settings.rightPercent,
    bottom: settings.bottomPercent,
    width: rect.width,
    height: rect.height,
  };
  element("stamp-drag").setPointerCapture(e.pointerId);
  e.preventDefault();
});
element("stamp-drag").addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.pointer) return;
  settings.rightPercent =
    Math.round(
      Math.max(
        0,
        Math.min(95, drag.right - ((e.clientX - drag.x) / drag.width) * 100),
      ) * 10,
    ) / 10;
  settings.bottomPercent =
    Math.round(
      Math.max(
        0,
        Math.min(95, drag.bottom - ((e.clientY - drag.y) / drag.height) * 100),
      ) * 10,
    ) / 10;
  changed();
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  element("stamp-drag").addEventListener(event, () => {
    drag = undefined;
  });
element("stamp-drag").addEventListener("keydown", (e) => {
  const keys: Record<string, [number, number]> = {
    ArrowLeft: [0.1, 0],
    ArrowRight: [-0.1, 0],
    ArrowUp: [0, 0.1],
    ArrowDown: [0, -0.1],
  };
  if (!keys[e.key]) return;
  e.preventDefault();
  const [right, bottom] = keys[e.key];
  settings.rightPercent = Math.max(
    0,
    Math.min(95, +(settings.rightPercent + right).toFixed(1)),
  );
  settings.bottomPercent = Math.max(
    0,
    Math.min(95, +(settings.bottomPercent + bottom).toFixed(1)),
  );
  changed();
});
element("cancel").addEventListener("click", () => {
  cancelling = true;
  controlsState();
  element("progress-detail").textContent = "正在完成目前照片，完成後停止…";
});
element("start").addEventListener("click", async () => {
  if (
    !source ||
    running ||
    busy ||
    !dateValid ||
    !validStyles() ||
    !photos.length
  )
    return;
  // Permission must be requested from this user gesture, before preview or image work.
  busy = true;
  cancelling = false;
  controlsState();
  try {
    await ensureWritePermission(output ?? source);
    const destination =
      output ?? (await source.getDirectoryHandle("dated", { create: true }));
    const write = await createWriter(destination);
    if (previewTimer) clearTimeout(previewTimer);
    previewPending = false;
    previewRevision++;
    await previewTask;
    running = true;
    busy = false;
    controlsState();
    element("message").hidden = true;
    for (const photo of photos) {
      photo.status = "pending";
      photo.detail = undefined;
    }
    updateRows();
    const progress = element<HTMLProgressElement>("progress");
    progress.max = photos.length;
    progress.value = 0;
    let successes = 0;
    let failures = 0;
    processor ??= new ImageProcessor();
    const result = await runBatch(photos, { ...settings }, date, {
      render: (file, snapshot, stampDate) =>
        processor!.render(file, snapshot, stampDate),
      write,
      isCancelled: () => cancelling,
      onUpdate: (photo, completed, total) => {
        progress.value = completed;
        element("progress-title").textContent = cancelling
          ? "正在取消"
          : "正在處理照片";
        element("progress-count").textContent = `${completed} / ${total}`;
        element("progress-detail").textContent = photo.name;
        if (photo.status === "success") successes++;
        if (photo.status === "failed") failures++;
        element("list-summary").textContent =
          `成功 ${successes} · 失敗 ${failures}`;
        updateRow(photo);
      },
    });
    element("progress-title").textContent = result.fatal
      ? "處理已停止"
      : result.cancelled
        ? "已取消處理"
        : "批次處理完成";
    element("progress-detail").textContent =
      `成功 ${result.success} 張 · 失敗 ${result.failed} 張 · 未處理 ${photos.length - result.success - result.failed} 張`;
    if (result.fatal) notify(result.fatal, true);
    else
      notify(
        result.cancelled
          ? "已停止。完成的照片已保留在輸出目錄。"
          : `批次完成，已將 ${result.success} 張照片寫入 ${destination.name}。`,
      );
  } catch (e) {
    notify(`無法開始處理：${errorText(e)}`, true);
  } finally {
    running = false;
    busy = false;
    cancelling = false;
    controlsState();
    updateRows();
    schedulePreview();
  }
});
window.addEventListener("beforeunload", (e) => {
  if (running || busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
input("date-text").value = date.replaceAll("-", "/");
input("date-picker").value = date;
for (const id of ["font-number", "right-number", "bottom-number"])
  input(id).step = "any";
syncSettings();
controlsState();
if (!supported) {
  element("compatibility").hidden = false;
  element("compatibility").textContent =
    "請使用電腦版 Chrome 或 Edge，並以 HTTPS 網址或 localhost 開啟。本工具需要瀏覽器的目錄讀寫功能。";
}
if (loaded.warning) notify(loaded.warning, true);
