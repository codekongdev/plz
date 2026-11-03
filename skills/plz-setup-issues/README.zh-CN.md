# plz-setup-issues
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

为 GitHub 仓库设置可复用的精简议题分类、议题表单和分诊规则。支持 Claude Code 和 Codex，是 [plz](../../README.md) 的一部分。

## 安装

全局安装：

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -g
```

在 Codex 中使用时加上 `-a codex`。以下命令安装到当前项目的 `.agents/skills/` 目录：

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a codex
```

## 使用方法

Claude Code:

```text
/plz-setup-issues Set up issue management in this repository.
```

Codex:

```text
$plz-setup-issues Set up issue management in this repository.
```

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
