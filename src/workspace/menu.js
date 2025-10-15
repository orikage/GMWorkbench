import {
  WORKSPACE_MENU_CHANGE_EVENT,
  WORKSPACE_TRACK_CHANGE_EVENT,
  WORKSPACE_VOLUME_CHANGE_EVENT,
} from './constants.js';
import { createWorkspaceIcon } from './icons.js';
import { copyAccessibleLabelToTitle } from './utils.js';

const DEFAULT_MENU_ITEMS = [
  { id: 'browser', label: 'PDFブラウザ', icon: 'document' },
  { id: 'npc', label: 'NPCノート', icon: 'profile' },
  { id: 'map', label: 'マップビュー', icon: 'map' },
  { id: 'log', label: 'ログ', icon: 'log' },
  { id: 'sound', label: 'サウンド', icon: 'sound' },
];

const DEFAULT_TRACKS = [
  { id: 'bgm01', label: 'BGM01' },
  { id: 'bgm02', label: 'BGM02' },
];

const DEFAULT_VOLUME = 68;
const DEFAULT_VOLUME_LABEL = 'BGM音量';

const SLIDER_LABEL_ID = 'workspace-menu-slider-label';

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

const clampVolume = (value, fallback = DEFAULT_VOLUME) => {
  const numeric = Number.parseFloat(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(numeric)));
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
  copyAccessibleLabelToTitle(button, item.label);

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

function createTrackButton(track, onActivate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workspace__control workspace__menu-track';
  button.dataset.trackId = track.id;
  button.textContent = track.label;
  button.setAttribute('aria-pressed', 'false');
  copyAccessibleLabelToTitle(button, track.label);
  button.addEventListener('click', () => {
    onActivate(track.id);
  });

  return button;
}

export function createWorkspaceMenu({
  initialActiveId,
  initialTrackId,
  menuItems: providedMenuItems,
  tracks: providedTracks,
  volume = DEFAULT_VOLUME,
  onMenuChange,
  onTrackChange,
  onVolumeInput,
  volumeLabel = DEFAULT_VOLUME_LABEL,
} = {}) {
  const navigation = document.createElement('nav');
  navigation.className = 'workspace__menu';
  navigation.dataset.role = 'workspace-menu';
  navigation.setAttribute('aria-label', 'ワークスペース機能メニュー');

  const menuItems = sanitizeCollection(providedMenuItems, DEFAULT_MENU_ITEMS);
  const tracks = sanitizeCollection(providedTracks, DEFAULT_TRACKS);

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

  const sliderGroup = document.createElement('div');
  sliderGroup.className = 'workspace__menu-slider';

  const sliderLabel = document.createElement('span');
  sliderLabel.className = 'workspace__sr-only';
  sliderLabel.id = SLIDER_LABEL_ID;
  sliderLabel.textContent = volumeLabel;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'workspace__menu-range';
  slider.min = '0';
  slider.max = '100';
  slider.setAttribute('aria-labelledby', sliderLabel.id);
  slider.setAttribute('orient', 'vertical');
  copyAccessibleLabelToTitle(slider, volumeLabel);

  let volumeValue = clampVolume(volume);
  slider.value = String(volumeValue);

  const notifyVolumeChange = (value) => {
    if (typeof onVolumeInput === 'function') {
      onVolumeInput(value);
    }

    emitMenuEvent(navigation, WORKSPACE_VOLUME_CHANGE_EVENT, { value });
  };

  const setVolume = (value, { silent = false } = {}) => {
    const nextValue = clampVolume(value, volumeValue);

    if (nextValue === volumeValue) {
      slider.value = String(nextValue);
      return nextValue;
    }

    volumeValue = nextValue;
    slider.value = String(nextValue);

    if (!silent) {
      notifyVolumeChange(nextValue);
    }

    return nextValue;
  };

  const handleSliderInput = () => {
    const nextValue = clampVolume(slider.value, volumeValue);

    if (nextValue === volumeValue) {
      slider.value = String(nextValue);
      return;
    }

    volumeValue = nextValue;
    slider.value = String(nextValue);
    notifyVolumeChange(nextValue);
  };

  slider.addEventListener('input', handleSliderInput);
  slider.addEventListener('change', handleSliderInput);

  sliderGroup.append(sliderLabel, slider);

  const playback = document.createElement('div');
  playback.className = 'workspace__menu-playback';

  const trackButtons = new Map();
  let activeTrackId = null;

  const notifyTrackChange = (id) => {
    if (typeof onTrackChange === 'function') {
      onTrackChange(id);
    }

    emitMenuEvent(navigation, WORKSPACE_TRACK_CHANGE_EVENT, { id });
  };

  const updateTrackState = (id) => {
    trackButtons.forEach((button, trackId) => {
      const isActive = trackId === id;
      button.classList.toggle('workspace__menu-track--active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const setTrackActive = (id, { silent = false } = {}) => {
    if (!trackButtons.has(id)) {
      return;
    }

    if (activeTrackId === id) {
      updateTrackState(id);
      return;
    }

    activeTrackId = id;
    updateTrackState(id);

    if (!silent) {
      notifyTrackChange(id);
    }
  };

  tracks.forEach((track) => {
    const button = createTrackButton(track, (id) => setTrackActive(id));
    playback.append(button);
    trackButtons.set(track.id, button);
  });

  navigation.append(list, sliderGroup, playback);

  const defaultActive = buttons.has(initialActiveId)
    ? initialActiveId
    : menuItems[0]?.id ?? null;

  if (defaultActive) {
    setActive(defaultActive, { silent: true });
  }

  const defaultTrack = trackButtons.has(initialTrackId)
    ? initialTrackId
    : tracks[0]?.id ?? null;

  if (defaultTrack) {
    setTrackActive(defaultTrack, { silent: true });
  }

  return {
    element: navigation,
    setActive,
    getActiveId: () => activeId,
    setTrackActive,
    getActiveTrackId: () => activeTrackId,
    setVolume,
    getVolume: () => volumeValue,
  };
}
