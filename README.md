# Milthm 谱面播放器

纯前端、无构建步骤、无运行时依赖安装的本地 Milthm **可玩播放器**。用静态 HTTP 服务器打开 `index.html`，在同一页面上传区导入谱面 / 图片 / 音频 / 压缩包，用 Canvas 2D 渲染，并提供真正的游玩判定：`Exact / Perfect / Great / Good / Bad / Miss`、连击、分数、打击特效、自动游玩、结算页与视频导出。

手序（左右手）功能**已彻底移除**：`js/21-no-hand.js` 已删除，其最终的中性贴图覆盖已并入 `js/16-targeted-perf.js`（`noteTextureKey`）。音符只按语义（类型 / AP / 同押）选择中性贴图。手序开关、相关 DOM 与编辑器检查面板均已从界面和代码路径移除（详见“稳健性”）。

## 运行方式

需要静态 HTTP 服务，无后端、无依赖安装：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# 打开 http://127.0.0.1:8000/
```

保留 `index.html`、`css/`、`js/`、`assets/` 的相对目录关系。

- **必须通过 HTTP**。`file://` 下普通文件导入有时可用，但 Milize JS 依赖的沙箱 `<iframe srcdoc>`、Blob URL、媒体解码、按需 CDN 解压库通常会失败。
- Milize JS 在 `sandbox="allow-scripts"` 的内联 iframe 中执行（非 Worker），需要浏览器允许 `eval` 与沙箱 iframe。
- 7z 与 `.milcht` 的 zstd 条目按需从 jsDelivr 加载解压库；离线时请先解包再导入（`.milcht` 在无网络/无 `import()` 时会明确报“无法加载 zstd 解压库”，不会静默失败）。
- **导入方式：在同一页面上传区一次多选**“谱面 + 图片 + 音频”，或直接拖入 ZIP / 7z。当前**没有**独立的“选择文件夹”入口（未启用 `webkitdirectory`）；需要保留相对路径时请打包为 ZIP。
- 同一次上传会登记为一个资源批次，可在谱面已加载后**补传同名故事板图片**而不会误替换背景/音频。

## 控件与键盘

游玩模式（默认）下可见的控件：

| 控件 | 说明 |
| --- | --- |
| 播放 / 暂停 | 有音频时以音频时钟为准 |
| 画面暂停图标 | 9×12px 细双白线，透明命中区 28×28px，中心与右侧分数对齐；播放时触摸需在原命中区域内双击（两次释放间隔不超过 300ms），暂停后单击恢复；鼠标单击切换。已删除舞台中重复的 HTML 暂停按钮 |
| 进度 | 底部进度条或时间输入框跳转 |
| 暂停时拖动 | 暂停后可直接在**画面顶端白条**上拖动跳转（`js/07-hud-progress.js`；仅暂停且已加载谱面时可用） |
| 倍速 | `rate` 范围 `0.05–8`（受浏览器变速能力限制） |
| 谱面延迟 | 单位秒，`-5–5`；媒体时间 = `max(0, 谱面时间 + 延迟)` |
| 音量 / 背景亮度 | 滑块 |
| 全屏 | 原生全屏；不可用时回退为页面内固定全屏，保留实际横屏／竖屏比例 |
| `1:1` | 重置暂停缩放 |
| 自动游玩 | 开启后按谱面时间判定为 Exact，HUD 显示 AUTOPLAY |
| 音符大小 / 流速 | `noteScale`（0.25–4）、`flowSpeed`（0.1–8） |
| 导出视频 | 录制当前画布为 WebM（支持时 MP4） |

键盘：

- 游玩中：`A`–`Z` 与 `Space` 是**位置无关的轨道输入**（手动游玩；开启自动游玩时无效）。
- `Esc`：第一次暂停；结算显示时先关闭结算；暂停后再按退出游玩全屏。
- `Enter`：暂停且无结算时恢复播放。
- 当前版本**没有方向键绑定**（暂停进度条的键盘操作仅在滑条获得焦点时生效）。

暂停按钮已有独立命中区域：当 `state.hudVisible=false` 时图标隐藏，原区域仍可点击、触摸和获得键盘焦点；字段未提供时默认可见。这只是暂停按钮对显隐状态的支持，**谱面控制 HUD 显隐尚未实现**。Algebra 的 beats1 阶段显隐研究仍阻塞：现有谱面、参考 WASM 与本地 DLL 桩不足以确定真实触发规则，没有按文件名、不透明度或臆测层序添加规则。证据与 3 个未满足的 TODO 验收见 [HUD 调查](tests/hud-investigation.md)。

