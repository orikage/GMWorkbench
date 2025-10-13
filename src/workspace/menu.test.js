import { describe, expect, it } from 'vitest';
import { createWorkspaceMenu } from './menu.js';

describe('createWorkspaceMenu', () => {
  const getActiveButton = (element) =>
    element.querySelector('.workspace__menu-button.workspace__menu-button--active');

  it('activates the first menu item by default', () => {
    const { element, getActiveId } = createWorkspaceMenu();

    expect(getActiveId()).toBe('browser');
    const activeButton = getActiveButton(element);
    expect(activeButton).not.toBeNull();
    expect(activeButton?.dataset.menuId).toBe('browser');
  });

  it('respects a provided initial active id', () => {
    const { getActiveId, element } = createWorkspaceMenu({ initialActiveId: 'map' });

    expect(getActiveId()).toBe('map');
    expect(getActiveButton(element)?.dataset.menuId).toBe('map');
  });

  it('updates the active state when setActive is called', () => {
    const menu = createWorkspaceMenu();

    menu.setActive('log');

    expect(menu.getActiveId()).toBe('log');
    expect(menu.element.querySelector('[data-menu-id="log"]')?.classList.contains('workspace__menu-button--active')).toBe(true);
  });

  it('initialises the track buttons with a selected state', () => {
    const { element } = createWorkspaceMenu();
    const activeTrack = element.querySelector('.workspace__menu-track--active');

    expect(activeTrack).not.toBeNull();
    expect(activeTrack?.dataset.trackId).toBeDefined();
  });

  it('wires accessibility metadata for the volume slider', () => {
    const { element } = createWorkspaceMenu();
    const slider = element.querySelector('.workspace__menu-range');
    const label = element.querySelector('#workspace-menu-slider-label');

    expect(slider).toBeInstanceOf(HTMLInputElement);
    expect(slider?.getAttribute('aria-labelledby')).toBe(label?.id);
    expect(label?.classList.contains('workspace__sr-only')).toBe(true);
  });
});
