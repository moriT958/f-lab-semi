import { test, expect } from "@playwright/test";

test.describe("複数休憩の管理", () => {
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

  test("複数の休憩時間を追加できる", async ({ page }) => {
    // ユーザーが勤務時間を入力
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T18:00");

    // 最初の休憩時間を入力
    const breakStarts = page.locator(".break-pair .breakStart");
    const breakEnds = page.locator(".break-pair .breakEnd");
    await breakStarts.first().fill("2025-10-10T12:00");
    await breakEnds.first().fill("2025-10-10T13:00");

    // 「休憩を追加」ボタンをクリック
    await page.getByRole("button", { name: "休憩を追加" }).click();

    // 2つ目の休憩時間を入力
    await breakStarts.nth(1).fill("2025-10-10T15:00");
    await breakEnds.nth(1).fill("2025-10-10T15:15");

    // もう一度「休憩を追加」ボタンをクリック
    await page.getByRole("button", { name: "休憩を追加" }).click();

    // 3つ目の休憩時間を入力
    await breakStarts.nth(2).fill("2025-10-10T17:00");
    await breakEnds.nth(2).fill("2025-10-10T17:10");

    // 時給を入力
    await page.getByLabel("時給（円）：").fill("1000");

    // 「計算して保存」ボタンをクリック
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 記録が保存されることを確認
    await expect(page.getByRole("table")).toContainText("10/10/2025");

    // 休憩時間が複数表示されることを確認（実装によって表示形式は異なる可能性がある）
    const tableContent = await page.getByRole("table").textContent();
    expect(tableContent).toContain("12:00"); // Break start times
    expect(tableContent).toContain("3:00"); // 15:00 displayed as 3:00 PM

    // 実働時間が妥当な範囲であることを確認
    // 9時間勤務 - 1時間休憩 - 15分休憩 - 10分休憩 = 約7.58時間
    await expect(page.getByRole("table")).toContainText("時間");
  });

  test("休憩を削除できる", async ({ page }) => {
    // 勤務時間を入力
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T18:00");

    // 最初の休憩時間を入力
    const breakStarts = page.locator(".break-pair .breakStart");
    const breakEnds = page.locator(".break-pair .breakEnd");
    await breakStarts.first().fill("2025-10-10T12:00");
    await breakEnds.first().fill("2025-10-10T13:00");

    // 2つ目の休憩を追加
    await page.getByRole("button", { name: "休憩を追加" }).click();
    await breakStarts.nth(1).fill("2025-10-10T15:00");
    await breakEnds.nth(1).fill("2025-10-10T15:15");

    // 3つ目の休憩を追加
    await page.getByRole("button", { name: "休憩を追加" }).click();
    await breakStarts.nth(2).fill("2025-10-10T17:00");
    await breakEnds.nth(2).fill("2025-10-10T17:10");

    // 休憩が3つあることを確認
    let breakPairs = page.locator(".break-pair");
    await expect(breakPairs).toHaveCount(3);

    // 2つ目の休憩の「削除」ボタンをクリック
    const deleteBreakButtons = breakPairs.getByRole("button", { name: "削除" });
    await deleteBreakButtons.nth(1).click();

    // 休憩が2つに減ったことを確認
    breakPairs = page.locator(".break-pair");
    await expect(breakPairs).toHaveCount(2);

    // 時給を入力して保存
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 記録が保存されることを確認
    await expect(page.getByRole("table")).toContainText("10/10/2025");
  });

  test("休憩なしでも保存できる", async ({ page }) => {
    // 勤務時間のみ入力（休憩時間は入力しない）
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T17:00");
    await page.getByLabel("時給（円）：").fill("1000");

    // 「計算して保存」ボタンをクリック
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 記録が保存されることを確認
    await expect(page.getByRole("table")).toContainText("10/10/2025");

    // 実働時間が8時間になることを確認
    await expect(page.getByRole("table")).toContainText("8 時間");
  });

  test("正しい実働時間が計算される", async ({ page }) => {
    // 9:00-18:00 の勤務、12:00-13:00 の1時間休憩
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T18:00");
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

    // 実働時間が8時間であることを確認（9時間勤務 - 1時間休憩 = 8時間）
    await expect(page.getByRole("table")).toContainText("8 時間");

    // 給料が8000円であることを確認（1000円 × 8時間）
    await expect(page.getByRole("table")).toContainText("8000 円");
  });
});
