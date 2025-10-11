import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMocks = vi.hoisted(() => {
  const state = { numPages: 4 };
  const renderMock = vi.fn();
  const getPageMock = vi.fn();
  const destroyMock = vi.fn();
  const getDocumentMock = vi.fn();

  return {
    state,
    renderMock,
    getPageMock,
    destroyMock,
    getDocumentMock,
  };
});

const storageMocks = vi.hoisted(() => {
  const load = vi.fn();
  const persist = vi.fn();
  const remove = vi.fn();
  const clear = vi.fn();

  return {
    load,
    persist,
    remove,
    clear,
  };
});

vi.mock('pdfjs-dist', () => ({
  getDocument: pdfMocks.getDocumentMock,
  GlobalWorkerOptions: { workerSrc: '' },
}));

vi.mock(
  'pdfjs-dist/build/pdf.worker.min.mjs?url',
  () => ({
    default: 'worker-url',
  }),
  { virtual: true },
);

vi.mock('./workspace-storage.js', () => ({
  loadWorkspaceWindows: storageMocks.load,
  persistWorkspaceWindow: storageMocks.persist,
  removeWorkspaceWindow: storageMocks.remove,
  clearWorkspaceWindows: storageMocks.clear,
}));

import { createWorkspace } from './workspace.js';

const originalGetContext = HTMLCanvasElement.prototype.getContext;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const openWindow = async (workspace, file, options = {}) => {
  if (options.totalPages) {
    pdfMocks.state.numPages = options.totalPages;
  }

  workspace.dispatchEvent(
    new CustomEvent('workspace:file-open-request', {
      bubbles: true,
      detail: { file },
    }),
  );

  await flushPromises();
  await flushPromises();

  let attempts = 0;
  while (pdfMocks.getPageMock.mock.calls.length === 0 && attempts < 8) {
    await flushPromises();
    attempts += 1;
  }
};