## 支持的输入格式与限制

文件按扩展名分流（不区分大小写）。`accept` 只是选择器提示，能选中不代表内容一定受支持。

| 类别 | 扩展名 | 实际行为 |
| --- | --- | --- |
| 标准 JSON | `.json`、`.milthm`、`.tjson`、`.txt` | `BPMList`/`NoteList` 结构，按 `FormatVersionCode` 校验与归一化 |
| 开发 JSON | `.json`、`.txt` | `lines[].notes` / `bpms` / `animations` / `storyboardObjects` |
| Milize JS | `.js`、`.mjs`、`.cjs` | 在沙箱 iframe 执行并转 JSON；失败后回退静态 TJSON 扫描（不执行脚本） |
| 容器 | `.milcht` | 读取文件表，提取文本谱面与音频 |
| 图片 | `.png/.jpg/.jpeg/.avif/.webp`（另识别 gif/bmp/svg） | 背景与故事板，取决于浏览器解码 |
| 媒体 | `.ogg/.opus/.mp3/.wav/.flac/.m4a/.aac/.mp4/.webm/.mov` | 由浏览器媒体解码器播放音轨 |
| 压缩包 | `.zip`、`.7z` | 解包后继续分流，可嵌套 |

**标准 JSON（`normalizeMilthm`，`js/01-base.js`）**：`FormatVersionCode` 必须为 `0–9` 整数；`BPMList`、`NoteList` 必须是数组；轨道数取 `LineCount`，缺失回退 `LineList.length`；v1–6 从 BPM 起始时间扣除 `SongOffset`，v7+ 忽略非零 `SongOffset` 并告警；时间戳支持 `[拍,分子,分母(,bpmId)]` 或 `null` + `FromTime/ToTime`；动画 `Data` 0/1/2、`Key` 0–23、`Press` 0–15、`Ease` 0–2；含 `judgeLineList` 的 RWC JSON 只做部分字段映射；校验失败直接报错，不静默改写（AP 非布尔一律按 `false` 处理，是唯一例外）。

**Milize JS 桥（`milizeJsToJson`，`js/01-base.js`）**：沙箱内提供全局 `MilizeBeatmap`（以及 `m`）的 `timing`、`line`、`note`、`animation`、`storyboardObject`、`withProperty`、`withoutProperty`、`env`，以及 `tap/drag/hold/exTap/fake…` 辅助函数与枚举。所有方法都 `bind` 到同一实例，并显式暴露到 `globalThis`/`window`，因此：

- 打包 / 压缩后的谱面（任意别名，如 `var L=MilizeBeatmap,ul=L.timing;`）可以直接引用全局 `MilizeBeatmap`；
- 方法被解绑保存后单独调用（如 `var u0=n0.timing; u0(...)`）仍能写入同一实例；
- 链式调用（`MilizeBeatmap.withProperty("k","v").note(...)`）也受支持。

解析超时为自适应 **4–60 秒**（`4000 + 源码长度×0.025 ms`，上限 60s）。它不是完整游戏 SDK：`stage.width/height` 现在返回实际舞台 CSS 尺寸，独立于 DPR；屏幕尺寸和用户大小／流速也注入环境。窗口变化后重新执行 JS 以更新谱面自己的比例补偿，保留原 `time` 种子；音符身份和时间没有变化时保留已经记录的判定与触点。若谱面根据屏幕尺寸生成了不同音符，则按当前时间重新建立游玩状态。JSON 或从本地自动保存恢复的谱面没有 JS 源码，不重新生成。桥接失败后回退 `staticTjson` 静态扫描。该桥已用 **382 个真实谱面验证 382/382 成功解析**。

**`.milcht`**：解析文件表，取 `chart-data`/`chart`/`beatmap`/`raw-chart-data` 文本条目与 `audio-data`；zstd 条目按需从 jsDelivr 导入 `fzstd@0.1.1`，回退 `zstddec@0.2.0`。不支持游戏内部二进制谱面缓存。

**压缩**：

