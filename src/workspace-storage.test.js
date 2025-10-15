import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  __clearMemoryStore,
  clearWorkspaceWindows,
  exportWorkspaceSnapshot,
  importWorkspaceSnapshot,
  loadWorkspacePreferences,
  persistWorkspacePreference,
  persistWorkspaceWindow,
} from './workspace-storage.js';

const originalIndexedDB = globalThis.indexedDB;

beforeAll(() => {
  // Force the in-memory store to be used during tests.
  // eslint-disable-next-line no-global-assign
  globalThis.indexedDB = undefined;
});

afterEach(() => {
  __clearMemoryStore();
});

describe('workspace-storage snapshots', () => {
  beforeEach(() => {
    __clearMemoryStore();
  });

  it('exports persisted windows as a JSON snapshot with embedded PDFs', async () => {
    const file = new File(['pdf-data'], 'snapshot.pdf', {
      type: 'application/pdf',
      lastModified: 1_728_600_000_000,
    });

    await persistWorkspaceWindow(
      {
        id: 'window-1',
        file,
        windowType: 'pdf',
        left: 100,
        top: 160,
        width: 420,
        height: 320,
        page: 3,
        zoom: 1.4,
        rotation: 90,
        totalPages: 12,
        pinned: true,
        maximized: false,
        restoreLeft: 100,
        restoreTop: 160,
        restoreWidth: 420,
        restoreHeight: 320,
        notes: 'notes',
        color: 'emerald',
        pageHistory: [1, 3, 5],
        pageHistoryIndex: 2,
        bookmarks: [2, 5],
        layout: {
          version: 1,
          zIndex: 120,
          bounds: { left: 100, top: 160, width: 420, height: 320 },
          restoreBounds: { left: 100, top: 160, width: 420, height: 320 },
          pinned: true,
          maximized: false,
        },
      },
      { includeFile: true },
    );

    const { blob, windows, payload } = await exportWorkspaceSnapshot();

    expect(windows).toBe(1);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);

    expect(payload.version).toBeGreaterThan(0);
    expect(Array.isArray(payload.windows)).toBe(true);
    expect(payload.windows[0].id).toBe('window-1');
    expect(payload.windows[0].data.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(payload.windows[0].page).toBe(3);
    expect(payload.windows[0].windowType).toBe('pdf');
    expect(payload.windows[0].layout).toMatchObject({
      version: 1,
      zIndex: 120,
      bounds: { left: 100, top: 160, width: 420, height: 320 },
      restoreBounds: { left: 100, top: 160, width: 420, height: 320 },
      pinned: true,
      maximized: false,
    });
  });

  it('imports a snapshot and recreates window descriptors with files', async () => {
    const restoredPdf = new File(['pdf-data'], 'restore.pdf', { type: 'application/pdf' });
    const base64Data = Buffer.from('pdf-data').toString('base64');
    const text = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      windows: [
        {
          id: 'window-2',
          windowType: 'pdf',
          data: {
            base64: base64Data,
            type: 'application/pdf',
            name: 'restore.pdf',
            lastModified: restoredPdf.lastModified,
          },
          page: 4,
          zoom: 1.2,
          color: 'amber',
          bookmarks: [1, 4],
          layout: {
            version: 1,
            zIndex: 360,
            bounds: { left: 24, top: 32, width: 420, height: 320 },
            restoreBounds: { left: 24, top: 32, width: 420, height: 320 },
            pinned: false,
            maximized: false,
          },
        },
      ],
    });

    const snapshot = { text: () => Promise.resolve(text) };

    await clearWorkspaceWindows();

    const result = await importWorkspaceSnapshot(snapshot);

    expect(result.version).toBe(1);
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0].id).toBe('window-2');
    expect(result.windows[0].page).toBe(4);
    expect(result.windows[0].file?.name).toBe('restore.pdf');
    expect(result.windows[0].windowType).toBe('pdf');
    expect(result.windows[0].layout).toMatchObject({
      version: 1,
      zIndex: 360,
      bounds: { left: 24, top: 32, width: 420, height: 320 },
      restoreBounds: { left: 24, top: 32, width: 420, height: 320 },
      pinned: false,
      maximized: false,
    });
  });

  it('throws when provided snapshot JSON is invalid', async () => {
    const broken = new File(['not-json'], 'broken.json', { type: 'application/json' });

    await expect(importWorkspaceSnapshot(broken)).rejects.toThrow('valid JSON');
  });

  it('persists and clears workspace preferences using the memory fallback', async () => {
    await persistWorkspacePreference('onboardingCompleted', true);

    let preferences = await loadWorkspacePreferences();
    expect(preferences.onboardingCompleted).toBe(true);

    await persistWorkspacePreference('onboardingCompleted', undefined);
    preferences = await loadWorkspacePreferences();
    expect(preferences.onboardingCompleted).toBeUndefined();

    await persistWorkspacePreference('onboardingCompleted', true);
    await clearWorkspaceWindows();
    preferences = await loadWorkspacePreferences();
    expect(preferences.onboardingCompleted).toBeUndefined();
  });

  it('filters exported windows when specific identifiers are requested', async () => {
    const fileA = new File(['A'], 'a.pdf', { type: 'application/pdf' });
    const fileB = new File(['B'], 'b.pdf', { type: 'application/pdf' });

    await persistWorkspaceWindow({ id: 'window-a', file: fileA }, { includeFile: true });
    await persistWorkspaceWindow({ id: 'window-b', file: fileB }, { includeFile: true });

    const result = await exportWorkspaceSnapshot({ windowIds: ['window-b'] });

    expect(result.windows).toBe(1);
    expect(result.payload.windows).toHaveLength(1);
    expect(result.payload.windows[0].id).toBe('window-b');
  });
});

afterAll(() => {
  // eslint-disable-next-line no-global-assign
  globalThis.indexedDB = originalIndexedDB;
});
