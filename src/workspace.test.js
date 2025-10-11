import { describe, expect, it, vi } from 'vitest';
import { createWorkspace } from './workspace.js';

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

  it('opens a window placeholder when an open request is received', () => {
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
    const openRequest = new CustomEvent('workspace:file-open-request', {
      bubbles: true,
      detail: { file },
    });

    workspace.dispatchEvent(openRequest);

    const windowElement = canvas.querySelector('.workspace__window');
    expect(windowElement).not.toBeNull();
    expect(canvas.querySelector('.workspace__canvas-empty')?.hidden).toBe(true);
    expect(
      windowElement?.querySelector('.workspace__window-title')?.textContent,
    ).toBe('window.pdf');
  });

  it('stacks new windows with offsets and updates the active state', () => {
    const workspace = createWorkspace();
    const canvas = workspace.querySelector('.workspace__canvas');

    if (!canvas) {
      throw new Error('canvas element is required for the test');
    }

    const firstFile = new File(['dummy'], 'first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['dummy'], 'second.pdf', { type: 'application/pdf' });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file: firstFile },
      }),
    );

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file: secondFile },
      }),
    );

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

  it('allows dragging windows via the header to update position', () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'drag.pdf', { type: 'application/pdf' });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file },
      }),
    );

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

  it('keeps windows within the canvas bounds while dragging', () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'bounded-drag.pdf', {
      type: 'application/pdf',
    });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file },
      }),
    );

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

  it('resizes windows via the resize handle while enforcing minimum bounds', () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'resize.pdf', { type: 'application/pdf' });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file },
      }),
    );

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

  it('limits window resizing to stay within the canvas bounds', () => {
    const workspace = createWorkspace();

    const file = new File(['dummy'], 'bounded-resize.pdf', {
      type: 'application/pdf',
    });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file },
      }),
    );

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

  it('pins windows so they remain above other documents', () => {
    const workspace = createWorkspace();

    const firstFile = new File(['dummy'], 'pin-first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['dummy'], 'pin-second.pdf', { type: 'application/pdf' });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file: firstFile },
      }),
    );

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file: secondFile },
      }),
    );

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

  it('changes window pages through the navigation controls and emits updates', () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'pages.pdf', { type: 'application/pdf' });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file },
      }),
    );

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

    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.page).toBe(2);
    expect(pageInput.value).toBe('2');
    expect(prevButton.disabled).toBe(false);

    pageInput.value = '5';
    pageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(5);
    expect(pageInput.value).toBe('5');

    prevButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2][0].detail.page).toBe(4);
    expect(pageInput.value).toBe('4');
  });

  it('supports keyboard page navigation when the window is focused', () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'keyboard.pdf', { type: 'application/pdf' });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file },
      }),
    );

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

    windowElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0].detail.page).toBe(1);

    pageInput.focus();
    pageInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('sanitises invalid page input and keeps the current page when left blank', () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'sanitize.pdf', { type: 'application/pdf' });

    workspace.dispatchEvent(
      new CustomEvent('workspace:file-open-request', {
        bubbles: true,
        detail: { file },
      }),
    );

    const pageInput = workspace.querySelector('.workspace__window-page-input');

    if (!pageInput) {
      throw new Error('page input is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-page-change', handler);

    pageInput.value = '0';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.page).toBe(1);
    expect(pageInput.value).toBe('1');

    pageInput.value = '   ';
    pageInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(pageInput.value).toBe('1');
  });

  it('closes windows and emits a closure event', () => {
    const workspace = createWorkspace();
    const file = new File(['dummy'], 'close.pdf', { type: 'application/pdf' });
    const openRequest = new CustomEvent('workspace:file-open-request', {
      bubbles: true,
      detail: { file },
    });

    workspace.dispatchEvent(openRequest);

    const closeButton = workspace.querySelector('.workspace__window-close');

    if (!closeButton) {
      throw new Error('window close control is required for the test');
    }

    const handler = vi.fn();
    workspace.addEventListener('workspace:window-close', handler);

    closeButton.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.file).toBe(file);
    expect(workspace.querySelector('.workspace__window')).toBeNull();
  });
});