| 输入 | 依赖与限制 |
| --- | --- |
| ZIP | 内置目录解析；Store 直接读取，Deflate 依赖 `DecompressionStream`；其余压缩方法/加密/分卷条目会被跳过 |
| 7z | 按需从 jsDelivr 加载 `libarchive.js@2.1.0` 及 Worker；受网络与 CSP 影响 |
| milcht zstd | 按需从 jsDelivr 导入 `fzstd@0.1.1`，回退 `zstddec@0.2.0` |

## 判定、分数与结果

### 判定窗口（`js/10-gameplay.js`）

- 窗口：Exact <35ms、Perfect <70ms、Great <105ms、Good <140ms、Bad <155ms，否则为 Miss。按偏移绝对值从最小窗口开始判断，正好落在边界会落到更差的一档。
- `isAlwaysPerfect`（AP）：偏移在 Good 窗口内（`<140ms`）命中即 Exact，否则 Miss。
- 参与普通判定的只有类型 0（Tap/Hold）与类型 1（Drag）；Hold 头尾各计一次；类型 2（Fracture/Lightning）不计入普通判定与分数。
- 闪电有独立的通过／触雷统计，结算显示两者数量；Fake 闪电只渲染，自动游玩按时间通过，跳转和重开会重建状态。碰撞盒依据解包的 `Fracture.prefab` 与 `fracture.asset`。原 DLL 判定方法为空桩，当前采用 **±50 ms 的兼容窗口**；原游戏的准确窗口、Lightning Miss 溢出对 ScoreV3 的惩罚，以及完整通过／爆炸特效仍未恢复。键盘无位置输入会作用于窗口内的闪电。不能将该兼容行为视为原版判定完全一致。
- 手动输入来自指针（支持多指、`pointerrawupdate`）与 `A`–`Z`/`Space`；自动游玩按时间轴顺序判定为 Exact。
- 固定步进 120 Hz；前向卡顿时最多执行 12 步，然后单次扫过跳过的区间补判 Miss，避免主线程死循环。

### 计分（独立模块 `js/09-score.js`）

计分算法参考 `/storage/emulated/0/.ck/mkzi/mkzi-nya.github.io/mil/index.html` + `app.js`（及 `score_search_engine.wasm`），并移植为纯函数模块 `MilScore`。

- 判定权重 `scoreMap` 为百万整数：`e:1000000, p:990000, g:600000, n:300000, b:150000, m:0`。
- 连击分档封顶（`js/09-score.js:6-11`）：`bMax`（基础连击上限 `min(192, max(⌊N·12/50⌋,1))`）、`gCap`、`nCap`、`bCap`、`mCap`。Exact 每步 +2、Perfect +1 累加到 `cur`，封顶 `bMax`；Great/Good 把 `cur` 压到对应 cap，Bad/Miss 归零。另有 `prevLoss` 补偿，保证中途断连后的过程分与参考实现逐行一致。
- **过程分**（`process(st)`）：`⌊acc/N·(0.4+0.6·procCombo/(n·bMax))⌋ + ⌊5000·maxCombo/N⌋ + ⌊(allEP?5000·n/N:0)⌋`。其中 `N` 始终为**整谱判定数**（不是已判定前缀长度），`n` 为已判定数，`procCombo` 为过程连击累计，`allEP` 表示到目前为止只有 Exact/Perfect。HUD 实时显示该过程分。
- **结算分**（`final(st)`）：`⌊acc/N·(0.4+0.6·finalCombo/(N·bMax))⌋ + ⌊5000·maxCombo/N⌋ + (allEP?5000:0)`。`finalCombo` 在末尾连击未满时按 `calc_final_from_totals` 做尾部修正。
- HUD 用增量游标（`score.cursor()`）只读取新增判定，空闲帧不重算；结算时对未判定音符补 Miss 的只是副本，不会污染 HUD。
- 全 Exact 满分 **1,010,000**、全 Perfect 满分 **1,000,000**（由 `tests/score.test.cjs` 对 377 音符序列断言）。

### HUD 连击文案（`score.label`）

| 条件 | 文案 |
| --- | --- |
| 自动游玩 | `AUTOPLAY` |
| 手动且未出现 Perfect 以下判定 | `ALL PERFECT` |
| 出现 Great/Good 但无 Bad/Miss | `FULL COMBO` |
| 出现 Bad 或 Miss | `COMBO` |

### 结算页

