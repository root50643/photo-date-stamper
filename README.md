# 照片加日期

純前端的批次照片日期工具。使用電腦版 Chrome 或 Edge 開啟網站，選擇照片所在目錄、調整日期效果，便能將日期印在照片右下角並寫入本機輸出目錄。照片由瀏覽器在本機處理，沒有後端，也不會上傳照片。

介面使用繁體中文，提供照片預覽、日期拖曳定位、自動比例字級、顏色選擇、設定備份、批次進度與取消功能。

## 使用需求

- **使用者**只需要電腦版 Chrome 或 Microsoft Edge，不必安裝 Node.js、pnpm 或桌面程式。
- 從 **HTTPS 網址**開啟網站，例如 GitHub Pages；本機開發可使用 `http://localhost` 或 `http://127.0.0.1`。
- 瀏覽器必須提供 `showDirectoryPicker`、Web Worker 與 OffscreenCanvas。Firefox、Safari 和行動裝置不列入本版支援範圍。
- 選取目錄時授予讀取權限，開始處理前授予輸出目錄的寫入權限。公司管理政策、唯讀磁碟或受保護資料夾可能限制存取。
- 目錄必須透過瀏覽器的選擇器指定；網頁不能透過輸入 `C:\照片` 等文字路徑直接取得檔案存取權。

目錄存取使用瀏覽器的 [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)。請使用網站或本機開發伺服器開啟，不要直接雙擊 `index.html`。

## 快速開始

1. 按下「選擇工作目錄」，選取照片所在資料夾。程式只列出該層的 `.jpg`、`.jpeg`、`.png`、`.webp`，副檔名不區分大小寫，**不會掃描子目錄**。
2. 確認輸出目錄。預設為工作目錄內的 `dated`，開始執行時才建立；也可以手動選擇其他輸出目錄，再切回預設輸出目錄。
3. 使用日曆或文字輸入指定日期；文字接受 `YYYY-MM-DD`、`YYYY/MM/DD`、`YYYY.MM.DD`，月份與日期需各兩位。同一批照片套用同一天；程式不會讀取 EXIF 拍攝日期作為蓋印日期。
4. 選擇日期格式，切換清單中的照片檢查預覽，調整大小、顏色及右側／底部間距。也可以直接拖曳預覽內的日期。
5. 按下「開始批次處理」，允許瀏覽器寫入。處理期間顯示目前檔名、進度、成功與失敗數量。
6. 完成後至輸出目錄查看圖片。清單會顯示每張照片的結果或失敗原因。

開始處理後，本批的日期、格式與外觀設定固定，來源、輸出與效果控制項暫時停用。按下取消後會完成正在處理的照片，再停止；已寫入的照片會保留。請等狀態顯示完成或已取消再關閉網頁；強制關閉網頁不等同於按取消。

### 輸出名稱與原檔保護

輸出沿用原檔名。若輸出目錄已存在同名項目，程式會尋找可用的流水號，例如 `photo.jpg` → `photo_1.jpg` → `photo_2.jpg`。重跑一批也會產生新的檔名。

來源與輸出可以選擇同一個目錄，既有來源檔會觸發同名編號；本批只處理載入時取得的清單，不會把本批新增的檔案再加入處理。之後重新載入該目錄時，先前輸出的圖片也會出現在清單中，可能被再次蓋上日期；建議使用預設的 `dated` 子目錄。

程式會檢查檔名避免覆寫既有項目，但瀏覽器檔案 API 不提供完整的跨程式「檢查並獨占建立」機制，無法完全阻止另一個程式在極短時間內建立同名檔案。請避免同時在同一輸出目錄執行多批作業。

## 日期與外觀設定

| 設定 | 預設值 | 行為 |
| --- | --- | --- |
| 日期 | 裝置當天日期 | 每次重新開啟或重新整理網頁回到當天 |
| 日期格式 | `YYYY/MM/DD` | 可切換為下表的四種格式 |
| 字體顏色 | 黃色 `#FFD700` | 可自訂，附細暗色描邊 |
| 字體大小 | 照片短邊的 `3%` | 依校正方向後的尺寸計算，可用比例調整 |
| 右側間距 | 照片寬度的 `3%` | 可輸入數值、操作滑桿或拖曳日期 |
| 底部間距 | 照片高度的 `3%` | 可輸入數值、操作滑桿或拖曳日期 |

