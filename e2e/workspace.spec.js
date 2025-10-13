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

test.describe('workspace design theme', () => {
  test('applies the midnight theme tokens to the workspace shell', async ({ page }) => {
    await page.goto('/');

    const workspace = page.locator('.workspace');
    const appBar = page.locator('.workspace__app-bar');
    const scenarioButton = page.locator('.workspace__scenario-button');
    const utilityButton = page.locator('.workspace__utility-button').first();

    await expect(workspace).toHaveAttribute('data-theme', 'midnight');
    await expect(workspace).toHaveCSS('background-color', 'rgb(16, 22, 34)');
    await expect(appBar).toHaveCSS('border-radius', '0px');
    await expect(scenarioButton).toHaveCSS('border-radius', '0px');
    await expect(utilityButton).toHaveCSS('border-radius', '0px');
  });

  test('exposes consistent accent colors for interactive controls', async ({ page }) => {
    await page.goto('/');

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--workspace-accent').trim(),
    );
    const activeMenu = page.locator('.workspace__menu-button').first();

    expect(accent).toBe('#2f74ff');
    await expect(activeMenu).toHaveClass(/workspace__menu-button--active/);
    await expect(activeMenu).toHaveCSS('border-color', 'rgb(47, 116, 255)');
  });
});
