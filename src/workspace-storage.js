const DATABASE_NAME = 'gmworkbench';
const DATABASE_VERSION = 1;
const STORE_NAME = 'workspace-windows';
const MAX_STORED_HISTORY = 50;
const ROTATION_STEP = 90;

const memoryStore = new Map();
let databasePromise = null;

const hasIndexedDB = () => typeof indexedDB !== 'undefined';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open workspace storage.'));
    };
  });
}

async function getDatabase() {
  if (!hasIndexedDB()) {
    return null;
  }

  if (!databasePromise) {
    databasePromise = openDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function toBlob(file) {
  if (!file) {
    return null;
  }

  if (file instanceof Blob) {
    return Promise.resolve(file);
  }

  if (typeof file.arrayBuffer === 'function') {
    return file
      .arrayBuffer()
      .then((buffer) => new Blob([buffer], { type: file.type || 'application/pdf' }));
  }

  return Promise.reject(new TypeError('Provided file is not blob-compatible.'));
}

function normalizeRotation(value) {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.round(value / ROTATION_STEP) * ROTATION_STEP;
  const wrapped = ((rounded % 360) + 360) % 360;
  const normalized = wrapped === 360 ? 0 : wrapped;
  return normalized;
}

function normalizeForStorage(state) {
  const normalized = { id: state.id };

  if (typeof state.name === 'string' && state.name.length > 0) {
    normalized.name = state.name;
  }

  if (typeof state.type === 'string' && state.type.length > 0) {
    normalized.type = state.type;
  }

  if (Number.isFinite(state.lastModified)) {
    normalized.lastModified = state.lastModified;
  }

  if (Number.isFinite(state.left)) {
    normalized.left = state.left;
  }

  if (Number.isFinite(state.top)) {
    normalized.top = state.top;
  }

  if (Number.isFinite(state.width)) {
    normalized.width = state.width;
  }

  if (Number.isFinite(state.height)) {
    normalized.height = state.height;
  }

  if (Number.isFinite(state.page)) {
    normalized.page = state.page;
  }

  if (Number.isFinite(state.zoom)) {
    normalized.zoom = state.zoom;
  }

  const rotation = normalizeRotation(state.rotation);

  if (Number.isFinite(rotation)) {
    normalized.rotation = rotation;
  }

  if (Number.isFinite(state.totalPages)) {
    normalized.totalPages = state.totalPages;
  }

  if (typeof state.pinned === 'boolean') {
    normalized.pinned = state.pinned;
  }

  if (typeof state.maximized === 'boolean') {
    normalized.maximized = state.maximized;
  }

  if (Number.isFinite(state.restoreLeft)) {
    normalized.restoreLeft = state.restoreLeft;
  }

  if (Number.isFinite(state.restoreTop)) {
    normalized.restoreTop = state.restoreTop;
  }

  if (Number.isFinite(state.restoreWidth)) {
    normalized.restoreWidth = state.restoreWidth;
  }

  if (Number.isFinite(state.restoreHeight)) {
    normalized.restoreHeight = state.restoreHeight;
  }

  if (Number.isFinite(state.openedAt)) {
    normalized.openedAt = state.openedAt;
  }

  if (Number.isFinite(state.lastFocusedAt)) {
    normalized.lastFocusedAt = state.lastFocusedAt;
  }

  if (typeof state.title === 'string' && state.title.length > 0) {
    normalized.title = state.title;
  }

  if (typeof state.notes === 'string') {
    normalized.notes = state.notes;
  }

  if (typeof state.color === 'string' && state.color.length > 0) {
    normalized.color = state.color;
  }

  let history = [];
  let trimmedOffset = 0;

  if (Array.isArray(state.pageHistory) && state.pageHistory.length > 0) {
    const sanitized = state.pageHistory
      .map((value) => (Number.isFinite(value) ? Math.max(1, Math.floor(value)) : null))
      .filter((value) => Number.isFinite(value));

    if (sanitized.length > 0) {
      if (sanitized.length > MAX_STORED_HISTORY) {
        trimmedOffset = sanitized.length - MAX_STORED_HISTORY;
        history = sanitized.slice(-MAX_STORED_HISTORY);
      } else {
        history = sanitized;
      }
    }
  }

  let historyIndex;

  if (Number.isFinite(state.pageHistoryIndex)) {
    historyIndex = Math.max(0, Math.floor(state.pageHistoryIndex));

    if (trimmedOffset > 0) {
      historyIndex = Math.max(0, historyIndex - trimmedOffset);
    }
  }

  if (history.length > 0) {
    normalized.pageHistory = history;

    if (Number.isFinite(historyIndex)) {
      normalized.pageHistoryIndex = Math.min(history.length - 1, historyIndex);
    }
  }

  if (state.data instanceof Blob) {
    normalized.data = state.data;
  }

  return normalized;
}

function mergeRecords(existing, next) {
  if (!existing) {
    return next;
  }

  const merged = { ...existing, ...next };

  if (existing.data && !next.data) {
    merged.data = existing.data;
  }

  return merged;
}

function createStoredFile(record) {
  if (!record.data) {
    return null;
  }

  const name = record.name || 'document.pdf';
  const type = record.type || 'application/pdf';
  const lastModified = Number.isFinite(record.lastModified)
    ? record.lastModified
    : Date.now();

  if (typeof File === 'function') {
    try {
      return new File([record.data], name, { type, lastModified });
    } catch (error) {
      // continue with fallback
    }
  }

  const blob = record.data instanceof Blob
    ? record.data
    : new Blob([record.data], { type });

  const fallback = Object.assign(blob, {
    name,
    type,
    lastModified,
  });

  if (typeof blob.arrayBuffer === 'function') {
    fallback.arrayBuffer = blob.arrayBuffer.bind(blob);
  }

  return fallback;
}

function normalizeFromStorage(record) {
  if (!record || !record.id) {
    return null;
  }

  const file = createStoredFile(record);

  if (!file) {
    return null;
  }

  const history =
    Array.isArray(record.pageHistory) && record.pageHistory.length > 0
      ? record.pageHistory
          .map((value) => (Number.isFinite(value) ? Math.max(1, Math.floor(value)) : null))
          .filter((value) => Number.isFinite(value))
      : [];

  let historyIndex = Number.isFinite(record.pageHistoryIndex)
    ? Math.max(0, Math.floor(record.pageHistoryIndex))
    : undefined;

  if (history.length === 0) {
    historyIndex = undefined;
  } else if (Number.isFinite(historyIndex) && historyIndex >= history.length) {
    historyIndex = history.length - 1;
  }

  return {
    id: record.id,
    file,
    name: record.name,
    type: record.type,
    lastModified: record.lastModified,
    left: Number.isFinite(record.left) ? record.left : undefined,
    top: Number.isFinite(record.top) ? record.top : undefined,
    width: Number.isFinite(record.width) ? record.width : undefined,
    height: Number.isFinite(record.height) ? record.height : undefined,
    page: Number.isFinite(record.page) ? record.page : undefined,
    zoom: Number.isFinite(record.zoom) ? record.zoom : undefined,
    rotation: Number.isFinite(record.rotation) ? normalizeRotation(record.rotation) : undefined,
    totalPages: Number.isFinite(record.totalPages) ? record.totalPages : undefined,
    pinned: typeof record.pinned === 'boolean' ? record.pinned : undefined,
    maximized: typeof record.maximized === 'boolean' ? record.maximized : undefined,
    restoreLeft: Number.isFinite(record.restoreLeft) ? record.restoreLeft : undefined,
    restoreTop: Number.isFinite(record.restoreTop) ? record.restoreTop : undefined,
    restoreWidth: Number.isFinite(record.restoreWidth) ? record.restoreWidth : undefined,
    restoreHeight: Number.isFinite(record.restoreHeight) ? record.restoreHeight : undefined,
    openedAt: Number.isFinite(record.openedAt) ? record.openedAt : undefined,
    lastFocusedAt: Number.isFinite(record.lastFocusedAt)
      ? record.lastFocusedAt
      : undefined,
    title: typeof record.title === 'string' ? record.title : undefined,
    notes: typeof record.notes === 'string' ? record.notes : '',
    color: typeof record.color === 'string' ? record.color : undefined,
    pageHistory: history.length > 0 ? history : undefined,
    pageHistoryIndex: Number.isFinite(historyIndex) ? historyIndex : undefined,
    persisted: true,
  };
}

export async function loadWorkspaceWindows() {
  if (!hasIndexedDB()) {
    return Array.from(memoryStore.values())
      .map(normalizeFromStorage)
      .filter(Boolean);
  }

  const database = await getDatabase();

  if (!database) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = Array.isArray(request.result) ? request.result : [];
      resolve(records.map(normalizeFromStorage).filter(Boolean));
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to load workspace windows.'));
    };
  });
}

