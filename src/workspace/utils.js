export const padNumber = (value) => String(value).padStart(2, '0');

const normalizeLabel = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const readLabelText = (element, labelledBy) => {
  if (!labelledBy || typeof labelledBy !== 'string') {
    return '';
  }

  const documentRef = element?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);

  if (!documentRef || typeof documentRef.getElementById !== 'function') {
    return '';
  }

  const ids = labelledBy.split(/\s+/).filter(Boolean);

  if (ids.length === 0) {
    return '';
  }

  const parts = ids
    .map((id) => normalizeLabel(documentRef.getElementById(id)?.textContent ?? ''))
    .filter(Boolean);

  return parts.join(' ');
};

export function copyAccessibleLabelToTitle(element, label) {
  if (!(element instanceof Element)) {
    return '';
  }

  const hasExplicitArgument = arguments.length >= 2;
  const explicit = normalizeLabel(label);

  let resolved = explicit;

  if (!resolved && !hasExplicitArgument) {
    resolved = normalizeLabel(element.getAttribute?.('aria-label'));
  }

  if (!resolved && !hasExplicitArgument) {
    resolved = readLabelText(element, element.getAttribute?.('aria-labelledby'));
  }

  if (!resolved && !hasExplicitArgument) {
    resolved = normalizeLabel(element.textContent ?? '');
  }

  if (resolved) {
    element.setAttribute('title', resolved);
  } else {
    element.removeAttribute('title');
  }

  return resolved;
}

export const formatSnapshotTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());
  const seconds = padNumber(date.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
};
