/*
 * Rendering compatibility and optimization layer.
 * Source snapshot: main @ 18b1b929c655143b0e1f549d1025271726dd1cb3
 *
 * MIT License
 * Copyright (c) 2026 jiangyin14
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Browser-specific extensions intentionally retained:
 * - picture Storyboard rendering + uploaded same-name resource resolution;
 * - fracture/type=2 support;
 * - EX Tap/Hold reuse ordinary hand-order textures as explicitly requested;
 * - negative Size compatibility and editor/inspection UI.
 */
const __RENDER_PORT_VERSION = '2026-08-08-reference-reference-port-v1';
const __RENDER_SOURCE_COMMIT = '18b1b929c655143b0e1f549d1025271726dd1cb3';
state.referenceMode = true;
state.hitEffects = true;
state.noteScale = 1;
state.flowSpeed = 1.66;
LINE_DEFAULTS[VISIBLE_AREA] = Math.hypot(1920, 1080) * 1.5;

/* ----- Easing implementation (press 0..10, direction 0..2). ----- */
function __pluEaseIn(press, p) {
  switch (Math.max(0, Math.min(10, press | 0))) {
    case 0:
      return p;
    case 1:
      return 1 - Math.cos(p * Math.PI / 2);
    case 2:
      return p * p;
    case 3:
      return p * p * p;
    case 4:
      return p ** 4;
    case 5:
      return p ** 5;
    case 6:
      return p === 0 ? 0 : 2 ** (10 * p - 10);
    case 7:
      return 1 - Math.sqrt(Math.max(0, 1 - p * p));
    case 8:
      return 2.70158 * p ** 3 - 1.70158 * p * p;
    case 9:
      return p === 0 ? 0 : p === 1 ? 1 : -(2 ** (10 * p - 10)) * Math.sin((p * 10 - 10.75) * (2 * Math.PI / 3));
    case 10:
      {
        const q = 1 - p;
        const b = q < 1 / 2.75 ? 7.5625 * q * q : q < 2 / 2.75 ? 7.5625 * (q - 1.5 / 2.75) ** 2 + .75 : q < 2.5 / 2.75 ? 7.5625 * (q - 2.25 / 2.75) ** 2 + .9375 : 7.5625 * (q - 2.625 / 2.75) ** 2 + .984375;
        return 1 - b;
      }
  }
  return p;
}
function __pluEaseOut(press, p) {
  switch (Math.max(0, Math.min(10, press | 0))) {
    case 0:
      return p;
    case 1:
      return Math.sin(p * Math.PI / 2);
    case 2:
      return 1 - (1 - p) ** 2;
    case 3:
      return 1 - (1 - p) ** 3;
    case 4:
      return 1 - (1 - p) ** 4;
    case 5:
      return 1 - (1 - p) ** 5;
    case 6:
      return p === 1 ? 1 : 1 - 2 ** (-10 * p);
    case 7:
      return Math.sqrt(Math.max(0, 1 - (p - 1) ** 2));
    case 8:
      return 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
    case 9:
      return p === 0 ? 0 : p === 1 ? 1 : 2 ** (-10 * p) * Math.sin((p * 10 - .75) * (2 * Math.PI / 3)) + 1;
    case 10:
      return p < 1 / 2.75 ? 7.5625 * p * p : p < 2 / 2.75 ? 7.5625 * (p - 1.5 / 2.75) ** 2 + .75 : p < 2.5 / 2.75 ? 7.5625 * (p - 2.25 / 2.75) ** 2 + .9375 : 7.5625 * (p - 2.625 / 2.75) ** 2 + .984375;
  }
  return p;
}
function __pluEaseInOut(press, p) {
  switch (Math.max(0, Math.min(10, press | 0))) {
    case 0:
      return p;
    case 1:
      return -(Math.cos(Math.PI * p) - 1) / 2;
    case 2:
      return p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    case 3:
      return p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
    case 4:
      return p < .5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2;
    case 5:
      return p < .5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2;
    case 6:
      return p === 0 ? 0 : p === 1 ? 1 : (p < .5 ? 2 ** (20 * p - 10) : 2 - 2 ** (-20 * p + 10)) / 2;
    case 7:
      return p < .5 ? (1 - Math.sqrt(Math.max(0, 1 - (2 * p) ** 2))) / 2 : (Math.sqrt(Math.max(0, 1 - (-2 * p + 2) ** 2)) + 1) / 2;
    case 8:
      return p < .5 ? (2 * p) ** 2 * ((2.5949095 + 1) * 2 * p - 2.5949095) / 2 : ((2 * p - 2) ** 2 * ((2.5949095 + 1) * (2 * p - 2) + 2.5949095) + 2) / 2;
    case 9:
      return p === 0 ? 0 : p === 1 ? 1 : p < .5 ? -(2 ** (20 * p - 10)) * Math.sin((20 * p - 11.125) * (2 * Math.PI / 4.5)) / 2 : 2 ** (-20 * p + 10) * Math.sin((20 * p - 11.125) * (2 * Math.PI / 4.5)) / 2 + 1;
    case 10:
      return p < .5 ? (1 - __pluEaseOut(10, 1 - 2 * p)) / 2 : (1 + __pluEaseOut(10, 2 * p - 1)) / 2;
  }
  return p;
}
function __pluEase(press, direction, p) {
  p = clamp(p, 0, 1);
  switch (Math.max(0, Math.min(2, direction | 0))) {
    case 0:
      return __pluEaseIn(press, p);
    case 1:
      return __pluEaseOut(press, p);
    case 2:
      return __pluEaseInOut(press, p);
  }
  return p;
}

/* The reference Speed integral uses a 128-entry lookup selected by easing direction,
 * not by press. Generate the same three observable rows analytically at the same
 * sample points, then interpolate them consistently. */