结算布局参考 `参宿四.png`：左上重开与曲名／难度，左侧曲绘，右侧评级／分数／判定条，右上固定 `user`、`REALITY 114.514`；不显示底部基本／详细切换。评级规则来自查分器 `milkloud.js`：R ≥1,010,000，M ≥1,000,000，SS ≥950,000，S ≥850,000，A ≥750,000，B ≥650,000，C ≥600,000，否则 F。图标与 AP/FC 变体取自查分器本地资源，判定条显示 PERFECT 总数（Exact 数）及 GOOD 总数（Great 数）。没有历史最佳记录时不伪造截图中的分数增量。

- 结算页（`js/17-result-page.js`）在歌曲结束或音频 `ended` 时显示，列出分数、准确率以及分组后的 PERFECT（Exact+Perfect）、GOOD（Great+Good）、BAD/MISS，可重开；结果页挂载在舞台内（`js/19-result-stage.js`），全屏与旋转时保持位置。
- 视频导出（`js/20-video-export.js`）用 `MediaRecorder` + `canvas.captureStream(60)` 录制当前画布 backing-store 分辨率，包含 HUD/特效、不含 DOM 控件；音频轨来自媒体元素的 `captureStream`（若可用）。

## 资源与故事板匹配

- **背景**：优先 `IllustrationFile`（别名 `illustrationFile`/`background`）；缺失时在包内按 `illustration/background/cover/bg` 命名挑选，再取排序后第一张图；多图且无指定时不擅自选择并给出警告。
- **音频**：优先 `AudioFile`（别名 `audioFile`/`music`）；缺失时按 `audio/music/song/bgm` 命名挑选，否则取排序后第一首。
- **故事板**：存在 `storyboard/` 或 `storyboards/` 目录时该目录优先，按同 basename 解析（`foo.asset` / `foo.meta` 会映射到同名图片，`.asset/.meta` 不会直接交给 `<img>`）。
- **路径归一化**：反斜杠、URI 解码、Unicode NFC；先精确路径（有冲突则跳过），再大小写不敏感（仅唯一时），最后仅在 basename 唯一时回退；有歧义时给出诊断而非乱选。
- **上传批次库**：每个用户上传批次独立登记。解析顺序为“从新到旧”，采用**第一个在该批次内唯一命中的**文件；若最新批次对某个键有歧义，会**跳过该键并继续向更早批次回退**，绝不返回任意重复项。批次内先后顺序与包内解析一致：精确路径 → 精确 basename → 大小写不敏感路径 → 折叠名。
- **对象 URL 生命周期**：资源与故事板 blob URL 都登记在可枚举的表中；加载新谱面/资源时 `__milRevokePackageAssets` 会同时释放这些 URL 并清空故事板缓存，避免跨包泄漏（`js/15-algebra-storyboard.js` 已协调该路径）。
- **内置图元**：`builtin.rect` / `builtin.round_rect` / `builtin.line` 程序化生成；`builtin.tap` 等复用玩法贴图。内置贴图由 `js/builtin-sources.js` 映射到 `assets/*.webp`，无需上传。

## 渲染顺序

`RENDER_LAYER_ORDER`（`js/01-base.js`）与 `js/03-plu-render.js` 的参考顺序为：

```text
illustration -> storyboard layer 0 -> black mask -> storyboard layer 1
-> line -> hold -> tap -> drag/fracture -> storyboard layer 2 -> combo -> distorted storyboard
```

游玩模式最终生效的是 `js/04-plu-effects.js` 的 `render`（被 `js/10-gameplay.js` 捕获为 `gpRenderBase`，再由 `js/17-result-page.js` 包一层）。前景顺序已对照 Pluviora 修正：

```text
背景 -> storyboard layer 0 -> 背景调暗 -> storyboard layer 1
-> 打击特效 -> 音符 -> 判定线 -> storyboard layer 2 -> HUD -> 变形故事板
```

layer 2 不再被错误地画到音符下面；判定线在音符之后合成，note 到达终点时线会从其上方穿过。该修复不会自动隐藏 HUD：Pluviora 的前景之后仍绘制 HUD，且其图片故事板支持不完整，不能据此宣称完整还原游戏。Algebra 在 45–49 秒的背景 black 已覆盖全屏，但谱面 alpha 为 0.5；beats1 图片大部分透明，因此这两者不会自然合成为纯黑并抹去 HUD。没有将 alpha 强改为 1，也没有按图片名隐藏 UI。原游戏额外显隐事件仍待恢复，见 [调查记录](tests/hud-investigation.md)。

