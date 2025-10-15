import { describe, expect, it, vi } from 'vitest';
import { WORKSPACE_MENU_CHANGE_EVENT } from './constants.js';
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

  it('emits change events when a menu button is activated', () => {
    const onMenuChange = vi.fn();
    const menu = createWorkspaceMenu({ onMenuChange });

    const eventListener = vi.fn();
    menu.element.addEventListener(WORKSPACE_MENU_CHANGE_EVENT, eventListener);

    const mapButton = menu.element.querySelector('[data-menu-id="map"]');
    mapButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(menu.getActiveId()).toBe('map');
    expect(onMenuChange).toHaveBeenCalledWith('map');
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener.mock.calls[0][0].detail.id).toBe('map');
  });

  it('renders only the menu buttons without additional controls', () => {
    const { element } = createWorkspaceMenu();

    expect(element.querySelector('.workspace__menu-track')).toBeNull();
    expect(element.querySelector('.workspace__menu-range')).toBeNull();
  });
});
