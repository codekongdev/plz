"""Shared helpers: arguments, landmarks, coordinates, action curves."""
import argparse
import json
import os
import sys

from mathutils import Vector

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SIDES = (".L", ".R")


def script_args(parser: argparse.ArgumentParser):
    """Parse the arguments after Blender's `--` separator."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def load_json(path):
    with open(path) as fh:
        return json.load(fh)


def load_template(name_or_path):
    path = name_or_path
    if not os.path.exists(path):
        path = os.path.join(SKILL_DIR, "templates", name_or_path + ".json")
    if not os.path.exists(path):
        raise SystemExit(f"template not found: {name_or_path} (looked in {os.path.dirname(path)})")
    return load_json(path)


def cm_to_world(x, f, z):
    """Spec coordinates (x lateral +left, f forward, z up; cm) -> Blender metres (forward = -Y)."""
    return Vector((x * 0.01, -f * 0.01, z * 0.01))


def world_to_fz(co):
    """Blender metres -> (f, z) cm on the side plane."""
    return -co.y * 100.0, co.z * 100.0


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


class Landmarks:
    """landmarks.json wrapper with clear errors for missing names."""

    def __init__(self, path):
        self.path = path
        self.data = load_json(path)
        if self.data.get("units", "m") != "m":
            raise SystemExit(f"{path}: units must be 'm'")
        self.points = {k: Vector(v) for k, v in self.data.get("points", {}).items()}
        self.parts = self.data.get("parts", {})
        self.regions = self.data.get("regions", {})
        self.id = self.data.get("id", "model")
        self.version = self.data.get("version", "v001")

    def point(self, name):
        if name == "origin":
            return Vector((0.0, 0.0, 0.0))
        if name not in self.points:
            raise SystemExit(f"{self.path}: missing landmark '{name}'")
        return self.points[name]

    def missing(self, names):
        return [n for n in names if n != "origin" and n not in self.points]


def sided_name(name, side, sided_names):
    return name + side if name in sided_names else name


def expand(names, side=None):
    """`wing_upper.*` -> both sides; plain names stay."""
    out = []
    for n in names:
        if n.endswith(".*"):
            base = n[:-2]
            out.extend([base + s for s in (SIDES if side is None else (side,))])
        else:
            out.append(n)
    return out


def action_fcurves(action):
    """F-curves of an action on both legacy and layered (Blender 4.4+/5.x) actions."""
    legacy = getattr(action, "fcurves", None)
    if legacy is not None:
        try:
            return list(legacy)
        except TypeError:
            pass
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                curves.extend(bag.fcurves)
    return curves


def log(*parts):
    print("[plz-rig-model]", *parts, flush=True)
