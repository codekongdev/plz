# plz
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

这里收录了 codekongdev 为 Claude Code 和 Codex 编写的 AI 编程代理技能。第一个技能 `plz-3d-explain` 可以把任何技术概念做成可交互的 3D 学习页面。

技能采用 `plz-<task>` 的命名方式，读起来就像在对代理说：“请帮我做这件事。”

[在线演示](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) · [安装](#安装) · [使用方法](#使用方法) · [技能列表](#技能列表)

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html"><img src="skills/plz-3d-explain/docs/demo-desktop.png" alt="桌面端视图：左侧是讲解文字，右侧是容器的 3D 模型" width="610"></a>
  <img src="skills/plz-3d-explain/docs/demo-mobile.png" alt="手机端画面：上方为 OS 沙箱的 3D 模型，下方为讲解文字" width="176">
</p>
<p align="center"><em>桌面端：韩语演示第 4 章，容器隔离了进程，但仍然共享宿主机内核。手机端：第 8 章，OS 沙箱。英文演示见下方的技能表格。</em></p>

https://github.com/user-attachments/assets/eb09c80d-4260-46b4-ae61-092b9f979167

像下面这样一句话提出需求即可开始，上面的演示就是这类主题之一。示例为英文，用中文提出需求也可以。

```text
Explain how an AI agent code sandbox works in 3D.
```

## 安装

使用 `npx skills` 安装时，需要 **Node.js 22.20 或更高版本**（包含 npm 和 `npx`）、**Git**，以及已配置好的 Claude Code 或 Codex。先在终端中检查：

```sh
node --version
npm --version
git --version
```

执行与你使用的代理对应的命令。以下命令会全局安装 `plz-3d-explain`，供多个项目使用。

Claude Code:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a claude-code -g
```

Codex:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex -g
```

如果只想在一个项目中安装，请在该项目目录中执行对应命令，并去掉 `-g`。Claude Code 使用 `.claude/skills/`，Codex 使用 `.agents/skills/`。如果安装工具要求确认，请按提示操作。

检查所用代理的已安装技能列表：

```sh
npx skills list -g -a claude-code
npx skills list -g -a codex
```

在对应列表中找到 `plz-3d-explain` 即可。如果只安装到了项目中，请在同一项目目录中执行列表命令，并同样去掉 `-g`。

<details>
<summary>查看技能列表或安装全部技能</summary>

查看可用技能：

```sh
npx skills add codekongdev/plz -l
```

全局安装所有技能。如果提示选择代理，请选择你使用的工具。

```sh
npx skills add codekongdev/plz --skill '*' -g
```

</details>

<details>
<summary>手动安装（Claude Code）</summary>

手动安装到 Claude Code 时，先克隆仓库，再将 `skills/plz-3d-explain` 复制或以符号链接的方式放到 `~/.claude/skills/plz-3d-explain`。复制命令如下：

```sh
git clone https://github.com/codekongdev/plz.git
mkdir -p ~/.claude/skills
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

</details>

也可以查看 [skills.sh 上的 plz-3d-explain 页面](https://skills.sh/codekongdev/plz/plz-3d-explain)。

## 使用方法

在需要创建页面的项目中，启动代理的新会话。可以明确指定技能：

- **Claude Code:** `/plz-3d-explain 用 3D 讲解容器隔离是如何工作的。`
- **Codex:** `$plz-3d-explain 用 3D 讲解容器隔离是如何工作的。`

也可以直接用日常语言提出需求：

- “用 3D 讲解容器隔离是如何工作的。”
- “用 3D 模型演示 TCP 握手的过程。”

也可以用英语、韩语或日语提出需求，页面会使用你提问的语言编写。

如果找不到技能，请用上面的列表命令检查代理和安装范围，再启动新会话。仅安装到项目中的技能需要在该项目中使用。如果找不到 `npx` 或出现 Node.js 版本错误，请检查上面的环境要求。

## 工作流程

请求生成页面后，`plz-3d-explain` 分四步完成：

1. **核对资料。** 核对主题或仓库中的资料，记录来源和核实日期，尚未核实的内容会单独标明。
2. **规划章节。** 规划页面要讲解的章节，并为每章设计在模型上展示因果关系的动作。
3. **填写模板。** 把文字和场景填入模板。生成结果是无需构建的单个 HTML 文件。
4. **在浏览器中验证。** 对完成的页面检查控制台错误、标签重叠或越界、横向滚动、自动播放和触摸操作。

## 适用范围与环境要求

- **适用于：** 通过 3D 模型学习技术概念、运行机制或系统结构。
- **不适用于：** 静态架构图或时序图、数据图表、Blender 建模、产品落地页和应用 UI 设计。
- **打开页面时：** 页面通过 CDN 加载 three.js r170 和 Web 字体，因此需要联网。
- **制作页面时：** 需要本地 HTTP 服务器（技能中的示例使用 Python 3）以及代理可用的浏览器自动化工具，例如 Playwright。

安装技能不会同时安装 Python 或浏览器自动化工具。如果缺少这些工具，请在验证前让代理协助准备。生成 HTML 文件并不代表已通过浏览器验证，请查看代理报告中实际执行的检查。

详情请参阅[技能 README](skills/plz-3d-explain/README.md)。

## 技能列表

| 技能 | 生成内容 | 演示 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 用 three.js 3D 模型讲解技术概念和系统结构的单文件 HTML 学习页面。 | [代码沙箱（英语）](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.en.html) · [韩语](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |
| [plz-setup-issues](skills/plz-setup-issues/README.md) | 设置 GitHub 仓库的议题标签、缺陷与功能请求表单和分诊规则。 | — |
| [plz-quiz](skills/plz-quiz/README.md) | 根据资料生成测验，用于学习、检查理解程度和复习错题。 | — |

## 参与贡献

欢迎贡献代码和翻译。详情请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)。
