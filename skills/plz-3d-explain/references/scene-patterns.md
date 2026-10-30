# 장면 패턴

개념의 종류마다 잘 맞는 모형이 있다. 장을 설계할 때 "이 장은 어느 패턴인가"부터 정한다.
모든 코드는 `defineScene`의 `build()` 안에서 쓴다고 가정한다(`g`, `temp`, `a`, `say`는
engine-api.md 참고).

예시 장은 `assets/example-agent-sandbox.html`(AI 에이전트 코드 샌드박스, 10장)의 장 번호다.

| 개념의 모양 | 패턴 | 예시 장(example-agent-sandbox) |
|---|---|---|
| 아래층이 위층을 떠받친다 | 1. 층 | 공용 바닥(하드웨어 → 호스트 커널), 6장의 하이퍼바이저 층 |
| 무언가를 가두거나 막는다 | 2. 경계와 탈출 시도 | 4장 전반, 6장(벽과 하이퍼바이저의 두 겹) |
| 모두가 한 자원을 공유해서 위험하다 | 3. 공유 기반의 결함 | 4장 후반 |
| 모든 요청이 한 지점을 거친다 | 4. 중개 | 2장 |
| 권한이 사슬처럼 넘어간다 | 5. 권한 사슬 | 5장 |
| 허락한 통로로만 드나든다 | 6. 허용 출구 | 7장, 8장(작업 폴더와 프록시 허용 목록) |
| 여러 구성 요소를 거쳐 처리된다 | 7. 요청 경로 | 해당 장 없음(템플릿의 `s2`) |
| 생기고, 유지되고, 멈추고, 되살아난다 | 8. 수명 | 9장 |
| 두 방식을 같은 조건에서 견준다 | 9. 나란한 비교 | 3장(같은 질문, 다른 대답), 10장(네 무대) |

## 1. 층

기반층은 옅은 색 판으로 쌓고, 라벨은 앞 왼쪽 모서리에 층마다 높이를 달리해 붙인다.

```js
base.add(block(13, 0.6, 8, [0, 0, 0]));
const kernel = block(13, 0.45, 8, [0, 0.6, 0], { color: COLOR.boundSoft });
base.add(kernel);
base.add(tag('하드웨어', [-5.6, 0.3, 4.05]));
base.add(tag('호스트 커널', [-5.6, 0.83, 4.05], 'bound'));
const FLOOR = 1.05;                       // 이후 물체를 올릴 윗면 높이
```

중간에 얇은 층이 끼면(하이퍼바이저, 런타임) `boundMid`로 두께 0.2~0.25인 판을 그 위에 올린다.

## 2. 경계와 탈출 시도

주인공이 벽 쪽으로 가고, 벽이 깜빡이고, 제자리로 돌아온다. 템플릿의 `s1`이 이 패턴이다.
경계가 두 겹이면 안쪽 바닥판과 바깥 층을 차례로 깜빡인다.

```js
const p = packet(COLOR.actor, [x, inner + 0.3, z], 0.17); temp.add(p);
await a.move(p, [x, inner + 0.15, z], 500);
await a.flash(innerFloor, COLOR.actor, 800);   // 안쪽은 뚫렸다(빨강)
await a.move(p, [x, midTop + 0.12, z], 500);
await a.flash(midLayer, COLOR.bound, 800);     // 바깥에서 막혔다(파랑)
await a.move(p, [x, inner + 0.6, z], 500); temp.remove(p);
```

색으로 결과를 말한다: 뚫린 곳은 actor, 막은 곳은 bound.

## 3. 공유 기반의 결함

방이 여러 개라도 바닥이 하나면, 바닥의 균열이 모두에게 번진다.

```js
const crack = line([[-0.4, FLOOR + 0.02, 2.6], [0.6, FLOOR + 0.02, 1.5], [2.6, FLOOR + 0.02, 0.7], [4.4, FLOOR + 0.02, -0.4]], COLOR.actor, 0.95);
crack.visible = false; g.add(crack);            // reset 에서 다시 false
// run:
await a.move(actor, [x, FLOOR - 0.2, z], 600);  // 바닥으로 파고든다
crack.visible = true;
await a.flash(kernel, COLOR.actor, 900);
await Promise.all([a.flash(roomB, COLOR.actor, 900), a.flash(roomC, COLOR.actor, 900)]);
```

## 4. 중개

요청을 작은 공으로 만들어 중개층 표면까지 내려보내고, 중개층을 깜빡인 뒤 목표로 보낸다.
요청마다 라벨을 공의 자식으로 붙이면 공과 함께 움직인다.

```js
for (const c of calls) {
  const p = packet(COLOR.actor, src, 0.17); p.add(tag(c.name, [0, 0.45, 0], 'actor')); temp.add(p);
  await a.move(p, [src[0], FLOOR + 0.05, src[2]], 600);
  await a.flash(kernel, COLOR.bound, 600);
  await a.move(p, [c.target[0], FLOOR + 0.08, c.target[2]], 800);   // 중개층 위를 따라 이동
  await a.move(p, c.target, 400);
  temp.remove(p);
}
```

## 5. 권한 사슬

주인공이 권한을 가진 쪽으로 건너가고, 그쪽이 새 공간을 만들어 주는 흐름이다. 관(`tube`)이 통로,
새로 생기는 방은 actor 색 유리로 그린다.

