import { DROP_ACTIVE_CLASS, FILE_INPUT_ID } from './constants.js';
import { copyAccessibleLabelToTitle } from './utils.js';

function createFileInput(handleFiles) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.multiple = true;
  input.id = FILE_INPUT_ID;
  input.className = 'workspace__file-input';
  input.setAttribute('aria-label', 'PDFファイルを選択');

  input.addEventListener('change', () => {
    handleFiles(input.files);
  });

  return input;
}

export function createDropZone() {
  const dropZone = document.createElement('section');
  dropZone.className = 'workspace__drop-zone';

  const instructions = document.createElement('p');
  instructions.className = 'workspace__instructions';
  instructions.textContent =
    'PDFをドラッグ＆ドロップ、または下のボタンから選択してください。';

  const action = document.createElement('button');
  action.type = 'button';
  action.className =
    'workspace__control workspace__control--accent workspace__drop-zone-button';
  action.textContent = 'PDFを開く';
  action.setAttribute('aria-controls', FILE_INPUT_ID);
  copyAccessibleLabelToTitle(action, action.textContent);

  const handleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    const fileSelected = new CustomEvent('workspace:file-selected', {
      bubbles: true,
      detail: { files },
    });

    dropZone.dispatchEvent(fileSelected);
  };

  const input = createFileInput(handleFiles);

  action.addEventListener('click', () => {
    input.click();
  });

  const activate = () => {
    dropZone.classList.add(DROP_ACTIVE_CLASS);
  };

  const deactivate = () => {
    dropZone.classList.remove(DROP_ACTIVE_CLASS);
  };

  const preventDefault = (event) => {
    event.preventDefault();
  };

  dropZone.addEventListener('dragenter', (event) => {
    preventDefault(event);
    activate();
  });

  dropZone.addEventListener('dragover', (event) => {
    preventDefault(event);
    activate();
  });

  dropZone.addEventListener('dragleave', () => {
    deactivate();
  });

  dropZone.addEventListener('dragend', () => {
    deactivate();
  });

  dropZone.addEventListener('drop', (event) => {
    preventDefault(event);
    deactivate();
    handleFiles(event.dataTransfer?.files);
  });

  dropZone.append(instructions, action, input);
  return dropZone;
}
