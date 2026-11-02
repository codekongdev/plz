# plz
[English](README.md) | 한국어 | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

codekongdev(코드콩)가 만드는 Claude Code와 Codex용 AI 코딩 에이전트 스킬을 모은 저장소입니다. 스킬 이름은 `plz-<task>` 형식으로, 에이전트에게 “이 일을 해 줘”라고 부탁하듯 읽히도록 지었습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-555555.svg) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-555555.svg)

## 스킬 목록

| 스킬 | 만드는 것 | 데모 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 기술 개념과 시스템 구조를 three.js 3D 모형으로 공부하는 단일 HTML 학습 페이지를 만듭니다. | [코드 샌드박스(한국어)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## 설치

설치할 수 있는 스킬 목록 보기:

```sh
npx skills add codekongdev/plz -l
```

스킬 하나를 전역으로 설치:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

모든 스킬을 전역으로 설치:

```sh
npx skills add codekongdev/plz --skill '*' -g
```

Codex에서 쓰려면 `-a codex`를 붙입니다. 아래 명령은 지금 프로젝트의 `.agents/skills/`에 설치합니다.

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

Claude Code에 수동으로 설치하려면 저장소를 내려받은 뒤 `skills/plz-3d-explain` 폴더를 `~/.claude/skills/plz-3d-explain`에 복사하거나 링크합니다. 복사하는 명령은 다음과 같습니다.

```sh
git clone https://github.com/codekongdev/plz.git
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

[skills.sh의 plz-3d-explain 페이지](https://skills.sh/codekongdev/plz/plz-3d-explain)에서도 확인할 수 있습니다.

## 기여

영어 README가 정본입니다. 번역을 고칠 때 명령, 코드, 링크는 영어판과 똑같이 유지해 주세요. 번역 기여를 환영합니다. 저장소 루트에서 `node scripts/check-readme-translations.mjs`를 실행하면 번역 간 일치 여부와 상대 링크를 확인할 수 있습니다.

## 라이선스

[MIT](LICENSE).
