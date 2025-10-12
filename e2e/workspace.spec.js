import { test, expect } from '@playwright/test';

const SAMPLE_BUTTON = 'サンプルPDFを開いてみる';

test.describe('workspace onboarding', () => {
  test('loads the workspace and opens the sample PDF window', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'GMWorkbench' })).toBeVisible();
    await expect(page.getByText('PDFをドラッグ＆ドロップ')).toBeVisible();

    const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
    await expect(sampleButton).toBeVisible();

    await sampleButton.click();

    const windowLocator = page.locator('.workspace__window');
    await expect(windowLocator).toHaveCount(1);
    await expect(windowLocator.first()).toBeVisible();
  });

  test('allows the onboarding guide to be dismissed', async ({ page }) => {
    await page.goto('/');

    const dismissButton = page.getByRole('button', { name: /ガイドを閉じる/ });
    await expect(dismissButton).toBeVisible();

    await dismissButton.click();

    await expect(page.locator('.workspace__onboarding')).toBeHidden();
  });

  test('surfaces export options in the maintenance panel', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('書き出しオプション')).toBeVisible();
    await expect(page.getByLabel('保存済みすべて')).toBeChecked();
    await expect(page.getByLabel('開いているウィンドウのみ')).toBeVisible();
    await expect(page.getByLabel('gzip 形式で圧縮する（対応環境のみ）')).toBeChecked();
  });
});
