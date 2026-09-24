/* 暂停命中区域独立于 HUD 可见性；只有图标随 HUD 淡出。 */
function createHudPause({
  state,
  inner,
  setPlaying
}) {
  const button = document.createElement('button');
  button.className = 'hudPause';
  button.type = 'button';
  inner.appendChild(button);
  // 与画布 score 的中心共用宽度比例；读取布局宽度可兼容竖屏旋转舞台。
  const position = () => {
    const viewport = Number(window.innerWidth) || inner.clientWidth;
    const size = Math.min(42, Math.max(28, viewport * .033));
    button.style.top = `${Math.max(0, inner.clientWidth * .03958 - size / 2)}px`;
  };
  new ResizeObserver(position).observe(inner);
  position();
  let press = null,
    lastTap = null,
    tapTimer = 0,
    runtime = state.runtime,
    playing = state.playing,
    mode = state.appMode;
  const pointers = new Set();
  const available = () => state.appMode === 'play' && !!state.runtime;
  function clear() {
    const old = press;
    press = null;
    lastTap = null;
    if (tapTimer && typeof clearTimeout === 'function') clearTimeout(tapTimer);
    tapTimer = 0;
    button.setAttribute('data-awaiting-tap', 'false');
    if (old) {
      try {
        button.releasePointerCapture(old.id);
      } catch {}
    }
  }
  function sync() {
    if (runtime !== state.runtime || playing !== state.playing || mode !== state.appMode) clear();
    runtime = state.runtime;
    playing = state.playing;
    mode = state.appMode;
    button.disabled = !available();
    button.tabIndex = available() ? 0 : -1;
    button.setAttribute('aria-label', state.playing ? '暂停' : '继续播放');
    button.setAttribute('data-hud-visible', String(state.hudVisible !== false));
  }
  function toggle() {
    clear();
    if (available()) setPlaying(!state.playing);
    sync();
  }
  // 在捕获阶段观察场外击打和多指，不能把两次判定输入拼成暂停。
  window.addEventListener('pointerdown', e => {
    pointers.add(e.pointerId);
    if (e.target !== button || pointers.size > 1) clear();
  }, true);
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, e => {
    pointers.delete(e.pointerId);
    if (type === 'pointercancel') clear();
  }, true);
  button.addEventListener('pointerdown', e => {
    sync();
    e.stopPropagation();
    e.preventDefault();
    if (!available() || e.button !== 0 || e.isPrimary === false || pointers.size > 1) {
      clear();
      return;
    }
    press = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      at: performance.now(),
      touch: e.pointerType !== 'mouse'
    };
    try {
      button.setPointerCapture(e.pointerId);
    } catch {
      clear();
    }
    button.focus({
      preventScroll: true
    });
  });
  button.addEventListener('pointermove', e => {
    var _press;
    if (((_press = press) == null ? void 0 : _press.id) === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) clear();
  });
  button.addEventListener('pointerup', e => {
    var _press2;
    sync();
    e.preventDefault();
    e.stopPropagation();
    if (((_press2 = press) == null ? void 0 : _press2.id) !== e.pointerId) return;
    const p = press,
      now = performance.now(),
      r = button.getBoundingClientRect();
    press = null;
    try {
      button.releasePointerCapture(e.pointerId);
    } catch {}
    if (now - p.at > 300 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8 || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      clear();
      return;
    }
    if (!state.playing) {
      toggle();
      return;
    }
    if (lastTap && now - lastTap.at <= 1000 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= 12) {
      toggle();
      return;
    }
    lastTap = {
      at: now,
      x: e.clientX,
      y: e.clientY
    };
    button.setAttribute('data-awaiting-tap', 'true');
    if (tapTimer && typeof clearTimeout === 'function') clearTimeout(tapTimer);
    if (typeof setTimeout === 'function') tapTimer = setTimeout(() => {
      lastTap = null;
      button.setAttribute('data-awaiting-tap', 'false');
      tapTimer = 0;
    }, 1000);
  });
  button.addEventListener('lostpointercapture', () => {
    if (press) clear();
  });
  button.addEventListener('pointercancel', clear);
  // 原生辅助技术 click 保留；指针生成的 click 不得绕过双击判定。
  button.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.detail === 0) toggle();
  });
  for (const type of ['keydown', 'keyup']) window.addEventListener(type, e => {
    if (document.activeElement !== button || !['Space', 'Enter'].includes(e.code)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (type === 'keydown' && !e.repeat) toggle();
  }, true);
  button.addEventListener('blur', clear);
  const reset = () => {
    clear();
    pointers.clear();
  };
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', reset);
  sync();
  return {
    sync
  };
}
