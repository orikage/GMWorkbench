import { createWindowNotes } from './window-notes.js';

const DEFAULT_MEMO_TITLE = 'メモ';

export function createMemoWindow({
  title = DEFAULT_MEMO_TITLE,
  initialContent = '',
  placeholder,
  onCloseRequest,
  onContentChange,
  onTitleChange,
} = {}) {
  let memoTitle =
    typeof title === 'string' && title.trim().length > 0 ? title.trim() : DEFAULT_MEMO_TITLE;
  let focusDelegate = () => {};

  const element = document.createElement('article');
  element.className = 'workspace__window workspace__window--memo';

  const header = document.createElement('header');
  header.className = 'workspace__window-header';

  const titleElement = document.createElement('h3');
  titleElement.className = 'workspace__window-title';
  titleElement.textContent = memoTitle;

  const controls = document.createElement('div');
  controls.className = 'workspace__window-controls';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'workspace__window-close';
  closeButton.setAttribute('aria-label', `${memoTitle} を閉じる`);

  closeButton.addEventListener('click', () => {
    if (typeof onCloseRequest === 'function') {
      onCloseRequest();
    }
  });

  controls.append(closeButton);
  header.append(titleElement, controls);

  const body = document.createElement('div');
  body.className = 'workspace__window-body';

  const notesController = createWindowNotes({
    file: null,
    windowElement: element,
    initialContent,
    bringToFront: () => {
      focusDelegate();
    },
    onPersistRequest: () => {
      if (typeof onContentChange === 'function') {
        onContentChange(notesController.getContent());
      }
    },
  });

  if (typeof placeholder === 'string' && placeholder.length > 0) {
    const textarea = notesController.element.querySelector('textarea');

    if (textarea instanceof HTMLTextAreaElement) {
      textarea.placeholder = placeholder;
    }
  }

  notesController.updateTitle(memoTitle);

  body.append(notesController.element);
  element.append(header, body);

  return {
    element,
    header,
    closeButton,
    focusEditor() {
      if (typeof notesController.focusInput === 'function') {
        notesController.focusInput();
      }
    },
    getContent: () => notesController.getContent(),
    setContent(value) {
      notesController.setContent(value);
    },
    getTitle: () => memoTitle,
    setTitle(nextTitle) {
      const normalized =
        typeof nextTitle === 'string' && nextTitle.trim().length > 0
          ? nextTitle.trim()
          : DEFAULT_MEMO_TITLE;
      memoTitle = normalized;
      titleElement.textContent = normalized;
      closeButton.setAttribute('aria-label', `${normalized} を閉じる`);
      notesController.updateTitle(normalized);

      if (typeof onTitleChange === 'function') {
        onTitleChange(normalized);
      }
    },
    setFocusDelegate(callback) {
      if (typeof callback === 'function') {
        focusDelegate = callback;
      } else {
        focusDelegate = () => {};
      }
    },
    sync() {
      notesController.sync();
    },
  };
}
