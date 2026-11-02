# plz
[English](README.md) | 한국어 | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

codekongdev(코드콩)가 만드는 Claude Code와 Codex용 AI 코딩 에이전트 스킬입니다. 첫 번째 스킬인 `plz-3d-explain`은 어떤 기술 개념이든 직접 조작하며 공부하는 3D 학습 페이지로 만들어 줍니다.

스킬 이름은 `plz-<task>` 형식으로, 에이전트에게 “이 일을 해 줘”라고 부탁하듯 읽히도록 지었습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html"><img src="skills/plz-3d-explain/docs/demo-desktop.png" alt="왼쪽에 설명 글, 오른쪽에 컨테이너 3D 모형이 있는 데스크톱 화면" width="800"></a>
</p>
<p align="center"><em>데모 4장: 컨테이너는 프로세스를 격리하지만 호스트 커널은 함께 씁니다.</em></p>

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
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

</details>

[skills.sh의 plz-3d-explain 페이지](https://skills.sh/codekongdev/plz/plz-3d-explain)에서도 확인할 수 있습니다.

## 사용법

설치한 뒤에는 에이전트에게 평소 말투로 요청하면 됩니다.

- “컨테이너 격리가 어떻게 동작하는지 3D로 설명해 줘.”
- “TCP 핸드셰이크가 어떻게 이뤄지는지 3D 모형으로 보여 줘.”

## 스킬 목록

| 스킬 | 만드는 것 | 데모 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 기술 개념과 시스템 구조를 three.js 3D 모형으로 공부하는 단일 HTML 학습 페이지를 만듭니다. | [코드 샌드박스(한국어)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## 기여

기여와 번역을 환영합니다. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고해 주세요.

## 라이선스

[MIT](LICENSE).
