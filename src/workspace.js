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
const DEFAULT_WINDOW_ZOOM = 1;
const MIN_WINDOW_ZOOM = 0.5;
const MAX_WINDOW_ZOOM = 2;
const WINDOW_ZOOM_STEP = 0.1;
const PAGE_HISTORY_LIMIT = 50;
const WORKSPACE_CACHE_CLEARED_EVENT = 'workspace:cache-cleared';

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
    const windowElement = document.createElement('article');
    windowElement.className = 'workspace__window';
    windowElement.setAttribute('role', 'group');
    windowElement.tabIndex = 0;

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
    let prevButton;
    let nextButton;
    let historyBackButton;
    let historyForwardButton;
    let zoomOutButton;
    let zoomInButton;
    let zoomResetButton;
    let zoomDisplay;
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
    const defaultTitle = file.name;
    let windowTitle =
      typeof options.title === 'string' && options.title.trim().length > 0
        ? options.title.trim()
        : defaultTitle;
    let titleInput;
    let renameButton;
    let editingTitle = false;

    const viewer = createPdfViewer(file);
    let disposed = false;

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

    const getWindowSize = () => ({
      width: parsePixels(windowElement.style.width, DEFAULT_WINDOW_WIDTH),
      height: parsePixels(windowElement.style.height, DEFAULT_WINDOW_HEIGHT),
    });

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
        totalPages: Number.isFinite(totalPages) ? totalPages : undefined,
        pinned: windowElement.classList.contains('workspace__window--pinned'),
        openedAt,
        lastFocusedAt,
        title: windowTitle,
        notes: notesContent,
        pageHistory: pageHistory.slice(),
        pageHistoryIndex,
      };

      if (includeFile) {
        descriptor.file = file;
      }

      await persistWorkspaceWindow(descriptor, { includeFile });
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

    const updateViewerState = () => {
      viewer.updateState({ page: currentPage, zoom: currentZoom, totalPages });
    };

    const renderCurrentPage = async () => {
      try {
        await viewer.render({ page: currentPage, zoom: currentZoom });
      } catch (error) {
        // Rendering errors are surfaced via viewer status; suppress console noise in tests.
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

    const commitZoomChange = (zoom) => {
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

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'workspace__window-duplicate';
    duplicateButton.textContent = '複製';
    duplicateButton.setAttribute('aria-label', `${windowTitle} を別ウィンドウで複製`);
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

      if (prevButton) {
        prevButton.setAttribute('aria-label', `${windowTitle} の前のページへ移動`);
      }

      if (nextButton) {
        nextButton.setAttribute('aria-label', `${windowTitle} の次のページへ移動`);
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

      if (resizeHandle) {
        resizeHandle.setAttribute('aria-label', `${windowTitle} のウィンドウサイズを変更`);
      }
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
      const currentLeft = parsePixels(windowElement.style.left, initialLeft);
      const currentTop = parsePixels(windowElement.style.top, initialTop);
      const currentWidth = parsePixels(windowElement.style.width, initialWidth);
      const currentHeight = parsePixels(windowElement.style.height, initialHeight);
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
        totalPages,
        pinned: isPinned(),
        notes: notesContent,
        title: windowTitle,
        pageHistory: pageHistory.slice(),
        pageHistoryIndex,
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
          totalPages,
          sourceId: windowId,
          duplicateId: duplicateElement.dataset?.windowId,
          notes: notesContent,
          title: windowTitle,
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

    controls.append(renameButton, pinButton, duplicateButton, closeButton);
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

    pageForm.append(pageLabel, pageInput);

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

    zoomGroup.append(zoomOutButton, zoomDisplay, zoomInButton, zoomResetButton);

    toolbar.append(
      historyBackButton,
      prevButton,
      pageForm,
      nextButton,
      historyForwardButton,
      zoomGroup,
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

    syncWindowTitleDisplay();

    if (options.pinned === true) {
      updatePinVisualState(true);
    }

    windowElement.append(resizeHandle);
    area.append(windowElement);
    windowRegistry.set(windowId, { element: windowElement, bringToFront, dispose: disposeWindow });

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

  const focusWindow = (id, { persistFocus = true } = {}) => {
    const entry = windowRegistry.get(id);

    if (!entry) {
      return null;
    }

    entry.bringToFront({ persistFocus });
    entry.element.focus({ preventScroll: true });
    return entry.element;
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
