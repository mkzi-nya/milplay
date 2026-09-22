(() => {
  'use strict';

  const toggle = els.lowMemoryToggle;
  function apply(value) {
    state.lowMemory = !!value;
    try {
      localStorage.setItem('mil-low-memory', state.lowMemory ? '1' : '0');
    } catch {}
    if (toggle) toggle.checked = state.lowMemory;
    document.body.classList.toggle('lowMemoryMode', state.lowMemory);
    if (typeof __milClearStoryCache === 'function') __milClearStoryCache();
    if (typeof markStageResize === 'function') markStageResize();
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof render === 'function') render();
  }
  window.__milIsLowMemoryMode = () => !!state.lowMemory;
  window.__milSetLowMemoryMode = apply;
  if (toggle) {
    toggle.checked = !!state.lowMemory;
    toggle.addEventListener('change', () => apply(toggle.checked));
  }
})();
