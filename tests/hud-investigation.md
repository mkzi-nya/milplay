# HUD visibility investigation

Status: **implemented for the authored Algebra anomaly marker**. The supplied in-game
recording establishes that visible foreground `beats*.png` cards suppress the play HUD.
Milplay therefore uses those authored cards (beats1–4 and beats1-answer), rather than
the chart name, a black-image filename, or a broad opacity heuristic, to set
`state.hudVisible`. Foreground storyboard ordering remains corrected from Pluviora
source evidence; see the dated findings below.

## Reproduction

Run from milplay with Node 26 (the shipped-chart equality check uses built-in Zstd):

```sh
node --test tests/hud-visibility.test.cjs tests/hud-reference.test.mjs
```

The three visibility acceptance tests cover the real 45s plateau, paused
forward/backward seek, and chart switching. They now pass using the observed
`beats*.png` authored marker. The ordinary opaque storyboard counterexample still
draws the HUD. The DOM pause hit area remains active while its glyph is hidden.

## Evidence

- Executing the real `milthm-archive/code/chart/js/Special_Algebra.js` yields only
  binding kinds 0/1/2 and no negative target indices. Metadata has `UITheme: 0`
  and no visibility property. SDK `src/enum.ts` defines Line/Note/Storyboard;
  `docs/milthm-beatmap.schema.json:389` describes -1 as unbound/skipped.
- The shipped `milthm_unpack/Assets/Beatmaps/Runtime/(Special)Algebra - Function
  Phantom.bytes` is Zstd. Its decompressed script equals the archive script,
  eliminating a missing-data difference between those two local copies.
- `beats1.png` is storyboard index 74, layer 2. Its transparency fades in on
  beats 127-128 and out on 143-144. At start 1.355s and BPM 177, this is
  44.406-44.745s and 49.8296-50.1686s. Both 45s and 49s have alpha 1.
  This only identifies the regression interval, not a HUD trigger.
- Directly executing the supplied MilLune WASM at 40/45/49/51s records pause
  alpha 0.4, progress alpha 1, combo label and score alpha 255/255, with HUD
  callbacks after the beats1 storyboard callback. Its JS callbacks simply use
  these values (`src/h5bind.js:911`, `:918`, `:934`). This reference itself does
  not reproduce the requested hiding and cannot justify adding it.
- The WASM's embedded `cvtTime(time,bpmId)` reads undefined `bpm`. The reference
  test supplies `var bpm=0` before the unmodified single-BPM chart. Without this
  test-only workaround the loader fails, so empty chart renders are not evidence.
  Originally this test used placeholder texture sizes, which could not establish
  visual occlusion. The updated test uses real ZIP dimensions for black/beats1.
- Game `Assets/AnimationClip/HidePlayUI.anim` animates actual HUD alpha, including
  Combo, Score, PauseBtn, and Pro. `Assets/AnimatorController/UIGroup.controller`
  contains HidePlayUI, HidePlayUI2, HidePlayUI3, and HidePlayUI4. Presence of these
  clips does not supply chart-time trigger conditions.
- `Assets/Scenes/PlayScene.unity:108225` serializes `lstPlayUIVisibility`.
  ForeCanvas is GameObject 152 (`:2853`), Canvas 613 (`:94948`), sorting order 100
  (`:94969`). No established mapping from all authored storyboard layers to HUD
  sorting was recovered, so this alone does not justify reordering the renderer.
- Read-only IL inspection of `Assets/Plugins/Milthm.dll` found
  `Milthm.AlgebraAnomaliesProvider.BuildTimings` (token 0x06000038) has only
  `ldnull; ret`; `Reset` (0x06000036) and `Milthm.Fool.AFVisibility.Awake`
  (0x06001044) have only `ret`. These are exported stub bodies, not working game
  source. Symbol names cannot establish their original behavior.

## Integration contract

`state.hudVisible` is refreshed before every HUD draw, including paused seeks and
chart changes. `window.MilHud.isVisible(sec, rt)` exposes the same pure query. The
pause proxy uses that state only for its glyph; its hit area remains available.
The exact native anomaly provider is still unavailable, so this is intentionally
limited to the directly observed authored `beats*.png` marker family.

## 后续定位结果

- `GamePlayAdapter.PlayUIVisibility` 是静态布尔字段；
  `GamePlayLoops.lstPlayUIVisibility` 也是布尔字段，并非显隐事件列表。
- `AlgebraAnomaliesProvider.BuildTimings()` 返回 `AnomaliesTimings[]`；
  后者有 `StartTime`、`Duration`、`StateFunction`、`Name` 等字段。
  导出的 `BuildTimings` 仍只有 `ldnull; ret`，无法恢复事件时间及回调。
