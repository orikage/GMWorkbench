import { createWorkspaceIcon } from './icons.js';

const MENU_ITEMS = [
  { id: 'browser', label: 'PDFブラウザ', icon: 'document' },
  { id: 'npc', label: 'NPCノート', icon: 'profile' },
  { id: 'map', label: 'マップビュー', icon: 'map' },
  { id: 'log', label: 'ログ', icon: 'log' },
  { id: 'sound', label: 'サウンド', icon: 'sound' },
];

const TRACKS = [
  { id: 'bgm01', label: 'BGM01' },
  { id: 'bgm02', label: 'BGM02' },
];

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

function createTrackButton(track, onActivate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workspace__control workspace__menu-track';
  button.dataset.trackId = track.id;
  button.textContent = track.label;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    onActivate(track.id);
  });
  return button;
}

export function createWorkspaceMenu({ initialActiveId } = {}) {
  const navigation = document.createElement('nav');
  navigation.className = 'workspace__menu';
  navigation.setAttribute('aria-label', 'ワークスペース機能メニュー');

  const list = document.createElement('ul');
  list.className = 'workspace__menu-list';

  const buttons = [];
  let activeId = typeof initialActiveId === 'string' ? initialActiveId : MENU_ITEMS[0]?.id ?? null;

  const setActive = (id) => {
    if (typeof id !== 'string' || id.length === 0) {
      return;
    }

    activeId = id;
    buttons.forEach((entry) => {
      const isActive = entry.dataset.menuId === id;
      entry.classList.toggle('workspace__menu-button--active', isActive);
      entry.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  MENU_ITEMS.forEach((item) => {
    const { element, button } = createMenuButton(item, setActive);
    list.append(element);
    buttons.push(button);
  });

  const sliderGroup = document.createElement('div');
  sliderGroup.className = 'workspace__menu-slider';

  const sliderLabel = document.createElement('span');
  sliderLabel.className = 'workspace__sr-only';
  sliderLabel.id = 'workspace-menu-slider-label';
  sliderLabel.textContent = 'BGM音量';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'workspace__menu-range';
  slider.min = '0';
  slider.max = '100';
  slider.value = '68';
  slider.setAttribute('aria-labelledby', sliderLabel.id);
  slider.setAttribute('orient', 'vertical');

  sliderGroup.append(sliderLabel, slider);

  const playback = document.createElement('div');
  playback.className = 'workspace__menu-playback';

  const trackButtons = [];
  const setTrackActive = (trackId) => {
    trackButtons.forEach((trackButton) => {
      const isActive = trackButton.dataset.trackId === trackId;
      trackButton.classList.toggle('workspace__menu-track--active', isActive);
      trackButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  TRACKS.forEach((track) => {
    const button = createTrackButton(track, setTrackActive);
    playback.append(button);
    trackButtons.push(button);
  });

  navigation.append(list, sliderGroup, playback);
  setActive(activeId);
  setTrackActive(TRACKS[0]?.id ?? null);

  return {
    element: navigation,
    setActive,
    getActiveId: () => activeId,
  };
}
