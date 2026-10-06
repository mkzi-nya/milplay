# Milplay

Milplay 是一个在浏览器中运行的 Milthm 谱面播放器。它不需要后端，支持桌面和移动端浏览器，可导入谱面、音乐、曲绘、Storyboard 以及 ZIP / 7z / `.milcht` 容器。

## 功能

- Canvas 2D 谱面渲染和 Storyboard 播放
- Tap、Drag、Hold、Fracture / Lightning 判定
- Exact、Perfect、Great、Good、Bad、Miss、连击和计分
- 自动游玩、暂停/跳转、倍速、延迟校准、全屏和低内存模式
- 结算页和 WebM 视频导出（浏览器支持时可用 MP4）
- Milthm JSON、Milize JS、RWC JSON、ZIP、7z、`.milcht`
- Safari 12 兼容构建，触摸输入和 iOS 12 回退布局

## 使用

项目必须通过 HTTP 打开。进入项目目录后运行：

```sh
npm start
```

然后访问 <http://127.0.0.1:8000/>。也可以使用任意静态 HTTP 服务器：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

在页面中一次选择谱面和它的图片、音频；需要保留目录结构时，把资源放进 ZIP。播放时可以使用 `A-Z` 或空格输入，`Esc` 暂停，`Enter` 继续。

## 开发

要求 Node.js 20+。安装依赖并生成 Safari 12 兼容目录：

```sh
npm install
npm run build
```

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm start` | 在本地启动静态服务器 |
| `npm run build` | 生成 `compat/` 兼容版本 |
| `npm run check` | 检查所有源码 JavaScript 语法 |
| `npm test` | 运行 Node 测试套件 |
| `npm run test:benchmark` | 运行本地数据结构基准测试 |

源码使用普通全局脚本，不是 ES Module。`index.html` 中的脚本顺序是运行时依赖的一部分，修改时请保持顺序。目录职责和加载关系见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 目录

```text
assets/        内置音符、特效和评级图片
css/           页面和播放控件样式
js/            播放器源码
compat/        面向 Safari 12 的构建产物
scripts/       构建脚本
tests/         Node 回归测试
docs/          架构与来源说明
```

`compat/` 是生成目录，不要直接修改；修改 `js/` 或 `css/` 后重新运行 `npm run build`。

## 来源与许可

运行时依赖、构建工具和外部代码参考见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

- `fflate`：页面内 ZIP Deflate 回退，随兼容构建发布，MIT。
- `@babel/core` 和 `@babel/preset-env`：只用于生成 Safari 12 兼容代码，不进入浏览器运行时。
- `RainPlayerUnity`：普通音符判定和坐标变换的代码参考。
- `Pluviora`：游玩渲染层顺序的代码参考。

第三方项目的版权和许可归原作者所有；内置图片和音符素材的授权以其原始发布者说明为准。

## 限制

- 浏览器必须支持 Canvas、Blob URL、音频播放和所导入媒体格式。
- 7z 和 `.milcht` 的部分压缩数据需要联网加载解压模块；离线时请先解包，或改用 ZIP。
- 测试覆盖解析、计分和渲染逻辑，不等同于所有浏览器、设备和媒体格式的兼容性保证。
