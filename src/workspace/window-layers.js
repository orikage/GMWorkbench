const DEFAULT_LAYER_TITLE = '名称未設定のウィンドウ';

let timestampFormatter;

try {
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    timestampFormatter = new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
} catch (error) {
  timestampFormatter = null;
}

const formatTimestamp = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }

  if (timestampFormatter) {
    try {
      return timestampFormatter.format(new Date(value));
    } catch (error) {
      // fall through to the generic formatter below
    }
  }

  try {
    return new Date(value).toLocaleString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return '';
  }
};

export function createWindowLayers({ canvas }) {
  if (!canvas || typeof canvas.getWindowEntries !== 'function') {
    throw new TypeError('A canvas with getWindowEntries is required.');
  }

  const overlay = document.createElement('section');
  overlay.className = 'workspace__layers';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'ウィンドウレイヤー');

  const heading = document.createElement('h2');
  heading.className = 'workspace__layers-heading';
  heading.textContent = 'レイヤー';

  const list = document.createElement('ul');
  list.className = 'workspace__layers-list';
  list.setAttribute('role', 'list');

  const emptyState = document.createElement('p');
  emptyState.className = 'workspace__layers-empty';
  emptyState.textContent = '開いているウィンドウはありません。';

  overlay.append(heading, list, emptyState);

  const renderEntry = (entry) => {
    const item = document.createElement('li');
    item.className = 'workspace__layers-item';
    item.dataset.windowId = entry?.id ?? '';

    const isPinned = Boolean(entry?.element?.classList.contains('workspace__window--pinned'));
    const isActive = Boolean(entry?.element?.classList.contains('workspace__window--active'));

    if (isPinned) {
      item.dataset.layerPinned = 'true';
    }

    if (isActive) {
      item.dataset.layerActive = 'true';
    }

    const name = document.createElement('span');
    name.className = 'workspace__layers-name';
    const title = typeof entry?.title === 'string' && entry.title.trim().length > 0
      ? entry.title.trim()
      : entry?.element?.dataset?.windowTitle;
    name.textContent = title && title.length > 0 ? title : DEFAULT_LAYER_TITLE;

    const meta = document.createElement('span');
    meta.className = 'workspace__layers-meta';
    const metadata = [];

    if (isPinned) {
      metadata.push('ピン留め中');
    }

    const timestamp = Number.isFinite(entry?.lastFocusedAt)
      ? entry.lastFocusedAt
      : Number.isFinite(entry?.openedAt)
        ? entry.openedAt
        : null;
    const formattedTimestamp = formatTimestamp(timestamp);

    if (formattedTimestamp) {
      metadata.push(`${formattedTimestamp} 更新`);
    }

    meta.textContent = metadata.join(' · ');

    const actions = document.createElement('div');
    actions.className = 'workspace__layers-actions';

    const focusButton = document.createElement('button');
    focusButton.type = 'button';
    focusButton.className = 'workspace__control workspace__layers-focus';
    focusButton.textContent = '表示';
    focusButton.setAttribute(
      'aria-label',
      `${name.textContent} をアクティブにする`,
    );

    focusButton.addEventListener('click', () => {
      if (typeof canvas.focusWindow === 'function' && entry?.id) {
        canvas.focusWindow(entry.id);
      }
    });

    actions.append(focusButton);

    item.append(name, meta, actions);

    return item;
  };

  const update = () => {
    const entries = canvas.getWindowEntries?.();
    const normalizedEntries = Array.isArray(entries) ? entries : [];

    list.replaceChildren();

    if (normalizedEntries.length === 0) {
      emptyState.hidden = false;
      overlay.dataset.layerCount = '0';
      return;
    }

    emptyState.hidden = true;
    overlay.dataset.layerCount = String(normalizedEntries.length);

    normalizedEntries.forEach((entry) => {
      const item = renderEntry(entry);
      list.append(item);
    });
  };

  return { element: overlay, update };
}
