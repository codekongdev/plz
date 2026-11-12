"""Skin-weight strategies. Each takes (rig, ob, rule, lm) and fills vertex groups.

Add a strategy by writing a function and registering it in STRATEGIES; templates refer to it
by name in their `weights` list.
"""
import math

import bpy
import numpy as np
from mathutils.geometry import intersect_point_line

from .common import SIDES, expand, log, smoothstep, world_to_fz


def move_armature_first(ob):
    mod = next((m for m in ob.modifiers if m.type == 'ARMATURE'), None)
    if mod and ob.modifiers[0] != mod:
        with bpy.context.temp_override(object=ob):
            bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)


def bind(ob, rig):
    """Parent to the rig (world transform kept), armature modifier first, no old groups."""
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.matrix_world = mw
    mod = next((m for m in ob.modifiers if m.type == 'ARMATURE'), None) or ob.modifiers.new("Armature", 'ARMATURE')
    mod.object = rig
    move_armature_first(ob)
    ob.vertex_groups.clear()


def _seg(rig, name):
    b = rig.data.bones[name]
    return b.head_local, b.tail_local


def _seg_dist(p, a, b):
    _, t = intersect_point_line(p, a, b)
    t = max(0.0, min(1.0, t))
    return (p - (a + (b - a) * t)).length


# ---- strategies ---------------------------------------------------------------------

def heat(rig, ob, rule, lm):
    """Blender bone-heat weights, limited to `bones` by switching other bones' deform off."""
    keep = set(expand(rule["bones"]))
    arm = rig.data
    saved = {b.name: b.use_deform for b in arm.bones}
    for b in arm.bones:
        b.use_deform = b.name in keep
    ob.vertex_groups.clear()
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    result = bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for b in arm.bones:
        b.use_deform = saved[b.name]
    move_armature_first(ob)
    if 'FINISHED' not in result:
        raise SystemExit(f"heat weighting failed on {ob.name}: {result}")


def rigid(rig, ob, rule, lm):
    bind(ob, rig)
    g = ob.vertex_groups.new(name=rule["bone"])
    g.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')


def nearest_segments(rig, ob, rule, lm):
    """Inverse-distance^power to the listed bones of the vertex's side (x >= 0 is .L)."""
    bind(ob, rig)
    names = rule["bones"]
    power, keep = rule.get("power", 4), rule.get("keep", 2)
    groups = {n + s: ob.vertex_groups.new(name=n + s) for s in SIDES for n in names}
    segs = {n: _seg(rig, n) for n in groups}
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        s = ".L" if p.x >= 0 else ".R"
        ws = sorted(((1.0 / (_seg_dist(p, *segs[n + s]) ** power + 1e-12), n + s) for n in names),
                    reverse=True)[:keep]
        tot = sum(w for w, _ in ws)
        for w, n in ws:
            groups[n].add([v.index], w / tot, 'REPLACE')


def span_blend(rig, ob, rule, lm):
    """Chain of bones along the lateral span: smoothstep hand-over at each joint's |x|."""
    bind(ob, rig)
    bones, joints = rule["bones"], rule["joints"]
    half = rule.get("half_width_cm", 1.0)
    groups = [ob.vertex_groups.new(name=b) for b in bones]
    edges = [abs(lm.point(j).x) * 100.0 for j in joints]
    for v in ob.data.vertices:
        x = abs((ob.matrix_world @ v.co).x) * 100.0
        steps = [smoothstep(e - half, e + half, x) for e in edges]
        ws, carry = [], 1.0
        for s in steps:
            ws.append(carry * (1 - s))
            carry *= s
        ws.append(carry)
        for g, w in zip(groups, ws):
            if w > 1e-4:
                g.add([v.index], w, 'REPLACE')


def _source_target(name, mapping, patterns):
    if name in mapping:
        return mapping[name]
    return next((bone for pattern, bone in patterns if pattern.search(name)), None)