const __pluIntegralTables = (() => {
  const rows = [[], [], []];
  for (let i = 0; i < 128; i++) {
    const p = i / 127;
    rows[0].push(p * p / 2);
    rows[1].push(2 / Math.PI * (1 - Math.cos(Math.PI * p / 2)));
    rows[2].push(p < .5 ? 2 / 3 * p ** 3 : p + 2 / 3 * (1 - p) ** 3 - .5);
  }
  return rows;
})();
function __pluEasingIntegral(direction, p) {
  direction = Math.max(0, Math.min(2, direction | 0));
  p = clamp(p, 0, 1);
  const row = __pluIntegralTables[direction];
  if (p === 1) return row[127];
  const cursor = p * 127,
    index = Math.floor(cursor),
    local = p % (1 / 127) * 127;
  return row[index] + (row[index + 1] - row[index]) * local;
}

/* Custom sample arrays are supported. Expressions remain as a
 * browser extension when no sample array is present. */
const __pluEventValueLegacy = eventValue;
eventValue = function (ev, def, sec) {
  if (!state.referenceMode) return __pluEventValueLegacy(ev, def, sec);
  if (ev.fv == null && ev.tv == null) return VIS_KEYS.has(ev.key) ? 0 : def;
  const fv = ev.fv == null ? def : ev.fv,
    tv = ev.tv == null ? fv : ev.tv,
    span = ev.endSec - ev.startSec;
  let p = Math.abs(span) < 1e-12 ? 1 : clamp((sec - ev.startSec) / span, 0, 1);
  if ((ev.press | 0) !== 0) p = ev.press > 10 ? easeValue(ev.ease, ev.press, p, ev.custom) : __pluEase(ev.press, ev.ease, p);
  if (Array.isArray(ev.samples) && ev.samples.length) {
    if (ev.samples.length === 1) return ev.samples[0];
    const intervals = ev.samples.length - 1,
      cursor = clamp(p, 0, 1) * intervals,
      index = Math.min(Math.floor(cursor), ev.samples.length - 1),
      next = Math.min(index + 1, ev.samples.length - 1),
      local = index === ev.samples.length - 1 ? 0 : p % (1 / intervals) * intervals;
    return ev.samples[index] + (ev.samples[next] - ev.samples[index]) * local;
  }
  const linear = fv + (tv - fv) * p;
  if (ev.key === COLOR) return __milColorLerp(fv, tv, p);
  if (ev.custom && String(ev.custom).startsWith('rwc:')) {
    const elapsed = sec - ev.startSec,
      out = evalExpr(String(ev.custom).slice(4), {
        t: elapsed,
        x: elapsed,
        y: linear
      });
    if (Number.isFinite(out)) return out;
  }
  if (ev.valueExpression && ev.custom) {
    const out = evalExpr(String(ev.custom), {
      t: p,
      x: linear,
      y: linear
    });
    if (Number.isFinite(out)) return out;
  }
  return linear;
};
eventIntegral = function (ev, def, sec) {
  const fv = ev.fv == null ? def : ev.fv,
    tv = ev.tv == null ? fv : ev.tv,
    st = ev.startSec,
    ed = ev.endSec,
    span = ed - st;
  if (Math.abs(span) < 1e-12) return sec < st ? -fv * (st - sec) : tv * Math.max(0, sec - st);
  // Milthm Speed is linear irrespective of its serialized easing flags.
  const p = clamp((sec - st) / span, 0, 1),
    integralProgress = p * p / 2;
  let result = span * (fv * p + (tv - fv) * integralProgress);
  if (sec > ed) result += tv * (sec - ed);
  if (sec < st) result -= fv * (st - sec);
  return result;
};
function __pluResolveBpmIndex(reference, bpms) {
  const ref = Number(reference);
  if (!Number.isFinite(ref) || ref < 0) return null;
  if (Number.isInteger(ref) && ref < bpms.length) return ref;
  let found = null,
    ambiguous = false;
  for (let i = 0; i < bpms.length; i++) {
    var _bpms$i$bpm, _bpms$i, _bpms$i2;
    const bpm = Number((_bpms$i$bpm = (_bpms$i = bpms[i]) == null ? void 0 : _bpms$i.bpm) != null ? _bpms$i$bpm : (_bpms$i2 = bpms[i]) == null ? void 0 : _bpms$i2.BPM);
    const tol = Number.EPSILON * Math.max(1, Math.abs(ref), Math.abs(bpm)) * 8;
    if (Number.isFinite(bpm) && Math.abs(bpm - ref) <= tol) {
      if (found != null) ambiguous = true;else found = i;
    }
  }
  return found == null ? null : {
    index: found,
    ambiguous
  };
}
const __pluScopedTimeLegacy = __milScopedTimeToSeconds;
__milScopedTimeToSeconds = function (value, timeline, bpms, bpmScope, scoped) {
  if (!scoped || !state.referenceMode) return __pluScopedTimeLegacy(value, timeline, bpms, bpmScope, scoped);
  let scope = bpmScope;
  if (Number(scope) >= 0) {
    const resolved = __pluResolveBpmIndex(scope, bpms);
    if (resolved != null) scope = typeof resolved === 'number' ? resolved : resolved.index;
  }
  return __pluScopedTimeLegacy(value, timeline, bpms, scope, scoped);
};

