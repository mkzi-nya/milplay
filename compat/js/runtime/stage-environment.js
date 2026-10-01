(() => {
  'use strict';

  let timer = 0,
    busy = false,
    failedChart = null;
  function dimensions() {
    const r = els.stage.getBoundingClientRect();
    return [Math.max(1, r.width), Math.max(1, r.height)];
  }
  function changed(chart) {
    const [w, h] = dimensions(),
      env = chart == null ? void 0 : chart._jsEnvironment;
    return env && (Number(env['stage.width']) !== w || Number(env['stage.height']) !== h);
  }
  async function refresh() {
    timer = 0;
    const chart = state.chart;
    if (busy || !(chart != null && chart._jsSource) || chart === failedChart || !changed(chart)) return;
    const [w, h] = dimensions();
    busy = true;
    try {
      const next = await milizeJsToJson(chart._jsSource, {
        ...chart._jsEnvironment,
        'stage.width': String(w),
        'stage.height': String(h)
      });
      if (state.chart !== chart) return;
      const current = dimensions();
      if (current[0] !== w || current[1] !== h) return;
      const previous = state.runtime,
        rt = makeRuntime(next, state.fileName);
      state.chart = next;
      state.runtime = rt;
      state.duration = rt.duration;
      window.__gpRebindResultRuntime == null || window.__gpRebindResultRuntime(previous, rt);
      state.currentTime = clamp(state.currentTime, 0, rt.duration);
      window.__gpRebindRuntime == null || window.__gpRebindRuntime(rt);
      updateUI();
      render();
    } catch (error) {
      failedChart = chart;
      setStatus('屏幕适配重新编译失败：' + (error.message || error), 'err');
    } finally {
      busy = false;
      if (state.chart !== failedChart && changed(state.chart)) schedule();
    }
  }
  function schedule() {
    var _state$chart;
    if (busy || !((_state$chart = state.chart) != null && _state$chart._jsSource) || state.chart === failedChart || !changed(state.chart)) return;
    clearTimeout(timer);
    timer = setTimeout(refresh, 180);
  }
  new ResizeObserver(schedule).observe(els.stage);
  window.addEventListener('resize', schedule, {
    passive: true
  });
  // First prepare may happen before its card is laid out, so inspect after paint.
  const basePrepare = prepare;
  prepare = function (...args) {
    const r = basePrepare(...args);
    requestAnimationFrame(schedule);
    return r;
  };
  window.__milRefreshStageEnvironment = refresh;
})();
