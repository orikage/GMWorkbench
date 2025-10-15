import { describe, expect, it, vi } from 'vitest';
import { createWindowToolbar } from './window-toolbar.js';

const createToolbar = () => {
  const windowElement = document.createElement('div');

  return createWindowToolbar({
    windowElement,
    bringToFront: vi.fn(),
    sanitizePageValue: (value) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    },
    commitPageChange: vi.fn(),
    stepPage: vi.fn(),
    goToFirstPage: vi.fn(),
    goToLastPage: vi.fn(),
    navigateHistory: vi.fn(),
    stepRotation: vi.fn(),
    resetRotation: vi.fn(),
    stepZoom: vi.fn(),
    resetZoom: vi.fn(),
    computeFitZoom: vi.fn(),
    commitZoomChange: vi.fn(),
    onSyncRequest: vi.fn(),
  });
};

describe('createWindowToolbar', () => {
  it('sets title attributes for controls after updating labels', () => {
    const toolbar = createToolbar();
    toolbar.updateLabels('遭遇表');

    const firstPageButton = toolbar.element.querySelector('.workspace__window-nav--first');
    const historyBackButton = toolbar.element.querySelector(
      '.workspace__window-nav--history-back',
    );
    const zoomResetButton = toolbar.element.querySelector('.workspace__window-zoom-reset');
    const rotateRightButton = toolbar.element.querySelector(
      '.workspace__window-rotation-control--right',
    );
    const slider = toolbar.element.querySelector('.workspace__window-page-slider');

    expect(firstPageButton).toBeInstanceOf(HTMLButtonElement);
    expect(firstPageButton?.getAttribute('title')).toBe('遭遇表 の最初のページへ移動');
    expect(historyBackButton).toBeInstanceOf(HTMLButtonElement);
    expect(historyBackButton?.getAttribute('title')).toBe('遭遇表 のページ履歴を戻る');
    expect(zoomResetButton).toBeInstanceOf(HTMLButtonElement);
    expect(zoomResetButton?.getAttribute('title')).toBe('遭遇表 の表示倍率をリセット');
    expect(rotateRightButton).toBeInstanceOf(HTMLButtonElement);
    expect(rotateRightButton?.getAttribute('title')).toBe('遭遇表 を時計回りに回転');
    expect(slider).toBeInstanceOf(HTMLInputElement);
    expect(slider?.getAttribute('title')).toBe('ページスライダー');
  });

  it('removes hover titles when labels are cleared', () => {
    const toolbar = createToolbar();
    toolbar.updateLabels('遭遇表');
    toolbar.updateLabels('');

    const firstPageButton = toolbar.element.querySelector('.workspace__window-nav--first');
    const zoomFitButton = toolbar.element.querySelector('.workspace__window-zoom-fit--page');

    expect(firstPageButton).toBeInstanceOf(HTMLButtonElement);
    expect(firstPageButton?.hasAttribute('title')).toBe(false);
    expect(zoomFitButton).toBeInstanceOf(HTMLButtonElement);
    expect(zoomFitButton?.hasAttribute('title')).toBe(false);
  });
});