| 格式 | 範例 |
| --- | --- |
| `YYYY/MM/DD`（預設） | `2026/09/28` |
| `YYYY.MM.DD` | `2026.09.28` |
| `YYYY-MM-DD` | `2026-09-28` |
| `YY.MM.DD` | `26.09.28` |

日期數字採 DSEG7 Classic Bold 復古數位字體，Canvas 字型設定為 `PhotoDate, monospace`；DSEG 沒有的斜線 `/` 由等寬字體補上，因此預設的 `YYYY/MM/DD` 可正常呈現。位置與字級依比例保存，因此混合直式與橫式照片仍能自動調整。這裡的「自動位置」是根據圖片尺寸與文字邊界計算右下角留白，並非分析人臉或照片主體以避讓內容。

位置、大小、顏色各自提供恢復預設功能；全部恢復預設也會把日期格式設回 `YYYY/MM/DD`。渲染時會根據實際文字邊界限制位置，必要時縮小文字，避免日期及描邊超出圖片。過大的自訂字級可能因此比要求值小。

## 設定保存與 JSON 備份

外觀與日期格式會自動保存在目前網站來源的 `localStorage`，下次開啟時恢復。不同瀏覽器、不同網站來源的設定互相獨立；清除網站資料或結束部分無痕視窗後，設定可能消失。網站若無法使用本機儲存，請使用 JSON 匯出保存設定。

使用「匯出設定」下載 JSON；之後可用「匯入設定」恢復，或移到另一台電腦。匯入會驗證版本、格式、顏色與數值範圍，拒絕不合規的內容；不會執行 JSON 中的程式碼。

版本 1 的字級範圍為 `0.5`–`15`%，右側與底部間距為 `0`–`95`%，顏色使用六位 `#RRGGBB`。所有欄位都必須存在；未知欄位與未知版本會被拒絕。自動保存的 key 為 `photo-date-stamper.settings.v1`。

預設設定範例：

```json
{
  "version": 1,
  "dateFormat": "YYYY/MM/DD",
  "color": "#FFD700",
  "fontSizePercent": 3,
  "rightPercent": 3,
  "bottomPercent": 3
}
```

日期值、照片內容、工作目錄、輸出目錄及存取授權都不包含在設定檔中。每次開啟網頁仍須重新選取目錄；瀏覽器是否再次詢問權限由瀏覽器本身決定。

## 支援格式與影像品質

- 支援靜態 JPEG、PNG、WebP。GIF、HEIC／HEIF、RAW、TIFF 等格式不支援；動畫 PNG／WebP 會被拒絕，不會只取第一格假裝成功。
- 載入目錄時依副檔名篩選，解碼時再檢查實際內容；損壞檔案或副檔名與內容不符時可能處理失敗。
- 依 EXIF 方向校正影像，輸出維持校正後的像素尺寸。直式照片原本以旋轉標記表示方向時，輸出的寬高可能交換。
- 維持 JPEG、PNG、WebP 原格式。JPEG／WebP 重新編碼品質參數為 `0.95`；PNG 保持無損編碼，PNG／WebP 保留透明度。輸出時驗證實際格式，避免瀏覽器回退成其他格式卻沿用錯誤副檔名。
- 蓋印會重新編碼整張照片。JPEG／WebP 可能增加壓縮損失，檔案大小也可能改變；`0.95` 是編碼參數，不代表保留原檔 95% 的資料。
- **不保證保留 EXIF、GPS、ICC 色彩描述檔及其他附加資訊。** 瀏覽器的解碼與色彩管理也可能影響顏色。需要原始資訊時請保留原照片。
- 大量照片逐張處理並釋放資源；單張超大照片仍受瀏覽器的 Canvas 尺寸與可用記憶體限制。

## 本機開發

以下工具只供維護者使用。建議 **Node.js 24** 與 **pnpm 11.19.0**；CI 使用相同版本，並以 `pnpm-lock.yaml` 鎖定相依套件。

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

開啟終端機顯示的本機網址，通常是 `http://127.0.0.1:5173`。

| 指令 | 用途 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 依鎖定檔安裝相依套件 |
| `pnpm dev` | 啟動開發伺服器 |
| `pnpm check` | TypeScript 型別檢查 |
| `pnpm test` | 執行 Vitest 測試 |
| `pnpm build` | 型別檢查並輸出靜態網站至 `dist/` |
| `pnpm test:browser` | 執行 Playwright 瀏覽器測試；必須先執行 `pnpm build` 更新 `dist/` |
| `pnpm preview` | 在本機預覽先前建置的 `dist/` |

