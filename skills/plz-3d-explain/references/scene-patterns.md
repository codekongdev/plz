# Scene patterns

Each kind of concept has a model that fits it. When designing a chapter, first decide "which pattern is this chapter?".
Assume all code is written inside `build()` of `defineScene` (for `g`, `temp`, `a`, and `say`, see
engine-api.md).

The example chapters are the chapter numbers of `assets/example-agent-sandbox.html` (AI-agent code sandbox, 10 chapters).

| Shape of the concept | Pattern | Example chapter (example-agent-sandbox) |
|---|---|---|
| The lower layer supports the upper layer | 1. Layers | The shared floor (hardware → host kernel), the hypervisor layer in chapter 6 |
| Something is confined or blocked | 2. Boundary and escape attempt | First half of chapter 4, chapter 6 (two layers: wall and hypervisor) |
| Everyone shares one resource, which is dangerous | 3. Flaw in a shared foundation | Second half of chapter 4 |
| Every request passes through one point | 4. Intermediary | Chapter 2 |
| Authority is handed along like a chain | 5. Authority chain | Chapter 5 |
| Things come and go only through allowed passages | 6. Allowed exit | Chapter 7, chapter 8 (working folder and proxy allowlist) |
| Handled by passing through several components | 7. Request path | No such chapter (the template's `s2`) |
| Created, kept, stopped, and revived | 8. Lifetime | Chapter 9 |
| Two approaches compared under the same conditions | 9. Side-by-side comparison | Chapter 3 (same question, different answer), chapter 10 (four stages) |

## 1. Layers

Stack the base layers as light-colored slabs, and attach labels at the front left corner, at a different height for each layer.

```js
base.add(block(13, 0.6, 8, [0, 0, 0]));
const kernel = block(13, 0.45, 8, [0, 0.6, 0], { color: COLOR.boundSoft });
base.add(kernel);
base.add(tag('Hardware', [-5.6, 0.3, 4.05]));
base.add(tag('Host kernel', [-5.6, 0.83, 4.05], 'bound'));
const FLOOR = 1.05;                       // top surface height for objects placed afterward
```

When a thin layer sits in between (hypervisor, runtime), put a slab 0.2-0.25 thick on top of it in `boundMid`.

## 2. Boundary and escape attempt

The actor heads for the wall, the wall flashes, and the actor returns to its place. The template's `s1` is this pattern.
If the boundary has two layers, flash the inner floor slab and then the outer layer in turn.

```js
const p = packet(COLOR.actor, [x, inner + 0.3, z], 0.17); temp.add(p);
await a.move(p, [x, inner + 0.15, z], 500);
await a.flash(innerFloor, COLOR.actor, 800);   // the inside was breached (red)
await a.move(p, [x, midTop + 0.12, z], 500);
await a.flash(midLayer, COLOR.bound, 800);     // blocked on the outside (blue)
await a.move(p, [x, inner + 0.6, z], 500); temp.remove(p);
```

Tell the result with color: the breached place is actor, the place that blocked is bound.

## 3. Flaw in a shared foundation

Even with several rooms, if there is one floor, a crack in the floor spreads to everyone.

```js
const crack = line([[-0.4, FLOOR + 0.02, 2.6], [0.6, FLOOR + 0.02, 1.5], [2.6, FLOOR + 0.02, 0.7], [4.4, FLOOR + 0.02, -0.4]], COLOR.actor, 0.95);
crack.visible = false; g.add(crack);            // set to false again in reset
// run:
await a.move(actor, [x, FLOOR - 0.2, z], 600);  // digs into the floor
crack.visible = true;
await a.flash(kernel, COLOR.actor, 900);
await Promise.all([a.flash(roomB, COLOR.actor, 900), a.flash(roomC, COLOR.actor, 900)]);
```

## 4. Intermediary

Make each request a small ball, send it down to the surface of the intermediary layer, flash that layer, and then send the ball to its target.
Attaching a label to each request as a child of the ball makes the label move with the ball.

```js
for (const c of calls) {
  const p = packet(COLOR.actor, src, 0.17); p.add(tag(c.name, [0, 0.45, 0], 'actor')); temp.add(p);
  await a.move(p, [src[0], FLOOR + 0.05, src[2]], 600);
  await a.flash(kernel, COLOR.bound, 600);
  await a.move(p, [c.target[0], FLOOR + 0.08, c.target[2]], 800);   // travels along over the intermediary layer
  await a.move(p, c.target, 400);
  temp.remove(p);
}
```

## 5. Authority chain

The actor crosses over to whoever holds the authority, and that side creates a new space for it. A tube (`tube`) is the passage,
and the newly created room is drawn as glass in the actor color.

```js
const evil = glass(3.7, 2.2, 1.9, [x, FLOOR, z], { color: COLOR.actor, edge: COLOR.actor, opacity: 0.1 });
evil.visible = false; g.add(evil);              // reset: visible=false, scale 1
// run:
evil.scale.setScalar(0.01); evil.visible = true;
await a.scaleTo(evil, 1, 800);
```

## 6. Allowed exit

Put the actor inside a sphere and attach exits (short cylinders) to the sphere's surface. If it goes in another direction the sphere flashes,
and matter comes and goes through the exits.

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
cap.add(tag('Allowed: read files', dir.clone().multiplyScalar(R + 1.1).add(V(0, 0.35, 0)).toArray(), 'matter'));
```

An R around 1.8 is right. If it is smaller, the exit label and the actor's label overlap.

## 7. Request path

Line up the components as blocks and send a ball over in an arc. The template's `s2` is this pattern.

- Write the steps in the body as `<ol class="steps">` and match them to the numbers in `say('1. ...')`.
- Put outside systems (external APIs, source data) off the floor slab in `COLOR.outside`. That makes "outside our server" visible.
- A place where results accumulate (outputs such as tables and charts) starts hidden and appears at the end with `scaleTo`.
- Get the top-surface position of a block with `top(o) = [o.position.x, o.position.y + o.userData.h / 2 + 0.5, o.position.z]`.

## 8. Lifetime

Draw a slot as a dashed rectangle, and make a resource a Group whose origin is on the floor. That way
`scaleTo` makes it rise from the floor and sink into it. Put the state inside a resource (variables, a cache) as children of that Group.

```js
const room = (x, z, name) => {
  const r = new THREE.Group(); r.position.set(x, FLOOR, z);
  r.add(glass(2.2, 1.9, 2.2, [0, 0, 0]));
  r.add(tag(name, [0, 2.25, 0], 'bound'));
  return r;
};
```

- Pause and save: while shrinking the resource, grow a flat disc (`COLOR.muted`) and move the disc to the front of the floor slab (the storage).
- Resume: bring the disc back to the slot and shrink it, then grow the resource again. The point is that the child state comes back unchanged.
- Waiting: put it outside the slot as dashed glass (`dashed: true, opacity: 0.04`) and write "waiting" in the label. When it
  gets a slot, change the label text, and restore the original text in reset.

## 9. Side-by-side comparison

Spread two stages apart in the `SCREEN_RIGHT` direction and run the same action on both at the same time with `Promise.all`.
Each stage is a Group whose origin is the stage center, so you can use the same inner coordinates.

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
L.s.add(tag('Approach A', [0, 0.25, 3.2], 'big'));
R.s.add(tag('Approach B', [0, 0.25, 3.2], 'big'));
```

If one stage is 5.8 wide, offsets of ±4.2 and a scene `fitW` of about 18.8 fit.

The **"same question, different answer"** variant was the most effective at explaining a conceptual contrast. Send the same request (a ball)
from both sides and show how far down that request goes and who answers. On one side the two requests gather on the same slab and
that slab flashes; on the other each stops at its own slab. Make the answer (a small matter slab) go back to the side that asked, and write the content in the
label, such as "A's files only". The `split` scene in example chapter 3 has this structure. Put status marks (for example "End of support" and "Experimental feature") in
`'warn'` labels floating at the top of the stage, at a different height from the title labels.
