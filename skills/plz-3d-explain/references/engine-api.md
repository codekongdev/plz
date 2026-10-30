# 엔진 API

`assets/template.html`의 `ENGINE` 구역이 제공하는 것. 장면은 `SCENES` 구역에서 이 함수들만으로 만든다.

## 좌표와 크기

- 단위는 임의의 월드 단위다. 공용 바닥은 13×8, 블록은 보통 2~3 크기, 주인공 정육면체는 0.6이다.
- y가 위쪽이다. 카메라는 `HOME_DIR = (1, 1.15, 1.22)` 방향에서 원점을 내려다본다. 그래서 화면에서
  +x는 오른쪽 아래, -z는 오른쪽 위, +z는 왼쪽 아래로 간다.
- `SCREEN_RIGHT`는 화면 가로 방향의 월드 벡터다. 두 대상을 화면에서 나란히 놓을 때 쓴다(scene-patterns의 비교 패턴).
- **`block`·`glass`·`actorCube`·`matterBlock`의 `pos` y는 바닥 높이다.** 만든 뒤 `group.position`은
  중심이다. 그래서 `a.move`로 옮길 때는 중심 좌표를 준다. 높이 h인 물체를 윗면 Y인 판 위에 올리려면
  y = Y + h/2 로 준다.

## 색

```js
COLOR.model, COLOR.ink, COLOR.outside, COLOR.muted          // 중립: 흰 모형, 잉크, 바깥 시스템, 멈춘 것
COLOR.actor, COLOR.actorEdge                                // 주인공(빨강)
COLOR.bound, COLOR.boundSoft, COLOR.boundMid                // 경계(파랑), 옅은 판, 중간 판
COLOR.matter, COLOR.matterEdge                              // 재료(황동)
```

층을 구분할 때는 `boundSoft`(커널 같은 기반층)와 `boundMid`(그 위의 얇은 중개층)를 쓴다.
CSS 변수(`--actor` 등)를 바꾸면 `COLOR`도 같이 바꾼다.

## 부품

| 함수 | 반환 | 용도 |
|---|---|---|
| `block(w, h, d, pos, opts)` | Group | 직육면체. opts: `color`, `opacity`, `edge`(null이면 윤곽선 없음), `edgeOpacity`, `dashed`, `cast` |
| `glass(w, h, d, pos, opts)` | Group | 유리방(경계). 기본 투명도 0.08. `dashed: true, opacity: 0.04`면 "있으나 마나 한 벽" |
| `actorCube(pos, label)` | Group | 주인공 정육면체. 라벨이 자식으로 붙어 함께 움직인다. `label=null`이면 라벨 없음 |
| `matterBlock(pos, h, w)` | Group | 데이터·파일 더미 |
| `packet(color, pos, r)` | Mesh | 움직이는 공(요청, 신호, 시스템 콜) |
| `tube(from, to, r, color)` | Mesh | 두 점을 잇는 관(소켓, 전용 통로) |
| `arrow(from, to, color)` | Group | 선 + 원뿔(바깥으로 나가는 출구 표시) |
| `line(points, color, opacity, dashed)` | Line | 점선 슬롯, 제어선, 균열 |
| `tag(text, pos, kind)` | CSS2DObject | 라벨. kind: `''`, `'actor'`, `'bound'`, `'matter'`, `'warn'`(검은 바탕), `'big'`(세리프 큰 제목) |

모든 Group은 `userData.mesh`(색을 바꿀 메시)와 `userData.h`(높이)를 가진다.

## 장면 정의

```js
defineScene('name', {
  title: '3  컨테이너',      // 무대 왼쪽 위에 보이는 제목. "번호 두 칸 띄우고 제목"
  base: true,               // 공용 바닥(base 그룹)을 보일지
  target: [0.3, 1.1, 0],    // 카메라가 바라볼 점
  fitW: 17, fitH: 11.5,     // 무대에 반드시 들어와야 하는 가로·세로 월드 폭
  build() {
    const g = new THREE.Group();
    const temp = new THREE.Group(); g.add(temp);   // 실행 중에 생겼다 사라지는 것
    // ... 부품을 g 에 추가
    return {
      group: g,
      reset() { /* run 이 바꾼 위치·크기·visible·라벨 글자를 되돌린다. temp.clear() */ },
      async run(a, say) { /* a: 애니메이터, say(text): 결과 문장 */ },
    };
  },
});
```

- 공용 바닥은 `base` 그룹에 `SCENES` 구역 맨 앞에서 한 번만 채운다. 여러 장이 같은 서버, 같은 바닥을
  공유할 때 장 전환이 매끄러워진다. 전혀 다른 무대가 필요한 장은 `base: false`로 두고 자기 바닥을 만든다.
- 공용 바닥의 물체를 장면에서 깜빡이게 해도 된다. 장이 바뀌거나 다시 실행될 때 엔진이 색을 되돌린다.
- 장 순서는 `defineScene`을 부른 순서와 상관없다. 본문의 `data-scene`이 순서를 정한다.

## 애니메이터 `a`

| 메서드 | 설명 |
|---|---|
| `await a.move(obj, to, ms=700, lift=0)` | 중심을 `to`([x,y,z] 또는 Vector3)로 옮긴다. `lift`를 주면 포물선으로 넘어간다 |
| `await a.flash(obj, color, ms=700, hold=false)` | 색이 바뀌었다 돌아온다. 투명한 유리도 잠깐 진해진다. "막혔다", "확인했다", "뚫렸다" 표시에 쓴다. `hold`면 바뀐 채로 둔다 |
| `await a.scaleTo(obj, s, ms=500)` | 크기를 바꾼다. 생성: `obj.scale.setScalar(0.001)` 후 `scaleTo(obj, 1)`. 소멸: `scaleTo(obj, 0.001)` 후 `obj.visible = false` |
| `await a.wait(ms)` | 다음 단계 전에 읽을 시간을 준다. 결과 문장 하나당 1000~1300ms가 적당하다 |
| `await a.tween(ms, t => ...)` | 그 밖의 값 보간(0→1, ease 적용) |
| `a.live()` | 이 실행이 아직 유효한지 |

