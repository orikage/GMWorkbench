import { MAX_WINDOW_BOOKMARKS } from './constants.js';

const DEFAULT_TITLE = 'ブックマーク';

export function createBookmarksWindow({
  title = DEFAULT_TITLE,
  onCloseRequest,
  onAddBookmark,
  onJumpBookmark,
  onRemoveBookmark,
  onNextRequest,
  onPreviousRequest,
} = {}) {
  let windowTitle =
    typeof title === 'string' && title.trim().length > 0 ? title.trim() : DEFAULT_TITLE;
  let focusDelegate = () => {};
  let bookmarkState = {
    bookmarks: [],
    currentPage: null,
    nextBookmark: null,
    previousBookmark: null,
    atCapacity: false,
    currentIsBookmarked: false,
  };

  let statusMessage = '';
  let statusIsError = false;

  const element = document.createElement('article');
  element.className = 'workspace__window workspace__window--bookmarks';
  element.tabIndex = 0;

  const header = document.createElement('header');
  header.className = 'workspace__window-header';

  const titleElement = document.createElement('h3');
  titleElement.className = 'workspace__window-title';
  titleElement.textContent = windowTitle;

  const controls = document.createElement('div');
  controls.className = 'workspace__window-controls';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'workspace__window-close';
  closeButton.textContent = '閉じる';
  closeButton.addEventListener('click', () => {
    if (typeof onCloseRequest === 'function') {
      onCloseRequest();
    }
  });

  controls.append(closeButton);
  header.append(titleElement, controls);

  const body = document.createElement('div');
  body.className = 'workspace__window-body';

  const bookmarksSection = document.createElement('section');
  bookmarksSection.className = 'workspace__window-bookmarks';

  const bookmarksHeader = document.createElement('div');
  bookmarksHeader.className = 'workspace__window-bookmarks-header';

  const bookmarksLabel = document.createElement('span');
  bookmarksLabel.className = 'workspace__window-bookmarks-label';
  bookmarksLabel.textContent = 'ブックマーク';

  const bookmarksControls = document.createElement('div');
  bookmarksControls.className = 'workspace__window-bookmarks-controls';

  const bookmarkPrevButton = document.createElement('button');
  bookmarkPrevButton.type = 'button';
  bookmarkPrevButton.className = 'workspace__window-bookmark-prev';
  bookmarkPrevButton.textContent = '前のブックマーク';
  bookmarkPrevButton.addEventListener('click', () => {
    if (typeof onPreviousRequest === 'function') {
      onPreviousRequest();
    }
  });

  const bookmarkAddButton = document.createElement('button');
  bookmarkAddButton.type = 'button';
  bookmarkAddButton.className = 'workspace__window-bookmark-add';
  bookmarkAddButton.textContent = 'このページを記憶';
  bookmarkAddButton.addEventListener('click', () => {
    if (typeof onAddBookmark === 'function') {
      onAddBookmark();
    }
  });

  const bookmarkNextButton = document.createElement('button');
  bookmarkNextButton.type = 'button';
  bookmarkNextButton.className = 'workspace__window-bookmark-next';
  bookmarkNextButton.textContent = '次のブックマーク';
  bookmarkNextButton.addEventListener('click', () => {
    if (typeof onNextRequest === 'function') {
      onNextRequest();
    }
  });

  const syncFocus = (target) => {
    target.addEventListener('focus', () => {
      focusDelegate();
    });
  };

  [bookmarkPrevButton, bookmarkAddButton, bookmarkNextButton].forEach((button) => {
    syncFocus(button);
  });

  bookmarksControls.append(bookmarkPrevButton, bookmarkAddButton, bookmarkNextButton);
  bookmarksHeader.append(bookmarksLabel, bookmarksControls);

  const bookmarkStatus = document.createElement('p');
  bookmarkStatus.className = 'workspace__window-bookmarks-status';
  bookmarkStatus.hidden = true;

  const bookmarksEmpty = document.createElement('p');
  bookmarksEmpty.className = 'workspace__window-bookmarks-empty';
  bookmarksEmpty.textContent = 'ブックマークはまだありません。';

  const bookmarksList = document.createElement('ul');
  bookmarksList.className = 'workspace__window-bookmarks-list';
  bookmarksList.setAttribute('role', 'list');

  const renderBookmarks = () => {
    bookmarksList.textContent = '';

    if (!Array.isArray(bookmarkState.bookmarks) || bookmarkState.bookmarks.length === 0) {
      bookmarksEmpty.hidden = false;
      return;
    }

    bookmarksEmpty.hidden = true;

    bookmarkState.bookmarks.forEach((page) => {
      const item = document.createElement('li');
      item.className = 'workspace__window-bookmarks-item';
      item.dataset.bookmarkPage = String(page);

      const jumpButton = document.createElement('button');
      jumpButton.type = 'button';
      jumpButton.className = 'workspace__window-bookmark-jump';
      jumpButton.textContent = `${page}ページ目`;
      jumpButton.setAttribute('aria-label', `${windowTitle} の ${page} ページへ移動`);
      jumpButton.addEventListener('click', () => {
        if (typeof onJumpBookmark === 'function') {
          onJumpBookmark(page);
        }
      });
      syncFocus(jumpButton);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'workspace__window-bookmark-remove';
      removeButton.textContent = '削除';
      removeButton.setAttribute('aria-label', `${windowTitle} の ${page} ページのブックマークを削除`);
      removeButton.addEventListener('click', () => {
        if (typeof onRemoveBookmark === 'function') {
          onRemoveBookmark(page);
        }
      });
      syncFocus(removeButton);

      item.append(jumpButton, removeButton);
      bookmarksList.append(item);
    });
  };

  const syncControls = () => {
    const hasCurrent = bookmarkState.currentIsBookmarked;
    const hasPage = Number.isFinite(bookmarkState.currentPage);
    const atCapacity = bookmarkState.atCapacity;

    bookmarkAddButton.disabled = !hasPage || hasCurrent || atCapacity;

    if (!hasPage) {
      bookmarkAddButton.setAttribute('aria-label', `${windowTitle} のページを指定できません`);
    } else if (hasCurrent) {
      bookmarkAddButton.setAttribute('aria-label', `${windowTitle} の ${bookmarkState.currentPage} ページは保存済み`);
    } else if (atCapacity) {
      bookmarkAddButton.setAttribute('aria-label', `${windowTitle} のブックマークは上限 (${MAX_WINDOW_BOOKMARKS} 件) に達しています`);
    } else {
      bookmarkAddButton.setAttribute('aria-label', `${windowTitle} の現在のページをブックマーク`);
    }

    const hasNext = Number.isFinite(bookmarkState.nextBookmark);
    bookmarkNextButton.disabled = !hasNext;

    if (hasNext) {
      bookmarkNextButton.setAttribute(
        'aria-label',
        `${windowTitle} の ${bookmarkState.nextBookmark} ページのブックマークへ進む`,
      );
    } else {
      bookmarkNextButton.setAttribute('aria-label', `${windowTitle} には後ろ方向のブックマークがありません`);
    }

    const hasPrevious = Number.isFinite(bookmarkState.previousBookmark);
    bookmarkPrevButton.disabled = !hasPrevious;

    if (hasPrevious) {
      bookmarkPrevButton.setAttribute(
        'aria-label',
        `${windowTitle} の ${bookmarkState.previousBookmark} ページのブックマークへ戻る`,
      );
    } else {
      bookmarkPrevButton.setAttribute('aria-label', `${windowTitle} には前方向のブックマークがありません`);
    }
  };

  const syncStatus = () => {
    bookmarkStatus.textContent = statusMessage;
    bookmarkStatus.hidden = statusMessage.length === 0;
    bookmarkStatus.classList.toggle('workspace__window-bookmarks-status--error', statusIsError);
  };

  bookmarksSection.append(bookmarksHeader, bookmarkStatus, bookmarksEmpty, bookmarksList);
  body.append(bookmarksSection);
  element.append(header, body);

  element.addEventListener('focus', () => {
    focusDelegate();
  });

  return {
    element,
    header,
    closeButton,
    setFocusDelegate(callback) {
      if (typeof callback === 'function') {
        focusDelegate = callback;
      } else {
        focusDelegate = () => {};
      }
    },
    updateTitle(nextTitle) {
      const normalized =
        typeof nextTitle === 'string' && nextTitle.trim().length > 0 ? nextTitle.trim() : DEFAULT_TITLE;
      windowTitle = normalized;
      titleElement.textContent = normalized;
      closeButton.setAttribute('aria-label', `${normalized} を閉じる`);
      renderBookmarks();
      syncControls();
      syncStatus();
    },
    sync({
      bookmarks = [],
      currentPage = null,
      nextBookmark = null,
      previousBookmark = null,
      atCapacity = false,
      currentIsBookmarked = false,
    } = {}) {
      bookmarkState = {
        bookmarks: Array.isArray(bookmarks) ? bookmarks.slice() : [],
        currentPage: Number.isFinite(currentPage) ? currentPage : null,
        nextBookmark: Number.isFinite(nextBookmark) ? nextBookmark : null,
        previousBookmark: Number.isFinite(previousBookmark) ? previousBookmark : null,
        atCapacity: atCapacity === true,
        currentIsBookmarked: currentIsBookmarked === true,
      };

      renderBookmarks();
      syncControls();
      syncStatus();
    },
    setStatus(message = '', { isError = false } = {}) {
      statusMessage = typeof message === 'string' ? message : '';
      statusIsError = isError === true;
      syncStatus();
    },
  };
}
