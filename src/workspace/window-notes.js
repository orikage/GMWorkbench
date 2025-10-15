import { WINDOW_NOTES_CHANGE_EVENT } from './constants.js';
import { copyAccessibleLabelToTitle } from './utils.js';

export function createWindowNotes({
  file,
  windowElement,
  initialContent = '',
  bringToFront,
  onPersistRequest,
}) {
  let notesContent = typeof initialContent === 'string' ? initialContent : '';

  const notesSection = document.createElement('section');
  notesSection.className = 'workspace__window-notes';

  const notesHeader = document.createElement('div');
  notesHeader.className = 'workspace__window-notes-header';

  const notesInputId = `workspace-window-notes-${Math.random().toString(36).slice(2, 9)}`;

  const notesLabel = document.createElement('label');
  notesLabel.className = 'workspace__window-notes-label';
  notesLabel.setAttribute('for', notesInputId);
  notesLabel.textContent = 'メモ';

  const notesCounter = document.createElement('span');
  notesCounter.className = 'workspace__window-notes-counter';

  const notesTextarea = document.createElement('textarea');
  notesTextarea.className = 'workspace__window-notes-input';
  notesTextarea.id = notesInputId;
  notesTextarea.rows = 4;
  notesTextarea.placeholder = 'シーンの補足やアドリブ案をメモできます。';
  notesTextarea.value = notesContent;
  copyAccessibleLabelToTitle(notesTextarea, notesLabel.textContent);

  notesTextarea.addEventListener('focus', () => {
    if (typeof bringToFront === 'function') {
      bringToFront();
    }
  });

  notesTextarea.addEventListener('input', () => {
    const nextContent = notesTextarea?.value ?? '';

    if (nextContent === notesContent) {
      return;
    }

    notesContent = nextContent;
    sync();

    const notesEvent = new CustomEvent(WINDOW_NOTES_CHANGE_EVENT, {
      bubbles: true,
      detail: { file, notes: notesContent },
    });

    windowElement.dispatchEvent(notesEvent);

    if (typeof onPersistRequest === 'function') {
      onPersistRequest();
    }
  });

  notesHeader.append(notesLabel, notesCounter);
  notesSection.append(notesHeader, notesTextarea);

  function sync() {
    windowElement.dataset.notesLength = String(notesContent.length);

    if (notesTextarea.value !== notesContent) {
      notesTextarea.value = notesContent;
    }

    notesCounter.textContent = `${notesContent.length}文字`;
  }

  function updateTitle(windowTitle) {
    if (typeof windowTitle === 'string' && windowTitle.length > 0) {
      const label = `${windowTitle} のメモ`;
      notesTextarea.setAttribute('aria-label', label);
      copyAccessibleLabelToTitle(notesTextarea, label);
    } else {
      notesTextarea.removeAttribute('aria-label');
      copyAccessibleLabelToTitle(notesTextarea, '');
    }
  }

  sync();

  return {
    element: notesSection,
    getContent: () => notesContent,
    setContent(nextContent = '') {
      notesContent = typeof nextContent === 'string' ? nextContent : '';
      sync();
    },
    sync,
    updateTitle,
  };
}
