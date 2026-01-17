import { describe, expect, it } from 'vitest';
import { createWorkspaceIcon, getWorkspaceIconNames } from './icons.js';

describe('workspace icon factory', () => {
  it('returns a svg element with the base icon class', () => {
    const icon = createWorkspaceIcon('bell');

    expect(icon).toBeInstanceOf(SVGElement);
    expect(icon.classList.contains('workspace__icon')).toBe(true);
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');

    const path = icon.querySelector('path');
    expect(path?.nodeName.toLowerCase()).toBe('path');
    expect(path?.getAttribute('d')).toBeTruthy();
    expect(path?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('allows custom classes and stroke widths', () => {
    const icon = createWorkspaceIcon('log', {
      className: 'workspace__menu-icon custom-icon',
      strokeWidth: 2,
    });

    expect(icon.classList.contains('workspace__menu-icon')).toBe(true);
    expect(icon.classList.contains('custom-icon')).toBe(true);

    const path = icon.querySelector('path');
    expect(path?.getAttribute('stroke-width')).toBe('2');
  });

  it('falls back to the settings icon when an unknown name is requested', () => {
    const fallback = createWorkspaceIcon('unknown');
    const baseline = createWorkspaceIcon('settings');

    expect(fallback.querySelector('path')?.getAttribute('d')).toBe(
      baseline.querySelector('path')?.getAttribute('d'),
    );
  });

  it('exposes the available icon names', () => {
    const names = getWorkspaceIconNames();

    expect(Array.isArray(names)).toBe(true);
    expect(names).toContain('document');
    expect(names).toContain('quick-memo');
  });
});
