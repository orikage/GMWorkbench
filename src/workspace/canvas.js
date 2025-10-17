import { createPdfViewer } from '../pdf-viewer.js';
import {
  persistWorkspaceWindow,
  removeWorkspaceWindow,
} from '../workspace-storage.js';
import {
  CANVAS_FALLBACK_HEIGHT,
  CANVAS_FALLBACK_WIDTH,
  DEFAULT_WINDOW_COLOR,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_ROTATION,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_ZOOM,
  MAX_WINDOW_BOOKMARKS,
  MAX_WINDOW_ZOOM,
  MIN_WINDOW_ZOOM,
  PAGE_HISTORY_LIMIT,
  ROTATION_STEP,
  WINDOW_BOOKMARKS_CHANGE_EVENT,
  WINDOW_BOOKMARK_JUMP_EVENT,
  WINDOW_CLOSE_EVENT,
  WINDOW_COLORS,
  WINDOW_COLOR_CHANGE_EVENT,
  WINDOW_DUPLICATE_EVENT,
  WINDOW_FOCUS_CYCLE_EVENT,
  WINDOW_MAXIMIZE_CHANGE_EVENT,
  WINDOW_OUTLINE_JUMP_EVENT,
  WINDOW_PAGE_CHANGE_EVENT,
  WINDOW_PIN_TOGGLE_EVENT,
  WINDOW_NOTES_CHANGE_EVENT,
  WINDOW_ROTATION_CHANGE_EVENT,
  WINDOW_TITLE_CHANGE_EVENT,
  WINDOW_ZOOM_CHANGE_EVENT,
  WINDOW_ZOOM_STEP,
} from './constants.js';
import { createBookmarksWindow } from './window-bookmarks.js';
import { createMemoWindow } from './window-memo.js';
import { createWindowSearch } from './window-search.js';
import { createWindowToolbar } from './window-toolbar.js';

