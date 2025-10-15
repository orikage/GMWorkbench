import { QUEUE_OPEN_EVENT, QUEUE_REMOVE_EVENT } from './constants.js';
import { copyAccessibleLabelToTitle } from './utils.js';

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

export function createFileQueue() {
  const section = document.createElement('section');
  section.className = 'workspace__queue';

  const heading = document.createElement('h2');
  heading.className = 'workspace__queue-title';
  heading.textContent = '取り込んだPDF';

  const list = document.createElement('ul');
  list.className = 'workspace__queue-list';
  list.setAttribute('role', 'list');

  const emptyState = document.createElement('p');
  emptyState.className = 'workspace__queue-empty';
  emptyState.textContent = 'まだPDFは選択されていません。';

  const syncEmptyState = () => {
    if (list.children.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
    }
  };

  syncEmptyState();

  const renderFiles = (files) => {
    files.forEach((file) => {
      const item = document.createElement('li');
      item.className = 'workspace__queue-item';

      const name = document.createElement('span');
      name.className = 'workspace__queue-name';
      name.textContent = file.name;

      const meta = document.createElement('span');
      meta.className = 'workspace__queue-meta';
      const sizeLabel = formatFileSize(file.size);
      if (sizeLabel) {
        meta.textContent = sizeLabel;
      } else {
        meta.hidden = true;
      }

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'workspace__queue-open';
      openButton.textContent = 'ワークスペースに置く';
      copyAccessibleLabelToTitle(openButton, openButton.textContent);
      openButton.addEventListener('click', () => {
        const request = new CustomEvent(QUEUE_OPEN_EVENT, {
          bubbles: true,
          detail: { file },
        });
        item.dispatchEvent(request);
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'workspace__queue-remove';
      removeButton.textContent = '取り消す';
      copyAccessibleLabelToTitle(removeButton, removeButton.textContent);
      removeButton.addEventListener('click', () => {
        const removal = new CustomEvent(QUEUE_REMOVE_EVENT, {
          bubbles: true,
          detail: { file },
        });
        item.dispatchEvent(removal);
        item.remove();
        syncEmptyState();
      });

      const actions = document.createElement('div');
      actions.className = 'workspace__queue-actions';
      actions.append(openButton, removeButton);

      const controls = document.createElement('div');
      controls.className = 'workspace__queue-controls';
      controls.append(meta, actions);

      item.append(name, controls);
      list.append(item);
    });

    syncEmptyState();
  };

  section.append(heading, emptyState, list);

  const clear = () => {
    list.replaceChildren();
    syncEmptyState();
  };

  return {
    element: section,
    renderFiles,
    clear,
  };
}