- `UIGroup` 的 `HidePlayUI`、`ShowPlayUI` 动画分别调用
  `WhenHidePlayUI`、`WhenShowPlayUI`。这些片段的时间是局部时间，不能直接
  当作 Algebra 的歌曲时间。HidePlayUI 还会停用暂停对象；用户要求保留命中区，
  因此即使恢复事件表，也应将图标显示与命中处理分开。
- 当前资源中的 `AFVisibility` 挂在主菜单 `LuviaShopBtn`，没有证据说明它
  驱动游玩 HUD。Algebra 的 `UITheme: 0` 是 Dark 主题，不是隐藏开关。
- 指定的本地游戏资源与谱面目录中未找到原始 APK、`libil2cpp.so` 或
  `global-metadata.dat`。继续恢复需要同版本原始代码载体，优先定位
  `AlgebraAnomaliesProvider.BuildTimings/IsEnabled` 和 PlayUIVisibility 的写入者。

画质和暂停交互已独立实现：移动游玩 DPR 上限为 2，画布面积上限 4,147,200
像素；故事板取样长边上限 2560、面积上限相同。双白线图标为 14×18 CSS 像素，
透明命中区为 32×32，触摸需要在该区域 300ms 内连点两次暂停。将
`state.hudVisible` 设为 false 时只隐藏图标，仍可命中；这只是交互契约的测试，
不代表已经恢复了谱面的 HUD 显隐事件。相关 47 项本地回归测试全部通过。

## 2026-09-18: real textures, dimensions, color and foreground order

The supplied video adds the missing runtime evidence: the HUD fades when the
foreground `beats*.png` sequence appears. The implementation uses that sequence
directly, with no chart-title condition, black-image condition, opacity heuristic,
or change from the authored transparency 0.5 to 1.

### Inputs and reference limits

- Real package: `/storage/emulated/0/Download/algebra.zip`, configurable through
  `MILPLAY_ALGEBRA_ZIP`. Its `Special_Algebra.js` equals the archive script after
  trimming; the existing shipped-Zstd equality test also passes.
- `tests/storyboard-assets.cjs` decodes the ZIP's PNG pixels, including PNG row
  filters. It supports the actual RGB/RGBA 8-bit, non-interlaced files and rejects
  unsupported encodings rather than substituting placeholder pixels.
- Pluviora `src/pluviora.cpp:1816-1834` explicitly skips **all picture** storyboards.
  This is documented in its README:96-98 and `doc/architecture.md:40-43`.
  It has no picture natural-dimension/SIZE/WIDTH/HEIGHT normalization to transplant.
  Do not claim its image output reproduces Algebra or establishes black coverage.
  For text it uses `(viewportWidth + viewportHeight) * .025 * SIZE`, then
  WIDTH/HEIGHT axis scaling, versus milplay's
  `33.75 * max(viewportWidth/800, viewportHeight/600) * SIZE` (75 versus 81 at
  1920x1080 and SIZE=1). That existing text-size difference is unchanged.
- Pluviora's `LICENSE` was read: MIT, Copyright (c) 2026 jiangyin14. Its
  `THIRD_PARTY_NOTICES.md` credits an MIT reference, revision
  `0172fcb18b312a826c700a4302402b98d47fa8bd`, Copyright (c) 2026 qaqFei.
  No reference function was copied. The small layer-order correction is based on
  `src/pluviora.cpp:2139-2153`, attributed in the production comment.
- Local MilLune WASM is an additional **different** reference, not Pluviora.
  `hud-reference.test.mjs` now supplies actual black/beats1 PNG dimensions and
  records geometry/color from real execution. Other image sizes remain placeholders;
  this test does not establish a faithful rendering of the entire reference scene.
  The test-only single-BPM workaround described above remains necessary.

### Actual storyboard values

All three have relative X/Y=0, rotation=0, WIDTH=HEIGHT=1 and COLOR=0xffffffff.
Object indices are zero-based, in authored order.

| Object | Layer | Natural size | Position X/Y | SIZE | Alpha 40s | 45s | 49s | 51s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| black #69 | 0 | 1920x1080 | 0/0 | 3 | 0 | 0.5 | 0.5 | 0.5 |
| black #72 | 1 | 1920x1080 | 0/0 | 3 | 0 | 0 | 0 | 0 |
| beats1 #74 | 2 | 1280x720 | 0/80 | 1 | 0 | 1 | 1 | 0 |

At a 1920x1080 viewport, the final milplay renderer gives:

- black: center (960,540), destination 5760x3240, bounds
  [-1920,-1080,3840,2160]. Its RGB PNG is entirely (0,0,0), all 2,073,600 source
  pixels opaque. At 45/49/51s it geometrically covers **all 2,073,600 viewport
  pixels**, with effective alpha **0.5**, not 1. At 40s it is not drawn.
