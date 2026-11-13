const keyboardControls = [
  'input', 'textarea', 'select', 'button', 'a[href]', 'area[href]', 'summary',
  'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role~="button"]', '[role~="link"]', '[role~="checkbox"]', '[role~="radio"]',
  '[role~="switch"]', '[role~="slider"]', '[role~="spinbutton"]', '[role~="textbox"]',
  '[role~="combobox"]', '[role~="listbox"]', '[role~="option"]', '[role~="tab"]',
  '[role~="menuitem"]', '[role~="menuitemcheckbox"]', '[role~="menuitemradio"]'
].join(',');

function ownsSpace(element) {
  return element?.isContentEditable || Boolean(element?.closest?.(keyboardControls));
}

export function bindPlaybackShortcut(document, play, canToggle) {
  document.addEventListener('keydown', event => {
    if (event.key !== ' ' || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (ownsSpace(document.activeElement) || event.composedPath().some(ownsSpace) ||
        document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])')) return;
    if (play.disabled || !canToggle()) return;

    event.preventDefault();
    play.click();
  });
}
