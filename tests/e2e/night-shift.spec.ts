import { test, expect } from "@playwright/test";

test.describe("深夜勤務のシナリオ", () => {
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

  test("深夜勤務時間が記録され、深夜手当が反映される", async ({ page }) => {
    // ユーザーが22:00開始、翌5:00終了の勤務を入力
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T22:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-11T05:00");

    // 休憩なし
    // 時給を入力
    await page.getByLabel("時給（円）：").fill("1000");

    // 「計算して保存」ボタンをクリック
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 記録が保存されることを確認
    await expect(page.getByRole("table")).toContainText("10/10/2025");

    // 深夜勤務時間が表示されることを確認
    // 22:00-翌5:00は全て深夜時間帯なので、420分（7時間）が深夜分のはず
    await expect(page.getByRole("table")).toContainText("420 分");

    // 実働時間が7時間であることを確認
    await expect(page.getByRole("table")).toContainText("7 時間");

    // 給料が深夜手当込みで計算されていることを確認
    // 7時間 × 1000円 × 1.25 = 8750円
    await expect(page.getByRole("table")).toContainText("8750 円");
  });

  test("深夜時間帯を含む勤務で正しく計算される", async ({ page }) => {
    // 20:00開始、翌1:00終了の勤務（深夜時間帯は22:00-翌1:00の3時間）
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T20:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-11T01:00");
    await page.getByLabel("時給（円）：").fill("1000");

    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 実働時間が5時間であることを確認
    await expect(page.getByRole("table")).toContainText("5 時間");

    // 深夜勤務時間が表示されることを確認（180分 = 3時間）
    await expect(page.getByRole("table")).toContainText("180 分");

    // 給料が正しく計算されることを確認
    // 通常2時間(20:00-22:00): 2000円
    // 深夜3時間(22:00-01:00): 3750円
    // 合計: 5750円
    await expect(page.getByRole("table")).toContainText("5750 円");
  });

  test("深夜時間帯に休憩がある場合", async ({ page }) => {
    // 22:00開始、翌6:00終了（8時間）
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T22:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-11T06:00");

    // 深夜時間帯に1時間の休憩（0:00-1:00）
    await page
      .locator(".break-pair .breakStart")
      .first()
      .fill("2025-10-11T00:00");
    await page
      .locator(".break-pair .breakEnd")
      .first()
      .fill("2025-10-11T01:00");

    await page.getByLabel("時給（円）：").fill("1000");

    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 記録が保存されることを確認
    await expect(page.getByRole("table")).toContainText("10/10/2025");

    // 実働時間が7時間であることを確認（8時間 - 1時間休憩）
    await expect(page.getByRole("table")).toContainText("7 時間");

    // 深夜勤務時間が表示されることを確認
    // 22:00-5:00の7時間のうち、0:00-1:00の1時間を除く = 6時間 = 360分
    await expect(page.getByRole("table")).toContainText("360 分");

    // 給料が表示されることを確認
    // 通常1時間(5:00-6:00): 1000円
    // 深夜6時間: 7500円
    // 合計: 8500円
    await expect(page.getByRole("table")).toContainText("8500 円");
  });

  test("通常勤務（深夜なし）との比較", async ({ page }) => {
    // 通常勤務（9:00-17:00、8時間）を保存
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T17:00");
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 深夜勤務時間が0分であることを確認
    const rows = page.locator("#recordBody tr");
    const firstRowText = await rows.first().textContent();
    expect(firstRowText).toContain("0 分");

    // 給料が8000円（深夜手当なし）であることを確認
    expect(firstRowText).toContain("8000 円");
  });

  test("早朝時間帯（0:00-5:00）も深夜勤務として扱われる", async ({ page }) => {
    // 3:00開始、9:00終了の勤務（深夜時間帯は3:00-5:00の2時間）
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T03:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T09:00");
    await page.getByLabel("時給（円）：").fill("1000");

    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 実働時間が6時間であることを確認
    await expect(page.getByRole("table")).toContainText("6 時間");

    // 深夜勤務時間が120分（2時間）であることを確認
    await expect(page.getByRole("table")).toContainText("120 分");

    // 給料が正しく計算されることを確認
    // 深夜2時間: 2500円
    // 通常4時間: 4000円
    // 合計: 6500円
    await expect(page.getByRole("table")).toContainText("6500 円");
  });
});