- 동시에 일어나는 일은 `await Promise.all([...])`로 묶는다.
- 사용자가 다른 장으로 넘어가면 진행 중인 실행이 끊긴다(CANCEL). 직접 처리할 것은 없다.
- 줄어든 동작 설정(`prefers-reduced-motion`)이면 모든 보간이 즉시 끝난다.

## 검증 훅 `window.__explainer`

| 메서드 | 반환 |
|---|---|
| `scenes()` | 장면 이름 배열 |
| `current()` | 무대가 지금 보여 주는 장면 이름. 스크롤했을 때 화면에서 읽는 장과 맞는지 본다 |
| `autorun(on?)` | 자동 실행 상태(true/false)를 돌려준다. 불리언을 주면 그 값으로 바꾸고(켜면 읽고 있는 장을 바로 실행하고 반복, `localStorage`에 저장) 새 상태를 돌려준다 |
| `azimuth()` | 카메라 방위각(라디안). 모형이 돌았는지 확인할 때 쓴다 |
| `await run(name)` | 그 장으로 스크롤하고, 동작을 끝까지 실행한 뒤 마지막 결과 문장을 돌려준다. 나란한 배치에서는 장을 화면 가운데로, 세로 휴대폰에서는 장 맨 위를 무대 바로 아래로 스크롤한다 |
| `overlaps(minArea=24)` | 지금 보이는 라벨 중 서로 겹치는 쌍 `[글자, 글자, 겹친 면적px²]` |
| `clipped()` | 캔버스 칸(`wrap`) 밖으로 나간 라벨의 글자 목록. 데스크톱에서는 캔버스 칸이 무대 전체와 같고, 휴대폰에서는 제목줄과 범례줄을 뺀 칸이다 |

- 무대 폭이 700px 미만이면 엔진의 `declutter()`가 라벨을 캔버스 안쪽으로 당기고, 겹치면 비켜 놓는다(상한 56px).
  상한을 넘는 겹침은 그대로 남아 `overlaps()`에 잡힌다.

## 자동 실행

무대 제목줄(HUD) 오른쪽의 "자동 실행" 스위치(`button.autorun`, `role="switch"`, `aria-checked`)다.

- 기본은 꺼짐이다. 켠 상태는 `localStorage`(`plz-3d-explain:autorun`)에 기억한다. 읽기·쓰기가 막혀도 오류 없이 그 방문에서만 유지된다.
- 켜져 있으면 읽는 장의 동작을 반복 재생한다. 한 바퀴는 이 순서다.
  1. 장이 읽는 줄에 들어선 뒤 `AUTORUN_DELAY`(600ms, 장면 전환이 끝나고 처음 상태를 볼 시간)를 기다린다.
  2. 그 장의 `[data-run]` 버튼을 누른 것과 같은 동작을 끝까지 실행한다.
  3. 끝 상태와 마지막 결과 문장을 `AUTORUN_HOLD`(2800ms) 동안 보여 준다.
  4. `reset()`으로 장면을 되돌리고 결과 문장(`.result`)도 비운다. 처음 상태를 `AUTORUN_DELAY`(600ms) 동안 보여 준다.
  5. 2번으로 돌아간다. 한 바퀴는 동작 시간 + 약 3.4초다(동작이 6.5초면 약 9.9초).
- 두 시간 상수는 `ENGINE`의 `AUTORUN_DELAY`, `AUTORUN_HOLD`다. 장면을 짜는 쪽은 `reset()`이 `run()`이 바꾼 것(위치, 크기, 표시 여부, 라벨 글자)을 전부 되돌리게만 만든다.
- 타이머는 `armAuto` 하나로만 걸어서 항상 하나 이하다. 반복이 쌓이거나 같은 장이 겹쳐 실행되지 않는다.
- 다른 장으로 넘어가면 기존 CANCEL로 끊기고 새 장에서 처음부터 돈다. 짧은 시간에 여러 장을 지나가면 마지막 장만 시작한다. 같은 장에 계속 머무는 동안에는 시작을 다시 걸지 않고 반복만 이어진다.
- 반복 중에 장의 버튼을 누르면 그 자리에서 처음부터 다시 실행하고, 그 실행이 끝나면 반복이 이어진다.
- 탭이 숨겨지면(`document.hidden`) 대기 중인 타이머를 멈추고, 다시 보이면 reset 상태에서 이어서 돈다. 숨겨진 동안 끝난 동작 뒤에도 reset하지 않는다.
- `[data-run]` 버튼이 없는 요소(도입부, 용어 정리)에서는 실행하지 않는다. 페이지 맨 위(스크롤 40px 이하, `TOP_HOLD`)에서도 실행하지 않는다. 나란한 배치에서는 도입부 바로 아래 1장이 읽는 줄에 걸려 있기 때문이다.
- 장이 활성인 상태에서 스위치를 켜면 그 장을 바로 실행한다(맨 위가 아닐 때). 끄면 대기 중인 반복은 사라지고, 진행 중인 동작은 끝까지 간 뒤 더 반복하지 않는다.
- 장마다 있는 버튼은 스위치와 상관없이 늘 동작한다. `__explainer.run(name)`도 마찬가지다.
