import { WORKSPACE_MENU_CHANGE_EVENT } from './constants.js';
import { createWorkspaceIcon } from './icons.js';

const DEFAULT_MENU_ITEMS = [
  { id: 'browser', label: 'PDFブラウザ', icon: 'document' },
  { id: 'npc', label: 'NPCノート', icon: 'profile' },
  { id: 'map', label: 'マップビュー', icon: 'map' },
  { id: 'log', label: 'ログ', icon: 'log' },
];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const sanitizeCollection = (entries, fallback) => {
  if (!Array.isArray(entries)) {
    return fallback;
  }

  const sanitized = entries.filter(
    (entry) => entry && isNonEmptyString(entry.id) && isNonEmptyString(entry.label),
  );

  return sanitized.length > 0 ? sanitized : fallback;
};

const emitMenuEvent = (target, type, detail) => {
  target.dispatchEvent(
    new CustomEvent(type, {
      bubbles: true,
      detail,
    }),
  );
};

function createMenuButton(item, onActivate) {
  const li = document.createElement('li');
  li.className = 'workspace__menu-item';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workspace__control workspace__menu-button';
  button.dataset.menuId = item.id;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', item.label);

  const icon = createWorkspaceIcon(item.icon, { className: 'workspace__menu-icon' });
  const label = document.createElement('span');
  label.className = 'workspace__sr-only';
  label.textContent = item.label;

  button.append(icon, label);
  button.addEventListener('click', () => {
    onActivate(item.id);
  });

  li.append(button);
  return { element: li, button };
}

export function createWorkspaceMenu({
  initialActiveId,
  menuItems: providedMenuItems,
  onMenuChange,
} = {}) {
  const navigation = document.createElement('nav');
  navigation.className = 'workspace__menu';
  navigation.dataset.role = 'workspace-menu';
  navigation.setAttribute('aria-label', 'ワークスペース機能メニュー');

  const menuItems = sanitizeCollection(providedMenuItems, DEFAULT_MENU_ITEMS);

  const list = document.createElement('ul');
  list.className = 'workspace__menu-list';

  const buttons = new Map();
  let activeId = null;

  const notifyMenuChange = (id) => {
    if (typeof onMenuChange === 'function') {
      onMenuChange(id);
    }

    emitMenuEvent(navigation, WORKSPACE_MENU_CHANGE_EVENT, { id });
  };

  const updateButtonState = (id) => {
    buttons.forEach((button, buttonId) => {
      const isActive = buttonId === id;
      button.classList.toggle('workspace__menu-button--active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const setActive = (id, { silent = false } = {}) => {
    if (!buttons.has(id)) {
      return;
    }

    if (activeId === id) {
      updateButtonState(id);
      return;
    }

    activeId = id;
    updateButtonState(id);

    if (!silent) {
      notifyMenuChange(id);
    }
  };

  menuItems.forEach((item) => {
    const { element, button } = createMenuButton(item, (id) => setActive(id));
    list.append(element);
    buttons.set(item.id, button);
  });

  navigation.append(list);

  const defaultActive = buttons.has(initialActiveId)
    ? initialActiveId
    : menuItems[0]?.id ?? null;

  if (defaultActive) {
    setActive(defaultActive, { silent: true });
  }

  return {
    element: navigation,
    setActive,
    getActiveId: () => activeId,
  };
}
