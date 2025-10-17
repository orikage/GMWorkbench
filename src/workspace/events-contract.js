import {
  QUEUE_OPEN_EVENT,
  QUEUE_REMOVE_EVENT,
  WINDOW_BOOKMARKS_CHANGE_EVENT,
  WINDOW_BOOKMARK_JUMP_EVENT,
  WINDOW_CLOSE_EVENT,
  WINDOW_COLOR_CHANGE_EVENT,
  WINDOW_DUPLICATE_EVENT,
  WINDOW_FOCUS_CYCLE_EVENT,
  WINDOW_MAXIMIZE_CHANGE_EVENT,
  WINDOW_NOTES_CHANGE_EVENT,
  WINDOW_PAGE_CHANGE_EVENT,
  WINDOW_PIN_TOGGLE_EVENT,
  WINDOW_ROTATION_CHANGE_EVENT,
  WINDOW_SEARCH_EVENT,
  WINDOW_TITLE_CHANGE_EVENT,
  WINDOW_ZOOM_CHANGE_EVENT,
  WORKSPACE_CACHE_CLEARED_EVENT,
  WORKSPACE_SESSION_EXPORTED_EVENT,
  WORKSPACE_SESSION_IMPORTED_EVENT,
  WORKSPACE_QUICK_MEMO_REQUEST_EVENT,
  WORKSPACE_MENU_CHANGE_EVENT,
  WORKSPACE_TRACK_CHANGE_EVENT,
  WORKSPACE_VOLUME_CHANGE_EVENT,
  WINDOW_OUTLINE_JUMP_EVENT,
} from './constants.js';

/**
 * 深い階層まで凍結してイベント契約が不変であることを保証する。
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  Object.values(value).forEach((entry) => {
    if (entry && typeof entry === 'object') {
      deepFreeze(entry);
    }
  });

  return Object.freeze(value);
}

/** @type {const} */
export const WORKSPACE_EVENT_FIELD_TYPES = [
  'File',
  'File[]',
  'boolean',
  'number',
  'number|null',
  'number|undefined',
  'number[]',
  'string',
  'string|undefined',
  'direction',
  'bookmarkAction',
  'bookmarkSource',
  'searchAction',
  'zoomMode',
];

deepFreeze(WORKSPACE_EVENT_FIELD_TYPES);

