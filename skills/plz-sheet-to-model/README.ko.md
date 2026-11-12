# plz-sheet-to-model
[English](README.md) | 한국어 | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

정사영 모델링 기준 시트(측면·윗면·정면·뒷면 이미지와 px/cm, plz-model-sheet의 결과물 등)로 실제 크기의 텍스처 입힌 3D 모델을 만듭니다. Blender를 백그라운드로 실행해 실루엣을 재고, 단면을 이어 붙이고, 시점 이미지를 UV 텍스처로 굽고, 눈·다리·날개·귀를 따로 만든 뒤 `.blend`, `.glb`, 리깅에 넘길 `landmarks.json`, 치수 보고서를 냅니다. Claude Code와 Codex에서 사용할 수 있으며, [plz](../../README.md)에 포함된 스킬입니다.

## 설치

아래 명령은 이 스킬이 저장소에 공개된 뒤 사용할 수 있습니다. 로컬 초안을 써 보려면 에이전트에게 `skills/plz-sheet-to-model/SKILL.md`를 직접 읽도록 요청하세요.

전역으로 설치:

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -g
```

Codex에서는 `-a codex`를 붙입니다. 현재 프로젝트의 `.agents/skills/` 디렉터리에 설치됩니다.

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -a codex
```

## 사용법

기준 시트 폴더(시점 이미지와 `measurements.json`)를 에이전트에게 알려 주고 모델을 요청하세요.

Claude Code:

```text
/plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

Codex:

```text
$plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

요청 예시:

- “이 기준 시트로 모델링해서 glb를 뽑아줘.”
- “이 3면도로 Blender 모델을 만들어줘.”
- “시트를 고쳤으니 모델을 v003으로 다시 만들어줘.”
- “모델을 시트와 비교해서 치수 차이를 보여줘.”

## 요구 사항

- Blender 4.2 이상(5.2에서 검증). 스킬은 창 없이 백그라운드로 실행합니다: `blender -b --factory-startup -P <script> -- <arguments>`. 실행 파일이 `PATH`에도, macOS 기본 경로에도 없으면 `BLENDER` 환경 변수에 경로를 지정하세요.
- 측정·비교 스크립트(`grid.py`, `measure_views.py`, `compare_models.py`)에는 Pillow와 numpy가 있는 Python 3이 필요합니다. 처음 쓸 때 스킬이 `~/.cache/plz-sheet-to-model/venv`에 가상 환경을 만들고 `pip`로 두 패키지를 설치하므로, Python 패키지 저장소에 접속할 수 있어야 합니다.
- Blender 안에서는 Blender에 들어 있는 Python, numpy, Cycles(CPU 굽기), glTF 내보내기를 그대로 쓰므로 따로 설치하는 것이 없습니다.
- API 키도, 그 밖의 네트워크 접속도 필요 없습니다.

## 동작 방식

손으로 정한 값은 모두 대상별 `spec.json`([references/spec-format.md](references/spec-format.md)) 하나에 남기므로, 시트를 고치거나 버전을 올린 뒤 다시 만들 때 명령 두 줄로 같은 결과가 나옵니다.

- **단계:** 입력 확인, spec 작성, 시점 측정(`measure_views.py`), 모델 빌드(`build_model.py`), 렌더·시트 위 화소 겹침·치수 보고서로 확인(`inspect_model.py`, `overlay_views.py`, `compare_models.py`), 파일 배치와 보고.
- **새(bird):** 한 관으로 읽히는 몸의 단면 잇기, 레이캐스트로 넣는 눈, Skin 모디파이어 다리와 발가락, 접은 날개 껍질, 편 날개.
- **네발짐승(quadruped):** 몸+꼬리 단면 잇기, 다리 캡슐과 발 타원체를 SDF로 합친 한 겹의 닫힌 껍질, 얇은 귀 부품, 앞을 보는 눈. 껍질이 하나라 리깅 뒤 다리를 크게 흔들어도 안에 묻힌 면이 뚫고 나오지 않습니다.
- **재현 가능:** 같은 입력으로 다시 빌드하면 측정값, 텍스처, 메시, landmarks가 같습니다. glb의 눈 삼각형 순서만 내보낼 때마다 바뀝니다([references/lessons.md](references/lessons.md)).

## 입력과 출력

입력: `views/*.webp`(배경을 지운 이미지. 측면·윗면은 머리가 오른쪽, 정면·뒷면은 똑바로, 선택 사항인 활공 시점은 머리가 위)와 `measurements.json`이 있는 기준 시트 폴더, 그리고 에이전트가 함께 작성하는 `spec.json`.

| 출력 | 내용 |
| --- | --- |
| `spec.json` | 대상별 설정. 손으로 정한 값 전부 |
| `<id>_<ver>.blend` | 부위 오브젝트, 최종 재질과 투영 재질, 모든 이미지 패킹 |
| `<id>_<ver>.glb` | 게임용. 서브디비전 적용, 불투명 텍스처는 JPEG, 알파 텍스처는 PNG |
| `<id>_<ver>.landmarks.json` | plz-rig-model에 넘길 특징점·부위 이름·영역([references/conventions.md](references/conventions.md)) |
| `<id>_<ver>.report.json` | 치수, 눈 위치, 오브젝트별 삼각형 수, 파일 크기, 시트와의 차이 |

빌드는 `~/.cache/plz-sheet-to-model/<id>/` 아래 작업 폴더에서 진행합니다. 확인이 끝나면 파일을 프로젝트로 복사하며, 기본 위치는 `docs/art/<id>/model/`입니다. 모델은 m 단위, Z 위, 정면 -Y(glTF +Z), 왼쪽 +X, 원점은 발밑을 씁니다.

## 한계

- 검증된 몸 구조는 새와 네발짐승뿐입니다(새는 새 모델로, 네발짐승은 고양이 모델로 검증). 사람·두 발 짐승, 날개 달린 네발짐승, 긴 털이 실루엣을 바꾸는 대상은 아직 전략이 없으며, 스킬은 추측하지 않고 지원하지 않는다고 말합니다.
- 아래에서 본 시점이 없으면 배 아래 무늬가 늘어납니다.
- 텍스처에 시트 조명이 섞여 있고, 각도에 따라 바뀌는 광택(목 깃털 등)은 고정색이 됩니다.
- 리그 없이 새 크기·고양이 크기 대상의 일반적인 무게는 삼각형 약 3.4만 개, glb 약 2.6MB(새 크기) 또는 약 1.2MB(고양이 크기)입니다. 일반적인 수치이며 보장은 아닙니다.
- 빌드에 Blender MCP를 쓰지 마세요. MCP 안전 모드는 numpy, 파일 읽기, 다른 `.blend` 열기를 막습니다. 스킬은 Blender를 백그라운드로 실행하며 사용자가 열어 둔 Blender 파일은 건드리지 않습니다.
- 리깅은 이 스킬의 범위가 아닙니다. plz-rig-model을 쓰세요.

## 모델링 파이프라인의 일부

모델링 파이프라인은 [plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md) 순서로 진행됩니다. 이 스킬은 가운데 단계로, 기준 시트를 모델로 만들고 `landmarks.json`을 리깅에 넘깁니다. [plz](../../README.md)로 돌아가기.

작업 절차는 [SKILL.md](SKILL.md)를, 겪은 문제와 해결은 [references/lessons.md](references/lessons.md)를 참고하세요.