首次執行瀏覽器測試前安裝 Playwright Chromium，並先建置正式網站：

```sh
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

Playwright 會啟動 Vite 開發伺服器 `http://127.0.0.1:4173`，以及由 `scripts/serve-dist.mjs` 提供的正式建置測試網址 `http://127.0.0.1:4174/photo-date-stamper/`。後者驗證 GitHub Pages 類型的專案子路徑，會讀取現有 `dist/`；修改程式後請重新 `pnpm build`，再執行瀏覽器測試。這兩個連接埠須可使用，測試期間不需要另外執行 `pnpm dev` 或 `pnpm preview`。

Linux CI 使用 `pnpm exec playwright install --with-deps chromium` 安裝瀏覽器及系統相依套件。若需要測試本機已安裝的 Chrome 或 Edge，可在 PowerShell 使用：

```powershell
pnpm build
$env:BROWSER_CHANNEL = 'chrome'
pnpm test:browser
$env:BROWSER_CHANNEL = 'msedge'
pnpm test:browser
Remove-Item Env:BROWSER_CHANNEL
```

Chrome／Edge 必須先安裝在測試電腦。自動化目錄流程以瀏覽器原生 OPFS（Origin Private File System，網站私有檔案系統）提供真實的 `FileSystemDirectoryHandle`／`FileSystemFileHandle`，並替代 `showDirectoryPicker` 的傳回值；測試會實際呼叫同套 Web API 讀寫，但不開啟 Windows 原生目錄選擇器。取消與權限拒絕案例使用 stub 模擬。因此這些測試不能證明 Windows 選擇器、作業系統目錄授權與使用者磁碟目錄流程已驗收；完整人工流程見 [手動驗證清單](docs/manual-test.md)。

## 專案架構

採用 TypeScript、Vite、原生 HTML/CSS 與 Canvas，沒有應用程式框架及後端服務。

| 區域 | 責任 |
| --- | --- |
| 介面層 | 設定控制、照片清單、預覽、拖曳定位及進度 |
| 目錄存取 | 選取目錄、單層列舉、授權、同名編號與檔案寫入 |
| 設定／日期 | 版本化 `AppSettings`、日期驗證、格式化及 JSON 匯入／匯出 |
| 圖片與排版 | 內容檢查、方向校正、字型載入、文字量測與邊界限制 |
| Worker／批次 | 背景逐張解碼、繪製及編碼，取消與單張失敗處理 |
| `public/fonts/` | 隨網站提供的字型與第三方授權 |
| `.github/workflows/` | 自動檢查與 GitHub Pages 部署 |

主執行緒持有目錄操作與 UI 狀態，將單張檔案及當批設定送至 Web Worker；Worker 回傳編碼後的 Blob 與圖片資訊，主執行緒寫入輸出目錄並更新進度。預覽和正式輸出共用日期格式化與排版邏輯。圖片逐張處理，不會先把整個目錄的照片全部解碼到記憶體。

外部沒有 API 介面。`AppSettings` 的 `version: 1` 是設定檔相容性識別；調整格式時應同時更新驗證、匯入行為和測試。靜態資源使用 Vite `base: './'`，可在根網址及 GitHub Pages 的專案子路徑下部署。

## GitHub Pages 部署

專案已包含工作流程，**交付原始碼本身不會建立 GitHub repository 或發布網站**。由維護者將程式推送到 GitHub 後啟用：

1. 建立 repository，將包含 `pnpm-lock.yaml`、`public/` 與 `.github/workflows/` 的專案推送至 `main` 分支。不要提交 `node_modules/`、`dist/` 或個人照片。
2. 在 repository 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 在 **Actions** 頁面選擇 **Deploy GitHub Pages**，按 **Run workflow**；往後推送 `main` 會自動執行。
4. 等待建置與部署工作完成，從部署工作顯示的網址開啟網站。專案網址通常為 `https://帳號.github.io/repository名稱/`。
5. 依手動驗證清單在正式 HTTPS 網址檢查字型、Worker、目錄授權及一批實際輸出。

`CI` 工作流程在 push、pull request 或手動觸發時執行型別檢查、單元測試、建置與 Chromium 瀏覽器測試。`Deploy GitHub Pages` 於 `main` push 或手動觸發時先檢查、測試、建置，再將 `dist/` 上傳成 Pages artifact，部署工作等待建置成功才執行。