/* Strict static n(line, ...) scanner: never executes the companion script. */
function __pluExtractNoteOrder(source) {
  source = String(source || '');
  const out = [],
    isIdent = c => /[A-Za-z0-9_$]/.test(c || '');
  for (let i = 0; i < source.length;) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i++] === q) break;
      }
      continue;
    }
    if (c === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i + 1 < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i = Math.min(i + 2, source.length);
      continue;
    }
    if (c !== 'n' || i > 0 && isIdent(source[i - 1])) {
      i++;
      continue;
    }
    let p = i + 1;
    while (/\s/.test(source[p] || '')) p++;
    if (source[p] !== '(') {
      i++;
      continue;
    }
    p++;
    while (/\s/.test(source[p] || '')) p++;
    const s = p;
    while (/[0-9]/.test(source[p] || '')) p++;
    if (s === p) {
      i++;
      continue;
    }
    const num = Number(source.slice(s, p));
    while (/\s/.test(source[p] || '')) p++;
    if (source[p] !== ',') {
      i++;
      continue;
    }
    if (Number.isSafeInteger(num)) out.push(num);
    i = p + 1;
  }
  return out;
}
function __pluOrderFromScript(chart, source) {
  if (!chart || !Array.isArray(chart.lines)) return null;
  const order = __pluExtractNoteOrder(source),
    total = chart.lines.reduce((a, l) => {
      var _l$notes;
      return a + (((_l$notes = l.notes) == null ? void 0 : _l$notes.length) || 0);
    }, 0);
  if (order.length !== total) return null;
  const cursors = chart.lines.map(() => 0),
    pairs = [];
  for (const li of order) {
    if (li < 0 || li >= chart.lines.length) return null;
    const local = cursors[li]++;
    if (local >= chart.lines[li].notes.length) return null;
    pairs.push([li, local]);
  }
  if (cursors.some((n, i) => n !== chart.lines[i].notes.length)) return null;
  return pairs;
}
const __pluFindChartLegacy = __milFindParseableChart;
__milFindParseableChart = async function (files) {
  var _result$parsed;
  const result = await __pluFindChartLegacy(files);
  const chart = result == null ? void 0 : (_result$parsed = result.parsed) == null ? void 0 : _result$parsed.chart,
    chartFile = result == null ? void 0 : result.file;
  if (chart && chartFile && !/\.(?:js|mjs|cjs)$/i.test(chartFile.name)) {
    const base = __milBasename(chartFile.name).replace(/\.[^.]+$/, '').toLowerCase(),
      scripts = (files || []).filter(f => /\.(?:js|mjs|cjs)$/i.test(f.name) && f !== chartFile),
      best = scripts.find(f => __milBasename(f.name).replace(/\.[^.]+$/, '').toLowerCase() === base) || scripts.find(f => /^beatmap\.(?:js|mjs|cjs)$/i.test(__milBasename(f.name))) || (scripts.length === 1 ? scripts[0] : null);
    if (best) try {
      chart._orderingScript = await best.text();
    } catch {}
  }
  return result;
};

/* Event compilation follows stable (start,end,source-index) order and
 * forward cursor. Browser-only key validation remains in place. */
