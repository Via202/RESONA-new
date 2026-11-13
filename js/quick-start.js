export function bindQuickStart(trigger, dialog) {
  trigger.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open) trigger.focus({ preventScroll: true });
  });
}

if (typeof document !== 'undefined') {
  bindQuickStart(document.getElementById('quick-start-open'), document.getElementById('quick-start'));
}
