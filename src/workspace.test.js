import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace } from './workspace.js';

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
const originalGetContext = HTMLCanvasElement.prototype.getContext;

if (typeof globalThis.PointerEvent !== 'function') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }

  // eslint-disable-next-line no-global-assign
  globalThis.PointerEvent = PointerEventPolyfill;
}

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
    [1, 'alpha keyword content'],
    [2, 'beta keyword content'],
    [3, 'gamma keyword content'],
    [4, 'delta keyword content'],
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

  URL.createObjectURL = vi.fn(() => 'blob:session');
  URL.revokeObjectURL = vi.fn();

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

  document.body.innerHTML = '';
});

describe('workspace window layout', () => {
  it('renders multiple windows simultaneously with independent layout state', async () => {
    const workspace = createWorkspace();
    document.body.append(workspace);

    const canvasArea = workspace.querySelector('.workspace__windows');

    expect(canvasArea).toBeInstanceOf(HTMLElement);

    if (!(canvasArea instanceof HTMLElement)) {
      throw new Error('workspace canvas area is required for layout tests');
    }

    canvasArea.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 720 });

    await openWindow(workspace, new File(['one'], 'one.pdf', { type: 'application/pdf' }));
    await openWindow(workspace, new File(['two'], 'two.pdf', { type: 'application/pdf' }));

    const windows = workspace.querySelectorAll('.workspace__window');

    expect(windows.length).toBe(2);

    const first = windows[0];
    const second = windows[1];

    expect(first.dataset.windowActive).toBe('false');
    expect(second.dataset.windowActive).toBe('true');
    expect(first.style.left).not.toBe('');
    expect(second.style.left).not.toBe('');
    expect(parseInt(second.style.left, 10)).toBeGreaterThan(parseInt(first.style.left, 10));
  });

  it('updates window position when dragging the header', async () => {
    const workspace = createWorkspace();
    document.body.append(workspace);

    const canvasArea = workspace.querySelector('.workspace__windows');

    expect(canvasArea).toBeInstanceOf(HTMLElement);

    if (!(canvasArea instanceof HTMLElement)) {
      throw new Error('workspace canvas area is required for drag tests');
    }

    canvasArea.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const file = new File(['drag'], 'drag.pdf', { type: 'application/pdf' });
    await openWindow(workspace, file);

    const windowElement = workspace.querySelector('.workspace__window');

    expect(windowElement).toBeInstanceOf(HTMLElement);

    if (!(windowElement instanceof HTMLElement)) {
      throw new Error('window element is required for drag tests');
    }

    const header = windowElement.querySelector('.workspace__window-header');

    expect(header).toBeInstanceOf(HTMLElement);

    if (!(header instanceof HTMLElement)) {
      throw new Error('window header is required for drag tests');
    }

    const initialLeft = parseInt(windowElement.style.left || '0', 10);

    header.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        clientX: initialLeft + 80,
        clientY: 120,
        button: 0,
      }),
    );

    header.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        clientX: initialLeft + 200,
        clientY: 180,
      }),
    );

    header.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 1,
        clientX: initialLeft + 200,
        clientY: 180,
      }),
    );

    await flushPromises();

    const updatedLeft = parseInt(windowElement.style.left || '0', 10);
    const updatedTop = parseInt(windowElement.style.top || '0', 10);
    const windowWidth = parseInt(windowElement.style.width || '0', 10);
    const windowHeight = parseInt(windowElement.style.height || '0', 10);

    expect(updatedLeft).toBeGreaterThan(initialLeft);
    expect(updatedTop).toBeGreaterThanOrEqual(0);
    expect(updatedLeft).toBeLessThanOrEqual(800 - windowWidth);
    expect(updatedTop).toBeLessThanOrEqual(600 - windowHeight);

    const latestPersist = storageMocks.persist.mock.calls.at(-1)?.[0];

    expect(latestPersist?.left).toBe(updatedLeft);
    expect(latestPersist?.top).toBe(updatedTop);
    expect(latestPersist?.maximized).toBe(false);
  });

  it('brings the focused window to the front and updates active state', async () => {
    const workspace = createWorkspace();
    document.body.append(workspace);

    const canvasArea = workspace.querySelector('.workspace__windows');

    expect(canvasArea).toBeInstanceOf(HTMLElement);

    if (!(canvasArea instanceof HTMLElement)) {
      throw new Error('workspace canvas area is required for focus tests');
    }

    canvasArea.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 720 });

    const firstFile = new File(['first'], 'first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['second'], 'second.pdf', { type: 'application/pdf' });

    await openWindow(workspace, firstFile);
    await openWindow(workspace, secondFile);

    const windows = workspace.querySelectorAll('.workspace__window');

    expect(windows.length).toBe(2);

    const firstWindow = windows[0];
    const secondWindow = windows[1];

    const initialFirstZ = parseInt(firstWindow.style.zIndex || '0', 10);
    const initialSecondZ = parseInt(secondWindow.style.zIndex || '0', 10);

    expect(initialSecondZ).toBeGreaterThan(initialFirstZ);

    firstWindow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    firstWindow.focus();

    await flushPromises();

    const focusedFirstZ = parseInt(firstWindow.style.zIndex || '0', 10);
    const focusedSecondZ = parseInt(secondWindow.style.zIndex || '0', 10);

    expect(focusedFirstZ).toBeGreaterThan(focusedSecondZ);
    expect(firstWindow.dataset.windowActive).toBe('true');
    expect(secondWindow.dataset.windowActive).toBe('false');
  });
});
