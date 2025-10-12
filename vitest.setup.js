// Shared Vitest setup for DOM-oriented tests.
// Provide safe fallbacks for browser APIs that jsdom does not fully implement.

if (typeof HTMLAnchorElement !== 'undefined') {
  HTMLAnchorElement.prototype.click = function click() {
    // jsdom throws "Not implemented: navigation" when anchors attempt to
    // navigate. We only need the side effects (e.g., triggering listeners), so
    // dispatch an event without invoking the navigation pipeline.
    const event = new Event('click', { bubbles: true, cancelable: true });
    this.dispatchEvent(event);
  };
}
