# Third-party notices

本文档只记录 Milplay 实际运行或构建代码使用的项目。

## Runtime dependency

### fflate

Milplay 将 `fflate` 的 UMD 构建复制到 `compat/js/fflate.js`，作为不支持 `DecompressionStream` 时的 ZIP Deflate 回退。

- Project: <https://github.com/101arrowz/fflate>
- License: MIT
- Copyright: Arjun Barrett

原始许可文本随构建复制到 [`compat/fflate-LICENSE`](compat/fflate-LICENSE)。

7z 导入按需加载 `libarchive.js` 及其 Worker；`.milcht` 中的 zstd 数据按需加载 `fzstd` 或 `zstddec`。这些模块只在对应格式被导入且网络可用时加载。

- [`libarchive.js`](https://github.com/nika-borisova/libarchivejs)，BSD-2-Clause
- [`fzstd`](https://github.com/bokuweb/fzstd)，MIT
- [`zstddec`](https://github.com/yoshihitoh/zstddec)，MIT

## Build dependencies

以下依赖只在构建兼容版本时使用，不会作为独立运行时库加载：

- [`@babel/core`](https://github.com/babel/babel)，MIT
- [`@babel/preset-env`](https://github.com/babel/babel)，MIT

完整版本和传递依赖记录见 [`package-lock.json`](package-lock.json)。

## External code references

以下项目的代码被 Milplay 直接参考：

| 项目 | 用途 | 使用位置 |
| --- | --- | --- |
| [RainPlayerUnity](https://github.com/qaqFei/RainPlayerUnity) | 普通音符判定和坐标变换的代码参考 | `js/gameplay/controller.js` |
| [Pluviora](https://github.com/jiangyin14/Pluviora) | 游玩渲染层顺序的代码参考 | `js/render/effects.js` |

第三方项目的版权和许可仍归原作者所有。本项目不包含这些项目的完整文件。
