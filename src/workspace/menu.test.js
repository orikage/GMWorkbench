import { describe, expect, it, vi } from 'vitest';
import {
  WORKSPACE_MENU_CHANGE_EVENT,
  WORKSPACE_TRACK_CHANGE_EVENT,
  WORKSPACE_VOLUME_CHANGE_EVENT,
} from './constants.js';
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

    const activeTrack = element.querySelector('.workspace__menu-track--active');
    expect(activeTrack).not.toBeNull();
    expect(activeTrack?.dataset.trackId).toBeDefined();
  });

  it('emits track change events when presets are selected', () => {
    const onTrackChange = vi.fn();
    const menu = createWorkspaceMenu({ onTrackChange });

    const trackEvents = vi.fn();
    menu.element.addEventListener(WORKSPACE_TRACK_CHANGE_EVENT, trackEvents);

    const secondTrack = menu.element.querySelector('[data-track-id="bgm02"]');
    secondTrack?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(menu.getActiveTrackId()).toBe('bgm02');
    expect(onTrackChange).toHaveBeenCalledWith('bgm02');
    expect(trackEvents).toHaveBeenCalledTimes(1);
    expect(trackEvents.mock.calls[0][0].detail.id).toBe('bgm02');
  });

  it('wires accessibility metadata for the volume slider', () => {
    const { element } = createWorkspaceMenu();
    const slider = element.querySelector('.workspace__menu-range');
    const label = element.querySelector('#workspace-menu-slider-label');

    expect(slider).toBeInstanceOf(HTMLInputElement);
    expect(slider?.getAttribute('aria-labelledby')).toBe(label?.id);
    expect(label?.classList.contains('workspace__sr-only')).toBe(true);
  });

  it('duplicates accessible labels to the title attribute for hover hints', () => {
    const menu = createWorkspaceMenu();
    const browserButton = menu.element.querySelector('[data-menu-id="browser"]');
    const trackButton = menu.element.querySelector('[data-track-id="bgm01"]');
    const slider = menu.element.querySelector('.workspace__menu-range');

    expect(browserButton).toBeInstanceOf(HTMLButtonElement);
    expect(browserButton?.getAttribute('title')).toBe('PDFブラウザ');
    expect(trackButton).toBeInstanceOf(HTMLButtonElement);
    expect(trackButton?.getAttribute('title')).toBe('BGM01');
    expect(slider).toBeInstanceOf(HTMLInputElement);
    expect(slider?.getAttribute('title')).toBe('BGM音量');
  });

  it('dispatches volume change events for slider interaction and programmatic updates', () => {
    const onVolumeInput = vi.fn();
    const menu = createWorkspaceMenu({ onVolumeInput });

    const volumeEvents = vi.fn();
    menu.element.addEventListener(WORKSPACE_VOLUME_CHANGE_EVENT, volumeEvents);

    const slider = menu.element.querySelector('.workspace__menu-range');
    expect(slider).toBeInstanceOf(HTMLInputElement);

    if (!(slider instanceof HTMLInputElement)) {
      throw new Error('expected a volume slider for the menu tests');
    }

    slider.value = '80';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(menu.getVolume()).toBe(80);
    expect(onVolumeInput).toHaveBeenCalledWith(80);
    expect(volumeEvents).toHaveBeenCalledTimes(1);
    expect(volumeEvents.mock.calls[0][0].detail.value).toBe(80);

    volumeEvents.mockReset();
    onVolumeInput.mockReset();

    const result = menu.setVolume(42);
    expect(result).toBe(42);
    expect(menu.getVolume()).toBe(42);
    expect(onVolumeInput).toHaveBeenCalledWith(42);
    expect(volumeEvents).toHaveBeenCalledTimes(1);
    expect(volumeEvents.mock.calls[0][0].detail.value).toBe(42);
  });
});