部署工作使用 `github-pages` environment，取得 `pages: write` 與 `id-token: write` 權限；一般 CI 僅使用 `contents: read`，Pages 建置另使用 `pages: read` 讀取網站資訊。不需要自行建立 Personal Access Token。若 repository 有 environment 保護規則，需依規則完成核准。設定方式可對照 [GitHub 官方自訂 Pages 工作流程文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

若預設分支不是 `main`，請修改 Pages 工作流程的觸發分支及 deployment environment 分支規則。使用子路徑不需要把 repo 名稱硬編碼進 Vite 設定。所有網站靜態檔案可部署到其他 HTTPS 靜態主機；不要只上傳 `index.html` 而遺漏 `assets/` 和 `fonts/`。

## 常見問題

| 現象 | 處理方式 |
| --- | --- |
| 瀏覽器不支援或無法選擇目錄 | 改用電腦版 Chrome／Edge，確認網址是 HTTPS 或 localhost，且沒有被嵌入限制存取的 iframe |
| 選擇器被取消 | 重新按目錄選擇按鈕即可；取消本身不會開始處理 |
| 拒絕讀寫權限或權限失效 | 重新選取目錄並允許存取；必要時檢查網址旁的網站權限及作業系統資料夾權限 |
| `dated` 無法建立 | 確認來源目錄可寫入，或手動選擇可寫入的輸出目錄；檢查是否已有名為 `dated` 的一般檔案 |
| 沒有可處理的照片 | 確認檔案位於所選目錄本層且為支援格式；子目錄內的照片不會載入 |
| 某張圖片失敗 | 查看清單中的原因，確認檔案完整、為靜態圖片且可被瀏覽器解碼；其他照片可繼續處理 |
| 整批停止、磁碟空間不足或無法寫入 | 檢查輸出目錄授權、磁碟空間和裝置連線後重跑；先前成功輸出仍保留，重名會編號 |
| 照片很大或處理較慢 | 使用較小批次，關閉其他耗記憶體的分頁；單張圖片仍有瀏覽器尺寸上限 |
| 日期與預期拍攝日不同 | 日期來源為使用者輸入，不會自動讀取照片 EXIF；每次開啟預設回到當天 |
| 字體太大或日期靠近邊界 | 恢復預設位置與字級，或降低字級；文字邊界限制可能使實際大小縮小 |
| 設定未保留 | 確認使用同一瀏覽器及網址來源，未清除網站資料；可透過 JSON 匯出／匯入備份 |
| Pages 404 | 確認 Pages Source 為 GitHub Actions、部署成功及網址包含正確 repo 路徑 |
| 網頁有畫面但字型／Worker 失敗 | 確認完整上傳 `dist/`，網路面板沒有資源 404；重建並保留 `base: './'` |
| CI 顯示 lockfile 不一致 | 維護者本機執行 `pnpm install` 更新鎖定檔，確認變更後與 `package.json` 一起提交 |

## 驗證與授權

自動化測試檢查日期、設定、排版、檔案命名、批次流程、OPFS 讀寫與瀏覽器渲染。影像測試涵蓋 EXIF 方向 1–8 的輸出尺寸及四象限像素內容，並檢查日期斜線、字色、格式、透明度與動畫拒絕行為；已完成結果與驗證限制記錄於 [docs/verification.md](docs/verification.md)。

實際 Chrome／Edge 目錄選擇器、作業系統授權、使用者磁碟目錄、大量照片記憶體觀察及人工影像比對集中於 [docs/manual-test.md](docs/manual-test.md)。該清單的未勾選表示人工程序尚未記錄，與已通過的 EXIF 像素自動化測試分開追蹤。每次發行應記錄執行環境與結果，不能以本機子路徑測試推論正式 GitHub Pages 已部署或驗收。

復古字型使用 [DSEG](https://github.com/keshikan/DSEG)，其原始授權隨檔案放在 [`public/fonts/DSEG-LICENSE.txt`](public/fonts/DSEG-LICENSE.txt)。數字與 `/`、`.`、`-` 在預覽及輸出的可辨識性屬於瀏覽器驗證項目。第三方字型的授權不代表本專案程式碼已選定相同授權；程式碼的發佈授權由專案擁有者決定。