export async function persistWorkspaceWindow(state, options = {}) {
  if (!state || !state.id) {
    throw new TypeError('A workspace window id is required for persistence.');
  }

  const includeFile = options.includeFile === true;
  const record = { ...state };

  if (includeFile && state.file) {
    const blob = await toBlob(state.file);
    record.data = blob;
    record.name = state.file.name || record.name;
    record.type = state.file.type || record.type;
    record.lastModified = state.file.lastModified || record.lastModified || Date.now();
  }

  const normalized = normalizeForStorage(record);

  if (!hasIndexedDB()) {
    const existing = memoryStore.get(normalized.id);
    memoryStore.set(normalized.id, mergeRecords(existing, normalized));
    return;
  }

  const database = await getDatabase();

  if (!database) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(normalized.id);

    request.onsuccess = () => {
      const existing = request.result;
      const merged = mergeRecords(existing, normalized);
      const putRequest = store.put(merged);

      putRequest.onsuccess = () => {
        resolve();
      };

      putRequest.onerror = () => {
        reject(putRequest.error || new Error('Failed to persist workspace window.'));
      };
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to read existing workspace window.'));
    };
  });
}

export async function removeWorkspaceWindow(id) {
  if (!id) {
    return;
  }

  if (!hasIndexedDB()) {
    memoryStore.delete(id);
    return;
  }

  const database = await getDatabase();

  if (!database) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to remove workspace window.'));
    };
  });
}

export async function clearWorkspaceWindows() {
  memoryStore.clear();

  if (!hasIndexedDB()) {
    return;
  }

  const database = await getDatabase();

  if (!database) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to clear workspace windows.'));
    };
  });
}

export function __clearMemoryStore() {
  memoryStore.clear();
}