def source_groups(rig, ob, rule, lm):
    """Keep the skin weights the model came with (a bought or downloaded rig): each source vertex group
    is summed into the template bone that `sourceGroups` in landmarks.json maps it to (exact names, or
    "re:<regex>" keys), then rows are renormalised. A group that carries weight but has no mapping
    stops the run with its name, so no part of the mesh is silently left on the wrong bone."""
    import re
    table = lm.data.get("sourceGroups")
    if not table:
        raise SystemExit(f"{ob.name}: method source_groups needs `sourceGroups` in {lm.path}")
    mapping = {k: v for k, v in table.items() if not k.startswith("re:")}
    patterns = [(re.compile(k[3:]), v) for k, v in table.items() if k.startswith("re:")]
    names, w = _read_weights(ob)
    if not names:
        raise SystemExit(f"{ob.name}: no source vertex groups to keep (was the rig stripped first?)")
    bones = {b.name for b in rig.data.bones if b.use_deform}
    targets = sorted({t for t in (_source_target(n, mapping, patterns) for n in names) if t})
    missing = [t for t in targets if t not in bones]
    if missing:
        raise SystemExit(f"{ob.name}: sourceGroups maps to bones the template does not deform: {missing}")
    out = np.zeros((w.shape[0], len(targets)))
    unmapped = []
    for i, name in enumerate(names):
        t = _source_target(name, mapping, patterns)
        if t is None:
            if w[:, i].max() > 1e-4:
                unmapped.append(name)
            continue
        out[:, targets.index(t)] += w[:, i]
    if unmapped:
        raise SystemExit(f"{ob.name}: weighted source groups with no mapping in sourceGroups: {unmapped}")
    bind(ob, rig)
    for t in targets:
        ob.vertex_groups.new(name=t)
    _write_weights(ob, targets, _normalise(out))
    log(f"{ob.name}: kept source weights from {len(names)} groups as {len(targets)} bones")


STRATEGIES = {"heat": heat, "rigid": rigid, "nearest_segments": nearest_segments, "span_blend": span_blend,
              "source_groups": source_groups}


# ---- region lock ----------------------------------------------------------------------

def _inside(poly, f, z):
    c = False
    for (f1, z1), (f2, z2) in zip(poly, poly[1:] + poly[:1]):
        if (z1 > z) != (z2 > z) and f < f1 + (z - z1) * (f2 - f1) / (z2 - z1):
            c = not c
    return c


def _dist(poly, f, z):
    best = 1e9
    for (f1, z1), (f2, z2) in zip(poly, poly[1:] + poly[:1]):
        df, dz = f2 - f1, z2 - z1
        l2 = df * df + dz * dz
        t = max(0, min(1, ((f - f1) * df + (z - z1) * dz) / l2)) if l2 else 0
        best = min(best, math.hypot(f - (f1 + t * df), z - (z1 + t * dz)))
    return best


def region_lock(ob, lock, lm):
    """Inside a side-plane (f, z) region (+dilate) give 100 % to one bone; blend back over `blend_cm`."""
    region = lm.regions.get(lock["region"])
    if region is None:
        log(f"region '{lock['region']}' not in landmarks; lock skipped on {ob.name}")
        return 0
    if region.get("plane") != "fz" or region.get("units", "cm") != "cm":
        raise SystemExit(f"region {lock['region']}: only plane 'fz' in cm is supported")
    poly = [tuple(p) for p in region["polygon"]]
    dil, blend, bone = region.get("dilate", 0.0), lock.get("blend_cm", 1.0), lock["bone"]
    names = [g.name for g in ob.vertex_groups]
    changed = 0
    for v in ob.data.vertices:
        f, z = world_to_fz(ob.matrix_world @ v.co)
        d = 0.0 if _inside(poly, f, z) else _dist(poly, f, z)
        if d >= dil + blend:
            continue
        t = 0.0 if d <= dil else (d - dil) / blend
        t = t * t * (3 - 2 * t)
        orig = {n: 0.0 for n in names}
        for g in v.groups:
            orig[ob.vertex_groups[g.group].name] = g.weight
        tot = sum(orig.values()) or 1.0
        for n in names:
            w = (1 - t) * (1.0 if n == bone else 0.0) + t * orig[n] / tot
            if w > 1e-4:
                ob.vertex_groups[n].add([v.index], w, 'REPLACE')
            else:
                ob.vertex_groups[n].remove([v.index])
        changed += 1
    return changed


# ---- smoothing near joints, influence limit ---------------------------------------------

def _read_weights(ob):
    names = [g.name for g in ob.vertex_groups]
    w = np.zeros((len(ob.data.vertices), len(names)))
    for v in ob.data.vertices:
        for g in v.groups:
            w[v.index, g.group] = g.weight
    return names, w


def _write_weights(ob, names, w, floor=1e-4):
    everyone = list(range(len(ob.data.vertices)))
    for gi, name in enumerate(names):
        g = ob.vertex_groups[name]
        g.remove(everyone)
        col = w[:, gi]
        for vi in np.nonzero(col > floor)[0]:
            g.add([int(vi)], float(col[vi]), 'REPLACE')


