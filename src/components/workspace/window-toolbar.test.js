import { describe, expect, it, vi } from 'vitest';
import { MIN_WINDOW_WIDTH } from './constants.js';
import { createWindowToolbar } from './window-toolbar.js';

const createToolbar = () => {
  const windowElement = document.createElement('div');

  const controller = createWindowToolbar({
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

  return Object.assign(controller, { windowElement });
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

  it('toggles compact mode based on observed window width', () => {
    const originalResizeObserver = global.ResizeObserver;
    const observers = [];

    class MockResizeObserver {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }

      observe(target) {
        this.target = target;
      }

      disconnect() {}
    }

    // @ts-expect-error allow override for tests
    global.ResizeObserver = MockResizeObserver;

    try {
      const toolbar = createToolbar();

      expect(toolbar.element.classList.contains('workspace__window-toolbar--compact')).toBe(false);

      const observer = observers[0];
      expect(observer).toBeDefined();

      observer.callback([
        { target: toolbar.windowElement, contentRect: { width: MIN_WINDOW_WIDTH } },
      ]);

      expect(toolbar.element.classList.contains('workspace__window-toolbar--compact')).toBe(true);

      observer.callback([
        { target: toolbar.windowElement, contentRect: { width: MIN_WINDOW_WIDTH + 160 } },
      ]);

      expect(toolbar.element.classList.contains('workspace__window-toolbar--compact')).toBe(false);
    } finally {
      global.ResizeObserver = originalResizeObserver;
    }
  });
});
