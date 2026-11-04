# plz-setup-issues
[English](README.md) | 한국어 | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

GitHub 저장소에 재사용할 수 있는 간결한 이슈 분류, 이슈 양식, 검토 규칙을 세팅합니다. Claude Code와 Codex에서 사용할 수 있으며, [plz](https://github.com/codekongdev/plz)에 포함된 스킬입니다.

## 설치

`npx skills`로 설치하려면 Node.js 22.20 이상(npm과 `npx` 포함), Git, 사용할 Claude Code 또는 Codex가 필요합니다. 먼저 터미널에서 도구를 확인합니다.

```sh
node --version
npm --version
git --version
```

사용할 에이전트의 명령을 선택하세요. `-g`로 전역 설치하면 여러 프로젝트에서 사용할 수 있습니다.

Claude Code:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a claude-code -g
```

Codex:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a codex -g
```

현재 프로젝트에서만 쓰려면 해당 프로젝트 폴더에서 위 명령의 `-g`를 빼고 실행합니다. 설치 도구는 `.agents/skills/`에 스킬을 저장하고, Claude Code를 선택하면 연결도 만듭니다.

사용할 에이전트의 설치 목록에 `plz-setup-issues`가 표시되는지 확인합니다.

```sh
npx skills list -g -a claude-code
npx skills list -g -a codex
```

프로젝트에 설치했다면 확인 명령에서도 `-g`를 빼고 같은 프로젝트에서 실행합니다. 목록에 없다면 선택한 에이전트와 설치 범위를 확인하세요. 목록에 있지만 에이전트에서 인식하지 못한다면 사용할 프로젝트에서 새 에이전트 세션을 시작합니다.

## 사용법

설치한 뒤 대상 저장소에서 에이전트를 열고 스킬을 지정해 요청합니다.

- Claude Code: `/plz-setup-issues 이 저장소의 이슈 관리 초기 설정을 해 줘.`
- Codex: `$plz-setup-issues 이 저장소의 이슈 관리 초기 설정을 해 줘.`

로컬 파일만 만들도록 요청하거나, 특정 GitHub 저장소에 라벨까지 적용하도록 명시할 수 있습니다. 변경 전에 기존 설정을 확인하며, 충돌하는 규칙은 해결 방향이 정해질 때까지 보존합니다.

## 기본 구성

- 작업 유형 라벨 5개: `type:bug`, `type:feature`, `type:improvement`, `type:maintenance`, `type:docs`.
- 검토 라벨 2개: `needs-triage`, `needs-info`.
- 버그·기능 요청 양식, `.github/ISSUE_TRIAGE.md`, `.github/labels.json`.
- P0–P3 우선순위: 기존 프로젝트·조직 필드가 있으면 재사용하고, 없으면 `priority:P0`–`priority:P3` 라벨로 관리합니다. 프로젝트 보드는 자동 생성하지 않습니다.
- 영역·영향도·고객사 분류는 필요한 경우에만 추가합니다.

작업 유형은 저장소의 유형 라벨 또는 조직의 Issue Type 중 하나를 주된 체계로 사용해 같은 분류를 중복 관리하지 않습니다.

## 범위

세팅 요청은 대상 저장소에 적용됩니다. 조직 전체 유형 변경, 프로젝트 보드 생성, 기존 이슈 재분류는 별도로 요청한 범위에 포함되어야 합니다. GitHub 변경에는 적절한 인증과 권한이 필요하며, 사용할 수 없어도 로컬 준비는 마칠 수 있습니다.

진행 절차는 [SKILL.md](SKILL.md), 분류를 정하는 기준은 [분류 가이드](references/taxonomy.md), 기본 라벨은 [라벨 목록 파일](assets/labels.json)을 참고하세요.
