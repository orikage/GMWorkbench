export function createMaintenancePanel({ onClear, onExport, onImport } = {}) {
  const section = document.createElement('section');
  section.className = 'workspace__maintenance';

  const heading = document.createElement('h2');
  heading.className = 'workspace__maintenance-title';
  heading.textContent = '保存データの管理';

  const description = document.createElement('p');
  description.className = 'workspace__maintenance-description';
  description.textContent =
    'ブラウザに保存されたPDFとウィンドウ配置の削除・書き出し読み込みを行います。';

  const actions = document.createElement('div');
  actions.className = 'workspace__maintenance-actions';

  const options = document.createElement('fieldset');
  options.className = 'workspace__maintenance-options';

  const optionsLegend = document.createElement('legend');
  optionsLegend.className = 'workspace__maintenance-options-title';
  optionsLegend.textContent = '書き出しオプション';

  const scopeAllLabel = document.createElement('label');
  scopeAllLabel.className = 'workspace__maintenance-option';
  const scopeAllInput = document.createElement('input');
  scopeAllInput.type = 'radio';
  scopeAllInput.name = 'workspace-export-scope';
  scopeAllInput.value = 'all';
  scopeAllInput.checked = true;
  scopeAllLabel.append(scopeAllInput, document.createTextNode('保存済みすべて'));

  const scopeOpenLabel = document.createElement('label');
  scopeOpenLabel.className = 'workspace__maintenance-option';
  const scopeOpenInput = document.createElement('input');
  scopeOpenInput.type = 'radio';
  scopeOpenInput.name = 'workspace-export-scope';
  scopeOpenInput.value = 'open';
  scopeOpenLabel.append(scopeOpenInput, document.createTextNode('開いているウィンドウのみ'));

  const compressionLabel = document.createElement('label');
  compressionLabel.className =
    'workspace__maintenance-option workspace__maintenance-option--checkbox';
  const compressionToggle = document.createElement('input');
  compressionToggle.type = 'checkbox';
  compressionToggle.name = 'workspace-export-compression';
  compressionToggle.value = 'gzip';
  compressionToggle.checked = true;
  compressionLabel.append(
    compressionToggle,
    document.createTextNode('gzip 形式で圧縮する（対応環境のみ）'),
  );

  options.append(optionsLegend, scopeAllLabel, scopeOpenLabel, compressionLabel);
  const exportScopeInputs = [scopeAllInput, scopeOpenInput];

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className =
    'workspace__maintenance-button workspace__maintenance-button--clear';
  clearButton.textContent = 'キャッシュを全削除';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className =
    'workspace__maintenance-button workspace__maintenance-button--export';
  exportButton.textContent = 'セッションを書き出す';

  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.className =
    'workspace__maintenance-button workspace__maintenance-button--import';
  importButton.textContent = 'セッションを読み込む';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json';
  fileInput.className = 'workspace__maintenance-file';
  fileInput.setAttribute('aria-hidden', 'true');

  const status = document.createElement('p');
  status.className = 'workspace__maintenance-status';
  status.setAttribute('role', 'status');
  status.hidden = true;

  const resetStatus = () => {
    status.hidden = true;
    status.textContent = '';
    status.classList.remove('workspace__maintenance-status--error');
  };

  const showStatus = (message, { isError = false } = {}) => {
    status.textContent = message;
    status.hidden = false;

    if (isError) {
      status.classList.add('workspace__maintenance-status--error');
    } else {
      status.classList.remove('workspace__maintenance-status--error');
    }
  };

  const setDisabled = (disabled) => {
    clearButton.disabled = disabled;
    exportButton.disabled = disabled;
    importButton.disabled = disabled;
    fileInput.disabled = disabled;
    exportScopeInputs.forEach((input) => {
      input.disabled = disabled;
    });
    compressionToggle.disabled = disabled;
  };

  let busy = false;

  const runAction = async ({
    button,
    pendingText,
    action,
    getSuccessMessage,
    getErrorMessage,
  }) => {
    if (busy) {
      return;
    }

    if (typeof action !== 'function') {
      showStatus('この操作は現在利用できません。', { isError: true });
      return;
    }

    busy = true;
    const originalText = button.textContent;
    resetStatus();
    setDisabled(true);
    button.textContent = pendingText;

    try {
      const result = await action();
      const message =
        typeof getSuccessMessage === 'function'
          ? getSuccessMessage(result)
          : getSuccessMessage;

      if (typeof message === 'string' && message.length > 0) {
        showStatus(message);
      } else {
        resetStatus();
      }
    } catch (error) {
      const message =
        typeof getErrorMessage === 'function'
          ? getErrorMessage(error)
          : getErrorMessage;
      showStatus(message || '操作に失敗しました。もう一度お試しください。', {
        isError: true,
      });
    } finally {
      busy = false;
      setDisabled(false);
      button.textContent = originalText;
    }
  };

  clearButton.addEventListener('click', async () => {
    if (busy) {
      return;
    }

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        '保存済みのPDFとレイアウトをすべて削除しますか？',
      );

      if (!confirmed) {
        return;
      }
    }

    await runAction({
      button: clearButton,
      pendingText: '削除中…',
      action: () => onClear?.(),
      getSuccessMessage: (result = {}) => {
        if (typeof result.message === 'string' && result.message.length > 0) {
          return result.message;
        }

        const windowsCleared = Number.isFinite(result.windowsCleared)
          ? result.windowsCleared
          : 0;

        return windowsCleared > 0
          ? `保存データを削除しました（ウィンドウ${windowsCleared}件）。`
          : '保存データを削除しました。';
      },
      getErrorMessage: () => '削除に失敗しました。もう一度お試しください。',
    });
  });

  exportButton.addEventListener('click', () => {
    const scopeValue = exportScopeInputs.find((input) => input.checked)?.value ?? 'all';
    const compression = compressionToggle.checked ? 'gzip' : 'none';

    void runAction({
      button: exportButton,
      pendingText: '書き出し中…',
      action: () => onExport?.({ scope: scopeValue, compression }),
      getSuccessMessage: (result = {}) => {
        if (typeof result.message === 'string' && result.message.length > 0) {
          return result.message;
        }

        const windows = Number.isFinite(result.windows) ? result.windows : 0;
        if (windows === 0) {
          return '書き出すウィンドウがありません。';
        }

        return `セッションを書き出しました（ウィンドウ${windows}件）。`;
      },
      getErrorMessage: () => '書き出しに失敗しました。もう一度お試しください。',
    });
  });

  importButton.addEventListener('click', () => {
    if (busy) {
      return;
    }

    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files || [];
    fileInput.value = '';

    if (!file) {
      return;
    }

    await runAction({
      button: importButton,
      pendingText: '読み込み中…',
      action: () => onImport?.(file),
      getSuccessMessage: (result = {}) => {
        if (typeof result.message === 'string' && result.message.length > 0) {
          return result.message;
        }

        const windows = Number.isFinite(result.windows) ? result.windows : 0;
        return `セッションを読み込みました（ウィンドウ${windows}件）。`;
      },
      getErrorMessage: () => '読み込みに失敗しました。ファイルをご確認ください。',
    });
  });

  actions.append(clearButton, exportButton, importButton, fileInput);

  section.append(heading, description, options, actions, status);

  return {
    element: section,
    showStatus,
  };
}
