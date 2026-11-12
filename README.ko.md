# plz
[English](README.md) | 한국어 | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

codekongdev(코드콩)가 만드는 Claude Code와 Codex용 AI 코딩 에이전트 스킬입니다. 첫 번째 스킬인 `plz-3d-explain`은 어떤 기술 개념이든 직접 조작하며 공부하는 3D 학습 페이지로 만들어 줍니다.

스킬 이름은 `plz-<task>` 형식으로, 에이전트에게 “이 일을 해 줘”라고 부탁하듯 읽히도록 지었습니다.

[라이브 데모](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) · [설치](#설치) · [사용법](#사용법) · [스킬 목록](#스킬-목록)

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html"><img src="skills/plz-3d-explain/docs/demo-desktop.png" alt="왼쪽에 설명 글, 오른쪽에 컨테이너 3D 모형이 있는 데스크톱 화면" width="610"></a>
  <img src="skills/plz-3d-explain/docs/demo-mobile.png" alt="휴대폰에서 위쪽 OS 샌드박스 3D 모형과 아래쪽 설명을 보는 화면" width="176">
</p>
<p align="center"><em>데스크톱: 한국어 데모 4장. 컨테이너는 프로세스를 격리하지만 호스트 커널은 함께 씁니다. 휴대폰: 8장 OS 샌드박스. 영어 데모는 아래 스킬 목록에 있습니다.</em></p>

https://github.com/user-attachments/assets/eb09c80d-4260-46b4-ae61-092b9f979167

이런 한 줄 요청이면 시작할 수 있으며, 위 데모는 이런 주제 중 하나를 다룹니다. 예시 요청은 영어이지만 한국어로 요청해도 됩니다.

```text
Explain how an AI agent code sandbox works in 3D.
```

## 설치

`npx skills`로 설치하려면 **Node.js 22.20 이상**(npm과 `npx` 포함), **Git**, 사용할 Claude Code 또는 Codex가 필요합니다. 터미널에서 먼저 확인하세요.

```sh
node --version
npm --version
git --version
```

사용할 에이전트에 맞는 명령을 실행합니다. 아래 명령은 `plz-3d-explain`을 전역으로 설치해 여러 프로젝트에서 쓸 수 있게 합니다.

Claude Code:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a claude-code -g
```

Codex:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex -g
```

한 프로젝트에만 설치하려면 해당 프로젝트 폴더에서 위 명령의 `-g`를 빼고 실행하세요. Claude Code는 `.claude/skills/`, Codex는 `.agents/skills/`를 사용합니다. 설치 도구가 확인을 요청하면 안내에 따라 진행합니다.

사용할 에이전트의 설치 목록을 확인합니다.

```sh
npx skills list -g -a claude-code
npx skills list -g -a codex
```

해당 목록에 `plz-3d-explain`이 있으면 됩니다. 프로젝트에만 설치했다면 같은 프로젝트 폴더에서 목록 명령의 `-g`도 빼고 실행하세요.

<details>
<summary>스킬 목록 보기, 전체 설치</summary>

설치할 수 있는 스킬 목록 보기:

```sh
npx skills add codekongdev/plz -l
```

모든 스킬을 전역으로 설치합니다. 에이전트 선택을 요청하면 사용할 도구를 고르세요.

```sh
npx skills add codekongdev/plz --skill '*' -g
```

</details>

<details>
<summary>수동 설치(Claude Code)</summary>

Claude Code에 수동으로 설치하려면 저장소를 내려받은 뒤 `skills/plz-3d-explain` 폴더를 `~/.claude/skills/plz-3d-explain`에 복사하거나 링크합니다. 복사하는 명령은 다음과 같습니다.

```sh
git clone https://github.com/codekongdev/plz.git
mkdir -p ~/.claude/skills
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

</details>

[skills.sh의 plz-3d-explain 페이지](https://skills.sh/codekongdev/plz/plz-3d-explain)에서도 확인할 수 있습니다.

## 사용법

페이지를 만들 프로젝트에서 에이전트의 새 세션을 시작합니다. 스킬을 직접 지정해 요청할 수 있습니다.

- **Claude Code:** `/plz-3d-explain 컨테이너 격리가 어떻게 동작하는지 3D로 설명해 줘.`
- **Codex:** `$plz-3d-explain 컨테이너 격리가 어떻게 동작하는지 3D로 설명해 줘.`

평소 말투로 요청해도 됩니다.

- “컨테이너 격리가 어떻게 동작하는지 3D로 설명해 줘.”
- “TCP 핸드셰이크가 어떻게 이뤄지는지 3D 모형으로 보여 줘.”

영어, 일본어, 중국어 간체로 요청해도 되며, 페이지는 요청한 언어로 만들어집니다.

스킬이 보이지 않으면 위 목록 명령으로 에이전트와 설치 범위를 확인한 뒤 새 세션을 시작하세요. 프로젝트에만 설치한 스킬은 설치한 프로젝트에서 사용해야 합니다. `npx`가 없거나 Node.js 버전 오류가 나오면 위 준비물을 확인하세요.

## 동작 방식

페이지를 요청하면 `plz-3d-explain`은 네 단계로 작업합니다.

1. **자료 확인.** 주제나 저장소의 자료를 확인하고, 출처와 확인일을 남기며, 확인하지 못한 내용은 따로 표시합니다.
2. **장 구성.** 페이지가 다룰 장을 구성하고, 장마다 모형에서 원인과 결과를 보여 주는 동작을 정합니다.
3. **템플릿 채우기.** 템플릿에 글과 장면을 채웁니다. 결과물은 빌드가 필요 없는 단일 HTML입니다.
4. **브라우저 검증.** 완성한 페이지에서 콘솔 오류, 라벨 겹침·잘림, 가로 스크롤, 자동 실행, 터치 조작을 확인합니다.

## 범위와 필요한 것

- **알맞은 경우:** 기술 개념, 동작 원리, 시스템 구조를 3D 모형으로 공부할 때 알맞습니다.
- **대상이 아닌 것:** 정적 아키텍처·시퀀스 다이어그램, 데이터 차트, Blender 모델링, 제품 랜딩 페이지, 앱 UI 디자인.
- **페이지를 열 때:** three.js r170과 웹폰트를 CDN에서 받으므로 인터넷 연결이 필요합니다.
- **페이지를 만들 때:** 로컬 HTTP 서버(스킬 예시는 Python 3)와 에이전트가 사용할 수 있는 Playwright 같은 브라우저 자동화 도구가 필요합니다.

스킬 설치 명령이 Python이나 브라우저 자동화 도구까지 설치하지는 않습니다. 도구가 없다면 검증 전에 에이전트에게 준비를 요청하세요. HTML이 만들어졌다는 것만으로 브라우저 검증까지 통과한 것은 아니므로, 결과 보고에서 실제로 실행한 검증을 확인하세요.

자세한 내용은 [스킬 README](skills/plz-3d-explain/README.md)를 참고해 주세요.

## 스킬 목록

| 스킬 | 만드는 것 | 데모 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 기술 개념과 시스템 구조를 three.js 3D 모형으로 공부하는 단일 HTML 학습 페이지를 만듭니다. | [코드 샌드박스(한국어)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) · [영어](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.en.html) |
| [plz-setup-issues](skills/plz-setup-issues/README.md) | GitHub 저장소의 이슈 라벨, 버그·기능 요청 양식, 검토 규칙을 세팅합니다. | — |
| [plz-quiz](skills/plz-quiz/README.md) | 문서 기반 퀴즈로 공부하고 이해도를 확인하며 오답을 복습합니다. | — |
| [plz-model-sheet](skills/plz-model-sheet/README.md) | 캐릭터, 동물, NPC, 소품을 위한 사실적인 실제 크기 모델링 기준 시트(정사영 도면과 턴어라운드)를 만듭니다. | — |
| [plz-sheet-to-model](skills/plz-sheet-to-model/README.md) | 기준 시트로 Blender를 백그라운드로 실행해 실제 크기의 텍스처 입힌 3D 모델(`.blend`, `.glb`)을 만듭니다. | — |
| [plz-rig-model](skills/plz-rig-model/README.md) | 이미 있는 메시 모델에 게임용 리그(아마추어, 스킨 웨이트, 다리 IK, 기본 자세, 본 회전 방향표)를 붙입니다. | — |

### 모델링 파이프라인

스킬 세 개가 게임용 3D 모델을 만드는 파이프라인을 이룹니다. [plz-model-sheet](skills/plz-model-sheet/README.md) → [plz-sheet-to-model](skills/plz-sheet-to-model/README.md) → [plz-rig-model](skills/plz-rig-model/README.md) 순서이며, 각 스킬은 따로 써도 됩니다.

- **plz-model-sheet**는 대상(캐릭터, 동물, NPC, 소품)을 받아 실측 치수, 오픈 라이선스 사진, Codex 이미지 생성으로 실제 크기의 정사영 기준 시트를 만듭니다.
- **plz-sheet-to-model**은 그 시트의 시점 이미지와 치수를 받아 텍스처가 입혀진 `.blend`와 `.glb`(새 또는 네발짐승 몸 구조), 그리고 리깅에 넘길 `landmarks.json`을 만듭니다.
- **plz-rig-model**은 메시 모델(이 파이프라인이든 다른 곳에서 온 것이든 `.blend` 또는 `.glb`)과 `landmarks.json`을 받아 리그를 붙이고, `.glb`와 `.blend`, 본 회전 방향표를 내보냅니다.

API 키가 필요한 스킬은 없습니다. 내 컴퓨터에서 쓰는 도구는 다음과 같습니다.

- **plz-model-sheet:** Python 3(처음 실행할 때 캐시 venv에 `pillow`와 `numpy`를 설치합니다), 이미지 생성이 켜져 있고 로그인된 Codex CLI(이미지마다 ChatGPT 사용량이 듭니다), `sheet.webp`를 그리는 헤드리스 Chromium(없으면 `sheet.svg`만 나옵니다), Wikimedia Commons와 Wikipedia에 접속할 수 있는 네트워크.
- **plz-sheet-to-model:** 백그라운드로 실행하는 Blender 4.2 이상과 Python 3(처음 실행할 때 캐시 venv에 `pillow`와 `numpy`를 설치하므로 Python 패키지 인덱스에 접속할 수 있어야 합니다).
- **plz-rig-model:** 백그라운드로 실행하는 Blender 4.4 이상. 따로 설치할 Python 패키지도, 네트워크 접속도 필요 없습니다.

세트로 설치하려면 이름마다 단일 스킬 설치 명령을 실행합니다. Claude Code:

```sh
for skill in plz-model-sheet plz-sheet-to-model plz-rig-model; do
  npx skills add codekongdev/plz --skill "$skill" -a claude-code -g
done
```

Codex:

```sh
for skill in plz-model-sheet plz-sheet-to-model plz-rig-model; do
  npx skills add codekongdev/plz --skill "$skill" -a codex -g
done
```

자세한 내용은 각 스킬의 README에 있습니다.

## 기여

기여와 번역을 환영합니다. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고해 주세요.

## 라이선스

[MIT](LICENSE).
