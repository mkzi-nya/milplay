((_overlay$querySelecto, _overlay$querySelecto2, _els$audioPlayer) => {
  'use strict';

  const stageWrap = els.stageWrap || document.getElementById('stageWrap');
  if (!stageWrap) return;
  const overlay = document.createElement('div');
  overlay.id = 'gameResultOverlay';
  overlay.className = 'gameResultOverlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `<div class="gameResultBackdrop"></div><div class="gameResultShade"></div><button class="gameResultRestart" id="gameResultRestart" type="button" aria-label="重开">↻ 重开</button><div class="gameResultContent"><section class="gameResultLeft"><div class="gameResultSong"><div class="gameResultSongTitle" id="gameResultTitle">-</div><div class="gameResultDifficulty" id="gameResultDifficulty">-</div></div><div class="gameResultCoverFrame"><img class="gameResultCover" id="gameResultCover" alt="曲绘"></div></section><section class="gameResultRight"><div class="gameResultScoreRow"><div class="gameResultScore" id="gameResultScore">0000000</div></div><div class="gameResultAcc" id="gameResultAcc">00.00%</div><div class="gameResultJudges"><div class="gameResultJudge gameResultPerfect"><b>PERFECT</b><span id="gameResultPerfect">0(0)</span></div><div class="gameResultJudge gameResultGood"><b>GOOD</b><span id="gameResultGood">0(0)</span></div><div class="gameResultJudge gameResultBad"><b>BAD/MISS</b><span id="gameResultBad">0/0</span></div></div></section></div>`;
  stageWrap.appendChild(overlay);
  const resultHeader = document.createElement('header');
  resultHeader.className = 'gameResultHeader';
  const song = overlay.querySelector('.gameResultSong'),
    restart = overlay.querySelector('#gameResultRestart');
  if (restart) {
    restart.textContent = '↻';
    restart.title = '重开';
    resultHeader.appendChild(restart);
  }
  if (song) resultHeader.appendChild(song);
  const profile = document.createElement('div');
  profile.className = 'gameResultProfile';
  profile.innerHTML = '<div class="gameResultIdentity"><div>user</div><div class="gameResultReality"><span>REALITY</span> 114.514</div></div><img class="gameResultAvatar" src="assets/result-avatar.png" alt="用户头像">';
  resultHeader.appendChild(profile);
  overlay.appendChild(resultHeader);
  const gradeImage = document.createElement('img');
  gradeImage.id = 'gameResultGrade';
  gradeImage.className = 'gameResultGrade';
  gradeImage.alt = '评级';
  (_overlay$querySelecto = overlay.querySelector('.gameResultScoreRow')) == null || _overlay$querySelecto.appendChild(gradeImage);
  const backdrop = overlay.querySelector('.gameResultBackdrop'),
    cover = overlay.querySelector('#gameResultCover'),
    titleEl = overlay.querySelector('#gameResultTitle'),
    diffEl = overlay.querySelector('#gameResultDifficulty'),
    scoreEl = overlay.querySelector('#gameResultScore'),
    accEl = overlay.querySelector('#gameResultAcc'),
    perfectEl = overlay.querySelector('#gameResultPerfect'),
    goodEl = overlay.querySelector('#gameResultGood'),
    badEl = overlay.querySelector('#gameResultBad'),
    restartBtn = overlay.querySelector('#gameResultRestart');
  let shownForRuntime = null,
    showQueued = false,
    dismissedForRuntime = null;
  function resultMeta() {
    var _state$runtime, _state$chart;
    const m = ((_state$runtime = state.runtime) == null ? void 0 : _state$runtime.meta) || ((_state$chart = state.chart) == null ? void 0 : _state$chart.meta) || {};
    let difficulty = String(m.Difficulty || m.difficulty_name || '');
    if (m.DifficultyValue != null && !/\d\+?\s*$/.test(difficulty)) difficulty += ' ' + m.DifficultyValue;
    return {
      title: String(m.Title || m.name || state.fileName || 'Unknown'),
      difficulty
    };
  }
  function hideResult(suppress = false) {
    const wasShowing = overlay.classList.contains('show');
    showQueued = false;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    shownForRuntime = null;
    if (suppress && wasShowing) dismissedForRuntime = state.runtime;
  }
  function showResult() {
    if (state.appMode !== 'play' || !state.runtime || dismissedForRuntime === state.runtime) return;
    if (shownForRuntime === state.runtime && overlay.classList.contains('show')) return;
    const r = window.__gpScoreBreakdown == null ? void 0 : window.__gpScoreBreakdown(true);
    if (!r) return;
    const c = r.counts || {},
      meta = resultMeta(),
      /* scoreMap 量级为 1e6/音符，换算成百分比需除以 1e4（1e6 -> 100%）。 */
      acc = r.noteAmount ? r.totalAccScore / (r.noteAmount * 10000) : 0;
    titleEl.textContent = meta.title;
    diffEl.textContent = meta.difficulty || '—';
    scoreEl.textContent = String(Math.max(0, r.finalScore | 0)).padStart(7, '0');
    accEl.textContent = acc.toFixed(2) + '%';
    perfectEl.textContent = `${(c.e || 0) + (c.p || 0)}(${c.p || 0})`;
    goodEl.textContent = `${(c.g || 0) + (c.n || 0)}(${c.n || 0})`;
    badEl.textContent = `${c.b || 0}/${c.m || 0}`;
    const bg = state.bgUrl || '';
    if (bg) {
      cover.src = bg;
      cover.classList.remove('noImage');
      if (backdrop) backdrop.style.backgroundImage = `url(${JSON.stringify(bg)})`;
    } else {
      cover.removeAttribute('src');
      cover.classList.add('noImage');
      if (backdrop) backdrop.style.backgroundImage = 'none';
    }
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    shownForRuntime = state.runtime;
  }
  const lightningEl = document.createElement('div');
  lightningEl.className = 'gameResultLightning';
  (_overlay$querySelecto2 = overlay.querySelector('.gameResultRight')) == null || _overlay$querySelecto2.appendChild(lightningEl);
  const showOrdinaryResult = showResult;
  showResult = function () {
    showOrdinaryResult();
    if (!overlay.classList.contains('show')) return;
    const stats = window.__gpLightningStats == null ? void 0 : window.__gpLightningStats();
    lightningEl.textContent = stats != null && stats.total ? `闪电  通过 ${stats.passed} / 触雷 ${stats.missed}` : '';
    const result = window.__gpScoreBreakdown == null ? void 0 : window.__gpScoreBreakdown(true);
    if (result) {
      const g = window.MilResultGrade == null ? void 0 : window.MilResultGrade(result.finalScore, result.counts, result.noteAmount);
      if (g) {
        gradeImage.src = `assets/grades/${g.icon}.png`;
        gradeImage.alt = `评级 ${g.name}${g.ap ? ' · ALL PERFECT' : g.fc ? ' · FULL COMBO' : ''}`;
        overlay.dataset.achievement = g.ap ? 'ap' : g.fc ? 'fc' : 'clear';
      }
      const c = result.counts || {};
      perfectEl.textContent = `${(c.e || 0) + (c.p || 0)}(${c.e || 0})`;
      goodEl.textContent = `${(c.g || 0) + (c.n || 0)}(${c.g || 0})`;
    }
  };
  // Resizing recompiles the same chart, but must not undo an explicit dismissal.
  window.__gpRebindResultRuntime = function (previous, next) {
    if (dismissedForRuntime === previous) dismissedForRuntime = next;
    if (shownForRuntime === previous) hideResult(false);
  };
  window.__gpShowResult = showResult;
  window.__gpHideResult = hideResult;
  restartBtn == null || restartBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    dismissedForRuntime = null;
    hideResult(false);
    seek(0);
    setPlaying(true);
  }, {
    capture: true
  });
  /* Keep the overlay out of the way when replaying, seeking back, changing chart or mode. */
  const baseSetPlaying = setPlaying;
  setPlaying = function (v) {
    if (v) hideResult(false);
    return baseSetPlaying(v);
  };
  const baseSeek = seek;
  seek = function (t) {
    const n = Number(t) || 0;
    if (n < (state.duration || 0) - .001) {
      dismissedForRuntime = null;
      hideResult(false);
    }
    return baseSeek(t);
  };
  const basePrepare = prepare;
  prepare = function (...a) {
    dismissedForRuntime = null;
    hideResult(false);
    return basePrepare(...a);
  };
  if (typeof setAppMode === 'function') {
    const baseMode = setAppMode;
    setAppMode = function (mode) {
      if (mode !== 'play') hideResult(false);
      return baseMode(mode);
    };
  }
  /* The inner gameplay render finishes all remaining judgement updates first; only then
     read the score.  This also handles charts without an audio file. */
  const baseRender = render;
  render = function () {
    const ret = baseRender();
    if (state.appMode === 'play' && state.runtime && dismissedForRuntime !== state.runtime && !state.playing && state.duration > 0 && state.currentTime >= state.duration - .001 && !overlay.classList.contains('show') && !showQueued) {
      showQueued = true;
      queueMicrotask(() => {
        showQueued = false;
        showResult();
      });
    }
    return ret;
  };
  (_els$audioPlayer = els.audioPlayer) == null || _els$audioPlayer.addEventListener('ended', () => {
    if (state.appMode !== 'play' || !state.runtime) return;
    state.currentTime = state.duration || state.currentTime;
    render();
    queueMicrotask(showResult);
  });
  window.__scoreResultSelfTest = function () {
    const f = window.calculateScore,
      fail = [];
    const ok = (x, m) => {
      if (!x) fail.push(m);
    };
    if (typeof f !== 'function') return {
      ok: false,
      failures: ['calculateScore missing']
    };
    const ae = f(['e', 'e']);
    ok(ae.finalScore === 1010000, 'all Exact => 1010000');
    const ap = f(['p', 'p']);
    ok(ap.finalScore === 1000000, 'all Perfect => 1000000');
    const mix = f(['e', 'p', 'g', 'n', 'b', 'm']);
    ok(mix.counts.e === 1 && mix.counts.p === 1 && mix.counts.g === 1 && mix.counts.n === 1 && mix.counts.b === 1 && mix.counts.m === 1, 'judge mapping');
    return {
      ok: !fail.length,
      failures: fail
    };
  };
})();
