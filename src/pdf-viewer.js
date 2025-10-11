import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

async function readFileData(file) {
  if (file && typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  if (typeof Response === 'function') {
    const response = new Response(file);
    return response.arrayBuffer();
  }

  throw new TypeError('Unsupported file source for PDF読み込み');
}

function createStatusElement() {
  const status = document.createElement('p');
  status.className = 'workspace__window-status';
  status.hidden = true;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  return status;
}

function updateStatus(statusElement, message) {
  if (!statusElement) {
    return;
  }

  if (message) {
    statusElement.hidden = false;
    statusElement.textContent = message;
  } else {
    statusElement.textContent = '';
    statusElement.hidden = true;
  }
}

function updateMetadata(container, { page, zoom, totalPages }) {
  if (!container) {
    return;
  }

  if (Number.isFinite(page)) {
    container.dataset.page = String(page);
  } else {
    delete container.dataset.page;
  }

  if (Number.isFinite(zoom)) {
    container.dataset.zoom = String(zoom);
  } else {
    delete container.dataset.zoom;
  }

  if (Number.isFinite(totalPages) && totalPages > 0) {
    container.dataset.totalPages = String(totalPages);
  } else {
    delete container.dataset.totalPages;
  }
}

function prepareCanvas(canvas, viewport) {
  let context;

  try {
    context = canvas.getContext('2d');
  } catch (error) {
    return null;
  }

  if (!context) {
    return null;
  }

  const outputScale = window.devicePixelRatio || 1;
  const displayWidth = viewport.width;
  const displayHeight = viewport.height;

  const width = Math.max(1, Math.floor(displayWidth * outputScale));
  const height = Math.max(1, Math.floor(displayHeight * outputScale));

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  if (typeof context.setTransform === 'function') {
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  context.clearRect(0, 0, width, height);

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  if (outputScale !== 1) {
    renderContext.transform = [outputScale, 0, 0, outputScale, 0, 0];
  }

  return renderContext;
}

export function createPdfViewer(file) {
  const container = document.createElement('div');
  container.className = 'workspace__window-viewer';

  const canvas = document.createElement('canvas');
  canvas.className = 'workspace__window-canvas';

  const status = createStatusElement();

  container.append(canvas, status);

  let pdfDocument = null;
  let renderTask = null;

  const load = async () => {
    updateStatus(status, 'PDFを読み込み中…');

    try {
      const data = await readFileData(file);
      const task = getDocument({ data });
      pdfDocument = await task.promise;
      updateStatus(status, '');
      return pdfDocument;
    } catch (error) {
      updateStatus(status, 'PDFの読み込みに失敗しました。');
      throw error;
    }
  };

  const render = async ({ page, zoom }) => {
    if (!pdfDocument) {
      return;
    }

    updateStatus(status, 'ページを描画中…');

    if (renderTask && typeof renderTask.cancel === 'function') {
      try {
        renderTask.cancel();
      } catch (error) {
        // ignore cancellation errors
      }
    }

    try {
      const pdfPage = await pdfDocument.getPage(page);
      const viewport = pdfPage.getViewport({ scale: zoom });
      const renderContext = prepareCanvas(canvas, viewport);

      if (!renderContext) {
        updateStatus(status, 'この環境ではPDF描画を利用できません。');
        return;
      }

      renderTask = pdfPage.render(renderContext);
      await renderTask.promise;
      updateStatus(status, '');
    } catch (error) {
      if (error?.name === 'RenderingCancelledException') {
        return;
      }

      updateStatus(status, 'ページの描画に失敗しました。');
      // 状態表示で通知済みのためログは抑制する。
    } finally {
      renderTask = null;
    }
  };

  const destroy = () => {
    if (renderTask && typeof renderTask.cancel === 'function') {
      try {
        renderTask.cancel();
      } catch (error) {
        // ignore cancellation errors
      }
    }

    renderTask = null;

    if (pdfDocument && typeof pdfDocument.destroy === 'function') {
      pdfDocument.destroy();
    }

    pdfDocument = null;
    updateStatus(status, '');
  };

  return {
    element: container,
    canvas,
    status,
    load,
    render,
    destroy,
    updateState(state) {
      updateMetadata(container, state);
    },
  };
}
