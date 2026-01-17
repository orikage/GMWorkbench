import { WINDOW_SEARCH_EVENT } from './constants.js';

export function createWindowSearch({
  file,
  windowElement,
  viewer,
  commitPageChange,
  bringToFront,
}) {
  const searchSection = document.createElement('section');
  searchSection.className = 'workspace__window-search';

  const searchForm = document.createElement('form');
  searchForm.className = 'workspace__window-search-form';

  const searchInputId = `workspace-window-search-${Math.random().toString(36).slice(2, 9)}`;

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'workspace__window-search-input';
  searchInput.id = searchInputId;
  searchInput.placeholder = 'キーワードを検索';
  searchInput.autocomplete = 'off';
  searchInput.setAttribute('aria-label', 'PDF内のテキストを検索');

  const searchSubmitButton = document.createElement('button');
  searchSubmitButton.type = 'submit';
  searchSubmitButton.className = 'workspace__window-search-submit';
  searchSubmitButton.textContent = '検索';

  const searchInputs = document.createElement('div');
  searchInputs.className = 'workspace__window-search-inputs';
  searchInputs.append(searchInput, searchSubmitButton);

  const searchPrevButton = document.createElement('button');
  searchPrevButton.type = 'button';
  searchPrevButton.className = 'workspace__window-search-prev';
  searchPrevButton.textContent = '前へ';

  const searchNextButton = document.createElement('button');
  searchNextButton.type = 'button';
  searchNextButton.className = 'workspace__window-search-next';
  searchNextButton.textContent = '次へ';

  const searchSummary = document.createElement('span');
  searchSummary.className = 'workspace__window-search-summary';

  const searchNavigation = document.createElement('div');
  searchNavigation.className = 'workspace__window-search-navigation';
  searchNavigation.append(searchPrevButton, searchNextButton, searchSummary);

  const searchStatus = document.createElement('p');
  searchStatus.className = 'workspace__window-search-status';
  searchStatus.hidden = true;

  const searchList = document.createElement('ul');
  searchList.className = 'workspace__window-search-results';
  searchList.setAttribute('role', 'list');

  searchForm.append(searchInputs, searchNavigation);
  searchSection.append(searchForm, searchStatus, searchList);

  let searchResults = [];
  let searchQuery = '';
  let searchIndex = -1;
  let searchLoading = false;
  let searchAbortController = null;

  const focusWindow = (options) => {
    if (typeof bringToFront === 'function') {
      bringToFront(options);
    }
  };

  const emitSearchEvent = (action) => {
    const activeResult = searchIndex >= 0 ? searchResults[searchIndex] : null;
    const searchEvent = new CustomEvent(WINDOW_SEARCH_EVENT, {
      bubbles: true,
      detail: {
        file,
        query: searchQuery,
        action,
        totalResults: searchResults.length,
        index: searchIndex >= 0 ? searchIndex : null,
        page: Number.isFinite(activeResult?.page) ? activeResult.page : undefined,
      },
    });

    windowElement.dispatchEvent(searchEvent);
  };

  const syncSearchMetadata = () => {
    if (searchQuery) {
      windowElement.dataset.searchQuery = searchQuery;
    } else {
      delete windowElement.dataset.searchQuery;
    }

    if (searchResults.length > 0) {
      windowElement.dataset.searchCount = String(searchResults.length);
    } else {
      delete windowElement.dataset.searchCount;
    }

    if (searchIndex >= 0) {
      windowElement.dataset.searchIndex = String(searchIndex);
    } else {
      delete windowElement.dataset.searchIndex;
    }

    if (searchLoading) {
      windowElement.dataset.searchLoading = 'true';
    } else {
      delete windowElement.dataset.searchLoading;
    }
  };

  const updateSearchSummary = () => {
    if (!searchQuery || searchResults.length === 0) {
      searchSummary.textContent = '検索結果: 0 件';
      return;
    }

    const current = searchIndex >= 0 ? searchIndex + 1 : 1;
    searchSummary.textContent = `検索結果: ${current} / ${searchResults.length} 件`;
  };

  const updateSearchControls = () => {
    const disabled = searchLoading || searchResults.length === 0;
    searchPrevButton.disabled = disabled;
    searchNextButton.disabled = disabled;
  };

  const setSearchLoading = (loading) => {
    searchLoading = loading;
    syncSearchMetadata();

    searchSubmitButton.disabled = loading;

    if (loading) {
      searchInput.setAttribute('aria-busy', 'true');
    } else {
      searchInput.removeAttribute('aria-busy');
    }
  };

  const renderSearchResults = () => {
    searchList.replaceChildren();

    if (searchResults.length === 0) {
      return;
    }

    searchResults.forEach((result, index) => {
      const item = document.createElement('li');
      item.className = 'workspace__window-search-result';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'workspace__window-search-result-button';

      const pageBadge = document.createElement('span');
      pageBadge.className = 'workspace__window-search-result-page';
      pageBadge.textContent = Number.isFinite(result?.page) ? `p.${result.page}` : '—';

      const context = document.createElement('span');
      context.className = 'workspace__window-search-result-context';
      context.textContent = typeof result?.context === 'string' ? result.context : '一致箇所';

      if (index === searchIndex) {
        item.classList.add('workspace__window-search-result--active');
      }

      button.addEventListener('click', () => {
        focusWindow({ persistFocus: false });
        goToSearchResult(index, { source: 'result' });
      });

      button.append(pageBadge, context);
      item.append(button);
      searchList.append(item);
    });
  };

  const clearSearchResults = () => {
    searchResults = [];
    searchIndex = -1;
    syncSearchMetadata();
    updateSearchSummary();
    updateSearchControls();
    renderSearchResults();

    searchStatus.hidden = true;
    searchStatus.textContent = '';
    searchStatus.classList.remove('workspace__window-search-status--error');
  };

  const goToSearchResult = (index, { source = 'navigate', emitEvent = true } = {}) => {
    if (searchResults.length === 0) {
      updateSearchSummary();
      updateSearchControls();
      renderSearchResults();
      return;
    }

    const normalizedIndex = ((Number.isFinite(index) ? Math.trunc(index) : 0) % searchResults.length + searchResults.length) % searchResults.length;
    searchIndex = normalizedIndex;
    syncSearchMetadata();
    updateSearchSummary();
    updateSearchControls();
    renderSearchResults();

    const target = searchResults[searchIndex];

    if (target && Number.isFinite(target.page)) {
      commitPageChange(target.page);
    }

    if (emitEvent) {
      emitSearchEvent(source);
    }
  };

  const cancelSearch = () => {
    if (searchAbortController) {
      searchAbortController.abort();
      searchAbortController = null;
    }

    setSearchLoading(false);
  };

  const performSearch = async (query) => {
    const sanitized = typeof query === 'string' ? query.trim() : '';
    searchQuery = sanitized;
    syncSearchMetadata();

    cancelSearch();

    if (!sanitized) {
      clearSearchResults();
      return;
    }

    const controller = new AbortController();
    searchAbortController = controller;
    setSearchLoading(true);

    searchStatus.hidden = false;
    searchStatus.textContent = '検索中…';
    searchStatus.classList.remove('workspace__window-search-status--error');

    try {
      const results = await viewer.search(sanitized, { signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      searchResults = Array.isArray(results) ? results.slice(0, 200) : [];
      searchIndex = searchResults.length > 0 ? 0 : -1;
      syncSearchMetadata();

      if (searchResults.length === 0) {
        updateSearchSummary();
        updateSearchControls();
        renderSearchResults();

        searchStatus.hidden = false;
        searchStatus.textContent = '一致する結果は見つかりませんでした。';
      } else {
        goToSearchResult(searchIndex, { emitEvent: false, source: 'search' });
        searchStatus.hidden = true;
        searchStatus.textContent = '';
      }

      emitSearchEvent('search');
    } catch (error) {
      if (!controller.signal.aborted) {
        searchStatus.hidden = false;
        searchStatus.textContent = '検索に失敗しました。';
        searchStatus.classList.add('workspace__window-search-status--error');
      }
    } finally {
      if (searchAbortController === controller) {
        searchAbortController = null;
      }

      setSearchLoading(false);
    }
  };

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    performSearch(searchInput.value ?? '');
  });

  searchInput.addEventListener('focus', () => {
    focusWindow({ persistFocus: false });
  });

  searchSubmitButton.addEventListener('focus', () => {
    focusWindow({ persistFocus: false });
  });

  searchPrevButton.addEventListener('click', () => {
    focusWindow({ persistFocus: false });
    goToSearchResult(searchIndex - 1, { source: 'previous' });
  });

  searchPrevButton.addEventListener('focus', () => {
    focusWindow({ persistFocus: false });
  });

  searchNextButton.addEventListener('click', () => {
    focusWindow({ persistFocus: false });
    goToSearchResult(searchIndex + 1, { source: 'next' });
  });

  searchNextButton.addEventListener('focus', () => {
    focusWindow({ persistFocus: false });
  });

  renderSearchResults();
  updateSearchSummary();
  updateSearchControls();
  syncSearchMetadata();

  const focusInput = () => {
    searchInput.focus();
    searchInput.select();
  };

  return {
    element: searchSection,
    cancel: cancelSearch,
    focusInput,
  };
}
