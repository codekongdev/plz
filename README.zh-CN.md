# plz
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

这里收录了 codekongdev 为 Claude Code 和 Codex 编写的 AI 编程代理技能。第一个技能 `plz-3d-explain` 可以把任何技术概念做成可交互的 3D 学习页面。

技能采用 `plz-<task>` 的命名方式，读起来就像在对代理说：“请帮我做这件事。”

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html"><img src="skills/plz-3d-explain/docs/demo-desktop.png" alt="桌面端视图：左侧是讲解文字，右侧是容器的 3D 模型" width="800"></a>
</p>
<p align="center"><em>演示第 4 章（韩语）：容器隔离了进程，但仍然共享宿主机内核。</em></p>

## 安装

全局安装一个技能：

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

<details>
<summary>Codex</summary>

在 Codex 中使用时，加上 `-a codex`。以下命令会将技能安装到当前项目的 `.agents/skills/` 目录：

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

</details>

<details>
<summary>查看技能列表或安装全部技能</summary>

查看可用技能：

```sh
npx skills add codekongdev/plz -l
```

全局安装所有技能：

```sh
npx skills add codekongdev/plz --skill '*' -g
```

</details>

<details>
<summary>手动安装（Claude Code）</summary>

手动安装到 Claude Code 时，先克隆仓库，再将 `skills/plz-3d-explain` 复制或以符号链接的方式放到 `~/.claude/skills/plz-3d-explain`。复制命令如下：

```sh
git clone https://github.com/codekongdev/plz.git
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

</details>

也可以查看 [skills.sh 上的 plz-3d-explain 页面](https://skills.sh/codekongdev/plz/plz-3d-explain)。

## 使用方法

安装完成后，直接用日常语言向代理提出需求即可：

- “用 3D 讲解容器隔离是如何工作的。”
- “用 3D 模型演示 TCP 握手的过程。”

## 技能列表

| 技能 | 生成内容 | 演示 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 用 three.js 3D 模型讲解技术概念和系统结构的单文件 HTML 学习页面。 | [代码沙箱（韩语）](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## 参与贡献

欢迎贡献代码和翻译。详情请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)。
