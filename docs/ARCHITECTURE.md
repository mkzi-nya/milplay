# Architecture

## Runtime

Milplay 由 `index.html` 加载一组普通全局脚本。脚本顺序固定，因为后加载模块会补充或替换前面的运行时行为：

```text
runtime/ios12
assets/builtin-sources -> core/base -> assets/requested-textures
-> render/port -> render/effects -> render/hit-ring -> app/mode-build
-> ui/* -> package/loader -> scoring/score -> gameplay/controller
-> assets/rain-textures -> render/storyboard -> runtime/*
-> render/algebra-storyboard -> performance/* -> results/*
-> export/video -> settings/player
```

## Modules

| 目录 | 职责 |
| --- | --- |
| `js/core` | 状态、DOM、时间轴、谱面归一化、资源和基础渲染 |
| `js/package` | ZIP、7z、`.milcht`、资源匹配和上传批次 |
| `js/render` | 判定线、音符、特效和 Storyboard 绘制 |
| `js/gameplay` | 输入、判定、固定步进和游玩 HUD |
| `js/scoring` | 纯计分状态机和结算公式 |
| `js/performance` | 贴图缓存、低内存策略和活动音符索引 |
| `js/results` | 评级、结算页和键盘操作 |
| `js/runtime` | 全屏、移动端恢复、舞台尺寸和 iOS 兼容 |
| `js/ui` | 播放控件、暂停菜单、延迟校准和进度条 |
| `scripts` | 将源码转译并复制到 `compat/` |

## Build output

开发源码位于 `js/`、`css/` 和 `assets/`。`npm run build` 使用 Babel 将 JavaScript 转译到 Safari 12，并复制 CSS、素材和 `fflate` UMD 文件，随后给本地资源 URL 写入内容哈希，避免旧版 Safari 使用缓存的旧构建。

`compat/` 可以直接作为静态站点发布，但它是生成物。不要手工编辑；修改源码后重新运行 `npm run build`。

## Testing

测试使用 Node 的 `node:test`、VM 和最小 DOM/Canvas 桩，覆盖谱面解析、计分、资源匹配、Storyboard、输入和兼容构建约束。测试不替代真实浏览器中的触摸、音频、GPU 和帧率测试。
