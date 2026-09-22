/* The canvas owns the visible line; this element only supplies input and accessibility. */
function createHudProgress({
  state,
  stage,
  inner,
  seek
}) {
  const slider = document.createElement('div');
  slider.className = 'hudProgress';
  slider.setAttribute('role', 'slider');
  slider.setAttribute('aria-label', '歌曲进度（暂停时调整）');
  slider.setAttribute('aria-orientation', 'horizontal');
  slider.setAttribute('aria-valuemin', '0');
  inner.appendChild(slider);
  let drag = null,
    seeking = false;
  const available = () => state.appMode === 'play' && !!state.runtime && !state.playing && Number.isFinite(state.duration) && state.duration > 0;
  function stop() {
    const old = drag;
    drag = null;
    if (old) {
      try {
        slider.releasePointerCapture(old.id);
      } catch {}
    }
  }
  function sync() {
    // updateControls also runs for external seeks, playback changes and chart loads.
    if (drag && (!seeking || !available() || drag.runtime !== state.runtime)) stop();
    const enabled = available(),
      duration = Math.max(0, state.duration || 0);
    slider.tabIndex = enabled ? 0 : -1;
    slider.setAttribute('aria-disabled', String(!enabled));
    slider.setAttribute('aria-valuemax', String(duration));
    slider.setAttribute('aria-valuenow', String(Math.max(0, Math.min(duration, state.currentTime || 0))));
    slider.setAttribute('aria-valuetext', `${(state.currentTime || 0).toFixed(3)} / ${duration.toFixed(3)} s`);
    if (!enabled && document.activeElement === slider) slider.blur();
  }
  function valid() {
    if (!available() || !drag || drag.runtime !== state.runtime || drag.duration !== state.duration || drag.time !== state.currentTime) {
      stop();
      return false;
    }
    return true;
  }
  function jump(t) {
    seeking = true;
    try {
      seek(Math.max(0, Math.min(state.duration, t)));
    } finally {
      seeking = false;
    }
    if (drag) drag.time = state.currentTime;
    if (!available()) stop();
    // Do not call sync here: seek already synchronizes through updateControls.
  }
  function point(e) {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    // Read the effective transform: nativeLandscapeFallback rotates +90deg,
    // while playExpanded clears the historical landscapeFallback transform.
    // The live canvas rect accounts for CSS scaling, letterboxing and scrolling.
    const transform = getComputedStyle(inner).transform;
    const m = transform === 'none' ? {
      a: 1,
      b: 0
    } : new DOMMatrixReadOnly(transform);
    let ratio = Math.abs(m.b) > Math.abs(m.a) ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    if (Math.abs(m.b) > Math.abs(m.a) ? m.b < 0 : m.a < 0) ratio = 1 - ratio;
    jump(ratio * state.duration);
  }
  slider.addEventListener('pointerdown', e => {
    if (!available() || drag || e.isPrimary === false || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag = {
      id: e.pointerId,
      runtime: state.runtime,
      duration: state.duration,
      time: state.currentTime
    };
    try {
      slider.setPointerCapture(e.pointerId);
    } catch {
      stop();
      return;
    }
    slider.focus({
      preventScroll: true
    });
    point(e);
  });
  slider.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id || !valid()) return;
    e.preventDefault();
    e.stopPropagation();
    point(e);
  });
  slider.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id || !valid()) return;
    e.preventDefault();
    e.stopPropagation();
    point(e);
    stop();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) slider.addEventListener(type, e => {
    var _drag;
    if (((_drag = drag) == null ? void 0 : _drag.id) === e.pointerId) stop();
  });
  slider.addEventListener('keydown', e => {
    if (!available() || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = state.currentTime || 0,
      d = state.duration;
    const targets = {
      ArrowLeft: t - 1,
      ArrowDown: t - 1,
      ArrowRight: t + 1,
      ArrowUp: t + 1,
      PageDown: t - d / 10,
      PageUp: t + d / 10,
      Home: 0,
      End: d
    };
    if (!Object.prototype.hasOwnProperty.call(targets, e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    stop();
    jump(targets[e.key]);
  });
  slider.addEventListener('blur', stop);
  window.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  sync();
  return {
    sync
  };
}