## 模块一览与加载顺序

普通全局脚本，不是 ES Module。`index.html` 必须先有 DOM，再按固定顺序加载；脚本间存在“后加载覆盖先加载”的补丁链，**不要重排、不要加 `async`/`defer`**。

```text
builtin-sources -> 01-base -> 02 -> 03 -> 04 -> 05 -> 06 -> 07-hud-progress
-> 07-play-controls -> 08-hud-pause -> 08-play-enlarged -> 09-package -> 09-score -> 10-gameplay -> 11 -> 12
-> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20
-> 21-stage-environment
```

| 文件 | 职责 |
| --- | --- |
| `js/builtin-sources.js` | 内置贴图路径映射 |
| `js/01-base.js` | DOM/状态、时间轴与缓动、`normalizeMilthm`/RWC、`makeRuntime`/`precompute`、资源解析、解包、Milize JS 沙箱桥、基础渲染与内置自检、上传/本地恢复、空值保护 |
| `js/02-requested-textures.js` | 语义贴图选择、上传资源批次库与歧义回退、同名故事板补齐 |
| `js/03-plu-render.js` | 参考实现兼容层（`referenceMode`）：缓动/积分、事件编译与分桶索引、线/音符几何、参考渲染顺序、`__renderPortSelfTest` |
| `js/04-plu-effects.js` | 自定义缓动数组、活动桶索引、游玩模式合成顺序、HUD |
| `js/05-plu-hitring.js` | `hit_ring` 的 Canvas2D 移植、粒子参数与贴图策略、着色环缓存 |
| `js/06-mode-build.js` | 模式构建版本标记（占位） |
| `js/07-hud-progress.js` | 暂停时画面顶端白条进度控件（`createHudProgress`，提供 `sync()`） |
| `js/07-play-controls.js` | 音符大小/流速控件同步、接入并同步 `hudProgress` |
| `js/08-hud-pause.js` | 小双白线暂停按钮、触摸双击、独立命中区域与显隐状态同步；不提供谱面 HUD 显隐规则 |
| `js/08-play-enlarged.js` | 页面内放大/缩小的全屏回退模式 |
| `js/09-package.js` | ZIP 结构识别、资源匹配、故事板目录解析、最终 `loadFiles` |
| `js/09-score.js` | 纯计分模块 `MilScore`：`create/extend/process/final/snapshot/calculate/cursor/label`，参考 `mil/app.js` + WASM |
| `js/10-gameplay.js` | 游玩判定、分数/连击/准确率、自动游玩、指针/键盘输入、HUD、120Hz 固定步进；`window.calculateScore=MilScore.calculate` |
| `js/11-rain-textures.js` | 内置 Hold 头/体/尾与兜底贴图数据 |
| `js/12-storyboard-final.js` | 故事板按图层缓存与绘制（中间层） |
| `js/13-fullscreen.js` | 原生全屏、方向锁定、固定全屏回退 |
| `js/14-mobile-continuity.js` | 系统/全屏挂起后恢复媒体播放 |
| `js/15-algebra-storyboard.js` | Algebra 专项：颜色按通道插值、故事板游标、原始纹理尺寸、故事板下采样、blob URL 回收协调 |
| `js/16-targeted-perf.js` | 中性 `noteTextureKey`、着色缓存切片、活动音符索引、故事板内尺寸修正、状态 UI、最终默认状态、`__targetedReviewSelfTest` |
| `js/17-result-page.js` | 结算页 DOM 与显示/隐藏/重开、`__scoreResultSelfTest` |
| `js/18-result-keys.js` | 结算与暂停的 `Esc`/`Enter` 处理 |
| `js/19-result-stage.js` | 把结算页挂载进舞台内部 |
| `js/20-video-export.js` | `MediaRecorder` + `captureStream` 视频导出 |

> `js/diff-model.js`、`js/21-no-hand.js` 均已删除，不存在于仓库。`index.html` 中亦不再引用。

## 稳健性与回归修复

