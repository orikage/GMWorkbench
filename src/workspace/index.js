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
  WORKSPACE_TRACK_CHANGE_EVENT,
  WORKSPACE_VOLUME_CHANGE_EVENT,
} from './constants.js';
import { formatSnapshotTimestamp } from './utils.js';
import { applyWorkspaceTheme } from './theme.js';

export function createWorkspace() {
  const workspace = document.createElement('div');
  workspace.className = 'workspace';
  workspace.dataset.role = 'workspace';
  applyWorkspaceTheme(workspace);

  const header = createHeader();
  const quickPanel = createHint();
  const menu = createWorkspaceMenu();

  const syncMenuDataset = () => {
    const activeMenuId = menu.getActiveId();
    const activeTrackId = menu.getActiveTrackId();
    const volume = menu.getVolume();

    workspace.dataset.activeMenu = typeof activeMenuId === 'string' ? activeMenuId : '';
    workspace.dataset.activeTrack = typeof activeTrackId === 'string' ? activeTrackId : '';
    workspace.dataset.menuVolume = Number.isFinite(volume) ? String(volume) : '';
  };

  syncMenuDataset();

  workspace.addEventListener(WORKSPACE_MENU_CHANGE_EVENT, (event) => {
    const id = typeof event?.detail?.id === 'string' ? event.detail.id : '';
    workspace.dataset.activeMenu = id;
  });

  workspace.addEventListener(WORKSPACE_TRACK_CHANGE_EVENT, (event) => {
    const id = typeof event?.detail?.id === 'string' ? event.detail.id : '';
    workspace.dataset.activeTrack = id;
  });

  workspace.addEventListener(WORKSPACE_VOLUME_CHANGE_EVENT, (event) => {
    const value = event?.detail?.value;
    const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : menu.getVolume();
    workspace.dataset.menuVolume = Number.isFinite(numeric) ? String(numeric) : '';
  });

  const queue = createFileQueue();
  let canvas = null;
  let onboardingCompleted = false;
  let onboarding = null;

  const dropZone = createDropZone();

  const updateOnboardingVisibility = (count) => {
    if (!onboarding) {
      return;
    }

    const windowCount = Number.isFinite(count)
      ? count
      : canvas?.getWindowCount?.() ?? 0;

    const hasWindows = windowCount > 0;
    onboarding.setActive(!onboardingCompleted && !hasWindows);
    workspace.classList.toggle('workspace--has-windows', hasWindows);
  };

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
        URL.revokeObjectURL(url);
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

  const viewer = document.createElement('section');
  viewer.className = 'workspace__viewer';
  viewer.append(canvas.element);

  const overlay = document.createElement('div');
  overlay.className = 'workspace__viewer-overlay';
  overlay.append(dropZone, onboarding.element);
  viewer.append(overlay);

  const body = document.createElement('div');
  body.className = 'workspace__body';
  body.append(viewer, menu.element);

  const utilities = document.createElement('aside');
  utilities.className = 'workspace__side-panel';
  utilities.append(queue.element, maintenance.element);

  workspace.append(header, body, quickPanel, utilities);
  return workspace;
}