/** @type {const} */
const CONTRACT = {
  'workspace:file-selected': {
    target: 'workspace',
    bubbles: true,
    description:
      'Emitted when the user selects PDF files via drag & drop or the file picker.',
    detail: {
      files: {
        type: 'File[]',
        description: 'Selected PDF files queued for import.',
      },
    },
  },
  [WORKSPACE_QUICK_MEMO_REQUEST_EVENT]: {
    target: 'workspace',
    bubbles: true,
    description: 'Raised when the quick memo shortcut is requested from the shell.',
    detail: {},
  },
  [WORKSPACE_MENU_CHANGE_EVENT]: {
    target: 'workspace-menu',
    bubbles: true,
    description: 'Raised when the user activates a feature button in the workspace menu.',
    detail: {
      id: {
        type: 'string',
        description: 'Identifier of the newly activated workspace menu item.',
      },
    },
  },
  [WORKSPACE_TRACK_CHANGE_EVENT]: {
    target: 'workspace-menu',
    bubbles: true,
    description: 'Raised when the user selects an audio preset in the workspace menu.',
    detail: {
      id: {
        type: 'string',
        description: 'Identifier of the activated audio track preset.',
      },
    },
  },
  [WORKSPACE_VOLUME_CHANGE_EVENT]: {
    target: 'workspace-menu',
    bubbles: true,
    description: 'Raised when the workspace menu volume slider is adjusted.',
    detail: {
      value: {
        type: 'number',
        description: 'Clamped master volume level between 0 and 100.',
      },
    },
  },
  [QUEUE_OPEN_EVENT]: {
    target: 'workspace',
    bubbles: true,
    description: 'Raised when a queued file is requested for opening.',
    detail: {
      file: {
        type: 'File',
        description: 'The queued PDF file that should become a window.',
      },
    },
  },
  [QUEUE_REMOVE_EVENT]: {
    target: 'workspace',
    bubbles: true,
    description: 'Raised when a file should be removed from the queue.',
    detail: {
      file: {
        type: 'File',
        description: 'The queued PDF file that should be forgotten.',
      },
    },
  },
  [WINDOW_CLOSE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Dispatched before a workspace window is disposed.',
    detail: {
      file: {
        type: 'File',
        description: 'The PDF that was associated with the closing window.',
      },
    },
  },
  [WINDOW_PIN_TOGGLE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Indicates that a window was pinned or unpinned.',
    detail: {
      file: {
        type: 'File',
        description: 'The PDF associated with the toggled window.',
      },
      pinned: {
        type: 'boolean',
        description: 'Whether the window is now pinned in the foreground.',
      },
    },
  },
  [WINDOW_MAXIMIZE_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Broadcasts that the maximize state or bounds changed.',
    detail: {
      file: {
        type: 'File',
        description: 'The PDF associated with the window.',
      },
      maximized: {
        type: 'boolean',
        description: 'True when the window is currently maximized.',
      },
      width: { type: 'number', description: 'Current width in pixels.' },
      height: { type: 'number', description: 'Current height in pixels.' },
    },
  },
  [WINDOW_PAGE_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Notifies listeners that the visible page changed.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      page: { type: 'number', description: 'The current 1-indexed page number.' },
      totalPages: {
        type: 'number|null',
        description: 'Total number of pages when known, otherwise null.',
      },
      historyIndex: {
        type: 'number',
        description: 'Index of the current entry in the page history stack.',
      },
      historyLength: {
        type: 'number',
        description: 'Total number of entries in the page history stack.',
      },
      rotation: {
        type: 'number',
        description: 'Current clockwise rotation in degrees.',
      },
      zoom: {
        type: 'number',
        description: 'Current zoom factor applied to the page.',
      },
    },
  },
  [WINDOW_ZOOM_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Indicates that the zoom factor changed.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      zoom: { type: 'number', description: 'The new zoom factor.' },
      page: { type: 'number', description: 'The page that remains in view.' },
      rotation: {
        type: 'number',
        description: 'Rotation in degrees when the zoom changed.',
      },
      mode: {
        type: 'zoomMode',
        description: 'Zoom mode such as manual, fit-width or fit-page.',
      },
    },
  },
  [WINDOW_ROTATION_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Indicates that the rotation angle changed.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      rotation: { type: 'number', description: 'New clockwise rotation in degrees.' },
      page: { type: 'number', description: 'Current page when the rotation changed.' },
      zoom: { type: 'number', description: 'Current zoom factor.' },
    },
  },
  [WINDOW_DUPLICATE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Emitted when a window is duplicated into a new instance.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the source window.' },
      page: { type: 'number', description: 'Current page copied to the new window.' },
      zoom: { type: 'number', description: 'Current zoom factor replicated to the new window.' },
      rotation: {
        type: 'number',
        description: 'Current rotation copied to the new window.',
      },
      totalPages: {
        type: 'number|null',
        description: 'Total page count when known, otherwise null.',
      },
      sourceId: {
        type: 'string',
        description: 'Identifier of the window that initiated the duplication.',
      },
      duplicateId: {
        type: 'string|undefined',
        description: 'Identifier of the new window, when available.',
      },
      notes: {
        type: 'string',
        description: 'Notes content copied into the duplicate window.',
      },
      title: {
        type: 'string',
        description: 'Window title copied into the duplicate window.',
      },
      color: {
        type: 'string',
        description: 'Color identifier applied to both windows.',
      },
      maximized: {
        type: 'boolean',
        description: 'Whether the source window was maximized.',
      },
      bookmarks: {
        type: 'number[]',
        description: 'List of bookmarked pages copied to the duplicate.',
      },
    },
  },
  [WINDOW_NOTES_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Indicates that the free-form notes were updated.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      notes: { type: 'string', description: 'Latest notes content.' },
    },
  },
  [WINDOW_TITLE_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Indicates that the window title was changed by the user.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      title: { type: 'string', description: 'Updated window title.' },
    },
  },
  [WINDOW_COLOR_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Indicates that the window color accent changed.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      color: { type: 'string', description: 'Identifier of the active color accent.' },
    },
  },
  [WINDOW_BOOKMARKS_CHANGE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Signals that the set of bookmarks changed.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      bookmarks: {
        type: 'number[]',
        description: 'Sorted list of bookmarked pages.',
      },
      action: {
        type: 'bookmarkAction',
        description: 'Indicates whether a bookmark was added or removed.',
      },
      page: {
        type: 'number',
        description: 'Bookmark page affected by the action.',
      },
    },
  },
  [WINDOW_BOOKMARK_JUMP_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Raised after navigating to a bookmarked page.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      page: { type: 'number', description: 'Destination bookmark page.' },
      bookmarks: {
        type: 'number[]',
        description: 'Current list of bookmarks to aid sync.',
      },
      source: {
        type: 'bookmarkSource',
        description: 'UI mechanism that triggered the jump.',
      },
      next: {
        type: 'number|null',
        description: 'Next bookmark in sequence, if available.',
      },
      previous: {
        type: 'number|null',
        description: 'Previous bookmark in sequence, if available.',
      },
    },
  },
  [WINDOW_SEARCH_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Reports actions within the in-window text search UI.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      query: { type: 'string', description: 'Normalized query string.' },
      action: {
        type: 'searchAction',
        description: 'Search lifecycle action such as search, next or previous.',
      },
      totalResults: {
        type: 'number',
        description: 'Total number of hits available for the current query.',
      },
      index: {
        type: 'number|null',
        description: 'Index of the active search result, or null when none.',
      },
      page: {
        type: 'number|undefined',
        description: 'Page containing the active search result, if known.',
      },
    },
  },
  [WINDOW_OUTLINE_JUMP_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Raised when navigating via the document outline.',
    detail: {
      file: { type: 'File', description: 'The PDF associated with the window.' },
      page: {
        type: 'number|undefined',
        description: 'Destination page of the outline entry, when provided.',
      },
      title: {
        type: 'string|undefined',
        description: 'Title of the outline entry that was activated.',
      },
      index: {
        type: 'number',
        description: 'Zero-based index of the outline entry.',
      },
      level: {
        type: 'number|undefined',
        description: 'Depth level of the outline entry when available.',
      },
    },
  },
  [WINDOW_FOCUS_CYCLE_EVENT]: {
    target: 'workspace-window',
    bubbles: true,
    description: 'Fired when focus cycles between workspace windows.',
    detail: {
      direction: {
        type: 'direction',
        description: 'Direction of the focus change, either next or previous.',
      },
      windowId: {
        type: 'string',
        description: 'Identifier of the window that received focus.',
      },
      title: {
        type: 'string|undefined',
        description: 'Window title when known.',
      },
      totalWindows: {
        type: 'number',
        description: 'Number of windows participating in the cycle.',
      },
    },
  },
  [WORKSPACE_CACHE_CLEARED_EVENT]: {
    target: 'workspace',
    bubbles: true,
    description: 'Emitted after clearing all persisted workspace data.',
    detail: {
      windowsCleared: {
        type: 'number',
        description: 'Number of windows removed from persistence.',
      },
    },
  },
  [WORKSPACE_SESSION_EXPORTED_EVENT]: {
    target: 'workspace',
    bubbles: true,
    description: 'Emitted after exporting a workspace snapshot.',
    detail: {
      windows: {
        type: 'number',
        description: 'Number of windows included in the export.',
      },
      fileName: {
        type: 'string',
        description: 'File name suggested for the exported snapshot.',
      },
    },
  },
  [WORKSPACE_SESSION_IMPORTED_EVENT]: {
    target: 'workspace',
    bubbles: true,
    description: 'Emitted after importing a workspace snapshot.',
    detail: {
      windows: {
        type: 'number',
        description: 'Number of windows that were restored.',
      },
      previous: {
        type: 'number',
        description: 'Number of windows that existed prior to import.',
      },
      exportedAt: {
        type: 'string|undefined',
        description: 'Timestamp recorded within the imported snapshot.',
      },
    },
  },
};

export const WORKSPACE_EVENT_CONTRACT = deepFreeze(CONTRACT);
