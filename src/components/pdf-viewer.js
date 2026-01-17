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

function updateMetadata(
  container,
  {
    page,
    zoom,
    totalPages,
    rotation,
    viewportWidth,
    viewportHeight,
    pageWidth,
    pageHeight,
  } = {},
) {
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

  if (Number.isFinite(rotation)) {
    container.dataset.rotation = String(rotation);
  } else {
    delete container.dataset.rotation;
  }

  if (Number.isFinite(viewportWidth) && viewportWidth > 0) {
    container.dataset.viewportWidth = String(
      Number.parseFloat(viewportWidth.toFixed(2)),
    );
  } else {
    delete container.dataset.viewportWidth;
  }

  if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
    container.dataset.viewportHeight = String(
      Number.parseFloat(viewportHeight.toFixed(2)),
    );
  } else {
    delete container.dataset.viewportHeight;
  }

  if (Number.isFinite(pageWidth) && pageWidth > 0) {
    container.dataset.pageWidth = String(Number.parseFloat(pageWidth.toFixed(2)));
  } else {
    delete container.dataset.pageWidth;
  }

  if (Number.isFinite(pageHeight) && pageHeight > 0) {
    container.dataset.pageHeight = String(Number.parseFloat(pageHeight.toFixed(2)));
  } else {
    delete container.dataset.pageHeight;
  }
}

