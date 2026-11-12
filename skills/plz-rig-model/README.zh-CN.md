# plz-rig-model
[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 简体中文

为现有的 3D 网格模型添加可用于游戏的骨骼绑定。技能通过无界面的 Blender 生成骨架、蒙皮权重、腿部 IK、基础姿势动作和检查姿势，导出 glTF(`.glb`)和 `.blend`，再用姿势渲染、自相交数量和重新导入来验证，并输出供游戏代码使用的骨骼旋转方向表(+1/-1)。支持 Claude Code 和 Codex，是 [plz](../../README.md) 的一部分。

## 安装

下面的命令需要等这个技能发布到仓库之后才能使用。想试用本地草稿，可以让代理直接阅读 `skills/plz-rig-model/SKILL.md`。

全局安装:

```sh
npx skills add codekongdev/plz --skill plz-rig-model -g
```

在 Codex 中使用时加上 `-a codex`。下面的命令会安装到当前项目的 `.agents/skills/` 目录:

```sh
npx skills add codekongdev/plz --skill plz-rig-model -a codex
```

## 用法

把网格模型(`.blend` 或 `.glb`)交给代理，并请它做骨骼绑定。

Claude Code:

```text
/plz-rig-model Rig this cat model so it can walk and run in my game.
```

Codex:

```text
$plz-rig-model Rig this cat model so it can walk and run in my game.
```

请求示例:

- “给这个鸟的模型加上骨骼，生成一个可以做动画的 glb。”
- “给这个四足动物加上骨架、蒙皮和腿部 IK。”
- “告诉我每根骨骼往哪个方向转，用 +1 或 -1 的符号，方便游戏代码使用。”
- “我改了网格，请重新绑定骨骼。”

## 环境要求

- Blender 4.4 或更高版本(已在 5.2 上验证)。技能在后台无窗口运行它: `blender -b --factory-startup -P <script> -- <arguments>`。如果可执行文件不在默认路径，请用环境变量 `BLENDER` 指定。
- numpy 和 glTF 插件使用 Blender 自带的 Python 和插件，因此不需要另外安装 Python 包。
- 系统的 `python3` 只用于两项不需要 Blender 的检查: 针对 `.glb` 的 `rig_axes.py` 和 `inspect_rig.py compare`，它们只使用标准库。
- 不需要网络访问，也不需要 API 密钥。

## 工作方式

身体结构模板(`templates/<name>.json`)以数据形式描述骨骼、权重方法和姿势。骨骼位置来自模型上的特征点(`landmarks.json`)，所以同一身体结构的其他个体只需更换特征点就能完成绑定。

- **模板:** `bird`(站在地面上的鸟，在收拢的翅膀和展开的翅膀之间切换)和 `quadruped`(像猫一样的四足动物，身体、头、尾巴和四条腿是同一个外壳，耳朵和眼睛是独立部件)。其他身体结构按 [references/templates.md](references/templates.md) 的格式新建模板。
- **阶段:** 确认模板和坐标约定([references/conventions.md](references/conventions.md))，准备 `landmarks.json`，绑定，渲染姿势并统计自相交数量，验证(重新导入、与旧版本对比、可复现性、旋转符号表、角度限制)，编写文档和报告。
- **可复现:** 相同的输入得到相同的结果。在已验证的猫的示例中，连 glb 的字节都一致。

## 输入与输出

输入: `.blend` 或 `.glb` 网格模型和 `landmarks.json`。为了帮助填写特征点，技能还可以输出带网格的正交视图图片和一个空的 `landmarks.todo.json`。

| 输出 | 内容 |
| --- | --- |
| `<name>.glb` | 只含形变骨骼的蒙皮网格和基础姿势动画(单位 m，正面 +Z，向上 +Y) |
| `<name>.blend` | 图片已打包，以绑定姿势保存，包含 IK 控制器和检查动作 `rig_test` |
| `<name>.rig-report.json` | 骨骼列表、形变骨骼、各部件的顶点数、无权重顶点、动作、NLA 轨道 |
| `renders/` | 姿势渲染图，以及记录各姿势自相交数量的 `<prefix>_intersections.json` |
| `axes.json` | 在 .blend 和 glb 上测得的按骨骼含义划分的旋转符号表(+1/-1) |

如果有大幅弯曲关节的动作，可以再加一张角度限制表(`sweep_limits.py`)。文件写入你选定的 `--out` 文件夹，工作文件夹默认为 `~/.cache/plz-rig-model/<id>/`。

## 限制

- 只有 `bird` 和 `quadruped` 两个模板经过验证。人形、蛇等其他身体结构需要一个在真实对象上通过检查的新模板。
- bird 的收拢翅膀与展开翅膀之间的切换没有中间形态，需要用快速扇动来遮掩。
- 线性蒙皮没有碰撞检测。关节弯曲过大时可能留下皮肤相互接触的线，这些会作为角度限制记录下来，而不是被消除。
- 不要用 Blender MCP 做骨骼绑定，因为 MCP 的安全模式无法运行已保存的脚本。技能也不会动你已经打开的 Blender 文件。
- 模型需要遵循坐标和命名约定(单位 m、-Y 为正面、左侧为 +X、原点在脚下)，或者是先在 Blender 中修正过的副本。

## 建模流程的一部分

建模流程按 [plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md) 的顺序进行。这个技能是最后一步，但它也接受任何现有的网格模型，而不只是流程的输出: 生成的、购买的或手工制作的模型，只要遵循约定就能使用。返回 [plz](../../README.md)。

工作流程见 [SKILL.md](SKILL.md)，遇到的问题与解决办法见 [references/lessons.md](references/lessons.md)。
