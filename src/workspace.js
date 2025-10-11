import { createPdfViewer } from './pdf-viewer.js';
import {
  loadWorkspaceWindows,
  persistWorkspaceWindow,
  removeWorkspaceWindow,
  clearWorkspaceWindows,
} from './workspace-storage.js';

const TITLE = 'GMWorkbench';
const TAGLINE = 'PDFシナリオの仮想デスク';
const DROP_ACTIVE_CLASS = 'workspace__drop-zone--active';
const FILE_INPUT_ID = 'workspace-file-input';
const QUEUE_OPEN_EVENT = 'workspace:file-open-request';
const QUEUE_REMOVE_EVENT = 'workspace:file-queue-remove';
const WINDOW_CLOSE_EVENT = 'workspace:window-close';
const WINDOW_STACK_OFFSET = 24;
const DEFAULT_WINDOW_WIDTH = 420;
const DEFAULT_WINDOW_HEIGHT = 320;
const MIN_WINDOW_WIDTH = 260;
const MIN_WINDOW_HEIGHT = 220;
const CANVAS_FALLBACK_WIDTH = 960;
const CANVAS_FALLBACK_HEIGHT = 640;
const WINDOW_PIN_TOGGLE_EVENT = 'workspace:window-pin-toggle';
const WINDOW_PAGE_CHANGE_EVENT = 'workspace:window-page-change';
const WINDOW_ZOOM_CHANGE_EVENT = 'workspace:window-zoom-change';
const WINDOW_DUPLICATE_EVENT = 'workspace:window-duplicate';
const WINDOW_NOTES_CHANGE_EVENT = 'workspace:window-notes-change';
const WINDOW_TITLE_CHANGE_EVENT = 'workspace:window-title-change';
const WINDOW_COLOR_CHANGE_EVENT = 'workspace:window-color-change';
const WINDOW_ROTATION_CHANGE_EVENT = 'workspace:window-rotation-change';
const WINDOW_MAXIMIZE_CHANGE_EVENT = 'workspace:window-maximize-change';
const WINDOW_FOCUS_CYCLE_EVENT = 'workspace:window-focus-cycle';
const DEFAULT_WINDOW_ZOOM = 1;
const MIN_WINDOW_ZOOM = 0.5;
const MAX_WINDOW_ZOOM = 2;
const WINDOW_ZOOM_STEP = 0.1;
const PAGE_HISTORY_LIMIT = 50;
const WORKSPACE_CACHE_CLEARED_EVENT = 'workspace:cache-cleared';
const DEFAULT_WINDOW_ROTATION = 0;
const ROTATION_STEP = 90;
const WINDOW_COLORS = [
  { id: 'neutral', label: '標準' },
  { id: 'amber', label: '琥珀' },
  { id: 'emerald', label: '翡翠' },
  { id: 'rose', label: '紅玉' },
  { id: 'indigo', label: '藍' },
];
const DEFAULT_WINDOW_COLOR = WINDOW_COLORS[0].id;

function createHeader() {
  const header = document.createElement('header');
  header.className = 'workspace__header';

  const title = document.createElement('h1');
  title.className = 'workspace__title';
  title.textContent = TITLE;

  const tagline = document.createElement('p');
  tagline.className = 'workspace__tagline';
  tagline.textContent = TAGLINE;

  header.append(title, tagline);
  return header;
}

function createFileInput(handleFiles) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.multiple = true;
  input.id = FILE_INPUT_ID;
  input.className = 'workspace__file-input';
  input.setAttribute('aria-label', 'PDFファイルを選択');

  input.addEventListener('change', () => {
    handleFiles(input.files);
  });

  return input;
}

function createDropZone() {
  const dropZone = document.createElement('section');
  dropZone.className = 'workspace__drop-zone';

  const instructions = document.createElement('p');
  instructions.className = 'workspace__instructions';
  instructions.textContent = 'PDFをドラッグ＆ドロップ、または下のボタンから選択してください。';

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'workspace__button';
  action.textContent = 'PDFを開く';
  action.setAttribute('aria-controls', FILE_INPUT_ID);

  const handleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    const fileSelected = new CustomEvent('workspace:file-selected', {
      bubbles: true,
      detail: { files },
    });

    dropZone.dispatchEvent(fileSelected);
  };

  const input = createFileInput(handleFiles);

  action.addEventListener('click', () => {
    input.click();
  });

  const activate = () => {
    dropZone.classList.add(DROP_ACTIVE_CLASS);
  };

  const deactivate = () => {
    dropZone.classList.remove(DROP_ACTIVE_CLASS);
  };

  const preventDefault = (event) => {
    event.preventDefault();
  };

  dropZone.addEventListener('dragenter', (event) => {
    preventDefault(event);
    activate();
  });

  dropZone.addEventListener('dragover', (event) => {
    preventDefault(event);
    activate();
  });

  dropZone.addEventListener('dragleave', () => {
    deactivate();
  });

  dropZone.addEventListener('dragend', () => {
    deactivate();
  });

  dropZone.addEventListener('drop', (event) => {
    preventDefault(event);
    deactivate();
    handleFiles(event.dataTransfer?.files);
  });

  dropZone.append(instructions, action, input);
  return dropZone;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

