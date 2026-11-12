# plz-rig-model
[English](README.md) | 한국어 | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

이미 있는 3D 메시 모델에 게임용 리그를 붙입니다. 헤드리스 Blender로 아마추어, 스킨 웨이트, 다리 IK, 기본 자세 액션, 확인용 자세를 만들고, glTF(`.glb`)와 `.blend`로 내보낸 뒤 자세 렌더, 자기 교차 수, 다시 불러오기로 검증하며, 게임 코드가 쓸 본 회전 방향표(+1/-1)를 냅니다. Claude Code와 Codex에서 사용할 수 있으며, [plz](../../README.md)에 포함된 스킬입니다.

## 설치

아래 명령은 이 스킬이 저장소에 공개된 뒤 사용할 수 있습니다. 로컬 초안을 써 보려면 에이전트에게 `skills/plz-rig-model/SKILL.md`를 직접 읽도록 요청하세요.

전역으로 설치:

```sh
npx skills add codekongdev/plz --skill plz-rig-model -g
```

Codex에서 쓰려면 `-a codex`를 붙입니다. 아래 명령은 현재 프로젝트의 `.agents/skills/`에 설치합니다.

```sh
npx skills add codekongdev/plz --skill plz-rig-model -a codex
```

## 사용법

에이전트에게 메시 모델(`.blend` 또는 `.glb`)을 알려 주고 리깅을 요청하세요.

Claude Code:

```text
/plz-rig-model Rig this cat model so it can walk and run in my game.
```

Codex:

```text
$plz-rig-model Rig this cat model so it can walk and run in my game.
```

요청 예시:

- “이 새 모델에 뼈대를 붙여서 애니메이션을 넣을 수 있는 glb로 만들어 줘.”
- “이 네발짐승에 아마추어, 스키닝, 다리 IK를 붙여 줘.”
- “게임 코드에서 쓸 수 있게 본마다 어느 쪽으로 도는지 +1, -1 부호로 알려 줘.”
- “메시를 고쳤으니 리그를 다시 붙여 줘.”

## 요구 사항

- Blender 4.4 이상(5.2에서 검증). 스킬이 창 없이 백그라운드로 실행합니다: `blender -b --factory-startup -P <script> -- <arguments>`. 실행 파일이 기본 경로에 없으면 `BLENDER` 환경 변수에 경로를 지정하세요.
- numpy와 glTF 애드온은 Blender에 들어 있는 Python과 애드온을 쓰므로 Python 패키지를 따로 설치하지 않습니다.
- 시스템 `python3`는 Blender가 필요 없는 두 가지 확인에만 씁니다. `.glb`에 대한 `rig_axes.py`와 `inspect_rig.py compare`이며, 표준 라이브러리만 사용합니다.
- 네트워크 접속과 API 키는 필요 없습니다.

## 동작 방식

몸 구조 템플릿(`templates/<name>.json`)이 본, 웨이트 방식, 자세를 데이터로 기술합니다. 본 위치는 모델 위의 특징점(`landmarks.json`)에서 오므로, 같은 몸 구조의 다른 개체는 특징점만 바꿔 리깅합니다.

- **템플릿:** `bird`(땅에 서는 새, 접은 날개와 편 날개 전환)와 `quadruped`(고양이 같은 네발짐승, 몸·머리·꼬리·네 다리가 한 껍질이고 귀와 눈은 따로). 다른 몸 구조는 [references/templates.md](references/templates.md)의 형식으로 새 템플릿을 만듭니다.
- **단계:** 템플릿과 좌표 약속 확인([references/conventions.md](references/conventions.md)), `landmarks.json` 준비, 리깅, 자세 렌더와 자기 교차 수 세기, 검증(다시 불러오기, 이전 버전과 비교, 재현성, 회전 방향표, 각도 한계), 문서화와 보고.
- **재현 가능:** 같은 입력이면 같은 결과가 나옵니다. 검증한 고양이 예시에서는 glb 바이트까지 같습니다.

## 입력과 출력

입력: `.blend` 또는 `.glb` 메시 모델과 `landmarks.json`. 특징점을 채울 수 있도록 격자가 붙은 정사영 그림과 빈 `landmarks.todo.json`을 뽑아 줄 수도 있습니다.

| 출력 | 내용 |
| --- | --- |
| `<name>.glb` | 변형 본만 담은 스킨 메시와 기본 자세 애니메이션(단위 m, 정면 +Z, 위 +Y) |
| `<name>.blend` | 이미지 포함, 바인드 자세로 저장, IK 컨트롤과 확인용 액션 `rig_test` 포함 |
| `<name>.rig-report.json` | 본 목록, 변형 본, 부위별 정점 수, 웨이트 없는 정점, 액션, NLA 트랙 |
| `renders/` | 자세 렌더와 자세별 자기 교차 수가 담긴 `<prefix>_intersections.json` |
| `axes.json` | .blend와 glb에서 잰 본 의미별 회전 방향표(+1/-1) |

관절을 크게 굽히는 동작이 있으면 각도 한계표(`sweep_limits.py`)를 더할 수 있습니다. 파일은 고른 `--out` 폴더에 쓰고, 작업 폴더의 기본값은 `~/.cache/plz-rig-model/<id>/`입니다.

## 한계

- 검증된 템플릿은 `bird`와 `quadruped`뿐입니다. 인간형, 뱀 같은 다른 몸 구조는 실제 대상으로 확인을 통과한 새 템플릿이 필요합니다.
- bird의 접은 날개/편 날개 전환에는 중간 형태가 없으므로 빠른 날갯짓으로 가려야 합니다.
- 선형 스키닝에는 충돌이 없습니다. 관절을 크게 굽히면 피부가 맞닿는 선이 남을 수 있고, 이는 없애지 않고 각도 한계로 기록합니다.
- 리깅에는 Blender MCP를 쓰지 마세요. MCP 안전 모드는 저장된 스크립트를 실행하지 못합니다. 스킬은 사용자가 열어 둔 Blender 파일도 건드리지 않습니다.
- 모델이 좌표·이름 약속(단위 m, −Y 정면, 왼쪽 +X, 발밑 원점)을 따르거나, 먼저 Blender에서 고친 사본이어야 합니다.

## 모델링 파이프라인의 일부

모델링 파이프라인은 [plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md) 순서로 진행됩니다. 이 스킬은 마지막 단계이지만 파이프라인의 결과물이 아닌 기존 메시 모델도 받습니다. 생성하거나 구매하거나 직접 만든 모델도 약속을 따르면 쓸 수 있습니다. [plz](../../README.md)로 돌아가기.

작업 순서는 [SKILL.md](SKILL.md)에, 겪은 문제와 해결은 [references/lessons.md](references/lessons.md)에 있습니다.