export function createWindowCanvas({ onWindowCountChange } = {}) {
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
  let zIndexCounter = 0;
  let spawnSequence = 0;

  const notifyWindowCountChange = () => {
    if (typeof onWindowCountChange === 'function') {
      onWindowCountChange(windowRegistry.size);
    }
  };

  const syncEmptyState = () => {
    emptyState.hidden = area.children.length > 0;
    notifyWindowCountChange();
  };

  syncEmptyState();

  const createWindowId = (prefix = 'window') => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    const sanitized = typeof prefix === 'string' && prefix.length > 0 ? prefix : 'window';
    return `${sanitized}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };


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

  const clampBoundsToArea = ({ left = 0, top = 0, width = DEFAULT_WINDOW_WIDTH, height = DEFAULT_WINDOW_HEIGHT }) => {
    const areaSize = getAreaSize();
    const safeWidth = Math.min(
      Math.max(160, Number.isFinite(width) ? Math.round(width) : DEFAULT_WINDOW_WIDTH),
      areaSize.width,
    );
    const safeHeight = Math.min(
      Math.max(160, Number.isFinite(height) ? Math.round(height) : DEFAULT_WINDOW_HEIGHT),
      areaSize.height,
    );
    const maxLeft = Math.max(0, Math.round(areaSize.width - safeWidth));
    const maxTop = Math.max(0, Math.round(areaSize.height - safeHeight));
    const safeLeft = Math.min(
      Math.max(0, Number.isFinite(left) ? Math.round(left) : 0),
      maxLeft,
    );
    const safeTop = Math.min(
      Math.max(0, Number.isFinite(top) ? Math.round(top) : 0),
      maxTop,
    );

    return {
      left: safeLeft,
      top: safeTop,
      width: safeWidth,
      height: safeHeight,
    };
  };

  const computeDefaultWindowPosition = (width, height) => {
    spawnSequence += 1;
    const offsetStep = 32;
    const offsetIndex = spawnSequence % 6;
    const offset = offsetIndex * offsetStep;
    const areaSize = getAreaSize();
    const maxLeft = Math.max(0, areaSize.width - width);
    const maxTop = Math.max(0, areaSize.height - height);

    return {
      left: Math.min(offset, maxLeft),
      top: Math.min(offset, maxTop),
    };
  };

  const getNextZIndex = () => {
    zIndexCounter += 1;
    return zIndexCounter;
  };

  const createWindowChrome = ({
    windowElement,
    windowId,
    windowType = 'pdf',
    layout = {},
    initialZIndex = null,
    shouldStartMaximized = false,
    onFocusPersist,
    onLayoutCommit,
    onMaximizeChange,
  } = {}) => {
    if (!(windowElement instanceof HTMLElement)) {
      throw new Error('A valid window element is required.');
    }

    const resizeHandles = [];
    let maximizeButton = null;
    let ignorePointerPredicate = null;

    const preferredWidth = Number.isFinite(layout.width)
      ? Math.round(layout.width)
      : DEFAULT_WINDOW_WIDTH;
    const preferredHeight = Number.isFinite(layout.height)
      ? Math.round(layout.height)
      : DEFAULT_WINDOW_HEIGHT;

    let candidateLeft = Number.isFinite(layout.left) ? Math.round(layout.left) : null;
    let candidateTop = Number.isFinite(layout.top) ? Math.round(layout.top) : null;

    let bounds = clampBoundsToArea({
      left: candidateLeft ?? 0,
      top: candidateTop ?? 0,
      width: preferredWidth,
      height: preferredHeight,
    });

    if (!Number.isFinite(candidateLeft) || !Number.isFinite(candidateTop)) {
      const offset = computeDefaultWindowPosition(bounds.width, bounds.height);
      bounds = clampBoundsToArea({ ...bounds, ...offset });
    }

    let layoutState = {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      restoreLeft: Number.isFinite(layout.restoreLeft)
        ? Math.round(layout.restoreLeft)
        : bounds.left,
      restoreTop: Number.isFinite(layout.restoreTop)
        ? Math.round(layout.restoreTop)
        : bounds.top,
      restoreWidth: Number.isFinite(layout.restoreWidth)
        ? Math.round(layout.restoreWidth)
        : bounds.width,
      restoreHeight: Number.isFinite(layout.restoreHeight)
        ? Math.round(layout.restoreHeight)
        : bounds.height,
    };

    const applyLayoutState = () => {
      windowElement.style.left = `${layoutState.left}px`;
      windowElement.style.top = `${layoutState.top}px`;
      windowElement.style.width = `${layoutState.width}px`;
      windowElement.style.height = `${layoutState.height}px`;
      windowElement.dataset.windowLeft = String(layoutState.left);
      windowElement.dataset.windowTop = String(layoutState.top);
      windowElement.dataset.windowWidth = String(layoutState.width);
      windowElement.dataset.windowHeight = String(layoutState.height);
    };

    applyLayoutState();

    const setWindowBounds = (nextBounds = {}, { updateRestore = false } = {}) => {
      const clamped = clampBoundsToArea({
        left: Number.isFinite(nextBounds.left) ? Math.round(nextBounds.left) : layoutState.left,
        top: Number.isFinite(nextBounds.top) ? Math.round(nextBounds.top) : layoutState.top,
        width: Number.isFinite(nextBounds.width) ? Math.round(nextBounds.width) : layoutState.width,
        height: Number.isFinite(nextBounds.height)
          ? Math.round(nextBounds.height)
          : layoutState.height,
      });

      layoutState = {
        ...layoutState,
        ...clamped,
      };

      applyLayoutState();

      if (updateRestore) {
        layoutState = {
          ...layoutState,
          restoreLeft: clamped.left,
          restoreTop: clamped.top,
          restoreWidth: clamped.width,
          restoreHeight: clamped.height,
        };
      }

      return { ...layoutState };
    };

    const getWindowBounds = () => ({
      left: layoutState.left,
      top: layoutState.top,
      width: layoutState.width,
      height: layoutState.height,
    });

    const getWindowSize = () => ({ width: layoutState.width, height: layoutState.height });

    let currentZIndex = Number.isFinite(initialZIndex) ? Math.round(initialZIndex) : null;

    const applyZIndex = (value) => {
      currentZIndex = Math.max(1, Math.round(value));

      if (currentZIndex > zIndexCounter) {
        zIndexCounter = currentZIndex;
      }

      windowElement.style.zIndex = String(currentZIndex);
      windowElement.dataset.windowZIndex = String(currentZIndex);
    };

    if (!Number.isFinite(currentZIndex)) {
      applyZIndex(getNextZIndex());
    } else {
      applyZIndex(currentZIndex);
    }

    windowElement.dataset.windowId = windowId;
    windowElement.dataset.windowType = windowType;
    windowElement.tabIndex = 0;

    let isMaximized = false;
    let dragState = null;
    let resizeState = null;

    const updateMaximizeVisualState = () => {
      windowElement.classList.toggle('workspace__window--maximized', isMaximized);
      windowElement.dataset.windowMaximized = isMaximized ? 'true' : 'false';

      if (maximizeButton) {
        maximizeButton.textContent = isMaximized ? '元のサイズ' : '最大化';
        maximizeButton.setAttribute('aria-pressed', isMaximized ? 'true' : 'false');
        maximizeButton.hidden = false;
        maximizeButton.disabled = false;
      }

      resizeHandles.forEach((handle) => {
        handle.disabled = isMaximized;
        handle.setAttribute('aria-hidden', isMaximized ? 'true' : 'false');
      });

      windowElement.classList.remove('workspace__window--resizing');
    };

    const finishResizeInteraction = ({ commit = false } = {}) => {
      if (!resizeState) {
        return;
      }

      const { handle, pointerId, hasResized } = resizeState;

      if (handle && typeof handle.releasePointerCapture === 'function') {
        try {
          handle.releasePointerCapture(pointerId);
        } catch (error) {
          // ignore pointer capture release failures
        }
      }

      resizeState = null;
      windowElement.classList.remove('workspace__window--resizing');
      windowElement.style.removeProperty('--workspace-window-resize-cursor');

      if (commit && hasResized) {
        if (!isMaximized) {
          setWindowBounds({}, { updateRestore: true });
        }

        if (typeof onLayoutCommit === 'function') {
          onLayoutCommit({ flush: true, layout: { ...layoutState } });
        }
      }
    };

    const finishPointerDrag = () => {
      if (!dragState) {
        return;
      }

      if (typeof dragState.release === 'function') {
        try {
          dragState.release();
        } catch (error) {
          // ignore pointer capture release failures
        }
      }

      dragState = null;
      windowElement.classList.remove('workspace__window--dragging');

      if (typeof onLayoutCommit === 'function') {
        onLayoutCommit({ flush: false, layout: { ...layoutState } });
      }
    };

    const setMaximizedState = (value, { emit = true, persist = true } = {}) => {
      const target = value === true;

      if (target !== isMaximized) {
        finishResizeInteraction({ commit: true });

        if (target) {
          layoutState = {
            ...layoutState,
            restoreLeft: layoutState.left,
            restoreTop: layoutState.top,
            restoreWidth: layoutState.width,
            restoreHeight: layoutState.height,
          };

          const areaSize = getAreaSize();
          setWindowBounds({ left: 0, top: 0, width: areaSize.width, height: areaSize.height });
        } else {
          const restoreBounds = {
            left: Number.isFinite(layoutState.restoreLeft) ? layoutState.restoreLeft : layoutState.left,
            top: Number.isFinite(layoutState.restoreTop) ? layoutState.restoreTop : layoutState.top,
            width: Number.isFinite(layoutState.restoreWidth)
              ? layoutState.restoreWidth
              : layoutState.width,
            height: Number.isFinite(layoutState.restoreHeight)
              ? layoutState.restoreHeight
              : layoutState.height,
          };

          setWindowBounds(restoreBounds, { updateRestore: true });
        }

        isMaximized = target;
      }

      updateMaximizeVisualState();

      if (emit && typeof onMaximizeChange === 'function') {
        onMaximizeChange({ maximized: isMaximized, layout: { ...layoutState } });
      }

      if (persist && typeof onLayoutCommit === 'function') {
        onLayoutCommit({ flush: false, layout: { ...layoutState } });
      }

      return isMaximized;
    };

    const toggleMaximize = () => {
      setMaximizedState(!isMaximized);
    };

    const bringToFront = ({ persistFocus = true } = {}) => {
      area.querySelectorAll('.workspace__window').forEach((otherWindow) => {
        if (otherWindow !== windowElement) {
          otherWindow.classList.remove('workspace__window--active');
          otherWindow.dataset.windowActive = 'false';
        }
      });

      applyZIndex(getNextZIndex());
      windowElement.classList.add('workspace__window--active');
      windowElement.dataset.windowActive = 'true';
      area.dataset.activeWindowId = windowId;

      if (persistFocus && typeof onFocusPersist === 'function') {
        onFocusPersist();
      }

      return windowElement;
    };

    const setPointerIgnorePredicate = (predicate) => {
      if (typeof predicate === 'function') {
        ignorePointerPredicate = predicate;
      } else {
        ignorePointerPredicate = null;
      }
    };

    const shouldIgnorePointerInteraction = (event) => {
      if (typeof ignorePointerPredicate === 'function') {
        try {
          if (ignorePointerPredicate(event)) {
            return true;
          }
        } catch (error) {
          return true;
        }
      }

      const target = event.target;

      if (target instanceof HTMLElement) {
        if (
          target.closest('button') ||
          target.closest('input') ||
          target.closest('textarea') ||
          target.closest('select') ||
          target.closest('[contenteditable="true"]')
        ) {
          return true;
        }
      }

      return false;
    };

    const attachHeader = (header) => {
      if (!(header instanceof HTMLElement)) {
        return () => {};
      }

      const handleHeaderPointerDown = (event) => {
        if (typeof event.button === 'number' && event.button > 0) {
          return;
        }

        if (shouldIgnorePointerInteraction(event)) {
          return;
        }

        bringToFront();
        windowElement.focus({ preventScroll: true });

        if (isMaximized) {
          setMaximizedState(false, { emit: false, persist: false });
        }

        const areaRect = area.getBoundingClientRect();
        const pointerId = event.pointerId;

        const release = () => {
          if (typeof header.releasePointerCapture === 'function') {
            try {
              header.releasePointerCapture(pointerId);
            } catch (error) {
              // ignore pointer capture release failures
            }
          }
        };

        dragState = {
          pointerId,
          offsetX: event.clientX - areaRect.left - layoutState.left,
          offsetY: event.clientY - areaRect.top - layoutState.top,
          release,
        };

        windowElement.classList.add('workspace__window--dragging');

        if (typeof header.setPointerCapture === 'function') {
          try {
            header.setPointerCapture(pointerId);
          } catch (error) {
            // ignore pointer capture failures
          }
        }

        event.preventDefault();
      };

      const handleHeaderPointerMove = (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) {
          return;
        }

        const areaRect = area.getBoundingClientRect();
        const nextLeft = event.clientX - areaRect.left - dragState.offsetX;
        const nextTop = event.clientY - areaRect.top - dragState.offsetY;

        setWindowBounds({ left: nextLeft, top: nextTop }, { updateRestore: !isMaximized });
      };

      const handleHeaderPointerUp = (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) {
          return;
        }

        finishPointerDrag();
      };

      const handleHeaderPointerCancel = () => {
        finishPointerDrag();
      };

      const handleHeaderMouseDown = () => {
        bringToFront({ persistFocus: false });
      };

      header.addEventListener('pointerdown', handleHeaderPointerDown);
      header.addEventListener('pointermove', handleHeaderPointerMove);
      header.addEventListener('pointerup', handleHeaderPointerUp);
      header.addEventListener('pointercancel', handleHeaderPointerCancel);
      header.addEventListener('lostpointercapture', handleHeaderPointerCancel);
      header.addEventListener('mousedown', handleHeaderMouseDown);

      return () => {
        header.removeEventListener('pointerdown', handleHeaderPointerDown);
        header.removeEventListener('pointermove', handleHeaderPointerMove);
        header.removeEventListener('pointerup', handleHeaderPointerUp);
        header.removeEventListener('pointercancel', handleHeaderPointerCancel);
        header.removeEventListener('lostpointercapture', handleHeaderPointerCancel);
        header.removeEventListener('mousedown', handleHeaderMouseDown);
      };
    };

    const attachWindowInteractions = ({ shouldIgnorePointerInteraction: customIgnore } = {}) => {
      const evaluator = typeof customIgnore === 'function' ? customIgnore : shouldIgnorePointerInteraction;

      const handleWindowFocus = () => {
        bringToFront();
      };

      const handleWindowMouseDown = (event) => {
        if (typeof evaluator === 'function' && evaluator(event)) {
          return;
        }

        bringToFront();
        windowElement.focus({ preventScroll: true });
      };

      windowElement.addEventListener('focus', handleWindowFocus);
      windowElement.addEventListener('mousedown', handleWindowMouseDown);

      return () => {
        windowElement.removeEventListener('focus', handleWindowFocus);
        windowElement.removeEventListener('mousedown', handleWindowMouseDown);
      };
    };

    const createResizeHandle = (definition) => {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = `workspace__window-resize workspace__window-resize--${definition.position}`;
      handle.dataset.resizePosition = definition.position;
      handle.disabled = false;
      handle.setAttribute('aria-hidden', 'false');
      handle.setAttribute('aria-label', 'ウィンドウサイズを変更');

      const handlePointerDown = (event) => {
        if (typeof event.button === 'number' && event.button > 0) {
          return;
        }

        if (handle.disabled || isMaximized) {
          return;
        }

        bringToFront();
        windowElement.focus({ preventScroll: true });

        if (resizeState) {
          finishResizeInteraction({ commit: false });
        }

        resizeState = {
          pointerId: event.pointerId,
          handle,
          definition,
          startX: event.clientX,
          startY: event.clientY,
          originLeft: layoutState.left,
          originTop: layoutState.top,
          originWidth: layoutState.width,
          originHeight: layoutState.height,
          hasResized: false,
        };

        windowElement.classList.add('workspace__window--resizing');
        windowElement.style.setProperty('--workspace-window-resize-cursor', definition.cursor);

        if (typeof handle.setPointerCapture === 'function') {
          try {
            handle.setPointerCapture(event.pointerId);
          } catch (error) {
            // ignore pointer capture failures
          }
        }

        event.preventDefault();
        event.stopPropagation();
      };

      const handlePointerMove = (event) => {
        if (!resizeState || event.pointerId !== resizeState.pointerId) {
          return;
        }

        if (resizeState.handle !== handle) {
          return;
        }

        const deltaX = event.clientX - resizeState.startX;
        const deltaY = event.clientY - resizeState.startY;
        const nextBounds = {};

        if (definition.horizontal === 'right') {
          nextBounds.width = resizeState.originWidth + deltaX;
        } else if (definition.horizontal === 'left') {
          nextBounds.width = resizeState.originWidth - deltaX;
          nextBounds.left = resizeState.originLeft + deltaX;
        }

        if (definition.vertical === 'bottom') {
          nextBounds.height = resizeState.originHeight + deltaY;
        } else if (definition.vertical === 'top') {
          nextBounds.height = resizeState.originHeight - deltaY;
          nextBounds.top = resizeState.originTop + deltaY;
        }

        const before = getWindowBounds();
        const after = setWindowBounds(nextBounds);

        if (
          after.left !== before.left ||
          after.top !== before.top ||
          after.width !== before.width ||
          after.height !== before.height
        ) {
          resizeState.hasResized = true;
        }

        event.preventDefault();
        event.stopPropagation();
      };

      const handlePointerUp = (event) => {
        if (!resizeState || event.pointerId !== resizeState.pointerId) {
          return;
        }

        if (resizeState.handle !== handle) {
          return;
        }

        finishResizeInteraction({ commit: true });
        event.preventDefault();
        event.stopPropagation();
      };

      const handlePointerCancel = () => {
        finishResizeInteraction({ commit: false });
      };

      handle.addEventListener('pointerdown', handlePointerDown);
      handle.addEventListener('pointermove', handlePointerMove);
      handle.addEventListener('pointerup', handlePointerUp);
      handle.addEventListener('pointercancel', handlePointerCancel);
      handle.addEventListener('lostpointercapture', handlePointerCancel);

      handle.addEventListener('focus', () => {
        bringToFront({ persistFocus: false });
      });

      handle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      resizeHandles.push(handle);
      return handle;
    };

    const setMaximizeControl = (button) => {
      if (button instanceof HTMLButtonElement) {
        maximizeButton = button;
        updateMaximizeVisualState();
      } else {
        maximizeButton = null;
      }
    };

    const destroy = () => {
      finishPointerDrag();
      finishResizeInteraction({ commit: false });
    };

    setMaximizedState(shouldStartMaximized, { emit: false, persist: false });

    return {
      bringToFront,
      createResizeHandle,
      destroy,
      finishPointerDrag,
      finishResizeInteraction,
      getLayoutState: () => ({ ...layoutState }),
      getWindowBounds,
      getWindowSize,
      isMaximized: () => isMaximized,
      setMaximizeControl,
      setMaximizedState,
      setPointerIgnorePredicate,
      setWindowBounds,
      toggleMaximize,
      attachHeader,
      attachWindowInteractions,
      getResizeHandles: () => resizeHandles.slice(),
    };
  };

  const openWindow = (file, options = {}) => {
    let zoomFitMode = 'manual';
    const windowElement = document.createElement('article');
    windowElement.className = 'workspace__window';
    windowElement.setAttribute('role', 'group');
    windowElement.tabIndex = 0;
    windowElement.dataset.zoomFitMode = zoomFitMode;

    const windowType =
      typeof options.windowType === 'string' && options.windowType.trim().length > 0
        ? options.windowType.trim()
        : 'pdf';
    windowElement.dataset.windowType = windowType;

    const resizeHandleDefinitions = [
      { position: 'top-left', horizontal: 'left', vertical: 'top', cursor: 'nwse-resize' },
      { position: 'top-right', horizontal: 'right', vertical: 'top', cursor: 'nesw-resize' },
      { position: 'bottom-left', horizontal: 'left', vertical: 'bottom', cursor: 'nesw-resize' },
      { position: 'bottom-right', horizontal: 'right', vertical: 'bottom', cursor: 'nwse-resize' },
    ];

    const layoutOptions = {
      width: Number.isFinite(options.restoreWidth)
        ? options.restoreWidth
        : Number.isFinite(options.width)
          ? options.width
          : DEFAULT_WINDOW_WIDTH,
      height: Number.isFinite(options.restoreHeight)
        ? options.restoreHeight
        : Number.isFinite(options.height)
          ? options.height
          : DEFAULT_WINDOW_HEIGHT,
      left: Number.isFinite(options.restoreLeft)
        ? options.restoreLeft
        : Number.isFinite(options.left)
          ? options.left
          : null,
      top: Number.isFinite(options.restoreTop)
        ? options.restoreTop
        : Number.isFinite(options.top)
          ? options.top
          : null,
      restoreLeft: options.restoreLeft,
      restoreTop: options.restoreTop,
      restoreWidth: options.restoreWidth,
      restoreHeight: options.restoreHeight,
    };

    const initialZIndex = Number.isFinite(options?.layout?.zIndex)
      ? Math.round(options.layout.zIndex)
      : Number.isFinite(options.zIndex)
        ? Math.round(options.zIndex)
        : null;

    const windowId =
      typeof options.id === 'string' && options.id.length > 0
        ? options.id
        : createWindowId('window');

    const shouldStartMaximized = options.maximized === true;
    const shouldAutoFocus = options.autoFocus !== false;

    let schedulePersist = () => {};
    let handleLayoutCommit = () => {};
    let handleMaximizeChange = () => {};
    let handleFocusPersist = () => {};

    const chrome = createWindowChrome({
      windowElement,
      windowId,
      windowType,
      layout: layoutOptions,
      initialZIndex,
      shouldStartMaximized,
      onFocusPersist: () => {
        handleFocusPersist();
      },
      onLayoutCommit: ({ flush = false } = {}) => {
        handleLayoutCommit({ flush });
      },
      onMaximizeChange: (detail) => {
        handleMaximizeChange(detail);
      },
    });

    const getWindowBounds = () => chrome.getWindowBounds();
    const getWindowSize = () => chrome.getWindowSize();
    const setWindowBounds = (...args) => chrome.setWindowBounds(...args);
    const setMaximizedState = (...args) => chrome.setMaximizedState(...args);
    const bringToFront = (...args) => chrome.bringToFront(...args);
    const finishResizeInteraction = (...args) => chrome.finishResizeInteraction(...args);
    const finishPointerDrag = () => chrome.finishPointerDrag();

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
    let currentZoom = Number.isFinite(options.zoom)
      ? Number.parseFloat(options.zoom)
      : DEFAULT_WINDOW_ZOOM;
    let totalPages = Number.isFinite(options.totalPages) ? options.totalPages : null;
    let openedAt = Number.isFinite(options.openedAt) ? options.openedAt : Date.now();
    let lastFocusedAt = Number.isFinite(options.lastFocusedAt)
      ? options.lastFocusedAt
      : openedAt;
    let hasStoredFile = options.persisted === true;
    let bookmarksWindowEntry = null;
    let notesWindowEntry = null;
    let searchController;
    let toolbarController;
    let outlineList;
    let outlineStatus;
    let outlineEntries = [];
    let lastBookmarkStatus = '';
    let lastBookmarkStatusIsError = false;
    const sanitizeBookmarkValue = (value) => {
      if (!Number.isFinite(value)) {
        return null;
      }

      const normalized = Math.max(1, Math.floor(value));

      if (Number.isFinite(options.totalPages)) {
        const total = Math.max(1, Math.floor(options.totalPages));
        return Math.min(normalized, total);
      }

      return normalized;
    };

    const initialBookmarks = Array.isArray(options.bookmarks)
      ? options.bookmarks
          .map(sanitizeBookmarkValue)
          .filter((value) => Number.isFinite(value))
      : [];

    let bookmarks = Array.from(new Set(initialBookmarks)).sort((a, b) => a - b);

    if (bookmarks.length > MAX_WINDOW_BOOKMARKS) {
      bookmarks = bookmarks.slice(-MAX_WINDOW_BOOKMARKS);
    }
    let maximizeButton;
    const defaultTitle = file.name;
    let windowTitle =
      typeof options.title === 'string' && options.title.trim().length > 0
        ? options.title.trim()
        : defaultTitle;
    let windowNotes = typeof options.notes === 'string' ? options.notes : '';
    let titleInput;
    let renameButton;
    let colorButton;
    let bookmarksWindowButton;
    let notesWindowButton;
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
          maximized: chrome.isMaximized(),
          width: bounds.width,
          height: bounds.height,
          left: bounds.left,
          top: bounds.top,
        },
      });

      windowElement.dispatchEvent(maximizeEvent);
    };

    const toggleMaximize = () => {
      bringToFront();
      chrome.toggleMaximize();
      syncControlLabels();
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

      if (bookmarksWindowEntry?.id) {
        const entry = windowRegistry.get(bookmarksWindowEntry.id);

        if (entry && typeof entry.dispose === 'function') {
          entry.dispose({ emitClose: false });
        }

        bookmarksWindowEntry = null;
      }

      if (notesWindowEntry?.id) {
        const entry = windowRegistry.get(notesWindowEntry.id);

        if (entry && typeof entry.dispose === 'function') {
          entry.dispose({ emitClose: false });
        }

        notesWindowEntry = null;
      }

      searchController?.cancel();
      detachHeaderInteractions();
      detachWindowInteractions();
      chrome.destroy();

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
        delete area.dataset.activeWindowId;
      }

      if (persistRemoval) {
        removeWorkspaceWindow(windowId).catch(() => {});
      }
    };

    const persistState = async ({ includeFile = false } = {}) => {
      const layout = chrome.getLayoutState();
      const descriptor = {
        id: windowId,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        page: currentPage,
        zoom: currentZoom,
        rotation: currentRotation,
        totalPages: Number.isFinite(totalPages) ? totalPages : undefined,
        pinned: windowElement.classList.contains('workspace__window--pinned'),
        openedAt,
        lastFocusedAt,
        title: windowTitle,
        notes: windowNotes,
        color: windowColor,
        pageHistory: pageHistory.slice(),
        pageHistoryIndex,
        maximized: chrome.isMaximized(),
        restoreLeft: Number.isFinite(layout.restoreLeft) ? layout.restoreLeft : layout.left,
        restoreTop: Number.isFinite(layout.restoreTop) ? layout.restoreTop : layout.top,
        restoreWidth: Number.isFinite(layout.restoreWidth) ? layout.restoreWidth : layout.width,
        restoreHeight: Number.isFinite(layout.restoreHeight) ? layout.restoreHeight : layout.height,
        bookmarks: bookmarks.slice(),
        windowType,
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

    let persistTaskScheduled = false;
    let pendingPersistIncludeFile = false;

    const executePersist = () => {
      const shouldIncludeFile = pendingPersistIncludeFile || !hasStoredFile;
      pendingPersistIncludeFile = false;

      persistState({ includeFile: shouldIncludeFile })
        .then(() => {
          if (shouldIncludeFile) {
            hasStoredFile = true;
          }
        })
        .catch(() => {});
    };

    schedulePersist = ({ includeFile = false, flush = false } = {}) => {
      if (includeFile) {
        pendingPersistIncludeFile = true;
      }

      if (flush) {
        if (persistTaskScheduled) {
          persistTaskScheduled = false;
        }

        executePersist();
        return;
      }

      if (persistTaskScheduled) {
        return;
      }

      persistTaskScheduled = true;

      queueMicrotask(() => {
        if (!persistTaskScheduled) {
          return;
        }

        persistTaskScheduled = false;
        executePersist();
      });
    };

    handleLayoutCommit = ({ flush = false } = {}) => {
      schedulePersist({ flush });
    };

    handleMaximizeChange = () => {
      emitMaximizeChange();
    };

    syncFocusMetadata();

    handleFocusPersist = () => {
      lastFocusedAt = Date.now();
      syncFocusMetadata();
      schedulePersist();
    };

    const syncRotationState = () => {
      if (toolbarController) {
        toolbarController.syncRotation(currentRotation);
      } else {
        windowElement.dataset.rotation = String(currentRotation);
      }
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

    const hasBookmark = (page) => bookmarks.includes(page);

    const getNextBookmarkValue = () => {
      if (bookmarks.length === 0) {
        return undefined;
      }

      if (!Number.isFinite(currentPage)) {
        return bookmarks[0];
      }

      for (let index = 0; index < bookmarks.length; index += 1) {
        const value = bookmarks[index];

        if (value > currentPage) {
          return value;
        }
      }

      return undefined;
    };

    const getPreviousBookmarkValue = () => {
      if (bookmarks.length === 0) {
        return undefined;
      }

      if (!Number.isFinite(currentPage)) {
        return bookmarks[bookmarks.length - 1];
      }

      for (let index = bookmarks.length - 1; index >= 0; index -= 1) {
        const value = bookmarks[index];

        if (value < currentPage) {
          return value;
        }
      }

      return undefined;
    };

    const syncBookmarkMetadata = () => {
      windowElement.dataset.bookmarkCount = String(bookmarks.length);

      if (bookmarks.length > 0) {
        windowElement.dataset.bookmarkPages = bookmarks.join(',');
      } else {
        delete windowElement.dataset.bookmarkPages;
      }

      const nextBookmark = getNextBookmarkValue();
      const previousBookmark = getPreviousBookmarkValue();

      if (Number.isFinite(nextBookmark)) {
        windowElement.dataset.bookmarkNext = String(nextBookmark);
      } else {
        delete windowElement.dataset.bookmarkNext;
      }

      if (Number.isFinite(previousBookmark)) {
        windowElement.dataset.bookmarkPrevious = String(previousBookmark);
      } else {
        delete windowElement.dataset.bookmarkPrevious;
      }

      if (bookmarks.length >= MAX_WINDOW_BOOKMARKS) {
        windowElement.dataset.bookmarkCapacity = String(MAX_WINDOW_BOOKMARKS);
      } else {
        delete windowElement.dataset.bookmarkCapacity;
      }
    };

    const getBookmarkUiState = () => {
      const currentPageValue = clampPage(currentPage);
      const nextBookmark = getNextBookmarkValue();
      const previousBookmark = getPreviousBookmarkValue();

      return {
        bookmarks: bookmarks.slice(),
        currentPage: Number.isFinite(currentPageValue) ? currentPageValue : null,
        nextBookmark: Number.isFinite(nextBookmark) ? nextBookmark : null,
        previousBookmark: Number.isFinite(previousBookmark) ? previousBookmark : null,
        atCapacity: bookmarks.length >= MAX_WINDOW_BOOKMARKS,
        currentIsBookmarked: Number.isFinite(currentPageValue)
          ? hasBookmark(currentPageValue)
          : false,
      };
    };

    const syncBookmarksWindow = () => {
      if (!bookmarksWindowEntry?.controller) {
        return;
      }

      const state = getBookmarkUiState();

      bookmarksWindowEntry.controller.sync({
        bookmarks: state.bookmarks,
        currentPage: state.currentPage,
        nextBookmark: state.nextBookmark,
        previousBookmark: state.previousBookmark,
        atCapacity: state.atCapacity,
        currentIsBookmarked: state.currentIsBookmarked,
      });

      bookmarksWindowEntry.controller.setStatus(lastBookmarkStatus, {
        isError: lastBookmarkStatusIsError,
      });
    };

    const syncBookmarksState = () => {
      syncBookmarkMetadata();
      syncBookmarksWindow();
    };

    const syncBookmarkStatus = (message, { isError = false } = {}) => {
      lastBookmarkStatus = typeof message === 'string' ? message : '';
      lastBookmarkStatusIsError = isError === true;
      syncBookmarksWindow();
    };

    const syncNotesMetadata = () => {
      windowElement.dataset.notesLength = String(windowNotes.length);
    };

    const updateWindowNotes = (nextContent = '') => {
      const normalized = typeof nextContent === 'string' ? nextContent : '';

      if (normalized === windowNotes) {
        syncNotesMetadata();
        return;
      }

      windowNotes = normalized;
      syncNotesMetadata();

      const notesEvent = new CustomEvent(WINDOW_NOTES_CHANGE_EVENT, {
        bubbles: true,
        detail: { file, notes: windowNotes },
      });

      windowElement.dispatchEvent(notesEvent);
      if (notesWindowEntry?.controller?.setContent) {
        notesWindowEntry.controller.setContent(windowNotes);
      }
      schedulePersist();
    };

    const getBookmarksWindowTitle = () => `${windowTitle} のブックマーク`;
    const getNotesWindowTitle = () => `${windowTitle} のメモ`;

    const openBookmarksWindow = () => {
      if (
        bookmarksWindowEntry?.element instanceof HTMLElement &&
        bookmarksWindowEntry.element.isConnected
      ) {
        const entry = windowRegistry.get(bookmarksWindowEntry.id);

        if (entry && typeof entry.bringToFront === 'function') {
          entry.bringToFront();
        }

        bookmarksWindowEntry.element.focus({ preventScroll: true });
        syncBookmarksWindow();
        return bookmarksWindowEntry.element;
      }

      let disposeBookmarksWindow = () => {};

      const controller = createBookmarksWindow({
        title: getBookmarksWindowTitle(),
        onCloseRequest: () => {
          disposeBookmarksWindow({ emitClose: true });
        },
        onAddBookmark: () => {
          bringToFront();
          addBookmark(currentPage);
        },
        onJumpBookmark: (page) => {
          bringToFront();
          jumpToBookmark(page, { source: 'list' });
        },
        onRemoveBookmark: (page) => {
          bringToFront();
          removeBookmark(page);
        },
        onNextRequest: () => {
          bringToFront();
          goToNextBookmark({ source: 'next-button' });
        },
        onPreviousRequest: () => {
          bringToFront();
          goToPreviousBookmark({ source: 'previous-button' });
        },
      });

      const windowElement = controller?.element;

      if (!(windowElement instanceof HTMLElement)) {
        throw new Error('ブックマークウィンドウの生成に失敗しました。');
      }

      const bookmarksWindowId = createWindowId('bookmarks');

      windowElement.classList.add('workspace__window');
      windowElement.classList.add('workspace__window--bookmarks');
      windowElement.dataset.windowId = bookmarksWindowId;
      windowElement.dataset.windowType = 'bookmarks';
      windowElement.dataset.windowParentId = windowId;
      windowElement.tabIndex = 0;

      const header = controller?.header;

      if (!(header instanceof HTMLElement)) {
        throw new Error('ブックマークウィンドウにはヘッダー要素が必要です。');
      }

      let disposed = false;
      let openedAt = Date.now();
      let lastFocusedAt = openedAt;

      const syncFocusMetadata = () => {
        windowElement.dataset.openedAt = String(openedAt);
        windowElement.dataset.lastFocusedAt = String(lastFocusedAt);
      };

      const applyInitialBounds = () => {
        const preferredWidth = 320;
        const preferredHeight = 360;
        const offset = computeDefaultWindowPosition(preferredWidth, preferredHeight);
        const clamped = clampBoundsToArea({
          left: offset.left,
          top: offset.top,
          width: preferredWidth,
          height: preferredHeight,
        });

        windowElement.style.left = `${clamped.left}px`;
        windowElement.style.top = `${clamped.top}px`;
        windowElement.style.width = `${clamped.width}px`;
        windowElement.style.height = `${clamped.height}px`;
        windowElement.dataset.windowLeft = String(clamped.left);
        windowElement.dataset.windowTop = String(clamped.top);
        windowElement.dataset.windowWidth = String(clamped.width);
        windowElement.dataset.windowHeight = String(clamped.height);
      };

      applyInitialBounds();
      syncFocusMetadata();

      const applyZIndex = () => {
        const next = getNextZIndex();
        windowElement.style.zIndex = String(next);
        windowElement.dataset.windowZIndex = String(next);
      };

      applyZIndex();

      const bringToFrontWindow = ({ persistFocus = true } = {}) => {
        area.querySelectorAll('.workspace__window').forEach((otherWindow) => {
          if (otherWindow !== windowElement) {
            otherWindow.classList.remove('workspace__window--active');
            otherWindow.dataset.windowActive = 'false';
          }
        });

        applyZIndex();
        windowElement.classList.add('workspace__window--active');
        windowElement.dataset.windowActive = 'true';
        area.dataset.activeWindowId = bookmarksWindowId;

        if (persistFocus) {
          lastFocusedAt = Date.now();
        }

        syncFocusMetadata();
        return windowElement;
      };

      if (typeof controller?.setFocusDelegate === 'function') {
        controller.setFocusDelegate(() => {
          bringToFrontWindow({ persistFocus: false });
        });
      }

      const handleWindowFocus = () => {
        bringToFrontWindow();
      };

      const handleWindowMouseDown = () => {
        bringToFrontWindow();
        windowElement.focus({ preventScroll: true });
      };

      const handleHeaderInteraction = () => {
        bringToFrontWindow();
      };

      header.addEventListener('mousedown', handleHeaderInteraction);

      const cleanup = () => {
        header.removeEventListener('mousedown', handleHeaderInteraction);
        windowElement.removeEventListener('focus', handleWindowFocus);
        windowElement.removeEventListener('mousedown', handleWindowMouseDown);
      };

      disposeBookmarksWindow = ({ emitClose = true } = {}) => {
        if (disposed) {
          return;
        }

        disposed = true;
        cleanup();
        windowElement.remove();
        windowRegistry.delete(bookmarksWindowId);
        bookmarksWindowEntry = null;
        syncEmptyState();

        if (emitClose) {
          // no-op
        }
      };

      windowElement.addEventListener('focus', handleWindowFocus);
      windowElement.addEventListener('mousedown', handleWindowMouseDown);
      area.append(windowElement);

      windowRegistry.set(bookmarksWindowId, {
        element: windowElement,
        bringToFront: bringToFrontWindow,
        dispose: ({ emitClose = true } = {}) => {
          disposeBookmarksWindow({ emitClose });
        },
        getLastFocused: () => lastFocusedAt,
        getOpenedAt: () => openedAt,
        getTitle: () => getBookmarksWindowTitle(),
        id: bookmarksWindowId,
      });

      bookmarksWindowEntry = {
        id: bookmarksWindowId,
        element: windowElement,
        controller,
      };

      syncEmptyState();
      bringToFrontWindow();
      syncBookmarksWindow();

      return windowElement;
    };

    const openNotesWindow = () => {
      if (notesWindowEntry?.element instanceof HTMLElement && notesWindowEntry.element.isConnected) {
        const entry = windowRegistry.get(notesWindowEntry.id);

        if (entry && typeof entry.bringToFront === 'function') {
          entry.bringToFront();
        }

        if (notesWindowEntry.controller?.setContent) {
          notesWindowEntry.controller.setContent(windowNotes);
        }

        notesWindowEntry.element.focus({ preventScroll: true });
        return notesWindowEntry.element;
      }

      const result = openMemoWindow({
        returnController: true,
        title: getNotesWindowTitle(),
        content: windowNotes,
        onContentChange: (value) => {
          updateWindowNotes(value);
        },
        onDispose: () => {
          notesWindowEntry = null;
        },
      });

      if (!result) {
        return null;
      }

      const memoElement = result.element;
      const memoController = result.controller;

      if (!(memoElement instanceof HTMLElement)) {
        return null;
      }

      const memoWindowId = memoElement.dataset?.windowId;

      if (typeof memoWindowId === 'string' && memoWindowId.length > 0) {
        memoElement.dataset.windowParentId = windowId;
      }

      if (memoController?.setTitle) {
        memoController.setTitle(getNotesWindowTitle());
      }

      if (memoController?.setContent) {
        memoController.setContent(windowNotes);
      }

      notesWindowEntry = {
        id: typeof memoWindowId === 'string' ? memoWindowId : undefined,
        element: memoElement,
        controller: memoController,
      };

      return memoElement;
    };

    const clampBookmarksToBounds = () => {
      const sanitized = bookmarks
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.max(1, Math.floor(value)));

      let bounded = sanitized;

      if (Number.isFinite(totalPages)) {
        const limit = Math.max(1, Math.floor(totalPages));
        bounded = bounded.map((value) => Math.min(value, limit));
      }

      const deduped = [];
      bounded
        .sort((a, b) => a - b)
        .forEach((value) => {
          if (!deduped.includes(value)) {
            deduped.push(value);
          }
        });

      if (deduped.length > MAX_WINDOW_BOOKMARKS) {
        deduped.splice(0, deduped.length - MAX_WINDOW_BOOKMARKS);
      }

      const changed =
        deduped.length !== bookmarks.length ||
        deduped.some((value, index) => value !== bookmarks[index]);

      if (changed) {
        bookmarks = deduped;
        syncBookmarksState();
        schedulePersist();
      } else {
        syncBookmarksState();
      }
    };

    const addBookmark = (page = currentPage) => {
      const target = clampPage(page);

      if (!Number.isFinite(target)) {
        syncBookmarkStatus('');
        return false;
      }

      if (bookmarks.length >= MAX_WINDOW_BOOKMARKS) {
        syncBookmarkStatus('ブックマークは上限に達しました。', { isError: true });
        syncBookmarksState();
        return false;
      }

      if (hasBookmark(target)) {
        syncBookmarkStatus(`${target}ページ目はすでに保存済みです。`, { isError: true });
        syncBookmarksState();
        return false;
      }

      bookmarks.push(target);
      bookmarks.sort((a, b) => a - b);
      syncBookmarksState();

      const change = new CustomEvent(WINDOW_BOOKMARKS_CHANGE_EVENT, {
        bubbles: true,
        detail: { file, bookmarks: bookmarks.slice(), action: 'add', page: target },
      });

      windowElement.dispatchEvent(change);
      schedulePersist();
      syncBookmarkStatus(`${target}ページ目を保存しました。`);
      return true;
    };

    const removeBookmark = (page) => {
      const target = clampPage(page);
      const index = bookmarks.indexOf(target);

      if (index < 0) {
        return false;
      }

      bookmarks.splice(index, 1);
      syncBookmarksState();

      const change = new CustomEvent(WINDOW_BOOKMARKS_CHANGE_EVENT, {
        bubbles: true,
        detail: { file, bookmarks: bookmarks.slice(), action: 'remove', page: target },
      });

      windowElement.dispatchEvent(change);
      schedulePersist();

      if (bookmarks.length === 0) {
        syncBookmarkStatus('ブックマークはすべて削除されました。');
      } else {
        syncBookmarkStatus(`${target}ページ目のブックマークを削除しました。`);
      }

      return true;
    };

    const jumpToBookmark = (page, { source = 'list' } = {}) => {
      const target = clampPage(page);

      if (!Number.isFinite(target) || !hasBookmark(target)) {
        syncBookmarkStatus('指定したブックマークは見つかりませんでした。', {
          isError: true,
        });
        return false;
      }

      commitPageChange(target);

      const nextBookmark = getNextBookmarkValue();
      const previousBookmark = getPreviousBookmarkValue();

      const jumpEvent = new CustomEvent(WINDOW_BOOKMARK_JUMP_EVENT, {
        bubbles: true,
        detail: {
          file,
          page: target,
          bookmarks: bookmarks.slice(),
          source,
          next: Number.isFinite(nextBookmark) ? nextBookmark : null,
          previous: Number.isFinite(previousBookmark) ? previousBookmark : null,
        },
      });

      windowElement.dispatchEvent(jumpEvent);
      syncBookmarkStatus(`${target}ページ目へ移動しました。`);
      return true;
    };

    const goToNextBookmark = ({ source = 'next-button' } = {}) => {
      const nextBookmark = getNextBookmarkValue();

      if (!Number.isFinite(nextBookmark)) {
        syncBookmarkStatus('後ろのブックマークはありません。', { isError: true });
        syncBookmarksState();
        return false;
      }

      return jumpToBookmark(nextBookmark, { source });
    };

    const goToPreviousBookmark = ({ source = 'previous-button' } = {}) => {
      const previousBookmark = getPreviousBookmarkValue();

      if (!Number.isFinite(previousBookmark)) {
        syncBookmarkStatus('前のブックマークはありません。', { isError: true });
        syncBookmarksState();
        return false;
      }

      return jumpToBookmark(previousBookmark, { source });
    };

    const syncNavigationState = () => {
      if (toolbarController) {
        toolbarController.syncNavigation({
          currentPage,
          totalPages,
          canHistoryBack: canStepHistoryBack(),
          canHistoryForward: canStepHistoryForward(),
          historyIndex: pageHistoryIndex,
          historyLength: pageHistory.length,
        });
      }

      windowElement.dataset.pageHistoryIndex = String(pageHistoryIndex);
      windowElement.dataset.pageHistoryLength = String(pageHistory.length);
      syncBookmarksState();
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

    currentZoom = clampZoom(currentZoom);
    currentPage = clampPage(currentPage);
    clampHistoryToBounds();

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
      const fitWidthZoom = computeFitZoom('width');
      const fitPageZoom = computeFitZoom('page');

      if (toolbarController) {
        toolbarController.syncZoom({
          currentZoom,
          zoomFitMode,
          fitWidthZoom: Number.isFinite(fitWidthZoom) ? fitWidthZoom : null,
          fitPageZoom: Number.isFinite(fitPageZoom) ? fitPageZoom : null,
        });
        return;
      }

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
    };

    const isPinned = () => windowElement.classList.contains('workspace__window--pinned');

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

    const syncOutlineMetadata = () => {
      if (outlineEntries.length > 0) {
        windowElement.dataset.outlineCount = String(outlineEntries.length);
      } else {
        delete windowElement.dataset.outlineCount;
      }
    };

    const emitOutlineEvent = (entry, index) => {
      const outlineEvent = new CustomEvent(WINDOW_OUTLINE_JUMP_EVENT, {
        bubbles: true,
        detail: {
          file,
          page: Number.isFinite(entry?.page) ? entry.page : undefined,
          title: typeof entry?.title === 'string' ? entry.title : undefined,
          index,
          level: Number.isFinite(entry?.level) ? entry.level : undefined,
        },
      });

      windowElement.dispatchEvent(outlineEvent);
    };

    const renderOutline = (entries) => {
      if (!outlineList || !outlineStatus) {
        return;
      }

      outlineEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
      outlineList.replaceChildren();
      syncOutlineMetadata();

      if (outlineEntries.length === 0) {
        outlineStatus.hidden = false;
        outlineStatus.textContent = 'アウトライン情報は見つかりませんでした。';
        return;
      }

      outlineStatus.hidden = true;

      outlineEntries.forEach((entry, index) => {
        const item = document.createElement('li');
        item.className = 'workspace__window-outline-item';
        const level = Number.isFinite(entry.level) ? entry.level : 0;
        item.dataset.level = String(level);
        item.style.setProperty('--outline-level', String(level));

        const pageBadge = document.createElement('span');
        pageBadge.className = 'workspace__window-outline-page';
        pageBadge.textContent = Number.isFinite(entry.page) ? `p.${entry.page}` : '—';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'workspace__window-outline-button';
        button.textContent =
          typeof entry.title === 'string' && entry.title.trim().length > 0
            ? entry.title.trim()
            : '無題セクション';

        if (!Number.isFinite(entry.page)) {
          button.disabled = true;
          button.classList.add('workspace__window-outline-button--disabled');
        } else {
          button.addEventListener('click', () => {
            bringToFront({ persistFocus: false });
            commitPageChange(entry.page);
            emitOutlineEvent(entry, index);
          });
        }

        item.append(pageBadge, button);
        outlineList.append(item);
      });
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
    chrome.setMaximizeControl(maximizeButton);

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'workspace__window-duplicate';
    duplicateButton.textContent = '複製';
    duplicateButton.setAttribute('aria-label', `${windowTitle} を別ウィンドウで複製`);

    bookmarksWindowButton = document.createElement('button');
    bookmarksWindowButton.type = 'button';
    bookmarksWindowButton.className =
      'workspace__window-duplicate workspace__window-open-bookmarks';
    bookmarksWindowButton.textContent = 'ブックマーク';
    bookmarksWindowButton.addEventListener('click', () => {
      bringToFront();
      openBookmarksWindow();
    });
    bookmarksWindowButton.addEventListener('focus', () => {
      bringToFront({ persistFocus: false });
    });

    notesWindowButton = document.createElement('button');
    notesWindowButton.type = 'button';
    notesWindowButton.className = 'workspace__window-duplicate workspace__window-open-notes';
    notesWindowButton.textContent = 'メモ';
    notesWindowButton.addEventListener('click', () => {
      bringToFront();
      openNotesWindow();
    });
    notesWindowButton.addEventListener('focus', () => {
      bringToFront({ persistFocus: false });
    });

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

      if (bookmarksWindowButton) {
        bookmarksWindowButton.setAttribute('aria-label', `${windowTitle} のブックマークを表示`);
      }

      if (notesWindowButton) {
        notesWindowButton.setAttribute('aria-label', `${windowTitle} のメモを表示`);
      }

      if (bookmarksWindowEntry?.controller) {
        bookmarksWindowEntry.controller.updateTitle(getBookmarksWindowTitle());
      }

      if (notesWindowEntry?.controller?.setTitle) {
        notesWindowEntry.controller.setTitle(getNotesWindowTitle());
      }

      toolbarController?.updateLabels(windowTitle);

      if (maximizeButton) {
        const label = chrome.isMaximized()
          ? `${windowTitle} を元のサイズに戻す`
          : `${windowTitle} を最大化`;
        maximizeButton.setAttribute('aria-label', label);
      }

      chrome.getResizeHandles().forEach((handle) => {
        handle.setAttribute('aria-label', `${windowTitle} のウィンドウサイズを変更`);
      });

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
      syncBookmarksState();
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
      const duplicateElement = openWindow(file, {
        page: currentPage,
        zoom: currentZoom,
        rotation: currentRotation,
        totalPages,
        pinned: isPinned(),
        notes: windowNotes,
        title: windowTitle,
        pageHistory: pageHistory.slice(),
        pageHistoryIndex,
        color: windowColor,
        bookmarks: bookmarks.slice(),
        maximized: isMaximized,
        left: layoutState.left + 24,
        top: layoutState.top + 24,
        width: layoutState.width,
        height: layoutState.height,
        restoreLeft: layoutState.restoreLeft,
        restoreTop: layoutState.restoreTop,
        restoreWidth: layoutState.restoreWidth,
        restoreHeight: layoutState.restoreHeight,
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
          notes: windowNotes,
          title: windowTitle,
          color: windowColor,
          maximized: isMaximized,
          left: layoutState.left,
          top: layoutState.top,
          width: layoutState.width,
          height: layoutState.height,
          restoreLeft: layoutState.restoreLeft,
          restoreTop: layoutState.restoreTop,
          restoreWidth: layoutState.restoreWidth,
          restoreHeight: layoutState.restoreHeight,
          bookmarks: bookmarks.slice(),
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
      bookmarksWindowButton,
      notesWindowButton,
      closeButton,
    );
    header.append(titleGroup, controls);

    const body = document.createElement('div');
    body.className = 'workspace__window-body';

    toolbarController = createWindowToolbar({
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
      onSyncRequest: () => syncNavigationState(),
    });
    const toolbar = toolbarController.element;

    searchController = createWindowSearch({
      file,
      windowElement,
      viewer,
      commitPageChange,
      bringToFront,
    });
    const searchSection = searchController.element;

    const outlineSection = document.createElement('section');
    outlineSection.className = 'workspace__window-outline';

    const outlineHeader = document.createElement('div');
    outlineHeader.className = 'workspace__window-outline-header';

    const outlineLabel = document.createElement('span');
    outlineLabel.className = 'workspace__window-outline-label';
    outlineLabel.textContent = 'アウトライン';

    outlineHeader.append(outlineLabel);

    outlineStatus = document.createElement('p');
    outlineStatus.className = 'workspace__window-outline-status';
    outlineStatus.textContent = 'アウトラインを読み込み中…';

    outlineList = document.createElement('ul');
    outlineList.className = 'workspace__window-outline-list';
    outlineList.setAttribute('role', 'list');

    outlineSection.append(outlineHeader, outlineStatus, outlineList);
    syncOutlineMetadata();

    body.append(toolbar, searchSection, outlineSection, viewer.element);

    syncNotesMetadata();
    clampBookmarksToBounds();
    syncBookmarksState();
    syncNavigationState();
    syncZoomState();
    updateViewerState();

    void viewer
      .load()
      .then((documentInstance) => {
        if (documentInstance && Number.isFinite(documentInstance.numPages)) {
          totalPages = documentInstance.numPages;
        }

        clampBookmarksToBounds();
        clampHistoryToBounds();
        currentPage = clampPage(currentPage);
        syncNavigationState();
        updateViewerState();
        schedulePersist();
        return renderCurrentPage();
      })
      .catch(() => {});

    void viewer
      .getOutlineEntries()
      .then((entries) => {
        renderOutline(entries);
      })
      .catch(() => {
        if (outlineStatus) {
          outlineStatus.hidden = false;
          outlineStatus.textContent = 'アウトラインの読み込みに失敗しました。';
        }
      });

    windowElement.append(header, body);

    chrome.setPointerIgnorePredicate(() => editingTitle);
    resizeHandleDefinitions.forEach((definition) => {
      const handle = chrome.createResizeHandle(definition);
      windowElement.append(handle);
    });

    const detachHeaderInteractions = chrome.attachHeader(header);
    const detachWindowInteractions = chrome.attachWindowInteractions();

    syncControlLabels();

    windowElement.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) {
        return;
      }

      const isFindShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        (event.key === 'f' || event.key === 'F');

      if (isFindShortcut) {
        event.preventDefault();
        bringToFront();

        searchController?.focusInput?.();

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

      if (!hasModifier && (event.key === 'b' || event.key === 'B')) {
        event.preventDefault();
        bringToFront();
        addBookmark(currentPage);
        return;
      }

      if (!hasModifier && (event.key === '.' || event.key === '>')) {
        event.preventDefault();
        goToNextBookmark({ source: 'keyboard-next' });
        return;
      }

      if (!hasModifier && (event.key === ',' || event.key === '<')) {
        event.preventDefault();
        goToPreviousBookmark({ source: 'keyboard-previous' });
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
      windowElement.dataset.windowActive = 'false';
    }

    syncEmptyState();
    schedulePersist({ includeFile: !hasStoredFile });

    return windowElement;
  };

  const openMemoWindow = (options = {}) => {
    const layoutOptions = {
      width: Number.isFinite(options.width) ? options.width : DEFAULT_WINDOW_WIDTH,
      height: Number.isFinite(options.height) ? options.height : DEFAULT_WINDOW_HEIGHT,
      left: Number.isFinite(options.left) ? options.left : null,
      top: Number.isFinite(options.top) ? options.top : null,
      restoreLeft: options.restoreLeft,
      restoreTop: options.restoreTop,
      restoreWidth: options.restoreWidth,
      restoreHeight: options.restoreHeight,
    };

    const shouldAutoFocus = options.autoFocus !== false;
    const windowId =
      typeof options.id === 'string' && options.id.length > 0
        ? options.id
        : createWindowId('memo');

    let disposeWindow = () => {};

    let syncControlLabels = () => {};

    const memoController = createMemoWindow({
      title:
        typeof options.title === 'string' && options.title.trim().length > 0
          ? options.title.trim()
          : undefined,
      initialContent: typeof options.content === 'string' ? options.content : '',
      placeholder:
        typeof options.placeholder === 'string' && options.placeholder.length > 0
          ? options.placeholder
          : undefined,
      onCloseRequest: () => {
        disposeWindow({ emitClose: true });
      },
      onContentChange:
        typeof options.onContentChange === 'function'
          ? (value) => {
              options.onContentChange(value);
            }
          : undefined,
      onTitleChange:
        typeof options.onTitleChange === 'function'
          ? (value) => {
              options.onTitleChange(value);
              syncControlLabels();
            }
          : () => {
              syncControlLabels();
            },
    });

    const windowElement = memoController?.element;

    if (!(windowElement instanceof HTMLElement)) {
      throw new Error('メモウィンドウの生成に失敗しました。');
    }

    windowElement.classList.add('workspace__window');
    windowElement.classList.add('workspace__window--memo');
    windowElement.classList.remove('workspace__window--maximized');
    delete windowElement.dataset.windowMaximized;
    windowElement.setAttribute('role', 'group');

    const header = memoController?.header;

    if (!(header instanceof HTMLElement)) {
      throw new Error('メモウィンドウにはヘッダー要素が必要です。');
    }

    let disposed = false;
    let openedAt = Number.isFinite(options.openedAt) ? options.openedAt : Date.now();
    let lastFocusedAt = Number.isFinite(options.lastFocusedAt) ? options.lastFocusedAt : openedAt;

    const syncFocusMetadata = () => {
      windowElement.dataset.openedAt = String(openedAt);
      windowElement.dataset.lastFocusedAt = String(lastFocusedAt);
    };

    const resizeHandleDefinitions = [
      { position: 'top-left', horizontal: 'left', vertical: 'top', cursor: 'nwse-resize' },
      { position: 'top-right', horizontal: 'right', vertical: 'top', cursor: 'nesw-resize' },
      { position: 'bottom-left', horizontal: 'left', vertical: 'bottom', cursor: 'nesw-resize' },
      { position: 'bottom-right', horizontal: 'right', vertical: 'bottom', cursor: 'nwse-resize' },
    ];

    let handleLayoutCommit = () => {};

    const chrome = createWindowChrome({
      windowElement,
      windowId,
      windowType: 'memo',
      layout: layoutOptions,
      initialZIndex: Number.isFinite(options.zIndex) ? Math.round(options.zIndex) : null,
      shouldStartMaximized: options.maximized === true,
      onFocusPersist: () => {
        lastFocusedAt = Date.now();
        syncFocusMetadata();
      },
      onLayoutCommit: () => {
        handleLayoutCommit();
      },
    });

    const bringToFront = ({ persistFocus = true } = {}) => chrome.bringToFront({ persistFocus });

    handleLayoutCommit = () => {
      if (typeof options.onLayoutChange === 'function') {
        options.onLayoutChange(chrome.getLayoutState());
      }
    };

    syncFocusMetadata();

    const controls = header.querySelector('.workspace__window-controls');
    const maximizeButton = document.createElement('button');
    maximizeButton.type = 'button';
    maximizeButton.className = 'workspace__window-maximize';
    maximizeButton.textContent = '最大化';
    maximizeButton.setAttribute('aria-pressed', 'false');
    maximizeButton.addEventListener('click', () => {
      chrome.toggleMaximize();
      syncControlLabels();
    });

    if (controls instanceof HTMLElement) {
      controls.insertBefore(maximizeButton, memoController?.closeButton ?? null);
    } else {
      header.append(maximizeButton);
    }

    chrome.setMaximizeControl(maximizeButton);

    const resizeHandles = [];
    resizeHandleDefinitions.forEach((definition) => {
      const handle = chrome.createResizeHandle(definition);
      resizeHandles.push(handle);
      windowElement.append(handle);
    });

    const detachHeaderInteractions = chrome.attachHeader(header);
    const detachWindowInteractions = chrome.attachWindowInteractions();

    syncControlLabels = () => {
      const title =
        typeof memoController?.getTitle === 'function' ? memoController.getTitle() : 'メモ';

      windowElement.setAttribute('aria-label', `${title} のウィンドウ`);

      maximizeButton.setAttribute(
        'aria-label',
        chrome.isMaximized() ? `${title} を元のサイズに戻す` : `${title} を最大化`,
      );

      resizeHandles.forEach((handle) => {
        handle.setAttribute('aria-label', `${title} のウィンドウサイズを変更`);
      });
    };

    syncControlLabels();

    if (typeof memoController?.setFocusDelegate === 'function') {
      memoController.setFocusDelegate(() => {
        bringToFront({ persistFocus: false });
      });
    }

    disposeWindow = ({ emitClose = true } = {}) => {
      if (disposed) {
        return;
      }

      disposed = true;
      detachHeaderInteractions();
      detachWindowInteractions();
      chrome.destroy();
      windowElement.remove();
      windowRegistry.delete(windowId);
      syncEmptyState();

      if (typeof options.onDispose === 'function') {
        options.onDispose();
      }
    };

    area.append(windowElement);

    windowRegistry.set(windowId, {
      element: windowElement,
      bringToFront,
      dispose: ({ emitClose = true } = {}) => {
        disposeWindow({ emitClose });
      },
      getLastFocused: () => lastFocusedAt,
      getOpenedAt: () => openedAt,
      getTitle: () => (typeof memoController?.getTitle === 'function' ? memoController.getTitle() : 'メモ'),
      id: windowId,
    });

    syncEmptyState();

    if (shouldAutoFocus) {
      bringToFront();

      if (typeof memoController?.focusEditor === 'function') {
        memoController.focusEditor();
      } else {
        windowElement.focus({ preventScroll: true });
      }
    } else {
      windowElement.dataset.windowActive = 'false';
    }

    if (options.returnController === true) {
      return {
        element: windowElement,
        controller: memoController,
        dispose: ({ emitClose = true } = {}) => {
          disposeWindow({ emitClose });
        },
      };
    }

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
    openMemoWindow,
    focusWindow,
    cycleFocus,
    closeAllWindows,
    getWindowEntries,
    getWindowCount,
  };
}


