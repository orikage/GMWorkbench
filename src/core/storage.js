const DATABASE_NAME = 'gmworkbench';
const DATABASE_VERSION = 2;
const STORE_NAME = 'workspace-windows';
const SETTINGS_STORE_NAME = 'workspace-settings';
const MAX_STORED_HISTORY = 50;
const MAX_STORED_BOOKMARKS = 50;
const ROTATION_STEP = 90;
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_MIME = 'application/json';
const SNAPSHOT_COMPRESSED_MIME = 'application/gzip';

const memoryStore = new Map();
const settingsMemoryStore = new Map();
let databasePromise = null;

const hasIndexedDB = () => typeof indexedDB !== 'undefined';

function encodeBase64(buffer) {
  if (!(buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer)) {
    throw new TypeError('An ArrayBuffer is required for base64 encoding.');
  }

  if (typeof Buffer === 'function') {
    if (buffer instanceof ArrayBuffer) {
      return Buffer.from(buffer).toString('base64');
    }

    const view = buffer;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64');
  }

  const view = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const bytes = view;
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  throw new Error('Base64 encoding is not supported in this environment.');
}

function decodeBase64(base64) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new TypeError('A base64 encoded string is required.');
  }

  if (typeof Buffer === 'function') {
    return Buffer.from(base64, 'base64');
  }

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);

    for (let index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  throw new Error('Base64 decoding is not supported in this environment.');
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
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

async function getAllStoredRecords() {
  if (!hasIndexedDB()) {
    return Array.from(memoryStore.values()).map((record) => ({ ...record }));
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
      resolve(records.map((record) => ({ ...record })));
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to read stored workspace windows.'));
    };
  });
}

async function getAllPreferences() {
  if (!hasIndexedDB()) {
    return Array.from(settingsMemoryStore.entries()).map(([key, value]) => ({ key, value }));
  }

  const database = await getDatabase();

  if (!database) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = Array.isArray(request.result) ? request.result : [];
      resolve(records.map((record) => ({ ...record })));
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to read workspace preferences.'));
    };
  });
}

async function persistPreference(key, value) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('A preference key is required for persistence.');
  }

  if (!hasIndexedDB()) {
    if (value === undefined) {
      settingsMemoryStore.delete(key);
    } else {
      settingsMemoryStore.set(key, value);
    }
    return;
  }

  const database = await getDatabase();

  if (!database) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE_NAME);

    if (value === undefined) {
      const deleteRequest = store.delete(key);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => {
        reject(deleteRequest.error || new Error('Failed to remove workspace preference.'));
      };
      return;
    }

    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(request.error || new Error('Failed to persist workspace preference.'));
    };
  });
}

async function clearPreferences() {
  settingsMemoryStore.clear();

  if (!hasIndexedDB()) {
    return;
  }

  const database = await getDatabase();

  if (!database) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(request.error || new Error('Failed to clear workspace preferences.'));
    };
  });
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

function sanitizeSerializableValue(value, depth = 0) {
  if (depth > 8) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((entry) => sanitizeSerializableValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);

    return sanitizedArray;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value || {});
    const sanitizedObject = {};

    entries.forEach(([key, entry]) => {
      if (typeof key !== 'string' || key.length === 0) {
        return;
      }

      const sanitizedValue = sanitizeSerializableValue(entry, depth + 1);

      if (sanitizedValue !== undefined) {
        sanitizedObject[key] = sanitizedValue;
      }
    });

    return Object.keys(sanitizedObject).length > 0 ? sanitizedObject : undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  return undefined;
}

function sanitizeLayoutMetadata(layout) {
  if (!layout || typeof layout !== 'object') {
    return undefined;
  }

  const sanitized = sanitizeSerializableValue(layout);

  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return undefined;
  }

  return sanitized;
}

