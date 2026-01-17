import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyWorkspaceTheme,
  DEFAULT_WORKSPACE_THEME,
  workspaceThemes,
} from './theme.js';

describe('applyWorkspaceTheme', () => {
  let previousStyle;

  beforeEach(() => {
    previousStyle = document.documentElement.style.cssText;
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    document.documentElement.style.cssText = previousStyle;
  });

  it('applies the default theme tokens to the document element', () => {
    const root = document.createElement('div');

    const applied = applyWorkspaceTheme(root);

    expect(applied).toBe(DEFAULT_WORKSPACE_THEME);
    expect(root.dataset.theme).toBe(DEFAULT_WORKSPACE_THEME);

    const tokens = workspaceThemes[DEFAULT_WORKSPACE_THEME];
    Object.entries(tokens).forEach(([token, value]) => {
      expect(document.documentElement.style.getPropertyValue(`--workspace-${token}`)).toBe(value);
    });
  });

  it('falls back to the default theme when an unknown theme is requested', () => {
    const root = document.createElement('div');

    const applied = applyWorkspaceTheme(root, 'unknown-theme');

    expect(applied).toBe(DEFAULT_WORKSPACE_THEME);
    expect(root.dataset.theme).toBe(DEFAULT_WORKSPACE_THEME);
  });

  it('applies theme tokens even when the root element is omitted', () => {
    const applied = applyWorkspaceTheme(undefined, DEFAULT_WORKSPACE_THEME);

    expect(applied).toBe(DEFAULT_WORKSPACE_THEME);

    const tokens = workspaceThemes[DEFAULT_WORKSPACE_THEME];
    Object.entries(tokens).forEach(([token, value]) => {
      expect(document.documentElement.style.getPropertyValue(`--workspace-${token}`)).toBe(value);
    });
  });
});
