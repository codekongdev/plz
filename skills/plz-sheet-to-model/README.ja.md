# plz-sheet-to-model
[English](README.md) | [한국어](README.ko.md) | 日本語 | [简体中文](README.zh-CN.md)

正投影のモデリング基準シート(側面・上面・正面・背面の画像とpx/cm。plz-model-sheetの出力など)から、実寸でテクスチャ付きの3Dモデルを作ります。Blenderをバックグラウンドで実行してシルエットを測り、断面をつなぎ、各ビューの画像をUVテクスチャにベイクし、目・脚・翼・耳を別パーツとして作ったうえで、`.blend`、`.glb`、リギングに渡す`landmarks.json`、寸法レポートを出力します。Claude CodeとCodexで使えます。[plz](../../README.md)の一部です。

## インストール

以下のコマンドは、このスキルがリポジトリで公開された後に使えます。ローカルの下書きを試すには、エージェントに`skills/plz-sheet-to-model/SKILL.md`を直接読むよう依頼してください。

グローバルにインストールする場合:

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -g
```

Codexでは`-a codex`を付けます。現在のプロジェクトの`.agents/skills/`ディレクトリにインストールされます。

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -a codex
```

## 使い方

基準シートのフォルダ(ビュー画像と`measurements.json`)をエージェントに示して、モデルを依頼してください。

Claude Code:

```text
/plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

Codex:

```text
$plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

依頼の例:

- 「この基準シートからモデリングして、glbを書き出して。」
- 「この三面図からBlenderモデルを作って。」
- 「シートを直したので、モデルをv003として作り直して。」
- 「モデルをシートと比較して、寸法の差を見せて。」

## 必要なもの

- Blender 4.2以降(5.2で検証)。スキルはウィンドウなしのバックグラウンドで実行します: `blender -b --factory-startup -P <script> -- <arguments>`。実行ファイルが`PATH`にも、macOSの既定パスにもない場合は、環境変数`BLENDER`にパスを指定してください。
- 測定・比較スクリプト(`grid.py`、`measure_views.py`、`compare_models.py`)には、PillowとnumpyのあるPython 3が必要です。初回の利用時に、スキルが`~/.cache/plz-sheet-to-model/venv`に仮想環境を作り、`pip`で2つのパッケージをインストールするため、Pythonパッケージのインデックスへのネットワーク接続が必要です。
- Blenderの内部では、Blender付属のPython、numpy、Cycles(CPUベイク)、glTFエクスポーターをそのまま使うので、追加のインストールはありません。
- APIキーも、それ以外のネットワーク接続も不要です。

## 仕組み

手で決めた値はすべて、対象ごとの`spec.json`([references/spec-format.md](references/spec-format.md))1つに残します。そのため、シートを直したりバージョンを上げたりして作り直すときは、コマンド2つで同じ結果になります。

- **ステージ:** 入力の確認、specの作成、ビューの測定(`measure_views.py`)、モデルのビルド(`build_model.py`)、レンダー・シート上のピクセル重ね合わせ・寸法レポートによる確認(`inspect_model.py`、`overlay_views.py`、`compare_models.py`)、ファイルの配置と報告。
- **鳥(bird):** 1本の管として読める胴体の断面つなぎ、レイキャストで入れる目、Skinモディファイアの脚と足指、折りたたんだ翼のシェル、広げた翼。
- **四足獣(quadruped):** 胴体と尾の断面つなぎ、脚のカプセルと足の楕円体をSDFで合わせた1枚の閉じたシェル、薄い耳パーツ、前を向く目。シェルが1枚なので、リギング後に脚を大きく振っても、内側に埋まった面が突き出しません。
- **再現可能:** 同じ入力でビルドし直すと、測定値、テクスチャ、メッシュ、landmarksが同じになります。glbの目の三角形の順序だけが、書き出しのたびに変わります([references/lessons.md](references/lessons.md))。

## 入力と出力

入力: `views/*.webp`(背景を除去した画像。側面・上面は頭が右、正面・背面は正立、任意の滑空ビューは頭が上)と`measurements.json`がある基準シートのフォルダ、およびエージェントが一緒に作成する`spec.json`。

| 出力 | 内容 |
| --- | --- |
| `spec.json` | 対象ごとの設定。手で決めた値のすべて |
| `<id>_<ver>.blend` | パーツのオブジェクト、最終マテリアルと投影マテリアル、すべての画像をパック |
| `<id>_<ver>.glb` | ゲーム用。サブディビジョン適用済み、不透明テクスチャはJPEG、アルファテクスチャはPNG |
| `<id>_<ver>.landmarks.json` | plz-rig-modelに渡す特徴点・パーツ名・領域([references/conventions.md](references/conventions.md)) |
| `<id>_<ver>.report.json` | 寸法、目の位置、オブジェクトごとの三角形数、ファイルサイズ、シートとの差 |

ビルドは`~/.cache/plz-sheet-to-model/<id>/`以下の作業フォルダで行います。確認が終わったら、ファイルをプロジェクトにコピーします。既定の場所は`docs/art/<id>/model/`です。モデルの単位はm、Zが上、正面は-Y(glTFの+Z)、左は+X、原点は足元です。

## 制限

- 検証済みの体の構造は鳥と四足獣だけです(鳥は鳥のモデルで、四足獣は猫のモデルで検証)。人間などの二足の対象、翼のある四足獣、長い毛でシルエットが変わる対象には、まだ戦略がありません。スキルは推測せず、対応していないと伝えます。
- 下から見たビューがないと、腹側の模様が引き伸ばされます。
- テクスチャにはシートの照明が混ざっており、角度で変わる光沢(首の羽毛など)は固定色になります。
- リグなしの一般的な重さは、鳥サイズや猫サイズの対象で三角形約3.4万、glbは約2.6MB(鳥サイズ)または約1.2MB(猫サイズ)です。一般的な数値であり、保証ではありません。
- ビルドにBlender MCPは使わないでください。MCPのセーフモードは、numpy、ファイル読み込み、別の`.blend`を開くことをブロックします。スキルはBlenderをバックグラウンドで実行し、ユーザーが開いているBlenderのファイルには触れません。
- リギングはこのスキルの範囲外です。plz-rig-modelを使ってください。

## モデリングパイプラインの一部

モデリングパイプラインは、[plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md)の順に進みます。このスキルは中間のステップで、基準シートをモデルにして、`landmarks.json`をリギングに渡します。[plz](../../README.md)に戻る。

作業手順は[SKILL.md](SKILL.md)を、遭遇した問題と解決は[references/lessons.md](references/lessons.md)を参照してください。
