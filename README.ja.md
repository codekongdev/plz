# plz
[English](README.md) | [한국어](README.ko.md) | 日本語 | [简体中文](README.zh-CN.md)

codekongdev が公開している、Claude Code と Codex 向けの AI コーディングエージェント用スキル集です。最初のスキル `plz-3d-explain` は、あらゆる技術的な概念を、操作しながら学べる 3D 学習ページにします。

`plz-<task>` という名前には、エージェントに「この作業をお願い」と頼む意味を込めています。

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html"><img src="skills/plz-3d-explain/docs/demo-desktop.png" alt="左に解説テキスト、右にコンテナの 3D モデルを表示したデスクトップ画面" width="800"></a>
</p>
<p align="center"><em>デモの第 4 章（韓国語）: コンテナはプロセスを分離しますが、ホストのカーネルは共有します。</em></p>

## インストール

スキルを一つ選んでグローバルにインストールします。

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

<details>
<summary>Codex</summary>

Codex で使う場合は `-a codex` を指定します。次のコマンドは、現在のプロジェクトの `.agents/skills/` にインストールします。

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

</details>

<details>
<summary>スキルの一覧表示、すべてインストール</summary>

利用できるスキルを一覧表示します。

```sh
npx skills add codekongdev/plz -l
```

すべてのスキルをグローバルにインストールします。

```sh
npx skills add codekongdev/plz --skill '*' -g
```

</details>

<details>
<summary>手動インストール（Claude Code）</summary>

Claude Code に手動でインストールする場合は、リポジトリを clone し、`skills/plz-3d-explain` を `~/.claude/skills/plz-3d-explain` にコピーするか、シンボリックリンクを作成します。コピーする場合のコマンドは次のとおりです。

```sh
git clone https://github.com/codekongdev/plz.git
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

</details>

[skills.sh の plz-3d-explain ページ](https://skills.sh/codekongdev/plz/plz-3d-explain)も参照できます。

## 使い方

インストールしたら、普段の言葉でエージェントに頼むだけです。

- 「コンテナの分離がどのように働くのかを 3D で解説して。」
- 「TCP ハンドシェイクの流れを 3D モデルで見せて。」

## スキル一覧

| スキル | 作成するもの | デモ |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 技術的な概念やシステム構成を three.js の 3D モデルで学べる、単一 HTML ファイルの学習ページ。 | [コードサンドボックス（韓国語）](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## コントリビュート

コントリビュートや翻訳を歓迎します。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE)。