function prepareCanvas(canvas, viewport) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    return null;
  }

  const contextGetter = canvas.getContext;
  const globalWindow = typeof window !== 'undefined' ? window : undefined;
  const jsdomUserAgent = globalWindow?.navigator?.userAgent || '';
  const isJsdomEnvironment = /jsdom/i.test(jsdomUserAgent);
  const htmlCanvas = globalWindow?.HTMLCanvasElement;

  if (isJsdomEnvironment && htmlCanvas && contextGetter === htmlCanvas.prototype.getContext) {
    return null;
  }

  let context;

  try {
    context = contextGetter.call(canvas, '2d');
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

export function createPdfViewer(file, { onZoom } = {}) {
  const container = document.createElement('div');
  container.className = 'workspace__window-viewer';

  const canvas = document.createElement('canvas');
  canvas.className = 'workspace__window-canvas';

  const status = createStatusElement();

  container.append(canvas, status);

  const pointers = new Map();
  let prevDiff = -1;

  container.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, event);
  });

  container.addEventListener('pointermove', (event) => {
    pointers.set(event.pointerId, event);

    if (pointers.size === 2) {
      const [p1, p2] = Array.from(pointers.values());
      const dx = p1.clientX - p2.clientX;
      const dy = p1.clientY - p2.clientY;
      const curDiff = Math.hypot(dx, dy);

      if (prevDiff > 0) {
        if (lastViewportMetrics && typeof onZoom === 'function') {
          const scale = curDiff / prevDiff;
          const newZoom = lastViewportMetrics.zoom * scale;
          onZoom(newZoom);
        }
      }

      prevDiff = curDiff;
    }
  });

  const pointerUpHandler = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      prevDiff = -1;
    }
  };

  container.addEventListener('pointerup', pointerUpHandler);
  container.addEventListener('pointercancel', pointerUpHandler);
  container.addEventListener('pointerout', pointerUpHandler);
  container.addEventListener('leave', pointerUpHandler);

  container.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        if (lastViewportMetrics && typeof onZoom === 'function') {
          // Normalize wheel delta for zoom
          // deltaY is negative when zooming in (scrolling up)
          const delta = -event.deltaY;
          // Apply a gentle scaling factor
          const factor = 1 + delta * 0.002;
          const newZoom = lastViewportMetrics.zoom * factor;
          onZoom(newZoom);
        }
      }
    },
    { passive: false },
  );

  let pdfDocument = null;
  let renderTask = null;
  let lastViewportMetrics = null;
  let loadTask = null;
  const pageTextCache = new Map();

  const load = async () => {
    if (loadTask) {
      return loadTask;
    }

    loadTask = (async () => {
      updateStatus(status, 'PDFを読み込み中…');

      try {
        const data = await readFileData(file);
        const task = getDocument({ data });
        pdfDocument = await task.promise;
        updateStatus(status, '');
        return pdfDocument;
      } catch (error) {
        updateStatus(status, 'PDFの読み込みに失敗しました。');
        pdfDocument = null;
        throw error;
      }
    })();

    try {
      await loadTask;
    } catch (error) {
      loadTask = null;
      throw error;
    }

    return loadTask;
  };

  const ensureDocument = async () => {
    if (pdfDocument) {
      return pdfDocument;
    }

    pdfDocument = await load();
    return pdfDocument;
  };

  const render = async ({ page, zoom, rotation }) => {
    const documentInstance = await ensureDocument();

    if (!documentInstance) {
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
      const pdfPage = await documentInstance.getPage(page);
      const normalizedRotation = Number.isFinite(rotation)
        ? ((Math.round(rotation / 90) * 90) % 360 + 360) % 360
        : 0;
      const viewport = pdfPage.getViewport({ scale: zoom, rotation: normalizedRotation });
      const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
      const baseWidth = viewport.width / safeZoom;
      const baseHeight = viewport.height / safeZoom;
      lastViewportMetrics = {
        page,
        zoom: safeZoom,
        rotation: normalizedRotation,
        width: viewport.width,
        height: viewport.height,
        pageWidth: baseWidth,
        pageHeight: baseHeight,
        totalPages: Number.isFinite(pdfDocument.numPages) ? pdfDocument.numPages : null,
      };
      updateMetadata(container, {
        page,
        zoom: safeZoom,
        totalPages: lastViewportMetrics.totalPages ?? undefined,
        rotation: normalizedRotation,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        pageWidth: baseWidth,
        pageHeight: baseHeight,
      });
      const renderContext = prepareCanvas(canvas, viewport);

      if (!renderContext) {
        lastViewportMetrics = null;
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
      lastViewportMetrics = null;
    } finally {
      renderTask = null;
    }
  };

  const getPageText = async (pageNumber) => {
    const documentInstance = await ensureDocument();

    if (!documentInstance) {
      return '';
    }

    const sanitizedPage = Number.isFinite(pageNumber)
      ? Math.max(1, Math.floor(pageNumber))
      : 1;

    if (pageTextCache.has(sanitizedPage)) {
      return pageTextCache.get(sanitizedPage) ?? '';
    }

    try {
      const page = await documentInstance.getPage(sanitizedPage);

      if (!page || typeof page.getTextContent !== 'function') {
        pageTextCache.set(sanitizedPage, '');
        return '';
      }

      const content = await page.getTextContent();
      const text = Array.isArray(content.items)
        ? content.items
          .map((item) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ')
        : '';
      const normalized = text.replace(/\s+/g, ' ').trim();
      pageTextCache.set(sanitizedPage, normalized);
      return normalized;
    } catch (error) {
      pageTextCache.set(sanitizedPage, '');
      return '';
    }
  };

  const search = async (term, { signal } = {}) => {
    const documentInstance = await ensureDocument();

    if (!documentInstance) {
      return [];
    }

    const normalizedQuery = typeof term === 'string' ? term.trim() : '';

    if (!normalizedQuery) {
      return [];
    }

    const lowerQuery = normalizedQuery.toLowerCase();
    const results = [];
    const total = Number.isFinite(documentInstance.numPages)
      ? documentInstance.numPages
      : 0;

    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      if (signal?.aborted) {
        return [];
      }

      const text = await getPageText(pageNumber);

      if (!text) {
        continue;
      }

      const lower = text.toLowerCase();
      let startIndex = lower.indexOf(lowerQuery);

      while (startIndex !== -1) {
        if (signal?.aborted) {
          return [];
        }

        const before = Math.max(0, startIndex - 30);
        const after = Math.min(text.length, startIndex + normalizedQuery.length + 30);
        const context = text.slice(before, after).replace(/\s+/g, ' ').trim();

        results.push({
          page: pageNumber,
          index: startIndex,
          context,
        });

        startIndex = lower.indexOf(lowerQuery, startIndex + normalizedQuery.length);
      }
    }

    return results;
  };

  const resolveOutlineDestination = async (documentInstance, destination) => {
    if (!destination) {
      return null;
    }

    let target = destination;

    if (typeof target === 'string' && typeof documentInstance.getDestination === 'function') {
      try {
        const resolved = await documentInstance.getDestination(target);
        target = resolved;
      } catch (error) {
        return null;
      }
    }

    if (!Array.isArray(target) || !target[0]) {
      return null;
    }

    try {
      const pageIndex = await documentInstance.getPageIndex(target[0]);

      if (!Number.isFinite(pageIndex)) {
        return null;
      }

      return pageIndex + 1;
    } catch (error) {
      return null;
    }
  };

  const collectOutline = async (items, level, documentInstance, accumulator) => {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    for (const item of items) {
      if (!item) {
        continue;
      }

      const title = typeof item.title === 'string' && item.title.trim().length > 0
        ? item.title.trim()
        : '無題セクション';
      const page = await resolveOutlineDestination(documentInstance, item.dest);

      accumulator.push({
        title,
        page,
        level,
      });

      if (Array.isArray(item.items) && item.items.length > 0) {
        await collectOutline(item.items, level + 1, documentInstance, accumulator);
      }
    }
  };

  const getOutlineEntries = async () => {
    const documentInstance = await ensureDocument();

    if (!documentInstance || typeof documentInstance.getOutline !== 'function') {
      return [];
    }

    try {
      const outline = await documentInstance.getOutline();

      if (!Array.isArray(outline) || outline.length === 0) {
        return [];
      }

      const entries = [];
      await collectOutline(outline, 0, documentInstance, entries);
      return entries;
    } catch (error) {
      return [];
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
    lastViewportMetrics = null;
    updateMetadata(container, {});
    pageTextCache.clear();
    loadTask = null;
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
    getViewportMetrics() {
      if (!lastViewportMetrics) {
        return null;
      }

      return { ...lastViewportMetrics };
    },
    async getPageText(pageNumber) {
      return getPageText(pageNumber);
    },
    async search(term, options) {
      return search(term, options);
    },
    async getOutlineEntries() {
      return getOutlineEntries();
    },
  };
}
