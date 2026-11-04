# plz-3d-explain
[English](README.md) | [한국어](README.ko.md) | 日本語 | [简体中文](README.zh-CN.md)

技術的な概念やシステム構成を three.js の 3D モデルで学べる、単一 HTML ファイルの学習ページを作成する Claude Code・Codex 向けスキルです。

デスクトップ：第4章、コンテナ

![左側に解説、右側にコンテナの 3D モデルを表示したデスクトップ画面](docs/demo-desktop.png)

スマートフォン：第8章、OS サンドボックス

<img src="docs/demo-mobile.png" alt="上部に OS サンドボックスの 3D モデル、下部に解説を表示したスマートフォン画面" width="360">

AI エージェントのコードサンドボックスのデモを[英語](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.en.html)または[韓国語](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html)でブラウザから開けます。コンテナ、microVM、WASM、OS サンドボックスによる隔離の仕組みを全10章で解説しています。サンプル HTML（[英語](assets/example-agent-sandbox.en.html)、[韓国語](assets/example-agent-sandbox.html)）もリポジトリに含まれています。codekongdev による [plz](https://github.com/codekongdev/plz) シリーズのスキルです。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/codekongdev/plz/blob/main/LICENSE) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-555555.svg) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-555555.svg)

## インストール

`npx skills` でインストールするには、Node.js 22.20 以降（npm と `npx` を含む）、Git、利用する Claude Code または Codex が必要です。まずターミナルでツールを確認します。

```sh
node --version
npm --version
git --version
```

利用するエージェントのコマンドを選んでください。`-g` でグローバルにインストールすると、複数のプロジェクトで使えます。

Claude Code:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a claude-code -g
```

Codex:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex -g
```

現在のプロジェクトだけで使う場合は、そのプロジェクトのディレクトリで上記コマンドから `-g` を外して実行します。インストーラーは `.agents/skills/` にスキルを保存し、Claude Code を選んだ場合はリンクも作成します。

利用するエージェントのインストール一覧に `plz-3d-explain` が表示されることを確認します。

```sh
npx skills list -g -a claude-code
npx skills list -g -a codex
```

プロジェクトにインストールした場合は、確認コマンドでも `-g` を外し、同じプロジェクトで実行します。一覧にない場合は、選択したエージェントとインストール範囲を確認してください。一覧にあってもエージェントが認識しない場合は、利用するプロジェクトで新しいエージェントセッションを開始します。

Claude Code に手動でインストールする場合は、リポジトリを clone し、`skills/plz-3d-explain` を `~/.claude/skills/plz-3d-explain` にコピーするか、シンボリックリンクを作成します。コピーする場合のコマンドは次のとおりです。

```sh
git clone https://github.com/codekongdev/plz.git
mkdir -p ~/.claude/skills
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

[skills.sh の plz-3d-explain ページ](https://skills.sh/codekongdev/plz/plz-3d-explain)も参照できます。

## 使い方

インストール後、プロジェクトでエージェントを開き、スキルを指定して依頼します。

- Claude Code: `/plz-3d-explain コンテナの隔離を 3D で説明して。`
- Codex: `$plz-3d-explain コンテナの隔離を 3D で説明して。`

[SKILL.md](SKILL.md) の起動フレーズを使い、普段の言葉で依頼することもできます。

- 「コンテナと仮想マシンの違いを 3D で説明して。」
- 「HTTP リクエストがサーバーを経由して外部 API に届く仕組みを、3D モデルで見せて。」
- 「このリポジトリでリソースが作成されてから破棄されるまでの流れを、3D で説明して。」

スキルは内容を確認して章立てを決め、[テンプレート](assets/template.html)に文章とシーンを追加します。完成したページはブラウザで検証します。

## 生成されるページの内容

- **スクロールに連動するシーン。** デスクトップでは、左側の文章を読み進めると、右側に固定された 3D ステージが現在の章のシーンに切り替わります。
- **ボタンで確かめる原因と結果。** 各章のボタンで、リクエストが経路を進む様子や、境界で処理が阻まれる様子を再生できます。結果は文章でも確認できます。
- **任意で使える自動再生。** スイッチをオンにすると、現在の章の動作を繰り返し再生します。結果を表示してから初期状態に戻ります。初期設定はオフで、設定はブラウザに保存されます。
- **建築模型のような表現。** 平行投影カメラ、白いモデル、インク調の輪郭線、淡い影で構造を表します。赤は動作の主体、青は境界・ルール・仲介役、真鍮色はデータ・リソース・材料を示します。ドラッグでモデルを回転でき、視点を戻す操作で最初の角度に戻せます。
- **スマートフォン向けレイアウト。** 縦向きではステージが上部に固定され、その下で文章がスクロールします。横向きでは文章とステージが左右に並びます。ステージのタイトルと凡例は、モデルの表示領域とは別の行に配置されます。
- **用語と出典。** 専門用語を説明し、用語集にもまとめます。確認した出典と確認日を記載し、未確認の内容はその旨を明示します。
- **ページの言語に合わせた表示。** ボタン、案内、タイトルは `<html lang>` に応じて英語・韓国語・日本語・簡体字中国語に切り替わります。ほかの言語はページ内で文言を上書きして追加でき、辞書にない文言は英語で表示されます。本文はユーザーの言語で作成します。
- **ラベルと表示の検証。** 検証用フックでラベルの重なりやはみ出しを調べます。各章の動作完了後のスクリーンショットでモデルと結果の文章が一致するか確認し、自動再生の繰り返しやスマートフォン表示も検証します。

## 動作要件と制限

出力はビルド不要の単一 HTML ファイルです。three.js r170 と Web フォントを CDN から読み込むため、ページを開く際はインターネット接続が必要です。

検証にはローカル HTTP サーバー（スキルの例では Python 3 を使用）と、エージェントから操作できる Playwright などのブラウザ自動化ツールが必要です。`npx skills` はスキルファイルのみをインストールし、これらのツールはインストールしません。利用できない場合はエージェントに準備を依頼し、実行できなかった検証項目を結果に明記してもらってください。

コンソールエラー、ラベルの重なりやはみ出し、横方向のスクロール、自動再生、タッチ操作を確認します。手順は [SKILL.md](SKILL.md)、検証用フックは[エンジン API](references/engine-api.md)、よくある問題は[注意点](references/gotchas.md)を参照してください。

スマートフォンではモデルを左右にのみ回転できます。ステージ上を縦にスワイプするとページがスクロールし、横にスワイプするとモデルが回転します。上下への傾き変更やズームには対応していません。

狭いステージではラベルの位置を自動調整しますが、調整範囲を超えると重なりが残ります。ラベルは短くし、実際の表示を確認してください。

静的なアーキテクチャ図やシーケンス図、データのグラフ、Blender によるモデリング、製品のランディングページ、アプリの UI デザインは対象外です。

## 個人設定

インストール先のスキルディレクトリで、[設定のサンプル](references/preferences.example.md)をコピーします。

```sh
cp references/preferences.example.md references/preferences.md
```

コピーしたファイルに、フォントや色、検証ツール、完成した HTML の保存先、受けたフィードバックなどを記入します。記入した設定は [SKILL.md](SKILL.md) の既定値より優先され、未指定の項目には既定値が使われます。個人設定ファイルは Git の追跡対象から除外されています。

## コントリビュート

コントリビュートや翻訳を歓迎します。詳しくは [CONTRIBUTING.md](https://github.com/codekongdev/plz/blob/main/CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](https://github.com/codekongdev/plz/blob/main/LICENSE)。

CDN から読み込む外部リソースの three.js（MIT）と、Pretendard・Hahmlet・IBM Plex フォント（SIL OFL）は、このリポジトリには同梱していません。
