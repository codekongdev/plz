"""Regression checks for inspect_rig.compare on synthetic dumps (no Blender needed).

Run: python3 -m unittest skills/plz-rig-model/scripts/test_inspect_rig.py
"""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import inspect_rig  # noqa: E402


def _base_dump():
    return {"bones": {}, "constraints": [], "objects": {}, "actions": {}, "nla": []}


def _glb(times, values):
    return {
        "skins": [], "meshes": [], "materials": [], "bytes": 0, "nodes": {},
        "animations": {"Walk": {"Hip.rotation": {"times": times, "values": values, "width": 4}}},
    }


def _compare(a, b):
    with tempfile.TemporaryDirectory() as d:
        pa, pb = os.path.join(d, "a.json"), os.path.join(d, "b.json")
        with open(pa, "w") as fh:
            json.dump(a, fh)
        with open(pb, "w") as fh:
            json.dump(b, fh)
        with contextlib.redirect_stdout(io.StringIO()):
            return inspect_rig.compare(pa, pb)


class GlbSamplerTimesTests(unittest.TestCase):
    def test_same_values_at_different_times_is_different(self):
        a = dict(_base_dump(), glb=_glb([0, 1], [0, 0, 0, 1, 0, 0, 0, 1]))
        b = dict(_base_dump(), glb=_glb([0, 10], [0, 0, 0, 1, 0, 0, 0, 1]))
        self.assertFalse(_compare(a, b))

    def test_identical_glb_animations_match(self):
        a = dict(_base_dump(), glb=_glb([0, 1], [0, 0, 0, 1, 0, 0, 0, 1]))
        b = dict(_base_dump(), glb=_glb([0, 1], [0, 0, 0, 1, 0, 0, 0, 1]))
        self.assertTrue(_compare(a, b))


def _glb_nodes(parent="Root", t=(0.0, 0.0, 0.0)):
    return {
        "Root": {"parent": None, "t": [0, 0, 0], "r": [0, 0, 0, 1], "s": [1, 1, 1]},
        "Hip": {"parent": parent, "t": list(t), "r": [0, 0, 0, 1], "s": [1, 1, 1]},
    }


class GlbHierarchyTests(unittest.TestCase):
    def _dump(self, nodes):
        return dict(_base_dump(), glb=dict(_glb([0, 1], [0, 0, 0, 1, 0, 0, 0, 1]), nodes=nodes))

    def test_changed_parent_is_different(self):
        self.assertFalse(_compare(self._dump(_glb_nodes("Root")), self._dump(_glb_nodes("Other"))))

    def test_changed_rest_translation_is_different(self):
        self.assertFalse(_compare(self._dump(_glb_nodes(t=(0, 0, 0))), self._dump(_glb_nodes(t=(0, 0.5, 0)))))

    def test_identical_hierarchy_matches(self):
        self.assertTrue(_compare(self._dump(_glb_nodes()), self._dump(_glb_nodes())))


class ActionInterpolationTests(unittest.TestCase):
    def _action(self, interp):
        curve = 'pose.bones["Hip"].rotation_quaternion[0]'
        return {"Walk": {"fake_user": False, "curves": {curve: [[1, 0.5, "CONSTANT"], [10, 1.0, interp]]}}}

    def test_changed_keyframe_interpolation_is_different(self):
        a = dict(_base_dump(), actions=self._action("CONSTANT"))
        b = dict(_base_dump(), actions=self._action("BEZIER"))
        self.assertFalse(_compare(a, b))

    def test_identical_actions_match(self):
        a = dict(_base_dump(), actions=self._action("BEZIER"))
        b = dict(_base_dump(), actions=self._action("BEZIER"))
        self.assertTrue(_compare(a, b))


if __name__ == "__main__":
    unittest.main()