function createFileQueue() {
  const section = document.createElement('section');
  section.className = 'workspace__queue';

  const heading = document.createElement('h2');
  heading.className = 'workspace__queue-title';
  heading.textContent = '取り込んだPDF';

  const list = document.createElement('ul');
  list.className = 'workspace__queue-list';
  list.setAttribute('role', 'list');

  const emptyState = document.createElement('p');
  emptyState.className = 'workspace__queue-empty';
  emptyState.textContent = 'まだPDFは選択されていません。';

  const syncEmptyState = () => {
    if (list.children.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
    }
  };

  syncEmptyState();

  const renderFiles = (files) => {
    files.forEach((file) => {
      const item = document.createElement('li');
      item.className = 'workspace__queue-item';

      const name = document.createElement('span');
      name.className = 'workspace__queue-name';
      name.textContent = file.name;

      const meta = document.createElement('span');
      meta.className = 'workspace__queue-meta';
      const sizeLabel = formatFileSize(file.size);
      if (sizeLabel) {
        meta.textContent = sizeLabel;
      } else {
        meta.hidden = true;
      }

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'workspace__queue-open';
      openButton.textContent = 'ワークスペースに置く';
      openButton.addEventListener('click', () => {
        const request = new CustomEvent(QUEUE_OPEN_EVENT, {
          bubbles: true,
          detail: { file },
        });
        item.dispatchEvent(request);
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'workspace__queue-remove';
      removeButton.textContent = '取り消す';
      removeButton.addEventListener('click', () => {
        const removal = new CustomEvent(QUEUE_REMOVE_EVENT, {
          bubbles: true,
          detail: { file },
        });
        item.dispatchEvent(removal);
        item.remove();
        syncEmptyState();
      });

      const actions = document.createElement('div');
      actions.className = 'workspace__queue-actions';
      actions.append(openButton, removeButton);

      const controls = document.createElement('div');
      controls.className = 'workspace__queue-controls';
      controls.append(meta, actions);

      item.append(name, controls);
      list.append(item);
    });

    syncEmptyState();
  };

  section.append(heading, emptyState, list);

  const clear = () => {
    list.replaceChildren();
    syncEmptyState();
  };

  return {
    element: section,
    renderFiles,
    clear,
  };
}

function createHint() {
  const hint = document.createElement('p');
  hint.className = 'workspace__hint';
  hint.textContent = '初期バージョンではワークスペースの骨格を整え、操作フローを言語化しています。';
  return hint;
}

function createMaintenancePanel({ onClear } = {}) {
  const section = document.createElement('section');
  section.className = 'workspace__maintenance';

  const heading = document.createElement('h2');
  heading.className = 'workspace__maintenance-title';
  heading.textContent = '保存データの管理';

  const description = document.createElement('p');
  description.className = 'workspace__maintenance-description';
  description.textContent = 'ブラウザに保存されたPDFとウィンドウ配置を全て削除します。';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workspace__maintenance-button';
  button.textContent = 'キャッシュを全削除';

  const status = document.createElement('p');
  status.className = 'workspace__maintenance-status';
  status.setAttribute('role', 'status');
  status.hidden = true;

  const resetStatus = () => {
    status.hidden = true;
    status.textContent = '';
    status.classList.remove('workspace__maintenance-status--error');
  };

  const showStatus = (message, { isError = false } = {}) => {
    status.textContent = message;
    status.hidden = false;

    if (isError) {
      status.classList.add('workspace__maintenance-status--error');
    } else {
      status.classList.remove('workspace__maintenance-status--error');
    }
  };

  let clearing = false;

  button.addEventListener('click', async () => {
    if (clearing) {
      return;
    }

    resetStatus();

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm('保存済みのPDFとレイアウトをすべて削除しますか？');

      if (!confirmed) {
        return;
      }
    }

    clearing = true;
    button.disabled = true;
    button.textContent = '削除中…';

    try {
      const result = (await onClear?.()) || {};
      const windowsCleared = Number.isFinite(result.windowsCleared)
        ? result.windowsCleared
        : 0;
      const summary = windowsCleared > 0
        ? `保存データを削除しました（ウィンドウ${windowsCleared}件）。`
        : '保存データを削除しました。';
      showStatus(summary);
    } catch (error) {
      showStatus('削除に失敗しました。もう一度お試しください。', { isError: true });
    } finally {
      clearing = false;
      button.disabled = false;
      button.textContent = 'キャッシュを全削除';
    }
  });

  section.append(heading, description, button, status);

  return {
    element: section,
    showStatus,
  };
}

function createWindowCanvas() {
  const section = document.createElement('section');
  section.className = 'workspace__canvas';

  const heading = document.createElement('h2');
  heading.className = 'workspace__canvas-title';
  heading.textContent = '開いているPDF';

  const emptyState = document.createElement('p');
  emptyState.className = 'workspace__canvas-empty';
  emptyState.textContent = 'まだPDFはワークスペースにありません。';

  const area = document.createElement('div');
  area.className = 'workspace__windows';
  area.setAttribute('role', 'list');

  const windowRegistry = new Map();

  const syncEmptyState = () => {
    emptyState.hidden = area.children.length > 0;
  };

  syncEmptyState();

  let zIndexCounter = 1;
  let pinnedZIndexCounter = 10000;

  const parsePixels = (value, fallback) => {
    const numeric = Number.parseFloat(value);

    if (Number.isFinite(numeric)) {
      return numeric;
    }

    return fallback;
  };

  const getAreaSize = () => {
    const rect = area.getBoundingClientRect();
    const width = rect.width || area.clientWidth || area.scrollWidth || CANVAS_FALLBACK_WIDTH;
    const height = rect.height || area.clientHeight || area.scrollHeight || CANVAS_FALLBACK_HEIGHT;

    return {
      width,
      height,
    };
  };

  const openWindow = (file, options = {}) => {
    let zoomFitMode = 'manual';
    const windowElement = document.createElement('article');
    windowElement.className = 'workspace__window';
    windowElement.setAttribute('role', 'group');
    windowElement.tabIndex = 0;
    windowElement.dataset.zoomFitMode = zoomFitMode;

    const offsetIndex = area.children.length;
    const defaultLeft = offsetIndex * WINDOW_STACK_OFFSET;
    const defaultTop = offsetIndex * WINDOW_STACK_OFFSET;
    const initialLeft = Number.isFinite(options.left) ? options.left : defaultLeft;
    const initialTop = Number.isFinite(options.top) ? options.top : defaultTop;
    const initialWidth = Number.isFinite(options.width)
      ? options.width
      : DEFAULT_WINDOW_WIDTH;
    const initialHeight = Number.isFinite(options.height)
      ? options.height
      : DEFAULT_WINDOW_HEIGHT;

    windowElement.style.left = `${initialLeft}px`;
    windowElement.style.top = `${initialTop}px`;
    windowElement.style.width = `${initialWidth}px`;
    windowElement.style.height = `${initialHeight}px`;

    const windowId =
      typeof options.id === 'string' && options.id.length > 0
        ? options.id
        : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    windowElement.dataset.windowId = windowId;

    const shouldAutoFocus = options.autoFocus !== false;
    let currentPage = Number.isFinite(options.page)
      ? Math.max(1, Math.floor(options.page))
      : 1;
    const sanitizeHistoryValue = (value) => {
      if (!Number.isFinite(value)) {
        return null;
      }

      return Math.max(1, Math.floor(value));
    };

    const initialHistory = Array.isArray(options.pageHistory)
      ? options.pageHistory
          .map(sanitizeHistoryValue)
          .filter((value) => Number.isFinite(value))
      : [];

    let pageHistory = initialHistory.length > 0 ? initialHistory.slice() : [currentPage];
    let pageHistoryIndex = Number.isFinite(options.pageHistoryIndex)
      ? Math.floor(options.pageHistoryIndex)
      : pageHistory.length - 1;

    if (pageHistory.length > PAGE_HISTORY_LIMIT) {
      const overflow = pageHistory.length - PAGE_HISTORY_LIMIT;
      pageHistory = pageHistory.slice(overflow);
      pageHistoryIndex -= overflow;
    }

    if (pageHistoryIndex < 0) {
      pageHistoryIndex = 0;
    }

    if (pageHistoryIndex >= pageHistory.length) {
      pageHistoryIndex = pageHistory.length - 1;
    }

    currentPage = pageHistory[pageHistoryIndex] ?? currentPage;
    let pageInput;
    let firstPageButton;
    let prevButton;
    let nextButton;
    let lastPageButton;
    let historyBackButton;
    let historyForwardButton;
    let zoomOutButton;
    let zoomInButton;
    let zoomResetButton;
    let zoomDisplay;
    let zoomFitWidthButton;
    let zoomFitPageButton;
    let rotateLeftButton;
    let rotateRightButton;
    let rotateResetButton;
    let rotationDisplay;
    let currentZoom = Number.isFinite(options.zoom)
      ? Number.parseFloat(options.zoom)
      : DEFAULT_WINDOW_ZOOM;
    let totalPages = Number.isFinite(options.totalPages) ? options.totalPages : null;
    let openedAt = Number.isFinite(options.openedAt) ? options.openedAt : Date.now();
    let lastFocusedAt = Number.isFinite(options.lastFocusedAt)
      ? options.lastFocusedAt
      : openedAt;
    let hasStoredFile = options.persisted === true;
    let notesContent = typeof options.notes === 'string' ? options.notes : '';
    let notesTextarea;
    let notesCounter;
    let resizeHandle;
    let maximizeButton;
    let isMaximized = options.maximized === true;
    const sanitizeBoundValue = (value, fallback) =>
      Number.isFinite(value) ? value : fallback;
    let restoreBounds = {
      left: sanitizeBoundValue(options.restoreLeft, initialLeft),
      top: sanitizeBoundValue(options.restoreTop, initialTop),
      width: sanitizeBoundValue(options.restoreWidth, initialWidth),
      height: sanitizeBoundValue(options.restoreHeight, initialHeight),
    };
    const defaultTitle = file.name;
    let windowTitle =
      typeof options.title === 'string' && options.title.trim().length > 0
        ? options.title.trim()
        : defaultTitle;
    let titleInput;
    let renameButton;
    let colorButton;
    let editingTitle = false;

    const sanitizeColor = (value) => {
      if (typeof value !== 'string') {
        return DEFAULT_WINDOW_COLOR;
      }

      const normalized = value.toLowerCase();
      const match = WINDOW_COLORS.find((color) => color.id === normalized);
      return match ? match.id : DEFAULT_WINDOW_COLOR;
    };

    let windowColor = sanitizeColor(options.color);

    const normalizeRotation = (value) => {
      if (!Number.isFinite(value)) {
        return DEFAULT_WINDOW_ROTATION;
      }

      const rounded = Math.round(value / ROTATION_STEP) * ROTATION_STEP;
      const wrapped = ((rounded % 360) + 360) % 360;
      return wrapped === 360 ? 0 : wrapped;
    };

    let currentRotation = normalizeRotation(options.rotation);

    const viewer = createPdfViewer(file);
    let disposed = false;

    const emitMaximizeChange = () => {
      const bounds = getWindowBounds();

      const maximizeEvent = new CustomEvent(WINDOW_MAXIMIZE_CHANGE_EVENT, {
        bubbles: true,
        detail: {
          file,
          maximized: isMaximized,
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          restoreLeft: restoreBounds.left,
          restoreTop: restoreBounds.top,
          restoreWidth: restoreBounds.width,
          restoreHeight: restoreBounds.height,
        },
      });

      windowElement.dispatchEvent(maximizeEvent);
    };

    const syncMaximizeControl = () => {
      if (!maximizeButton) {
        return;
      }

      maximizeButton.textContent = isMaximized ? '縮小' : '最大化';
      maximizeButton.setAttribute('aria-pressed', isMaximized ? 'true' : 'false');
    };

    const syncMaximizeState = () => {
      syncMaximizeControl();
      windowElement.classList.toggle('workspace__window--maximized', isMaximized);
      windowElement.dataset.windowMaximized = isMaximized ? 'true' : 'false';

      if (resizeHandle) {
        resizeHandle.disabled = isMaximized;
        resizeHandle.setAttribute('aria-hidden', isMaximized ? 'true' : 'false');
      }

      if (isMaximized) {
        windowElement.classList.remove('workspace__window--resizing');
      }
    };

    const toggleMaximize = () => {
      bringToFront();

      if (isMaximized) {
        isMaximized = false;
        const clamped = clampBounds(restoreBounds);
        restoreBounds = clamped;
        applyBounds(clamped);
        syncMaximizeState();
        syncControlLabels();
        refreshRestoreBounds();
        emitMaximizeChange();
        schedulePersist();
        return;
      }

      refreshRestoreBounds();
      const { width: areaWidth, height: areaHeight } = getAreaSize();
      isMaximized = true;
      applyBounds({ left: 0, top: 0, width: areaWidth, height: areaHeight });
      syncMaximizeState();
      syncControlLabels();
      emitMaximizeChange();
      schedulePersist();
    };

    const dispatchCloseEvent = () => {
      const closure = new CustomEvent(WINDOW_CLOSE_EVENT, {
        bubbles: true,
        detail: { file },
      });
      windowElement.dispatchEvent(closure);
    };

    const disposeWindow = ({ persistRemoval = true, emitClose = true } = {}) => {
      if (disposed) {
        return;
      }

      disposed = true;

      if (emitClose) {
        dispatchCloseEvent();
      }

      try {
        viewer.destroy();
      } catch (error) {
        // Viewer teardown errors are non-fatal; suppress noisy logs.
      }

      windowElement.remove();
      windowRegistry.delete(windowId);
      syncEmptyState();

      if (windowRegistry.size === 0) {
        zIndexCounter = 1;
        pinnedZIndexCounter = 10000;
      }

      if (persistRemoval) {
        removeWorkspaceWindow(windowId).catch(() => {});
      }
    };

    const getWindowBounds = () => ({
      left: parsePixels(windowElement.style.left, initialLeft),
      top: parsePixels(windowElement.style.top, initialTop),
      width: parsePixels(windowElement.style.width, initialWidth),
      height: parsePixels(windowElement.style.height, initialHeight),
    });

    const getWindowSize = () => {
      const { width, height } = getWindowBounds();
      return { width, height };
    };

    const clampBounds = (bounds) => {
      const { width: areaWidth, height: areaHeight } = getAreaSize();
      const sanitizedWidth = sanitizeBoundValue(bounds?.width, initialWidth);
      const sanitizedHeight = sanitizeBoundValue(bounds?.height, initialHeight);
      const width = Math.min(Math.max(MIN_WINDOW_WIDTH, sanitizedWidth), areaWidth);
      const height = Math.min(Math.max(MIN_WINDOW_HEIGHT, sanitizedHeight), areaHeight);
      const sanitizedLeft = sanitizeBoundValue(bounds?.left, initialLeft);
      const sanitizedTop = sanitizeBoundValue(bounds?.top, initialTop);
      const maxLeft = Math.max(0, areaWidth - width);
      const maxTop = Math.max(0, areaHeight - height);

      return {
        left: Math.min(Math.max(0, sanitizedLeft), maxLeft),
        top: Math.min(Math.max(0, sanitizedTop), maxTop),
        width,
        height,
      };
    };

    const applyBounds = ({ left, top, width, height }) => {
      windowElement.style.left = `${left}px`;
      windowElement.style.top = `${top}px`;
      windowElement.style.width = `${width}px`;
      windowElement.style.height = `${height}px`;
    };

    const refreshRestoreBounds = () => {
      if (isMaximized) {
        return;
      }

      restoreBounds = clampBounds(getWindowBounds());
    };

    restoreBounds = clampBounds(restoreBounds);

    const clampPosition = (left, top) => {
      const { width: areaWidth, height: areaHeight } = getAreaSize();
      const { width: windowWidth, height: windowHeight } = getWindowSize();
      const maxLeft = Math.max(0, areaWidth - windowWidth);
      const maxTop = Math.max(0, areaHeight - windowHeight);

      return {
        left: Math.min(Math.max(0, left), maxLeft),
        top: Math.min(Math.max(0, top), maxTop),
      };
    };

    const persistState = async ({ includeFile = false } = {}) => {
      refreshRestoreBounds();
      const descriptor = {
        id: windowId,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        left: parsePixels(windowElement.style.left, initialLeft),
        top: parsePixels(windowElement.style.top, initialTop),
        width: parsePixels(windowElement.style.width, initialWidth),
        height: parsePixels(windowElement.style.height, initialHeight),
        page: currentPage,
        zoom: currentZoom,
        rotation: currentRotation,
        totalPages: Number.isFinite(totalPages) ? totalPages : undefined,
        pinned: windowElement.classList.contains('workspace__window--pinned'),
        openedAt,
        lastFocusedAt,
        title: windowTitle,
        notes: notesContent,
        color: windowColor,
        pageHistory: pageHistory.slice(),
        pageHistoryIndex,
        maximized: isMaximized,
        restoreLeft: restoreBounds.left,
        restoreTop: restoreBounds.top,
        restoreWidth: restoreBounds.width,
        restoreHeight: restoreBounds.height,
      };

      if (includeFile) {
        descriptor.file = file;
      }

      await persistWorkspaceWindow(descriptor, { includeFile });
    };

    const syncFocusMetadata = () => {
      if (Number.isFinite(openedAt)) {
        windowElement.dataset.openedAt = String(openedAt);
      } else {
        delete windowElement.dataset.openedAt;
      }

      if (Number.isFinite(lastFocusedAt)) {
        windowElement.dataset.lastFocusedAt = String(lastFocusedAt);
      } else {
        delete windowElement.dataset.lastFocusedAt;
      }
    };

    const schedulePersist = ({ includeFile = false } = {}) => {
      const shouldIncludeFile = includeFile || !hasStoredFile;

      persistState({ includeFile: shouldIncludeFile })
        .then(() => {
          if (shouldIncludeFile) {
            hasStoredFile = true;
          }
        })
        .catch(() => {});
    };

    syncFocusMetadata();

    const syncNotesMetadata = () => {
      windowElement.dataset.notesLength = String(notesContent.length);
    };

    const syncNotesDisplay = () => {
      if (notesTextarea && notesTextarea.value !== notesContent) {
        notesTextarea.value = notesContent;
      }

      if (notesCounter) {
        notesCounter.textContent = `${notesContent.length}文字`;
      }

      syncNotesMetadata();
    };

    const syncRotationState = () => {
      if (rotationDisplay) {
        rotationDisplay.textContent = `${currentRotation}°`;
      }

      if (rotateResetButton) {
        rotateResetButton.disabled = currentRotation === DEFAULT_WINDOW_ROTATION;
      }

      windowElement.dataset.rotation = String(currentRotation);
    };

    const updateViewerState = () => {
      syncRotationState();
      viewer.updateState({
        page: currentPage,
        zoom: currentZoom,
        totalPages,
        rotation: currentRotation,
      });
    };

    const renderCurrentPage = async () => {
      try {
        await viewer.render({
          page: currentPage,
          zoom: currentZoom,
          rotation: currentRotation,
        });
      } catch (error) {
        // Rendering errors are surfaced via viewer status; suppress console noise in tests.
      } finally {
        syncZoomState();
      }
    };

    const sanitizePageValue = (value) => {
      if (typeof value !== 'string') {
        return null;
      }

      const trimmed = value.trim();

      if (trimmed.length === 0) {
        return null;
      }

      const parsed = Number.parseInt(trimmed, 10);

      if (!Number.isFinite(parsed)) {
        return null;
      }

      return clampPage(parsed);
    };

    const clampPage = (value) => {
      if (!Number.isFinite(value)) {
        return currentPage;
      }

      const normalized = Math.max(1, Math.floor(value));

      if (Number.isFinite(totalPages)) {
        return Math.min(normalized, totalPages);
      }

      return normalized;
    };

    const trimHistoryToLimit = () => {
      if (pageHistory.length <= PAGE_HISTORY_LIMIT) {
        return;
      }

      const overflow = pageHistory.length - PAGE_HISTORY_LIMIT;
      pageHistory.splice(0, overflow);
      pageHistoryIndex = Math.max(0, pageHistoryIndex - overflow);
    };

    const clampHistoryToBounds = () => {
      if (!Number.isFinite(totalPages)) {
        return;
      }

      let adjusted = false;

      for (let index = 0; index < pageHistory.length; index += 1) {
        const entry = pageHistory[index];

        if (!Number.isFinite(entry)) {
          continue;
        }

        const clamped = Math.min(Math.max(1, Math.floor(entry)), totalPages);

        if (clamped !== entry) {
          pageHistory[index] = clamped;
          adjusted = true;
        }
      }

      if (pageHistoryIndex >= pageHistory.length) {
        pageHistoryIndex = Math.max(0, pageHistory.length - 1);
        adjusted = true;
      }

      if (pageHistoryIndex < 0) {
        pageHistoryIndex = 0;
        adjusted = true;
      }

      if (adjusted) {
        currentPage = pageHistory[pageHistoryIndex] ?? clampPage(currentPage);
      }
    };

    const canStepHistoryBack = () => pageHistoryIndex > 0;
    const canStepHistoryForward = () => pageHistoryIndex < pageHistory.length - 1;

    const recordHistoryEntry = (page) => {
      const next = clampPage(page);

      if (pageHistoryIndex < pageHistory.length - 1) {
        pageHistory.splice(pageHistoryIndex + 1);
      }

      if (pageHistory[pageHistoryIndex] === next) {
        return;
      }

      pageHistory.push(next);
      pageHistoryIndex = pageHistory.length - 1;
      trimHistoryToLimit();
    };

    const navigateHistory = (offset) => {
      if (!Number.isFinite(offset) || offset === 0) {
        return;
      }

      const targetIndex = pageHistoryIndex + Math.trunc(offset);

      if (targetIndex < 0 || targetIndex >= pageHistory.length) {
        syncNavigationState();
        return;
      }

      pageHistoryIndex = targetIndex;
      const targetPage = pageHistory[pageHistoryIndex];

      if (Number.isFinite(targetPage)) {
        commitPageChange(targetPage, { fromHistory: true });
      } else {
        syncNavigationState();
      }
    };

    const syncNavigationState = () => {
      if (pageInput) {
        pageInput.value = String(currentPage);

        if (Number.isFinite(totalPages)) {
          pageInput.max = String(totalPages);
        } else {
          pageInput.removeAttribute('max');
        }
      }

      if (firstPageButton) {
        firstPageButton.disabled = currentPage <= 1;
      }

      if (prevButton) {
        prevButton.disabled = currentPage <= 1;
      }

      if (nextButton) {
        if (Number.isFinite(totalPages)) {
          nextButton.disabled = currentPage >= totalPages;
        } else {
          nextButton.disabled = false;
        }
      }

      if (lastPageButton) {
        if (Number.isFinite(totalPages)) {
          lastPageButton.disabled = currentPage >= totalPages;
        } else {
          lastPageButton.disabled = true;
        }
      }

      if (historyBackButton) {
        historyBackButton.disabled = !canStepHistoryBack();
      }

      if (historyForwardButton) {
        historyForwardButton.disabled = !canStepHistoryForward();
      }

      windowElement.dataset.pageHistoryIndex = String(pageHistoryIndex);
      windowElement.dataset.pageHistoryLength = String(pageHistory.length);
    };

    const isDefaultZoom = () => Math.abs(currentZoom - DEFAULT_WINDOW_ZOOM) < 0.001;

    const clampZoom = (value) => {
      if (!Number.isFinite(value)) {
        return currentZoom;
      }

      if (value < MIN_WINDOW_ZOOM) {
        return MIN_WINDOW_ZOOM;
      }

      if (value > MAX_WINDOW_ZOOM) {
        return MAX_WINDOW_ZOOM;
      }

      return Number.parseFloat(value.toFixed(2));
    };

    currentZoom = clampZoom(currentZoom);
    currentPage = clampPage(currentPage);
    clampHistoryToBounds();

    const approxEqual = (a, b, tolerance = 0.01) =>
      Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;

    const getViewerMetrics = () => {
      if (!viewer || typeof viewer.getViewportMetrics !== 'function') {
        return null;
      }

      return viewer.getViewportMetrics();
    };

    const getViewerContentSize = () => {
      if (!(viewer.element instanceof HTMLElement)) {
        return null;
      }

      const element = viewer.element;
      let width = 0;
      let height = 0;

      if (typeof element.getBoundingClientRect === 'function') {
        const rect = element.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      }

      if (!Number.isFinite(width) || width <= 0) {
        width = element.clientWidth;
      }

      if (!Number.isFinite(width) || width <= 0) {
        width = element.scrollWidth;
      }

      if (!Number.isFinite(width) || width <= 0) {
        width = CANVAS_FALLBACK_WIDTH;
      }

      if (!Number.isFinite(height) || height <= 0) {
        height = element.clientHeight;
      }

      if (!Number.isFinite(height) || height <= 0) {
        height = element.scrollHeight;
      }

      if (!Number.isFinite(height) || height <= 0) {
        height = CANVAS_FALLBACK_HEIGHT;
      }

      let horizontalPadding = 0;
      let verticalPadding = 0;

      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        const style = window.getComputedStyle(element);
        const paddingLeft = Number.parseFloat(style.paddingLeft);
        const paddingRight = Number.parseFloat(style.paddingRight);
        const paddingTop = Number.parseFloat(style.paddingTop);
        const paddingBottom = Number.parseFloat(style.paddingBottom);

        if (Number.isFinite(paddingLeft)) {
          horizontalPadding += paddingLeft;
        }

        if (Number.isFinite(paddingRight)) {
          horizontalPadding += paddingRight;
        }

        if (Number.isFinite(paddingTop)) {
          verticalPadding += paddingTop;
        }

        if (Number.isFinite(paddingBottom)) {
          verticalPadding += paddingBottom;
        }
      }

      const availableWidth = width - horizontalPadding;
      const availableHeight = height - verticalPadding;

      return {
        width:
          Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : Math.max(width, 0),
        height:
          Number.isFinite(availableHeight) && availableHeight > 0
            ? availableHeight
            : Math.max(height, 0),
      };
    };

    const computeFitZoom = (mode) => {
      const metrics = getViewerMetrics();
      const datasetBaseWidth = Number.parseFloat(viewer.element?.dataset?.pageWidth ?? '');
      const datasetBaseHeight = Number.parseFloat(viewer.element?.dataset?.pageHeight ?? '');
      const baseWidth = Number.isFinite(metrics?.pageWidth)
        ? metrics.pageWidth
        : Number.isFinite(datasetBaseWidth)
          ? datasetBaseWidth
          : null;
      const baseHeight = Number.isFinite(metrics?.pageHeight)
        ? metrics.pageHeight
        : Number.isFinite(datasetBaseHeight)
          ? datasetBaseHeight
          : null;

      if (!baseWidth || !baseHeight) {
        return null;
      }

      const contentSize = getViewerContentSize();

      if (!contentSize) {
        return null;
      }

      if (mode === 'width') {
        const target = contentSize.width / baseWidth;

        if (!Number.isFinite(target) || target <= 0) {
          return null;
        }

        return clampZoom(target);
      }

      if (mode === 'page') {
        const widthScale = contentSize.width / baseWidth;
        const heightScale = contentSize.height / baseHeight;
        const candidate = Math.min(widthScale, heightScale);

        if (!Number.isFinite(candidate) || candidate <= 0) {
          return null;
        }

        return clampZoom(candidate);
      }

      return null;
    };

    const syncZoomState = () => {
      if (zoomDisplay) {
        const percentage = Math.round(currentZoom * 100);
        zoomDisplay.textContent = `${percentage}%`;
      }

      if (zoomOutButton) {
        zoomOutButton.disabled = currentZoom <= MIN_WINDOW_ZOOM + 0.0001;
      }

      if (zoomInButton) {
        zoomInButton.disabled = currentZoom >= MAX_WINDOW_ZOOM - 0.0001;
      }

      if (zoomResetButton) {
        zoomResetButton.disabled = isDefaultZoom();
      }

      const fitWidthZoom = computeFitZoom('width');
      const fitPageZoom = computeFitZoom('page');

      if (Number.isFinite(fitWidthZoom)) {
        windowElement.dataset.zoomFitWidth = String(fitWidthZoom);
      } else {
        delete windowElement.dataset.zoomFitWidth;
      }

      if (Number.isFinite(fitPageZoom)) {
        windowElement.dataset.zoomFitPage = String(fitPageZoom);
      } else {
        delete windowElement.dataset.zoomFitPage;
      }

      if (zoomFitWidthButton) {
        if (!Number.isFinite(fitWidthZoom)) {
          zoomFitWidthButton.disabled = true;
          zoomFitWidthButton.setAttribute('aria-pressed', 'false');
        } else {
          const matches = approxEqual(currentZoom, fitWidthZoom);
          zoomFitWidthButton.disabled = matches;
          zoomFitWidthButton.setAttribute(
            'aria-pressed',
            zoomFitMode === 'fit-width' && matches ? 'true' : 'false',
          );
        }
      }

      if (zoomFitPageButton) {
        if (!Number.isFinite(fitPageZoom)) {
          zoomFitPageButton.disabled = true;
          zoomFitPageButton.setAttribute('aria-pressed', 'false');
        } else {
          const matches = approxEqual(currentZoom, fitPageZoom);
          zoomFitPageButton.disabled = matches;
          zoomFitPageButton.setAttribute(
            'aria-pressed',
            zoomFitMode === 'fit-page' && matches ? 'true' : 'false',
          );
        }
      }
    };

    const isPinned = () => windowElement.classList.contains('workspace__window--pinned');

    const assignZIndex = (customValue) => {
      if (Number.isFinite(customValue)) {
        windowElement.style.zIndex = String(customValue);

        if (isPinned()) {
          pinnedZIndexCounter = Math.max(pinnedZIndexCounter, customValue + 1);
        } else {
          zIndexCounter = Math.max(zIndexCounter, customValue + 1);
        }

        return;
      }

      if (isPinned()) {
        windowElement.style.zIndex = String(pinnedZIndexCounter);
        pinnedZIndexCounter += 1;
      } else {
        windowElement.style.zIndex = String(zIndexCounter);
        zIndexCounter += 1;
      }
    };

    const bringToFront = ({ persistFocus = true } = {}) => {
      area.querySelectorAll('.workspace__window').forEach((otherWindow) => {
        if (otherWindow !== windowElement) {
          otherWindow.classList.remove('workspace__window--active');
        }
      });
      windowElement.classList.add('workspace__window--active');
      assignZIndex();

      if (persistFocus) {
        lastFocusedAt = Date.now();
      }

      syncFocusMetadata();

      if (persistFocus) {
        schedulePersist();
      }
    };

    const commitPageChange = (page, { fromHistory = false } = {}) => {
      const nextPage = clampPage(page);

      if (!fromHistory) {
        recordHistoryEntry(nextPage);
      }

      if (nextPage === currentPage) {
        syncNavigationState();
        return;
      }

      currentPage = nextPage;
      syncNavigationState();
      updateViewerState();
      void renderCurrentPage();
      bringToFront();
      const pageChange = new CustomEvent(WINDOW_PAGE_CHANGE_EVENT, {
        bubbles: true,
        detail: {
          file,
          page: currentPage,
          totalPages,
          historyIndex: pageHistoryIndex,
          historyLength: pageHistory.length,
          rotation: currentRotation,
          zoom: currentZoom,
        },
      });
      windowElement.dispatchEvent(pageChange);
      schedulePersist();
    };

    const stepPage = (offset) => {
      const nextPage = clampPage(currentPage + offset);

      if (nextPage === currentPage) {
        syncNavigationState();
        return;
      }

      commitPageChange(nextPage);
    };

    const goToFirstPage = () => {
      if (currentPage <= 1) {
        syncNavigationState();
        return;
      }

      commitPageChange(1);
    };

    const goToLastPage = () => {
      if (!Number.isFinite(totalPages)) {
        syncNavigationState();
        return;
      }

      const target = clampPage(totalPages);

      if (currentPage >= target) {
        syncNavigationState();
        return;
      }

      commitPageChange(target);
    };

    const commitZoomChange = (zoom, { mode = 'manual' } = {}) => {
      const normalizedMode =
        mode === 'fit-width' || mode === 'fit-page' ? mode : 'manual';

      zoomFitMode = normalizedMode;
      windowElement.dataset.zoomFitMode = zoomFitMode;

      const nextZoom = clampZoom(zoom);

      if (Math.abs(nextZoom - currentZoom) < 0.0001) {
        syncZoomState();
        return;
      }

      currentZoom = nextZoom;
      syncZoomState();
      updateViewerState();
      void renderCurrentPage();
      bringToFront();
      const zoomChange = new CustomEvent(WINDOW_ZOOM_CHANGE_EVENT, {
        bubbles: true,
        detail: {
          file,
          zoom: currentZoom,
          page: currentPage,
          rotation: currentRotation,
          mode: zoomFitMode,
        },
      });
      windowElement.dispatchEvent(zoomChange);
      schedulePersist();
    };

    const stepZoom = (delta) => {
      commitZoomChange(currentZoom + delta);
    };

    const resetZoom = () => {
      commitZoomChange(DEFAULT_WINDOW_ZOOM);
    };

    const commitRotationChange = (rotation) => {
      const nextRotation = normalizeRotation(rotation);

      if (nextRotation === currentRotation) {
        syncRotationState();
        return;
      }

      currentRotation = nextRotation;
      updateViewerState();
      void renderCurrentPage();
      bringToFront();

      const rotationChange = new CustomEvent(WINDOW_ROTATION_CHANGE_EVENT, {
        bubbles: true,
        detail: {
          file,
          rotation: currentRotation,
          page: currentPage,
          zoom: currentZoom,
        },
      });

      windowElement.dispatchEvent(rotationChange);
      schedulePersist();
    };

    const stepRotation = (steps) => {
      const delta = Number.isFinite(steps) ? Math.trunc(steps) * ROTATION_STEP : 0;
      commitRotationChange(currentRotation + delta);
    };

    const resetRotation = () => {
      commitRotationChange(DEFAULT_WINDOW_ROTATION);
    };

    const header = document.createElement('header');
    header.className = 'workspace__window-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'workspace__window-title-group';

    const title = document.createElement('h3');
    title.className = 'workspace__window-title';

    title.textContent = windowTitle;

    titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'workspace__window-title-input';
    titleInput.maxLength = 120;
    titleInput.hidden = true;
    titleInput.setAttribute('aria-label', 'ウィンドウタイトルを編集');
    titleInput.value = windowTitle;
    titleInput.placeholder = windowTitle;

    titleGroup.append(title, titleInput);

    const controls = document.createElement('div');
    controls.className = 'workspace__window-controls';

    renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.className = 'workspace__window-rename';
    renameButton.textContent = '名称変更';
    renameButton.setAttribute('aria-label', `${windowTitle} のタイトルを変更`);

    colorButton = document.createElement('button');
    colorButton.type = 'button';
    colorButton.className = 'workspace__window-color';
    colorButton.dataset.windowColor = windowColor;

    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'workspace__window-pin';
    pinButton.textContent = 'ピン留め';
    pinButton.setAttribute('aria-pressed', 'false');

    const updatePinVisualState = (pinned) => {
      windowElement.classList.toggle('workspace__window--pinned', pinned);
      pinButton.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      pinButton.textContent = pinned ? 'ピン解除' : 'ピン留め';
    };

    pinButton.addEventListener('click', () => {
      const nextPinned = !isPinned();
      updatePinVisualState(nextPinned);
      const toggle = new CustomEvent(WINDOW_PIN_TOGGLE_EVENT, {
        bubbles: true,
        detail: { file, pinned: nextPinned },
      });
      windowElement.dispatchEvent(toggle);
      bringToFront();
      schedulePersist();
    });

    maximizeButton = document.createElement('button');
    maximizeButton.type = 'button';
    maximizeButton.className = 'workspace__window-maximize';
    maximizeButton.textContent = '最大化';
    maximizeButton.setAttribute('aria-pressed', 'false');
    maximizeButton.addEventListener('click', () => {
      toggleMaximize();
    });

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'workspace__window-duplicate';
    duplicateButton.textContent = '複製';
    duplicateButton.setAttribute('aria-label', `${windowTitle} を別ウィンドウで複製`);

    const getColorDefinition = () => {
      const match = WINDOW_COLORS.find((color) => color.id === windowColor);
      return match ?? WINDOW_COLORS[0];
    };

    const syncColorButton = () => {
      if (!colorButton) {
        return;
      }

      const { label } = getColorDefinition();
      colorButton.textContent = `色: ${label}`;
      colorButton.dataset.windowColor = windowColor;
      colorButton.setAttribute(
        'aria-label',
        `${windowTitle} の色を切り替え (現在: ${label})`,
      );
    };

    const syncWindowColorDisplay = () => {
      WINDOW_COLORS.forEach(({ id }) => {
        const className = `workspace__window--color-${id}`;

        if (windowColor === id) {
          windowElement.classList.add(className);
        } else {
          windowElement.classList.remove(className);
        }
      });

      windowElement.dataset.windowColor = windowColor;
      syncColorButton();
    };

    const cycleWindowColor = () => {
      const currentIndex = WINDOW_COLORS.findIndex((color) => color.id === windowColor);
      const nextIndex = (currentIndex + 1) % WINDOW_COLORS.length;

      windowColor = WINDOW_COLORS[nextIndex].id;
      syncWindowColorDisplay();
      bringToFront();
      const colorChange = new CustomEvent(WINDOW_COLOR_CHANGE_EVENT, {
        bubbles: true,
        detail: { file, color: windowColor },
      });

      windowElement.dispatchEvent(colorChange);
      schedulePersist();
    };

    colorButton.addEventListener('click', () => {
      cycleWindowColor();
    });

    const syncControlLabels = () => {
      const windowLabel = `${windowTitle} のウィンドウ`;
      windowElement.setAttribute('aria-label', windowLabel);

      pinButton.setAttribute('aria-label', `${windowTitle} を前面に固定`);
      duplicateButton.setAttribute('aria-label', `${windowTitle} を別ウィンドウで複製`);

      if (notesTextarea) {
        notesTextarea.setAttribute('aria-label', `${windowTitle} のメモ`);
      }

      if (pageForm) {
        pageForm.setAttribute('aria-label', `${windowTitle} の表示ページを設定`);
      }

      if (pageInput) {
        pageInput.setAttribute('aria-label', `${windowTitle} の表示ページ番号`);
      }

      if (historyBackButton) {
        historyBackButton.setAttribute('aria-label', `${windowTitle} のページ履歴を戻る`);
      }

      if (historyForwardButton) {
        historyForwardButton.setAttribute('aria-label', `${windowTitle} のページ履歴を進む`);
      }

      if (firstPageButton) {
        firstPageButton.setAttribute('aria-label', `${windowTitle} の最初のページへ移動`);
      }

      if (prevButton) {
        prevButton.setAttribute('aria-label', `${windowTitle} の前のページへ移動`);
      }

      if (nextButton) {
        nextButton.setAttribute('aria-label', `${windowTitle} の次のページへ移動`);
      }

      if (lastPageButton) {
        lastPageButton.setAttribute('aria-label', `${windowTitle} の最後のページへ移動`);
      }

      if (zoomOutButton) {
        zoomOutButton.setAttribute('aria-label', `${windowTitle} を縮小表示`);
      }

      if (zoomInButton) {
        zoomInButton.setAttribute('aria-label', `${windowTitle} を拡大表示`);
      }

      if (zoomResetButton) {
        zoomResetButton.setAttribute('aria-label', `${windowTitle} の表示倍率をリセット`);
      }

      if (zoomFitWidthButton) {
        zoomFitWidthButton.setAttribute('aria-label', `${windowTitle} を幅に合わせて表示`);
      }

      if (zoomFitPageButton) {
        zoomFitPageButton.setAttribute('aria-label', `${windowTitle} を全体が収まるよう表示`);
      }

      if (rotateLeftButton) {
        rotateLeftButton.setAttribute('aria-label', `${windowTitle} を反時計回りに回転`);
      }

      if (rotateRightButton) {
        rotateRightButton.setAttribute('aria-label', `${windowTitle} を時計回りに回転`);
      }

      if (rotateResetButton) {
        rotateResetButton.setAttribute('aria-label', `${windowTitle} の回転をリセット`);
      }

      if (maximizeButton) {
        const label = isMaximized
          ? `${windowTitle} を元のサイズに戻す`
          : `${windowTitle} を最大化`;
        maximizeButton.setAttribute('aria-label', label);
      }

      if (resizeHandle) {
        resizeHandle.setAttribute('aria-label', `${windowTitle} のウィンドウサイズを変更`);
      }

      syncColorButton();
    };

    const syncWindowTitleDisplay = () => {
      title.textContent = windowTitle;

      if (!editingTitle) {
        titleInput.value = windowTitle;
      }

      titleInput.placeholder = windowTitle;
      windowElement.dataset.windowTitle = windowTitle;
      syncControlLabels();
    };

    const finishTitleEdit = ({ commit }) => {
      if (!editingTitle) {
        return;
      }

      const previousTitle = windowTitle;
      editingTitle = false;
      windowElement.classList.remove('workspace__window--renaming');
      title.hidden = false;
      titleInput.hidden = true;

      if (commit) {
        const rawValue = typeof titleInput.value === 'string' ? titleInput.value.trim() : '';
        windowTitle = rawValue.length > 0 ? rawValue : defaultTitle;
      } else {
        titleInput.value = windowTitle;
      }

      renameButton.textContent = '名称変更';
      renameButton.setAttribute('aria-label', `${windowTitle} のタイトルを変更`);

      syncWindowTitleDisplay();

      if (commit && windowTitle !== previousTitle) {
        const titleEvent = new CustomEvent(WINDOW_TITLE_CHANGE_EVENT, {
          bubbles: true,
          detail: { file, title: windowTitle },
        });

        windowElement.dispatchEvent(titleEvent);
        bringToFront();
        schedulePersist();
      }
    };

    const startTitleEdit = () => {
      if (editingTitle) {
        return;
      }

      editingTitle = true;
      windowElement.classList.add('workspace__window--renaming');
      title.hidden = true;
      titleInput.hidden = false;
      titleInput.value = windowTitle;
      renameButton.textContent = '保存';
      renameButton.setAttribute('aria-label', `${windowTitle} のタイトルを保存`);

      queueMicrotask(() => {
        titleInput.focus({ preventScroll: true });
        titleInput.select();
      });
    };

    renameButton.addEventListener('click', () => {
      bringToFront();

      if (!editingTitle) {
        startTitleEdit();
        return;
      }

      finishTitleEdit({ commit: true });
    });

    titleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        finishTitleEdit({ commit: true });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finishTitleEdit({ commit: false });
      }
    });

    titleInput.addEventListener('blur', () => {
      finishTitleEdit({ commit: true });
    });

    duplicateButton.addEventListener('click', () => {
      const baseBounds = isMaximized ? clampBounds(restoreBounds) : getWindowBounds();
      const currentLeft = baseBounds.left;
      const currentTop = baseBounds.top;
      const currentWidth = baseBounds.width;
      const currentHeight = baseBounds.height;
      const { width: areaWidth, height: areaHeight } = getAreaSize();

      const proposedLeft = currentLeft + WINDOW_STACK_OFFSET;
      const proposedTop = currentTop + WINDOW_STACK_OFFSET;
      const maxLeft = Math.max(0, areaWidth - currentWidth);
      const maxTop = Math.max(0, areaHeight - currentHeight);
      const left = Math.min(Math.max(0, proposedLeft), maxLeft);
      const top = Math.min(Math.max(0, proposedTop), maxTop);

      const duplicateElement = openWindow(file, {
        left,
        top,
        width: currentWidth,
        height: currentHeight,
        page: currentPage,
        zoom: currentZoom,
        rotation: currentRotation,
        totalPages,
        pinned: isPinned(),
        notes: notesContent,
        title: windowTitle,
        pageHistory: pageHistory.slice(),
        pageHistoryIndex,
        color: windowColor,
        restoreLeft: currentLeft,
        restoreTop: currentTop,
        restoreWidth: currentWidth,
        restoreHeight: currentHeight,
        maximized: false,
      });

      if (!duplicateElement) {
        return;
      }

      const duplicateEvent = new CustomEvent(WINDOW_DUPLICATE_EVENT, {
        bubbles: true,
        detail: {
          file,
          page: currentPage,
          zoom: currentZoom,
          rotation: currentRotation,
          totalPages,
          sourceId: windowId,
          duplicateId: duplicateElement.dataset?.windowId,
          notes: notesContent,
          title: windowTitle,
          color: windowColor,
          maximized: isMaximized,
        },
      });

      windowElement.dispatchEvent(duplicateEvent);
    });

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'workspace__window-close';
    closeButton.textContent = '閉じる';
    closeButton.addEventListener('click', () => {
      disposeWindow();
    });

    controls.append(
      renameButton,
      colorButton,
      pinButton,
      maximizeButton,
      duplicateButton,
      closeButton,
    );
    header.append(titleGroup, controls);

    const body = document.createElement('div');
    body.className = 'workspace__window-body';

    const toolbar = document.createElement('div');
    toolbar.className = 'workspace__window-toolbar';

    const notesSection = document.createElement('section');
    notesSection.className = 'workspace__window-notes';

    const notesHeader = document.createElement('div');
    notesHeader.className = 'workspace__window-notes-header';

    const notesInputId = `workspace-window-notes-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    const notesLabel = document.createElement('label');
    notesLabel.className = 'workspace__window-notes-label';
    notesLabel.setAttribute('for', notesInputId);
    notesLabel.textContent = 'メモ';

    notesCounter = document.createElement('span');
    notesCounter.className = 'workspace__window-notes-counter';

    notesTextarea = document.createElement('textarea');
    notesTextarea.className = 'workspace__window-notes-input';
    notesTextarea.id = notesInputId;
    notesTextarea.rows = 4;
    notesTextarea.placeholder = 'シーンの補足やアドリブ案をメモできます。';
    notesTextarea.value = notesContent;
    notesTextarea.addEventListener('focus', () => {
      bringToFront();
    });
    notesTextarea.addEventListener('input', () => {
      const nextContent = notesTextarea?.value ?? '';

      if (nextContent === notesContent) {
        return;
      }

      notesContent = nextContent;
      syncNotesDisplay();
      const notesEvent = new CustomEvent(WINDOW_NOTES_CHANGE_EVENT, {
        bubbles: true,
        detail: { file, notes: notesContent },
      });
      windowElement.dispatchEvent(notesEvent);
      schedulePersist();
    });

    notesHeader.append(notesLabel, notesCounter);
    notesSection.append(notesHeader, notesTextarea);

    const pageForm = document.createElement('form');
    pageForm.className = 'workspace__window-page';

    const requestPageChange = () => {
      if (!pageInput) {
        return;
      }

      const sanitized = sanitizePageValue(pageInput.value);

      if (sanitized === null) {
        syncNavigationState();
        return;
      }

      commitPageChange(sanitized);
    };

    pageForm.addEventListener('submit', (event) => {
      event.preventDefault();
      requestPageChange();
    });

    const pageInputId = `workspace-window-page-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    const pageLabel = document.createElement('label');
    pageLabel.className = 'workspace__window-page-label';
    pageLabel.setAttribute('for', pageInputId);
    pageLabel.textContent = 'ページ';

    pageInput = document.createElement('input');
    pageInput.type = 'number';
    pageInput.inputMode = 'numeric';
    pageInput.pattern = '[0-9]*';
    pageInput.min = '1';
    pageInput.id = pageInputId;
    pageInput.className = 'workspace__window-page-input';
    pageInput.value = String(currentPage);
    pageInput.addEventListener('change', requestPageChange);
    pageInput.addEventListener('blur', syncNavigationState);
    pageInput.addEventListener('focus', () => {
      bringToFront();
      pageInput?.select();
    });

    firstPageButton = document.createElement('button');
    firstPageButton.type = 'button';
    firstPageButton.className = 'workspace__window-nav workspace__window-nav--first';
    firstPageButton.textContent = '⏮';
    firstPageButton.addEventListener('click', () => {
      goToFirstPage();
    });

    historyBackButton = document.createElement('button');
    historyBackButton.type = 'button';
    historyBackButton.className = 'workspace__window-nav workspace__window-nav--history-back';
    historyBackButton.textContent = '戻';
    historyBackButton.addEventListener('click', () => {
      navigateHistory(-1);
    });

    prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'workspace__window-nav workspace__window-nav--previous';
    prevButton.textContent = '−';
    prevButton.addEventListener('click', () => {
      stepPage(-1);
    });

    nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'workspace__window-nav workspace__window-nav--next';
    nextButton.textContent = '+';
    nextButton.addEventListener('click', () => {
      stepPage(1);
    });

    historyForwardButton = document.createElement('button');
    historyForwardButton.type = 'button';
    historyForwardButton.className = 'workspace__window-nav workspace__window-nav--history-forward';
    historyForwardButton.textContent = '進';
    historyForwardButton.addEventListener('click', () => {
      navigateHistory(1);
    });

    lastPageButton = document.createElement('button');
    lastPageButton.type = 'button';
    lastPageButton.className = 'workspace__window-nav workspace__window-nav--last';
    lastPageButton.textContent = '⏭';
    lastPageButton.addEventListener('click', () => {
      goToLastPage();
    });

    pageForm.append(pageLabel, pageInput);

    const rotationGroup = document.createElement('div');
    rotationGroup.className = 'workspace__window-rotation';

    rotateLeftButton = document.createElement('button');
    rotateLeftButton.type = 'button';
    rotateLeftButton.className =
      'workspace__window-rotation-control workspace__window-rotation-control--left';
    rotateLeftButton.textContent = '↺';
    rotateLeftButton.addEventListener('click', () => {
      stepRotation(-1);
    });

    rotationDisplay = document.createElement('span');
    rotationDisplay.className = 'workspace__window-rotation-display';
    rotationDisplay.setAttribute('aria-live', 'polite');

    rotateRightButton = document.createElement('button');
    rotateRightButton.type = 'button';
    rotateRightButton.className =
      'workspace__window-rotation-control workspace__window-rotation-control--right';
    rotateRightButton.textContent = '↻';
    rotateRightButton.addEventListener('click', () => {
      stepRotation(1);
    });

    rotateResetButton = document.createElement('button');
    rotateResetButton.type = 'button';
    rotateResetButton.className = 'workspace__window-rotation-reset';
    rotateResetButton.textContent = '0°';
    rotateResetButton.addEventListener('click', () => {
      resetRotation();
    });

    rotationGroup.append(
      rotateLeftButton,
      rotationDisplay,
      rotateRightButton,
      rotateResetButton,
    );

    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'workspace__window-zoom';

    zoomOutButton = document.createElement('button');
    zoomOutButton.type = 'button';
    zoomOutButton.className = 'workspace__window-zoom-control workspace__window-zoom-control--out';
    zoomOutButton.textContent = '縮小';
    zoomOutButton.addEventListener('click', () => {
      stepZoom(-WINDOW_ZOOM_STEP);
    });

    zoomDisplay = document.createElement('span');
    zoomDisplay.className = 'workspace__window-zoom-display';
    zoomDisplay.setAttribute('aria-live', 'polite');

    zoomInButton = document.createElement('button');
    zoomInButton.type = 'button';
    zoomInButton.className = 'workspace__window-zoom-control workspace__window-zoom-control--in';
    zoomInButton.textContent = '拡大';
    zoomInButton.addEventListener('click', () => {
      stepZoom(WINDOW_ZOOM_STEP);
    });

    zoomResetButton = document.createElement('button');
    zoomResetButton.type = 'button';
    zoomResetButton.className = 'workspace__window-zoom-reset';
    zoomResetButton.textContent = '100%';
    zoomResetButton.addEventListener('click', () => {
      resetZoom();
    });

    zoomFitWidthButton = document.createElement('button');
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

    zoomFitPageButton = document.createElement('button');
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
      nextButton,
      historyForwardButton,
      lastPageButton,
      adjustmentsGroup,
    );

    body.append(toolbar, viewer.element, notesSection);

    syncNavigationState();
    syncZoomState();
    syncNotesDisplay();
    updateViewerState();

    void viewer
      .load()
      .then((documentInstance) => {
        if (documentInstance && Number.isFinite(documentInstance.numPages)) {
          totalPages = documentInstance.numPages;
        }

        clampHistoryToBounds();
        currentPage = clampPage(currentPage);
        syncNavigationState();
        updateViewerState();
        schedulePersist();
        return renderCurrentPage();
      })
      .catch(() => {});

    windowElement.append(header, body);

    const handleMouseDown = (event) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('.workspace__window-title-input') ||
          event.target.closest('.workspace__window-rename'))
      ) {
        return;
      }

      if (editingTitle) {
        return;
      }

      bringToFront();

      if (isMaximized) {
        return;
      }

      event.preventDefault();

      const startX = event.clientX;
      const startY = event.clientY;
      const initialLeftPosition = parsePixels(windowElement.style.left, initialLeft);
      const initialTopPosition = parsePixels(windowElement.style.top, initialTop);

      const handleMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const { left, top } = clampPosition(
          initialLeftPosition + deltaX,
          initialTopPosition + deltaY,
        );
        windowElement.style.left = `${left}px`;
        windowElement.style.top = `${top}px`;
      };

      const handleMouseUp = () => {
        schedulePersist();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    header.addEventListener('mousedown', handleMouseDown);
    windowElement.addEventListener('focus', () => {
      bringToFront();
    });
    windowElement.addEventListener('mousedown', (event) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('button') ||
          event.target.closest('.workspace__window-title-input'))
      ) {
        return;
      }

      if (editingTitle) {
        return;
      }

      bringToFront();
      windowElement.focus({ preventScroll: true });
    });

    windowElement.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, button')
      ) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

      if (!hasModifier && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        stepZoom(WINDOW_ZOOM_STEP);
        return;
      }

      if (!hasModifier && (event.key === '-' || event.key === '_')) {
        event.preventDefault();
        stepZoom(-WINDOW_ZOOM_STEP);
        return;
      }

      if (!hasModifier && event.key === '0') {
        event.preventDefault();
        resetZoom();
        return;
      }

      if (!hasModifier && event.key === 'End') {
        event.preventDefault();
        goToLastPage();
        return;
      }

      if (!hasModifier && event.key === 'Home') {
        event.preventDefault();
        goToFirstPage();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepPage(1);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepPage(-1);
      }
    });

    resizeHandle = document.createElement('button');
    resizeHandle.type = 'button';
    resizeHandle.className = 'workspace__window-resize';

    const handleResizeStart = (event) => {
      event.preventDefault();
      bringToFront();

      if (isMaximized) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;
      const initialWidthValue = parsePixels(windowElement.style.width, initialWidth);
      const initialHeightValue = parsePixels(windowElement.style.height, initialHeight);

      windowElement.classList.add('workspace__window--resizing');

      const handleResizeMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const { width: areaWidth, height: areaHeight } = getAreaSize();
        const currentLeft = parsePixels(windowElement.style.left, initialLeft);
        const currentTop = parsePixels(windowElement.style.top, initialTop);
        const availableWidth = Math.max(
          MIN_WINDOW_WIDTH,
          areaWidth - currentLeft,
        );
        const availableHeight = Math.max(
          MIN_WINDOW_HEIGHT,
          areaHeight - currentTop,
        );

        const proposedWidth = Math.max(MIN_WINDOW_WIDTH, initialWidthValue + deltaX);
        const proposedHeight = Math.max(MIN_WINDOW_HEIGHT, initialHeightValue + deltaY);

        const nextWidth = Math.min(availableWidth, proposedWidth);
        const nextHeight = Math.min(availableHeight, proposedHeight);

        windowElement.style.width = `${nextWidth}px`;
        windowElement.style.height = `${nextHeight}px`;
        const { left, top } = clampPosition(currentLeft, currentTop);
        windowElement.style.left = `${left}px`;
        windowElement.style.top = `${top}px`;
      };

      const handleResizeEnd = () => {
        windowElement.classList.remove('workspace__window--resizing');
        schedulePersist();
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };

      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    };

    resizeHandle.addEventListener('mousedown', handleResizeStart);

    windowElement.append(resizeHandle);

    if (isMaximized) {
      const { width: areaWidth, height: areaHeight } = getAreaSize();
      applyBounds({ left: 0, top: 0, width: areaWidth, height: areaHeight });
    } else {
      refreshRestoreBounds();
    }

    syncMaximizeState();
    syncWindowColorDisplay();
    syncWindowTitleDisplay();

    if (options.pinned === true) {
      updatePinVisualState(true);
    }

    area.append(windowElement);
    windowRegistry.set(windowId, {
      element: windowElement,
      bringToFront,
      dispose: disposeWindow,
      getLastFocused: () => lastFocusedAt,
      getOpenedAt: () => openedAt,
      getTitle: () => windowTitle,
      id: windowId,
    });

    if (shouldAutoFocus) {
      bringToFront();
      windowElement.focus({ preventScroll: true });
    } else {
      assignZIndex();
    }

    syncEmptyState();
    schedulePersist({ includeFile: !hasStoredFile });

    return windowElement;
  };

  const getWindowEntries = () => {
    return Array.from(windowRegistry.entries())
      .map(([id, entry]) => ({
        id,
        element: entry?.element,
        bringToFront: entry?.bringToFront,
        lastFocusedAt: entry?.getLastFocused ? entry.getLastFocused() : undefined,
        openedAt: entry?.getOpenedAt ? entry.getOpenedAt() : undefined,
        title: entry?.getTitle ? entry.getTitle() : undefined,
      }))
      .filter((entry) => entry.element instanceof HTMLElement)
      .sort((a, b) => {
        const aOrder = Number.isFinite(a.lastFocusedAt)
          ? a.lastFocusedAt
          : Number.isFinite(a.openedAt)
            ? a.openedAt
            : 0;
        const bOrder = Number.isFinite(b.lastFocusedAt)
          ? b.lastFocusedAt
          : Number.isFinite(b.openedAt)
            ? b.openedAt
            : 0;

        return bOrder - aOrder;
      });
  };

  const focusWindow = (id, { persistFocus = true } = {}) => {
    const entry = windowRegistry.get(id);

    if (!entry) {
      return null;
    }

    entry.bringToFront({ persistFocus });
    entry.element.focus({ preventScroll: true });
    return entry.element;
  };

  const cycleFocus = (direction = 'next') => {
    const entries = getWindowEntries();

    if (entries.length <= 1) {
      return null;
    }

    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement.closest('.workspace__window')
      : null;
    let currentIndex = entries.findIndex((entry) => entry.element === activeElement);

    if (currentIndex < 0) {
      const activeClassIndex = entries.findIndex((entry) =>
        entry.element.classList.contains('workspace__window--active'),
      );
      currentIndex = activeClassIndex >= 0 ? activeClassIndex : 0;
    }
    const offset = direction === 'previous' ? -1 : 1;
    const nextIndex = (currentIndex + offset + entries.length) % entries.length;
    const target = entries[nextIndex];

    if (!target || typeof target.bringToFront !== 'function') {
      return null;
    }

    target.bringToFront();
    target.element.focus({ preventScroll: true });

    const cycleEvent = new CustomEvent(WINDOW_FOCUS_CYCLE_EVENT, {
      bubbles: true,
      detail: {
        direction: direction === 'previous' ? 'previous' : 'next',
        windowId: target.id,
        title: typeof target.title === 'string' ? target.title : undefined,
        totalWindows: entries.length,
      },
    });

    target.element.dispatchEvent(cycleEvent);
    return target.element;
  };

  const closeAllWindows = ({ emitClose = true } = {}) => {
    const entries = Array.from(windowRegistry.values());

    entries.forEach((entry) => {
      if (entry && typeof entry.dispose === 'function') {
        entry.dispose({ persistRemoval: false, emitClose });
      }
    });

    return entries.length;
  };

  const getWindowCount = () => windowRegistry.size;

  section.append(heading, emptyState, area);

  return {
    element: section,
    openWindow,
    focusWindow,
    cycleFocus,
    closeAllWindows,
    getWindowCount,
  };
}


