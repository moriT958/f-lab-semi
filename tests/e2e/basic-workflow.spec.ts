import { test, expect } from "@playwright/test";

test.describe("基本的な勤務記録の登録フロー", () => {
  test.beforeEach(async ({ page }) => {
    // ユーザーがページを開く
    await page.goto("/");

    // ページのロードを待つ
    await page.waitForLoadState("networkidle");

    // 既存の記録をすべて削除（クリーンアップ）
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

  test("勤務時間を入力して保存し、記録が表示される", async ({ page }) => {
    // 勤務開始日時を入力
    const startTimeInput = page.getByLabel("勤務開始日時：");
    await startTimeInput.fill("2025-10-10T09:00");

    // 勤務終了日時を入力
    const endTimeInput = page.getByLabel("勤務終了日時：");
    await endTimeInput.fill("2025-10-10T18:00");

    // 休憩開始時刻を入力（最初の休憩フィールド）
    const breakStarts = page.locator(".break-pair .breakStart");
    await breakStarts.first().fill("2025-10-10T12:00");

    // 休憩終了時刻を入力
    const breakEnds = page.locator(".break-pair .breakEnd");
    await breakEnds.first().fill("2025-10-10T13:00");

    // 時給を入力
    const hourlyRateInput = page.getByLabel("時給（円）：");
    await hourlyRateInput.clear();
    await hourlyRateInput.fill("1200");

    // 「計算して保存」ボタンをクリック
    await page.getByRole("button", { name: "計算して保存" }).click();

    // 少し待機（データが保存されて表示されるまで）
    await page.waitForTimeout(500);

    // 画面に勤務記録が表示されることを確認
    await expect(page.getByRole("table")).toContainText("10/10/2025");
    await expect(page.getByRole("table")).toContainText("9:00");
    await expect(page.getByRole("table")).toContainText("6:00"); // 18:00 is displayed as 6:00 PM

    // 実働時間が表示されることを確認（8時間のはず）
    await expect(page.getByRole("table")).toContainText("8 時間");

    // 給料が表示されることを確認（時給1200円 × 8時間 = 9600円）
    await expect(page.getByRole("table")).toContainText("9600 円");
  });

  test("合計欄に値が表示される", async ({ page }) => {
    // 1件目の勤務記録を保存
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

    // 2件目の勤務記録を保存
    await page.getByLabel("勤務開始日時：").fill("2025-10-11T10:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-11T18:00");
    await page
      .locator(".break-pair .breakStart")
      .first()
      .fill("2025-10-11T12:00");
    await page
      .locator(".break-pair .breakEnd")
      .first()
      .fill("2025-10-11T13:00");
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 合計欄が表示されることを確認
    const totalsDiv = page.locator("#totals");
    await expect(totalsDiv).toBeVisible();

    // 合計に「時間」「分」「円」という単位が含まれていることを確認
    await expect(totalsDiv).toContainText("時間");
    await expect(totalsDiv).toContainText("分");
    await expect(totalsDiv).toContainText("円");

    // 合計値が妥当な範囲であることを確認（14時間程度）
    const totalsText = await totalsDiv.textContent();
    expect(totalsText).toMatch(/14\.\d+ 時間/);
  });

  test("記録がない場合でもエラーにならない", async ({ page }) => {
    // ページを開いただけで記録がない状態
    await expect(
      page.getByRole("heading", { name: "勤務時間・給料計算" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "保存された勤務記録" }),
    ).toBeVisible();

    // エラーメッセージが表示されないことを確認
    await expect(page.locator("body")).not.toContainText("error");
    await expect(page.locator("body")).not.toContainText("Error");
  });
});