- 游玩模式不再包含编辑/检查/难度面板；`js/01-base.js` 对已移除元素（如 `restoreBar`、`infoAutosave` 等）的读取与事件绑定都加了 `?.` / `if(els.x)` 保护，即使元素缺失，加载、播放与结算仍不抛错。
- 故事板对象 URL 之前存在跨包泄漏（私有 `WeakMap` 无法被 `__milRevokePackageAssets` 枚举）；现改为可枚举表并在同一回收路径中释放、同步清空 `storyCache`，新包加载不会复用失效 URL。
- 上传资源歧义解析由“最新批次歧义即返回 null”改为“跳过歧义键、回退到更早唯一批次”，与注释和包内解析语义一致。

## 移动端与性能

- 游玩画布 DPR 为 `min(devicePixelRatio, 2)`，再按总像素 **4,147,200（4.1472MP）** 缩放并向下取整，不因触屏或重谱降低该预算。编辑模式保留原有分档：触屏重谱 1、轻量 1.25；桌面重谱 1.5、轻量 2。重谱判定为「音符 >2500 或故事板 >100」。
- 故事板由 09 提供共享取样策略，09 的 URL/包资源路径和 15 的最终 loader 均调用 `window.__milSampleStoryboard`：**长边不超过 2560、每张总像素不超过 4,147,200**，等比缩小后向下取整（最短边至少 1），不放大小图。4096×2304 现保留为 2560×1440（原触屏重谱为 1024×576）；8192×8192 取样为 2036×2036。原图几何尺寸单独保存在 `sourceWidth/sourceHeight`，最终渲染仍按原尺寸计算布局。
- 图片仍按需加载，不预先解码全部故事板；缓存不随 DPR/窗口变化反复解码，换包继续清空缓存并回收 object URL。下采样后释放缓存中的原图引用，已有 WebP 文件不转换、不重编码。普通背景继续直接绘制原图，受益于提高后的画布 DPR；上述单张取样预算不限制普通背景的原始解码尺寸。
- 着色临时画布（`__milTintSlice`）按目标 backing pixels 与可用纹理尺寸取样，上限为 1,048,576 像素、长边 4096，白色直接绘制。着色故事板仍可能受此独立预算限制。
- 活动音符使用区间树，每个音符仅存一个节点，倒放可查询；取消固定 30 秒提前窗口，避免低速、反向或定位动画音符提前出现时被漏绘。普通判定按 0.25 秒分桶，超过约 64 秒的 Hold 单独索引，特效也采用相同的长 Hold 策略，避免内存随持续时间增长。
- 同一时间的判定线属性复用计算结果；Note 创建顺序去重使用 Set；动画轨道通过预编译的转移边界二分查询，支持重叠事件和任意方向跳转；表达式函数缓存限制为 512 个。
- 图片故事板支持 14–21 号四角坐标动画，以两个裁剪三角形绘制，保留原层次、颜色和负缩放；非变形图片仍走原快速路径。VisibleArea 使用谱面坐标默认值，Speed 按规范线性积分，扩展缓动 11–15 不再被强制截成 Bounce。
- `hit_ring` 着色环按 `textureIndex:color` 键缓存（`__plu100TintedRings`，上限 180 项）；粒子对密集拖键做步长抽稀（`__pluParticleStride`）；HUD 文本按画布宽度缩放。
- 游玩渲染上限 60 Hz（`now-__playLastRender>=15.5`）；**暂停时不重绘**（静态场景不占用主线程与电量）；DOM 控件文本写入限 15 Hz。
- **这些只是降低开销的工程措施，不承诺任何机型或帧率**。复杂故事板、超大压缩包、密集动画、ZIP/JSON 解析与运行时构建仍可能长时间占用主线程。**本仓库没有手机性能数据，也不保证手机 FPS**；已有验证是逻辑/导入层面，不是真机帧率测量。
- 取样预算限制的是单张缓存纹理，不是整包总内存；浏览器首次加载仍可能完整解码原图，再生成采样画布。多张大图、高 DPR、背景原图和着色缓冲会增加内存与绘制成本；极端放大、超长宽比仍可能模糊，尚无真机画质/峰值内存测量。

## 验证

静态语法检查（无需额外依赖）：

```sh
for f in js/*.js; do node --check "$f" || exit 1; done
```

仓库内测试（Node 内置 `node:test`，无需安装依赖）：

