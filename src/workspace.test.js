import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMocks = vi.hoisted(() => {
  const state = {
    numPages: 4,
    textByPage: new Map(),
    outline: [],
    namedDestinations: {},
    pageRefs: [],
    pageIndex: new Map(),
  };
  const renderMock = vi.fn();
  const getPageMock = vi.fn();
  const destroyMock = vi.fn();
  const getDocumentMock = vi.fn();
  const getOutlineMock = vi.fn();
  const getDestinationMock = vi.fn();
  const getPageIndexMock = vi.fn();

  return {
    state,
    renderMock,
    getPageMock,
    destroyMock,
    getDocumentMock,
    getOutlineMock,
    getDestinationMock,
    getPageIndexMock,
  };
});

const storageMocks = vi.hoisted(() => {
  const load = vi.fn();
  const persist = vi.fn();
  const remove = vi.fn();
  const clear = vi.fn();
  const exportSnapshot = vi.fn();
  const importSnapshot = vi.fn();
  const loadPreferences = vi.fn();
  const persistPreference = vi.fn();

  return {
    load,
    persist,
    remove,
    clear,
    exportSnapshot,
    importSnapshot,
    loadPreferences,
    persistPreference,
  };
});

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let createObjectURLSpy;
let revokeObjectURLSpy;

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
  loadWorkspacePreferences: storageMocks.loadPreferences,
  persistWorkspacePreference: storageMocks.persistPreference,
  exportWorkspaceSnapshot: storageMocks.exportSnapshot,
  importWorkspaceSnapshot: storageMocks.importSnapshot,
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

  await flushPromises();
  await flushPromises();
};

