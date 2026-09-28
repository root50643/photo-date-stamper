# 自動化驗證紀錄

本紀錄整理 2026-09-28 開發環境的已完成驗證，與 [手動驗證清單](manual-test.md) 分開追蹤。後續修改需重跑相關測試。

## GitHub 發布

2026-09-28 已推送至 [root50643/photo-date-stamper](https://github.com/root50643/photo-date-stamper)。[首次 Pages 部署](https://github.com/root50643/photo-date-stamper/actions/runs/36376606475)成功，正式網站 [https://root50643.github.io/photo-date-stamper/](https://root50643.github.io/photo-date-stamper/) 回應 HTTP 200。

首次 Linux CI 發現小尺寸 JPEG／WebP 的嚴格字色像素門檻受到有損編碼及平台抗鋸齒差異影響。格式／尺寸測試改用較大的字形，仍驗證 MIME、完整尺寸與黃色像素；預設字級、透明度、方向與日期排版由其他案例持續驗證。最新檢查結果以 [GitHub Actions](https://github.com/root50643/photo-date-stamper/actions) 為準。

執行環境：Windows NT 10.0.26200.0、Chrome 153.0.8010.54、Microsoft Edge 153.0.4234.48。

## 已完成

| 驗證 | 環境／範圍 | 結果 |
| --- | --- | --- |
| 型別檢查及正式建置 | `pnpm check`、`pnpm build` | 通過 |
| 單元測試 | Vitest：日期、設定、排版、檔案系統、批次、圖片內容檢查 | 96 個通過 |
| 完整瀏覽器測試 | Windows 已安裝 Chrome channel | 28 個通過，18.4 秒 |
| 圖片管線測試 | Windows 已安裝 Chrome channel | 20 個通過，包含在上述完整測試中 |
| 完整瀏覽器測試 | Windows 已安裝 Edge channel | 28 個通過，18.8 秒 |
| 圖片管線測試 | Windows 已安裝 Edge channel | 20 個通過，包含在上述完整測試中 |
| 畫面目視檢查 | 本機瀏覽器尚未選取照片的畫面 | 已檢查空白狀態的介面配置 |

圖片管線自動化測試在實際瀏覽器中執行 Worker 解碼、繪製與編碼，檢查下列行為：

- EXIF Orientation 1–8 的校正後寬高與四象限像素內容，確認旋轉及鏡射正確。
- 預覽與 PNG 輸出的日期字形、`YYYY/MM/DD` 兩條斜線及預設黃色；自訂字色與日期格式。
- JPEG、PNG、WebP 的實際輸出格式及完整像素尺寸；PNG／WebP 透明度。
- 大尺寸照片的預覽縮放與正式輸出尺寸，以及極小圖片的文字邊界。
- 動畫 PNG／WebP 及損壞圖片的明確拒絕。

完整瀏覽器測試另涵蓋工作目錄單層列舉、同名編號、原檔內容不變、手動輸出、JSON 匯入／匯出、日期和外觀驗證、取消後重跑、拖曳位置，以及 390 px 窄畫面與 200% 縮放配置。

## 自動化邊界

目錄案例透過 `navigator.storage.getDirectory()` 取得原生 OPFS handles，再讓 `showDirectoryPicker` 回傳測試用 handle。程式實際使用 File System Access API 讀寫瀏覽器私有檔案系統，並非純記憶體模擬；但測試**沒有操作 Windows 原生目錄選擇器，也沒有驗證 Windows 使用者目錄的授權與讀寫流程**。取消和拒絕授權案例由 stub 模擬錯誤。

正式資源測試先使用 `pnpm build` 產生 `dist/`，再由 `scripts/serve-dist.mjs` 於 `http://127.0.0.1:4174/photo-date-stamper/` 提供網站，確認專案子路徑下可載入網頁、字型及 Worker。這項案例測試本機正式產物；GitHub Actions 與正式 Pages 的紀錄另見上方「GitHub 發布」。

## 待人工或部署環境驗證

- Chrome／Edge 原生目錄選擇器、真實授權提示與拒絕後復原。
- 使用者磁碟目錄實際輸出、磁碟空間不足、裝置中斷及權限撤銷。
- 大量真實照片的記憶體走勢與長時間操作；真實相機樣本的人工品質比對。
- Pages 正式 HTTPS 網址上的原生目錄授權與真實磁碟讀寫驗收。

人工檢查項目尚未逐一執行，因此手動清單保留未勾選狀態；這不會否定已通過的同類自動化測試，也不以自動化結果取代人工驗收。
