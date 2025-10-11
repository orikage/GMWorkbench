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
const DEFAULT_WINDOW_ZOOM = 1;
const MIN_WINDOW_ZOOM = 0.5;
const MAX_WINDOW_ZOOM = 2;
const WINDOW_ZOOM_STEP = 0.1;

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

  return {
    element: section,
    renderFiles,
  };
}

function createHint() {
  const hint = document.createElement('p');
  hint.className = 'workspace__hint';
  hint.textContent = '初期バージョンではワークスペースの骨格を整え、操作フローを言語化しています。';
  return hint;
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

  const syncEmptyState = () => {
    emptyState.hidden = area.children.length > 0;
  };

  syncEmptyState();

  let zIndexCounter = 1;
  let pinnedZIndexCounter = 10000;

  const openWindow = (file) => {
    const windowElement = document.createElement('article');
    windowElement.className = 'workspace__window';
    windowElement.setAttribute('role', 'group');
    windowElement.setAttribute('aria-label', `${file.name} のウィンドウ`);
    windowElement.tabIndex = 0;

    const offset = area.children.length * WINDOW_STACK_OFFSET;
    windowElement.style.left = `${offset}px`;
    windowElement.style.top = `${offset}px`;
    windowElement.style.width = `${DEFAULT_WINDOW_WIDTH}px`;
    windowElement.style.height = `${DEFAULT_WINDOW_HEIGHT}px`;

    const header = document.createElement('header');
    header.className = 'workspace__window-header';

    const title = document.createElement('h3');
    title.className = 'workspace__window-title';
    title.textContent = file.name;

    const controls = document.createElement('div');
    controls.className = 'workspace__window-controls';

    let currentPage = 1;
    let pageInput;
    let prevButton;
    let nextButton;
    let zoomOutButton;
    let zoomInButton;
    let zoomResetButton;
    let zoomDisplay;
    let currentZoom = DEFAULT_WINDOW_ZOOM;

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

      if (parsed < 1) {
        return 1;
      }

      return parsed;
    };

    const syncNavigationState = () => {
      if (pageInput) {
        pageInput.value = String(currentPage);
      }

      if (prevButton) {
        prevButton.disabled = currentPage <= 1;
      }
    };

    const isDefaultZoom = () => Math.abs(currentZoom - DEFAULT_WINDOW_ZOOM) < 0.001;

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

    const commitPageChange = (page) => {
      currentPage = page;
      syncNavigationState();
      bringToFront();
      const pageChange = new CustomEvent(WINDOW_PAGE_CHANGE_EVENT, {
        bubbles: true,
        detail: { file, page: currentPage },
      });
      windowElement.dispatchEvent(pageChange);
    };

    const stepPage = (offset) => {
      const nextPage = currentPage + offset;

      if (nextPage < 1) {
        syncNavigationState();
        return;
      }

      commitPageChange(nextPage);
    };

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

    const commitZoomChange = (zoom) => {
      const nextZoom = clampZoom(zoom);

      if (Math.abs(nextZoom - currentZoom) < 0.0001) {
        syncZoomState();
        return;
      }

      currentZoom = nextZoom;
      syncZoomState();
      bringToFront();
      const zoomChange = new CustomEvent(WINDOW_ZOOM_CHANGE_EVENT, {
        bubbles: true,
        detail: { file, zoom: currentZoom },
      });
      windowElement.dispatchEvent(zoomChange);
    };

    const stepZoom = (delta) => {
      commitZoomChange(currentZoom + delta);
    };

    const resetZoom = () => {
      commitZoomChange(DEFAULT_WINDOW_ZOOM);
    };

    const isPinned = () => windowElement.classList.contains('workspace__window--pinned');

    const assignZIndex = () => {
      if (isPinned()) {
        windowElement.style.zIndex = String(pinnedZIndexCounter);
        pinnedZIndexCounter += 1;
      } else {
        windowElement.style.zIndex = String(zIndexCounter);
        zIndexCounter += 1;
      }
    };

    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'workspace__window-pin';
    pinButton.textContent = 'ピン留め';
    pinButton.setAttribute('aria-pressed', 'false');
    pinButton.setAttribute('aria-label', `${file.name} を前面に固定`);

    const updatePinVisualState = (pinned) => {
      windowElement.classList.toggle('workspace__window--pinned', pinned);
      pinButton.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      pinButton.textContent = pinned ? 'ピン解除' : 'ピン留め';
    };

    const bringToFront = () => {
      area.querySelectorAll('.workspace__window').forEach((otherWindow) => {
        if (otherWindow !== windowElement) {
          otherWindow.classList.remove('workspace__window--active');
        }
      });
      windowElement.classList.add('workspace__window--active');
      assignZIndex();
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
    });

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'workspace__window-close';
    closeButton.textContent = '閉じる';
    closeButton.addEventListener('click', () => {
      const closure = new CustomEvent(WINDOW_CLOSE_EVENT, {
        bubbles: true,
        detail: { file },
      });
      windowElement.dispatchEvent(closure);
      windowElement.remove();
      syncEmptyState();
    });

    controls.append(pinButton, closeButton);
    header.append(title, controls);

    const body = document.createElement('div');
    body.className = 'workspace__window-body';

    const toolbar = document.createElement('div');
    toolbar.className = 'workspace__window-toolbar';

    const pageForm = document.createElement('form');
    pageForm.className = 'workspace__window-page';
    pageForm.setAttribute('aria-label', `${file.name} の表示ページを設定`);

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
    pageInput.setAttribute('aria-label', `${file.name} の表示ページ番号`);
    pageInput.addEventListener('change', requestPageChange);
    pageInput.addEventListener('blur', syncNavigationState);
    pageInput.addEventListener('focus', () => {
      bringToFront();
      pageInput?.select();
    });

    prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'workspace__window-nav workspace__window-nav--previous';
    prevButton.textContent = '−';
    prevButton.setAttribute('aria-label', `${file.name} の前のページへ移動`);
    prevButton.addEventListener('click', () => {
      stepPage(-1);
    });

    nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'workspace__window-nav workspace__window-nav--next';
    nextButton.textContent = '+';
    nextButton.setAttribute('aria-label', `${file.name} の次のページへ移動`);
    nextButton.addEventListener('click', () => {
      stepPage(1);
    });

    pageForm.append(pageLabel, pageInput);

    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'workspace__window-zoom';

    zoomOutButton = document.createElement('button');
    zoomOutButton.type = 'button';
    zoomOutButton.className = 'workspace__window-zoom-control workspace__window-zoom-control--out';
    zoomOutButton.textContent = '縮小';
    zoomOutButton.setAttribute('aria-label', `${file.name} を縮小表示`);
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
    zoomInButton.setAttribute('aria-label', `${file.name} を拡大表示`);
    zoomInButton.addEventListener('click', () => {
      stepZoom(WINDOW_ZOOM_STEP);
    });

    zoomResetButton = document.createElement('button');
    zoomResetButton.type = 'button';
    zoomResetButton.className = 'workspace__window-zoom-reset';
    zoomResetButton.textContent = '100%';
    zoomResetButton.setAttribute('aria-label', `${file.name} の表示倍率をリセット`);
    zoomResetButton.addEventListener('click', () => {
      resetZoom();
    });

    zoomGroup.append(zoomOutButton, zoomDisplay, zoomInButton, zoomResetButton);

    toolbar.append(prevButton, pageForm, nextButton, zoomGroup);

    const placeholder = document.createElement('p');
    placeholder.className = 'workspace__window-placeholder';
    placeholder.textContent = 'PDFビューアは近日追加予定です。';

    body.append(toolbar, placeholder);

    syncNavigationState();
    syncZoomState();
    windowElement.append(header, body);

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

    const handleMouseDown = (event) => {
      bringToFront();
      event.preventDefault();

      const startX = event.clientX;
      const startY = event.clientY;
      const initialLeft = parsePixels(windowElement.style.left, 0);
      const initialTop = parsePixels(windowElement.style.top, 0);

      const handleMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const { left, top } = clampPosition(initialLeft + deltaX, initialTop + deltaY);
        windowElement.style.left = `${left}px`;
        windowElement.style.top = `${top}px`;
      };

      const handleMouseUp = () => {
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
      if (event.target instanceof HTMLElement && event.target.closest('button')) {
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

    const resizeHandle = document.createElement('button');
    resizeHandle.type = 'button';
    resizeHandle.className = 'workspace__window-resize';
    resizeHandle.setAttribute('aria-label', `${file.name} のウィンドウサイズを変更`);

    const handleResizeStart = (event) => {
      event.preventDefault();
      bringToFront();

      const startX = event.clientX;
      const startY = event.clientY;
      const initialWidth = parsePixels(
        windowElement.style.width,
        DEFAULT_WINDOW_WIDTH,
      );
      const initialHeight = parsePixels(
        windowElement.style.height,
        DEFAULT_WINDOW_HEIGHT,
      );

      windowElement.classList.add('workspace__window--resizing');

      const handleResizeMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const { width: areaWidth, height: areaHeight } = getAreaSize();
        const currentLeft = parsePixels(windowElement.style.left, 0);
        const currentTop = parsePixels(windowElement.style.top, 0);
        const availableWidth = Math.max(
          MIN_WINDOW_WIDTH,
          areaWidth - currentLeft,
        );
        const availableHeight = Math.max(
          MIN_WINDOW_HEIGHT,
          areaHeight - currentTop,
        );

        const proposedWidth = Math.max(MIN_WINDOW_WIDTH, initialWidth + deltaX);
        const proposedHeight = Math.max(MIN_WINDOW_HEIGHT, initialHeight + deltaY);

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
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };

      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    };

    resizeHandle.addEventListener('mousedown', handleResizeStart);

    windowElement.append(resizeHandle);
    area.append(windowElement);
    bringToFront();
    windowElement.focus({ preventScroll: true });
    syncEmptyState();

    return windowElement;
  };

  section.append(heading, emptyState, area);

  return {
    element: section,
    openWindow,
  };
}

export function createWorkspace() {
  const workspace = document.createElement('div');
  workspace.className = 'workspace';
  workspace.dataset.role = 'workspace';

  const queue = createFileQueue();
  const canvas = createWindowCanvas();

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

  workspace.append(
    createHeader(),
    createDropZone(),
    queue.element,
    canvas.element,
    createHint(),
  );
  return workspace;
}
