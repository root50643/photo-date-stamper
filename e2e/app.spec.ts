import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page, count = 3) {
  return page.evaluate(async (total) => {
    const root = await navigator.storage.getDirectory();
    const source = await root.getDirectoryHandle("測試照片", { create: true });
    const output = await source.getDirectoryHandle("dated", { create: true });
    const manual = await root.getDirectoryHandle("手動輸出", { create: true });
    const put = async (
      dir: FileSystemDirectoryHandle,
      name: string,
      data: Blob | string,
    ) => {
      const handle = await dir.getFileHandle(name, { create: true });
      const writer = await handle.createWritable();
      await writer.write(data);
      await writer.close();
    };
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#56829d";
    c.fillRect(0, 0, 800, 600);
    c.fillStyle = "#aec8d1";
    c.fillRect(0, 0, 800, 260);
    c.fillStyle = "#28494a";
    c.fillRect(0, 440, 800, 160);
    const data = await new Promise<Blob>((r) =>
      canvas.toBlob((blob) => r(blob!), "image/png"),
    );
    for (let i = 0; i < total; i++)
      await put(source, `照片 ${i + 1}.png`, data);
    await put(source, "說明.txt", "不要修改");
    await put(
      await source.getDirectoryHandle("子目錄", { create: true }),
      "忽略.png",
      data,
    );
    await put(output, "照片 1.png", "已存在的檔案");
    const original = await (await source.getFileHandle("照片 1.png")).getFile();
    const originalBytes = Array.from(
      new Uint8Array(await original.arrayBuffer()),
    );
    window.showDirectoryPicker = async (options) =>
      options?.id === "photo-date-output" ? manual : source;
    return originalBytes;
  }, count);
}

test("local directory flow, preview, settings, output collision and original preservation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#date-format")).toHaveValue("YYYY/MM/DD");
  const original = await seed(page);
  await page.locator("#choose-source").click();
  await expect(page.locator("#photo-count")).toHaveText("3");
  await expect(page.locator("#scan-info")).toContainText("2 個子目錄");
  await expect(page.locator("#preview-image")).toBeVisible();
  await expect(page.locator("#preview-info")).toContainText("800 × 600");
  await page.locator("#date-text").fill("2026/09/28");
  await page.locator("#date-format").selectOption("YYYY-MM-DD");
  await expect(page.locator("#date-sample")).toHaveText("2026-09-28");
  await page.locator("#font-number").fill("4");
  await page.locator("#color-text").fill("#FFFF00");
  await page.locator("#stamp-drag").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#right-number")).toHaveValue("3.1");
  await page.locator("#reset-position").click();
  await expect(page.locator("#right-number")).toHaveValue("3");
  await page.locator("#start").click();
  await expect(page.locator("#progress-title")).toHaveText("批次處理完成");
  await expect(page.locator("#progress-count")).toHaveText("3 / 3");
  await expect(page.locator("#progress-detail")).toContainText("成功 3 張");
  const written = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("測試照片");
    const out = await dir.getDirectoryHandle("dated");
    const first = await (await out.getFileHandle("照片 1_1.png")).getFile();
    const bitmap = await createImageBitmap(first);
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      existing: await (
        await (await out.getFileHandle("照片 1.png")).getFile()
      ).text(),
      original: Array.from(
        new Uint8Array(
          await (
            await (await dir.getFileHandle("照片 1.png")).getFile()
          ).arrayBuffer(),
        ),
      ),
    };
    bitmap.close();
    return result;
  });
  expect(written).toEqual({
    width: 800,
    height: 600,
    existing: "已存在的檔案",
    original,
  });
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.locator("#date-format")).toHaveValue("YYYY-MM-DD");
  await expect(page.locator("#font-number")).toHaveValue("4");
  await expect(page.locator("#photo-count")).toHaveText("0");
  await page.locator("#reset-all").click();
  await expect(page.locator("#date-format")).toHaveValue("YYYY/MM/DD");
  await expect(page.locator("#color-text")).toHaveValue("#FFD700");
});