compileEvents = function (chart, timeline) {
  const bucket = new Map();
  let sourceOrder = 0;
  const totalNotes = (chart.lines || []).reduce((n, l) => n + (l.notes || []).length, 0),
    totalSb = (chart.storyboardObjects || chart.storyboards || []).length;
  const numOrNull = v => {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.trim());
      if (Number.isFinite(n)) return n;
      const e = evalExpr(v);
      return Number.isFinite(e) ? e : null;
    }
    if (typeof v === 'boolean') return v ? 1 : 0;
    return null;
  };
  function addRaw(raw, fallbackI1 = null) {
    var _raw$ease, _ref, _raw$data, _ref2, _raw$key, _ref3, _ref4, _raw$i, _MIL_VALID_ANIMATION, _ref5, _ref6, _raw$bpmId, _ref7, _ref8, _ref9, _raw$fromBeat, _ref10, _ref11, _ref12, _raw$toBeat, _ref13, _ref14, _raw$customEaseArr, _raw$_source, _raw$_source2, _ref15, _ref16, _raw$isCustomEase, _raw$_source3, _raw$_source4, _ref17, _raw$fv, _ref18, _ref19, _ref20, _ref21, _raw$tv, _ref22, _raw$press, _ref23, _raw$valueExpression, _ref24, _raw$customEaseExpres;
    raw = raw || {};
    const eraw = (_raw$ease = raw.ease) != null ? _raw$ease : raw.Ease,
      eobj = eraw && typeof eraw === 'object' ? eraw : {},
      data = int((_ref = (_raw$data = raw.data) != null ? _raw$data : raw.Data) != null ? _ref : raw.bearer_type, 0),
      key = int((_ref2 = (_raw$key = raw.key) != null ? _raw$key : raw.Key) != null ? _ref2 : raw.type, 0);
    const targetRaw = (_ref3 = (_ref4 = (_raw$i = raw.i1) != null ? _raw$i : raw.I1) != null ? _ref4 : raw.bearer) != null ? _ref3 : fallbackI1;
    if (targetRaw == null) return;
    const i1 = int(targetRaw, 0);
    if (!((_MIL_VALID_ANIMATION = __MIL_VALID_ANIMATION_KEYS.get(data)) != null && _MIL_VALID_ANIMATION.has(key)) || i1 < 0) return;
    if (data === BEARER_LINE && i1 >= (chart.lines || []).length) return;
    if (data === BEARER_NOTE && i1 >= totalNotes) return;
    if (data === BEARER_SB && i1 >= totalSb) return;
    const scope = (_ref5 = (_ref6 = (_raw$bpmId = raw.bpmId) != null ? _raw$bpmId : raw.bpm) != null ? _ref6 : raw.BPM) != null ? _ref5 : 0,
      scoped = raw.bpmId != null || raw.bpm != null || raw.BPM != null,
      from = (_ref7 = (_ref8 = (_ref9 = (_raw$fromBeat = raw.fromBeat) != null ? _raw$fromBeat : raw.FromBeat) != null ? _ref9 : raw.startTime) != null ? _ref8 : raw.FromTime) != null ? _ref7 : 0,
      to = (_ref10 = (_ref11 = (_ref12 = (_raw$toBeat = raw.toBeat) != null ? _raw$toBeat : raw.ToBeat) != null ? _ref12 : raw.endTime) != null ? _ref11 : raw.ToTime) != null ? _ref10 : from;
    let ss = __milScopedTimeToSeconds(from, timeline, chart.bpms, scope, scoped && !chart._rwc),
      es = __milScopedTimeToSeconds(to, timeline, chart.bpms, scope, scoped && !chart._rwc);
    const samplesRaw = (_ref13 = (_ref14 = (_raw$customEaseArr = raw.customEaseArr) != null ? _raw$customEaseArr : raw.CustomEaseArr) != null ? _ref14 : (_raw$_source = raw._source) == null ? void 0 : _raw$_source.customEaseArr) != null ? _ref13 : (_raw$_source2 = raw._source) == null ? void 0 : _raw$_source2.CustomEaseArr,
      customEnabled = !!((_ref15 = (_ref16 = (_raw$isCustomEase = raw.isCustomEase) != null ? _raw$isCustomEase : raw.IsCustomEase) != null ? _ref16 : (_raw$_source3 = raw._source) == null ? void 0 : _raw$_source3.isCustomEase) != null ? _ref15 : (_raw$_source4 = raw._source) == null ? void 0 : _raw$_source4.IsCustomEase),
      samples = customEnabled && Array.isArray(samplesRaw) ? samplesRaw.map(Number).filter(Number.isFinite) : [];
    const ev = {
      startBeat: timeline.beatAt(ss),
      endBeat: timeline.beatAt(es),
      startSec: ss,
      endSec: es,
      key,
      fv: numOrNull((_ref17 = (_raw$fv = raw.fv) != null ? _raw$fv : raw.FV) != null ? _ref17 : raw.start),
      tv: numOrNull((_ref18 = (_ref19 = (_ref20 = (_ref21 = (_raw$tv = raw.tv) != null ? _raw$tv : raw.TV) != null ? _ref21 : raw.end) != null ? _ref20 : raw.fv) != null ? _ref19 : raw.FV) != null ? _ref18 : raw.start),
      data,
      i1,
      press: int((_ref22 = (_raw$press = raw.press) != null ? _raw$press : raw.Press) != null ? _ref22 : eobj.press, 0),
      ease: int((_ref23 = typeof eraw === 'object' ? eobj.type : eraw) != null ? _ref23 : 0, 0),
      valueExpression: !!((_raw$valueExpression = raw.valueExpression) != null ? _raw$valueExpression : raw.ValueExpression),
      custom: String((_ref24 = (_raw$customEaseExpres = raw.customEaseExpression) != null ? _raw$customEaseExpres : raw.CustomEaseExpression) != null ? _ref24 : ''),
      samples,
      order: sourceOrder++
    };
    if (es < ss) {
      [ev.startBeat, ev.endBeat] = [ev.endBeat, ev.startBeat];
      [ev.startSec, ev.endSec] = [ev.endSec, ev.startSec];
      [ev.fv, ev.tv] = [ev.tv, ev.fv];
    }
    const k = data + '|' + i1 + '|' + key;
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k).push(ev);
  }
  if (Array.isArray(chart.animations) && chart.animations.length) for (const a of chart.animations) addRaw(a, null);else (chart.lines || []).forEach((line, li) => (line.animations || []).forEach(a => addRaw(a, li)));
  const out = new Map();
  for (const [k, list] of bucket) {
    list.sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec || a.order - b.order);
    const [data, idx, key] = k.split('|').map(Number),
      starts = list.map(e => e.startSec),
      ends = list.map(e => e.endSec),
      floor = [];
    if (key === SPEED) {
      var _NOTE_DEFAULTS$SPEED;
      const def = data === BEARER_LINE ? LINE_DEFAULTS[SPEED] : (_NOTE_DEFAULTS$SPEED = NOTE_DEFAULTS[SPEED]) != null ? _NOTE_DEFAULTS$SPEED : 0,
        firstFrom = list[0].fv == null ? def : list[0].fv;
      let cumulative = starts[0] * firstFrom;
      for (let i = 0; i < list.length; i++) {
        floor[i] = cumulative;
        if (i + 1 < list.length) cumulative += eventIntegral(list[i], def, starts[i + 1]);
      }
    }
    // Each transition requires every previous event to have finished. Prefix maxima
    // preserve overlapping-event semantics while supporting arbitrary seeks in O(log N).
    const transitions = [];
    let threshold = -Infinity;
    for (let i = 1; i < list.length; i++) {
      threshold = Math.max(threshold, list[i - 1].endSec, list[i].startSec);
      transitions.push(threshold);
    }
    const track = {
      events: list,
      starts,
      ends,
      floor,
      transitions,
      current: 0,
      lastTime: Number.NEGATIVE_INFINITY
    };
    if (!out.has(data)) out.set(data, new Map());
    if (!out.get(data).has(idx)) out.get(data).set(idx, new Map());
    out.get(data).get(idx).set(key, track);
  }
  return out;
};
evalTrack = function (track, sec, def, key) {
  if (!track || !track.events.length) return key === SPEED ? sec * def : def;
  const evs = track.events;
  track.current = upperBound(track.transitions, sec);
  track.lastTime = sec;
  const ev = evs[track.current];
  if (key === SPEED) return (track.floor[track.current] || 0) + eventIntegral(ev, def, sec);
  return eventValue(ev, def, sec);
};
const __pluMakeRuntimeLegacy = makeRuntime;
makeRuntime = function (chart, fileName = 'chart.json') {
  if (chart && !Array.isArray(chart._note_create_order) && chart._orderingScript) {
    const restored = __pluOrderFromScript(chart, chart._orderingScript);
    if (restored) {
      chart._note_create_order = restored;
      (chart._warnings || (chart._warnings = [])).push('已按静态 n(...) 顺序恢复 Note 动画索引');
    }
  }
  return __pluMakeRuntimeLegacy(chart, fileName);
};

