# plz-model-sheet
[English](README.md) | [한국어](README.ko.md) | 日本語 | [简体中文](README.zh-CN.md)

ゲームのキャラクター・動物・NPC・小道具を 3D でモデリングする前に使う、実寸の写実的なモデリング基準シート(正投影ビューとターンアラウンド)を作ります。このスキルは実測寸法とオープンライセンスの写真を調べ、Codex の画像生成で同じ個体の側面・正面・背面・上面・追加ポーズを作り、cm 目盛り・高さの補助線・カラーキー・実測との照合を 1 枚に配置します。Claude Code と Codex に対応し、[plz](../../README.md) に含まれるスキルです。

モデリングパイプラインの一部: **シート**([plz-model-sheet](../plz-model-sheet/README.md)) → **モデル**([plz-sheet-to-model](../plz-sheet-to-model/README.md)) → **リグ**([plz-rig-model](../plz-rig-model/README.md))。

## インストール

以下のコマンドは、このスキルがリポジトリで公開された後に使えます。ローカルの下書きを試すには、エージェントに `skills/plz-model-sheet/SKILL.md` を直接読むよう依頼してください。

グローバルにインストール:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -g
```

Codex では `-a codex` を追加します。現在のプロジェクトの `.agents/skills/` ディレクトリにインストールされます:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -a codex
```

## 使い方

対象と、シートの用途を伝えてください。ゲームのコライダーやキャラクターのスケールがあれば、それも伝えます。

Claude Code:

```text
/plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

Codex:

```text
$plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

依頼の例:

- 「Blender でモデリングする猫のターンアラウンドと正投影の基準図を作って。」
- 「プロポーションを決める前に使う、NPC の写実的な基準シートが欲しい。」
- 「docs/art/cat にある既存シートの正面ビューを直して作り直して。」
- 「このモデリングシートにしゃがんだポーズを追加して。」

## 必要なもの

スキル自体に API キーは必要ありません。お使いのマシンで次のツールを使います。

- **Python 3**(`venv` と `pip` を含む)。初回実行時に `~/.cache/plz-model-sheet/venv` を作り、`pillow` と `numpy` をインストールします。
- **Codex CLI**: 画像生成が有効で、ログイン済みのアカウントが必要です(`codex features list | grep image_generation` が `true` で、`codex login status` がログイン状態であること)。画像を 1 枚生成するたびに ChatGPT の利用量を消費します。画像生成が無効、またはログインしていない場合は、エージェントがそれを伝えて停止します。
- **ヘッドレス Chromium**(例: Playwright がインストールしたもの): `sheet.svg` から `sheet.webp` を描画します。自動で見つかります。見つからない場合は `MODEL_SHEET_CHROME` にパスを指定してください。なくても `sheet.svg` は作られます。
- **ネットワークアクセス**: 参考写真のために Wikimedia Commons と Wikipedia(`scripts/commons_refs.py`)へ、実測寸法のためにエージェントの Web 検索ツールへアクセスします。

## 仕組み

1. 対象、基本ポーズ、ビューを決めます。プロジェクトにゲームのコライダー・目の高さ・キャラクタースケールがあれば、シートに描けるように読み取ります。
2. 公開資料から実測寸法を調べます。最も信頼できる値 1 つが縮尺の基準になり、残りは検査項目になります。
3. オープンライセンスの参考写真(Wikimedia Commons)を探し、目標ポーズのきれいな側面写真を選びます。
4. 実物の写真を添付して Codex で基準の側面を作り、すぐに比率を測ります。比率とポーズが目標に合うまで作り直します。
5. 側面を「同じ個体」として添付し、残りのビューを作ります。正面・背面は正投影の指示文で遠近感を消します。
6. `spec.json` を書き、`prepare_views.py`(背景除去と切り抜き)と `compose_sheet.py`(1 つの実寸縮尺、補助線、コライダーの重ね描き、検査、カラーキー)を実行します。
7. シートを目で確認し、`WARN` を直してから、README と `sources.json` を書きます。

作業手順は [SKILL.md](SKILL.md) にあります。設定の形式は [spec.json の形式](references/spec-format.md)、画像生成の指示文は [Codex の指示文](references/codex-prompts.md)、完成した README と `sources.json` に必要な内容は[出力テンプレート](references/output-readme-template.md)にあります。

## 出力

スキルは既定で `docs/art/<id>/` に書き出します。プロジェクトに既存のアートフォルダがあれば、そこに書き出します。

| ファイル | 内容 |
| --- | --- |
| `spec.json` | ビュー・縮尺・検査・カラーキーの設定 |
| `views/*.webp` | 背景を除去したビューごとの画像(3D ツールの背景参照用) |
| `sheet.svg`, `sheet.webp` | シート。SVG は `views/` を読み込み、編集できる |
| `measurements.json` | 寸法・検査結果・カラーキー |
| `sources.json` | 参考写真の作者とライセンス、実測の出典、生成ツールと日付 |
| `README.md` | 基準、寸法、模様と色、ゲームでの使い方、作り方と限界、出典 |

生成した元画像とダウンロードした写真は、リポジトリの外の `~/.cache/plz-model-sheet/<id>/` に置きます。

## 出典と限界

- オープンライセンスの写真(CC0、CC BY、CC BY-SA、パブリックドメイン)だけを使い、作者とライセンスを `sources.json` とシートに残します。実測寸法は出典 URL とともに記録します。
- ビュー画像は実在の個体を撮った写真ではなく、生成画像です。羽や毛の並びはビューごとに異なることがあり、生成された正面・背面は左右対称です。シートの README にこの限界と、残った `WARN` を書きます。
- 生成した比率が実測と大きく違う場合は、作り直すか報告し、隠しません。ゲームのコライダー・目の高さ・スケールとの違いは、黙って直さずに数値で書き、チームが決められるようにします。
- 依頼がない限り、コミットやプッシュはしません。

作業手順は [SKILL.md](SKILL.md) を参照してください。
