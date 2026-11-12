# plz-model-sheet
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

在用 3D 建模游戏角色、动物、NPC 或道具之前，先制作写实的、按真实尺寸绘制的建模参考图(正交视图与转面图)。该技能会调研实测尺寸和开放许可的照片，用 Codex 图像生成为同一个体生成侧面、正面、背面、顶面和额外姿势，再把 cm 刻度、高度辅助线、色卡和实测对照排在同一张图上。支持 Claude Code 和 Codex，是 [plz](../../README.md) 的一部分。

建模流程的一部分: **参考图**([plz-model-sheet](../plz-model-sheet/README.md)) → **模型**([plz-sheet-to-model](../plz-sheet-to-model/README.md)) → **绑定**([plz-rig-model](../plz-rig-model/README.md))。

## 安装

以下命令需要在本技能发布到仓库之后才能使用。想试用本地草稿，请让代理直接阅读 `skills/plz-model-sheet/SKILL.md`。

全局安装:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -g
```

在 Codex 中，请加上 `-a codex`。它会安装到当前项目的 `.agents/skills/` 目录:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -a codex
```

## 使用方法

说明对象和参考图的用途。如果有游戏碰撞体或角色缩放比例，也请一并告知。

Claude Code:

```text
/plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

Codex:

```text
$plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

请求示例:

- “为我要在 Blender 中建模的猫制作转面图和正交参考图。”
- “在确定比例之前，我需要一张 NPC 的写实参考图。”
- “修正 docs/art/cat 中现有参考图的正面视图并重新生成。”
- “给这张建模参考图加一个蹲伏姿势。”

## 环境要求

技能本身不需要 API 密钥。它会使用你电脑上的以下工具。

- **Python 3**，需包含 `venv` 和 `pip`。首次运行会创建 `~/.cache/plz-model-sheet/venv`，并在其中安装 `pillow` 和 `numpy`。
- **Codex CLI**: 需要开启图像生成并已登录账号(`codex features list | grep image_generation` 必须显示 `true`，`codex login status` 必须是已登录状态)。每生成一张图像都会消耗你的 ChatGPT 用量。如果图像生成未开启或未登录，代理会告知你并停止。
- **无头 Chromium**(例如 Playwright 安装的那个): 用于把 `sheet.svg` 渲染成 `sheet.webp`。会自动查找；找不到时请用 `MODEL_SHEET_CHROME` 指定路径。已安装的 Google Chrome 也可以使用(在 Windows 上把 `MODEL_SHEET_CHROME` 指向 `chrome.exe`)。没有它也能得到 `sheet.svg`。
- **网络访问**: 为获取参考照片，会访问 Wikimedia Commons 和 Wikipedia(`scripts/commons_refs.py`)；为获取实测尺寸，会使用代理的网络搜索工具。

## 工作方式

1. 确定对象、默认姿势和视图。如果项目里有游戏碰撞体、眼睛高度或角色缩放比例，就读取出来，以便画在参考图上。
2. 从公开资料中调研实测尺寸。一个最可信的数值作为比例尺的基准，其余数值作为检查项。
3. 查找开放许可的参考照片(Wikimedia Commons)，选出目标姿势下清晰的侧面照片。
4. 附上真实照片，用 Codex 生成基准侧面，并立即测量其比例。重复生成，直到比例和姿势符合目标。
5. 把侧面作为“同一个体”附上，生成其余视图。正面和背面使用正交提示语消除透视。
6. 编写 `spec.json`，然后运行 `prepare_views.py`(去除背景并裁剪)和 `compose_sheet.py`(统一的真实尺寸比例、辅助线、碰撞体叠加、检查、色卡)。
7. 目视检查参考图，处理所有 `WARN`，再编写 README 和 `sources.json`。

工作流程见 [SKILL.md](SKILL.md)。设置格式见 [spec.json 格式](references/spec-format.md)，图像提示语见 [Codex 提示语](references/codex-prompts.md)，成品 README 和 `sources.json` 必须包含的内容见[输出模板](references/output-readme-template.md)。

## 输出内容

技能默认写入 `docs/art/<id>/`；如果项目已有美术资料文件夹，则写入该文件夹。

| 文件 | 内容 |
| --- | --- |
| `spec.json` | 视图、比例、检查和色卡设置 |
| `views/*.webp` | 去除背景的各视图图像(供 3D 工具作背景参考) |
| `sheet.svg`, `sheet.webp` | 参考图。SVG 会加载 `views/`，可以编辑 |
| `measurements.json` | 尺寸、检查结果、色卡 |
| `sources.json` | 参考照片的作者和许可、实测来源、生成工具和日期 |
| `README.md` | 基准约定、尺寸、花纹与颜色、游戏中的使用、制作方法与局限、来源 |

生成的原图和下载的照片保存在仓库之外的 `~/.cache/plz-model-sheet/<id>/`。

## 来源与局限

- 只使用开放许可的照片(CC0、CC BY、CC BY-SA、公有领域)，并在 `sources.json` 和参考图上记录作者与许可。实测尺寸连同来源 URL 一起记录。
- 各视图是生成的图像，不是真实个体的照片。羽毛或毛发的排布在不同视图之间可能略有差异，生成的正面和背面左右对称。参考图的 README 会写明这些局限以及仍存在的 `WARN`。
- 生成的比例与实测相差很大时，会重新生成或如实报告，不会隐瞒。与游戏碰撞体、眼睛高度或缩放比例的差异不会被悄悄修正，而是用数字记录下来，由团队决定。
- 除非你要求，否则不会提交或推送。

工作流程请参阅 [SKILL.md](SKILL.md)。
