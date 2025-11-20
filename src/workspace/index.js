import { createSamplePdfFile } from '../sample-pdf.js';
import {
  clearWorkspaceWindows,
  exportWorkspaceSnapshot,
  importWorkspaceSnapshot,
  loadWorkspacePreferences,
  loadWorkspaceWindows,
  persistWorkspacePreference,
} from '../workspace-storage.js';
import { createWindowCanvas } from './canvas.js';
import { createHeader, createHint } from './chrome.js';
import { createDropZone } from './drop-zone.js';
import { createFileQueue } from './file-queue.js';
import { createMaintenancePanel } from './maintenance.js';
import { createOnboarding } from './onboarding.js';
import { createWorkspaceMenu } from './menu.js';
import {
  PREF_ONBOARDING_COMPLETED,
  WORKSPACE_CACHE_CLEARED_EVENT,
  WORKSPACE_SESSION_EXPORTED_EVENT,
  WORKSPACE_SESSION_IMPORTED_EVENT,
  WORKSPACE_MENU_CHANGE_EVENT,
  WORKSPACE_QUICK_MEMO_REQUEST_EVENT,
  WINDOW_CLOSE_EVENT,
  WINDOW_FOCUS_CYCLE_EVENT,
  WINDOW_MAXIMIZE_CHANGE_EVENT,
  WINDOW_PIN_TOGGLE_EVENT,
  WINDOW_TITLE_CHANGE_EVENT,
} from './constants.js';
import { formatSnapshotTimestamp } from './utils.js';
import { applyWorkspaceTheme } from './theme.js';
import { createWindowLayers } from './window-layers.js';