| 命令 | 覆盖内容 |
| --- | --- |
| `node --test tests/score.test.cjs` | 以 `mil/app.js` + `score_search_engine.wasm` 为独立 oracle，逐行比对每个前缀的 `process`、各内部状态（`len/acc/procCombo/cur/combo/maxCombo/prevLoss`）与最终结算分；覆盖大批量、游标批量追加/重开/前后跳转/模式切换、稠密追加只读新增判定、以及 `10-gameplay.js`+`16-targeted-perf.js`+结算页的真实接线（HUD 文案、百万单位准确率、结算隔离、AUTOPLAY） |
| `node --test tests/bridge-assets.test.cjs` | 按 `index.html` 顺序加载全部脚本的 DOM/Canvas 伪环境：脚本链可运行、`prepare/seek/render`、已移除标识（`ensureDiffModel`/`normHand`/`assign_hands`）不存在、真实谱面（默认 `Drizzle_Autumn Rain.js`、`Cloudburst_Algebra.js`）解析与运行时数量一致、拖键语义、贴图缓存区分手动 Good、资源 URL 身份/回收、取消选择不登记批次等 |
| `node --test tests/milize-bridge.test.cjs` | Milize JS 沙箱桥接契约（短别名/全名/全局 `MilizeBeatmap`/解绑调用/链式/env/`_note_create_order`）、对打包谱面的识别、超时与上下文隔离、以及真实谱面有界分层抽样（默认 10 个）与指定回归样本（`Sprinkle_Regnaissance.js`、`Cloudburst_Threat - Metropolis.js`、`Cloudburst_Threat - Sky Islands.js`）的解析成功率与数量一致 |
| `node --test hud-progress.test.cjs` | 暂停进度白条的指针拖动比例（含原生竖屏旋转与 CSS 缩放的坐标映射）、越界钳制、捕获/释放、播放时禁用、次级触摸与鼠标右键不能夺走、播放/外部跳转/换谱/换模式结束拖动、键盘方向键/翻页/端点、HTML 接线与 CSS 规则（并断言全仓库不含旧 `fsProgress` 标识） |

页面内置自检钩子（通过 HTTP 打开后，在控制台执行）：

| 钩子 | 内容 |
| --- | --- |
| `window.__milthmFullRenderSelfTest()` | 主套件：旧兼容 + 参考渲染 + 请求贴图行为 |
| `window.__renderPortSelfTest()` | 参考缓动/积分、事件游标、自定义缓动、VisibleArea 默认值 |
| `window.__plu100PatchSelfTest()` | 贴图语义、hit-ring 遮罩、粒子分布 |
| `window.__scoreResultSelfTest()` | 分数算法（全 Exact=1,010,000、全 Perfect=1,000,000、判定映射） |
| `window.__targetedReviewSelfTest()` | 装饰假音符索引、内置图元尺寸、默认状态、手序开关与旧按钮确实已移除 |
| `window.__algebraStoryboardReviewSelfTest()` | RGBA 通道插值、`builtin.line` 尺寸、故事板游标、有界取样（横/竖/方形/细线/小图/无效尺寸）、通过最终渲染器验证采样后仍使用原图几何 |
| `window.__milthmSemanticSelfTest()` | 旧版语义自检。**已知陈旧的失效断言共 9 条**（参考渲染取代旧语义所致），仅作历史参考，不要据此修改 `js/01-base.js` |

**测试限制**：以上测试均为 Node `vm` + 伪造 DOM/Canvas，或页面内逻辑自检，只验证 JS 契约、结构数量与算法正确性；**不做浏览器/手机实测**，不验证像素、真实媒体解码、原生触摸投递或帧率。`tests/harness.js` 是按 `index.html` 顺序加载脚本链的共享测试骨架。

本次有界取样与 geometry 回归断言位于 15 的现有自检中，由 `tests/quality.test.cjs` 调用。可单独运行：

```sh
node --test --test-name-pattern='original semantics' tests/quality.test.cjs
node --test tests/*.test.cjs tests/*.test.mjs hud-progress.test.cjs
```

2026-09-18 更新后的完整测试结果：81 项中 **78 通过、0 普通失败、3 TODO**。旧的故事板取样期望已更新为 2560×1440。新增回归覆盖暂停图标尺寸与重复按钮删除、真实 PNG 黑幕覆盖和透明度、前景顺序。3 个 TODO 是尚未实现的 HUD 显隐验收，不能算通过。测试使用 Node、实际图片解码及参考 WASM；本轮没有浏览器视觉或真实手机帧率测量。