test("manual destination, invalid date, JSON import/export and safe failures", async ({
  page,
}) => {
  await page.goto("/");
  await seed(page, 1);
  await page.locator("#choose-source").click();
  await expect(page.locator("#preview-image")).toBeVisible();
  await page.locator("#date-text").fill("2026/02/30");
  await expect(page.locator("#date-error")).toBeVisible();
  await expect(page.locator("#start")).toBeDisabled();
  await page.locator("#date-text").fill("2024.02.29");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#choose-output").click();
  await expect(page.locator("#output-name")).toHaveText("手動輸出");
  await page
    .locator("#settings-file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await expect(page.locator("#message")).toHaveClass(/error/);
  await expect(page.locator("#date-format")).toHaveValue("YYYY/MM/DD");
  const settings = {
    version: 1,
    dateFormat: "YY.MM.DD",
    color: "#123456",
    fontSizePercent: 4,
    rightPercent: 5,
    bottomPercent: 6,
  };
  await page
    .locator("#settings-file")
    .setInputFiles({
      name: "settings.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(settings)),
    });
  await expect(page.locator("#date-format")).toHaveValue("YY.MM.DD");
  await expect(page.locator("#color-text")).toHaveValue("#123456");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-settings").click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "photo-date-settings.json",
  );
  await page.locator("#start").click();
  await expect(page.locator("#progress-title")).toHaveText("批次處理完成");
  expect(
    await page.evaluate(async () => {
      const dir = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle("手動輸出");
      return (await (await dir.getFileHandle("照片 1.png")).getFile()).size;
    }),
  ).toBeGreaterThan(100);
});

test("folder cancellation and permission refusal preserve recoverable UI", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => {
      throw new DOMException("取消", "AbortError");
    };
  });
  await page.locator("#choose-source").click();
  await expect(page.locator("#message")).toBeHidden();
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => {
      throw new DOMException("拒絕存取", "NotAllowedError");
    };
  });
  await page.locator("#choose-source").click();
  await expect(page.locator("#message")).toContainText("拒絕存取");
  await expect(page.locator("#choose-source")).toBeEnabled();
});

test("batch can cancel at a file boundary and rerun without overwriting", async ({
  page,
}) => {
  await page.goto("/");
  await seed(page, 40);
  await page.locator("#choose-source").click();
  await expect(page.locator("#preview-image")).toBeVisible();
  await page.locator("#start").click();
  await expect(page.locator("#cancel")).toBeVisible();
  await expect(page.locator("#font-number")).toBeDisabled();
  await page.locator("#cancel").click();
  await expect(page.locator("#progress-title")).toHaveText("已取消處理");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#start").click();
  await expect(page.locator("#progress-title")).toHaveText("批次處理完成");
  await expect(page.locator("#progress-detail")).toContainText("成功 40 張");
});

test("production assets, worker and font work beneath a Pages subpath", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("http://127.0.0.1:4174/photo-date-stamper/");
  await seed(page, 1);
  await page.locator("#choose-source").click();
  await expect(page.locator("#preview-info")).toContainText("800 × 600");
  await page.locator("#start").click();
  await expect(page.locator("#progress-title")).toHaveText("批次處理完成");
  expect(errors).toEqual([]);
});

test("narrow layout and 200% text remain within the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("invalid styles block processing and reset clears validation", async ({
  page,
}) => {
  await page.goto("/");
  await seed(page, 1);
  await page.locator("#choose-source").click();
  await expect(page.locator("#preview-image")).toBeVisible();
  await page.locator("#font-number").fill("999");
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#style-error")).toBeVisible();
  await page.locator("#reset-size").click();
  await expect(page.locator("#font-number")).toHaveValue("3");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#color-text").fill("#GGGGGG");
  await expect(page.locator("#start")).toBeDisabled();
  await page.locator("#reset-color").click();
  await expect(page.locator("#start")).toBeEnabled();
  const before = await page.locator("#preview-image").getAttribute("src");
  await page.locator("#color-text").fill("#00FF00");
  await page.locator("#start").click();
  await expect(page.locator("#progress-title")).toHaveText("批次處理完成");
  await expect(page.locator("#preview-image")).not.toHaveAttribute(
    "src",
    before!,
  );
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const image =
          document.querySelector<HTMLImageElement>("#preview-image")!;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let green = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i + 1] > 200 && data[i] < 50 && data[i + 2] < 50) green++;
        return green;
      }),
    )
    .toBeGreaterThan(20);
});

test("dragging the date updates relative margins", async ({ page }) => {
  await page.goto("/");
  await seed(page, 1);
  await page.locator("#choose-source").click();
  await expect(page.locator("#preview-image")).toBeVisible();
  const box = await page.locator("#stamp-drag").boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 30, y - 25, { steps: 5 });
  await page.mouse.up();
  expect(
    Number(await page.locator("#right-number").inputValue()),
  ).toBeGreaterThan(3);
  expect(
    Number(await page.locator("#bottom-number").inputValue()),
  ).toBeGreaterThan(3);
});
