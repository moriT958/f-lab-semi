import { test, expect } from "@playwright/test";

test.describe("記録の削除", () => {
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

  test("記録を削除できる", async ({ page }) => {
    // ユーザーが2件の勤務記録を保存
    // 1件目
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

    // 2件目
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

    // テーブル内の行が2件あることを確認
    const rowsBefore = page.locator("#recordBody tr");
    await expect(rowsBefore).toHaveCount(2);

    // 1件目の「削除」ボタンをクリック
    const deleteButtons = rowsBefore.getByRole("button", { name: "削除" });
    await deleteButtons.first().click();
    await page.waitForTimeout(500);

    // 記録が1件になることを確認
    const rowsAfter = page.locator("#recordBody tr");
    await expect(rowsAfter).toHaveCount(1);

    // 残っている記録が2件目（10/11の記録）であることを確認
    await expect(rowsAfter).toContainText("10/11/2025");
  });

  test("すべての記録を削除できる", async ({ page }) => {
    // 3件の記録を保存
    for (let i = 0; i < 3; i++) {
      const day = 10 + i;
      await page.getByLabel("勤務開始日時：").fill(`2025-10-${day}T09:00`);
      await page.getByLabel("勤務終了日時：").fill(`2025-10-${day}T17:00`);
      await page.getByLabel("時給（円）：").fill("1000");
      await page.getByRole("button", { name: "計算して保存" }).click();
      await page.waitForTimeout(300);
    }

    // 3件あることを確認
    let rows = page.locator("#recordBody tr");
    await expect(rows).toHaveCount(3);

    // すべての記録を削除
    for (let i = 0; i < 3; i++) {
      const deleteButtons = page
        .locator("#recordBody tr")
        .getByRole("button", { name: "削除" });
      await deleteButtons.first().click();
      await page.waitForTimeout(300);
    }

    // 記録が0件になることを確認
    rows = page.locator("#recordBody tr");
    await expect(rows).toHaveCount(0);
  });

  test("削除後に合計値が更新される", async ({ page }) => {
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

    // 合計欄を確認（2件分）
    const totalsDiv = page.locator("#totals");
    const totalsBefore = await totalsDiv.textContent();

    // 16時間分の合計があることを確認
    expect(totalsBefore).toContain("16"); // May be displayed as "16.00 時間"
    expect(totalsBefore).toContain("16000");

    // 1件削除
    const deleteButtons = page
      .locator("#recordBody tr")
      .getByRole("button", { name: "削除" });
    await deleteButtons.first().click();
    await page.waitForTimeout(500);

    // 合計値が更新されることを確認（1件分）
    const totalsAfter = await totalsDiv.textContent();
    expect(totalsAfter).toContain("8"); // May be displayed as "8.00 時間"
    expect(totalsAfter).toContain("8000");
  });

  test("削除ボタンが各行に表示される", async ({ page }) => {
    // 1件の記録を保存
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T17:00");
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // テーブル行内に削除ボタンが表示されることを確認
    const row = page.locator("#recordBody tr").first();
    const deleteButton = row.getByRole("button", { name: "削除" });
    await expect(deleteButton).toBeVisible();

    // 削除ボタンがクリック可能であることを確認
    await expect(deleteButton).toBeEnabled();
  });

  test("削除後にページをリロードしても記録が消えたままである", async ({
    page,
  }) => {
    // 1件の記録を保存
    await page.getByLabel("勤務開始日時：").fill("2025-10-10T09:00");
    await page.getByLabel("勤務終了日時：").fill("2025-10-10T17:00");
    await page.getByLabel("時給（円）：").fill("1000");
    await page.getByRole("button", { name: "計算して保存" }).click();
    await page.waitForTimeout(500);

    // 記録があることを確認
    let rows = page.locator("#recordBody tr");
    await expect(rows).toHaveCount(1);

    // 記録を削除
    const deleteButton = rows.getByRole("button", { name: "削除" });
    await deleteButton.click();
    await page.waitForTimeout(500);

    // 記録が0件になることを確認
    rows = page.locator("#recordBody tr");
    await expect(rows).toHaveCount(0);

    // ページをリロード
    await page.reload();
    await page.waitForTimeout(500);

    // リロード後も記録が0件であることを確認
    rows = page.locator("#recordBody tr");
    await expect(rows).toHaveCount(0);
  });
});
