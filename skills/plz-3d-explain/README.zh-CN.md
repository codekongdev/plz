# plz-3d-explain
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

为 Claude Code 和 Codex 编写的技能，用 three.js 3D 模型讲解技术概念和系统结构，生成单文件 HTML 学习页面。

桌面端：第 4 章，容器

![桌面端画面：左侧为讲解文字，右侧为容器的 3D 模型](docs/demo-desktop.png)

手机端：第 8 章，OS 沙箱

<img src="docs/demo-mobile.png" alt="手机端画面：上方为 OS 沙箱的 3D 模型，下方为讲解文字" width="360">

可以直接在浏览器中打开 AI 代理代码沙箱演示的[英文版](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.en.html)或[韩文版](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html)。演示共 10 章，介绍容器、microVM、WASM 和 OS 沙箱的隔离机制。仓库中也提供了示例 HTML（[英文版](assets/example-agent-sandbox.en.html)、[韩文版](assets/example-agent-sandbox.html)）。本技能属于 codekongdev 编写的 [plz](../../README.md) 系列。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-555555.svg) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-555555.svg)

## 安装

全局安装：

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

在 Codex 中使用时，加上 `-a codex`。以下命令会将技能安装到当前项目的 `.agents/skills/` 目录：

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

手动安装到 Claude Code 时，先克隆仓库，再将 `skills/plz-3d-explain` 复制或以符号链接的方式放到 `~/.claude/skills/plz-3d-explain`。复制命令如下：

```sh
git clone https://github.com/codekongdev/plz.git
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

也可以查看 [skills.sh 上的 plz-3d-explain 页面](https://skills.sh/codekongdev/plz/plz-3d-explain)。

## 使用方法

向代理说明想学习的主题，或提供想了解的仓库。以下示例使用了 [SKILL.md](SKILL.md) 中描述的触发方式：

- “用 3D 讲解容器和虚拟机的区别。”
- “用 3D 模型展示 HTTP 请求如何经过服务器到达外部 API。”
- “用 3D 讲解这个仓库中的资源从创建到销毁的过程。”

技能会先核实内容、安排章节，再向[模板](assets/template.html)中填入文字和场景，最后在浏览器中验证成品页面。

## 页面包含什么

- **随滚动切换的场景。** 桌面端左侧显示文字，右侧固定显示 3D 展示区。滚动文字时，展示区会切换到当前章节的场景。
- **点击按钮查看因果过程。** 每章都有按钮，可以播放请求沿路径流动、操作在边界处被阻止等过程，并用文字说明结果。
- **可选的自动播放。** 打开开关后，当前章节的动作会循环播放，每次展示结果后恢复初始状态。默认关闭，浏览器会记住设置。
- **建筑模型式的表现方式。** 使用正交相机、白色模型、墨色轮廓和浅阴影来呈现结构。红色表示动作主体，蓝色表示边界、规则或中介，黄铜色表示数据、资源或材料。拖动可以旋转模型，重置视角可回到初始位置。
- **适配手机的布局。** 竖屏时，展示区固定在上方，文字在下方滚动；横屏时，文字与展示区左右排列。展示区的标题和图例各占一行，与模型区域分开。
- **术语与来源。** 解释专业术语，并在术语表中汇总。列出已核实的来源和核实日期，尚未核实的内容会单独标明。
- **界面文案随页面语言切换。** 按钮、提示和标题会根据 `<html lang>` 切换为英语、韩语、日语或简体中文。其他语言可以在页面中通过覆盖文案来添加，词典中缺失的文案会回退到英语。页面正文使用用户的语言编写。
- **标签与画面检查。** 通过验证钩子检查标签是否重叠或超出显示区域。每章动作结束后都会截图，核对模型状态与结果文字是否一致，同时检查自动播放循环和手机端画面。

## 环境要求与限制

生成结果是单个 HTML 文件，无需构建。页面通过 CDN 加载 three.js r170 和 Web 字体，因此打开时需要联网。

制作页面时，会使用本地服务器和 Playwright 等浏览器自动化工具进行验证，检查控制台错误、标签重叠或越界、横向滚动、自动播放和触摸操作。具体流程见 [SKILL.md](SKILL.md)，验证钩子见[引擎 API](references/engine-api.md)，常见问题见[注意事项](references/gotchas.md)。

手机端只能左右旋转模型。在展示区内上下滑动会滚动页面，左右滑动会旋转模型。不支持上下倾斜或缩放。

展示区较窄时，引擎会自动调整标签位置，但超出调整范围后仍可能重叠。请尽量缩短标签，并检查实际显示效果。

本技能不适用于静态架构图或时序图、数据图表、Blender 建模、产品落地页或应用 UI 设计。

## 个人设置

在安装后的技能目录中，复制[设置示例](references/preferences.example.md)：

```sh
cp references/preferences.example.md references/preferences.md
```

在复制的文件中记录字体、颜色、验证工具、成品 HTML 的保存位置，以及收到的反馈等。已填写的设置优先于 [SKILL.md](SKILL.md) 中的默认值，未填写的项目继续使用默认值。个人设置文件已被 Git 忽略。

## 参与贡献

欢迎贡献代码和翻译。详情请参阅 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 许可证

[MIT](../../LICENSE)。

页面通过 CDN 加载的外部资源不随仓库分发，包括 three.js（MIT）以及 Pretendard、Hahmlet、IBM Plex 字体（SIL OFL）。
