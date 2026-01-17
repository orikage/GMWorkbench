export const workspaceThemes = {
  midnight: {
    body: '#121212',
    surface: '#1e1e1e',
    panel: '#2d2d2d',
    overlay: 'rgba(18, 18, 18, 0.92)',
    border: '#333333',
    'border-strong': '#444444',
    divider: '#2a2a2a',
    'text-primary': '#ffffff',
    'text-secondary': '#b0b0b0',
    'text-tertiary': '#757575',
    accent: '#e91e63',
    'accent-strong': '#ff4081',
    'accent-muted': 'rgba(233, 30, 99, 0.18)',
  },
};

export const DEFAULT_WORKSPACE_THEME = 'midnight';

export function applyWorkspaceTheme(root, themeName = DEFAULT_WORKSPACE_THEME) {
  const normalizedName =
    typeof themeName === 'string' && workspaceThemes[themeName]
      ? themeName
      : DEFAULT_WORKSPACE_THEME;
  const tokens = workspaceThemes[normalizedName];
  const targetDocument = root?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  const docElement = targetDocument?.documentElement;

  if (docElement) {
    Object.entries(tokens).forEach(([token, value]) => {
      docElement.style.setProperty(`--workspace-${token}`, value);
    });
  }

  if (root && typeof root === 'object') {
    root.dataset.theme = normalizedName;
  }

  return normalizedName;
}
