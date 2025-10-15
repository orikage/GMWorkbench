import {
  DEFAULT_WINDOW_ROTATION,
  DEFAULT_WINDOW_ZOOM,
  MAX_WINDOW_ZOOM,
  MIN_WINDOW_ZOOM,
  WINDOW_ZOOM_STEP,
} from './constants.js';
import { copyAccessibleLabelToTitle } from './utils.js';

const approxEqual = (a, b, tolerance = 0.01) => Math.abs(a - b) < tolerance;

export function createWindowToolbar({
  windowElement,
  bringToFront,
  sanitizePageValue,
  commitPageChange,
  stepPage,
  goToFirstPage,
  goToLastPage,
  navigateHistory,
  stepRotation,
  resetRotation,
  stepZoom,
  resetZoom,
  computeFitZoom,
  commitZoomChange,
  onSyncRequest,
}) {
  const focusWindow = (options) => {
    if (typeof bringToFront === 'function') {
      bringToFront(options);
    }
  };

  const toolbar = document.createElement('div');
  toolbar.className = 'workspace__window-toolbar';

  const pageForm = document.createElement('form');
  pageForm.className = 'workspace__window-page';

  const pageInputId = `workspace-window-page-${Math.random().toString(36).slice(2, 9)}`;

  const pageLabel = document.createElement('label');
  pageLabel.className = 'workspace__window-page-label';
  pageLabel.setAttribute('for', pageInputId);
  pageLabel.textContent = 'ページ';

  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.inputMode = 'numeric';
  pageInput.pattern = '[0-9]*';
  pageInput.min = '1';
  pageInput.id = pageInputId;
  pageInput.className = 'workspace__window-page-input';

  const requestPageChange = () => {
    const sanitized = sanitizePageValue(pageInput.value);

    if (sanitized === null) {
      onSyncRequest?.();
      return;
    }

    commitPageChange(sanitized);
  };

  pageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    requestPageChange();
  });

  pageInput.addEventListener('change', requestPageChange);
  pageInput.addEventListener('blur', () => {
    onSyncRequest?.();
  });
  pageInput.addEventListener('focus', () => {
    focusWindow();
    pageInput.select();
  });

  const firstPageButton = document.createElement('button');
  firstPageButton.type = 'button';
  firstPageButton.className = 'workspace__window-nav workspace__window-nav--first';
  firstPageButton.textContent = '⏮';
  firstPageButton.addEventListener('click', () => {
    goToFirstPage();
  });

  const historyBackButton = document.createElement('button');
  historyBackButton.type = 'button';
  historyBackButton.className = 'workspace__window-nav workspace__window-nav--history-back';
  historyBackButton.textContent = '戻';
  historyBackButton.addEventListener('click', () => {
    navigateHistory(-1);
  });

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'workspace__window-nav workspace__window-nav--previous';
  prevButton.textContent = '−';
  prevButton.addEventListener('click', () => {
    stepPage(-1);
  });

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'workspace__window-nav workspace__window-nav--next';
  nextButton.textContent = '+';
  nextButton.addEventListener('click', () => {
    stepPage(1);
  });

  const historyForwardButton = document.createElement('button');
  historyForwardButton.type = 'button';
  historyForwardButton.className = 'workspace__window-nav workspace__window-nav--history-forward';
  historyForwardButton.textContent = '進';
  historyForwardButton.addEventListener('click', () => {
    navigateHistory(1);
  });

  const lastPageButton = document.createElement('button');
  lastPageButton.type = 'button';
  lastPageButton.className = 'workspace__window-nav workspace__window-nav--last';
  lastPageButton.textContent = '⏭';
  lastPageButton.addEventListener('click', () => {
    goToLastPage();
  });

  pageForm.append(pageLabel, pageInput);

  const pageSlider = document.createElement('input');
  pageSlider.type = 'range';
  pageSlider.className = 'workspace__window-page-slider';
  pageSlider.min = '1';
  pageSlider.step = '1';
  pageSlider.value = '1';
  pageSlider.setAttribute('aria-label', 'ページスライダー');
  copyAccessibleLabelToTitle(pageSlider, 'ページスライダー');
  pageSlider.addEventListener('focus', () => {
    focusWindow();
  });
  pageSlider.addEventListener('input', () => {
    const parsed = Number.parseInt(pageSlider.value, 10);

    if (!Number.isFinite(parsed)) {
      onSyncRequest?.();
      return;
    }

    commitPageChange(parsed);
  });

  const rotationGroup = document.createElement('div');
  rotationGroup.className = 'workspace__window-rotation';

  const rotateLeftButton = document.createElement('button');
  rotateLeftButton.type = 'button';
  rotateLeftButton.className =
    'workspace__window-rotation-control workspace__window-rotation-control--left';
  rotateLeftButton.textContent = '↺';
  rotateLeftButton.addEventListener('click', () => {
    stepRotation(-1);
  });

  const rotationDisplay = document.createElement('span');
  rotationDisplay.className = 'workspace__window-rotation-display';
  rotationDisplay.setAttribute('aria-live', 'polite');

  const rotateRightButton = document.createElement('button');
  rotateRightButton.type = 'button';
  rotateRightButton.className =
    'workspace__window-rotation-control workspace__window-rotation-control--right';
  rotateRightButton.textContent = '↻';
  rotateRightButton.addEventListener('click', () => {
    stepRotation(1);
  });

  const rotateResetButton = document.createElement('button');
  rotateResetButton.type = 'button';
  rotateResetButton.className = 'workspace__window-rotation-reset';
  rotateResetButton.textContent = '0°';
  rotateResetButton.addEventListener('click', () => {
    resetRotation();
  });

  rotationGroup.append(rotateLeftButton, rotationDisplay, rotateRightButton, rotateResetButton);

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'workspace__window-zoom';

  const zoomOutButton = document.createElement('button');
  zoomOutButton.type = 'button';
  zoomOutButton.className = 'workspace__window-zoom-control workspace__window-zoom-control--out';
  zoomOutButton.textContent = '縮小';
  zoomOutButton.addEventListener('click', () => {
    stepZoom(-WINDOW_ZOOM_STEP);
  });

  const zoomDisplay = document.createElement('span');
  zoomDisplay.className = 'workspace__window-zoom-display';
  zoomDisplay.setAttribute('aria-live', 'polite');

  const zoomInButton = document.createElement('button');
  zoomInButton.type = 'button';
  zoomInButton.className = 'workspace__window-zoom-control workspace__window-zoom-control--in';
  zoomInButton.textContent = '拡大';
  zoomInButton.addEventListener('click', () => {
    stepZoom(WINDOW_ZOOM_STEP);
  });

  const zoomResetButton = document.createElement('button');
  zoomResetButton.type = 'button';
  zoomResetButton.className = 'workspace__window-zoom-reset';
  zoomResetButton.textContent = '100%';
  zoomResetButton.addEventListener('click', () => {
    resetZoom();
  });

  const zoomFitWidthButton = document.createElement('button');
  zoomFitWidthButton.type = 'button';
  zoomFitWidthButton.className = 'workspace__window-zoom-fit workspace__window-zoom-fit--width';
  zoomFitWidthButton.textContent = '幅合わせ';
  zoomFitWidthButton.setAttribute('aria-pressed', 'false');
  zoomFitWidthButton.addEventListener('click', () => {
    const target = computeFitZoom('width');

    if (Number.isFinite(target)) {
      commitZoomChange(target, { mode: 'fit-width' });
    }
  });

  const zoomFitPageButton = document.createElement('button');
  zoomFitPageButton.type = 'button';
  zoomFitPageButton.className = 'workspace__window-zoom-fit workspace__window-zoom-fit--page';
  zoomFitPageButton.textContent = '全体表示';
  zoomFitPageButton.setAttribute('aria-pressed', 'false');
  zoomFitPageButton.addEventListener('click', () => {
    const target = computeFitZoom('page');

    if (Number.isFinite(target)) {
      commitZoomChange(target, { mode: 'fit-page' });
    }
  });

  zoomGroup.append(
    zoomOutButton,
    zoomDisplay,
    zoomInButton,
    zoomResetButton,
    zoomFitWidthButton,
    zoomFitPageButton,
  );

  const adjustmentsGroup = document.createElement('div');
  adjustmentsGroup.className = 'workspace__window-adjustments';
  adjustmentsGroup.append(rotationGroup, zoomGroup);

  toolbar.append(
    firstPageButton,
    historyBackButton,
    prevButton,
    pageForm,
    pageSlider,
    nextButton,
    historyForwardButton,
    lastPageButton,
    adjustmentsGroup,
  );

  const syncNavigation = ({
    currentPage,
    totalPages,
    canHistoryBack,
    canHistoryForward,
    historyIndex,
    historyLength,
  }) => {
    pageInput.value = String(currentPage);

    if (Number.isFinite(totalPages)) {
      const normalizedTotal = Math.max(1, Math.floor(totalPages));
      pageInput.max = String(normalizedTotal);
      pageSlider.max = String(normalizedTotal);
      pageSlider.disabled = normalizedTotal <= 1;
      nextButton.disabled = currentPage >= normalizedTotal;
      lastPageButton.disabled = currentPage >= normalizedTotal;
    } else {
      pageInput.removeAttribute('max');
      pageSlider.removeAttribute('max');
      pageSlider.disabled = true;
      nextButton.disabled = false;
      lastPageButton.disabled = true;
    }

    firstPageButton.disabled = currentPage <= 1;
    prevButton.disabled = currentPage <= 1;
    pageSlider.value = String(currentPage);

    historyBackButton.disabled = !canHistoryBack;
    historyForwardButton.disabled = !canHistoryForward;

    windowElement.dataset.pageHistoryIndex = String(historyIndex);
    windowElement.dataset.pageHistoryLength = String(historyLength);
  };

  const syncZoom = ({ currentZoom, zoomFitMode, fitWidthZoom, fitPageZoom }) => {
    const percentage = Math.round(currentZoom * 100);
    zoomDisplay.textContent = `${percentage}%`;

    zoomOutButton.disabled = currentZoom <= MIN_WINDOW_ZOOM + 0.0001;
    zoomInButton.disabled = currentZoom >= MAX_WINDOW_ZOOM - 0.0001;
    zoomResetButton.disabled = Math.abs(currentZoom - DEFAULT_WINDOW_ZOOM) < 0.001;

    if (Number.isFinite(fitWidthZoom)) {
      windowElement.dataset.zoomFitWidth = String(fitWidthZoom);
      const matches = approxEqual(currentZoom, fitWidthZoom);
      zoomFitWidthButton.disabled = matches;
      zoomFitWidthButton.setAttribute(
        'aria-pressed',
        zoomFitMode === 'fit-width' && matches ? 'true' : 'false',
      );
    } else {
      delete windowElement.dataset.zoomFitWidth;
      zoomFitWidthButton.disabled = true;
      zoomFitWidthButton.setAttribute('aria-pressed', 'false');
    }

    if (Number.isFinite(fitPageZoom)) {
      windowElement.dataset.zoomFitPage = String(fitPageZoom);
      const matches = approxEqual(currentZoom, fitPageZoom);
      zoomFitPageButton.disabled = matches;
      zoomFitPageButton.setAttribute(
        'aria-pressed',
        zoomFitMode === 'fit-page' && matches ? 'true' : 'false',
      );
    } else {
      delete windowElement.dataset.zoomFitPage;
      zoomFitPageButton.disabled = true;
      zoomFitPageButton.setAttribute('aria-pressed', 'false');
    }
  };

  const syncRotation = (currentRotation) => {
    rotationDisplay.textContent = `${currentRotation}°`;
    rotateResetButton.disabled = currentRotation === DEFAULT_WINDOW_ROTATION;
    windowElement.dataset.rotation = String(currentRotation);
  };

  const setControlLabel = (element, label) => {
    if (!(element instanceof Element)) {
      return;
    }

    if (typeof label === 'string' && label.length > 0) {
      element.setAttribute('aria-label', label);
    } else {
      element.removeAttribute('aria-label');
    }

    copyAccessibleLabelToTitle(element, label);
  };

  const updateLabels = (windowTitle) => {
    if (windowTitle) {
      setControlLabel(pageForm, `${windowTitle} の表示ページを設定`);
      setControlLabel(pageInput, `${windowTitle} の表示ページ番号`);
      setControlLabel(historyBackButton, `${windowTitle} のページ履歴を戻る`);
      setControlLabel(historyForwardButton, `${windowTitle} のページ履歴を進む`);
      setControlLabel(firstPageButton, `${windowTitle} の最初のページへ移動`);
      setControlLabel(prevButton, `${windowTitle} の前のページへ移動`);
      setControlLabel(nextButton, `${windowTitle} の次のページへ移動`);
      setControlLabel(lastPageButton, `${windowTitle} の最後のページへ移動`);
      setControlLabel(zoomOutButton, `${windowTitle} を縮小表示`);
      setControlLabel(zoomInButton, `${windowTitle} を拡大表示`);
      setControlLabel(zoomResetButton, `${windowTitle} の表示倍率をリセット`);
      setControlLabel(zoomFitWidthButton, `${windowTitle} を幅に合わせて表示`);
      setControlLabel(zoomFitPageButton, `${windowTitle} を全体が収まるよう表示`);
      setControlLabel(rotateLeftButton, `${windowTitle} を反時計回りに回転`);
      setControlLabel(rotateRightButton, `${windowTitle} を時計回りに回転`);
      setControlLabel(rotateResetButton, `${windowTitle} の回転をリセット`);
    } else {
      setControlLabel(pageForm, '');
      setControlLabel(pageInput, '');
      setControlLabel(historyBackButton, '');
      setControlLabel(historyForwardButton, '');
      setControlLabel(firstPageButton, '');
      setControlLabel(prevButton, '');
      setControlLabel(nextButton, '');
      setControlLabel(lastPageButton, '');
      setControlLabel(zoomOutButton, '');
      setControlLabel(zoomInButton, '');
      setControlLabel(zoomResetButton, '');
      setControlLabel(zoomFitWidthButton, '');
      setControlLabel(zoomFitPageButton, '');
      setControlLabel(rotateLeftButton, '');
      setControlLabel(rotateRightButton, '');
      setControlLabel(rotateResetButton, '');
    }
  };

  return {
    element: toolbar,
    syncNavigation,
    syncZoom,
    syncRotation,
    updateLabels,
  };
}