/* Exact double-bit simultaneous grouping and invariant animation groups. */
function __pluDoubleKey(v) {
  const b = new ArrayBuffer(8),
    d = new DataView(b);
  d.setFloat64(0, Number(v), true);
  return d.getBigUint64(0, true).toString(16);
}
const __pluPrecomputeLegacy = precompute;
precompute = function (rt) {
  __pluPrecomputeLegacy(rt);
  if (!state.referenceMode) return;
  const counts = new Map();
  for (const n of rt.notes) {
    const k = __pluDoubleKey(n.startSec);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  for (const n of rt.notes) {
    n.isMore = (counts.get(__pluDoubleKey(n.startSec)) || 0) > 1;
  }
};

/* Reference VisibleArea unit and exact line geometry. */
transformLine = function (rt, li, sec, w, h) {
  const posX = rt.lineValue(li, POS_X, sec),
    posY = rt.lineValue(li, POS_Y, sec),
    relX = rt.lineValue(li, REL_X, sec),
    relY = rt.lineValue(li, REL_Y, sec),
    center = localToScreen(w, h, milX(posX + relX, w), milY(posY + relY, h)),
    rawRotation = rt.lineValue(li, ROTATION, sec),
    rawScale = rt.lineValue(li, SIZE, sec),
    negativeScale = Number.isFinite(rawScale) && rawScale < 0,
    scale = Math.abs(rawScale),
    rotation = rawRotation + (negativeScale ? 180 : 0);
  return {
    lineIdx: li,
    center,
    scale,
    rawScale,
    absScale: scale,
    rotation,
    rawRotation,
    angle: 90 - rotation,
    transparency: clamp(rt.lineValue(li, TRANSPARENCY, sec), 0, 1),
    bodyAlpha: clamp(rt.lineValue(li, LINE_BODY_ALPHA, sec), 0, 1),
    headAlpha: clamp(rt.lineValue(li, LINE_HEAD_ALPHA, sec), 0, 1),
    wholeAlpha: clamp(rt.lineValue(li, WHOLE_ALPHA, sec), 0, 1),
    flow: rt.lineValue(li, FLOW, sec),
    floor: rt.lineValue(li, SPEED, sec),
    color: rgbaFromUint(rt.lineValue(li, COLOR, sec)),
    visible: rt.lineValue(li, VISIBLE_AREA, sec)
  };
};
function __pluNoteFrame(rt, n, sec, st, w, h) {
  const rawNoteScale = n.hasSize ? rt.noteValue(n, SIZE, sec) : NOTE_DEFAULTS[SIZE],
    noteScale = Math.abs(rawNoteScale);
  if (!Number.isFinite(noteScale) || noteScale * st.scale <= 1e-9) return null;
  const noteRot = (n.hasRot ? rt.noteValue(n, ROTATION, sec) : 0) + (rawNoteScale < 0 ? 180 : 0),
    finalFlow = n.hasFlow ? rt.noteValue(n, FLOW, sec) : st.flow;
  /* A tap/drag continues through the judgement line during its 160 ms fade-out.
     Treating its start time as its terminal floor (and then pinning floorHead to
     zero) froze it on top of the line instead. Holds are different: their head is
     deliberately anchored to the line while their tail contracts, and their floor
     must freeze once the hold has ended. */
  const curFloor = n.isHold && sec > n.endSec ? n.floorEnd : st.floor;
  let floorHead = (n.floorStart - curFloor) * finalFlow * SPEED_UNIT * (state.flowSpeed || 1.66),
    floorTail = (n.floorEnd - curFloor) * finalFlow * SPEED_UNIT * (state.flowSpeed || 1.66);
  if (n.isHold && sec >= n.startSec) floorHead = 0;
  let alpha = (n.hasTrans ? clamp(rt.noteValue(n, TRANSPARENCY, sec), 0, 1) : 1) * st.wholeAlpha;
  if (Number.isFinite(st.visible) && floorHead > st.visible) alpha = 0;
  const posY = n.hasPosY ? rt.noteValue(n, POS_Y, sec) : 0;
  if (n.hasPosY) {
    floorTail -= floorHead;
    floorHead = posY;
    floorTail += floorHead;
  }
  const baseX = (n.hasPosX ? rt.noteValue(n, POS_X, sec) : 0) + (n.hasRelX ? rt.noteValue(n, REL_X, sec) : 0),
    baseY = n.hasRelY ? rt.noteValue(n, REL_Y, sec) : 0,
    center = applyLineWorld(st, w, h, baseX, baseY + floorHead),
    tail = applyLineWorld(st, w, h, baseX, baseY + floorTail),
    visualW = (w + h) * NOTE_SIZE * NOTE_SCALE * (state.noteScale || 1) * st.scale * noteScale;
  return {
    center,
    tail,
    alpha,
    visualW,
    noteRot,
    rotation: -st.rotation - noteRot,
    speedRotation: -st.rotation + (finalFlow < 0 ? 180 : 0),
    scale: st.scale * noteScale,
    finalFlow,
    floorHead,
    floorTail,
    baseX,
    baseY
  };
}
/* Dense drag charts keep thousands of notes "active" for up to LOOKAHEAD seconds
 * (Algebra: 1108 active at t=72, only ~70 on screen).  A note whose line position is
 * far outside the viewport cannot be painted, so reject it before the expensive
 * per-note animation evaluation.  Only static-position, non-hold notes are eligible;
 * the screen center is computed exactly (same math as applyLineWorld) and a generous
 * note-size margin keeps the test conservative.  Play mode only: the editor keeps its
 * full inspect/hit list.  Verified against Algebra: culls 912/1108 at t=72 with zero
 * on-screen false positives. */
function __pluNoteStaticCull(rt, n, sec, st, w, h) {
  if (n.isHold || n.hasPosX || n.hasPosY || n.hasRelX || n.hasRelY || n.hasFlow) return false;
  const curFloor = st.floor;
  let floorHead = (n.floorStart - curFloor) * (st.flow || 0) * SPEED_UNIT * (state.flowSpeed || 1.66);
  if (!Number.isFinite(floorHead)) return false;
  const sx = 0,
    sy = -floorHead * (h / MIL_HEIGHT) * st.scale,
    a = st.angle * Math.PI / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const cx = st.center.x + (sx * c - sy * s),
    cy = st.center.y + (sx * s + sy * c);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
  const noteScale = n.hasSize ? Math.abs(rt.noteValue(n, SIZE, sec)) : NOTE_DEFAULTS[SIZE];
  const halfNote = (w + h) * NOTE_SIZE * NOTE_SCALE * (state.noteScale || 1) * Math.abs(st.scale || 0) * noteScale * .5;
  const margin = Math.max(w, h) * 2 + halfNote;
  return cx < -margin || cx > w + margin || cy < -margin || cy > h + margin;
}
const __pluDrawNoteLegacy = drawNote;
drawNote = function (rt, n, sec, st, w, h) {
  if (!state.referenceMode) return __pluDrawNoteLegacy(rt, n, sec, st, w, h);
  if (state.appMode === 'play' && window.__gpNoteShouldHide != null && window.__gpNoteShouldHide(n, sec)) return;
  if (state.appMode === 'play' && __pluNoteStaticCull(rt, n, sec, st, w, h)) return;
  const frame = __pluNoteFrame(rt, n, sec, st, w, h);
  if (!frame || frame.alpha <= .001) return; /* Preserve requested texture/hand behavior while using reference placement/visibility. */
  /* The reference gate already lives in __pluNoteFrame; the old try/finally only
     cloned `st` per active note without ever reading the clone. */
  {
    const hidden = isItemHidden('note', n.key);
    if (hidden && !state.showHidden) return;
    if (!n.isHold && sec >= n.startSec + NOTE_DISAPPEAR_TIME) return;
    if (n.isHold && sec > n.endSec + HOLD_DISAPPEAR_TIME) return;
    const rawNoteScale = n.hasSize ? rt.noteValue(n, SIZE, sec) : NOTE_DEFAULTS[SIZE],
      noteScale = Math.abs(rawNoteScale),
      noteRot = (n.hasRot ? rt.noteValue(n, ROTATION, sec) : 0) + (rawNoteScale < 0 ? 180 : 0);
    let noteAlpha = frame.alpha;
    if (hidden) noteAlpha *= .45;
    if (n.isHold && sec > n.endSec) noteAlpha *= Math.max(0, 1 - (sec - n.endSec) / HOLD_DISAPPEAR_TIME);
    if (!n.isHold && sec > n.startSec) noteAlpha *= Math.max(0, 1 - (sec - n.startSec) / NOTE_DISAPPEAR_TIME);
    if (noteAlpha <= .001) return;
    const center = frame.center,
      tail = n.isHold ? frame.tail : center,
      noteColor = rgbaFromUint(n.hasColor ? rt.noteValue(n, COLOR, sec) : NOTE_DEFAULTS[COLOR]),
      visualW = frame.visualW,
      key = noteTextureKey(n),
      img = imgFor(key),
      texRot = frame.rotation,
      radius = Math.max(2, visualW * .42);
    if (n.isHold) {
      let dx = tail.x - center.x,
        dy = tail.y - center.y,
        geometricLen = Math.min(8192, Math.hypot(dx, dy));
      if (geometricLen <= 1e-9) {
        const probe = applyLineWorld(st, w, h, frame.baseX, frame.baseY + frame.floorHead + 1);
        dx = probe.x - center.x;
        dy = probe.y - center.y;
        if (Math.hypot(dx, dy) <= 1e-9) {
          dx = Math.cos(texRot * Math.PI / 180);
          dy = Math.sin(texRot * Math.PI / 180);
        }
      }
      const holdAng = Math.atan2(dy, dx),
        capMargin = Math.max(16, visualW * 2),
        minX = Math.min(center.x, tail.x) - capMargin,
        maxX = Math.max(center.x, tail.x) + capMargin,
        minY = Math.min(center.y, tail.y) - capMargin,
        maxY = Math.max(center.y, tail.y) + capMargin;
      if (__milRectOutsideView(minX, minY, maxX, maxY, w, h)) return;
      const holdImg = imgFor(key) || imgFor('hold'),
        srcW = (holdImg == null ? void 0 : holdImg.naturalWidth) || 4036,
        srcH = (holdImg == null ? void 0 : holdImg.naturalHeight) || 1336,
        scale = visualW / srcH,
        cut = Math.max(1, Math.min(srcW / 2 - 1, HOLD_CUT_PADDING)),
        capW = cut * scale,
        rawBodyW = Math.max(0, geometricLen),
        /* Never synthesize a minimum Hold body.  RainPlayer uses the true geometric body length; forcing a ~0.28-note-width center on very short Holds is what can collapse into the bright/white blob seen in dense charts. */bodyW = rawBodyW;
      ctx.save();
      ctx.globalAlpha *= noteAlpha * (noteColor[3] / 255);
      ctx.translate(center.x, center.y);
      ctx.rotate(holdAng);
      const sourceTriple = typeof __rainHoldTripleFor === 'function' ? __rainHoldTripleFor(key) : null,
        sourceReady = sourceTriple && sourceTriple.head.complete && sourceTriple.body.complete && sourceTriple.tail.complete && sourceTriple.head.naturalWidth && sourceTriple.body.naturalWidth && sourceTriple.tail.naturalWidth;
      if (sourceReady) {
        const hw = visualW * sourceTriple.head.naturalWidth / sourceTriple.head.naturalHeight,
          tw = visualW * sourceTriple.tail.naturalWidth / sourceTriple.tail.naturalHeight,
          drawBodyW = rawBodyW >= .75 ? rawBodyW : 0;
        __milTintSlice(sourceTriple.head, 0, 0, sourceTriple.head.naturalWidth, sourceTriple.head.naturalHeight, -hw, -visualW / 2, hw, visualW, noteColor);
        if (drawBodyW > 0) __milTintSlice(sourceTriple.body, 0, 0, sourceTriple.body.naturalWidth, sourceTriple.body.naturalHeight, 0, -visualW / 2, drawBodyW, visualW, noteColor);
        __milTintSlice(sourceTriple.tail, 0, 0, sourceTriple.tail.naturalWidth, sourceTriple.tail.naturalHeight, drawBodyW, -visualW / 2, tw, visualW, noteColor);
      } else if (holdImg && holdImg.naturalWidth) {
        const drawBodyW = bodyW >= .75 ? bodyW : 0;
        __milTintSlice(holdImg, 0, 0, cut, srcH, -capW, -visualW / 2, capW, visualW, noteColor);
        if (drawBodyW > 0) __milTintSlice(holdImg, cut, 0, Math.max(1, srcW - 2 * cut), srcH, 0, -visualW / 2, drawBodyW, visualW, noteColor);
        __milTintSlice(holdImg, srcW - cut, 0, cut, srcH, drawBodyW, -visualW / 2, capW, visualW, noteColor);
      } else {
        ctx.fillStyle = `rgba(${noteColor[0]},${noteColor[1]},${noteColor[2]},.78)`;
        ctx.beginPath();
        ctx.roundRect(0, -visualW * .25, Math.max(1, bodyW), visualW * .5, visualW * .18);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, visualW * .45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      const rr = Math.max(2, visualW * .45);
      if (state.appMode !== 'play') {
        state.visibleHit.push({
          n,
          x: center.x,
          y: center.y,
          r: rr,
          key: n.key,
          type: n.type
        });
        state.inspectHit.push({
          kind: 'note',
          label: 'Note',
          id: n.key,
          hiddenKey: itemKey('note', n.key),
          n,
          x: center.x,
          y: center.y,
          r: rr
        });
      }
      ;
      if (hidden) drawHiddenHalo(center.x, center.y, rr);
      return;
    }
    if (__milRectOutsideView(center.x - visualW * 2, center.y - visualW * 2, center.x + visualW * 2, center.y + visualW * 2, w, h)) return;
    const iw = (img == null ? void 0 : img.naturalWidth) || 100,
      ih = (img == null ? void 0 : img.naturalHeight) || 80,
      hh = visualW * ih / iw,
      drawAng = n.fallbackKind === 'drag' || n.fallbackKind === 'fracture' || key.includes('drag') || key.includes('fracture') ? texRot : texRot + 180;
    if (img && img.naturalWidth) __milDrawRotTinted(img, center.x, center.y, visualW, hh, drawAng, noteAlpha, noteColor);else {
      ctx.save();
      ctx.globalAlpha *= noteAlpha * (noteColor[3] / 255);
      ctx.translate(center.x, center.y);
      ctx.rotate(drawAng * Math.PI / 180);
      ctx.fillStyle = `rgb(${noteColor[0]},${noteColor[1]},${noteColor[2]})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, visualW * .5, visualW * .34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (state.appMode !== 'play') {
      state.visibleHit.push({
        n,
        x: center.x,
        y: center.y,
        r: radius,
        key: n.key,
        type: n.type
      });
      state.inspectHit.push({
        kind: 'note',
        label: 'Note',
        id: n.key,
        hiddenKey: itemKey('note', n.key),
        n,
        x: center.x,
        y: center.y,
        r: radius
      });
    }
    ;
    if (hidden) drawHiddenHalo(center.x, center.y, radius);
  }
};

/* Hit ring and particle model, procedurally seeded to avoid a large
 * per-chart allocation. Hold emission interval is the source 0.01 s. */
function __pluHash32(s) {
  let h = 2166136261 >>> 0;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
let __pluParticleParams;
function __pluParticleColor(p) {
  const q = clamp(p / .75, 0, 1);
  return [142 + (162 - 142) * q, 197 + (66 - 197) * q, 252 + (255 - 252) * q];
}
function __pluParticleAlpha(p) {
  if (p <= 0 || p >= 1) return 0;
  if (p < .128) return p / .128;
  if (p <= .805) return 1;
  return (1 - p) / (1 - .805);
}
let __pluDrawHitRing, __pluDrawOneParticle;
/* Dense drag bursts: each non-hold note emits a fixed burst, so at 72 drags/s dozens of
 * overlapping bursts are redrawn every frame.  Bound the simultaneous work with a
 * deterministic stride frozen per note at precompute time from its local emitter
 * density (js/04) and applied by a stable per-note hash, so sparks never flicker
 * on/off; only dense sections thin from 8 to 4-3 sparks.  Holds keep their full
 * continuous trail. */
function __pluParticleStride(n) {
  return n.__pluParticleStride || 1;
}
function __pluDrawParticles(rt, n, sec, st, w, h) {
  var _matchMedia;
  if (!state.hitEffects || n.isFake || n.type === NOTE_FRACTURE) return;
  const mobilePlay = state.appMode === 'play' && ((navigator.maxTouchPoints || 0) > 0 || (matchMedia == null ? void 0 : (_matchMedia = matchMedia('(pointer:coarse)')) == null ? void 0 : _matchMedia.matches));
  if (!n.isHold) {
    if (sec < n.startSec || sec > n.startSec + .5) return;
    const anchor = __pluAnchorEffectNote(n, n.startSec, w, h, rt);
    if (!anchor || anchor.alpha <= .001) return;
    /* A burst lives inside ~0.35*(w+h)*noteScaling of the note center; if that disc is
     * off-screen no individual particle can be visible. One test replaces up to ten
     * per-particle rect checks at dense-drag densities. */
    const maxR = (w + h) * .5 * anchor.scale * (state.noteScale || 1);
    if (__milRectOutsideView(anchor.x - maxR, anchor.y - maxR, anchor.x + maxR, anchor.y + maxR, w, h)) return;
    const count = mobilePlay ? 8 : 10,
      emission = n.startSec,
      stride = __pluParticleStride(n);
    if (stride <= 1) {
      for (let i = 0; i < count; i++) __pluDrawOneParticle(anchor, n, sec, emission, i, w, h);
      return;
    }
    /* Offset the kept indices by a stable per-note hash so the retained subset still
     * spans the burst instead of always dropping the same angular slots. */
    const phase = __pluHash32(n.key + '|' + n.globalIdx) % stride;
    for (let i = phase; i < count; i += stride) __pluDrawOneParticle(anchor, n, sec, emission, i, w, h);
    return;
  }
  if (sec < n.startSec - .5) return;
  const step = mobilePlay ? .02 : .01,
    from = Math.max(n.startSec, sec - .5),
    to = Math.min(sec, n.endSec);
  if (to < from) return;
  /* The Hold emitter follows the judgement line on every frame. Its initial
   * hit ring still uses the cached impact position. */
  const anchor = __pluEffectLinePoint(n, Math.min(sec, n.endSec), w, h, rt);
  if (!anchor || anchor.alpha <= .001) return;
  const maxR = (w + h) * .5 * anchor.scale * (state.noteScale || 1);
  if (__milRectOutsideView(anchor.x - maxR, anchor.y - maxR, anchor.x + maxR, anchor.y + maxR, w, h)) return;
  const first = Math.max(0, Math.ceil((from - n.startSec) / step - 1e-9)),
    last = Math.floor((to - n.startSec) / step + 1e-9);
  for (let i = first; i <= last; i++) {
    __pluDrawOneParticle(anchor, n, sec, n.startSec + i * step, i, w, h);
  }
}
const __pluTransformLineReference = transformLine;
transformLine = function (rt, li, sec, w, h) {
  return __pluTransformLineReference(rt, li, sec, w, h);
};

/* Rendering parameters are fixed; no debug controls are exposed in the UI. */
state.referenceMode = true;
state.hitEffects = true;
state.noteScale = 1;
state.flowSpeed = 1.66;
window.__renderPortSelfTest = async function () {
  const fail = [],
    ok = (v, m) => {
      if (!v) fail.push(m);
    },
    near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const oldMode = state.referenceMode;
  try {
    state.referenceMode = true;
    ok(near(__pluEasingIntegral(0, 1), .5), 'source integral row 0');
    ok(near(__pluEasingIntegral(1, 1), 2 / Math.PI), 'source integral row 1');
    ok(near(__pluEasingIntegral(2, 1), .5), 'source integral row 2');
    ok(__pluExtractNoteOrder('/*n(9,0)*/ n(1, 0); "n(8,0)"; n(0,1)').join(',') === '1,0', 'static n scanner');
    const overlap = {
        bpms: [{
          start: 0,
          bpm: 120
        }],
        lines: [{
          notes: []
        }],
        animations: [{
          bpmId: 0,
          fromBeat: 0,
          toBeat: 2,
          key: 0,
          fv: 0,
          tv: 20,
          data: 0,
          i1: 0,
          press: 0,
          ease: 0
        }, {
          bpmId: 0,
          fromBeat: 1,
          toBeat: 3,
          key: 0,
          fv: 100,
          tv: 200,
          data: 0,
          i1: 0,
          press: 0,
          ease: 0
        }],
        storyboardObjects: []
      },
      r = makeRuntime(overlap);
    ok(near(r.lineValue(0, POS_X, 1.5), 15), 'overlap event cursor must keep first event until its end');
    ok(near(r.lineValue(0, POS_X, 2.5), 175), 'cursor must advance after first event ends');
    const more = makeRuntime({
      bpms: [{
        start: 0,
        bpm: 120
      }],
      lines: [{
        notes: [{
          bpm: 0,
          startTime: 1,
          endTime: 1,
          type: 0,
          isFake: false,
          isAlwaysPerfect: false
        }, {
          bpm: 0,
          startTime: 1 + 5e-7,
          endTime: 1 + 5e-7,
          type: 0,
          isFake: false,
          isAlwaysPerfect: false
        }]
      }],
      animations: [],
      storyboardObjects: []
    });
    ok(more.notes.every(n => !n.isMore), 'simultaneous grouping must use exact double equality');
    const ce = {
        bpms: [{
          start: 0,
          bpm: 120
        }],
        lines: [{
          notes: []
        }],
        animations: [{
          bpmId: 0,
          fromBeat: 0,
          toBeat: 1,
          key: 0,
          fv: 0,
          tv: 1,
          data: 0,
          i1: 0,
          press: 0,
          ease: 0,
          isCustomEase: true,
          customEaseArr: [3, 5, 9]
        }],
        storyboardObjects: []
      },
      cr = makeRuntime(ce);
    ok(near(cr.lineValue(0, POS_X, .5), 5, 1e-4), 'customEaseArr interpolation');
    ok(LINE_DEFAULTS[VISIBLE_AREA] === Math.hypot(1920, 1080) * 1.5, 'VisibleArea uses Milthm chart coordinates');
  } catch (e) {
    fail.push((e == null ? void 0 : e.stack) || String(e));
  } finally {
    state.referenceMode = oldMode;
  }
  return {
    ok: fail.length === 0,
    version: __RENDER_PORT_VERSION,
    sourceCommit: __RENDER_SOURCE_COMMIT,
    failures: fail
  };
};

/* Preserve legacy regression tests by running them with the previous compatibility
 * switch off, then add the renderer-specific suite. */
const __pluLegacyFullSelfTest = window.__milthmFullRenderSelfTest;
window.__milthmFullRenderSelfTest = async function () {
  var _legacy, _legacy2;
  const old = state.referenceMode;
  let legacy;
  try {
    state.referenceMode = false;
    legacy = await __pluLegacyFullSelfTest();
  } finally {
    state.referenceMode = old;
  }
  const plu = await window.__renderPortSelfTest();
  return {
    ok: !!((_legacy = legacy) != null && _legacy.ok) && plu.ok,
    version: __RENDER_PORT_VERSION,
    legacy,
    reference: plu,
    failures: [...(((_legacy2 = legacy) == null ? void 0 : _legacy2.failures) || []), ...(plu.failures || [])]
  };
};
if (els.infoRender) els.infoRender.textContent = 'Canvas';
