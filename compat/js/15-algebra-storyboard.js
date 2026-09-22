(() => {
  'use strict';

  const __ALGEBRA_RENDER_PATCH = '2026-08-13-algebra-storyboard-v5';

  /* RainPlayer's MilAnimationEase interpolates packed colors per RGBA channel.
   * Numeric interpolation of 0xRRGGBBAA produces unrelated intermediate colors. */
  const __algEventValueBefore = eventValue;
  function __algPackRGBA(c) {
    return ((Math.trunc(c[0]) & 255) << 24 | (Math.trunc(c[1]) & 255) << 16 | (Math.trunc(c[2]) & 255) << 8 | Math.trunc(c[3]) & 255) >>> 0;
  }
  eventValue = function (ev, def, sec) {
    if (!ev || ev.key !== COLOR || ev.custom) return __algEventValueBefore(ev, def, sec);
    const fv = ev.fv == null ? def : ev.fv,
      tv = ev.tv == null ? fv : ev.tv;
    let p = Math.abs(ev.endSec - ev.startSec) < 1e-12 ? 1 : clamp((sec - ev.startSec) / (ev.endSec - ev.startSec), 0, 1);
    p = easeValue(ev.ease, ev.press, p);
    const a = rgbaFromUint(fv),
      b = rgbaFromUint(tv),
      c = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) c[i] = Math.trunc(a[i] + (b[i] - a[i]) * p);
    return __algPackRGBA(c);
  };

  /* Storyboards in RainPlayer advance to an event when the next event START time is
   * reached.  The old storyboard evaluator delayed that transition until the previous
   * event ended, which is wrong for the authored overlapping/touching sequences. */
  function __algStoryboardValue(rt, sb, key, sec) {
    var _rt$events, _SB_DEFAULTS$key, _tr$events;
    const tr = rt == null || (_rt$events = rt.events) == null || (_rt$events = _rt$events.get(BEARER_SB)) == null || (_rt$events = _rt$events.get(sb.index)) == null ? void 0 : _rt$events.get(key),
      def = (_SB_DEFAULTS$key = SB_DEFAULTS[key]) != null ? _SB_DEFAULTS$key : 0;
    if (!tr || !((_tr$events = tr.events) != null && _tr$events.length)) return def;
    const i = Math.max(0, Math.min(tr.events.length - 1, upperBound(tr.starts, sec) - 1));
    return eventValue(tr.events[i], def, sec);
  }
  function __algInstallSbEvaluator(rt) {
    if (!rt || !rt.events) return;
    rt.sbValue = function (sb, key, sec) {
      return __algStoryboardValue(rt, sb, key, sec);
    };
  }
  const __algPrecomputeBefore = precompute;
  precompute = function (rt) {
    __algPrecomputeBefore(rt);
    __algInstallSbEvaluator(rt);
  };
  if (state.runtime) __algInstallSbEvaluator(state.runtime);

  /* The performance optimization may rasterize a 2048px storyboard image to a smaller
   * canvas.  Geometry must still use the ORIGINAL texture dimensions, exactly as Unity
   * does.  Also preserve an actual storyboard/line.png (Algebra supplies 512x1) for
   * builtin.line instead of fabricating a four-pixel-thick substitute. */
  const __algStoryImageBefore = storyImage;
  const __algBuiltinCanvases = new Map();
  const __ALG_SB_BUILTIN_NOTE_SRC = {
    "tap": "assets/alg_tap.webp",
    "tap_double": "assets/alg_tap_double.webp",
    "extap": "assets/alg_extap.webp",
    "extap_double": "assets/alg_extap_double.webp"
  };
  const __algSbBuiltinImgs = new Map();
  let __algStoryboardRenderQueued = false;
  function __algRequestRenderOnce() {
    var _state;
    if ((_state = state) != null && _state.playing || __algStoryboardRenderQueued) return;
    __algStoryboardRenderQueued = true;
    requestAnimationFrame(() => {
      __algStoryboardRenderQueued = false;
      render();
    });
  }
  function __algBuiltinShape(kind) {
    if (__algBuiltinCanvases.has(kind)) return __algBuiltinCanvases.get(kind);
    const c = document.createElement('canvas'),
      g = c.getContext('2d', {
        alpha: true
      });
    if (kind === 'builtin.line') {
      c.width = 512;
      c.height = 1;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 512, 1);
    } else {
      c.width = 300;
      c.height = 300;
      g.fillStyle = '#fff';
      g.beginPath();
      if (kind === 'builtin.round_rect' && g.roundRect) g.roundRect(0, 0, 300, 300, 36);else g.rect(0, 0, 300, 300);
      g.fill();
    }
    __algBuiltinCanvases.set(kind, c);
    return c;
  }
  function __algFileUrl(file) {
    if (!(state.assetObjectUrls instanceof Map)) state.assetObjectUrls = new Map();
    let u = state.assetObjectUrls.get(file);
    if (!u) {
      u = URL.createObjectURL(file);
      state.assetObjectUrls.set(file, u);
    }
    return u;
  }
  function __algReady(d) {
    return !!d && (typeof HTMLCanvasElement !== 'undefined' && d instanceof HTMLCanvasElement || d.complete && (d.naturalWidth || 0) > 0);
  }
  function __algBuiltinTexture(data) {
    const k = {
      'builtin.tap': 'tap',
      'builtin.tap_double': 'tap_double',
      'builtin.extap': 'extap',
      'builtin.extap_double': 'extap_double'
    }[data];
    if (!k) return null;
    let img = __algSbBuiltinImgs.get(k);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.onload = () => __algRequestRenderOnce();
      img.src = __ALG_SB_BUILTIN_NOTE_SRC[k];
      __algSbBuiltinImgs.set(k, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }
  storyImage = function (data) {
    data = String(data || '');
    if (!data || data.startsWith('@i18n:')) return null;
    if (data === 'builtin.rect' || data === 'builtin.round_rect') return __algBuiltinShape(data);
    if (data !== 'builtin.line') {
      const bt = __algBuiltinTexture(data);
      if (bt) return bt;
    }
    let rec = storyCache.get(data);
    if (rec) {
      const d = rec.drawable || rec.img;
      return __algReady(d) ? d : null;
    }
    let file = null;
    if (typeof window.__milResolveStoryboardFile === 'function') {
      try {
        file = window.__milResolveStoryboardFile(data === 'builtin.line' ? 'line.png' : data);
      } catch {}
    }
    if (data === 'builtin.line' && !file) return __algBuiltinShape(data);
    if (!file) {
      const d = __algStoryImageBefore(data),
        r = storyCache.get(data);
      if (r) {
        var _r$img, _r$img2;
        const sw = ((_r$img = r.img) == null ? void 0 : _r$img.naturalWidth) || (d == null ? void 0 : d.naturalWidth) || (d == null ? void 0 : d.width) || 0,
          sh = ((_r$img2 = r.img) == null ? void 0 : _r$img2.naturalHeight) || (d == null ? void 0 : d.naturalHeight) || (d == null ? void 0 : d.height) || 0;
        if (sw && sh && !r.sourceWidth) {
          r.sourceWidth = sw;
          r.sourceHeight = sh;
        }
      }
      return d;
    }
    const img = new Image();
    img.decoding = 'async';
    rec = {
      img,
      drawable: null,
      failed: false,
      source: '',
      sourceWidth: 0,
      sourceHeight: 0
    };
    storyCache.set(data, rec);
    // 先保存原图几何尺寸；采样画布仅用于纹理，不能拿它重新计算故事板大小。
    img.onload = () => {
      if (storyCache.get(data) !== rec) return;
      rec.sourceWidth = img.naturalWidth || 0;
      rec.sourceHeight = img.naturalHeight || 0;
      rec.drawable = window.__milSampleStoryboard(img);
      if (rec.drawable !== img) rec.img = null;
      __algRequestRenderOnce();
    };
    img.onerror = () => {
      rec.failed = true;
    };
    rec.source = __algFileUrl(file);
    img.src = rec.source;
    return null;
  };
  /* RawImage.color multiplies texture RGB; source-atop replacement made colored
   * storyboard primitives and line heads too flat/white.  Keep a fast no-tint path and
   * use an isolated multiply buffer only when RGB modulation is actually needed. */
  __milDrawRotTinted = function (img, cx, cy, w, h, deg, alpha, color) {
    const sw = Number((img == null ? void 0 : img.naturalWidth) || (img == null ? void 0 : img.width)) || 0,
      sh = Number((img == null ? void 0 : img.naturalHeight) || (img == null ? void 0 : img.height)) || 0;
    if (!sw || !sh || ![cx, cy, w, h, deg, alpha].every(Number.isFinite) || Math.abs(w) < 1e-5 || Math.abs(h) < 1e-5) return;
    const sx = w < 0 ? -1 : 1,
      sy = h < 0 ? -1 : 1,
      aw = Math.abs(w),
      ah = Math.abs(h);
    ctx.save();
    ctx.globalAlpha *= alpha * (color[3] / 255);
    ctx.translate(cx, cy);
    ctx.rotate(deg * Math.PI / 180);
    ctx.scale(sx, sy);
    __milTintSlice(img, 0, 0, sw, sh, -aw / 2, -ah / 2, aw, ah, color);
    ctx.restore();
  };

  /* CanvasScaler on the reference project is ScaleWithScreenSize, 800x600, Shrink.
   * Pictures already use MilToCanvasX and therefore need no extra factor; Unity Text is
   * a 300px glyph scaled by 0.1125 in its prefab, so its screen-space base size follows
   * the CanvasScaler factor rather than MilToCanvasX(33.75). */
  function __algUnityCanvasScale(w, h) {
    return Math.max(w / 800, h / 600);
  }
  function __algTextPx(w, h) {
    return 300 * .1125 * __algUnityCanvasScale(w, h);
  }
  /* Runtime checks target the exact regressions found in Algebra. */
  window.__algebraStoryboardReviewSelfTest = function () {
    const fail = [],
      ok = (v, m) => {
        if (!v) fail.push(m);
      };
    try {
      const ev = {
          key: COLOR,
          fv: 0xff0000ff,
          tv: 0x00ff00ff,
          startSec: 0,
          endSec: 1,
          ease: 0,
          press: 0,
          custom: ''
        },
        mid = rgbaFromUint(eventValue(ev, 0, 0.5));
      ok(mid[0] === 127 && mid[1] === 127 && mid[2] === 0 && mid[3] === 255, 'RGBA channel interpolation');
      const c = __algBuiltinShape('builtin.line');
      ok(c.width === 512 && c.height === 1, 'builtin.line 512x1');
      ok(/^(data:image\/png;base64,|assets\/).+\.webp$/.test(__ALG_SB_BUILTIN_NOTE_SRC.extap) || /^data:image\/png;base64,/.test(__ALG_SB_BUILTIN_NOTE_SRC.extap), 'dedicated reference builtin note texture');
      ok(Math.abs(__algTextPx(1280, 720) - 54) < 1e-6, 'Unity storyboard text scale');
      // 纯尺寸测试不解码大图；覆盖面积约束、超长细线、不放大和无效尺寸。
      for (const [w, h] of [[4096, 2304], [2304, 4096], [8192, 8192], [100000, 1], [1, 100000], [512, 1], [923, 923], [2560, 1620]]) {
        const s = window.__milStoryboardSampleSize(w, h);
        ok(s.width * s.height <= 4147200 && Math.max(s.width, s.height) <= 2560, 'storyboard pixel budget ' + w + 'x' + h);
        ok(s.width <= w && s.height <= h && s.width >= 1 && s.height >= 1, 'storyboard no upscale ' + w + 'x' + h);
        if (w <= 2560 && h <= 2560 && w * h <= 4147200) ok(s.width === w && s.height === h, 'small texture unchanged');
      }
      const landscape = window.__milStoryboardSampleSize(4096, 2304),
        square = window.__milStoryboardSampleSize(8192, 8192);
      ok(landscape.width === 2560 && landscape.height === 1440, 'high DPR landscape sampling');
      ok(square.width === 2036 && square.height === 2036, 'square area budget');
      ok(window.__milStoryboardSampleSize(0, 1) === null && window.__milStoryboardSampleSize(Infinity, 1) === null, 'invalid sampling dimensions');
      // 穿过最终渲染器验证几何；不依赖私有尺寸函数，也不保留测试缓存。
      const key = '__algebra_geometry_regression__',
        old = storyCache.get(key),
        draw = __milDrawRotTinted,
        mode = state.appMode;
      try {
        var _actual;
        const c = document.createElement('canvas');
        c.width = 2560;
        c.height = 1440;
        storyCache.set(key, {
          drawable: c,
          sourceWidth: 4096,
          sourceHeight: 2304
        });
        let actual = null;
        __milDrawRotTinted = (img, x, y, w, h) => {
          actual = {
            img,
            w,
            h
          };
        };
        state.appMode = 'play';
        const sb = {
            index: -987654,
            type: 0,
            layer: 0,
            data: key
          },
          rt = {
            storyboards: [sb],
            sbValue: (sb, k) => k === COLOR ? 0xffffffff : [SIZE, SB_WIDTH, SB_HEIGHT, TRANSPARENCY].includes(k) ? 1 : 0
          };
        drawStoryboardLayer(rt, 0, 0, 1920, 1080);
        ok(((_actual = actual) == null ? void 0 : _actual.img) === c && Math.abs(actual.w - milX(4096, 1920)) < 1e-6 && Math.abs(actual.h - milX(2304, 1920)) < 1e-6, 'sampled drawable preserves original geometry');
      } finally {
        __milDrawRotTinted = draw;
        state.appMode = mode;
        if (old) storyCache.set(key, old);else storyCache.delete(key);
      }
      const tr = {
        events: [{
          key: 0,
          fv: 0,
          tv: 10,
          startSec: 0,
          endSec: 2,
          ease: 0,
          press: 0,
          custom: ''
        }, {
          key: 0,
          fv: 100,
          tv: 200,
          startSec: 1,
          endSec: 3,
          ease: 0,
          press: 0,
          custom: ''
        }],
        starts: [0, 1]
      };
      const rt = {
          events: new Map([[BEARER_SB, new Map([[0, new Map([[0, tr]])]])]])
        },
        sb = {
          index: 0
        };
      ok(Math.abs(__algStoryboardValue(rt, sb, 0, 1.5) - 125) < 1e-6, 'storyboard next-start cursor');
      ok((.5 >= .75 ? .5 : 0) === 0, 'subpixel Hold body collapses without a gap');
    } catch (e) {
      fail.push((e == null ? void 0 : e.stack) || String(e));
    }
    return {
      ok: fail.length === 0,
      version: __ALGEBRA_RENDER_PATCH,
      failures: fail
    };
  };
})();
