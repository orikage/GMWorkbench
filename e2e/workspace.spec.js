import { test, expect } from '@playwright/test';

const SAMPLE_BUTTON = 'サンプルPDFを開いてみる';

test.describe('workspace onboarding', () => {
  test('loads the workspace and opens the sample PDF window', async ({ page }) => {
    await page.goto('/');

    const instructions =
      'PDFをドラッグ＆ドロップ、または下のボタンから選択してください。';
    await expect(page.getByText(instructions)).toBeVisible();

    const dropZoneButton = page.getByRole('button', { name: 'PDFを開く' });
    await expect(dropZoneButton).toBeVisible();

    const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
    await expect(sampleButton).toBeVisible();

    await sampleButton.focus();
    await sampleButton.press('Enter');

    const windowLocator = page.locator('.workspace__window');
    await expect(windowLocator).toHaveCount(1);
    await expect(windowLocator.first()).toBeVisible();
  });

  test('allows the onboarding guide to be dismissed', async ({ page }) => {
    await page.goto('/');

    const dismissButton = page.getByRole('button', { name: /ガイドを閉じる/ });
    await expect(dismissButton).toBeVisible();

    await dismissButton.focus();
    await dismissButton.press('Enter');

    await expect(page.locator('.workspace__onboarding').first()).toHaveAttribute('hidden', '');
  });

  test('surfaces export options in the maintenance panel', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('書き出しオプション')).toHaveText('書き出しオプション');
    await expect(page.getByLabel('保存済みすべて')).toBeChecked();
    await expect(page.getByLabel('開いているウィンドウのみ')).toHaveAttribute('value', 'open');
    await expect(page.getByLabel('gzip 形式で圧縮する（対応環境のみ）')).toBeChecked();
  });
});

test.describe('workspace design theme', () => {
  test('applies the midnight theme tokens to the workspace shell', async ({ page }) => {
    await page.goto('/');

    const workspace = page.locator('.workspace');
    await expect(workspace).toHaveAttribute('data-theme', 'midnight');
    await expect(workspace).toHaveCSS('background-color', 'rgb(18, 18, 18)');

    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);

      return {
        body: styles.getPropertyValue('--workspace-body').trim(),
        surface: styles.getPropertyValue('--workspace-surface').trim(),
        accent: styles.getPropertyValue('--workspace-accent').trim(),
      };
    });

    expect(tokens.body).toBe('#121212'); // Updated to new dark theme
    expect(tokens.surface).toBe('#1e1e1e');
    expect(tokens.accent).toBe('#e91e63');
  });

  test('exposes consistent accent colors for interactive controls', async ({ page }) => {
    await page.goto('/');

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim(),
    );
    const activeMenu = page.locator('.workspace__menu-button').first();

    expect(accent).toBe('#e91e63');
    await expect(activeMenu).toHaveClass(/workspace__menu-button--active/);
    // Active menu uses background color now, not border color
    await expect(activeMenu).toHaveCSS('background-color', 'rgb(233, 30, 99)');
  });
});
