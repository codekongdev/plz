# plz-rig-model
[English](README.md) | [한국어](README.ko.md) | 日本語 | [简体中文](README.zh-CN.md)

既存の 3D メッシュモデルにゲーム用のリグを付けます。ヘッドレス Blender でアーマチュア、スキンウェイト、脚の IK、基本ポーズのアクション、確認用ポーズを作り、glTF(`.glb`)と `.blend` に書き出したうえで、ポーズのレンダリング、自己交差の数、再読み込みで検証し、ゲームコードが使うボーン回転の符号表(+1/-1)を出力します。Claude Code と Codex に対応し、[plz](../../README.md) に含まれるスキルです。

## インストール

以下のコマンドは、このスキルがリポジトリで公開されてから使えます。ローカルの下書きを試すには、エージェントに `skills/plz-rig-model/SKILL.md` を直接読むよう頼んでください。

グローバルにインストール:

```sh
npx skills add codekongdev/plz --skill plz-rig-model -g
```

Codex で使うには `-a codex` を付けます。次のコマンドは現在のプロジェクトの `.agents/skills/` にインストールします。

```sh
npx skills add codekongdev/plz --skill plz-rig-model -a codex
```

## 使い方

エージェントにメッシュモデル(`.blend` または `.glb`)を示して、リギングを依頼してください。

Claude Code:

```text
/plz-rig-model Rig this cat model so it can walk and run in my game.
```

Codex:

```text
$plz-rig-model Rig this cat model so it can walk and run in my game.
```

依頼の例:

- 「この鳥のモデルにボーンを付けて、アニメーションを付けられる glb にして。」
- 「この四足動物にアーマチュア、スキニング、脚の IK を付けて。」
- 「ゲームコードで使えるように、ボーンごとの回転方向を +1 / -1 の符号で教えて。」
- 「メッシュを直したので、リグを付け直して。」

## 必要なもの

- Blender 4.4 以降(5.2 で検証)。スキルがウィンドウなしでバックグラウンド実行します: `blender -b --factory-startup -P <script> -- <arguments>`。実行ファイルが既定のパスにない場合は、環境変数 `BLENDER` にパスを指定してください。
- numpy と glTF アドオンは Blender 同梱の Python とアドオンを使うため、Python パッケージを別途インストールする必要はありません。
- システムの `python3` は、Blender が不要な 2 つの確認にだけ使います。`.glb` に対する `rig_axes.py` と `inspect_rig.py compare` で、標準ライブラリだけを使います。
- ネットワーク接続と API キーは不要です。

## 仕組み

体の構造テンプレート(`templates/<name>.json`)が、ボーン、ウェイトの方式、ポーズをデータとして記述します。ボーンの位置はモデル上の特徴点(`landmarks.json`)から決まるので、同じ体の構造の別の個体は特徴点だけを差し替えてリギングします。

- **テンプレート:** `bird`(地面に立つ鳥。畳んだ翼と広げた翼を切り替える)と `quadruped`(猫のような四足動物。体・頭・尾・四肢が 1 枚のシェルで、耳と目は別パーツ)。ほかの体の構造は、[references/templates.md](references/templates.md) の形式で新しいテンプレートを作ります。
- **工程:** テンプレートと座標の約束の確認([references/conventions.md](references/conventions.md))、`landmarks.json` の用意、リギング、ポーズのレンダリングと自己交差の数の計測、検証(再読み込み、以前のバージョンとの比較、再現性、回転の符号表、角度の限界)、文書化と報告。
- **再現可能:** 同じ入力なら同じ結果になります。検証した猫の例では glb のバイト列まで一致します。

## 入力と出力

入力: `.blend` または `.glb` のメッシュモデルと `landmarks.json`。特徴点を埋める助けとして、格子付きの正射影画像と空の `landmarks.todo.json` を出力することもできます。

| 出力 | 内容 |
| --- | --- |
| `<name>.glb` | 変形ボーンだけを含むスキン付きメッシュと基本ポーズのアニメーション(単位 m、正面 +Z、上 +Y) |
| `<name>.blend` | 画像を埋め込み、バインドポーズで保存。IK コントロールと確認用アクション `rig_test` を含む |
| `<name>.rig-report.json` | ボーン一覧、変形ボーン、パーツごとの頂点数、ウェイトのない頂点、アクション、NLA トラック |
| `renders/` | ポーズのレンダリングと、ポーズごとの自己交差数を記録した `<prefix>_intersections.json` |
| `axes.json` | .blend と glb で測ったボーンの意味ごとの回転符号表(+1/-1) |

関節を大きく曲げる動作がある場合は、角度の限界表(`sweep_limits.py`)を追加できます。ファイルは選んだ `--out` フォルダに書き出され、作業フォルダの既定は `~/.cache/plz-rig-model/<id>/` です。

## 制限

- 検証済みのテンプレートは `bird` と `quadruped` だけです。人型や蛇などほかの体の構造には、実際の対象で確認を通した新しいテンプレートが必要です。
- bird の畳んだ翼と広げた翼の切り替えには中間の形がないため、素早い羽ばたきで隠します。
- 線形スキニングには衝突判定がありません。関節を深く曲げると皮膚が触れ合う線が残ることがあり、それは取り除かずに角度の限界として記録します。
- リギングに Blender MCP は使わないでください。MCP のセーフモードは保存済みのスクリプトを実行できません。スキルは、ユーザーが開いている Blender ファイルにも触れません。
- モデルは座標と名前の約束(単位 m、-Y が正面、左が +X、足元が原点)に従っているか、先に Blender で直したコピーである必要があります。

## モデリングパイプラインの一部

モデリングパイプラインは [plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md) の順に進みます。このスキルは最後の工程ですが、パイプラインの出力に限らず、既存のどんなメッシュモデルも受け付けます。生成した、購入した、手作りのモデルでも、約束に従っていれば使えます。[plz](../../README.md) に戻る。

作業手順は [SKILL.md](SKILL.md) に、遭遇した問題と対処は [references/lessons.md](references/lessons.md) にあります。
