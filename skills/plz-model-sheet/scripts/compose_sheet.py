"""Measure prepared views and lay them out at one real-world scale as a model sheet.

Usage: python compose_sheet.py SPEC.json OUT_DIR [--no-render]

Reads OUT_DIR/views/<name>.webp (made by prepare_views.py) and writes OUT_DIR/sheet.svg,
OUT_DIR/sheet.webp (rendered with headless Chromium when available) and
OUT_DIR/measurements.json. Prints every consistency/reference check as PASS or WARN.
See references/spec-format.md for the spec.
"""
import glob
import json
import math
import os
import shutil
import subprocess
import sys
from html import escape
from pathlib import Path

import numpy as np
from PIL import Image

FONT = "font-family=\"'Noto Sans CJK KR','Noto Sans KR','Apple SD Gothic Neo',sans-serif\""
INK, MUTED, GREEN, BLUE, BROWN, RED = '#24343d', '#586873', '#326b60', '#2f6fb0', '#875516', '#9a3830'
GRID_STEPS = [(1, 5), (2, 10), (5, 25), (10, 50), (20, 100)]  # (minor, major) in cm


# ---------------------------------------------------------------- measuring
class View:
    def __init__(self, spec: dict, out: Path):
        self.spec = spec
        self.name = spec['name']
        image = Image.open(out / 'views' / f'{self.name}.webp').convert('RGBA')
        data = np.asarray(image)
        self.rgb = data[..., :3].astype(np.int16)
        self.solid = data[..., 3] > 127
        rows = np.nonzero(self.solid.sum(axis=1) > 2)[0]
        cols = np.nonzero(self.solid.sum(axis=0) > 2)[0]
        self.box = (int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1)
        self.size = image.size
        self.ppc = None  # source pixels per cm, set once scales are known

    @property
    def w(self) -> int: return self.box[2] - self.box[0]

    @property
    def h(self) -> int: return self.box[3] - self.box[1]

    def region(self, frac):
        l, t, r, b = self.box
        x0, y0, x1, y1 = frac
        mask = np.zeros_like(self.solid)
        mask[int(t + y0 * self.h): int(t + y1 * self.h) + 1, int(l + x0 * self.w): int(l + x1 * self.w) + 1] = True
        return mask & self.solid

    def detect(self, kind: str):
        """Coloured feature mask in the upper half of the subject (eyes)."""
        r, g, b = self.rgb[..., 0], self.rgb[..., 1], self.rgb[..., 2]
        if kind == 'orange':
            mask = (r > 170) & (g > 60) & (g < 160) & (b < 70) & (r - g > 60)
        elif kind == 'yellow':
            mask = (r > 160) & (g > 140) & (b < 90) & (r - b > 90)
        elif kind == 'green':
            mask = (g > 120) & (g > r + 25) & (g > b + 25)
        else:
            raise SystemExit(f'unknown detect kind: {kind}')
        mask &= self.solid
        mask[self.box[1] + self.h // 2:] = False
        return mask


def text_width(s: str, size: float) -> float:
    """Rough rendered width: CJK glyphs are about one em, Latin about half."""
    return sum(size * (1.0 if ord(ch) > 0x2e80 else 0.58) for ch in s)


def centroid(mask):
    ys, xs = np.nonzero(mask)
    return (float(xs.mean()), float(ys.mean())) if len(xs) else None


def colour_of(view: View, entry: dict):
    mask = view.detect(entry['detect']) if 'detect' in entry else view.region(entry['box'])
    px = view.rgb[mask]
    if len(px) == 0:
        return None
    stat = entry.get('stat', 'median')
    if stat in ('dark', 'light'):
        lum = px @ np.array([0.299, 0.587, 0.114])
        order = np.argsort(lum)
        n = max(1, len(px) // 5)
        px = px[order[:n]] if stat == 'dark' else px[order[-n:]]
    elif stat == 'saturated':
        sat = px.max(axis=1) - px.min(axis=1)
        px = px[np.argsort(sat)[-max(1, int(len(px) * 0.3)):]]
    m = np.median(px, axis=0).astype(int)
    return '#%02x%02x%02x' % tuple(int(v) for v in m)


# ---------------------------------------------------------------- svg helpers
class Svg:
    def __init__(self):
        self.parts = []

    def add(self, s: str): self.parts.append(s)

    def text(self, x, y, s, size=22, weight=400, fill=INK, anchor='start'):
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
                 f'text-anchor="{anchor}" {FONT}>{escape(str(s))}</text>')

    def line(self, x1, y1, x2, y2, stroke, width=1.5, dash=None, extra=''):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{width}"{d}{extra}/>')

    def grid(self, x0, y0, x1, y1, ox, oy, s, step):
        minor, major = step
        for i in range(math.floor((x0 - ox) / (minor * s)), math.ceil((x1 - ox) / (minor * s)) + 1):
            x = ox + i * minor * s
            if x0 <= x <= x1:
                strong = (i * minor) % major == 0
                self.line(x, y0, x, y1, '#b9c7c4' if strong else '#e3eaea', 1.4 if strong else 1)
        for j in range(math.floor((y0 - oy) / (minor * s)), math.ceil((y1 - oy) / (minor * s)) + 1):
            y = oy + j * minor * s
            if y0 <= y <= y1:
                strong = (j * minor) % major == 0
                self.line(x0, y, x1, y, '#b9c7c4' if strong else '#e3eaea', 1.4 if strong else 1)

    def dim_h(self, x1, x2, y, label):
        self.add(f'<g stroke="{GREEN}" stroke-width="2"><line x1="{x1:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y:.1f}"/>'
                 f'<line x1="{x1:.1f}" y1="{y - 9:.1f}" x2="{x1:.1f}" y2="{y + 9:.1f}"/>'
                 f'<line x1="{x2:.1f}" y1="{y - 9:.1f}" x2="{x2:.1f}" y2="{y + 9:.1f}"/></g>')
        self.text((x1 + x2) / 2, y - 10, label, 20, 700, GREEN, 'middle')

    def dim_v(self, x, y1, y2, label, side='left'):
        self.add(f'<g stroke="{GREEN}" stroke-width="2"><line x1="{x:.1f}" y1="{y1:.1f}" x2="{x:.1f}" y2="{y2:.1f}"/>'
                 f'<line x1="{x - 9:.1f}" y1="{y1:.1f}" x2="{x + 9:.1f}" y2="{y1:.1f}"/>'
                 f'<line x1="{x - 9:.1f}" y1="{y2:.1f}" x2="{x + 9:.1f}" y2="{y2:.1f}"/></g>')
        self.text(x - 12 if side == 'left' else x + 12, (y1 + y2) / 2 + 7, label, 20, 700, GREEN,
                  'end' if side == 'left' else 'start')

    def image(self, href, x, y, w, h):
        self.add(f'<image href="{escape(href)}" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"/>')


# ---------------------------------------------------------------- main
def main() -> None:
    spec_path, out = Path(sys.argv[1]), Path(sys.argv[2])
    render = '--no-render' not in sys.argv
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    views = {v['name']: View(v, out) for v in spec['views']}

    # Landmarks are located in pixels first, because the anchor may be one of them.
    found = []
    for lm in spec.get('landmarks', []):
        v = views[lm['view']]
        if 'detect' in lm:
            c = centroid(v.detect(lm['detect']))
            if c is None:
                print(f"WARN landmark {lm['label']} not found in {lm['view']}; give it a 'y' fraction instead")
                continue
            y = c[1]
        else:
            y = v.box[1] + lm['y'] * v.h
        found.append((lm, v, y))

    anchor = next(v for v in views.values() if 'anchor' in v.spec)
    a = anchor.spec['anchor']
    if 'landmark' in a:  # e.g. shoulder height: ground to the landmark is the published size
        hit = next((y for lm, v, y in found if v is anchor and lm['label'] == a['landmark']), None)
        if hit is None:
            raise SystemExit(f"anchor landmark {a['landmark']!r} must be a landmark of the {anchor.name} view")
        anchor.ppc = (anchor.box[3] - hit) / a['cm']
        anchor_dim = 'landmark'
    else:
        anchor.ppc = (anchor.w if a['axis'] == 'x' else anchor.h) / a['cm']
        anchor_dim = 'length' if a['axis'] == 'x' else 'height'
    base = {'length': anchor.w / anchor.ppc, 'height': anchor.h / anchor.ppc}
    for v in views.values():
        if v is anchor:
            continue
        share = v.spec['share']
        # An articulated pose (crouch, T-pose) keeps neither length nor height, so it may
        # give its own justified size in cm instead.
        target = share['cm'] if 'cm' in share else base[share['with']]
        v.ppc = (v.w if share['axis'] == 'x' else v.h) / target
    dims = {name: {'width': v.w / v.ppc, 'height': v.h / v.ppc} for name, v in views.items()}

    # Pivot of the anchor view: centre of the feet or of the whole subject.
    if anchor.spec.get('pivot', 'feet') == 'feet':
        feet = anchor.solid.copy()
        feet[: anchor.box[3] - max(2, int(anchor.h * 0.04))] = False
        pivot_x = centroid(feet)[0]
    else:
        pivot_x = (anchor.box[0] + anchor.box[2]) / 2
    front_cm = (anchor.box[2] - pivot_x) / anchor.ppc
    back_cm = (pivot_x - anchor.box[0]) / anchor.ppc

    # Landmarks: heights above the ground of a standing view.
    landmarks = [{'label': lm['label'], 'view': lm['view'], 'cm': (v.box[3] - y) / v.ppc} for lm, v, y in found]

    def value(ref: str) -> float:
        """'<view>.width' / '<view>.height', or 'landmark:<label>@<view>' (height above ground)."""
        if ref.startswith('landmark:'):
            label, name = ref[len('landmark:'):].split('@')
            hit = next((lm['cm'] for lm in landmarks if lm['label'] == label and lm['view'] == name), None)
            if hit is None:
                raise SystemExit(f'no landmark {label!r} in view {name!r}')
            return hit
        name, key = ref.split('.')
        return dims[name][key]

    checks = []
    for g in spec.get('groups', []):
        vals = [value(r) for r in g['values']]
        spread = (max(vals) - min(vals)) / max(vals)
        checks.append({'label': g['label'], 'sheet': ' / '.join(f'{x:.1f}' for x in vals),
                       'ref': f"view spread {spread * 100:.0f}% (tolerance {g.get('tolerance', 0.08) * 100:.0f}%)",
                       'ok': spread <= g.get('tolerance', 0.08)})
    by_label = {}
    for lm in landmarks:
        by_label.setdefault(lm['label'], []).append(lm['cm'])
    for label, vals in by_label.items():
        if len(vals) > 1:
            spread = (max(vals) - min(vals)) / max(vals)
            checks.append({'label': f'{label} height', 'sheet': ' / '.join(f'{x:.1f}' for x in vals),
                           'ref': f'view spread {spread * 100:.0f}% (tolerance 6%)', 'ok': spread <= 0.06})
    for c in spec.get('checks', []):
        x = value(c['value'])
        lo, hi = c['range']
        checks.append({'label': c['label'], 'sheet': f'{x:.1f}', 'ref': f'{lo:g}–{hi:g}{c.get("unit", "cm")}',
                       'ok': lo * 0.95 <= x <= hi * 1.05})
    colours = [(c['label'], colour_of(views[c['view']], c)) for c in spec.get('colours', [])]

    # ------------------------------------------------------------ layout
    col = spec.get('collider')
    scale = col.get('gameScale', 1) if col else 1
    col_r = col['radiusM'] * 100 / scale if col else 0
    col_h = col['heightM'] * 100 / scale if col and col.get('heightM') else 0
    eye_h = col['eyeHeightM'] * 100 / scale if col and col.get('eyeHeightM') else 0
    crown_label = spec.get('crownLabel', 'top of head')
    tallest = max([dims[n]['height'] for n, v in views.items() if v.spec.get('role') == 'standing'] + [col_h, eye_h])
    S = spec.get('pxPerCm') or round(min(900 / tallest, 1300 / base['length']), 1)
    step = next(s for s in GRID_STEPS if s[0] * S >= 14)
    LEFT, HEADER = 80, 170
    GY = HEADER + 50 + tallest * S
    standing = [v for v in views.values() if v.spec.get('role') == 'standing']
    placed = {}
    cursor = LEFT + 40 + max(0, col_r * S - back_cm * S)
    for v in standing:
        k = S / v.ppc
        x = cursor
        placed[v.name] = (x, GY - v.h * k, v.w * k, v.h * k)
        right = x + v.w * k
        if v is anchor:
            pivot_sheet = x + (pivot_x - v.box[0]) * k
            right = max(right, pivot_sheet + col_r * S)
        cursor = right + 140
    row1_right = cursor - 140
    # Guide labels sit past the last view, so leave room for the longest one.
    guide_labels = [f"{crown_label} {base['height']:.1f}cm", 'ground y=0'] + [f"{lm['label']} {lm['cm']:.1f}cm" for lm in landmarks if lm['view'] == anchor.name]
    guide_right = row1_right + max(170, max(text_width(t, 18) for t in guide_labels) + 50)
    row_bottom = GY + 70
    tops = [v for v in views.values() if v.spec.get('role') == 'top']
    pivot_line_end = row_bottom  # stops under the top views, never crossing extra poses
    top_rows = []
    for v in tops:
        k = S / v.ppc
        half = v.h * k / 2 + 40
        cy = row_bottom + 60 + half
        x = placed[anchor.name][0]  # same length, head to the right, so the ends line up
        placed[v.name] = (x, cy - v.h * k / 2, v.w * k, v.h * k)
        top_rows.append((v, cy, half))
        row_bottom = cy + half + 30
        pivot_line_end = cy + half
    extras = [v for v in views.values() if v.spec.get('role') == 'extra']
    content_right = max([guide_right] + [placed[v.name][0] + placed[v.name][2] + 160 for v in tops]
                        + [LEFT + 40 + v.w * S / v.ppc for v in extras])
    center_x = (LEFT + content_right) / 2
    extra_rows = []
    for v in extras:
        k = S / v.ppc
        top_y = row_bottom + 70
        placed[v.name] = (center_x - v.w * k / 2, top_y, v.w * k, v.h * k)
        extra_rows.append((v, top_y))
        row_bottom = top_y + v.h * k + 100
    info_x = content_right + 110
    W = int(info_x + 780)

    svg = Svg()
    svg.text(LEFT, 78, spec.get('title', 'Modeling reference sheet'), 46, 800)
    svg.text(LEFT, 124, f"{spec.get('subtitle', '')} · real-size cm · 1cm = {S:g}px · pivot = "
             f"{'centre of feet' if anchor.spec.get('pivot', 'feet') == 'feet' else 'centre of base'} · front = +Z (right of the side view)",
             24, 400, MUTED)

    # Row 1: standing views with shared ground, crown and landmark guides.
    pivot_sheet = placed[anchor.name][0] + (pivot_x - anchor.box[0]) * S / anchor.ppc
    svg.grid(LEFT, HEADER + 40, guide_right, GY + 60, pivot_sheet, GY, S, step)
    crown_y = GY - base['height'] * S
    guides = [(crown_label, crown_y, BROWN)] + [(lm['label'], GY - lm['cm'] * S, RED) for lm in landmarks if lm['view'] == anchor.name]
    last_baseline = -1e9
    other_lines = [GY - eye_h * S] if eye_h else []
    for label, y, colour in sorted(guides, key=lambda g: g[1]):
        svg.line(LEFT, y, guide_right, y, colour, 2, '10 7')
        # Labels sit above their line; one that would touch the label or game line above goes under its line.
        clear = y - 8 - last_baseline >= 22 and not any(y - 26 < o < y for o in other_lines)
        baseline = y - 8 if clear else y + 20
        svg.text(guide_right - 4, baseline, f'{label} {(GY - y) / S:.1f}cm', 18, 700, colour, 'end')
        last_baseline = baseline
    svg.line(LEFT, GY, guide_right, GY, INK, 2)
    svg.text(guide_right - 4, GY - 8, 'ground y=0', 18, 700, INK, 'end')
    for v in standing:
        x, y, w, h = placed[v.name]
        svg.image(f'views/{v.name}.webp', x, y, w, h)
        svg.text(x + w / 2, HEADER + 26, v.spec.get('label', v.name), 24, 700, anchor='middle')
        svg.dim_h(x, x + w, GY + 42, f"{dims[v.name]['width']:.1f}cm" if v is not anchor
                  else f"{a.get('label', 'length') if anchor_dim == 'length' else 'length'} {base['length']:.1f}cm")
    ax, ay, aw, ah = placed[anchor.name]
    svg.dim_v(ax - 10, crown_y, GY, f"{a.get('label', 'height')} {base['height']:.1f}cm" if anchor_dim == 'height' else f"{base['height']:.1f}cm")
    if eye_h:  # the game's eye height, labelled on the left so it never meets the guide labels
        svg.line(LEFT, GY - eye_h * S, guide_right, GY - eye_h * S, BLUE, 2, '4 6')
        svg.text(LEFT + 4, GY - eye_h * S - 8, f"game eye height {eye_h:.1f}cm (×{scale:g} conversion of {col['eyeHeightM']}m)", 18, 700, BLUE)
    if col:
        svg.line(pivot_sheet, GY - max(col_h, base['height']) * S, pivot_sheet, pivot_line_end, BLUE, 1.5, '4 6')
        if col_h:
            svg.add(f'<rect x="{pivot_sheet - col_r * S:.1f}" y="{GY - col_h * S:.1f}" width="{2 * col_r * S:.1f}" '
                    f'height="{col_h * S:.1f}" fill="none" stroke="{BLUE}" stroke-width="2.5" stroke-dasharray="4 6"/>')
        else:
            for sx in (-1, 1):
                svg.line(pivot_sheet + sx * col_r * S, GY - base['height'] * S, pivot_sheet + sx * col_r * S, GY, BLUE, 2.5, '4 6')
        svg.text(pivot_sheet + col_r * S + 10, GY - max(col_h, base['height']) * S + 24,
                 f"{col.get('label', 'game collider')} ×{scale:g} conversion", 18, 700, BLUE)
        height_text = f" · h {col['heightM']}m" if col_h else ''
        svg.text(pivot_sheet + col_r * S + 10, GY - max(col_h, base['height']) * S + 48,
                 f"(r {col['radiusM']}m{height_text})", 18, 400, BLUE)

    # Row 2: top views aligned under the anchor, with the collider footprint.
    for v, cy, half in top_rows:
        x, y, w, h = placed[v.name]
        svg.grid(LEFT, cy - half, x + w + 160, cy + half, pivot_sheet, cy, S, step)
        svg.line(LEFT, cy, x + w + 160, cy, BROWN, 1.5, '10 7')
        svg.image(f'views/{v.name}.webp', x, y, w, h)
        svg.text(LEFT + 20, cy - half + 30, v.spec.get('label', v.name), 24, 700)
        svg.dim_v(x + w + 110, y, y + h, f"{dims[v.name]['height']:.1f}cm", 'right')
        if col:
            clip = f'clip-{v.name}'
            svg.add(f'<clipPath id="{clip}"><rect x="{LEFT}" y="{cy - half:.1f}" width="{x + w + 160 - LEFT:.1f}" height="{2 * half:.1f}"/></clipPath>')
            svg.add(f'<circle cx="{pivot_sheet:.1f}" cy="{cy:.1f}" r="{col_r * S:.1f}" fill="none" stroke="{BLUE}" '
                    f'stroke-width="2.5" stroke-dasharray="4 6" clip-path="url(#{clip})"/>')
            over_back, over_front = back_cm - col_r, front_cm - col_r
            parts = [f'rear {over_back:.1f}cm outside' if over_back > 0 else 'rear inside',
                     f'front {over_front:.1f}cm outside' if over_front > 0 else 'front inside']
            svg.text(LEFT + 20, cy + half - 14, f"collider circle (×{scale:g} conversion, radius {col_r:.1f}cm) · {' · '.join(parts)}", 18, 700, BLUE)

    # Row 3+: extra poses, each on its own grid.
    for v, top_y in extra_rows:
        x, y, w, h = placed[v.name]
        svg.grid(LEFT, top_y - 40, content_right, top_y + h + 70, center_x, top_y, S, step)
        svg.line(center_x, top_y - 40, center_x, top_y + h + 70, BROWN, 1.5, '10 7')
        svg.image(f'views/{v.name}.webp', x, y, w, h)
        svg.text(LEFT + 20, top_y - 8, v.spec.get('label', v.name) + (' · approximate scale' if v.spec.get('approx') else ''), 24, 700)
        d = v.spec.get('dimension', {'axis': 'x', 'label': 'width'})
        if d['axis'] == 'x':
            svg.dim_h(x, x + w, top_y + h + 46, f"{d['label']} {dims[v.name]['width']:.1f}cm")
        else:
            svg.dim_v(x - 20, y, y + h, f"{d['label']} {dims[v.name]['height']:.1f}cm")

    # Info column.
    y = 230
    svg.text(info_x, y, 'Dimension check', 30, 800); y += 44
    svg.text(info_x, y, 'Item', 18, 700, MUTED); svg.text(info_x + 300, y, 'Sheet cm', 18, 700, MUTED)
    svg.text(info_x + 480, y, 'Reference', 18, 700, MUTED); y += 34
    rows = [{'label': a.get('label', 'anchor'), 'sheet': f"{a['cm']:g} (anchor)", 'ref': '', 'ok': True}]
    if anchor_dim != 'length':
        rows.append({'label': 'Length (front to back end)', 'sheet': f"{base['length']:.1f}", 'ref': '', 'ok': True})
    if anchor_dim != 'height':
        rows.append({'label': f'Height ({crown_label})', 'sheet': f"{base['height']:.1f}", 'ref': '', 'ok': True})
    rows += checks
    for row in rows:
        svg.text(info_x, y, row['label'], 20)
        svg.text(info_x + 300, y, row['sheet'], 20, 700, INK if row['ok'] else RED)
        svg.text(info_x + 480, y, row['ref'] + ('' if row['ok'] else ' ⚠'), 18, 400, MUTED if row['ok'] else RED)
        y += 36
    if colours:
        y += 24
        svg.text(info_x, y, 'Colour key (sampled from generated images)', 26, 800); y += 40
        for label, hexv in colours:
            if hexv:
                svg.add(f'<rect x="{info_x}" y="{y - 26}" width="46" height="34" rx="6" fill="{hexv}" stroke="#24343d33"/>')
            svg.text(info_x + 62, y - 1, label, 20)
            svg.text(info_x + 520, y - 1, hexv or '—', 20, 700, MUTED)
            y += 46
    if col:
        y += 14
        svg.text(info_x, y, f'Game scale ×{scale:g} conversion', 26, 800); y += 40
        lines = [f"length {base['length'] * scale / 100:.2f}m · height {base['height'] * scale / 100:.2f}m",
                 f"collider r {col['radiusM']}m" + (f" · h {col['heightM']}m" if col_h else '') + ' (blue dashed)',
                 f"from pivot: front {front_cm * scale / 100:.2f}m · back {back_cm * scale / 100:.2f}m"]
        if eye_h:
            sheet_eye = next((lm['cm'] for lm in landmarks
                              if lm['view'] == anchor.name and lm['label'] == col.get('eyeLandmark', 'eye')), None)
            gap = f" · difference from sheet eye {eye_h - sheet_eye:+.1f}cm" if sheet_eye is not None else ''
            lines.append(f"game eye height {col['eyeHeightM']}m (blue horizontal dashed){gap}")
        for line in lines:
            svg.text(info_x, y, line, 19); y += 32
    if spec.get('method') or spec.get('credits'):
        y += 24
        svg.text(info_x, y, 'Method and credits', 26, 800); y += 40
        for line in spec.get('method', []) + spec.get('credits', []):
            svg.text(info_x, y, line, 18, 400, MUTED); y += 30
    H = int(max(row_bottom + 60, y + 80))
    svg.parts.insert(0, f'<rect x="{info_x - 30}" y="170" width="{W - info_x - 20}" height="{H - 230}" rx="14" fill="#f2f6f6" stroke="#d9e1e3"/>')
    svg.parts.insert(0, f'<rect width="{W}" height="{H}" fill="#fbfcfc"/>')
    svg.parts.insert(0, f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    svg.add('</svg>')
    (out / 'sheet.svg').write_text('\n'.join(svg.parts), encoding='utf-8')

    report = {
        'pxPerCm': S, 'sheet': [W, H],
        'base_cm': {k: round(v, 2) for k, v in base.items()},
        'views_cm': {n: {k: round(v, 2) for k, v in d.items()} for n, d in dims.items()},
        'pivot_cm': {'front': round(front_cm, 2), 'back': round(back_cm, 2)},
        'landmarks_cm': [{**lm, 'cm': round(lm['cm'], 2)} for lm in landmarks],
        'checks': checks, 'colours': colours,
        'sourcePxPerCm': {n: round(v.ppc, 2) for n, v in views.items()},
    }
    if eye_h:
        report['gameEyeHeight_cm'] = round(eye_h, 2)
    (out / 'measurements.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    for row in checks:
        print(f"{'PASS' if row['ok'] else 'WARN'} {row['label']}: {row['sheet']} ({row['ref']})")
    print(f"sheet {W}x{H} at {S:g}px/cm -> {out / 'sheet.svg'}")
    if render:
        render_sheet(out, W, H)


def find_chrome():
    found = os.environ.get('MODEL_SHEET_CHROME')
    if found:
        return found
    for pattern in ['~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell',
                    '~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac*/chrome-headless-shell',
                    '~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome',
                    '~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium']:
        hits = sorted(glob.glob(os.path.expanduser(pattern)))
        if hits:
            return hits[-1]
    for name in ['chromium', 'chromium-browser', 'google-chrome', 'chrome']:
        if shutil.which(name):
            return shutil.which(name)
    return None


def render_sheet(out: Path, W: int, H: int) -> None:
    chrome = find_chrome()
    if not chrome:
        print('WARN no Chromium found; set MODEL_SHEET_CHROME to render sheet.webp (sheet.svg is ready)')
        return
    png = out / '.sheet-render.png'
    subprocess.run([chrome, '--headless', '--hide-scrollbars', '--force-device-scale-factor=1',
                    f'--window-size={W},{H}', f'--screenshot={png}', (out / 'sheet.svg').resolve().as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    Image.open(png).convert('RGB').save(out / 'sheet.webp', 'WEBP', quality=88, method=6)
    png.unlink()
    print(f"rendered {out / 'sheet.webp'}")


if __name__ == '__main__':
    main()
