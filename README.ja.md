# plz
[English](README.md) | [한국어](README.ko.md) | 日本語 | [简体中文](README.zh-CN.md)

codekongdev が公開している、Claude Code と Codex 向けの AI コーディングエージェント用スキル集です。`plz-<task>` という名前には、エージェントに「この作業をお願い」と頼む意味を込めています。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-555555.svg) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-555555.svg)

## スキル一覧

| スキル | 作成するもの | デモ |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 技術的な概念やシステム構成を three.js の 3D モデルで学べる、単一 HTML ファイルの学習ページ。 | [コードサンドボックス（韓国語）](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## インストール

利用できるスキルを一覧表示します。

```sh
npx skills add codekongdev/plz -l
```

スキルを一つ選んでグローバルにインストールします。

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

すべてのスキルをグローバルにインストールします。

```sh
npx skills add codekongdev/plz --skill '*' -g
```

Codex で使う場合は `-a codex` を指定します。次のコマンドは、現在のプロジェクトの `.agents/skills/` にインストールします。

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

Claude Code に手動でインストールする場合は、リポジトリを clone し、`skills/plz-3d-explain` を `~/.claude/skills/plz-3d-explain` にコピーするか、シンボリックリンクを作成します。コピーする場合のコマンドは次のとおりです。

```sh
git clone https://github.com/codekongdev/plz.git
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

[skills.sh の plz-3d-explain ページ](https://skills.sh/codekongdev/plz/plz-3d-explain)も参照できます。

## コントリビュート

英語版 README を正本とします。翻訳を更新する際は、コマンド、コード、リンクを英語版と同じにしてください。翻訳への貢献を歓迎します。リポジトリのルートで `node scripts/check-readme-translations.mjs` を実行すると、翻訳間の整合性と相対リンクを確認できます。

## ライセンス

[MIT](LICENSE)。