beforeEach(() => {
  pdfMocks.state.numPages = 4;
  pdfMocks.state.textByPage = new Map([
    [1, 'keyword alpha introduction body'],
    [2, 'supporting keyword beta details for search'],
    [3, 'intermission without matches'],
    [4, 'finale gamma keyword for outline'],
  ]);
  const pageRefs = Array.from({ length: pdfMocks.state.numPages }, (_, index) => ({
    num: index + 1,
    gen: 0,
  }));
  pdfMocks.state.pageRefs = pageRefs;
  pdfMocks.state.pageIndex = new Map(pageRefs.map((ref, index) => [ref, index]));
  pdfMocks.state.namedDestinations = {
    intro: [pageRefs[0]],
    finale: [pageRefs[3]],
  };
  pdfMocks.state.outline = [
    { title: 'イントロダクション', dest: 'intro', items: [] },
    { title: 'クライマックス', dest: [pageRefs[3]], items: [] },
  ];
  pdfMocks.renderMock.mockReset();
  pdfMocks.getPageMock.mockReset();
  pdfMocks.getDocumentMock.mockReset();
  pdfMocks.destroyMock.mockReset();
  pdfMocks.getOutlineMock.mockReset();
  pdfMocks.getDestinationMock.mockReset();
  pdfMocks.getPageIndexMock.mockReset();

  storageMocks.load.mockReset();
  storageMocks.persist.mockReset();
  storageMocks.remove.mockReset();
  storageMocks.clear.mockReset();
  storageMocks.exportSnapshot.mockReset();
  storageMocks.importSnapshot.mockReset();
  storageMocks.loadPreferences.mockReset();
  storageMocks.persistPreference.mockReset();

  storageMocks.load.mockResolvedValue([]);
  storageMocks.persist.mockResolvedValue();
  storageMocks.remove.mockResolvedValue();
  storageMocks.clear.mockResolvedValue();
  storageMocks.loadPreferences.mockResolvedValue({});
  storageMocks.persistPreference.mockResolvedValue();
  storageMocks.exportSnapshot.mockResolvedValue({
    blob: new Blob([JSON.stringify({ version: 1, windows: [] })], {
      type: 'application/json',
    }),
    windows: 0,
    compression: 'none',
  });
  storageMocks.importSnapshot.mockResolvedValue({ windows: [] });

  createObjectURLSpy = vi.fn(() => 'blob:session');
  revokeObjectURLSpy = vi.fn();

  URL.createObjectURL = createObjectURLSpy;
  URL.revokeObjectURL = revokeObjectURLSpy;

  pdfMocks.renderMock.mockImplementation(() => ({ promise: Promise.resolve() }));
  pdfMocks.getPageMock.mockImplementation(async (pageNumber) => {
    const index = Number.isFinite(pageNumber) ? Math.max(1, Math.floor(pageNumber)) : 1;

    return {
      getViewport: ({ scale, rotation = 0 }) => {
        const normalizedRotation = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
        const rotated = normalizedRotation === 90 || normalizedRotation === 270;

        return {
          width: (rotated ? 800 : 600) * scale,
          height: (rotated ? 600 : 800) * scale,
        };
      },
      render: pdfMocks.renderMock,
      getTextContent: async () => ({
        items: [
          {
            str: pdfMocks.state.textByPage.get(index) ?? '',
          },
        ],
      }),
    };
  });
  pdfMocks.getOutlineMock.mockImplementation(async () => pdfMocks.state.outline);
  pdfMocks.getDestinationMock.mockImplementation(async (name) => {
    return pdfMocks.state.namedDestinations[name] ?? null;
  });
  pdfMocks.getPageIndexMock.mockImplementation(async (ref) => {
    const index = pdfMocks.state.pageIndex.get(ref);

    if (!Number.isFinite(index)) {
      throw new Error('Unknown reference');
    }

    return index;
  });
  pdfMocks.getDocumentMock.mockImplementation(() => ({
    promise: Promise.resolve({
      numPages: pdfMocks.state.numPages,
      getPage: pdfMocks.getPageMock,
      destroy: pdfMocks.destroyMock,
      getOutline: pdfMocks.getOutlineMock,
      getDestination: pdfMocks.getDestinationMock,
      getPageIndex: pdfMocks.getPageIndexMock,
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

  if (typeof originalCreateObjectURL === 'function') {
    URL.createObjectURL = originalCreateObjectURL;
  } else {
    delete URL.createObjectURL;
  }

  if (typeof originalRevokeObjectURL === 'function') {
    URL.revokeObjectURL = originalRevokeObjectURL;
  } else {
    delete URL.revokeObjectURL;
  }

  document.documentElement.style.cssText = '';
});

describe('createWorkspace', () => {
  it('creates a workspace container with key sections', () => {
    const workspace = createWorkspace();

    expect(workspace).toBeInstanceOf(HTMLElement);
    expect(workspace.dataset.role).toBe('workspace');
    expect(workspace.dataset.theme).toBe('midnight');
    expect(workspace.querySelector('.workspace__app-bar')).not.toBeNull();
    expect(workspace.querySelector('.workspace__drop-zone')).not.toBeNull();
    expect(workspace.querySelector('.workspace__button')?.textContent).toBe('PDFを開く');
    expect(workspace.querySelector('.workspace__file-input')).not.toBeNull();
    expect(workspace.querySelector('.workspace__onboarding')).not.toBeNull();
    expect(workspace.querySelector('.workspace__queue')).not.toBeNull();
    expect(workspace.querySelector('.workspace__quick-panel')).not.toBeNull();
    expect(workspace.querySelector('.workspace__menu')).not.toBeNull();
  });

  it('exposes workspace menu state through data attributes', () => {
    const workspace = createWorkspace();

    expect(workspace.dataset.activeMenu).toBe('browser');
    expect(workspace.dataset.activeTrack).toBe('bgm01');
    expect(workspace.dataset.menuVolume).toBe('68');

    const mapButton = workspace.querySelector('[data-menu-id="map"]');
    mapButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(workspace.dataset.activeMenu).toBe('map');

    const trackButton = workspace.querySelector('[data-track-id="bgm02"]');
    trackButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(workspace.dataset.activeTrack).toBe('bgm02');

    const slider = workspace.querySelector('.workspace__menu-range');
    expect(slider).toBeInstanceOf(HTMLInputElement);

    if (!(slider instanceof HTMLInputElement)) {
      throw new Error('expected the workspace menu slider to be present');
    }

    slider.value = '73';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(workspace.dataset.menuVolume).toBe('73');
  });

  it('shows onboarding guidance when no windows are open and restores it after closing the last window', async () => {
    const workspace = createWorkspace();
    const onboarding = workspace.querySelector('.workspace__onboarding');

    expect(onboarding).toBeInstanceOf(HTMLElement);
    expect(onboarding?.hidden).toBe(false);

    const file = new File(['dummy'], 'guide.pdf', { type: 'application/pdf' });
    await openWindow(workspace, file);

    expect(onboarding?.hidden).toBe(true);

    const closeButton = workspace.querySelector('.workspace__window-close');

    if (!closeButton) {
      throw new Error('close button is required for the onboarding test');
    }

    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(onboarding?.hidden).toBe(false);
  });

  it('hides onboarding when the completion preference is stored', async () => {
    storageMocks.loadPreferences.mockResolvedValueOnce({ onboardingCompleted: true });

    const workspace = createWorkspace();
    await flushPromises();

    const onboarding = workspace.querySelector('.workspace__onboarding');

    expect(storageMocks.loadPreferences).toHaveBeenCalledTimes(1);
    expect(onboarding).toBeInstanceOf(HTMLElement);
    expect(onboarding?.hidden).toBe(true);
  });

  it('opens the sample PDF from onboarding without requiring a manual file', async () => {
    const workspace = createWorkspace();
    const onboarding = workspace.querySelector('.workspace__onboarding');
    const sampleButton = workspace.querySelector('.workspace__onboarding-button');

    expect(onboarding).toBeInstanceOf(HTMLElement);
    expect(sampleButton).toBeInstanceOf(HTMLElement);

    sampleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(pdfMocks.getDocumentMock).toHaveBeenCalled();
    expect(workspace.querySelectorAll('.workspace__window').length).toBeGreaterThan(0);
    expect(onboarding?.hidden).toBe(true);
  });

  it('persists the onboarding completion flag when the dismiss control is used', async () => {
    const workspace = createWorkspace();
    const dismissButton = workspace.querySelector('.workspace__onboarding-dismiss');

    expect(dismissButton).toBeInstanceOf(HTMLElement);

    dismissButton?.click();

    await vi.waitFor(() => {
      expect(storageMocks.persistPreference).toHaveBeenCalledWith('onboardingCompleted', true);
    });

    const onboarding = workspace.querySelector('.workspace__onboarding');
    await vi.waitFor(() => {
      expect(onboarding?.hidden).toBe(true);
    });
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

  it('performs keyword search and navigates between results', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'search.pdf', { type: 'application/pdf' });
    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');

    if (!windowElement) {
      throw new Error('window element is required for the search test');
    }

    const searchEvents = vi.fn();
    windowElement.addEventListener('workspace:window-search', searchEvents);

    const searchInput = windowElement.querySelector('.workspace__window-search-input');
    const searchForm = windowElement.querySelector('.workspace__window-search-form');

    expect(searchInput).toBeInstanceOf(HTMLInputElement);
    expect(searchForm).toBeInstanceOf(HTMLFormElement);

    if (!(searchInput instanceof HTMLInputElement) || !(searchForm instanceof HTMLFormElement)) {
      throw new Error('search form elements are required');
    }

    searchInput.value = 'keyword';
    searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushPromises();
    await flushPromises();

    const results = windowElement.querySelectorAll('.workspace__window-search-result');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(windowElement.dataset.searchQuery).toBe('keyword');
    expect(windowElement.dataset.searchCount).toBe(String(results.length));
    expect(searchEvents).toHaveBeenCalled();

    const viewer = windowElement.querySelector('.workspace__window-viewer');
    expect(viewer?.dataset.page).toBe('1');

    const nextButton = windowElement.querySelector('.workspace__window-search-next');
    expect(nextButton).toBeInstanceOf(HTMLButtonElement);
    nextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await flushPromises();

    expect(viewer?.dataset.page).toBe('2');

    const firstResultButton = windowElement.querySelector(
      '.workspace__window-search-result button',
    );
    expect(firstResultButton).toBeInstanceOf(HTMLButtonElement);
    firstResultButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await flushPromises();

    expect(viewer?.dataset.page).toBe('1');
  });

  it('renders outline entries and jumps to the selected section', async () => {
    const workspace = createWorkspace();
    const file = new File(['outline'], 'outline.pdf', { type: 'application/pdf' });
    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');

    if (!windowElement) {
      throw new Error('window element is required for the outline test');
    }

    const outlineEvents = vi.fn();
    windowElement.addEventListener('workspace:window-outline-jump', outlineEvents);

    await flushPromises();
    await flushPromises();

    const outlineItems = windowElement.querySelectorAll('.workspace__window-outline-item');
    expect(outlineItems.length).toBeGreaterThanOrEqual(2);
    expect(windowElement.dataset.outlineCount).toBe(String(outlineItems.length));

    const viewer = windowElement.querySelector('.workspace__window-viewer');
    expect(viewer?.dataset.page).toBe('1');

    const secondButton = outlineItems[1]?.querySelector('button');
    expect(secondButton).toBeInstanceOf(HTMLButtonElement);
    secondButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await flushPromises();

    expect(outlineEvents).toHaveBeenCalled();
    expect(viewer?.dataset.page).toBe('4');
    expect(outlineEvents.mock.calls.at(-1)?.[0].detail.page).toBe(4);
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
        title: '永続ウィンドウ',
        color: 'emerald',
        bookmarks: [2, 5],
      },
    ]);

    const workspace = createWorkspace();

    await flushPromises();
    await flushPromises();

    expect(storageMocks.load).toHaveBeenCalledTimes(1);

    const windowElement = workspace.querySelector('.workspace__window');
    const maximizeButton = workspace.querySelector('.workspace__window-maximize');
    const resizeHandle = workspace.querySelector('.workspace__window-resize');

    expect(windowElement).not.toBeNull();
    expect(windowElement?.classList.contains('workspace__window--pinned')).toBe(true);
    expect(windowElement?.style.left).toBe('48px');
    expect(windowElement?.style.top).toBe('64px');
    expect(windowElement?.style.width).toBe('512px');
    expect(windowElement?.style.height).toBe('420px');
    expect(windowElement?.dataset.windowTitle).toBe('永続ウィンドウ');
    expect(windowElement?.dataset.windowColor).toBe('emerald');
    expect(windowElement?.classList.contains('workspace__window--color-emerald')).toBe(true);
    expect(windowElement?.dataset.pageHistoryIndex).toBe('0');
    expect(windowElement?.dataset.pageHistoryLength).toBe('1');

    const restoredTitle = workspace.querySelector('.workspace__window-title');
    expect(restoredTitle?.textContent).toBe('永続ウィンドウ');

    const pageInput = workspace.querySelector('.workspace__window-page-input');
    const zoomDisplay = workspace.querySelector('.workspace__window-zoom-display');
    const notesField = workspace.querySelector('.workspace__window-notes-input');
    const notesCounter = workspace.querySelector('.workspace__window-notes-counter');

    expect(pageInput?.value).toBe('2');
    expect(zoomDisplay?.textContent).toBe('125%');
    expect(notesField?.value).toBe('復元メモ');
    expect(notesCounter?.textContent).toBe(`${'復元メモ'.length}文字`);
    expect(windowElement?.dataset.notesLength).toBe(String('復元メモ'.length));
    expect(windowElement?.dataset.windowMaximized).toBe('false');
    expect(windowElement?.dataset.bookmarkCount).toBe('2');
    expect(windowElement?.dataset.bookmarkPages).toBe('2,4');
    expect(maximizeButton?.getAttribute('aria-pressed')).toBe('false');
    expect(resizeHandle?.disabled).toBe(false);

    const activeWindow = workspace.querySelector('.workspace__window--active');
    expect(activeWindow).toBe(windowElement);

    const bookmarkItems = workspace.querySelectorAll('.workspace__window-bookmarks-item');
    const bookmarkAddButton = workspace.querySelector('.workspace__window-bookmark-add');

    expect(bookmarkItems).toHaveLength(2);
    expect(bookmarkItems[0]?.textContent).toContain('2ページ目');
    expect(bookmarkItems[1]?.textContent).toContain('4ページ目');
    expect(bookmarkAddButton?.disabled).toBe(true);
  });

  it('restores maximized windows and disables manual layout controls', async () => {
    const persistedFile = new File(['max'], 'maximized.pdf', {
      type: 'application/pdf',
      lastModified: 789,
    });

    storageMocks.load.mockResolvedValue([
      {
        id: 'max-window',
        file: persistedFile,
        page: 1,
        zoom: 1,
        left: 128,
        top: 96,
        width: 520,
        height: 400,
        maximized: true,
        restoreLeft: 128,
        restoreTop: 96,
        restoreWidth: 520,
        restoreHeight: 400,
        title: '最大ウィンドウ',
        persisted: true,
      },
    ]);

    const workspace = createWorkspace();

    await flushPromises();
    await flushPromises();

    const windowElement = workspace.querySelector('.workspace__window');
    const maximizeButton = workspace.querySelector('.workspace__window-maximize');
    const resizeHandle = workspace.querySelector('.workspace__window-resize');

    expect(windowElement).not.toBeNull();
    expect(maximizeButton).not.toBeNull();
    expect(resizeHandle).not.toBeNull();

    expect(windowElement?.classList.contains('workspace__window--maximized')).toBe(true);
    expect(windowElement?.dataset.windowMaximized).toBe('true');
    expect(windowElement?.style.left).toBe('0px');
    expect(windowElement?.style.top).toBe('0px');
    expect(windowElement?.style.width).toBe('960px');
    expect(windowElement?.style.height).toBe('640px');
    expect(windowElement?.dataset.windowTitle).toBe('最大ウィンドウ');
    expect(maximizeButton?.getAttribute('aria-pressed')).toBe('true');
    expect(maximizeButton?.textContent).toBe('縮小');
    expect(maximizeButton?.getAttribute('aria-label')).toBe('最大ウィンドウ を元のサイズに戻す');
    expect(resizeHandle?.disabled).toBe(true);
    expect(resizeHandle?.getAttribute('aria-hidden')).toBe('true');
  });

  it('restores stored page history metadata and keeps navigation controls aligned', async () => {
    const persistedFile = new File(['history'], 'history-stored.pdf', {
      type: 'application/pdf',
      lastModified: 456,
    });

    storageMocks.load.mockResolvedValue([
      {
        id: 'history-window',
        file: persistedFile,
        page: 4,
        totalPages: 9,
        pageHistory: [1, 2, 4, 7],
        pageHistoryIndex: 2,
        left: 12,
        top: 18,
        persisted: true,
      },
    ]);

    const workspace = createWorkspace();

    await flushPromises();
    await flushPromises();

    const windowElement = workspace.querySelector('.workspace__window');
    const backButton = workspace.querySelector('.workspace__window-nav--history-back');
    const forwardButton = workspace.querySelector('.workspace__window-nav--history-forward');

    if (!windowElement || !backButton || !forwardButton) {
      throw new Error('restored history controls are required for the test');
    }

    expect(windowElement.dataset.pageHistoryIndex).toBe('2');
    expect(windowElement.dataset.pageHistoryLength).toBe('4');
    expect(backButton.disabled).toBe(false);
    expect(forwardButton.disabled).toBe(false);

    forwardButton.click();
    await flushPromises();

    expect(windowElement.dataset.pageHistoryIndex).toBe('3');
    expect(windowElement.dataset.pageHistoryLength).toBe('4');
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
    const windowElement = workspace.querySelector('.workspace__window');

    if (!(viewer instanceof HTMLElement) || !(windowElement instanceof HTMLElement)) {
      throw new Error('window viewer element is required for the test');
    }

    expect(viewer.dataset.page).toBe('1');
    expect(viewer.dataset.zoom).toBe('1');
    expect(viewer.dataset.totalPages).toBe('6');
    expect(viewer.dataset.pageWidth).toBe('600');
    expect(viewer.dataset.pageHeight).toBe('800');
    expect(viewer.dataset.viewportWidth).toBe('600');
    expect(viewer.dataset.viewportHeight).toBe('800');
    expect(windowElement.dataset.zoomFitMode).toBe('manual');

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
    expect(viewer.dataset.viewportWidth).toBe('660');
    expect(viewer.dataset.viewportHeight).toBe('880');
    expect(windowElement.dataset.zoomFitMode).toBe('manual');
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
    const rotateLeftButton = windowElement.querySelector(
      '.workspace__window-rotation-control--left',
    );
    const rotateRightButton = windowElement.querySelector(
      '.workspace__window-rotation-control--right',
    );
    const rotateResetButton = windowElement.querySelector('.workspace__window-rotation-reset');
    const duplicateButton = windowElement.querySelector('.workspace__window-duplicate');
    const pinButton = windowElement.querySelector('.workspace__window-pin');
    const colorButton = windowElement.querySelector('.workspace__window-color');
    const notesInput = windowElement.querySelector('.workspace__window-notes-input');
    const renameButton = windowElement.querySelector('.workspace__window-rename');
    const titleInput = windowElement.querySelector('.workspace__window-title-input');
    const titleLabel = windowElement.querySelector('.workspace__window-title');
    const bookmarkAddButton = windowElement.querySelector('.workspace__window-bookmark-add');

    if (
      !pageInput ||
      !zoomInButton ||
      !duplicateButton ||
      !pinButton ||
      !colorButton ||
      !notesInput ||
      !renameButton ||
      !titleInput ||
      !titleLabel ||
      !rotateLeftButton ||
      !rotateRightButton ||
      !rotateResetButton ||
      !(bookmarkAddButton instanceof HTMLButtonElement)
    ) {
      throw new Error('duplicate control structure is incomplete');
    }

    pageInput.value = '3';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    zoomInButton.dispatchEvent(new Event('click', { bubbles: true }));
    await flushPromises();

    rotateLeftButton.dispatchEvent(new Event('click', { bubbles: true }));
    await flushPromises();

    pinButton.dispatchEvent(new Event('click', { bubbles: true }));
    await flushPromises();

    notesInput.value = '魔王城の罠メモ';
    notesInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();

    bookmarkAddButton.click();
    await flushPromises();

    pageInput.value = '5';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    bookmarkAddButton.click();
    await flushPromises();

    expect(windowElement.dataset.bookmarkPages).toBe('3,5');

    pageInput.value = '3';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    renameButton.click();
    await flushPromises();

    titleInput.value = '魔王討伐計画';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    renameButton.click();

    await flushPromises();

    colorButton.click();
    await flushPromises();
    colorButton.click();
    await flushPromises();

    expect(windowElement.dataset.windowColor).toBe('emerald');
    expect(colorButton.textContent).toBe('色: 翡翠');

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
    const duplicateTitle = duplicateWindow?.querySelector('.workspace__window-title');

    expect(originalViewer?.dataset.page).toBe('3');
    expect(originalViewer?.dataset.zoom).toBe('1.1');
    expect(originalViewer?.dataset.rotation).toBe('270');
    expect(duplicateViewer?.dataset.page).toBe('3');
    expect(duplicateViewer?.dataset.zoom).toBe('1.1');
    expect(duplicateViewer?.dataset.rotation).toBe('270');
    expect(duplicateNotes?.value).toBe('魔王城の罠メモ');
    expect(duplicateWindow?.dataset.notesLength).toBe(String('魔王城の罠メモ'.length));
    expect(originalWindow.dataset.windowTitle).toBe('魔王討伐計画');
    expect(duplicateWindow?.dataset.windowTitle).toBe('魔王討伐計画');
    expect(duplicateWindow?.dataset.windowColor).toBe('emerald');
    expect(duplicateWindow?.dataset.rotation).toBe('270');
    expect(duplicateWindow?.dataset.windowMaximized).toBe('false');
    expect(duplicateWindow?.dataset.bookmarkPages).toBe(
      originalWindow.dataset.bookmarkPages,
    );
    expect(duplicateWindow?.dataset.bookmarkCount).toBe('2');
    expect(titleLabel.textContent).toBe('魔王討伐計画');
    expect(duplicateTitle?.textContent).toBe('魔王討伐計画');
    expect(duplicateWindow?.dataset.pageHistoryLength).toBe(
      originalWindow.dataset.pageHistoryLength,
    );
    expect(duplicateWindow?.dataset.pageHistoryIndex).toBe(
      originalWindow.dataset.pageHistoryIndex,
    );

    expect(duplicateWindow?.classList.contains('workspace__window--pinned')).toBe(true);
    expect(rotateResetButton.disabled).toBe(false);

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
    expect(detail.rotation).toBe(270);
    expect(detail.totalPages).toBe(6);
    expect(detail.sourceId).toBe(originalWindow.dataset.windowId);
    expect(detail.duplicateId).toBe(duplicateWindow?.dataset.windowId);
    expect(detail.notes).toBe('魔王城の罠メモ');
    expect(detail.title).toBe('魔王討伐計画');
    expect(detail.color).toBe('emerald');
    expect(detail.maximized).toBe(false);
    expect(detail.bookmarks).toEqual([3, 5]);
  });

  it('toggles window maximization, emits events, and persists restore bounds', async () => {
    const workspace = createWorkspace();
    const file = new File(['max'], 'max.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const maximizeButton = workspace.querySelector('.workspace__window-maximize');
    const resizeHandle = workspace.querySelector('.workspace__window-resize');

    if (!windowElement || !maximizeButton || !resizeHandle) {
      throw new Error('maximize controls must exist for the test');
    }

    const parsePixels = (value) => Number.parseFloat(value ?? '0');
    const initialLeft = parsePixels(windowElement.style.left);
    const initialTop = parsePixels(windowElement.style.top);
    const initialWidth = parsePixels(windowElement.style.width);
    const initialHeight = parsePixels(windowElement.style.height);

    const maximizeHandler = vi.fn();
    workspace.addEventListener('workspace:window-maximize-change', maximizeHandler);

    storageMocks.persist.mockClear();

    maximizeButton.click();

    await flushPromises();
    await flushPromises();

    expect(maximizeHandler).toHaveBeenCalledTimes(1);

    const firstDetail = maximizeHandler.mock.calls[0][0].detail;
    expect(firstDetail.file).toBe(file);
    expect(firstDetail.maximized).toBe(true);
    expect(firstDetail.restoreLeft).toBeCloseTo(initialLeft, 6);
    expect(firstDetail.restoreTop).toBeCloseTo(initialTop, 6);
    expect(firstDetail.restoreWidth).toBeCloseTo(initialWidth, 6);
    expect(firstDetail.restoreHeight).toBeCloseTo(initialHeight, 6);
    expect(firstDetail.left).toBeCloseTo(0, 6);
    expect(firstDetail.top).toBeCloseTo(0, 6);
    expect(windowElement.classList.contains('workspace__window--maximized')).toBe(true);
    expect(windowElement.dataset.windowMaximized).toBe('true');
    expect(maximizeButton.getAttribute('aria-pressed')).toBe('true');
    expect(maximizeButton.textContent).toBe('縮小');
    expect(resizeHandle.disabled).toBe(true);
    expect(resizeHandle.getAttribute('aria-hidden')).toBe('true');
    expect(parsePixels(windowElement.style.left)).toBeCloseTo(0, 6);
    expect(parsePixels(windowElement.style.top)).toBeCloseTo(0, 6);
    expect(parsePixels(windowElement.style.width)).toBeGreaterThan(initialWidth);
    expect(parsePixels(windowElement.style.height)).toBeGreaterThan(initialHeight);

    expect(storageMocks.persist).toHaveBeenCalled();

    const firstPersist =
      storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!firstPersist) {
      throw new Error('maximize persistence call is required');
    }

    expect(firstPersist[0].maximized).toBe(true);
    expect(firstPersist[0].restoreLeft).toBeCloseTo(initialLeft, 6);
    expect(firstPersist[0].restoreTop).toBeCloseTo(initialTop, 6);
    expect(firstPersist[0].restoreWidth).toBeCloseTo(initialWidth, 6);
    expect(firstPersist[0].restoreHeight).toBeCloseTo(initialHeight, 6);
    expect(firstPersist[0].bookmarks).toEqual([]);

    storageMocks.persist.mockClear();
    maximizeHandler.mockClear();

    maximizeButton.click();

    await flushPromises();
    await flushPromises();

    expect(maximizeHandler).toHaveBeenCalledTimes(1);

    const secondDetail = maximizeHandler.mock.calls[0][0].detail;
    expect(secondDetail.maximized).toBe(false);
    expect(secondDetail.left).toBeCloseTo(initialLeft, 6);
    expect(secondDetail.top).toBeCloseTo(initialTop, 6);
    expect(secondDetail.restoreLeft).toBeCloseTo(initialLeft, 6);
    expect(secondDetail.restoreTop).toBeCloseTo(initialTop, 6);
    expect(secondDetail.restoreWidth).toBeCloseTo(initialWidth, 6);
    expect(secondDetail.restoreHeight).toBeCloseTo(initialHeight, 6);
    expect(windowElement.classList.contains('workspace__window--maximized')).toBe(false);
    expect(windowElement.dataset.windowMaximized).toBe('false');
    expect(maximizeButton.getAttribute('aria-pressed')).toBe('false');
    expect(maximizeButton.textContent).toBe('最大化');
    expect(resizeHandle.disabled).toBe(false);
    expect(resizeHandle.getAttribute('aria-hidden')).toBe('false');
    expect(windowElement.style.left).toBe(`${initialLeft}px`);
    expect(windowElement.style.top).toBe(`${initialTop}px`);
    expect(windowElement.style.width).toBe(`${initialWidth}px`);
    expect(windowElement.style.height).toBe(`${initialHeight}px`);

    expect(storageMocks.persist).toHaveBeenCalled();

    const secondPersist =
      storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!secondPersist) {
      throw new Error('restore persistence call is required');
    }

    expect(secondPersist[0].maximized).toBe(false);
    expect(secondPersist[0].restoreLeft).toBeCloseTo(initialLeft, 6);
    expect(secondPersist[0].restoreTop).toBeCloseTo(initialTop, 6);
    expect(secondPersist[0].restoreWidth).toBeCloseTo(initialWidth, 6);
    expect(secondPersist[0].restoreHeight).toBeCloseTo(initialHeight, 6);
    expect(secondPersist[0].bookmarks).toEqual([]);
  });

  it('renames windows, updates metadata, and persists the new title', async () => {
    const workspace = createWorkspace();
    const file = new File(['rename'], 'rename.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const renameButton = workspace.querySelector('.workspace__window-rename');
    const titleInput = workspace.querySelector('.workspace__window-title-input');
    const titleLabel = workspace.querySelector('.workspace__window-title');
    const pinButton = workspace.querySelector('.workspace__window-pin');
    const duplicateButton = workspace.querySelector('.workspace__window-duplicate');
    const maximizeButton = workspace.querySelector('.workspace__window-maximize');
    const colorButton = workspace.querySelector('.workspace__window-color');
    const notesInput = workspace.querySelector('.workspace__window-notes-input');
    const pageForm = workspace.querySelector('.workspace__window-page');
    const pageInput = workspace.querySelector('.workspace__window-page-input');
    const firstButton = workspace.querySelector('.workspace__window-nav--first');
    const historyBackButton = workspace.querySelector('.workspace__window-nav--history-back');
    const historyForwardButton = workspace.querySelector(
      '.workspace__window-nav--history-forward',
    );
    const prevButton = workspace.querySelector('.workspace__window-nav--previous');
    const nextButton = workspace.querySelector('.workspace__window-nav--next');
    const lastButton = workspace.querySelector('.workspace__window-nav--last');
    const zoomOutButton = workspace.querySelector('.workspace__window-zoom-control--out');
    const zoomInButton = workspace.querySelector('.workspace__window-zoom-control--in');
    const zoomResetButton = workspace.querySelector('.workspace__window-zoom-reset');
    const rotationLeftButton = workspace.querySelector(
      '.workspace__window-rotation-control--left',
    );
    const rotationRightButton = workspace.querySelector(
      '.workspace__window-rotation-control--right',
    );
    const rotationResetButton = workspace.querySelector('.workspace__window-rotation-reset');
    const rotationDisplay = workspace.querySelector('.workspace__window-rotation-display');

    if (
      !windowElement ||
      !renameButton ||
      !titleInput ||
      !titleLabel ||
      !pinButton ||
      !duplicateButton ||
      !maximizeButton ||
      !colorButton ||
      !notesInput ||
      !pageForm ||
      !pageInput ||
      !firstButton ||
      !historyBackButton ||
      !historyForwardButton ||
      !prevButton ||
      !nextButton ||
      !lastButton ||
      !zoomOutButton ||
      !zoomInButton ||
      !zoomResetButton ||
      !rotationLeftButton ||
      !rotationRightButton ||
      !rotationResetButton ||
      !rotationDisplay
    ) {
      throw new Error('rename controls must exist for the test');
    }

    storageMocks.persist.mockClear();

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-title-change', handler);

    renameButton.click();
    await flushPromises();

    titleInput.value = '遭遇表';
    titleInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.title).toBe('遭遇表');
    expect(windowElement.dataset.windowTitle).toBe('遭遇表');
    expect(titleLabel.textContent).toBe('遭遇表');
    expect(titleInput.placeholder).toBe('遭遇表');
    expect(windowElement.getAttribute('aria-label')).toBe('遭遇表 のウィンドウ');
    expect(pinButton.getAttribute('aria-label')).toBe('遭遇表 を前面に固定');
    expect(duplicateButton.getAttribute('aria-label')).toBe('遭遇表 を別ウィンドウで複製');
    expect(maximizeButton.getAttribute('aria-label')).toBe('遭遇表 を最大化');
    expect(colorButton.getAttribute('aria-label')).toBe('遭遇表 の色を切り替え (現在: 標準)');
    expect(notesInput.getAttribute('aria-label')).toBe('遭遇表 のメモ');
    expect(pageForm.getAttribute('aria-label')).toBe('遭遇表 の表示ページを設定');
    expect(pageInput.getAttribute('aria-label')).toBe('遭遇表 の表示ページ番号');
    expect(historyBackButton.getAttribute('aria-label')).toBe('遭遇表 のページ履歴を戻る');
    expect(historyForwardButton.getAttribute('aria-label')).toBe(
      '遭遇表 のページ履歴を進む',
    );
    expect(firstButton.getAttribute('aria-label')).toBe('遭遇表 の最初のページへ移動');
    expect(prevButton.getAttribute('aria-label')).toBe('遭遇表 の前のページへ移動');
    expect(nextButton.getAttribute('aria-label')).toBe('遭遇表 の次のページへ移動');
    expect(lastButton.getAttribute('aria-label')).toBe('遭遇表 の最後のページへ移動');
    expect(zoomOutButton.getAttribute('aria-label')).toBe('遭遇表 を縮小表示');
    expect(zoomInButton.getAttribute('aria-label')).toBe('遭遇表 を拡大表示');
    expect(zoomResetButton.getAttribute('aria-label')).toBe('遭遇表 の表示倍率をリセット');
    expect(rotationLeftButton.getAttribute('aria-label')).toBe('遭遇表 を反時計回りに回転');
    expect(rotationRightButton.getAttribute('aria-label')).toBe('遭遇表 を時計回りに回転');
    expect(rotationResetButton.getAttribute('aria-label')).toBe('遭遇表 の回転をリセット');
    expect(maximizeButton.textContent).toBe('最大化');
    expect(maximizeButton.getAttribute('aria-pressed')).toBe('false');
    expect(renameButton.textContent).toBe('名称変更');
    expect(colorButton.textContent).toBe('色: 標準');
    expect(windowElement.dataset.windowColor).toBe('neutral');
    expect(rotationDisplay.textContent).toBe('0°');

    const renamePersist =
      storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!renamePersist) {
      throw new Error('rename persistence call is required');
    }

    expect(renamePersist[0].title).toBe('遭遇表');
    expect(renamePersist[0].color).toBe('neutral');
    expect(renamePersist[0].rotation).toBe(0);
    expect(renamePersist[0].bookmarks).toEqual([]);

    renameButton.click();
    await flushPromises();

    titleInput.value = '   ';
    titleInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.title).toBe('rename.pdf');
    expect(windowElement.dataset.windowTitle).toBe('rename.pdf');
    expect(titleLabel.textContent).toBe('rename.pdf');
    expect(renameButton.textContent).toBe('名称変更');
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
    expect(state.color).toBe('neutral');
    expect(state.bookmarks).toEqual([]);
  });

  it('manages bookmarks via the toolbar, emits events, and persists updates', async () => {
    const workspace = createWorkspace();
    const file = new File(['bookmark'], 'bookmark.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 8 });

    const windowElement = workspace.querySelector('.workspace__window');
    const bookmarkAddButton = workspace.querySelector('.workspace__window-bookmark-add');
    const bookmarkPrevButton = workspace.querySelector('.workspace__window-bookmark-prev');
    const bookmarkNextButton = workspace.querySelector('.workspace__window-bookmark-next');
    const bookmarksList = workspace.querySelector('.workspace__window-bookmarks-list');
    const bookmarksEmpty = workspace.querySelector('.workspace__window-bookmarks-empty');
    const bookmarkStatus = workspace.querySelector('.workspace__window-bookmarks-status');
    const pageForm = workspace.querySelector('.workspace__window-page');
    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (
      !windowElement ||
      !(bookmarkAddButton instanceof HTMLButtonElement) ||
      !(bookmarkPrevButton instanceof HTMLButtonElement) ||
      !(bookmarkNextButton instanceof HTMLButtonElement) ||
      !(bookmarksList instanceof HTMLElement) ||
      !(bookmarksEmpty instanceof HTMLElement) ||
      !(bookmarkStatus instanceof HTMLElement) ||
      !pageForm ||
      !(pageInput instanceof HTMLInputElement)
    ) {
      throw new Error('bookmark controls must exist for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-bookmarks-change', handler);

    storageMocks.persist.mockClear();

    expect(windowElement.dataset.bookmarkCount).toBe('0');
    expect(bookmarkAddButton.disabled).toBe(false);
    expect(bookmarkPrevButton.disabled).toBe(true);
    expect(bookmarkNextButton.disabled).toBe(true);
    expect(windowElement.dataset.bookmarkPrevious).toBeUndefined();
    expect(windowElement.dataset.bookmarkNext).toBeUndefined();
    expect(bookmarksEmpty.hidden).toBe(false);

    bookmarkAddButton.click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    const firstDetail = handler.mock.calls[0][0].detail;
    expect(firstDetail.action).toBe('add');
    expect(firstDetail.page).toBe(1);
    expect(firstDetail.bookmarks).toEqual([1]);
    expect(windowElement.dataset.bookmarkCount).toBe('1');
    expect(windowElement.dataset.bookmarkPages).toBe('1');
    expect(bookmarkAddButton.disabled).toBe(true);
    expect(bookmarkPrevButton.disabled).toBe(true);
    expect(bookmarkNextButton.disabled).toBe(true);
    expect(windowElement.dataset.bookmarkPrevious).toBeUndefined();
    expect(windowElement.dataset.bookmarkNext).toBeUndefined();
    expect(bookmarksEmpty.hidden).toBe(true);
    expect(bookmarkStatus.textContent).toBe('1ページ目を保存しました。');
    expect(bookmarkStatus.hidden).toBe(false);

    const firstItem = bookmarksList.querySelector('[data-bookmark-page="1"]');
    expect(firstItem).not.toBeNull();

    pageInput.value = '3';
    pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(bookmarkAddButton.disabled).toBe(false);
    expect(bookmarkPrevButton.disabled).toBe(false);
    expect(bookmarkNextButton.disabled).toBe(true);
    expect(windowElement.dataset.bookmarkPrevious).toBe('1');
    expect(windowElement.dataset.bookmarkNext).toBeUndefined();

    bookmarkAddButton.click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(2);
    const secondDetail = handler.mock.calls[1][0].detail;
    expect(secondDetail.action).toBe('add');
    expect(secondDetail.page).toBe(3);
    expect(secondDetail.bookmarks).toEqual([1, 3]);
    expect(windowElement.dataset.bookmarkCount).toBe('2');
    expect(windowElement.dataset.bookmarkPages).toBe('1,3');
    expect(bookmarkPrevButton.disabled).toBe(false);
    expect(bookmarkNextButton.disabled).toBe(true);
    expect(windowElement.dataset.bookmarkPrevious).toBe('1');
    expect(windowElement.dataset.bookmarkNext).toBeUndefined();

    const removeFirst = bookmarksList.querySelector(
      '[data-bookmark-page="1"] .workspace__window-bookmark-remove',
    );

    if (!(removeFirst instanceof HTMLButtonElement)) {
      throw new Error('bookmark remove control must exist');
    }

    storageMocks.persist.mockClear();
    removeFirst.click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(3);
    const thirdDetail = handler.mock.calls[2][0].detail;
    expect(thirdDetail.action).toBe('remove');
    expect(thirdDetail.page).toBe(1);
    expect(thirdDetail.bookmarks).toEqual([3]);
    expect(windowElement.dataset.bookmarkCount).toBe('1');
    expect(windowElement.dataset.bookmarkPages).toBe('3');
    expect(bookmarkPrevButton.disabled).toBe(true);
    expect(bookmarkNextButton.disabled).toBe(true);
    expect(windowElement.dataset.bookmarkPrevious).toBeUndefined();
    expect(windowElement.dataset.bookmarkNext).toBeUndefined();

    const lastPersist =
      storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!lastPersist) {
      throw new Error('bookmark persistence call is required');
    }

    const [state] = lastPersist;
    expect(state.bookmarks).toEqual([3]);

    bookmarkAddButton.click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(3);

    const removeRemaining = bookmarksList.querySelector(
      '[data-bookmark-page="3"] .workspace__window-bookmark-remove',
    );

    if (!(removeRemaining instanceof HTMLButtonElement)) {
      throw new Error('bookmark removal control must exist');
    }

    removeRemaining.click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(4);
    const finalDetail = handler.mock.calls[3][0].detail;
    expect(finalDetail.action).toBe('remove');
    expect(finalDetail.bookmarks).toEqual([]);
    expect(windowElement.dataset.bookmarkCount).toBe('0');
    expect(windowElement.dataset.bookmarkPages).toBeUndefined();
    expect(bookmarkAddButton.disabled).toBe(false);
    expect(bookmarkPrevButton.disabled).toBe(true);
    expect(bookmarkNextButton.disabled).toBe(true);
    expect(windowElement.dataset.bookmarkPrevious).toBeUndefined();
    expect(windowElement.dataset.bookmarkNext).toBeUndefined();
    expect(bookmarksEmpty.hidden).toBe(false);
    expect(bookmarkStatus.textContent).toBe('ブックマークはすべて削除されました。');
  });

  it('navigates bookmarks via toolbar buttons and keyboard shortcuts', async () => {
    const workspace = createWorkspace();
    const file = new File(['bookmark-nav'], 'bookmark-nav.pdf', {
      type: 'application/pdf',
    });

    await openWindow(workspace, file, { totalPages: 9 });

    const windowElement = workspace.querySelector('.workspace__window');
    const viewer = workspace.querySelector('.workspace__window-viewer');
    const bookmarkAddButton = workspace.querySelector('.workspace__window-bookmark-add');
    const bookmarkPrevButton = workspace.querySelector('.workspace__window-bookmark-prev');
    const bookmarkNextButton = workspace.querySelector('.workspace__window-bookmark-next');
    const bookmarkStatus = workspace.querySelector('.workspace__window-bookmarks-status');
    const pageForm = workspace.querySelector('.workspace__window-page');
    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (
      !windowElement ||
      !(viewer instanceof HTMLElement) ||
      !(bookmarkAddButton instanceof HTMLButtonElement) ||
      !(bookmarkPrevButton instanceof HTMLButtonElement) ||
      !(bookmarkNextButton instanceof HTMLButtonElement) ||
      !(bookmarkStatus instanceof HTMLElement) ||
      !pageForm ||
      !(pageInput instanceof HTMLInputElement)
    ) {
      throw new Error('bookmark navigation controls must exist for the test');
    }

    const jumpHandler = vi.fn();
    workspace.addEventListener('workspace:window-bookmark-jump', jumpHandler);

    const setPage = async (page) => {
      pageInput.value = String(page);
      pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    };

    await setPage(2);
    bookmarkAddButton.click();
    await flushPromises();

    await setPage(5);
    bookmarkAddButton.click();
    await flushPromises();

    await setPage(8);
    bookmarkAddButton.click();
    await flushPromises();

    await setPage(5);

    expect(bookmarkPrevButton.disabled).toBe(false);
    expect(bookmarkNextButton.disabled).toBe(false);
    expect(windowElement.dataset.bookmarkPrevious).toBe('2');
    expect(windowElement.dataset.bookmarkNext).toBe('8');

    bookmarkNextButton.click();
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(1);
    const nextDetail = jumpHandler.mock.calls[0][0].detail;
    expect(nextDetail.page).toBe(8);
    expect(nextDetail.source).toBe('next-button');
    expect(nextDetail.previous).toBe(5);
    expect(nextDetail.next).toBeNull();
    expect(viewer.dataset.page).toBe('8');
    expect(bookmarkPrevButton.disabled).toBe(false);
    expect(bookmarkNextButton.disabled).toBe(true);
    expect(windowElement.dataset.bookmarkPrevious).toBe('5');
    expect(windowElement.dataset.bookmarkNext).toBeUndefined();

    windowElement.focus();
    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '.', bubbles: true, cancelable: true }),
    );
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(1);
    expect(bookmarkStatus.textContent).toBe('後ろのブックマークはありません。');
    expect(bookmarkStatus.classList.contains('workspace__window-bookmarks-status--error')).toBe(
      true,
    );

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: ',', bubbles: true, cancelable: true }),
    );
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(2);
    const previousDetail = jumpHandler.mock.calls[1][0].detail;
    expect(previousDetail.page).toBe(5);
    expect(previousDetail.source).toBe('keyboard-previous');
    expect(previousDetail.previous).toBe(2);
    expect(previousDetail.next).toBe(8);
    expect(viewer.dataset.page).toBe('5');
    expect(bookmarkPrevButton.disabled).toBe(false);
    expect(bookmarkNextButton.disabled).toBe(false);
    expect(windowElement.dataset.bookmarkPrevious).toBe('2');
    expect(windowElement.dataset.bookmarkNext).toBe('8');
    expect(bookmarkStatus.textContent).toBe('5ページ目へ移動しました。');
    expect(
      bookmarkStatus.classList.contains('workspace__window-bookmarks-status--error'),
    ).toBe(false);

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '.', bubbles: true, cancelable: true }),
    );
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(3);
    const keyboardNextDetail = jumpHandler.mock.calls[2][0].detail;
    expect(keyboardNextDetail.page).toBe(8);
    expect(keyboardNextDetail.source).toBe('keyboard-next');
    expect(keyboardNextDetail.previous).toBe(5);
    expect(keyboardNextDetail.next).toBeNull();
    expect(viewer.dataset.page).toBe('8');

    bookmarkPrevButton.click();
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(4);
    const buttonPrevDetail = jumpHandler.mock.calls[3][0].detail;
    expect(buttonPrevDetail.page).toBe(5);
    expect(buttonPrevDetail.source).toBe('previous-button');
    expect(buttonPrevDetail.previous).toBe(2);
    expect(buttonPrevDetail.next).toBe(8);
    expect(windowElement.dataset.bookmarkPrevious).toBe('2');
    expect(windowElement.dataset.bookmarkNext).toBe('8');

    bookmarkPrevButton.click();
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(5);
    const toFirstDetail = jumpHandler.mock.calls[4][0].detail;
    expect(toFirstDetail.page).toBe(2);
    expect(toFirstDetail.previous).toBeNull();
    expect(toFirstDetail.next).toBe(5);
    expect(viewer.dataset.page).toBe('2');
    expect(bookmarkPrevButton.disabled).toBe(true);
    expect(bookmarkNextButton.disabled).toBe(false);
    expect(windowElement.dataset.bookmarkPrevious).toBeUndefined();
    expect(windowElement.dataset.bookmarkNext).toBe('5');

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: ',', bubbles: true, cancelable: true }),
    );
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(5);
    expect(bookmarkStatus.textContent).toBe('前のブックマークはありません。');
    expect(bookmarkStatus.classList.contains('workspace__window-bookmarks-status--error')).toBe(
      true,
    );

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '.', bubbles: true, cancelable: true }),
    );
    await flushPromises();

    expect(jumpHandler).toHaveBeenCalledTimes(6);
    const wrapForwardDetail = jumpHandler.mock.calls[5][0].detail;
    expect(wrapForwardDetail.page).toBe(5);
    expect(wrapForwardDetail.previous).toBe(2);
    expect(wrapForwardDetail.next).toBe(8);
    expect(viewer.dataset.page).toBe('5');
  });

  it('cycles window colors, emits change events, and persists selection', async () => {
    const workspace = createWorkspace();
    const file = new File(['color'], 'color.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const colorButton = workspace.querySelector('.workspace__window-color');

    if (!windowElement || !colorButton) {
      throw new Error('color controls must exist for the test');
    }

    expect(windowElement.dataset.windowColor).toBe('neutral');
    expect(colorButton.textContent).toBe('色: 標準');

    storageMocks.persist.mockClear();

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-color-change', handler);

    colorButton.click();
    await flushPromises();

    expect(windowElement.dataset.windowColor).toBe('amber');
    expect(windowElement.classList.contains('workspace__window--color-amber')).toBe(true);
    expect(colorButton.textContent).toBe('色: 琥珀');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.file).toBe(file);
    expect(handler.mock.calls[0][0].detail.color).toBe('amber');

    colorButton.click();
    await flushPromises();

    expect(windowElement.dataset.windowColor).toBe('emerald');
    expect(windowElement.classList.contains('workspace__window--color-emerald')).toBe(true);
    expect(colorButton.textContent).toBe('色: 翡翠');
    expect(colorButton.getAttribute('aria-label')).toBe('color.pdf の色を切り替え (現在: 翡翠)');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.file).toBe(file);
    expect(handler.mock.calls[1][0].detail.color).toBe('emerald');

    const lastCall = storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!lastCall) {
      throw new Error('color persistence call is required');
    }

    const [state] = lastCall;
    expect(state.color).toBe('emerald');
    expect(state.bookmarks).toEqual([]);
  });

  it('changes window pages through the navigation controls and emits updates', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'pages.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 8 });

    const windowElement = workspace.querySelector('.workspace__window');
    const pageInput = workspace.querySelector('.workspace__window-page-input');
    const pageForm = workspace.querySelector('.workspace__window-page');
    const firstButton = workspace.querySelector('.workspace__window-nav--first');
    const prevButton = workspace.querySelector('.workspace__window-nav--previous');
    const nextButton = workspace.querySelector('.workspace__window-nav--next');
    const lastButton = workspace.querySelector('.workspace__window-nav--last');
    const historyBackButton = workspace.querySelector('.workspace__window-nav--history-back');
    const historyForwardButton = workspace.querySelector(
      '.workspace__window-nav--history-forward',
    );

    if (
      !windowElement ||
      !pageInput ||
      !pageForm ||
      !firstButton ||
      !prevButton ||
      !nextButton ||
      !lastButton ||
      !historyBackButton ||
      !historyForwardButton
    ) {
      throw new Error('page navigation structure is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    expect(firstButton.disabled).toBe(true);
    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);
    expect(lastButton.disabled).toBe(false);
    expect(historyBackButton.disabled).toBe(true);
    expect(historyForwardButton.disabled).toBe(true);
    expect(windowElement.dataset.pageHistoryIndex).toBe('0');
    expect(windowElement.dataset.pageHistoryLength).toBe('1');

    storageMocks.persist.mockClear();

    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.page).toBe(2);
    expect(handler.mock.calls[0][0].detail.totalPages).toBe(8);
    expect(handler.mock.calls[0][0].detail.historyIndex).toBe(1);
    expect(handler.mock.calls[0][0].detail.historyLength).toBe(2);
    expect(pageInput.value).toBe('2');
    expect(firstButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);
    expect(historyBackButton.disabled).toBe(false);
    expect(historyForwardButton.disabled).toBe(true);
    expect(windowElement.dataset.pageHistoryIndex).toBe('1');
    expect(windowElement.dataset.pageHistoryLength).toBe('2');

    pageInput.value = '5';
    pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(5);
    expect(handler.mock.calls[1][0].detail.totalPages).toBe(8);
    expect(handler.mock.calls[1][0].detail.historyIndex).toBe(2);
    expect(handler.mock.calls[1][0].detail.historyLength).toBe(3);
    expect(pageInput.value).toBe('5');
    expect(windowElement.dataset.pageHistoryIndex).toBe('2');
    expect(windowElement.dataset.pageHistoryLength).toBe('3');
    expect(historyForwardButton.disabled).toBe(true);

    prevButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2][0].detail.page).toBe(4);
    expect(handler.mock.calls[2][0].detail.totalPages).toBe(8);
    expect(handler.mock.calls[2][0].detail.historyIndex).toBe(3);
    expect(handler.mock.calls[2][0].detail.historyLength).toBe(4);
    expect(pageInput.value).toBe('4');
    expect(firstButton.disabled).toBe(false);
    expect(windowElement.dataset.pageHistoryIndex).toBe('3');
    expect(windowElement.dataset.pageHistoryLength).toBe('4');
    expect(historyBackButton.disabled).toBe(false);
    expect(historyForwardButton.disabled).toBe(true);

    await flushPromises();

    const lastPersist =
      storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!lastPersist) {
      throw new Error('page navigation persistence call is required');
    }

    const [state] = lastPersist;
    expect(state.pageHistory).toEqual([1, 2, 5, 4]);
    expect(state.pageHistoryIndex).toBe(3);
    expect(state.color).toBe('neutral');
    expect(state.bookmarks).toEqual([]);
  });

  it('jumps directly to the first or last page from toolbar controls', async () => {
    const workspace = createWorkspace();
    const file = new File(['bounds'], 'bounds.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 5 });

    const windowElement = workspace.querySelector('.workspace__window');
    const pageInput = workspace.querySelector('.workspace__window-page-input');
    const firstButton = workspace.querySelector('.workspace__window-nav--first');
    const lastButton = workspace.querySelector('.workspace__window-nav--last');

    if (!windowElement || !pageInput || !firstButton || !lastButton) {
      throw new Error('boundary navigation controls are required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    expect(pageInput.value).toBe('1');
    expect(firstButton.disabled).toBe(true);
    expect(lastButton.disabled).toBe(false);
    expect(windowElement.dataset.pageHistoryIndex).toBe('0');
    expect(windowElement.dataset.pageHistoryLength).toBe('1');

    lastButton.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.page).toBe(5);
    expect(handler.mock.calls[0][0].detail.totalPages).toBe(5);
    expect(handler.mock.calls[0][0].detail.historyIndex).toBe(1);
    expect(handler.mock.calls[0][0].detail.historyLength).toBe(2);
    expect(pageInput.value).toBe('5');
    expect(firstButton.disabled).toBe(false);
    expect(lastButton.disabled).toBe(true);
    expect(windowElement.dataset.pageHistoryIndex).toBe('1');
    expect(windowElement.dataset.pageHistoryLength).toBe('2');

    firstButton.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(1);
    expect(handler.mock.calls[1][0].detail.totalPages).toBe(5);
    expect(handler.mock.calls[1][0].detail.historyIndex).toBe(2);
    expect(handler.mock.calls[1][0].detail.historyLength).toBe(3);
    expect(pageInput.value).toBe('1');
    expect(firstButton.disabled).toBe(true);
    expect(lastButton.disabled).toBe(false);
    expect(windowElement.dataset.pageHistoryIndex).toBe('2');
    expect(windowElement.dataset.pageHistoryLength).toBe('3');
  });

  it('exposes a page slider that mirrors navigation state', async () => {
    const workspace = createWorkspace();
    const file = new File(['slider'], 'slider.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 6 });

    const windowElement = workspace.querySelector('.workspace__window');
    const slider = workspace.querySelector('.workspace__window-page-slider');
    const nextButton = workspace.querySelector('.workspace__window-nav--next');

    if (!windowElement || !(slider instanceof HTMLInputElement) || !nextButton) {
      throw new Error('page slider controls are required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    expect(slider.disabled).toBe(false);
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('6');
    expect(slider.value).toBe('1');

    slider.value = '4';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.page).toBe(4);
    expect(handler.mock.calls[0][0].detail.totalPages).toBe(6);
    expect(slider.value).toBe('4');
    expect(windowElement.dataset.pageHistoryIndex).toBe('1');
    expect(windowElement.dataset.pageHistoryLength).toBe('2');

    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(5);
    expect(slider.value).toBe('5');
    expect(windowElement.dataset.pageHistoryIndex).toBe('2');
    expect(windowElement.dataset.pageHistoryLength).toBe('3');
  });

  it('disables the page slider when total pages are unavailable or singular', async () => {
    const workspace = createWorkspace();
    pdfMocks.state.numPages = Number.NaN;
    const file = new File(['unknown'], 'unknown.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const slider = workspace.querySelector('.workspace__window-page-slider');

    if (!(slider instanceof HTMLInputElement)) {
      throw new Error('page slider element is required for the test');
    }

    expect(slider.disabled).toBe(true);
    expect(slider.hasAttribute('max')).toBe(false);

    const singlePageWorkspace = createWorkspace();
    const singleFile = new File(['single'], 'single.pdf', { type: 'application/pdf' });

    await openWindow(singlePageWorkspace, singleFile, { totalPages: 1 });

    const singleSlider = singlePageWorkspace.querySelector(
      '.workspace__window-page-slider',
    );

    if (!(singleSlider instanceof HTMLInputElement)) {
      throw new Error('single page slider element is required for the test');
    }

    expect(singleSlider.disabled).toBe(true);
    expect(singleSlider.max).toBe('1');
    expect(singleSlider.value).toBe('1');
  });

  it('navigates page history backward, forward, and trims stale entries', async () => {
    const workspace = createWorkspace();
    const file = new File(['history'], 'history.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 12 });

    const windowElement = workspace.querySelector('.workspace__window');
    const pageInput = workspace.querySelector('.workspace__window-page-input');
    const pageForm = workspace.querySelector('.workspace__window-page');
    const nextButton = workspace.querySelector('.workspace__window-nav--next');
    const backButton = workspace.querySelector('.workspace__window-nav--history-back');
    const forwardButton = workspace.querySelector('.workspace__window-nav--history-forward');

    if (
      !windowElement ||
      !pageInput ||
      !pageForm ||
      !nextButton ||
      !backButton ||
      !forwardButton
    ) {
      throw new Error('history navigation controls are required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    storageMocks.persist.mockClear();

    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    pageInput.value = '7';
    pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    pageInput.value = '3';
    pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(windowElement.dataset.pageHistoryIndex).toBe('3');
    expect(windowElement.dataset.pageHistoryLength).toBe('4');
    expect(backButton.disabled).toBe(false);
    expect(forwardButton.disabled).toBe(true);

    backButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(4);
    expect(handler.mock.calls[3][0].detail.page).toBe(7);
    expect(handler.mock.calls[3][0].detail.historyIndex).toBe(2);
    expect(handler.mock.calls[3][0].detail.historyLength).toBe(4);
    expect(windowElement.dataset.pageHistoryIndex).toBe('2');
    expect(forwardButton.disabled).toBe(false);

    backButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(5);
    expect(handler.mock.calls[4][0].detail.page).toBe(2);
    expect(handler.mock.calls[4][0].detail.historyIndex).toBe(1);
    expect(handler.mock.calls[4][0].detail.historyLength).toBe(4);
    expect(windowElement.dataset.pageHistoryIndex).toBe('1');

    pageInput.value = '9';
    pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(handler).toHaveBeenCalledTimes(6);
    expect(handler.mock.calls[5][0].detail.page).toBe(9);
    expect(handler.mock.calls[5][0].detail.historyIndex).toBe(2);
    expect(handler.mock.calls[5][0].detail.historyLength).toBe(3);
    expect(windowElement.dataset.pageHistoryIndex).toBe('2');
    expect(windowElement.dataset.pageHistoryLength).toBe('3');
    expect(forwardButton.disabled).toBe(true);

    await flushPromises();

    const lastPersist =
      storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!lastPersist) {
      throw new Error('history persistence call is required');
    }

    const [state] = lastPersist;
    expect(state.pageHistory).toEqual([1, 2, 9]);
    expect(state.pageHistoryIndex).toBe(2);
    expect(state.color).toBe('neutral');
    expect(state.bookmarks).toEqual([]);
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
    expect(handler.mock.calls[0][0].detail.historyIndex).toBe(1);
    expect(handler.mock.calls[0][0].detail.historyLength).toBe(2);
    expect(windowElement.dataset.pageHistoryIndex).toBe('1');
    expect(windowElement.dataset.pageHistoryLength).toBe('2');

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(1);
    expect(handler.mock.calls[1][0].detail.totalPages).toBe(3);
    expect(handler.mock.calls[1][0].detail.historyIndex).toBe(2);
    expect(handler.mock.calls[1][0].detail.historyLength).toBe(3);
    expect(windowElement.dataset.pageHistoryIndex).toBe('2');
    expect(windowElement.dataset.pageHistoryLength).toBe('3');

    windowElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2][0].detail.page).toBe(3);
    expect(handler.mock.calls[2][0].detail.totalPages).toBe(3);
    expect(handler.mock.calls[2][0].detail.historyIndex).toBe(3);
    expect(handler.mock.calls[2][0].detail.historyLength).toBe(4);
    expect(windowElement.dataset.pageHistoryIndex).toBe('3');
    expect(windowElement.dataset.pageHistoryLength).toBe('4');

    windowElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(4);
    expect(handler.mock.calls[3][0].detail.page).toBe(1);
    expect(handler.mock.calls[3][0].detail.totalPages).toBe(3);
    expect(handler.mock.calls[3][0].detail.historyIndex).toBe(4);
    expect(handler.mock.calls[3][0].detail.historyLength).toBe(5);
    expect(windowElement.dataset.pageHistoryIndex).toBe('4');
    expect(windowElement.dataset.pageHistoryLength).toBe('5');

    pageInput.focus();
    pageInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(4);

    pageInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it('adds bookmarks via the keyboard shortcut when the window is focused', async () => {
    const workspace = createWorkspace();
    const file = new File(['shortcut'], 'shortcut.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 4 });

    const windowElement = workspace.querySelector('.workspace__window');
    const bookmarkAddButton = workspace.querySelector('.workspace__window-bookmark-add');
    const bookmarksList = workspace.querySelector('.workspace__window-bookmarks-list');
    const notesInput = workspace.querySelector('.workspace__window-notes-input');

    if (
      !windowElement ||
      !(bookmarkAddButton instanceof HTMLButtonElement) ||
      !(bookmarksList instanceof HTMLElement)
    ) {
      throw new Error('bookmark shortcut structure is required');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-bookmarks-change', handler);

    windowElement.focus();
    windowElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.action).toBe('add');
    expect(detail.page).toBe(1);
    expect(detail.bookmarks).toEqual([1]);
    expect(windowElement.dataset.bookmarkCount).toBe('1');
    expect(bookmarkAddButton.disabled).toBe(true);
    expect(bookmarksList.querySelector('[data-bookmark-page="1"]')).not.toBeNull();

    if (notesInput instanceof HTMLTextAreaElement) {
      notesInput.focus();
      notesInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
      await flushPromises();
    }

    expect(handler).toHaveBeenCalledTimes(1);
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
    expect(handler.mock.calls[0][0].detail.mode).toBe('manual');
    expect(zoomDisplay.textContent).toBe('110%');

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '0', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.zoom).toBeCloseTo(1.0, 2);
    expect(handler.mock.calls[1][0].detail.mode).toBe('manual');
    expect(zoomDisplay.textContent).toBe('100%');

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: '+', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2][0].detail.zoom).toBeCloseTo(1.1, 2);
    expect(handler.mock.calls[2][0].detail.mode).toBe('manual');
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

    const windowElement = workspace.querySelector('.workspace__window');
    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (!windowElement || !pageInput) {
      throw new Error('page input is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    pageInput.value = '0';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    expect(pageInput.value).toBe('1');
    expect(windowElement.dataset.pageHistoryIndex).toBe('0');
    expect(windowElement.dataset.pageHistoryLength).toBe('1');

    pageInput.value = '   ';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    expect(pageInput.value).toBe('1');
    expect(windowElement.dataset.pageHistoryIndex).toBe('0');
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
    expect(handler.mock.calls[0][0].detail.mode).toBe('manual');
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
    expect(lastCallAfterMax[0].detail.mode).toBe('manual');
    expect(zoomDisplay.textContent).toBe('200%');
    expect(zoomIn.disabled).toBe(true);

    zoomOut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const afterDecrease = handler.mock.calls[handler.mock.calls.length - 1];

    if (!afterDecrease) {
      throw new Error('zoom handler must receive decrease event');
    }

    expect(afterDecrease[0].detail.zoom).toBeCloseTo(1.9, 2);
    expect(afterDecrease[0].detail.page).toBe(1);
    expect(afterDecrease[0].detail.mode).toBe('manual');
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

  it('fits the viewer to the available width and full page height', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'fit.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 6 });

    const windowElement = workspace.querySelector('.workspace__window');
    const viewer = workspace.querySelector('.workspace__window-viewer');
    const fitWidthButton = workspace.querySelector('.workspace__window-zoom-fit--width');
    const fitPageButton = workspace.querySelector('.workspace__window-zoom-fit--page');
    const zoomDisplay = workspace.querySelector('.workspace__window-zoom-display');
    const zoomInButton = workspace.querySelector('.workspace__window-zoom-control--in');
    const zoomResetButton = workspace.querySelector('.workspace__window-zoom-reset');

    if (
      !windowElement ||
      !(viewer instanceof HTMLElement) ||
      !(fitWidthButton instanceof HTMLButtonElement) ||
      !(fitPageButton instanceof HTMLButtonElement) ||
      !zoomDisplay ||
      !(zoomInButton instanceof HTMLButtonElement) ||
      !(zoomResetButton instanceof HTMLButtonElement)
    ) {
      throw new Error('fit controls are required for the test');
    }

    viewer.style.padding = '16px';
    viewer.getBoundingClientRect = () => ({
      width: 640,
      height: 520,
      top: 0,
      left: 0,
      right: 640,
      bottom: 520,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const originalGetComputedStyle = window.getComputedStyle;
    const styleSpy = vi.spyOn(window, 'getComputedStyle');
    styleSpy.mockImplementation((element) => {
      if (element === viewer) {
        return {
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingTop: '16px',
          paddingBottom: '16px',
        };
      }

      return originalGetComputedStyle.call(window, element);
    });
    Object.defineProperty(viewer, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(viewer, 'clientHeight', { value: 520, configurable: true });

    fitWidthButton.disabled = false;
    fitPageButton.disabled = false;

    zoomInButton.click();
    await flushPromises();
    zoomResetButton.click();
    await flushPromises();

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-zoom-change', handler);

    fitWidthButton.click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.mode).toBe('fit-width');
    expect(handler.mock.calls[0][0].detail.zoom).toBeCloseTo(1.01, 2);
    expect(windowElement.dataset.zoomFitMode).toBe('fit-width');
    expect(viewer.dataset.zoom).toBe('1.01');
    expect(viewer.dataset.viewportWidth).toBe('606');
    expect(viewer.dataset.viewportHeight).toBe('808');
    expect(windowElement.dataset.zoomFitWidth).toBe('1.01');
    expect(zoomDisplay.textContent).toBe('101%');
    expect(fitWidthButton.disabled).toBe(true);
    expect(fitWidthButton.getAttribute('aria-pressed')).toBe('true');
    expect(fitPageButton.disabled).toBe(false);
    expect(fitPageButton.getAttribute('aria-pressed')).toBe('false');

    fitPageButton.click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.mode).toBe('fit-page');
    expect(handler.mock.calls[1][0].detail.zoom).toBeCloseTo(0.61, 2);
    expect(windowElement.dataset.zoomFitMode).toBe('fit-page');
    expect(windowElement.dataset.zoomFitPage).toBe('0.61');
    expect(viewer.dataset.zoom).toBe('0.61');
    expect(viewer.dataset.viewportWidth).toBe('366');
    expect(viewer.dataset.viewportHeight).toBe('488');
    expect(zoomDisplay.textContent).toBe('61%');
    expect(fitPageButton.disabled).toBe(true);
    expect(fitPageButton.getAttribute('aria-pressed')).toBe('true');
    expect(fitWidthButton.disabled).toBe(false);
    expect(fitWidthButton.getAttribute('aria-pressed')).toBe('false');
    styleSpy.mockRestore();
  });

  it('clears fit mode metadata when manual zoom is used after fitting', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'fit-reset.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');
    const viewer = workspace.querySelector('.workspace__window-viewer');
    const fitWidthButton = workspace.querySelector('.workspace__window-zoom-fit--width');
    const zoomInButton = workspace.querySelector('.workspace__window-zoom-control--in');
    const zoomResetButton = workspace.querySelector('.workspace__window-zoom-reset');

    if (
      !windowElement ||
      !(viewer instanceof HTMLElement) ||
      !(fitWidthButton instanceof HTMLButtonElement) ||
      !(zoomInButton instanceof HTMLButtonElement) ||
      !(zoomResetButton instanceof HTMLButtonElement)
    ) {
      throw new Error('fit reset controls are required for the test');
    }

    viewer.style.padding = '16px';
    viewer.getBoundingClientRect = () => ({
      width: 640,
      height: 520,
      top: 0,
      left: 0,
      right: 640,
      bottom: 520,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const originalGetComputedStyle = window.getComputedStyle;
    const styleSpy = vi.spyOn(window, 'getComputedStyle');
    styleSpy.mockImplementation((element) => {
      if (element === viewer) {
        return {
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingTop: '16px',
          paddingBottom: '16px',
        };
      }

      return originalGetComputedStyle.call(window, element);
    });
    Object.defineProperty(viewer, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(viewer, 'clientHeight', { value: 520, configurable: true });

    fitWidthButton.disabled = false;

    zoomInButton.click();
    await flushPromises();
    zoomResetButton.click();
    await flushPromises();

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-zoom-change', handler);

    fitWidthButton.click();
    await flushPromises();

    expect(windowElement.dataset.zoomFitMode).toBe('fit-width');
    expect(fitWidthButton.getAttribute('aria-pressed')).toBe('true');

    zoomInButton.click();
    await flushPromises();

    const lastCall = handler.mock.calls[handler.mock.calls.length - 1];

    if (!lastCall) {
      throw new Error('manual zoom event should be recorded');
    }

    expect(lastCall[0].detail.mode).toBe('manual');
    expect(windowElement.dataset.zoomFitMode).toBe('manual');
    expect(fitWidthButton.getAttribute('aria-pressed')).toBe('false');
    expect(fitWidthButton.disabled).toBe(false);
    styleSpy.mockRestore();
  });

  it('cycles focus between windows with keyboard shortcuts and emits events', async () => {
    const baseTime = Date.now();
    const nowSpy = vi.spyOn(Date, 'now');
    let tick = 0;
    nowSpy.mockImplementation(() => baseTime + tick++ * 1000);

    try {
      const workspace = createWorkspace();
      const fileA = new File(['dummy-a'], 'cycle-a.pdf', { type: 'application/pdf' });
      const fileB = new File(['dummy-b'], 'cycle-b.pdf', { type: 'application/pdf' });
      const fileC = new File(['dummy-c'], 'cycle-c.pdf', { type: 'application/pdf' });

      await openWindow(workspace, fileA);
      await openWindow(workspace, fileB);
      await openWindow(workspace, fileC);

      const windows = workspace.querySelectorAll('.workspace__window');

      if (windows.length !== 3) {
        throw new Error('three windows are required for focus cycling tests');
      }

      const [firstWindow, secondWindow, thirdWindow] = windows;
      const handler = vi.fn();
      workspace.addEventListener('workspace:window-focus-cycle', handler);

      const previousFocusTimestamp = Number(secondWindow.dataset.lastFocusedAt || '0');
      expect(Number.isFinite(previousFocusTimestamp)).toBe(true);

      workspace.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: ']',
          code: 'BracketRight',
          bubbles: true,
          cancelable: true,
        }),
      );

      await flushPromises();

      expect(handler).toHaveBeenCalledTimes(1);
      const firstCallEvent = handler.mock.calls[0][0];
      expect(firstCallEvent.detail.direction).toBe('next');
      expect(firstCallEvent.detail.windowId).toBe(secondWindow.dataset.windowId);
      expect(firstCallEvent.detail.totalWindows).toBe(3);
      const activeWindowAfterNext = workspace.querySelector('.workspace__window--active');
      expect(activeWindowAfterNext).toBe(secondWindow);
      expect(secondWindow.classList.contains('workspace__window--active')).toBe(true);
      expect(thirdWindow.classList.contains('workspace__window--active')).toBe(false);
      const updatedFocusTimestamp = Number(secondWindow.dataset.lastFocusedAt || '0');
      expect(Number.isFinite(updatedFocusTimestamp)).toBe(true);
      expect(updatedFocusTimestamp).toBeGreaterThan(previousFocusTimestamp);

      handler.mockClear();

      workspace.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '[',
          code: 'BracketLeft',
          bubbles: true,
          cancelable: true,
        }),
      );

      await flushPromises();

      expect(handler).toHaveBeenCalledTimes(1);
      const secondCallEvent = handler.mock.calls[0][0];
      expect(secondCallEvent.detail.direction).toBe('previous');
      expect(secondCallEvent.detail.windowId).toBe(firstWindow.dataset.windowId);
      expect(secondCallEvent.detail.title).toContain('cycle-a.pdf');
      const activeWindowAfterPrevious = workspace.querySelector('.workspace__window--active');
      expect(activeWindowAfterPrevious).toBe(firstWindow);
      expect(firstWindow.classList.contains('workspace__window--active')).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('ignores focus cycling shortcuts when only one window is open', async () => {
    const workspace = createWorkspace();
    const file = new File(['single'], 'single.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');

    if (!windowElement) {
      throw new Error('a window should exist for the single-window test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-focus-cycle', handler);

    workspace.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ']',
        code: 'BracketRight',
        bubbles: true,
        cancelable: true,
      }),
    );

    await flushPromises();

    expect(handler).not.toHaveBeenCalled();
    const activeWindow = workspace.querySelector('.workspace__window--active');
    expect(activeWindow).toBe(windowElement);
  });

  it('adjusts rotation via toolbar controls and emits updates', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'rotation.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file, { totalPages: 4 });

    const windowElement = workspace.querySelector('.workspace__window');
    const viewerElement = workspace.querySelector('.workspace__window-viewer');
    const rotateLeft = workspace.querySelector('.workspace__window-rotation-control--left');
    const rotateRight = workspace.querySelector('.workspace__window-rotation-control--right');
    const rotateReset = workspace.querySelector('.workspace__window-rotation-reset');
    const rotationDisplay = workspace.querySelector('.workspace__window-rotation-display');

    if (
      !windowElement ||
      !viewerElement ||
      !rotateLeft ||
      !rotateRight ||
      !rotateReset ||
      !rotationDisplay
    ) {
      throw new Error('rotation controls must exist for the test');
    }

    expect(rotationDisplay.textContent).toBe('0°');
    expect(rotateReset.disabled).toBe(true);
    expect(windowElement.dataset.rotation).toBe('0');
    expect(viewerElement.dataset.rotation).toBe('0');

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-rotation-change', handler);

    rotateRight.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.rotation).toBe(90);
    expect(handler.mock.calls[0][0].detail.page).toBe(1);
    expect(handler.mock.calls[0][0].detail.zoom).toBeCloseTo(1, 2);
    expect(windowElement.dataset.rotation).toBe('90');
    expect(viewerElement.dataset.rotation).toBe('90');
    expect(rotationDisplay.textContent).toBe('90°');
    expect(rotateReset.disabled).toBe(false);

    rotateRight.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.rotation).toBe(180);
    expect(windowElement.dataset.rotation).toBe('180');
    expect(rotationDisplay.textContent).toBe('180°');

    rotateLeft.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2][0].detail.rotation).toBe(90);
    expect(windowElement.dataset.rotation).toBe('90');

    rotateLeft.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(4);
    expect(handler.mock.calls[3][0].detail.rotation).toBe(0);
    expect(windowElement.dataset.rotation).toBe('0');
    expect(rotationDisplay.textContent).toBe('0°');
    expect(rotateReset.disabled).toBe(true);

    rotateLeft.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(5);
    expect(handler.mock.calls[4][0].detail.rotation).toBe(270);
    expect(windowElement.dataset.rotation).toBe('270');
    expect(viewerElement.dataset.rotation).toBe('270');
    expect(rotationDisplay.textContent).toBe('270°');
    expect(rotateReset.disabled).toBe(false);

    rotateReset.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(6);
    expect(handler.mock.calls[5][0].detail.rotation).toBe(0);
    expect(windowElement.dataset.rotation).toBe('0');
    expect(viewerElement.dataset.rotation).toBe('0');
    expect(rotationDisplay.textContent).toBe('0°');
    expect(rotateReset.disabled).toBe(true);

    await flushPromises();

    const lastPersist = storageMocks.persist.mock.calls[storageMocks.persist.mock.calls.length - 1];

    if (!lastPersist) {
      throw new Error('rotation persistence call is required');
    }

    expect(lastPersist[0].rotation).toBe(0);
    expect(lastPersist[0].bookmarks).toEqual([]);
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

    const button = workspace.querySelector('.workspace__maintenance-button--clear');

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

    const button = workspace.querySelector('.workspace__maintenance-button--clear');

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

    const button = workspace.querySelector('.workspace__maintenance-button--clear');

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

  it('exports a session snapshot via the maintenance controls', async () => {
    const workspace = createWorkspace();
    const exportBlob = new Blob(['{"version":1}'], { type: 'application/json' });

    storageMocks.exportSnapshot.mockResolvedValueOnce({
      blob: exportBlob,
      windows: 3,
      compression: 'none',
    });

    const exportButton = workspace.querySelector('.workspace__maintenance-button--export');

    if (!exportButton) {
      throw new Error('maintenance export control is required');
    }

    const exportedHandler = vi.fn();
    workspace.addEventListener('workspace:session-exported', exportedHandler);

    exportButton.click();

    await flushPromises();

    expect(storageMocks.exportSnapshot).toHaveBeenCalledTimes(1);
    expect(storageMocks.exportSnapshot).toHaveBeenCalledWith({
      windowIds: null,
      compression: 'gzip',
    });
    expect(createObjectURLSpy).toHaveBeenCalledWith(exportBlob);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:session');

    expect(exportedHandler).toHaveBeenCalledTimes(1);
    const detail = exportedHandler.mock.calls[0][0].detail;
    expect(detail.windows).toBe(3);
    expect(detail.fileName).toMatch(/^gmworkbench-session-\d{8}-\d{6}\.json$/);

    const status = workspace.querySelector('.workspace__maintenance-status');

    if (!status) {
      throw new Error('maintenance status element is required');
    }

    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('セッションを書き出しました');
    expect(status.classList.contains('workspace__maintenance-status--error')).toBe(false);
  });

  it('shows a warning message when scoped export has no targets', async () => {
    const workspace = createWorkspace();
    await flushPromises();

    const scopeOpen = workspace.querySelector('input[value="open"]');
    const exportButton = workspace.querySelector('.workspace__maintenance-button--export');

    if (!(scopeOpen instanceof HTMLInputElement) || !exportButton) {
      throw new Error('maintenance export controls are required');
    }

    scopeOpen.checked = true;
    exportButton.click();

    await flushPromises();

    expect(storageMocks.exportSnapshot).not.toHaveBeenCalled();

    const status = workspace.querySelector('.workspace__maintenance-status');

    if (!status) {
      throw new Error('maintenance status element is required');
    }

    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('書き出すウィンドウがありません。');
  });

  it('imports a session snapshot and replaces open windows', async () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'existing.pdf', { type: 'application/pdf' });

    await openWindow(workspace, file);
    await flushPromises();

    const snapshotFile = new File(['{"version":1}'], 'session.json', {
      type: 'application/json',
    });
    const restoredPdf = new File(['pdf'], 'restored.pdf', { type: 'application/pdf' });

    storageMocks.importSnapshot.mockResolvedValueOnce({
      windows: [
        {
          id: 'window-imported',
          file: restoredPdf,
          page: 2,
          zoom: 1.2,
          openedAt: 10,
          lastFocusedAt: 20,
        },
      ],
      exportedAt: '2025-10-12T00:00:00.000Z',
    });

    const importButton = workspace.querySelector('.workspace__maintenance-button--import');
    const fileInput = workspace.querySelector('.workspace__maintenance-file');

    if (!importButton || !(fileInput instanceof HTMLInputElement)) {
      throw new Error('maintenance import control is required');
    }

    const importedHandler = vi.fn();
    workspace.addEventListener('workspace:session-imported', importedHandler);

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [snapshotFile],
    });

    fileInput.dispatchEvent(new Event('change'));

    await flushPromises();
    await flushPromises();

    expect(storageMocks.importSnapshot).toHaveBeenCalledTimes(1);
    expect(storageMocks.importSnapshot).toHaveBeenCalledWith(snapshotFile);
    expect(storageMocks.clear).toHaveBeenCalledTimes(1);

    const windows = workspace.querySelectorAll('.workspace__window');
    expect(windows).toHaveLength(1);
    expect(windows[0]?.dataset.windowId).toBe('window-imported');

    expect(importedHandler).toHaveBeenCalledTimes(1);
    const importDetail = importedHandler.mock.calls[0][0].detail;
    expect(importDetail.windows).toBe(1);
    expect(importDetail.previous).toBe(1);
    expect(importDetail.exportedAt).toBe('2025-10-12T00:00:00.000Z');

    const status = workspace.querySelector('.workspace__maintenance-status');

    if (!status) {
      throw new Error('maintenance status element is required');
    }

    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('セッションを読み込みました');
    expect(status.classList.contains('workspace__maintenance-status--error')).toBe(false);
  });

  it('shows an error message when the session import fails', async () => {
    const workspace = createWorkspace();
    const snapshotFile = new File(['broken'], 'broken.json', { type: 'application/json' });

    storageMocks.importSnapshot.mockRejectedValueOnce(new Error('invalid snapshot'));

    const fileInput = workspace.querySelector('.workspace__maintenance-file');

    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('maintenance import input is required');
    }

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [snapshotFile],
    });

    fileInput.dispatchEvent(new Event('change'));

    await flushPromises();
    await flushPromises();

    expect(storageMocks.importSnapshot).toHaveBeenCalledTimes(1);
    expect(storageMocks.importSnapshot).toHaveBeenCalledWith(snapshotFile);
    expect(storageMocks.clear).not.toHaveBeenCalled();

    const status = workspace.querySelector('.workspace__maintenance-status');

    if (!status) {
      throw new Error('maintenance status element is required');
    }

    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('読み込みに失敗しました');
    expect(status.classList.contains('workspace__maintenance-status--error')).toBe(true);
  });
});
