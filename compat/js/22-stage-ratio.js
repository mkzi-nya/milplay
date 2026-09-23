(() => {
  'use strict';

  const a = document.getElementById('ratioLengthInput'),
    b = document.getElementById('ratioWidthInput'),
    wrap = els.stageWrap,
    inner = els.stageInner;
  function number(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= 10000 ? n : null;
  }
  function ratio(x, y) {
    x = number(x);
    y = number(y);
    return x && y && x / y >= .1 && x / y <= 10 ? x / y : null;
  }
  function apply() {
    var _inner$style, _wrap$classList, _wrap$classList2;
    const r = ratio(a == null ? void 0 : a.value, b == null ? void 0 : b.value),
      custom = !!r;
    state.stageRatio = r || 16 / 9;
    state.stageRatioCustom = custom;
    inner == null || (_inner$style = inner.style) == null || _inner$style.setProperty == null || _inner$style.setProperty('--mil-stage-ratio', String(state.stageRatio));
    wrap == null || (_wrap$classList = wrap.classList) == null || _wrap$classList.toggle == null || _wrap$classList.toggle('customStageRatio', custom);
    wrap == null || (_wrap$classList2 = wrap.classList) == null || _wrap$classList2.toggle == null || _wrap$classList2.toggle('portraitStageRatio', custom && state.stageRatio < 1);
    window.__milSyncLegacyFullscreenSize == null || window.__milSyncLegacyFullscreenSize();
    a == null || a.setCustomValidity == null || a.setCustomValidity(!custom && (a.value || b != null && b.value) ? '请输入有效的长和宽' : '');
    markStageResize();
    (window.requestAnimationFrame || setTimeout)(() => {
      resizeCanvas();
      render();
      window.__milRefreshStageEnvironment == null || window.__milRefreshStageEnvironment();
    });
  }
  function change() {
    apply();
  }
  a == null || a.addEventListener('input', change);
  b == null || b.addEventListener('input', change);
  window.__milParseStageRatio = ratio;
  window.__milApplyStageRatio = apply;
  apply();
})();
