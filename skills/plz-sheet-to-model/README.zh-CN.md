# plz-sheet-to-model
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

根据正交建模参考图纸(侧面、顶面、正面、背面图像以及 px/cm,例如 plz-model-sheet 的输出)生成实际尺寸、带纹理的 3D 模型。该技能以后台方式运行 Blender,测量轮廓,连接截面,把各视图图像烘焙成 UV 纹理,并将眼睛、腿、翅膀和耳朵作为独立部件构建,最后输出 `.blend`、`.glb`、用于绑定骨骼的 `landmarks.json` 以及尺寸报告。可用于 Claude Code 和 Codex,属于 [plz](../../README.md) 的一部分。

## 安装

以下命令需要在该技能发布到仓库后才能使用。如果想试用本地草稿,请让智能体直接读取 `skills/plz-sheet-to-model/SKILL.md`。

全局安装:

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -g
```

在 Codex 中,请添加 `-a codex`。它会安装到当前项目的 `.agents/skills/` 目录:

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -a codex
```

## 使用方法

把参考图纸所在的文件夹(视图图像和 `measurements.json`)告诉智能体,并请它生成模型。

Claude Code:

```text
/plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

Codex:

```text
$plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

请求示例:

- “根据这张参考图纸建模,并导出 glb。”
- “用这组三视图做一个 Blender 模型。”
- “我修改了图纸,请把模型重新生成为 v003。”
- “把模型和图纸对比一下,告诉我尺寸差异。”

## 运行要求

- Blender 4.2 或更高版本(已在 5.2 上验证)。该技能以不带窗口的后台方式运行它:`blender -b --factory-startup -P <script> -- <arguments>`。如果可执行文件既不在 `PATH` 中,也不在 macOS 默认路径下,请用环境变量 `BLENDER` 指定路径。
- 测量和对比脚本(`grid.py`、`measure_views.py`、`compare_models.py`)需要安装了 Pillow 和 numpy 的 Python 3。首次使用时,该技能会在 `~/.cache/plz-sheet-to-model/venv` 创建虚拟环境并用 `pip` 安装这两个包,因此需要能访问 Python 包索引的网络。
- 在 Blender 内部,脚本直接使用 Blender 自带的 Python、numpy、Cycles(CPU 烘焙)和 glTF 导出器,因此无需另外安装任何东西。
- 不需要 API 密钥,也不需要其他网络访问。

## 工作原理

所有手工确定的数值都保存在每个对象各自的一份 `spec.json`([references/spec-format.md](references/spec-format.md))中,因此修改图纸或升级版本后重新生成,只需两条命令,结果也相同。

- **阶段:** 检查输入;编写 spec;测量视图(`measure_views.py`);构建模型(`build_model.py`);通过渲染、在图纸视图上做像素叠加和尺寸报告进行检查(`inspect_model.py`、`overlay_views.py`、`compare_models.py`);放置文件并汇报。
- **鸟(bird):** 对可视为单根管状的身体做截面连接,用射线投射放置眼睛,用 Skin 修改器制作腿和脚趾,折叠翅膀外壳,以及展开的翅膀。
- **四足动物(quadruped):** 躯干加尾巴的截面连接,把腿部胶囊体和脚部椭球体用 SDF 合并成一层封闭外壳,薄的耳朵部件,以及朝前的眼睛。由于外壳只有一层,绑定骨骼后即使大幅摆动腿部,内部被埋住的面也不会穿出来。
- **可复现:** 用相同输入重新构建,测量值、纹理、网格和 landmarks 都相同。只有 glb 中眼睛三角形的顺序会随每次导出而变化([references/lessons.md](references/lessons.md))。

## 输入与输出

输入:包含 `views/*.webp`(已去除背景的图像;侧面和顶面视图头朝右,正面和背面视图保持直立,可选的展开视图头朝上)和 `measurements.json` 的参考图纸文件夹,以及智能体与你一起编写的 `spec.json`。

| 输出 | 内容 |
| --- | --- |
| `spec.json` | 每个对象各自的设置,包含所有手工确定的数值 |
| `<id>_<ver>.blend` | 部件对象、最终材质和投影材质,所有图像均已打包 |
| `<id>_<ver>.glb` | 供游戏使用:已应用细分,不透明纹理为 JPEG,透明纹理为 PNG |
| `<id>_<ver>.landmarks.json` | 交给 plz-rig-model 的特征点、部件名称和区域([references/conventions.md](references/conventions.md)) |
| `<id>_<ver>.report.json` | 尺寸、眼睛位置、各对象的三角形数、文件大小以及与图纸的差异 |

构建在 `~/.cache/plz-sheet-to-model/<id>/` 下的工作文件夹中进行。检查完成后,把文件复制到项目中,默认位置是 `docs/art/<id>/model/`。模型使用米为单位,Z 轴向上,正面为 -Y(glTF 的 +Z),左侧为 +X,原点在脚下。

## 限制

- 只验证了鸟和四足动物两种身体结构(鸟用鸟的模型验证,四足动物用猫的模型验证)。人类等两足对象、带翅膀的四足动物,以及长毛会改变轮廓的对象,目前还没有对应策略;该技能不会猜测,而是说明不支持。
- 如果没有从下方观察的视图,腹部下方的花纹会被拉伸。
- 纹理中混有图纸的光照,随角度变化的光泽(例如颈部羽毛)会变成固定颜色。
- 不含骨骼绑定时,鸟大小或猫大小的对象通常约为 3.4 万个三角形,glb 约 2.6 MB(鸟大小)或约 1.2 MB(猫大小)。这些是典型数值,不作保证。
- 构建时请不要使用 Blender MCP:它的安全模式会阻止 numpy、文件读取和打开其他 `.blend` 文件。该技能以后台方式运行 Blender,不会触碰你已经打开的 Blender 文件。
- 骨骼绑定不属于该技能的范围,请使用 plz-rig-model。

## 建模流水线的一部分

建模流水线按以下顺序进行:[plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md)。该技能是中间一步:把参考图纸变成模型,并把 `landmarks.json` 交给骨骼绑定。返回 [plz](../../README.md)。

工作流程请见 [SKILL.md](SKILL.md),遇到的问题及解决方法请见 [references/lessons.md](references/lessons.md)。