- beats1: center (960,460), destination 1280x720. Only 34,506 of 921,600 source
  pixels have nonzero alpha (3.74414%); 17,446 are fully opaque (1.89214%).
  Source nonzero bounds are [75,72,1205,552), projected to
  [395,172,1525,652). At this 1:1 placement, these are 34,506 nonzero-alpha
  viewport samples, about 1.664% of the viewport, **not** a solid rectangle.
  The count is from decoded source pixels and placement, not a browser screenshot;
  scaled/filtered raster coverage on other viewports can differ at edges.

`__targetSbBaseSize` therefore does **not** cause black to fail to cover this
viewport. For ordinary pictures its base is `sourceWidth * viewportWidth / 1920`
by `sourceHeight * viewportWidth / 1920`. SIZE scales both axes, WIDTH and HEIGHT
scale their own axes, with signed dimensions retained. Sampling uses the drawable
pixels but preserves original geometry from `sourceWidth/sourceHeight`; otherwise
`naturalWidth/naturalHeight` take precedence over DOM display dimensions.
These semantics are now covered at landscape and portrait sizes. Existing builtin
normalizations are unchanged; Pluviora supplies no picture oracle for them.

The MilLune WASM at this same viewport reports black base 2328.75x1309.921875,
scale (3,3), hence destination 6986.25x3929.765625; beats1 base/destination
1552.5x873.28125, scale (1,1). Centers match milplay. Both bases are 1.212890625
times milplay's at this viewport. This measured factor is **not** assumed to be
a universal normalization formula or added as an unexplained production constant.
Both black geometries already cover the full viewport.

### Color, alpha and compositing

- milplay interpolates packed RGBA by channel, truncating each interpolated byte,
  then multiplies color alpha by storyboard transparency. White COLOR and alpha
  0.5 produce 127.5/255 in Canvas. RGB tint multiplies the texture's RGB, so the
  black texture stays black; white tint does not turn it into white.
- MilLune reports black packed color 0xffffff7f (127/255) at 45/49/51s, zero alpha
  for the other black, and 0xffffffff for beats1 at 45/49s.
- Pluviora `Color::rgba` (:87-92) rounds normalized channels (`lround`), so its
  color conversion would produce 128/255 for 0.5. Its channel interpolation
  retains floating-point values until packing. This differs from milplay/MilLune
  byte truncation and is documented, not presented as exact parity. Pluviora
  applies this to text storyboards; it does not draw these pictures.
- On an initially white pixel outside other artwork, black at 0.5 leaves 127.5
  before the background dim. The existing milplay dim, 155/255, leaves **50**.
  Thus full geometric coverage still does not imply a pure-black composite.
  Pluviora's separate background dim is 0.8 (:1995-1998), another existing
  difference; it would leave 25.5 in the hypothetical same composite.

### Actual changes and checks

- `js/04-plu-effects.js`: moved layer 2 from before judgement lines to after
  gameplay drawing, immediately before HUD. Layer 0 -> dim -> layer 1 ordering
  and the existing effect/note order remain unchanged. Pluviora places foreground
  after lines, notes and particles, then HUD. This fixes foreground occlusion of
  gameplay but **cannot hide HUD**. Authored order within each layer is preserved.
- `js/16-targeted-perf.js`: replaced the two storyboard alpha `<= .001` rejection
  checks with `<= 0`; faint positive picture/primitive alpha is no longer discarded.
  No geometry constant, alpha value or HUD state was changed.
- `tests/storyboard-render.test.cjs`: persistent tests for real values/pixels,
  viewport coverage, natural versus sampled/display dimensions, independent axis
  scales and flips, relative position/rotation, channel color and alpha, faint
  primitives, foreground/HUD ordering and authored order within a layer.
- `tests/hud-reference.test.mjs`: actual black/beats1 dimensions and assertions
  for both black callbacks' geometry/alpha, package-script equality and HUD order.
- No changes to pause, index, CSS, 01, 10, 09, 12 or 15 were needed. No Mac was used.

Command: `node --test tests/*.test.cjs tests/*.test.mjs hud-progress.test.cjs`.
Historical result before the video evidence: **81 tests, 78 pass, 0 ordinary
failures, 3 existing TODO failures**. The three HUD tests now pass; the shipped
Zstd equality check is skipped only on Node runtimes that do not expose Zstd.
Validation uses local Node VM draw calls, actual PNG decoding and the supplied
MilLune WASM. There was no browser/GPU screenshot comparison or original-game
execution. Game animation/anomaly evidence above still lacks a working trigger;
neither reference justifies moving HUD behind black or fabricating a visibility event.
