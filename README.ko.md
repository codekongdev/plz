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

스킬 하나를 전역으로 설치:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

<details>
<summary>Codex</summary>

Codex에서 쓰려면 `-a codex`를 붙입니다. 아래 명령은 지금 프로젝트의 `.agents/skills/`에 설치합니다.

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

</details>

<details>
<summary>스킬 목록 보기, 전체 설치</summary>

설치할 수 있는 스킬 목록 보기:

```sh
npx skills add codekongdev/plz -l
```

모든 스킬을 전역으로 설치:

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

설치한 뒤에는 에이전트에게 평소 말투로 요청하면 됩니다.

- “컨테이너 격리가 어떻게 동작하는지 3D로 설명해 줘.”
- “TCP 핸드셰이크가 어떻게 이뤄지는지 3D 모형으로 보여 줘.”

영어, 일본어, 중국어 간체로 요청해도 되며, 페이지는 요청한 언어로 만들어집니다.

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
- **페이지를 만들 때:** 로컬 서버와 Playwright 같은 브라우저 자동화 도구로 검증하는 단계가 포함됩니다.

자세한 내용은 [스킬 README](skills/plz-3d-explain/README.md)를 참고해 주세요.

## 스킬 목록

| 스킬 | 만드는 것 | 데모 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 기술 개념과 시스템 구조를 three.js 3D 모형으로 공부하는 단일 HTML 학습 페이지를 만듭니다. | [코드 샌드박스(한국어)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) · [영어](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.en.html) |

## 기여

기여와 번역을 환영합니다. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고해 주세요.

## 라이선스

[MIT](LICENSE).
