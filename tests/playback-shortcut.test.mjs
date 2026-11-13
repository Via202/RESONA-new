import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPlaybackShortcut } from '../js/playback-shortcut.js';

function setup() {
  let keydown;
  const state = { ready: true, modal: false, clicks: 0 };
  const doc = {
    activeElement: null,
    addEventListener(type, listener) {
      assert.equal(type, 'keydown');
      keydown = listener;
    },
    querySelector(selector) {
      assert.match(selector, /dialog\[open\]/);
      return state.modal;
    }
  };
  const play = { disabled: false, click: () => state.clicks++ };
  bindPlaybackShortcut(doc, play, () => state.ready);
  function press(overrides = {}, path = []) {
    const event = {
      key: ' ', defaultPrevented: false, composedPath: () => path,
      preventDefault() { this.defaultPrevented = true; },
      ...overrides
    };
    keydown(event);
    return event.defaultPrevented;
  }
  return { doc, play, state, press };
}

test('each fresh Space invokes the existing Play control exactly once, ignoring key repeats', () => {
  const { state, press } = setup();
  assert.equal(press(), true);
  assert.equal(press({ repeat: true }), false);
  assert.equal(press(), true);
  assert.equal(press(), true);
  assert.equal(state.clicks, 3);
});

test('Space respects focused native controls, editable content, and custom controls', () => {
  const { doc, state, press } = setup();
  for (const type of ['input', 'textarea', 'button', 'select', 'summary', '[role~="slider"]']) {
    doc.activeElement = { closest: selector => selector.split(',').includes(type) };
    assert.equal(press(), false, type);
  }
  doc.activeElement = { isContentEditable: true };
  assert.equal(press(), false);
  doc.activeElement = null;
  assert.equal(press({}, [{ closest: selector => selector.includes('a[href]') }]), false);
  assert.equal(state.clicks, 0);
});

test('Space leaves browser defaults intact for a modal, unavailable transport, or modified keys', () => {
  const { play, state, press } = setup();
  state.modal = true;
  assert.equal(press(), false);
  state.modal = false;
  state.ready = false;
  assert.equal(press(), false);
  state.ready = true;
  play.disabled = true;
  assert.equal(press(), false);
  play.disabled = false;
  for (const flag of ['isComposing', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(press({ [flag]: true }), false);
  }
  assert.equal(press({ key: 'Enter' }), false);
  assert.equal(press({ defaultPrevented: true }), true);
  assert.equal(state.clicks, 0);
});
