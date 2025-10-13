export const workspaceThemes = {
  midnight: {
    body: '#090d14',
    surface: '#101622',
    panel: '#161d2b',
    overlay: 'rgba(10, 14, 22, 0.92)',
    border: '#1f2735',
    'border-strong': '#2c3648',
    divider: '#131a28',
    'text-primary': '#f5f7fa',
    'text-secondary': '#c7cedc',
    'text-tertiary': '#8f96a6',
    accent: '#2f74ff',
    'accent-strong': '#4c8bff',
    'accent-muted': 'rgba(47, 116, 255, 0.18)',
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