def _joint_mask(ob, points, inner, outer):
    """1 within `inner` m of any point, smoothstep down to 0 at `outer` (bind-pose positions)."""
    co = np.array([tuple(ob.matrix_world @ v.co) for v in ob.data.vertices])
    d = np.min(np.stack([np.linalg.norm(co - np.array(tuple(p)), axis=1) for p in points]), axis=0)
    t = np.clip((d - inner) / max(outer - inner, 1e-9), 0.0, 1.0)
    return 1.0 - t * t * (3 - 2 * t)


def smooth_near_joints(ob, passes, lm):
    """Laplacian smoothing of every group, limited to skin near the listed joints, e.g. armpit and groin.
    Each pass: {"around": [point names], "radius_cm": r, "iterations": n, "factor": f}; full strength
    within r/2 of a point, fading to none at r. Rows are renormalised; fixed order, so reproducible."""
    names, w = _read_weights(ob)
    edges = np.empty(len(ob.data.edges) * 2, dtype=np.int64)
    ob.data.edges.foreach_get("vertices", edges)
    a, b = edges[0::2], edges[1::2]
    deg = np.bincount(a, minlength=len(w)) + np.bincount(b, minlength=len(w))
    deg = np.maximum(deg, 1)[:, None]
    for p in passes:
        pts = [lm.point(n) for n in expand(p["around"])]
        r = p["radius_cm"] * 0.01
        m = _joint_mask(ob, pts, r * 0.5, r)[:, None] * p.get("factor", 0.5)
        for _ in range(p.get("iterations", 10)):
            acc = np.zeros_like(w)
            np.add.at(acc, a, w[b])
            np.add.at(acc, b, w[a])
            w = w + m * (acc / deg - w)
        log(f"{ob.name}: smoothed weights near {p['around']} (r {p['radius_cm']} cm, "
            f"{p.get('iterations', 10)} x {p.get('factor', 0.5)}), {int((m > 0).sum())} verts")
    _write_weights(ob, names, _normalise(w))


def _normalise(w):
    tot = w.sum(axis=1, keepdims=True)
    return np.where(tot > 0, w / np.where(tot > 0, tot, 1.0), w)


def limit_influences(ob, n):
    """Keep the n largest weights per vertex and renormalise (glTF skins carry 4 by default, so the
    .blend then deforms exactly like the exported file)."""
    names, w = _read_weights(ob)
    if w.shape[1] <= n:
        return 0
    order = np.argsort(-w, axis=1, kind="stable")
    cut = np.zeros_like(w, dtype=bool)
    np.put_along_axis(cut, order[:, n:], True, axis=1)
    changed = int(((w > 0) & cut).any(axis=1).sum())
    w = _normalise(np.where(cut, 0.0, w))
    _write_weights(ob, names, w)
    log(f"{ob.name}: limited to {n} influences ({changed} verts trimmed)")
    return changed


def apply_weights(rig, template, lm):
    """Run each template weight rule on its part object; returns {part: object}."""
    done = {}
    for rule in template["weights"]:
        parts = expand([rule["part"]])
        for part in parts:
            name = lm.parts.get(part)
            ob = bpy.data.objects.get(name) if name else None
            if ob is None:
                if rule.get("optional"):
                    log(f"optional part '{part}' missing; skipped")
                    continue
                raise SystemExit(f"part '{part}' -> object '{name}' not found")
            side = part[-2:] if part[-2:] in SIDES else None
            r = dict(rule)
            for key in ("bone",):
                if key in r and r[key].endswith(".*"):
                    r[key] = r[key][:-2] + side
            for key in ("bones", "joints"):  # `.*` -> the part's side, or both sides on a centre part
                if key in r:
                    r[key] = expand(r[key], side)
            STRATEGIES[r["method"]](rig, ob, r, lm)
            if "lock" in r:
                n = region_lock(ob, r["lock"], lm)
                log(f"{ob.name}: region lock '{r['lock']['region']}' reweighted {n} verts")
            if "smooth" in r:
                smooth_near_joints(ob, r["smooth"], lm)
            if "maxInfluences" in r:
                limit_influences(ob, r["maxInfluences"])
            done[part] = ob
            log(f"{ob.name}: {r['method']} -> {[g.name for g in ob.vertex_groups]}")
    return done
