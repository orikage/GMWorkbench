const SVG_NS = 'http://www.w3.org/2000/svg';

const ICON_SPECS = {
  bell: {
    path: 'M12 21a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v4l-2 2v1h16v-1l-2-2z',
  },
  layers: {
    path: 'M12 4 4 8l8 4 8-4-8-4zm8 8-8 4-8-4m16 4-8 4-8-4',
  },
  book: {
    path: 'M5 4h6a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3zm14 0h-6a3 3 0 0 0-3 3v13h6a3 3 0 0 1 3 3z',
  },
  settings: {
    path: 'M11.983 2.25a.75.75 0 0 1 .75.75v1.165a6.02 6.02 0 0 1 2.17.9l.823-.823a.75.75 0 0 1 1.06 0l1.591 1.59a.75.75 0 0 1 0 1.061l-.822.823a6.02 6.02 0 0 1 .9 2.17h1.165a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-.75.75h-1.165a6.02 6.02 0 0 1-.9 2.17l.822.823a.75.75 0 0 1 0 1.061l-1.59 1.59a.75.75 0 0 1-1.061 0l-.823-.822a6.02 6.02 0 0 1-2.17.9V21a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1-.75-.75v-1.165a6.02 6.02 0 0 1-2.17-.9l-.823.822a.75.75 0 0 1-1.06 0l-1.591-1.59a.75.75 0 0 1 0-1.061l.822-.823a6.02 6.02 0 0 1-.9-2.17H2.25a.75.75 0 0 1-.75-.75v-2.25a.75.75 0 0 1 .75-.75h1.165a6.02 6.02 0 0 1 .9-2.17l-.822-.823a.75.75 0 0 1 0-1.06l1.59-1.591a.75.75 0 0 1 1.061 0l.823.822a6.02 6.02 0 0 1 2.17-.9V3a.75.75 0 0 1 .75-.75h2.25zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  },
  document: {
    path: 'M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 0v5h5',
    strokeWidth: 1.6,
  },
  profile: {
    path: 'M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z',
    strokeWidth: 1.6,
  },
  map: {
    path: 'M3 6.5 9 4l6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5v-13zm6-2.5v13m6-10.5v13',
    strokeWidth: 1.6,
  },
  log: {
    path: 'M5 6h14M5 11h14M5 16h10M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z',
    strokeWidth: 1.6,
  },
  sound: {
    path: 'M5 10v4h2.8l4.2 4V6l-4.2 4H5zm12.5 2a3 3 0 0 1-1.12 2.34m0-4.68A3 3 0 0 1 17.5 12m2.5 0a5 5 0 0 1-1.9 3.92m0-7.84A5 5 0 0 1 20 12',
    strokeWidth: 1.6,
  },
  'quick-memo': {
    path: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.41 1.41 3.75 3.75 1.41-1.41z',
  },
};

export function createWorkspaceIcon(name, { className, strokeWidth, viewBox } = {}) {
  const spec = ICON_SPECS[name] ?? ICON_SPECS.settings;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox ?? '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('workspace__icon');

  if (typeof className === 'string' && className.length > 0) {
    className.split(/\s+/).forEach((token) => {
      if (token) {
        svg.classList.add(token);
      }
    });
  }

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', String(strokeWidth ?? spec.strokeWidth ?? 1.5));
  path.setAttribute('d', spec.path);

  svg.append(path);
  return svg;
}

export function getWorkspaceIconNames() {
  return Object.keys(ICON_SPECS);
}
