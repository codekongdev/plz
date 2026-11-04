# plz-setup-issues
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

为 GitHub 仓库设置可复用的精简议题分类、议题表单和分诊规则。支持 Claude Code 和 Codex，是 [plz](https://github.com/codekongdev/plz) 的一部分。

## 安装

使用 `npx skills` 安装时，需要 Node.js 22.20 或更高版本（包含 npm 和 `npx`）、Git，以及要使用的 Claude Code 或 Codex。先在终端确认工具可用：

```sh
node --version
npm --version
git --version
```

选择要使用的代理对应的命令。`-g` 表示全局安装，可在多个项目中使用。

Claude Code:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a claude-code -g
```

Codex:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a codex -g
```

如果只在当前项目中使用，请在项目目录中运行上述命令并去掉 `-g`。安装工具会将技能保存到 `.agents/skills/`，选择 Claude Code 时还会创建链接。

查看对应代理的已安装技能列表，确认其中包含 `plz-setup-issues`：

```sh
npx skills list -g -a claude-code
npx skills list -g -a codex
```

如果安装在项目中，检查时也要去掉 `-g`，并在同一项目目录中运行。如果列表中没有该技能，请检查选择的代理和安装范围。如果列表中有但代理无法识别，请在目标项目中启动新的代理会话。

## 使用方法

安装后，在目标仓库中打开代理，指定技能发出请求：

- Claude Code: `/plz-setup-issues 初始化这个仓库的议题管理。`
- Codex: `$plz-setup-issues 初始化这个仓库的议题管理。`

可以只请求生成本地文件，也可以明确要求向指定的 GitHub 仓库应用标签。修改前会检查现有设置，冲突的规则会保留，直到确定解决方案。

## 默认配置

- 5 个类型标签：`type:bug`、`type:feature`、`type:improvement`、`type:maintenance`、`type:docs`。
- 2 个审查标签：`needs-triage` 和 `needs-info`。
- 缺陷与功能请求表单、`.github/ISSUE_TRIAGE.md` 和 `.github/labels.json`。
- P0–P3 优先级：复用现有项目或组织字段；没有时使用 `priority:P0`–`priority:P3` 标签。不会自动创建项目看板。
- 仅在有用时添加领域、影响程度和客户分类。

主要类型分类采用仓库类型标签或组织 Issue Type 中的一种，避免对同一分类进行重复管理。

## 范围

设置请求适用于目标仓库。修改组织级类型、创建项目看板以及重新分类现有议题，需要分别包含在请求范围内。GitHub 修改需要适当的身份验证和权限；即使不可用，也可以完成本地准备。

工作流程见 [SKILL.md](SKILL.md)，分类决策见[分类指南](references/taxonomy.md)，默认标签见[标签清单](assets/labels.json)。
