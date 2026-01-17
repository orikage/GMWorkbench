import { test, expect } from '@playwright/test';

const SAMPLE_BUTTON = 'サンプルPDFを開いてみる';

test.describe('window controls', () => {
    test('maximize button toggles window maximization', async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/');

        // Open sample PDF
        const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
        await sampleButton.click();

        const windowLocator = page.locator('.workspace__window').first();
        await expect(windowLocator).toBeVisible();

        // Find maximize button
        const maximizeButton = windowLocator.locator('.workspace__window-maximize');
        await expect(maximizeButton).toBeVisible();

        // Initial state: not maximized
        await expect(windowLocator).not.toHaveClass(/workspace__window--maximized/);

        // Click maximize
        await maximizeButton.click({ force: true });

        // Expect maximized class
        await expect(windowLocator).toHaveClass(/workspace__window--maximized/);

        // Click restore
        await maximizeButton.click({ force: true });
        await expect(windowLocator).toHaveCount(1);

        // Find duplicate button
        const realDuplicateButton = windowLocator.first().getByRole('button', { name: '複製' });
        await expect(realDuplicateButton).toBeVisible();

        // Click duplicate
        await realDuplicateButton.click({ force: true });

        // Expect 2 windows
        await expect(page.locator('.workspace__window')).toHaveCount(2);
    });
});
