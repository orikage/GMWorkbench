import { TAGLINE, TITLE, WORKSPACE_QUICK_MEMO_REQUEST_EVENT } from './constants.js';
import { createWorkspaceIcon } from './icons.js';

const UTILITY_BUTTONS = [
  { id: 'layers', label: 'レイヤー', icon: 'layers' },
  { id: 'reference', label: '資料ライブラリ', icon: 'book' },
  { id: 'settings', label: '設定', icon: 'settings' },
];

function createScenarioControl() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workspace__control workspace__control--surface workspace__scenario-button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-label', `${TITLE} を切り替える`);

  const label = document.createElement('span');
  label.className = 'workspace__scenario-label';
  label.textContent = '新しい場面';

  const name = document.createElement('span');
  name.className = 'workspace__scenario-name';
  name.textContent = 'Dicest';

  const caret = document.createElement('span');
  caret.className = 'workspace__scenario-caret';
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = '▾';

  button.append(label, name, caret);
  return button;
}

function createUtilityButton(config) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workspace__control workspace__utility-button';
  button.dataset.utilityId = config.id;
  button.setAttribute('aria-label', config.label);
  button.title = config.label;

  const icon = createWorkspaceIcon(config.icon);
  const srLabel = document.createElement('span');
  srLabel.className = 'workspace__sr-only';
  srLabel.textContent = config.label;

  button.append(icon, srLabel);
  return button;
}

export function createHeader() {
  const header = document.createElement('header');
  header.className = 'workspace__app-bar';

  const left = document.createElement('div');
  left.className = 'workspace__app-bar-left';
  left.append(createScenarioControl());

  const center = document.createElement('div');
  center.className = 'workspace__app-bar-center';

  const status = document.createElement('span');
  status.className = 'workspace__status-label';
  status.textContent = 'アクティブウィンドウ: なし';

  const hint = document.createElement('span');
  hint.className = 'workspace__status-hint';
  hint.textContent = TAGLINE;

  center.append(status, hint);

  const right = document.createElement('div');
  right.className = 'workspace__app-bar-right';
  UTILITY_BUTTONS.forEach((entry) => {
    right.append(createUtilityButton(entry));
  });

  header.append(left, center, right);
  return header;
}

export function createHint() {
  const section = document.createElement('section');
  section.className = 'workspace__quick-panel';

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'workspace__control workspace__control--accent workspace__quick-button';
  action.setAttribute('aria-label', 'クイックメモを開く');

  const icon = createWorkspaceIcon('quick-memo', { className: 'workspace__quick-icon' });
  const label = document.createElement('span');
  label.className = 'workspace__sr-only';
  label.textContent = 'クイックメモを開く';

  action.append(icon, label);

  action.addEventListener('click', () => {
    section.dispatchEvent(
      new CustomEvent(WORKSPACE_QUICK_MEMO_REQUEST_EVENT, {
        bubbles: true,
      }),
    );
  });

  const hint = document.createElement('p');
  hint.className = 'workspace__hint';
  hint.textContent = 'ひらめきを逃さずにメモできます。';

  section.append(action, hint);
  return section;
}
