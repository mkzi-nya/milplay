(() => {
  const wrap = els.stageWrap;
  if (!wrap) return;

  // Ensure the old fullscreen HUD is back inside stageInner only if a prior patch moved it.
  // It remains hidden in the new enlarged mode, but restoring the DOM keeps normal edit mode intact.
  const inner = document.getElementById('stageInner');
  for (const node of [wrap.querySelector(':scope > .fsLeft'), wrap.querySelector(':scope > .corner')]) {
    if (node && inner && node.parentElement === wrap) inner.appendChild(node);
  }
  const pause = createHudPause({
    state,
    inner,
    setPlaying: v => setPlaying(v)
  });
  const shrink = document.createElement('button');
  shrink.id = 'playExpandedToggle';
  shrink.className = 'playExpandedToggle';
  shrink.type = 'button';
  shrink.textContent = '⛶';
  shrink.title = '退出放大';
  shrink.setAttribute('aria-label', '退出放大');
  wrap.append(shrink);
  const syncExpandedControls = () => {
    pause.sync();
  };
  const oldUC = updateControls;
  updateControls = function () {
    oldUC();
    syncExpandedControls();
  };
  const oldUI = updateUI;
  updateUI = function () {
    oldUI();
    syncExpandedControls();
  };
  // 使用已有逐帧渲染链，在画布 HUD 更新可见性之后同步图标。
  const oldRender = render;
  render = function () {
    const result = oldRender.apply(this, arguments);
    pause.sync();
    return result;
  };
  let resizeRaf = 0;
  const resync = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      // Same resizeCanvas() and render() used by edit mode, with no transformed ancestor.
      resizeCanvas();
      render();
      syncExpandedControls();
    });
  };
  function setExpanded(on) {
    on = !!on;
    wrap.classList.toggle('playExpanded', on);
    wrap.classList.remove('landscapeFallback');
    document.documentElement.classList.toggle('playExpandedRoot', on);
    document.body.classList.toggle('playExpandedRoot', on);
    if (on && state.appMode !== 'play') setAppMode('play');
    resync();
  }

  // Replace the historical native-fullscreen/orientation-lock path.
  requestLandscapeFullscreen = async function () {
    setExpanded(!wrap.classList.contains('playExpanded'));
  };
  shrink.addEventListener('click', e => {
    e.stopPropagation();
    setExpanded(false);
  });

  // No double-tap pause on the playfield. Multi-touch releases must be reserved
  // exclusively for judgement input; pause remains an explicit UI action.

  window.addEventListener('resize', () => {
    if (wrap.classList.contains('playExpanded')) resync();
  }, {
    passive: true
  });
  window.addEventListener('orientationchange', () => {
    if (wrap.classList.contains('playExpanded')) resync();
  }, {
    passive: true
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && wrap.classList.contains('playExpanded')) {
      e.preventDefault();
      setExpanded(false);
    }
  }, true);

  // If a browser restored a stale native fullscreen state from an older build, leave it cleanly.
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    try {
      var _ref;
      (_ref = (document.exitFullscreen == null ? void 0 : document.exitFullscreen()) || (document.webkitExitFullscreen == null ? void 0 : document.webkitExitFullscreen())) == null || _ref.catch == null || _ref.catch(() => {});
    } catch {}
  }
  syncExpandedControls();
})();
