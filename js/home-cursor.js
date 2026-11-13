const circle = document.getElementById('home-cursor');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (circle && CSS.supports('mix-blend-mode', 'difference')) {
  let x, y, targetX, targetY, frame = 0;

  function render() {
    frame = 0;
    const remaining = Math.hypot(targetX - x, targetY - y);
    if (reducedMotion.matches || remaining < .3) {
      x = targetX;
      y = targetY;
    } else {
      x += (targetX - x) * .45;
      y += (targetY - y) * .45;
      frame = requestAnimationFrame(render);
    }
    circle.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  }

  function hide() {
    cancelAnimationFrame(frame);
    frame = 0;
    circle.hidden = true;
    document.body.classList.remove('has-home-cursor');
  }

  function follow(event) {
    if (!finePointer.matches || event.pointerType !== 'mouse') {
      hide();
      return;
    }
    targetX = event.clientX;
    targetY = event.clientY;
    if (circle.hidden) {
      x = targetX;
      y = targetY;
      render();
      circle.hidden = false;
      document.body.classList.add('has-home-cursor');
    } else if (!frame) {
      frame = requestAnimationFrame(render);
    }
  }

  window.addEventListener('pointermove', follow, { passive: true });
  window.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') hide();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  window.addEventListener('keydown', hide);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
  });
  finePointer.addEventListener('change', hide);
}