export function createWorkspace() {
  const workspace = document.createElement('div');
  workspace.className = 'workspace';
  workspace.dataset.role = 'workspace';
  applyWorkspaceTheme(workspace);

  const { element: header, main: appBarMain } = createHeader();
  const quickPanel = createHint();
  const menu = createWorkspaceMenu();
  const panels = new Map();
  let canvas = null;
  let onboardingCompleted = false;
  let onboarding = null;
  let stageOverlay = null;
  let stageHint = null;
  let layersOverlay = null;

  const getUtilityButton = (id) =>
    header.querySelector(`.workspace__utility-button[data-utility-id="${id}"]`);

  const layersButton = getUtilityButton('layers');

  const utilityMenuTargets = new Map([
    ['reference', 'browser'],
    ['settings', 'log'],
  ]);

  const syncLayersDataset = (open) => {
    if (open) {
      workspace.dataset.utilityLayers = 'open';
    } else {
      delete workspace.dataset.utilityLayers;
    }
  };

  const setLayersOverlayOpen = (open) => {
    const controller = layersOverlay;

    if (!controller) {
      syncLayersDataset(open);
      return;
    }

    const element = controller.element;

    if (open) {
      syncLayersDataset(true);
      element.hidden = false;
      element.setAttribute('aria-hidden', 'false');
      controller.update();
    } else {
      syncLayersDataset(false);
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    }
  };

  const toggleLayersOverlay = () => {
    const isOpen = workspace.dataset.utilityLayers === 'open';
    setLayersOverlayOpen(!isOpen);
  };

  if (layersButton instanceof HTMLButtonElement) {
    layersButton.addEventListener('click', toggleLayersOverlay);
  }

  const syncPanelVisibility = () => {
    const activeMenuId = menu.getActiveId?.();

    panels.forEach((panel, panelId) => {
      const isActive = panelId === activeMenuId;
      panel.hidden = !isActive;

      if (isActive) {
        panel.dataset.panelActive = 'true';
      } else {
        delete panel.dataset.panelActive;
      }
    });
  };

  const activateMenuPanel = (panelId) => {
    if (typeof menu?.setActive !== 'function') {
      return;
    }

    if (typeof panelId !== 'string' || panelId.length === 0) {
      return;
    }

    menu.setActive(panelId);

    const activeMenuId = menu.getActiveId?.();

    if (activeMenuId === panelId) {
      workspace.dataset.activeMenu = panelId;
      syncPanelVisibility();
    }
  };

  const syncMenuDataset = () => {
    const activeMenuId = menu.getActiveId?.();

    if (typeof activeMenuId === 'string' && activeMenuId.length > 0) {
      workspace.dataset.activeMenu = activeMenuId;
    } else {
      delete workspace.dataset.activeMenu;
    }

    syncPanelVisibility();
    updateOnboardingVisibility();
  };

  syncMenuDataset();

  utilityMenuTargets.forEach((panelId, utilityId) => {
    const button = getUtilityButton(utilityId);

    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener('click', () => {
      activateMenuPanel(panelId);
    });
  });

  workspace.addEventListener(WORKSPACE_MENU_CHANGE_EVENT, (event) => {
    const id = typeof event?.detail?.id === 'string' ? event.detail.id : '';
    if (id) {
      workspace.dataset.activeMenu = id;
    } else {
      delete workspace.dataset.activeMenu;
    }

    syncPanelVisibility();
    updateOnboardingVisibility();
  });

  const queue = createFileQueue();

  const dropZone = createDropZone();

  function updateOnboardingVisibility(count) {
    const windowCount = Number.isFinite(count)
      ? count
      : canvas?.getWindowCount?.() ?? 0;

    const hasWindows = windowCount > 0;
    workspace.classList.toggle('workspace--has-windows', hasWindows);

    const activeMenuId = menu.getActiveId?.();
    const isBrowserActive = activeMenuId === 'browser';

    if (onboarding) {
      const shouldShowOnboarding = !onboardingCompleted && !hasWindows && isBrowserActive;
      onboarding.setActive(shouldShowOnboarding);
    }

    if (stageOverlay) {
      stageOverlay.hidden = hasWindows || !isBrowserActive;
    }

    if (stageHint) {
      stageHint.hidden = hasWindows;
    }
  }

  const setOnboardingCompletion = async (completed) => {
    await persistWorkspacePreference(PREF_ONBOARDING_COMPLETED, completed === true);
    onboardingCompleted = completed === true;
    updateOnboardingVisibility();
  };

  onboarding = createOnboarding({
    onRequestSample: async () => {
      const sample = createSamplePdfFile();
      canvas?.openWindow(sample);
    },
    onDismiss: async () => {
      await setOnboardingCompletion(true);
    },
  });

  canvas = createWindowCanvas({
    onWindowCountChange: (count) => {
      updateOnboardingVisibility(count);
    },
  });
  layersOverlay = createWindowLayers({ canvas });
  layersOverlay.element.hidden = true;
  layersOverlay.element.setAttribute('aria-hidden', 'true');

  const updateLayersOverlay = () => {
    if (layersOverlay) {
      layersOverlay.update();
    }
  };

  const wrapCanvasMethod = (method) => {
    if (!canvas || typeof canvas[method] !== 'function') {
      return;
    }

    const original = canvas[method].bind(canvas);

    canvas[method] = (...args) => {
      const result = original(...args);
      updateLayersOverlay();
      return result;
    };
  };

  wrapCanvasMethod('openWindow');
  wrapCanvasMethod('closeAllWindows');
  wrapCanvasMethod('focusWindow');
  wrapCanvasMethod('cycleFocus');

  if (canvas?.element instanceof HTMLElement) {
    const refreshEvents = [
      WINDOW_CLOSE_EVENT,
      WINDOW_PIN_TOGGLE_EVENT,
      WINDOW_TITLE_CHANGE_EVENT,
      WINDOW_MAXIMIZE_CHANGE_EVENT,
      WINDOW_FOCUS_CYCLE_EVENT,
    ];

    const handleCanvasMutation = () => {
      updateLayersOverlay();
    };

    refreshEvents.forEach((type) => {
      canvas.element.addEventListener(type, handleCanvasMutation);
    });

    canvas.element.addEventListener('focusin', handleCanvasMutation);
  }

  setLayersOverlayOpen(false);
  updateOnboardingVisibility(canvas.getWindowCount());
  const maintenance = createMaintenancePanel({
    onClear: async () => {
      await clearWorkspaceWindows();
      const windowsCleared = canvas.closeAllWindows();
      queue.clear();

      onboardingCompleted = false;
      onboarding.resetStatus();
      updateOnboardingVisibility(0);

      const cleared = new CustomEvent(WORKSPACE_CACHE_CLEARED_EVENT, {
        bubbles: true,
        detail: { windowsCleared },
      });

      workspace.dispatchEvent(cleared);

      return { windowsCleared };
    },
    onExport: async ({ scope = 'all', compression = 'none' } = {}) => {
      const normalizedScope = scope === 'open' ? 'open' : 'all';
      const windowIds =
        normalizedScope === 'open'
          ? canvas
              .getWindowEntries()
              .map((entry) => entry.id)
              .filter((id) => typeof id === 'string' && id.length > 0)
          : null;

      if (windowIds && windowIds.length === 0) {
        return { windows: 0, message: '書き出すウィンドウがありません。' };
      }

      const result = await exportWorkspaceSnapshot({ windowIds, compression });
      const blob = result?.blob;

      if (!(blob instanceof Blob)) {
        throw new Error('セッションの書き出しに必要なデータを取得できませんでした。');
      }

      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        throw new Error('ファイルの書き出しに対応していない環境です。');
      }

      const url = URL.createObjectURL(blob);
      const timestamp = formatSnapshotTimestamp();
      const extension = result?.compression === 'gzip' ? 'json.gz' : 'json';
      const fileName = `gmworkbench-session-${timestamp}.${extension}`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.append(link);
      link.click();
      link.remove();

      if (typeof URL.revokeObjectURL === 'function') {
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 0);
      }

      const detail = {
        windows: Number.isFinite(result?.windows) ? result.windows : 0,
        fileName,
      };

      workspace.dispatchEvent(
        new CustomEvent(WORKSPACE_SESSION_EXPORTED_EVENT, {
          bubbles: true,
          detail,
        }),
      );

      return {
        ...detail,
        compression: result?.compression === 'gzip' ? 'gzip' : 'none',
      };
    },
    onImport: async (file) => {
      if (!(file instanceof File) && !(file instanceof Blob)) {
        throw new TypeError('セッションファイルを選択してください。');
      }

      const snapshot = await importWorkspaceSnapshot(file);
      const windows = Array.isArray(snapshot?.windows) ? snapshot.windows : [];

      const previousWindows = canvas.closeAllWindows({ emitClose: false });
      queue.clear();
      await clearWorkspaceWindows();

      let opened = 0;
      let lastFocusedId = null;
      let lastFocusedTime = Number.NEGATIVE_INFINITY;

      const sorted = windows
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

      sorted.forEach((entry) => {
        const { file: windowFile, ...state } = entry;

        if (!windowFile) {
          return;
        }

        const element = canvas.openWindow(windowFile, {
          ...state,
          autoFocus: false,
        });

        if (element && typeof element.dataset?.windowId === 'string') {
          opened += 1;

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

      const detail = {
        windows: opened,
        previous: Number.isFinite(previousWindows) ? previousWindows : 0,
        exportedAt: snapshot?.exportedAt,
      };

      workspace.dispatchEvent(
        new CustomEvent(WORKSPACE_SESSION_IMPORTED_EVENT, {
          bubbles: true,
          detail,
        }),
      );

      return detail;
    },
  });

  void (async () => {
    try {
      const preferences = await loadWorkspacePreferences();

      if (preferences?.[PREF_ONBOARDING_COMPLETED] === true) {
        onboardingCompleted = true;
        onboarding.resetStatus();
      } else {
        onboardingCompleted = false;
      }
    } catch (error) {
      onboardingCompleted = false;
    } finally {
      updateOnboardingVisibility();
    }
  })();

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

  workspace.addEventListener(WORKSPACE_QUICK_MEMO_REQUEST_EVENT, () => {
    if (typeof canvas?.openMemoWindow !== 'function') {
      return;
    }

    canvas.openMemoWindow({
      title: 'クイックメモ',
      placeholder: 'ひらめきを逃さずにメモできます。',
    });
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

  const stage = document.createElement('div');
  stage.className = 'workspace__stage';

  const layout = document.createElement('div');
  layout.className = 'workspace__layout';
  layout.append(canvas.element);
  stage.append(layout);

  stageOverlay = document.createElement('div');
  stageOverlay.className = 'workspace__stage-overlay';

  const stageContentFragment = document.createDocumentFragment();
  stageContentFragment.append(onboarding.element);

  stageHint = document.createElement('p');
  stageHint.className = 'workspace__stage-hint';
  stageHint.textContent = '「PDFブラウザ」メニューからPDFを開くとここに表示されます。';
  stageContentFragment.append(stageHint);

  stageOverlay.append(stageContentFragment);
  canvas.element.append(stageOverlay);

  // Create Sidebar Container
  const sidebar = document.createElement('aside');
  sidebar.className = 'workspace__sidebar';
  sidebar.hidden = true; // Default hidden on mobile, controlled by toggle

  const menuSurface = document.createElement('div');
  menuSurface.className = 'workspace__menu-surface';
  menuSurface.append(menu.element);

  const panelsContainer = document.createElement('div');
  panelsContainer.className = 'workspace__menu-panels';
  menuSurface.append(panelsContainer);
  
  sidebar.append(menuSurface);

  const registerPanel = (id, nodes) => {
    const panel = document.createElement('section');
    panel.className = 'workspace__menu-panel';
    panel.dataset.menuPanel = id;
    panel.hidden = true;

    const elements = Array.isArray(nodes) ? nodes : [nodes];
    elements.filter(Boolean).forEach((node) => {
      panel.append(node);
    });

    panels.set(id, panel);
    panelsContainer.append(panel);
    return panel;
  };

  registerPanel('browser', [dropZone, queue.element]);

  const npcNote = document.createElement('p');
  npcNote.className = 'workspace__menu-note';
  npcNote.textContent = '仲間やNPCに関するひらめきを素早く残せます。';
  registerPanel('npc', [npcNote, quickPanel]);

  const mapNote = document.createElement('p');
  mapNote.className = 'workspace__menu-note';
  mapNote.textContent = 'マップビューの更新をお待ちください。';
  registerPanel('map', mapNote);

  const logNote = document.createElement('p');
  logNote.className = 'workspace__menu-note';
  logNote.textContent = '保存データの書き出し・読み込みとキャッシュ管理を行えます。';
  registerPanel('log', [logNote, maintenance.element]);

  // Main Container (Flex Row)
  const container = document.createElement('div');
  container.className = 'workspace__container';
  container.append(stage, sidebar);

  workspace.append(header, container);

  if (layersOverlay?.element instanceof HTMLElement) {
    stage.append(layersOverlay.element);
  }

  // Sidebar toggle logic
  const toggleSidebar = () => {
    const isHidden = sidebar.hidden;
    sidebar.hidden = !isHidden;
    workspace.dataset.sidebarOpen = (!isHidden).toString();
  };

  // Update utility buttons to toggle sidebar instead of just activating panel
  utilityMenuTargets.forEach((panelId, utilityId) => {
    const button = getUtilityButton(utilityId);
    if (button instanceof HTMLButtonElement) {
      button.addEventListener('click', () => {
        activateMenuPanel(panelId);
        if (sidebar.hidden) {
          sidebar.hidden = false;
        }
      });
    }
  });

  syncPanelVisibility();
  updateOnboardingVisibility();
  return workspace;
}
