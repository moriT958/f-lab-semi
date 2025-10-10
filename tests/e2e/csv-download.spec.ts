import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test.describe("CSV出力", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 既存の記録をすべて削除
    // テーブル内の削除ボタンのみを対象とする
    const deleteButtons = page
      .locator("#recordBody")
      .getByRole("button", { name: "削除" });
    const count = await deleteButtons.count();
    for (let i = 0; i < count; i++) {
      await deleteButtons.first().click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("CSVファイルをダウンロードできる", async ({ page }) => {
    // ユーザーが勤務記録を保存
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T17:00");
    await page
      .locator(".break-pair .breakStart")
      .first()
      .fill("2025-10-10T12:00");
    await page
      .locator(".break-pair .breakEnd")
      .first()
      .fill("2025-10-10T13:00");
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // ダウンロード待機の準備
    const downloadPromise = page.waitForEvent("download");

    // 「CSVで保存」ボタンをクリック
    await page.getByRole("button", { name: "CSVで保存" }).click();

    // ダウンロードが開始されることを確認
    const download = await downloadPromise;

    // ダウンロードされたファイル名を確認
    expect(download.suggestedFilename()).toBe("勤務記録.csv");

    // ダウンロードされたファイルを一時保存
    const filePath = path.join("/tmp", download.suggestedFilename());
    await download.saveAs(filePath);

    // ファイルが存在することを確認
    expect(fs.existsSync(filePath)).toBe(true);

    // クリーンアップ
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test("ダウンロードされたCSVに勤務記録が含まれる", async ({ page }) => {
    // 勤務記録を保存
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T17:00");
    await page
      .locator(".break-pair .breakStart")
      .first()
      .fill("2025-10-10T12:00");
    await page
      .locator(".break-pair .breakEnd")
      .first()
      .fill("2025-10-10T13:00");
    await page.getByLabel("時給（円）：").fill("1200");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // CSVをダウンロード
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSVで保存" }).click();
    const download = await downloadPromise;

    // ファイルを読み込み
    const filePath = path.join("/tmp", download.suggestedFilename());
    await download.saveAs(filePath);
    const csvContent = fs.readFileSync(filePath, "utf-8");

    // CSVの内容を検証
    // ヘッダー行が含まれることを確認
    expect(csvContent).toContain("勤務日");
    expect(csvContent).toContain("時間");
    expect(csvContent).toContain("休憩時間");
    expect(csvContent).toContain("実働");
    expect(csvContent).toContain("深夜分");
    expect(csvContent).toContain("給料");

    // 勤務記録のデータが含まれることを確認
    expect(csvContent).toContain("10/10/2025");
    expect(csvContent).toContain("9:00"); // Time is in AM/PM format
    expect(csvContent).toContain("5:00"); // 17:00 displayed as 5:00 PM
    expect(csvContent).toContain("12:00"); // Break time
    expect(csvContent).toContain("1:00"); // 13:00 displayed as 1:00 PM
    expect(csvContent).toContain("7"); // 実働時間
    expect(csvContent).toContain("8400"); // 給料（7時間 × 1200円）

    // クリーンアップ
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test("複数の記録を含むCSVをダウンロードできる", async ({ page }) => {
    // 3件の記録を保存
    for (let i = 0; i < 3; i++) {
      const day = 10 + i;
      await page.getByLabel("勤務開始日時：").fill(`2025-10-${day}T09:00`);
      await page.getByLabel("勤務終了日時：").fill(`2025-10-${day}T17:00`);
      await page.getByLabel("時給（円）：").fill("1000");
      await page.getByRole("button", { name: "計算して保存" }).click();
      await page.waitForTimeout(300);
    }

    // CSVをダウンロード
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSVで保存" }).click();
    const download = await downloadPromise;

    // ファイルを読み込み
    const filePath = path.join("/tmp", download.suggestedFilename());
    await download.saveAs(filePath);
    const csvContent = fs.readFileSync(filePath, "utf-8");

    // 3件の記録が含まれることを確認
    expect(csvContent).toContain("10/10/2025");
    expect(csvContent).toContain("10/11/2025");
    expect(csvContent).toContain("10/12/2025");

    // 合計行が含まれることを確認
    expect(csvContent).toContain("合計");

    // CSVの行数を確認（ヘッダー + 3件 + 合計 = 5行）
    const lines = csvContent.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(5);

    // クリーンアップ
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test("CSVに合計行が含まれる", async ({ page }) => {
    // 2件の記録を保存
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T17:00");
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    await page.getByLabel("勤務開始日時：").fill("2025-10-11T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-11T17:00");
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // CSVをダウンロード
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSVで保存" }).click();
    const download = await downloadPromise;

    // ファイルを読み込み
    const filePath = path.join("/tmp", download.suggestedFilename());
    await download.saveAs(filePath);
    const csvContent = fs.readFileSync(filePath, "utf-8");

    // 合計行が含まれることを確認
    expect(csvContent).toContain("合計");

    // 合計値が妥当な範囲であることを確認（16時間、16000円）
    const lines = csvContent.split("\n");
    const totalLine = lines.find((line) => line.includes("合計"));
    expect(totalLine).toBeDefined();
    expect(totalLine).toContain("16"); // 合計実働時間
    expect(totalLine).toContain("16000"); // 合計給料

    // クリーンアップ
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test("記録がない状態でもCSVをダウンロードできる", async ({ page }) => {
    // 記録が0件の状態でCSVボタンをクリック
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSVで保存" }).click();
    const download = await downloadPromise;

    // ダウンロードが成功することを確認
    expect(download.suggestedFilename()).toBe("勤務記録.csv");

    // ファイルを読み込み
    const filePath = path.join("/tmp", download.suggestedFilename());
    await download.saveAs(filePath);
    const csvContent = fs.readFileSync(filePath, "utf-8");

    // ヘッダーと合計行のみが含まれることを確認
    expect(csvContent).toContain("勤務日");
    expect(csvContent).toContain("合計");

    // クリーンアップ
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
});
