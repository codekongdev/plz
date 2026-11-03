# plz-setup-issues
[English](README.md) | [한국어](README.ko.md) | 日本語 | [简体中文](README.zh-CN.md)

GitHub リポジトリに、再利用できる簡潔な Issue 分類、フォーム、トリアージ規則を設定します。Claude Code と Codex に対応し、[plz](../../README.md) に含まれるスキルです。

## インストール

グローバルにインストール:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -g
```

Codex では `-a codex` を付けます。以下のコマンドは現在のプロジェクトの `.agents/skills/` にインストールします。

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a codex
```

## 使い方

Claude Code:

```text
/plz-setup-issues Set up issue management in this repository.
```

Codex:

```text
$plz-setup-issues Set up issue management in this repository.
```

ローカルファイルの作成のみを依頼することも、特定の GitHub リポジトリへのラベル適用を明示的に依頼することもできます。変更前に既存の設定を確認し、競合する規則は解決方針が決まるまで保持します。

## デフォルト構成

- 種類ラベル 5 個: `type:bug`、`type:feature`、`type:improvement`、`type:maintenance`、`type:docs`。
- 検討用ラベル 2 個: `needs-triage`、`needs-info`。
- バグ・機能リクエストフォーム、`.github/ISSUE_TRIAGE.md`、`.github/labels.json`。
- P0–P3 優先度: 既存のプロジェクト・組織フィールドを再利用し、なければ `priority:P0`–`priority:P3` ラベルで管理します。プロジェクトボードは自動作成しません。
- 領域・影響度・顧客の分類は必要な場合だけ追加します。

種類の主な分類には、リポジトリの種類ラベルか組織の Issue Type のいずれかを用い、同じ分類を重複管理しません。

## 対象範囲

設定の依頼は対象リポジトリに適用します。組織全体の種類変更、プロジェクトボードの作成、既存 Issue の再分類は、それぞれ依頼の範囲に含まれている必要があります。GitHub の変更には適切な認証と権限が必要ですが、利用できない場合もローカルの準備は完了できます。

手順は [SKILL.md](SKILL.md)、分類の判断基準は[分類ガイド](references/taxonomy.md)、デフォルトラベルは[ラベル一覧ファイル](assets/labels.json)を参照してください。