```js
const evil = glass(3.7, 2.2, 1.9, [x, FLOOR, z], { color: COLOR.actor, edge: COLOR.actor, opacity: 0.1 });
evil.visible = false; g.add(evil);              // reset: visible=false, scale 1
// run:
evil.scale.setScalar(0.01); evil.visible = true;
await a.scaleTo(evil, 1, 800);
```

## 6. 허용 출구

구 안에 주인공을 두고, 구 표면에 출구(짧은 원기둥)를 단다. 다른 방향으로 가면 구가 깜빡이고,
출구로는 matter가 드나든다.

```js
const cap = new THREE.Group(); cap.position.copy(center);
const sph = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), mat(COLOR.bound, 0.1));
cap.add(sph); cap.userData.mesh = sph;
for (const rot of [[Math.PI / 2, 0, 0], [0, 0, 0], [0, Math.PI / 2, 0]]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.02, 8, 96), mat(COLOR.bound, 0.85));
  ring.rotation.set(...rot); cap.add(ring);
}
const port = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 18), mat(COLOR.matter));
port.position.copy(dir.clone().multiplyScalar(R));
port.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
cap.add(port);
cap.add(tag('허용: 파일 읽기', dir.clone().multiplyScalar(R + 1.1).add(V(0, 0.35, 0)).toArray(), 'matter'));
```

R은 1.8 안팎이 적당하다. 작으면 출구 라벨과 주인공 라벨이 겹친다.

## 7. 요청 경로

구성 요소를 블록으로 늘어놓고 공을 포물선으로 보낸다. 템플릿의 `s2`가 이 패턴이다.

- 본문에 `<ol class="steps">`로 단계를 적고, `say('1. ...')`의 번호와 맞춘다.
- 바깥 시스템(외부 API, 원천 데이터)은 바닥판 밖에 `COLOR.outside`로 둔다. 그래야 "우리 서버 밖"이 보인다.
- 결과가 쌓이는 곳(표, 차트 같은 산출물)은 처음에 숨겼다가 마지막에 `scaleTo`로 나타낸다.
- 블록 윗면 위치는 `top(o) = [o.position.x, o.position.y + o.userData.h / 2 + 0.5, o.position.z]`로 구한다.

## 8. 수명

자리(슬롯)는 점선 사각형으로 그리고, 자원은 원점이 바닥에 있는 Group으로 만든다. 그래야
`scaleTo`로 바닥에서 솟아오르고 바닥으로 꺼진다. 자원 안의 상태(변수, 캐시)는 그 Group의 자식으로 둔다.

```js
const room = (x, z, name) => {
  const r = new THREE.Group(); r.position.set(x, FLOOR, z);
  r.add(glass(2.2, 1.9, 2.2, [0, 0, 0]));
  r.add(tag(name, [0, 2.25, 0], 'bound'));
  return r;
};
```

- 멈춤과 저장: 자원을 줄이면서 납작한 원판(`COLOR.muted`)을 키우고, 원판을 바닥판 앞쪽(저장소)으로 옮긴다.
- 재개: 원판을 슬롯으로 되가져와 줄이고, 자원을 다시 키운다. 자식 상태가 그대로 돌아오는 것이 요점이다.
- 대기: 슬롯 밖에 점선 유리(`dashed: true, opacity: 0.04`)로 두고 라벨에 "대기 중"을 쓴다. 자리를
  얻으면 라벨 글자를 바꾸는데, reset에서 원래 글자로 되돌린다.

## 9. 나란한 비교

두 무대를 `SCREEN_RIGHT` 방향으로 벌려 놓고, 같은 동작을 `Promise.all`로 동시에 실행한다.
각 무대는 원점이 무대 가운데인 Group이라, 안쪽 좌표를 똑같이 쓸 수 있다.

```js
const side = offset => {
  const s = new THREE.Group();
  s.position.copy(SCREEN_RIGHT.clone().multiplyScalar(offset));
  s.add(block(5.8, 0.5, 5.8, [0, 0, 0]));
  const k = block(5.8, 0.4, 5.8, [0, 0.5, 0], { color: COLOR.boundSoft }); s.add(k);
  const temp = new THREE.Group(); s.add(temp);
  g.add(s);
  return { s, k, temp };
};
const L = side(-4.2), R = side(4.2);
L.s.add(tag('방식 A', [0, 0.25, 3.2], 'big'));
R.s.add(tag('방식 B', [0, 0.25, 3.2], 'big'));
```

무대 하나의 폭이 5.8이면 오프셋 ±4.2, 장면 `fitW`는 18.8 정도가 맞는다.

**"같은 질문, 다른 대답"** 변형이 개념 대비를 설명하는 데 가장 효과적이었다. 양쪽에서 똑같은 요청(공)을
보내고, 그 요청이 어디까지 내려가 누가 대답하는지를 보여 준다. 한쪽은 두 요청이 같은 판으로 모여 그 판이
깜빡이고, 다른 쪽은 각자 자기 판에서 멈춘다. 대답(작은 matter 판)이 질문한 쪽으로 돌아가게 하고 라벨에
"A의 파일만"처럼 내용을 적는다. 예시 3장의 `split` 장면이 이 구조다. 상태 표시(예: "지원 종료", "실험 기능")는
`'warn'` 라벨로 무대 위쪽에 띄우고, 제목 라벨과 높이를 다르게 둔다.
