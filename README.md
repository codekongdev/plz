# plz

A series of AI coding agent skills by codekongdev.  
Each `plz-<task>` name reads like a request to your agent.

codekongdev(코드콩)가 만드는 AI 코딩 에이전트 스킬을 모은 저장소입니다.
스킬 이름은 `plz-<할 일>` 형식으로, Claude Code에서 `/plz-3d-explain`처럼 부르면 에이전트에게 “~해 줘”라고 부탁하듯 읽히도록 지었습니다.

## 스킬 목록

| 이름 | 설명 | 데모 |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | 기술 개념과 시스템 구조를 three.js 3D 모형으로 공부하는 단일 HTML 학습 페이지를 만듭니다. | [코드 샌드박스](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## 설치

목록 보기:

```sh
npx skills add codekongdev/plz -l
```

하나만 설치:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

전부 설치:

```sh
npx skills add codekongdev/plz --skill '*' -g
```

Codex에서 쓰려면 `-a codex`를 붙입니다. 아래 명령은 지금 프로젝트의 `.agents/skills/`에 설치합니다.

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

수동으로 설치하려면 저장소를 내려받아 `skills/<스킬 이름>` 폴더를 `~/.claude/skills/<스킬 이름>`에 복사하거나 링크합니다.

## 라이선스

[MIT](LICENSE).