function normalizeForStorage(state) {
  const normalized = { id: state.id };

  const windowType =
    typeof state.windowType === 'string' && state.windowType.trim().length > 0
      ? state.windowType.trim()
      : 'pdf';

  normalized.windowType = windowType;

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

  if (Array.isArray(state.bookmarks) && state.bookmarks.length > 0) {
    const sanitized = state.bookmarks
      .map((value) => (Number.isFinite(value) ? Math.max(1, Math.floor(value)) : null))
      .filter((value) => Number.isFinite(value));

    if (sanitized.length > 0) {
      const deduped = [];

      sanitized
        .sort((a, b) => a - b)
        .forEach((value) => {
          if (!deduped.includes(value)) {
            deduped.push(value);
          }
        });

      if (deduped.length > MAX_STORED_BOOKMARKS) {
        normalized.bookmarks = deduped.slice(-MAX_STORED_BOOKMARKS);
      } else {
        normalized.bookmarks = deduped;
      }
    }
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

  const layoutMetadata = sanitizeLayoutMetadata(state.layout);

  if (layoutMetadata) {
    normalized.layout = layoutMetadata;
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

  const bookmarks = Array.isArray(record.bookmarks)
    ? record.bookmarks
        .map((value) => (Number.isFinite(value) ? Math.max(1, Math.floor(value)) : null))
        .filter((value, index, array) => Number.isFinite(value) && array.indexOf(value) === index)
        .sort((a, b) => a - b)
        .slice(-MAX_STORED_BOOKMARKS)
    : [];

  const layout = sanitizeLayoutMetadata(record.layout);

  const windowType =
    typeof record.windowType === 'string' && record.windowType.trim().length > 0
      ? record.windowType.trim()
      : 'pdf';

  return {
    id: record.id,
    file,
    windowType,
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
    bookmarks: bookmarks.length > 0 ? bookmarks : undefined,
    layout,
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

export async function loadWorkspacePreferences() {
  const entries = await getAllPreferences();
  const preferences = {};

  entries.forEach((entry) => {
    if (!entry || typeof entry.key !== 'string') {
      return;
    }

    preferences[entry.key] = entry.value;
  });

  return preferences;
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
  await clearPreferences();

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
  settingsMemoryStore.clear();
}

export async function persistWorkspacePreference(key, value) {
  await persistPreference(key, value);
}

export async function clearWorkspacePreferences() {
  await clearPreferences();
}

async function compressSnapshot(json, compression) {
  if (typeof json !== 'string' || json.length === 0) {
    return null;
  }

  if (compression !== 'gzip') {
    return null;
  }

  if (typeof CompressionStream !== 'function') {
    return null;
  }

  try {
    const encoder = new TextEncoder();
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    await writer.write(encoder.encode(json));
    await writer.close();
    const response = new Response(stream.readable);
    return await response.blob();
  } catch (error) {
    return null;
  }
}

async function decompressSnapshot(blob) {
  if (!(blob instanceof Blob)) {
    return null;
  }

  if (typeof DecompressionStream !== 'function') {
    throw new Error('この環境では圧縮されたスナップショットを展開できません。');
  }

  const sourceStream = typeof blob.stream === 'function'
    ? blob.stream()
    : new Response(blob).body;

  if (!sourceStream) {
    throw new Error('スナップショットのストリームを読み取れませんでした。');
  }

  const decompressor = new DecompressionStream('gzip');
  const decompressed = sourceStream.pipeThrough(decompressor);
  const response = new Response(decompressed);
  return response.text();
}

export async function exportWorkspaceSnapshot(options = {}) {
  const records = await getAllStoredRecords();

  const windowIds = Array.isArray(options.windowIds)
    ? options.windowIds
        .map((id) => (typeof id === 'string' && id.length > 0 ? id : null))
        .filter(Boolean)
    : null;
  const idSet = windowIds ? new Set(windowIds) : null;
  const compression = options.compression === 'gzip' ? 'gzip' : 'none';

  const serializedWindows = [];

  for (const record of records) {
    if (idSet && !idSet.has(record.id)) {
      continue;
    }

    if (!record || !record.id) {
      continue;
    }

    const file = createStoredFile(record);

    if (!file) {
      throw new Error('Cannot export session: stored PDF data is missing.');
    }

    let arrayBuffer;

    if (typeof file.arrayBuffer === 'function') {
      arrayBuffer = await file.arrayBuffer();
    } else if (typeof Response === 'function') {
      try {
        arrayBuffer = await new Response(file).arrayBuffer();
      } catch (error) {
        throw new Error('Cannot export session: stored PDF data is missing.');
      }
    } else {
      throw new Error('Cannot export session: stored PDF data is missing.');
    }
    const base64 = encodeBase64(arrayBuffer);

    const { data, ...rest } = record;

    serializedWindows.push({
      ...rest,
      data: {
        base64,
        name: record.name || 'document.pdf',
        type: record.type || 'application/pdf',
        lastModified: Number.isFinite(record.lastModified) ? record.lastModified : undefined,
      },
    });
  }

  const payload = {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    windows: serializedWindows,
  };

  const json = JSON.stringify(payload);
  let blob = null;
  let appliedCompression = 'none';

  if (compression === 'gzip') {
    const compressed = await compressSnapshot(json, compression);

    if (compressed instanceof Blob && compressed.size > 0) {
      const type = compressed.type && compressed.type.length > 0
        ? compressed.type
        : SNAPSHOT_COMPRESSED_MIME;
      blob = new Blob([compressed], { type });
      appliedCompression = 'gzip';
    }
  }

  if (!blob) {
    blob = new Blob([json], { type: SNAPSHOT_MIME });
  }

  return {
    blob,
    windows: serializedWindows.length,
    payload,
    compression: appliedCompression,
  };
}

export async function importWorkspaceSnapshot(file) {
  if (!file) {
    throw new TypeError('A snapshot file is required for import.');
  }

  const snapshotText = await readSnapshotText(file);

  let parsed;

  try {
    parsed = JSON.parse(snapshotText);
  } catch (error) {
    throw new Error('Provided snapshot is not valid JSON.');
  }

  if (!parsed || parsed.version !== SNAPSHOT_VERSION || !Array.isArray(parsed.windows)) {
    throw new Error('Provided snapshot is not compatible with this version of GMWorkbench.');
  }

  const restoredWindows = [];

  for (const entry of parsed.windows) {
    if (!entry || typeof entry !== 'object' || !entry.id) {
      continue;
    }

    const dataDescriptor = entry.data;

    if (!dataDescriptor || typeof dataDescriptor.base64 !== 'string') {
      throw new Error('Snapshot is missing PDF data for at least one window.');
    }

    let binary;

    try {
      binary = decodeBase64(dataDescriptor.base64);
    } catch (error) {
      throw new Error('Snapshot PDF data could not be decoded.');
    }

    const blob = new Blob([binary], {
      type: dataDescriptor.type || entry.type || 'application/pdf',
    });

    const normalizedRecord = normalizeForStorage({
      ...entry,
      data: blob,
      name: dataDescriptor.name || entry.name,
      type: dataDescriptor.type || entry.type,
      lastModified: Number.isFinite(dataDescriptor.lastModified)
        ? dataDescriptor.lastModified
        : entry.lastModified,
    });

    const restored = normalizeFromStorage(normalizedRecord);

    if (restored) {
      restoredWindows.push(restored);
    }
  }

  return {
    windows: restoredWindows,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
    version: parsed.version,
  };
}

async function readSnapshotText(blob) {
  if (!blob) {
    throw new TypeError('Snapshot file is not readable.');
  }

  if (blob instanceof Blob) {
    const type = typeof blob.type === 'string' ? blob.type.toLowerCase() : '';

    if (type === SNAPSHOT_COMPRESSED_MIME || blob.name?.toLowerCase?.().endsWith('.gz')) {
      const text = await decompressSnapshot(blob);

      if (typeof text === 'string') {
        return text;
      }
    }
  }

  if (typeof blob.text === 'function') {
    return blob.text();
  }

  if (typeof Response === 'function') {
    try {
      return await new Response(blob).text();
    } catch (error) {
      // fall through to other strategies
    }
  }

  if (typeof blob.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();

    if (typeof TextDecoder === 'function') {
      return new TextDecoder().decode(buffer);
    }

    const view = buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : ArrayBuffer.isView(buffer)
        ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : new Uint8Array(buffer);

    let text = '';
    for (let index = 0; index < view.length; index += 1) {
      text += String.fromCharCode(view[index]);
    }

    return text;
  }

  if (typeof Buffer === 'function' && typeof Buffer.isBuffer === 'function' && Buffer.isBuffer(blob)) {
    return blob.toString('utf-8');
  }

  throw new TypeError('Snapshot file cannot be read as text.');
}
