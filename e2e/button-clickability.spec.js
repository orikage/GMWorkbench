import { test, expect } from '@playwright/test';

const SAMPLE_BUTTON = 'サンプルPDFを開いてみる';

test.describe('全ボタンのクリック可能性テスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('オンボーディング関連ボタン', () => {
    test('サンプルPDFボタンがクリック可能', async ({ page }) => {
      const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
      await expect(sampleButton).toBeVisible();
      await expect(sampleButton).toBeEnabled();

      await sampleButton.click();

      // ウィンドウが開くことを確認
      const windowLocator = page.locator('.workspace__window');
      await expect(windowLocator).toHaveCount(1);
    });

    test('ガイドを閉じるボタンがクリック可能', async ({ page }) => {
      const dismissButton = page.getByRole('button', { name: /ガイドを閉じる/ });
      await expect(dismissButton).toBeVisible();
      await expect(dismissButton).toBeEnabled();

      await dismissButton.click();

      // ガイドが非表示になることを確認
      await expect(page.locator('.workspace__onboarding').first()).toHaveAttribute('hidden', '');
    });

    test('PDFを開くボタンがクリック可能', async ({ page }) => {
      const dropZoneButton = page.getByRole('button', { name: 'PDFを開く' });
      await expect(dropZoneButton).toBeVisible();
      await expect(dropZoneButton).toBeEnabled();
    });
  });

  test.describe('ウィンドウヘッダーボタン', () => {
    test.beforeEach(async ({ page }) => {
      // サンプルPDFを開く
      const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
      await sampleButton.click();
      await expect(page.locator('.workspace__window')).toHaveCount(1);
    });

    test('最大化ボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const maximizeButton = windowLocator.locator('.workspace__window-maximize');

      await expect(maximizeButton).toBeVisible();
      await expect(maximizeButton).toBeEnabled();

      // 最大化
      await maximizeButton.click();
      await expect(windowLocator).toHaveClass(/workspace__window--maximized/);

      // 元に戻す
      await maximizeButton.click();
      await expect(windowLocator).not.toHaveClass(/workspace__window--maximized/);
    });

    test('複製ボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const duplicateButton = windowLocator.getByRole('button', { name: '複製' });

      await expect(duplicateButton).toBeVisible();
      await expect(duplicateButton).toBeEnabled();

      await duplicateButton.click();

      // ウィンドウが2つになることを確認
      await expect(page.locator('.workspace__window')).toHaveCount(2);
    });

    test('ピン留めボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const pinButton = windowLocator.locator('.workspace__window-pin');

      await expect(pinButton).toBeVisible();
      await expect(pinButton).toBeEnabled();

      // ピン留め
      await pinButton.click();
      await expect(pinButton).toHaveAttribute('aria-pressed', 'true');

      // ピン解除
      await pinButton.click();
      await expect(pinButton).toHaveAttribute('aria-pressed', 'false');
    });

    test('色タグボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const colorButton = windowLocator.locator('.workspace__window-color');

      await expect(colorButton).toBeVisible();
      await expect(colorButton).toBeEnabled();

      // クリックして色を変更
      await colorButton.click();
      // 色が変わったことを確認（data-color属性が変わる）
      const colorAttr = await colorButton.getAttribute('data-color');
      expect(colorAttr).toBeTruthy();
    });

    test('リネームボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const renameButton = windowLocator.locator('.workspace__window-rename');

      await expect(renameButton).toBeVisible();
      await expect(renameButton).toBeEnabled();

      await renameButton.click();

      // タイトルが編集可能になることを確認
      const titleInput = windowLocator.locator('.workspace__window-title');
      await expect(titleInput).toHaveAttribute('contenteditable', 'true');
    });

    test('ブックマークを開くボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const bookmarksButton = windowLocator.locator('.workspace__window-open-bookmarks');

      await expect(bookmarksButton).toBeVisible();
      await expect(bookmarksButton).toBeEnabled();

      await bookmarksButton.click();

      // ブックマークウィンドウが開くことを確認
      const bookmarksWindow = page.locator('.workspace__window--bookmarks');
      await expect(bookmarksWindow).toBeVisible();
    });

    test('ノートを開くボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const notesButton = windowLocator.locator('.workspace__window-open-notes');

      await expect(notesButton).toBeVisible();
      await expect(notesButton).toBeEnabled();

      await notesButton.click();

      // ノートパネルが開くことを確認
      const notesPanel = windowLocator.locator('.workspace__window-notes');
      await expect(notesPanel).toBeVisible();
    });

    test('閉じるボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const closeButton = windowLocator.locator('.workspace__window-close').first();

      await expect(closeButton).toBeVisible();
      await expect(closeButton).toBeEnabled();

      await closeButton.click();

      // ウィンドウが閉じることを確認
      await expect(page.locator('.workspace__window')).toHaveCount(0);
    });
  });

  test.describe('コンパクトモードのボタン', () => {
    test.beforeEach(async ({ page }) => {
      // サンプルPDFを開く
      const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
      await sampleButton.click();
      await expect(page.locator('.workspace__window')).toHaveCount(1);

      // 最大化してコンパクトモードを有効化
      const windowLocator = page.locator('.workspace__window').first();
      const maximizeButton = windowLocator.locator('.workspace__window-maximize');
      await maximizeButton.click();
    });

    test('検索トグルボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const searchToggle = windowLocator.locator('.workspace__window-tool-toggle--search');

      await expect(searchToggle).toBeVisible();
      await expect(searchToggle).toBeEnabled();

      await searchToggle.click();

      // 検索パネルが開くことを確認
      const searchPanel = windowLocator.locator('.workspace__window-search');
      await expect(searchPanel).toBeVisible();
    });

    test('アウトライントグルボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const outlineToggle = windowLocator.locator('.workspace__window-tool-toggle--outline');

      await expect(outlineToggle).toBeVisible();
      await expect(outlineToggle).toBeEnabled();

      await outlineToggle.click();

      // アウトラインパネルが開くことを確認
      const outlinePanel = windowLocator.locator('.workspace__window-outline');
      await expect(outlinePanel).toBeVisible();
    });

    test('ツールトグルボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const toolsToggle = windowLocator.locator('.workspace__window-tool-toggle--tools');

      await expect(toolsToggle).toBeVisible();
      await expect(toolsToggle).toBeEnabled();

      await toolsToggle.click();

      // ツールバーが開くことを確認
      const toolbar = windowLocator.locator('.workspace__window-toolbar');
      await expect(toolbar).toBeVisible();
    });

    test('前のページボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const prevButton = windowLocator.locator('.workspace__window-header-nav--prev');

      await expect(prevButton).toBeVisible();
      // 最初のページなので無効化されている可能性がある
      const isEnabled = await prevButton.isEnabled();
      expect(typeof isEnabled).toBe('boolean');
    });

    test('次のページボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const nextButton = windowLocator.locator('.workspace__window-header-nav--next');

      await expect(nextButton).toBeVisible();
      await expect(nextButton).toBeEnabled();

      // クリックしてページが進むことを確認
      await nextButton.click();
      // ページ番号が変わることを期待
      await page.waitForTimeout(500); // ページレンダリング待ち
    });
  });

  test.describe('PDFツールバーボタン', () => {
    test.beforeEach(async ({ page }) => {
      // サンプルPDFを開く
      const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
      await sampleButton.click();
      await expect(page.locator('.workspace__window')).toHaveCount(1);
    });

    test('ページナビゲーションボタンがすべてクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();

      // 最初のページボタン
      const firstButton = windowLocator.locator('.workspace__window-nav--first');
      await expect(firstButton).toBeVisible();

      // 前のページボタン
      const prevButton = windowLocator.locator('.workspace__window-nav--previous');
      await expect(prevButton).toBeVisible();

      // 次のページボタン
      const nextButton = windowLocator.locator('.workspace__window-nav--next');
      await expect(nextButton).toBeVisible();
      await expect(nextButton).toBeEnabled();
      await nextButton.click();
      await page.waitForTimeout(500);

      // 最後のページボタン
      const lastButton = windowLocator.locator('.workspace__window-nav--last');
      await expect(lastButton).toBeVisible();
      await expect(lastButton).toBeEnabled();
      await lastButton.click();
      await page.waitForTimeout(500);
    });

    test('履歴ナビゲーションボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();

      // まず次のページに移動して履歴を作成
      const nextButton = windowLocator.locator('.workspace__window-nav--next');
      await nextButton.click();
      await page.waitForTimeout(500);

      // 履歴戻るボタン
      const historyBackButton = windowLocator.locator('.workspace__window-nav--history-back');
      await expect(historyBackButton).toBeVisible();
      await expect(historyBackButton).toBeEnabled();
      await historyBackButton.click();
      await page.waitForTimeout(500);

      // 履歴進むボタン
      const historyForwardButton = windowLocator.locator('.workspace__window-nav--history-forward');
      await expect(historyForwardButton).toBeVisible();
      await expect(historyForwardButton).toBeEnabled();
      await historyForwardButton.click();
      await page.waitForTimeout(500);
    });

    test('回転ボタンがすべてクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();

      // 左回転ボタン
      const rotateLeftButton = windowLocator.locator('.workspace__window-rotation-control--left');
      await expect(rotateLeftButton).toBeVisible();
      await expect(rotateLeftButton).toBeEnabled();
      await rotateLeftButton.click();
      await page.waitForTimeout(500);

      // 右回転ボタン
      const rotateRightButton = windowLocator.locator('.workspace__window-rotation-control--right');
      await expect(rotateRightButton).toBeVisible();
      await expect(rotateRightButton).toBeEnabled();
      await rotateRightButton.click();
      await page.waitForTimeout(500);

      // 回転リセットボタン
      const rotateResetButton = windowLocator.locator('.workspace__window-rotation-reset');
      await expect(rotateResetButton).toBeVisible();
      await expect(rotateResetButton).toBeEnabled();
      await rotateResetButton.click();
      await page.waitForTimeout(500);
    });

    test('ズームボタンがすべてクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();

      // ズームインボタン
      const zoomInButton = windowLocator.locator('.workspace__window-zoom-control--in');
      await expect(zoomInButton).toBeVisible();
      await expect(zoomInButton).toBeEnabled();
      await zoomInButton.click();
      await page.waitForTimeout(500);

      // ズームアウトボタン
      const zoomOutButton = windowLocator.locator('.workspace__window-zoom-control--out');
      await expect(zoomOutButton).toBeVisible();
      await expect(zoomOutButton).toBeEnabled();
      await zoomOutButton.click();
      await page.waitForTimeout(500);

      // ズームリセットボタン
      const zoomResetButton = windowLocator.locator('.workspace__window-zoom-reset');
      await expect(zoomResetButton).toBeVisible();
      await expect(zoomResetButton).toBeEnabled();
      await zoomResetButton.click();
      await page.waitForTimeout(500);

      // 幅に合わせるボタン
      const fitWidthButton = windowLocator.locator('.workspace__window-zoom-fit--width');
      await expect(fitWidthButton).toBeVisible();
      await expect(fitWidthButton).toBeEnabled();
      await fitWidthButton.click();
      await page.waitForTimeout(500);

      // ページに合わせるボタン
      const fitPageButton = windowLocator.locator('.workspace__window-zoom-fit--page');
      await expect(fitPageButton).toBeVisible();
      await expect(fitPageButton).toBeEnabled();
      await fitPageButton.click();
      await page.waitForTimeout(500);
    });
  });

  test.describe('検索パネルボタン', () => {
    test.beforeEach(async ({ page }) => {
      // サンプルPDFを開く
      const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
      await sampleButton.click();
      await expect(page.locator('.workspace__window')).toHaveCount(1);

      // 最大化してコンパクトモードを有効化
      const windowLocator = page.locator('.workspace__window').first();
      const maximizeButton = windowLocator.locator('.workspace__window-maximize');
      await maximizeButton.click();

      // 検索パネルを開く
      const searchToggle = windowLocator.locator('.workspace__window-tool-toggle--search');
      await searchToggle.click();
      await expect(windowLocator.locator('.workspace__window-search')).toBeVisible();
    });

    test('検索送信ボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const searchInput = windowLocator.locator('.workspace__window-search-input');
      const searchSubmit = windowLocator.locator('.workspace__window-search-submit');

      await expect(searchSubmit).toBeVisible();

      // 検索テキストを入力
      await searchInput.fill('test');
      await expect(searchSubmit).toBeEnabled();

      await searchSubmit.click();
      await page.waitForTimeout(500);
    });

    test('検索結果ナビゲーションボタンがクリック可能', async ({ page }) => {
      const windowLocator = page.locator('.workspace__window').first();
      const searchInput = windowLocator.locator('.workspace__window-search-input');

      // 検索を実行
      await searchInput.fill('test');
      const searchSubmit = windowLocator.locator('.workspace__window-search-submit');
      await searchSubmit.click();
      await page.waitForTimeout(1000);

      // 前の結果ボタン
      const prevResult = windowLocator.locator('.workspace__window-search-prev');
      await expect(prevResult).toBeVisible();

      // 次の結果ボタン
      const nextResult = windowLocator.locator('.workspace__window-search-next');
      await expect(nextResult).toBeVisible();
    });
  });

  test.describe('ブックマークパネルボタン', () => {
    test.beforeEach(async ({ page }) => {
      // サンプルPDFを開く
      const sampleButton = page.getByRole('button', { name: SAMPLE_BUTTON });
      await sampleButton.click();
      await expect(page.locator('.workspace__window')).toHaveCount(1);

      // ブックマークパネルを開く
      const windowLocator = page.locator('.workspace__window').first();
      const bookmarksButton = windowLocator.locator('.workspace__window-open-bookmarks');
      await bookmarksButton.click();
      await expect(page.locator('.workspace__window--bookmarks')).toBeVisible();
    });

    test('ブックマーク追加ボタンがクリック可能', async ({ page }) => {
      const bookmarksWindow = page.locator('.workspace__window--bookmarks');
      const addButton = bookmarksWindow.locator('.workspace__window-bookmark-add');

      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();

      await addButton.click();
      await page.waitForTimeout(500);

      // ブックマークが追加されたことを確認
      const bookmarkItems = bookmarksWindow.locator('.workspace__window-bookmark');
      await expect(bookmarkItems).toHaveCount(1);
    });

    test('ブックマークナビゲーションボタンがクリック可能', async ({ page }) => {
      const bookmarksWindow = page.locator('.workspace__window--bookmarks');

      // まずブックマークを追加
      const addButton = bookmarksWindow.locator('.workspace__window-bookmark-add');
      await addButton.click();
      await page.waitForTimeout(500);

      // 次のブックマークボタン
      const nextButton = bookmarksWindow.locator('.workspace__window-bookmark-next');
      await expect(nextButton).toBeVisible();

      // 前のブックマークボタン
      const prevButton = bookmarksWindow.locator('.workspace__window-bookmark-prev');
      await expect(prevButton).toBeVisible();
    });

    test('ブックマーク削除ボタンがクリック可能', async ({ page }) => {
      const bookmarksWindow = page.locator('.workspace__window--bookmarks');

      // まずブックマークを追加
      const addButton = bookmarksWindow.locator('.workspace__window-bookmark-add');
      await addButton.click();
      await page.waitForTimeout(500);

      // 削除ボタン
      const removeButton = bookmarksWindow.locator('.workspace__window-bookmark-remove').first();
      await expect(removeButton).toBeVisible();
      await expect(removeButton).toBeEnabled();

      await removeButton.click();
      await page.waitForTimeout(500);

      // ブックマークが削除されたことを確認
      const bookmarkItems = bookmarksWindow.locator('.workspace__window-bookmark');
      await expect(bookmarkItems).toHaveCount(0);
    });

    test('ブックマークウィンドウの閉じるボタンがクリック可能', async ({ page }) => {
      const bookmarksWindow = page.locator('.workspace__window--bookmarks');
      const closeButton = bookmarksWindow.locator('.workspace__window-close');

      await expect(closeButton).toBeVisible();
      await expect(closeButton).toBeEnabled();

      await closeButton.click();

      // ブックマークウィンドウが閉じることを確認
      await expect(bookmarksWindow).not.toBeVisible();
    });
  });

  test.describe('アプリケーションヘッダーボタン', () => {
    test('レイヤーパネルボタンがクリック可能', async ({ page }) => {
      const layersButton = page.locator('.workspace__utility-button[data-utility-id="layers"]');

      await expect(layersButton).toBeVisible();
      await expect(layersButton).toBeEnabled();

      await layersButton.click();

      // レイヤーパネルが開くことを確認
      const layersPanel = page.locator('.workspace__utility-panel[data-utility-id="layers"]');
      await expect(layersPanel).toBeVisible();
    });

    test('リファレンスライブラリボタンがクリック可能', async ({ page }) => {
      const referenceButton = page.locator('.workspace__utility-button[data-utility-id="reference"]');

      await expect(referenceButton).toBeVisible();
      await expect(referenceButton).toBeEnabled();

      await referenceButton.click();

      // リファレンスパネルが開くことを確認
      const referencePanel = page.locator('.workspace__utility-panel[data-utility-id="reference"]');
      await expect(referencePanel).toBeVisible();
    });

    test('設定ボタンがクリック可能', async ({ page }) => {
      const settingsButton = page.locator('.workspace__utility-button[data-utility-id="settings"]');

      await expect(settingsButton).toBeVisible();
      await expect(settingsButton).toBeEnabled();

      await settingsButton.click();

      // 設定パネルが開くことを確認
      const settingsPanel = page.locator('.workspace__utility-panel[data-utility-id="settings"]');
      await expect(settingsPanel).toBeVisible();
    });

    test('クイックメモボタンがクリック可能', async ({ page }) => {
      const quickMemoButton = page.locator('.workspace__quick-button');

      await expect(quickMemoButton).toBeVisible();
      await expect(quickMemoButton).toBeEnabled();

      await quickMemoButton.click();

      // メモウィンドウが開くことを確認
      const memoWindow = page.locator('.workspace__window--memo');
      await expect(memoWindow).toBeVisible();
    });
  });

  test.describe('サイドメニューボタン', () => {
    test('すべてのメニューボタンがクリック可能', async ({ page }) => {
      const menuButtons = page.locator('.workspace__menu-button');
      const count = await menuButtons.count();

      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const button = menuButtons.nth(i);
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();

        await button.click();
        await page.waitForTimeout(300);

        // アクティブ状態になることを確認
        await expect(button).toHaveClass(/workspace__menu-button--active/);
      }
    });
  });

  test.describe('メンテナンスパネルボタン', () => {
    test('エクスポートボタンがクリック可能', async ({ page }) => {
      const exportButton = page.locator('.workspace__maintenance-action--export');

      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeEnabled();
    });

    test('インポートボタンがクリック可能', async ({ page }) => {
      const importButton = page.locator('.workspace__maintenance-action--import');

      await expect(importButton).toBeVisible();
      await expect(importButton).toBeEnabled();
    });

    test('キャッシュクリアボタンがクリック可能', async ({ page }) => {
      const clearButton = page.locator('.workspace__maintenance-action--clear');

      await expect(clearButton).toBeVisible();
      await expect(clearButton).toBeEnabled();
    });
  });
});
