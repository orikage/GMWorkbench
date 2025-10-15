export const TITLE = 'GMWorkbench';
export const TAGLINE = 'PDFシナリオの仮想デスク';
export const DROP_ACTIVE_CLASS = 'workspace__drop-zone--active';
export const FILE_INPUT_ID = 'workspace-file-input';
export const QUEUE_OPEN_EVENT = 'workspace:file-open-request';
export const QUEUE_REMOVE_EVENT = 'workspace:file-queue-remove';
export const WINDOW_CLOSE_EVENT = 'workspace:window-close';
export const WINDOW_STACK_OFFSET = 24;
export const DEFAULT_WINDOW_WIDTH = 420;
export const DEFAULT_WINDOW_HEIGHT = 320;
export const MIN_WINDOW_WIDTH = 260;
export const MIN_WINDOW_HEIGHT = 220;
export const CANVAS_FALLBACK_WIDTH = 960;
export const CANVAS_FALLBACK_HEIGHT = 640;
export const WINDOW_PIN_TOGGLE_EVENT = 'workspace:window-pin-toggle';
export const WINDOW_PAGE_CHANGE_EVENT = 'workspace:window-page-change';
export const WINDOW_ZOOM_CHANGE_EVENT = 'workspace:window-zoom-change';
export const WINDOW_DUPLICATE_EVENT = 'workspace:window-duplicate';
export const WINDOW_NOTES_CHANGE_EVENT = 'workspace:window-notes-change';
export const WINDOW_TITLE_CHANGE_EVENT = 'workspace:window-title-change';
export const WINDOW_COLOR_CHANGE_EVENT = 'workspace:window-color-change';
export const WINDOW_ROTATION_CHANGE_EVENT = 'workspace:window-rotation-change';
export const WINDOW_MAXIMIZE_CHANGE_EVENT = 'workspace:window-maximize-change';
export const WINDOW_FOCUS_CYCLE_EVENT = 'workspace:window-focus-cycle';
export const WINDOW_BOOKMARKS_CHANGE_EVENT = 'workspace:window-bookmarks-change';
export const WINDOW_BOOKMARK_JUMP_EVENT = 'workspace:window-bookmark-jump';
export const WINDOW_SEARCH_EVENT = 'workspace:window-search';
export const WINDOW_OUTLINE_JUMP_EVENT = 'workspace:window-outline-jump';
export const DEFAULT_WINDOW_ZOOM = 1;
export const MIN_WINDOW_ZOOM = 0.5;
export const MAX_WINDOW_ZOOM = 2;
export const WINDOW_ZOOM_STEP = 0.1;
export const PAGE_HISTORY_LIMIT = 50;
export const WORKSPACE_CACHE_CLEARED_EVENT = 'workspace:cache-cleared';
export const WORKSPACE_SESSION_EXPORTED_EVENT = 'workspace:session-exported';
export const WORKSPACE_SESSION_IMPORTED_EVENT = 'workspace:session-imported';
export const WORKSPACE_QUICK_MEMO_REQUEST_EVENT = 'workspace:quick-memo-request';
export const WORKSPACE_MENU_CHANGE_EVENT = 'workspace:menu-change';
export const WORKSPACE_TRACK_CHANGE_EVENT = 'workspace:track-change';
export const WORKSPACE_VOLUME_CHANGE_EVENT = 'workspace:volume-change';
export const PREF_ONBOARDING_COMPLETED = 'onboardingCompleted';
export const DEFAULT_WINDOW_ROTATION = 0;
export const ROTATION_STEP = 90;
export const MAX_WINDOW_BOOKMARKS = 50;
export const WINDOW_COLORS = [
  { id: 'neutral', label: '標準' },
  { id: 'amber', label: '琥珀' },
  { id: 'emerald', label: '翡翠' },
  { id: 'rose', label: '紅玉' },
  { id: 'indigo', label: '藍' },
];
export const DEFAULT_WINDOW_COLOR = WINDOW_COLORS[0].id;