export function createWorkspace() {
  const workspace = document.createElement('div');
  workspace.className = 'workspace';
  workspace.dataset.role = 'workspace';

  const queue = createFileQueue();
  const canvas = createWindowCanvas();
  const maintenance = createMaintenancePanel({
    onClear: async () => {
      await clearWorkspaceWindows();
      const windowsCleared = canvas.closeAllWindows();
      queue.clear();

      const cleared = new CustomEvent(WORKSPACE_CACHE_CLEARED_EVENT, {
        bubbles: true,
        detail: { windowsCleared },
      });

      workspace.dispatchEvent(cleared);

      return { windowsCleared };
    },
  });

  workspace.addEventListener('workspace:file-selected', (event) => {
    const files = event.detail?.files;

    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    queue.renderFiles(files);
  });

  workspace.addEventListener('workspace:file-open-request', (event) => {
    const file = event.detail?.file;

    if (!(file instanceof File)) {
      return;
    }

    canvas.openWindow(file);
  });

  void (async () => {
    try {
      const storedWindows = await loadWorkspaceWindows();

      if (!Array.isArray(storedWindows) || storedWindows.length === 0) {
        return;
      }

      const sorted = storedWindows
        .filter((entry) => entry && entry.file)
        .sort((a, b) => {
          const aOrder = Number.isFinite(a.lastFocusedAt)
            ? a.lastFocusedAt
            : Number.isFinite(a.openedAt)
              ? a.openedAt
              : 0;
          const bOrder = Number.isFinite(b.lastFocusedAt)
            ? b.lastFocusedAt
            : Number.isFinite(b.openedAt)
              ? b.openedAt
              : 0;
          return aOrder - bOrder;
        });

      let lastFocusedId = null;
      let lastFocusedTime = Number.NEGATIVE_INFINITY;

      sorted.forEach((entry) => {
        const { file, ...state } = entry;

        if (!file) {
          return;
        }

        const element = canvas.openWindow(file, {
          ...state,
          autoFocus: false,
        });

        if (element && typeof element.dataset?.windowId === 'string') {
          const focusTimestamp = Number.isFinite(state.lastFocusedAt)
            ? state.lastFocusedAt
            : Number.isFinite(state.openedAt)
              ? state.openedAt
              : 0;

          if (focusTimestamp >= lastFocusedTime) {
            lastFocusedTime = focusTimestamp;
            lastFocusedId = element.dataset.windowId;
          }
        }
      });

      if (lastFocusedId) {
        canvas.focusWindow(lastFocusedId, { persistFocus: false });
      }
    } catch (error) {
      // Persistence is best-effort; ignore restoration issues to keep the UI responsive.
    }
  })();

  workspace.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) {
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input, textarea, [contenteditable="true"]')
    ) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const isNextKey = event.key === ']' || event.code === 'BracketRight';
    const isPreviousKey = event.key === '[' || event.code === 'BracketLeft';

    if (isNextKey) {
      const cycled = canvas.cycleFocus('next');

      if (cycled) {
        event.preventDefault();
      }

      return;
    }

    if (isPreviousKey) {
      const cycled = canvas.cycleFocus('previous');

      if (cycled) {
        event.preventDefault();
      }
    }
  });

  workspace.append(
    createHeader(),
    createDropZone(),
    queue.element,
    canvas.element,
    maintenance.element,
    createHint(),
  );
  return workspace;
}
