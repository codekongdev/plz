# plz
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

这里收录了 codekongdev 为 Claude Code 和 Codex 编写的 AI 编程代理技能。技能采用 `plz-<task>` 的命名方式，读起来就像在对代理说：“请帮我做这件事。”

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-555555.svg) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-555555.svg)

## 技能列表

| 技能 | 生成内容 | 演示 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 用 three.js 3D 模型讲解技术概念和系统结构的单文件 HTML 学习页面。 | [代码沙箱（韩语）](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## 安装

查看可用技能：

```sh
npx skills add codekongdev/plz -l
```

全局安装一个技能：

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

全局安装所有技能：

```sh
npx skills add codekongdev/plz --skill '*' -g
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

## 参与贡献

英文 README 为准。更新翻译时，请保持命令、代码和链接与英文版完全一致。欢迎贡献翻译。在仓库根目录运行 `node scripts/check-readme-translations.mjs`，即可检查各语言版本的一致性和相对链接。

## 许可证

[MIT](LICENSE)。
