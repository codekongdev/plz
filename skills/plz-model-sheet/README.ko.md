# plz-model-sheet
[English](README.md) | 한국어 | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

게임 캐릭터·동물·NPC·소품을 3D로 모델링하기 전에 쓸 사실적인 실제 크기의 모델링 기준 시트(정사영 시점·턴어라운드)를 만듭니다. 이 스킬은 실측 치수와 오픈 라이선스 사진을 조사하고, Codex 이미지 생성으로 같은 개체의 측면·정면·뒷면·윗면·추가 자세를 만든 뒤, cm 눈금·높이 안내선·색상 키·실측 대조를 한 장에 배치합니다. Claude Code와 Codex에서 사용할 수 있으며, [plz](../../README.md)에 포함된 스킬입니다.

모델링 파이프라인의 일부: **시트**([plz-model-sheet](../plz-model-sheet/README.md)) → **모델**([plz-sheet-to-model](../plz-sheet-to-model/README.md)) → **리그**([plz-rig-model](../plz-rig-model/README.md)).

## 설치

아래 명령은 이 스킬이 저장소에 공개된 뒤 사용할 수 있습니다. 로컬 초안을 써 보려면 에이전트에게 `skills/plz-model-sheet/SKILL.md`를 직접 읽도록 요청하세요.

전역으로 설치:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -g
```

Codex에서는 `-a codex`를 추가합니다. 현재 프로젝트의 `.agents/skills/` 디렉터리에 설치됩니다:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -a codex
```

## 사용법

대상을 말하고, 시트를 어디에 쓸지 알려 주세요. 게임의 충돌체나 캐릭터 배율이 있으면 함께 알려 주세요.

Claude Code:

```text
/plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

Codex:

```text
$plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

요청 예시:

- “Blender로 모델링할 고양이의 턴어라운드와 정사영 기준 그림을 만들어 줘.”
- “비율을 정하기 전에 쓸 NPC의 사실적인 기준 시트가 필요해.”
- “docs/art/cat에 있는 시트의 정면 시점을 고쳐서 다시 만들어 줘.”
- “이 모델링 시트에 웅크린 자세를 추가해 줘.”

## 요구 사항

스킬 자체에는 API 키가 필요 없습니다. 내 컴퓨터에서 다음 도구를 사용합니다.

- **Python 3**와 `venv`, `pip`. 처음 실행하면 `~/.cache/plz-model-sheet/venv`를 만들고 `pillow`와 `numpy`를 설치합니다.
- **Codex CLI**: 이미지 생성이 켜져 있고 로그인된 계정이 필요합니다(`codex features list | grep image_generation`이 `true`이고 `codex login status`가 로그인 상태여야 합니다). 이미지를 한 장 만들 때마다 ChatGPT 사용량이 듭니다. 이미지 생성이 꺼져 있거나 로그인되어 있지 않으면 에이전트가 알려 주고 멈춥니다.
- **헤드리스 Chromium**(예: Playwright가 설치한 것): `sheet.svg`에서 `sheet.webp`를 렌더링합니다. 자동으로 찾으며, 없으면 `MODEL_SHEET_CHROME`에 경로를 지정하세요. 설치된 Google Chrome도 쓸 수 있습니다(Windows에서는 `MODEL_SHEET_CHROME`에 `chrome.exe` 경로를 지정). 없어도 `sheet.svg`는 만들어집니다.
- **네트워크 접근**: 참고 사진을 위해 Wikimedia Commons와 Wikipedia(`scripts/commons_refs.py`)에, 실측 치수를 위해 에이전트의 웹 검색 도구에 접근합니다.

## 작동 방식

1. 대상, 기본 자세, 시점을 정합니다. 프로젝트에 게임 충돌체·눈높이·캐릭터 배율이 있으면 읽어서 시트에 그릴 수 있게 합니다.
2. 공개 자료에서 실측 치수를 조사합니다. 가장 믿을 만한 값 하나가 축척의 기준이 되고 나머지는 검사 항목이 됩니다.
3. 오픈 라이선스 참고 사진(Wikimedia Commons)을 찾아 목표 자세의 깨끗한 측면 사진을 고릅니다.
4. 실제 사진을 첨부해 Codex로 기준 측면을 만들고, 바로 비율을 잽니다. 비율과 자세가 목표와 맞을 때까지 다시 만듭니다.
5. 측면을 “같은 개체”로 첨부해 나머지 시점을 만듭니다. 정면·뒷면은 정사영 지시문으로 원근을 없앱니다.
6. `spec.json`을 쓰고 `prepare_views.py`(배경 제거·자르기)와 `compose_sheet.py`(하나의 실제 크기 축척, 안내선, 충돌체 겹치기, 검사, 색상 키)를 실행합니다.
7. 시트를 눈으로 확인하고 `WARN`을 고친 뒤 README와 `sources.json`을 씁니다.

작업 순서는 [SKILL.md](SKILL.md)에 있습니다. 설정 형식은 [spec.json 형식](references/spec-format.md), 이미지 지시문은 [Codex 지시문](references/codex-prompts.md), 완성된 README와 `sources.json`에 들어갈 내용은 [출력 템플릿](references/output-readme-template.md)에 있습니다.

## 결과물

스킬은 기본으로 `docs/art/<id>/`에 씁니다. 프로젝트에 이미 쓰는 아트 폴더가 있으면 그곳에 씁니다.

| 파일 | 내용 |
| --- | --- |
| `spec.json` | 시점·축척·검사·색상 키 설정 |
| `views/*.webp` | 배경을 지운 시점별 이미지(3D 툴 배경 참조용) |
| `sheet.svg`, `sheet.webp` | 시트. SVG는 `views/`를 불러와 편집할 수 있음 |
| `measurements.json` | 치수·검사 결과·색상 키 |
| `sources.json` | 참고 사진의 저작자·라이선스, 실측 출처, 생성 도구·날짜 |
| `README.md` | 기준, 치수, 무늬와 색, 게임 적용, 만든 방법과 한계, 출처 |

생성 원본과 내려받은 사진은 저장소 밖의 `~/.cache/plz-model-sheet/<id>/`에 둡니다.

## 출처와 한계

- 오픈 라이선스 사진(CC0, CC BY, CC BY-SA, 퍼블릭 도메인)만 쓰며, 저작자와 라이선스는 `sources.json`과 시트에 남깁니다. 실측 치수는 출처 URL과 함께 기록합니다.
- 시점 이미지는 실제 개체를 찍은 사진이 아닌 생성 이미지입니다. 깃털이나 털 배열은 시점마다 다를 수 있고, 생성된 정면·뒷면은 좌우가 대칭입니다. 시트의 README에 이 한계와 남은 `WARN`을 적습니다.
- 생성한 비율이 실측과 크게 다르면 다시 만들거나 보고하며, 숨기지 않습니다. 게임의 충돌체·눈높이·배율과 다른 점은 몰래 고치지 않고 숫자로 적어 팀이 정하게 합니다.
- 요청하지 않으면 커밋하거나 푸시하지 않습니다.

작업 순서는 [SKILL.md](SKILL.md)를 참고하세요.