beforeEach(() => {
  pdfMocks.state.numPages = 4;
  pdfMocks.renderMock.mockReset();
  pdfMocks.getPageMock.mockReset();
  pdfMocks.getDocumentMock.mockReset();
  pdfMocks.destroyMock.mockReset();

  storageMocks.load.mockReset();
  storageMocks.persist.mockReset();
  storageMocks.remove.mockReset();
  storageMocks.clear.mockReset();

  storageMocks.load.mockResolvedValue([]);
  storageMocks.persist.mockResolvedValue();
  storageMocks.remove.mockResolvedValue();
  storageMocks.clear.mockResolvedValue();

  pdfMocks.renderMock.mockImplementation(() => ({ promise: Promise.resolve() }));
  pdfMocks.getPageMock.mockImplementation(async () => ({
    getViewport: ({ scale }) => ({
      width: 600 * scale,
      height: 800 * scale,
    }),
    render: pdfMocks.renderMock,
  }));
  pdfMocks.getDocumentMock.mockImplementation(() => ({
    promise: Promise.resolve({
      numPages: pdfMocks.state.numPages,
      getPage: pdfMocks.getPageMock,
      destroy: pdfMocks.destroyMock,
    }),
  }));

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      setTransform: vi.fn(),
    })),
  });
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe('createWorkspace', () => {
  it('creates a workspace container with key sections', () => {
    const workspace = createWorkspace();

    expect(workspace).toBeInstanceOf(HTMLElement);
    expect(workspace.dataset.role).toBe('workspace');
    expect(workspace.querySelector('.workspace__header')).not.toBeNull();
    expect(workspace.querySelector('.workspace__drop-zone')).not.toBeNull();
    expect(workspace.querySelector('.workspace__button')?.textContent).toBe('PDFを開く');
    expect(workspace.querySelector('.workspace__file-input')).not.toBeNull();
    expect(workspace.querySelector('.workspace__queue')).not.toBeNull();
  });

  it('adds and removes the active state on drag interactions', () => {
    const workspace = createWorkspace();
    const dropZone = workspace.querySelector('.workspace__drop-zone');

    if (!dropZone) {
      throw new Error('drop zone element is required for the test');
    }

    dropZone.dispatchEvent(new Event('dragenter'));
    expect(dropZone.classList.contains('workspace__drop-zone--active')).toBe(true);

    dropZone.dispatchEvent(new Event('dragleave'));
    expect(dropZone.classList.contains('workspace__drop-zone--active')).toBe(false);
  });

  it('dispatches workspace:file-selected when files are dropped', () => {
    const workspace = createWorkspace();
    const dropZone = workspace.querySelector('.workspace__drop-zone');

    if (!dropZone) {
      throw new Error('drop zone element is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:file-selected', handler);

    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    const dropEvent = new Event('drop', { bubbles: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    });

    dropZone.dispatchEvent(dropEvent);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.files).toEqual([file]);
  });

  it('restores persisted windows with their saved layout and focus', async () => {
    const persistedFile = new File(['persisted'], 'stored.pdf', {
      type: 'application/pdf',
      lastModified: 123,
    });

    storageMocks.load.mockResolvedValue([
      {
        id: 'stored-window',
        file: persistedFile,
        page: 2,
        zoom: 1.25,
        left: 48,
        top: 64,
        width: 512,
        height: 420,
        pinned: true,
        totalPages: 6,
        openedAt: 10,
        lastFocusedAt: 20,
        persisted: true,
        notes: '復元メモ',
      },
    ]);

    const workspace = createWorkspace();

    await flushPromises();
    await flushPromises();

    expect(storageMocks.load).toHaveBeenCalledTimes(1);

    const windowElement = workspace.querySelector('.workspace__window');

    expect(windowElement).not.toBeNull();
    expect(windowElement?.classList.contains('workspace__window--pinned')).toBe(true);
    expect(windowElement?.style.left).toBe('48px');
    expect(windowElement?.style.top).toBe('64px');
    expect(windowElement?.style.width).toBe('512px');
    expect(windowElement?.style.height).toBe('420px');

    const pageInput = workspace.querySelector('.workspace__window-page-input');
    const zoomDisplay = workspace.querySelector('.workspace__window-zoom-display');
    const notesField = workspace.querySelector('.workspace__window-notes-input');
    const notesCounter = workspace.querySelector('.workspace__window-notes-counter');

    expect(pageInput?.value).toBe('2');
    expect(zoomDisplay?.textContent).toBe('125%');
    expect(notesField?.value).toBe('復元メモ');
    expect(notesCounter?.textContent).toBe(`${'復元メモ'.length}文字`);
    expect(windowElement?.dataset.notesLength).toBe(String('復元メモ'.length));

    const activeWindow = workspace.querySelector('.workspace__window--active');
    expect(activeWindow).toBe(windowElement);
  });

  it('lists selected files in the intake queue with metadata', () => {
    const workspace = createWorkspace();
    const queue = workspace.querySelector('.workspace__queue');

    if (!queue) {
      throw new Error('queue element is required for the test');
    }

    const emptyState = queue.querySelector('.workspace__queue-empty');
    const list = queue.querySelector('.workspace__queue-list');

    if (!emptyState || !list) {
      throw new Error('queue structure is incomplete');
    }

    expect(emptyState.hidden).toBe(false);
    expect(list.children.length).toBe(0);

    const file = new File(['dummy'], 'scenario.pdf', { type: 'application/pdf' });
    const filesSelected = new CustomEvent('workspace:file-selected', {
      bubbles: true,
      detail: { files: [file] },
    });

    queue.dispatchEvent(filesSelected);

    expect(emptyState.hidden).toBe(true);
    expect(list.children.length).toBe(1);
    const item = list.children[0];
    expect(item.querySelector('.workspace__queue-name')?.textContent).toBe('scenario.pdf');
    expect(item.querySelector('.workspace__queue-open')).not.toBeNull();
    expect(item.querySelector('.workspace__queue-remove')).not.toBeNull();
  });

  it('emits an open request when the queue action is activated', () => {
    const workspace = createWorkspace();
    const queue = workspace.querySelector('.workspace__queue');

    if (!queue) {
      throw new Error('queue element is required for the test');
    }

    const list = queue.querySelector('.workspace__queue-list');

    if (!list) {
      throw new Error('queue list is required for the test');
    }

    const file = new File(['dummy'], 'launch.pdf', { type: 'application/pdf' });
    const filesSelected = new CustomEvent('workspace:file-selected', {
      bubbles: true,
      detail: { files: [file] },
    });

    queue.dispatchEvent(filesSelected);

    const button = list.querySelector('.workspace__queue-open');

    if (!button) {
      throw new Error('queue open button is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:file-open-request', handler);

    button.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.file).toBe(file);
  });

  it('removes queue items and announces the removal', () => {
    const workspace = createWorkspace();
    const queue = workspace.querySelector('.workspace__queue');

    if (!queue) {
      throw new Error('queue element is required for the test');
    }

    const list = queue.querySelector('.workspace__queue-list');
    const emptyState = queue.querySelector('.workspace__queue-empty');

    if (!list || !emptyState) {
      throw new Error('queue structure is incomplete');
    }

    const file = new File(['dummy'], 'remove-me.pdf', { type: 'application/pdf' });
    const filesSelected = new CustomEvent('workspace:file-selected', {
      bubbles: true,
      detail: { files: [file] },
    });

    queue.dispatchEvent(filesSelected);

    const removeButton = list.querySelector('.workspace__queue-remove');

    if (!removeButton) {
      throw new Error('queue remove button is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:file-queue-remove', handler);

    removeButton.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.file).toBe(file);
    expect(list.children.length).toBe(0);
    expect(emptyState.hidden).toBe(false);
  });

  it('opens a window viewer when an open request is received', async () => {
    const workspace = createWorkspace();
    const canvas = workspace.querySelector('.workspace__canvas');

    if (!canvas) {
      throw new Error('canvas element is required for the test');
    }

    const emptyState = canvas.querySelector('.workspace__canvas-empty');

    if (!emptyState) {
      throw new Error('canvas empty state is required for the test');
    }

    expect(emptyState.hidden).toBe(false);

    const file = new File(['dummy'], 'window.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = canvas.querySelector('.workspace__window');
    expect(windowElement).not.toBeNull();
    expect(canvas.querySelector('.workspace__canvas-empty')?.hidden).toBe(true);
    expect(
      windowElement?.querySelector('.workspace__window-title')?.textContent,
    ).toBe('window.pdf');
    expect(
      windowElement?.querySelector('.workspace__window-viewer'),
    ).not.toBeNull();
  });

  it('updates the viewer metadata for page and zoom state', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'state.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 6 });

    const viewer = workspace.querySelector('.workspace__window-viewer');

    if (!(viewer instanceof HTMLElement)) {
      throw new Error('window viewer element is required for the test');
    }

    expect(viewer.dataset.page).toBe('1');
    expect(viewer.dataset.zoom).toBe('1');
    expect(viewer.dataset.totalPages).toBe('6');

    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (!(pageInput instanceof HTMLInputElement)) {
      throw new Error('page input is required for the test');
    }

    pageInput.value = '3';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));

    await flushPromises();

    expect(viewer.dataset.page).toBe('3');

    const zoomInButton = workspace.querySelector(
      '.workspace__window-zoom-control--in',
    );

    if (!(zoomInButton instanceof HTMLButtonElement)) {
      throw new Error('zoom in button is required for the test');
    }

    zoomInButton.dispatchEvent(new Event('click', { bubbles: true }));

    await flushPromises();

    expect(viewer.dataset.zoom).toBe('1.1');
  });

  it('stacks new windows with offsets and updates the active state', async () => {
    const workspace = createWorkspace();
    const canvas = workspace.querySelector('.workspace__canvas');

    if (!canvas) {
      throw new Error('canvas element is required for the test');
    }

    const firstFile = new File(['dummy'], 'first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['dummy'], 'second.pdf', { type: 'application/pdf' });

    await openWindow(workspace, firstFile);
    await openWindow(workspace, secondFile);

    const windows = canvas.querySelectorAll('.workspace__window');

    expect(windows).toHaveLength(2);
    expect(windows[0].style.left).toBe('0px');
    expect(windows[0].style.top).toBe('0px');
    expect(windows[1].style.left).toBe('24px');
    expect(windows[1].style.top).toBe('24px');
    expect(windows[0].classList.contains('workspace__window--active')).toBe(false);
    expect(windows[1].classList.contains('workspace__window--active')).toBe(true);
    expect(Number.parseInt(windows[1].style.zIndex ?? '0', 10)).toBeGreaterThan(
      Number.parseInt(windows[0].style.zIndex ?? '0', 10),
    );
  });

  it('allows dragging windows via the header to update position', async () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'drag.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const header = workspace.querySelector('.workspace__window-header');

    if (!windowElement || !header) {
      throw new Error('window structure is required for the test');
    }

    expect(windowElement.style.left).toBe('0px');
    expect(windowElement.style.top).toBe('0px');

    header.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 30,
        clientY: 30,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 70,
        clientY: 90,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
      }),
    );

    expect(windowElement.style.left).toBe('40px');
    expect(windowElement.style.top).toBe('60px');
  });

  it('keeps windows within the canvas bounds while dragging', async () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'bounded-drag.pdf', {
      type: 'application/pdf',
    });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const header = workspace.querySelector('.workspace__window-header');
    const area = workspace.querySelector('.workspace__windows');

    if (!windowElement || !header || !area) {
      throw new Error('window structure is required for the test');
    }

    area.getBoundingClientRect = () => ({
      width: 600,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    header.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 20,
        clientY: 20,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 1200,
        clientY: 800,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
      }),
    );

    expect(windowElement.style.left).toBe('180px');
    expect(windowElement.style.top).toBe('80px');
  });

  it('resizes windows via the resize handle while enforcing minimum bounds', async () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'resize.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const handle = workspace.querySelector('.workspace__window-resize');

    if (!windowElement || !handle) {
      throw new Error('window resize structure is required for the test');
    }

    const initialWidth = parseFloat(windowElement.style.width || '0');
    const initialHeight = parseFloat(windowElement.style.height || '0');

    handle.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 160,
        clientY: 180,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
      }),
    );

    const grownWidth = parseFloat(windowElement.style.width || '0');
    const grownHeight = parseFloat(windowElement.style.height || '0');

    expect(grownWidth).toBeGreaterThan(initialWidth);
    expect(grownHeight).toBeGreaterThan(initialHeight);
    expect(windowElement.classList.contains('workspace__window--resizing')).toBe(false);

    handle.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 200,
        clientY: 200,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 40,
        clientY: 40,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
      }),
    );

    const shrunkenWidth = parseFloat(windowElement.style.width || '0');
    const shrunkenHeight = parseFloat(windowElement.style.height || '0');

    expect(shrunkenWidth).toBeGreaterThanOrEqual(260);
    expect(shrunkenHeight).toBeGreaterThanOrEqual(220);
  });

  it('limits window resizing to stay within the canvas bounds', async () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'bounded-resize.pdf', {
      type: 'application/pdf',
    });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const handle = workspace.querySelector('.workspace__window-resize');
    const area = workspace.querySelector('.workspace__windows');

    if (!windowElement || !handle || !area) {
      throw new Error('window structure is required for the test');
    }

    area.getBoundingClientRect = () => ({
      width: 640,
      height: 420,
      top: 0,
      left: 0,
      bottom: 420,
      right: 640,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    handle.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 900,
        clientY: 900,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
      }),
    );

    expect(windowElement.style.width).toBe('640px');
    expect(windowElement.style.height).toBe('420px');
  });

  it('pins windows so they remain above other documents', async () => {
    const workspace = createWorkspace();

    const firstFile = new File(['dummy'], 'pin-first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['dummy'], 'pin-second.pdf', { type: 'application/pdf' });

    await openWindow(workspace, firstFile);
    await openWindow(workspace, secondFile);

    const windows = workspace.querySelectorAll('.workspace__window');
    const pinButton = workspace.querySelector('.workspace__window-pin');

    if (windows.length < 2 || !pinButton) {
      throw new Error('pinning structure is required for the test');
    }

    const toggleHandler = vi.fn();
    workspace.addEventListener('workspace:window-pin-toggle', toggleHandler);

    pinButton.click();

    expect(toggleHandler).toHaveBeenCalledTimes(1);
    expect(toggleHandler.mock.calls[0][0].detail.file).toBe(firstFile);
    expect(toggleHandler.mock.calls[0][0].detail.pinned).toBe(true);
    expect(windows[0].classList.contains('workspace__window--pinned')).toBe(true);
    expect(pinButton.getAttribute('aria-pressed')).toBe('true');
    expect(pinButton.textContent).toBe('ピン解除');

    windows[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const pinnedZ = Number.parseInt(windows[0].style.zIndex ?? '0', 10);
    const regularZ = Number.parseInt(windows[1].style.zIndex ?? '0', 10);

    expect(pinnedZ).toBeGreaterThan(regularZ);

    pinButton.click();

    expect(toggleHandler).toHaveBeenCalledTimes(2);
    expect(toggleHandler.mock.calls[1][0].detail.pinned).toBe(false);
    expect(windows[0].classList.contains('workspace__window--pinned')).toBe(false);
    expect(pinButton.getAttribute('aria-pressed')).toBe('false');
    expect(pinButton.textContent).toBe('ピン留め');
  });

  it('duplicates windows while preserving viewer state and emits metadata', async () => {
    const workspace = createWorkspace();
    const file = new File(['duplicate'], 'duplicate.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 6 });

    const windowElement = workspace.querySelector('.workspace__window');

    if (!windowElement) {
      throw new Error('window element is required for duplication tests');
    }

    const pageInput = windowElement.querySelector('.workspace__window-page-input');
    const zoomInButton = windowElement.querySelector(
      '.workspace__window-zoom-control--in',
    );
    const duplicateButton = windowElement.querySelector('.workspace__window-duplicate');
    const pinButton = windowElement.querySelector('.workspace__window-pin');
    const notesInput = windowElement.querySelector('.workspace__window-notes-input');

    if (!pageInput || !zoomInButton || !duplicateButton || !pinButton || !notesInput) {
      throw new Error('duplicate control structure is incomplete');
    }

    pageInput.value = '3';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    zoomInButton.dispatchEvent(new Event('click', { bubbles: true }));
    await flushPromises();

    pinButton.dispatchEvent(new Event('click', { bubbles: true }));
    await flushPromises();

    notesInput.value = '魔王城の罠メモ';
    notesInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();

    const duplicateHandler = vi.fn();
    workspace.addEventListener('workspace:window-duplicate', duplicateHandler);

    duplicateButton.click();

    await flushPromises();
    await flushPromises();

    const windows = Array.from(workspace.querySelectorAll('.workspace__window'));
    expect(windows).toHaveLength(2);

    const [originalWindow, duplicateWindow] = windows;
    const originalViewer = originalWindow.querySelector('.workspace__window-viewer');
    const duplicateViewer = duplicateWindow?.querySelector('.workspace__window-viewer');
    const duplicateNotes = duplicateWindow?.querySelector('.workspace__window-notes-input');

    expect(originalViewer?.dataset.page).toBe('3');
    expect(originalViewer?.dataset.zoom).toBe('1.1');
    expect(duplicateViewer?.dataset.page).toBe('3');
    expect(duplicateViewer?.dataset.zoom).toBe('1.1');
    expect(duplicateNotes?.value).toBe('魔王城の罠メモ');
    expect(duplicateWindow?.dataset.notesLength).toBe(String('魔王城の罠メモ'.length));

    expect(duplicateWindow?.classList.contains('workspace__window--pinned')).toBe(true);

    const originalLeft = Number.parseInt(originalWindow.style.left ?? '0', 10);
    const originalTop = Number.parseInt(originalWindow.style.top ?? '0', 10);
    const duplicateLeft = Number.parseInt(duplicateWindow?.style.left ?? '0', 10);
    const duplicateTop = Number.parseInt(duplicateWindow?.style.top ?? '0', 10);

    expect(duplicateLeft - originalLeft).toBe(24);
    expect(duplicateTop - originalTop).toBe(24);

    expect(duplicateHandler).toHaveBeenCalledTimes(1);
    const detail = duplicateHandler.mock.calls[0][0].detail;
    expect(detail.file).toBe(file);
    expect(detail.page).toBe(3);
    expect(detail.zoom).toBeCloseTo(1.1, 3);
    expect(detail.totalPages).toBe(6);
    expect(detail.sourceId).toBe(originalWindow.dataset.windowId);
    expect(detail.duplicateId).toBe(duplicateWindow?.dataset.windowId);
    expect(detail.notes).toBe('魔王城の罠メモ');
  });

  it('captures notes input, emits updates, and persists content', async () => {
    const workspace = createWorkspace();
    const file = new File(['notes'], 'notes.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const notesInput = workspace.querySelector('.workspace__window-notes-input');
    const notesCounter = workspace.querySelector('.workspace__window-notes-counter');

    if (!windowElement || !notesInput || !notesCounter) {
      throw new Error('notes controls must exist for the test');
    }

    expect(notesInput.value).toBe('');
    expect(notesCounter.textContent).toBe('0文字');
    expect(windowElement.dataset.notesLength).toBe('0');

    storageMocks.persist.mockClear();

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-notes-change', handler);

    notesInput.value = '敵NPCの口調を変更する';
    notesInput.dispatchEvent(new Event('input', { bubbles: true }));

    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.notes).toBe('敵NPCの口調を変更する');
    expect(notesCounter.textContent).toBe(`${'敵NPCの口調を変更する'.length}文字`);
    expect(windowElement.dataset.notesLength).toBe(String('敵NPCの口調を変更する'.length));

    expect(storageMocks.persist).toHaveBeenCalled();
    const lastCall = storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!lastCall) {
      throw new Error('notes persistence call is required');
    }

    const [state] = lastCall;
    expect(state.notes).toBe('敵NPCの口調を変更する');
  });

  it('changes window pages through the navigation controls and emits updates', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'pages.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 8 });

    const pageInput = workspace.querySelector('.workspace__window-page-input');
    const pageForm = workspace.querySelector('.workspace__window-page');
    const prevButton = workspace.querySelector('.workspace__window-nav--previous');
    const nextButton = workspace.querySelector('.workspace__window-nav--next');

    if (!pageInput || !pageForm || !prevButton || !nextButton) {
      throw new Error('page navigation structure is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.page).toBe(2);
    expect(handler.mock.calls[0][0].detail.totalPages).toBe(8);
    expect(pageInput.value).toBe('2');
    expect(prevButton.disabled).toBe(false);

    pageInput.value = '5';
    pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(5);
    expect(handler.mock.calls[1][0].detail.totalPages).toBe(8);
    expect(pageInput.value).toBe('5');

    prevButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2][0].detail.page).toBe(4);
    expect(handler.mock.calls[2][0].detail.totalPages).toBe(8);
    expect(pageInput.value).toBe('4');
  });

  it('supports keyboard page navigation when the window is focused', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'keyboard.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 3 });

    const windowElement = workspace.querySelector('.workspace__window');
    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (!windowElement || !pageInput) {
      throw new Error('window keyboard structure is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.page).toBe(2);
    expect(handler.mock.calls[0][0].detail.totalPages).toBe(3);

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(1);
    expect(handler.mock.calls[1][0].detail.totalPages).toBe(3);

    pageInput.focus();
    pageInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('supports keyboard zoom shortcuts when the window is focused', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'zoom-shortcuts.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 6 });

    const windowElement = workspace.querySelector('.workspace__window');
    const zoomDisplay = workspace.querySelector('.workspace__window-zoom-display');
    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (!windowElement || !zoomDisplay || !pageInput) {
      throw new Error('window zoom shortcut structure is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-zoom-change', handler);

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '=', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.zoom).toBeCloseTo(1.1, 2);
    expect(zoomDisplay.textContent).toBe('110%');

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '0', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.zoom).toBeCloseTo(1.0, 2);
    expect(zoomDisplay.textContent).toBe('100%');

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '+', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2][0].detail.zoom).toBeCloseTo(1.1, 2);
    expect(zoomDisplay.textContent).toBe('110%');

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '-', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(4);
    expect(handler.mock.calls[3][0].detail.zoom).toBeCloseTo(1.0, 2);
    expect(zoomDisplay.textContent).toBe('100%');

    pageInput.focus();
    pageInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: '=', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(4);

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '=', bubbles: true, ctrlKey: true }),
    );

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it('sanitises invalid page input and keeps the current page when left blank', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'sanitize.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 4 });

    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (!pageInput) {
      throw new Error('page input is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    pageInput.value = '0';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    expect(pageInput.value).toBe('1');

    pageInput.value = '   ';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    expect(pageInput.value).toBe('1');
  });

  it('adjusts zoom levels via the toolbar controls and announces the change', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'zoom.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 5 });

    const zoomDisplay = workspace.querySelector('.workspace__window-zoom-display');
    const zoomOut = workspace.querySelector('.workspace__window-zoom-control--out');
    const zoomIn = workspace.querySelector('.workspace__window-zoom-control--in');
    const zoomReset = workspace.querySelector('.workspace__window-zoom-reset');

    if (!zoomDisplay || !zoomOut || !zoomIn || !zoomReset) {
      throw new Error('zoom controls are required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-zoom-change', handler);

    expect(zoomDisplay.textContent).toBe('100%');
    expect(zoomOut.disabled).toBe(false);
    expect(zoomReset.disabled).toBe(true);

    zoomIn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.zoom).toBeCloseTo(1.1, 2);
    expect(handler.mock.calls[0][0].detail.page).toBe(1);
    expect(zoomDisplay.textContent).toBe('110%');
    expect(zoomOut.disabled).toBe(false);
    expect(zoomReset.disabled).toBe(false);

    for (let i = 0; i < 20; i += 1) {
      zoomIn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    const lastCallAfterMax = handler.mock.calls[handler.mock.calls.length - 1];

    if (!lastCallAfterMax) {
      throw new Error('zoom handler must receive events');
    }

    expect(lastCallAfterMax[0].detail.zoom).toBeCloseTo(2, 2);
    expect(lastCallAfterMax[0].detail.page).toBe(1);
    expect(zoomDisplay.textContent).toBe('200%');
    expect(zoomIn.disabled).toBe(true);

    zoomOut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const afterDecrease = handler.mock.calls[handler.mock.calls.length - 1];

    if (!afterDecrease) {
      throw new Error('zoom handler must receive decrease event');
    }

    expect(afterDecrease[0].detail.zoom).toBeCloseTo(1.9, 2);
    expect(afterDecrease[0].detail.page).toBe(1);
    expect(zoomDisplay.textContent).toBe('190%');
    expect(zoomIn.disabled).toBe(false);

    while (!zoomOut.disabled) {
      zoomOut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    const afterMinCall = handler.mock.calls[handler.mock.calls.length - 1];

    if (!afterMinCall) {
      throw new Error('zoom handler must receive minimum zoom event');
    }

    expect(afterMinCall[0].detail.zoom).toBeCloseTo(0.5, 2);
    expect(afterMinCall[0].detail.page).toBe(1);
    expect(zoomDisplay.textContent).toBe('50%');
    expect(zoomOut.disabled).toBe(true);

    zoomReset.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const afterReset = handler.mock.calls[handler.mock.calls.length - 1];

    if (!afterReset) {
      throw new Error('zoom handler must receive reset event');
    }

    expect(afterReset[0].detail.zoom).toBeCloseTo(1, 3);
    expect(afterReset[0].detail.page).toBe(1);
    expect(zoomDisplay.textContent).toBe('100%');
    expect(zoomOut.disabled).toBe(false);
    expect(zoomIn.disabled).toBe(false);
    expect(zoomReset.disabled).toBe(true);
  });

  it('closes windows and emits a closure event', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'close.pdf', { type: 'application/pdf' });
    storageMocks.persist.mockClear();
    storageMocks.remove.mockClear();

    await openWindow(workspace, file);
    await flushPromises();

    expect(storageMocks.persist).toHaveBeenCalled();

    const closeButton = workspace.querySelector('.workspace__window-close');

    if (!closeButton) {
      throw new Error('window close control is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-close', handler);

    const windowElement = workspace.querySelector('.workspace__window');

    closeButton.click();

    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.file).toBe(file);
    expect(workspace.querySelector('.workspace__window')).toBeNull();

    if (windowElement?.dataset.windowId) {
      expect(storageMocks.remove).toHaveBeenCalledWith(windowElement.dataset.windowId);
    } else {
      expect(storageMocks.remove).toHaveBeenCalled();
    }
  });

  it('clears persisted data and open windows via the maintenance control', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'clear.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);
    await flushPromises();

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-selected', {
        bubbles: true,
        detail: { files: [file] },
      }),
    );

    const button = workspace.querySelector('.workspace__maintenance-button');

    if (!button) {
      throw new Error('maintenance control is required');
    }

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const clearedHandler = vi.fn();
    workspace.addEventListener('workspace:cache-cleared', clearedHandler);

    button.click();

    await flushPromises();
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(storageMocks.clear).toHaveBeenCalledTimes(1);
    expect(storageMocks.remove).not.toHaveBeenCalled();

    expect(workspace.querySelector('.workspace__window')).toBeNull();
    expect(workspace.querySelector('.workspace__queue-item')).toBeNull();

    const status = workspace.querySelector('.workspace__maintenance-status');

    if (!status) {
      throw new Error('maintenance status element is required');
    }

    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('保存データを削除しました');

    expect(clearedHandler).toHaveBeenCalledTimes(1);
    expect(clearedHandler.mock.calls[0][0].detail.windowsCleared).toBe(1);

    confirmSpy.mockRestore();
  });

  it('does not clear data when the maintenance confirmation is cancelled', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'cancel.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);
    await flushPromises();

    const button = workspace.querySelector('.workspace__maintenance-button');

    if (!button) {
      throw new Error('maintenance control is required');
    }

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    button.click();

    await flushPromises();

    expect(storageMocks.clear).not.toHaveBeenCalled();
    expect(workspace.querySelector('.workspace__window')).not.toBeNull();

    const status = workspace.querySelector('.workspace__maintenance-status');
    expect(status?.hidden).toBe(true);

    confirmSpy.mockRestore();
  });

  it('surfaces an error message when clearing persisted data fails', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'error.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);
    await flushPromises();

    storageMocks.clear.mockRejectedValueOnce(new Error('failed to clear'));

    const button = workspace.querySelector('.workspace__maintenance-button');

    if (!button) {
      throw new Error('maintenance control is required');
    }

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    button.click();

    await flushPromises();
    await flushPromises();

    expect(storageMocks.clear).toHaveBeenCalledTimes(1);
    expect(storageMocks.remove).not.toHaveBeenCalled();
    expect(workspace.querySelector('.workspace__window')).not.toBeNull();

    const status = workspace.querySelector('.workspace__maintenance-status');

    if (!status) {
      throw new Error('maintenance status element is required');
    }

    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('削除に失敗しました');
    expect(status.classList.contains('workspace__maintenance-status--error')).toBe(true);

    confirmSpy.mockRestore();
  });
});
