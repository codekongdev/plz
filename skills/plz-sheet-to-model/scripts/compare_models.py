"""Compare two inspect_model.py dumps (a new build against a previous version).

Usage:
  python -I compare_models.py <dump A> <dump B> [--map nameA=nameB ...] [--montage <dir>]

Prints per-mesh count and bound differences, per-image and per-render mean absolute differences
(0-255), and writes side-by-side render montages (A left, B right) when --montage is given.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def main(argv):
    a, b = Path(argv[0]), Path(argv[1])
    mapping = dict(m.split("=", 1) for i, m in enumerate(argv) if i > 0 and argv[i - 1] == "--map")
    montage = Path(argv[argv.index("--montage") + 1]) if "--montage" in argv else None
    sa, sb = json.loads((a / "stats.json").read_text()), json.loads((b / "stats.json").read_text())
    print("meshes")
    worst = 0.0
    for name in sorted(set(sa) | set(sb)):
        if name not in sa or name not in sb:
            print(f"  {name:22s} only in {'A' if name in sa else 'B'}")
            continue
        x, y = sa[name], sb[name]
        counts = all(x[k] == y[k] for k in ("verts", "faces", "tris"))
        bd = max(abs(p - q) for u, v in zip(x["boundsCm"], y["boundsCm"]) for p, q in zip(u, v)) * 10
        ld = max(abs(p - q) for p, q in zip(x["location"], y["location"])) * 1000
        worst = max(worst, bd)
        line = f"  {name:22s} counts {'equal' if counts else 'DIFF'} v{x['verts']}/{y['verts']} f{x['faces']}/{y['faces']} " \
               f"t{x['tris']}/{y['tris']}  bounds max diff {bd:.4f} mm  location diff {ld:.4f} mm"
        if "extremes" in x and "extremes" in y:
            ed = max(abs(p - q) for k in x["extremes"] for p, q in zip(x["extremes"][k], y["extremes"][k])) * 1000
            line += f"  extremes diff {ed:.4f} mm"
        print(line)
    print(f"  worst bound diff {worst:.4f} mm")

    print("images")
    for ia in sorted((a / "images").glob("*.png")):
        nb = mapping.get(ia.stem, ia.stem)
        ib = b / "images" / (nb + ".png")
        if not ib.exists():
            continue
        x = np.asarray(Image.open(ia).convert("RGBA")).astype(int)
        y = np.asarray(Image.open(ib).convert("RGBA")).astype(int)
        if x.shape != y.shape:
            print(f"  {ia.stem} vs {nb}: size {x.shape} vs {y.shape}")
            continue
        d = np.abs(x - y)[..., :3]
        print(f"  {ia.stem:28s} vs {nb:28s} mean {d.mean():.3f} max {d.max()} px>8 {(d.max(-1) > 8).mean() * 100:.2f}%")

    print("renders")
    if montage:
        montage.mkdir(parents=True, exist_ok=True)
    for ra in sorted(a.glob("render_*.png")):
        rb = b / ra.name
        if not rb.exists():
            continue
        x, y = Image.open(ra).convert("RGB"), Image.open(rb).convert("RGB")
        d = np.abs(np.asarray(x).astype(int) - np.asarray(y).astype(int))
        print(f"  {ra.stem:22s} mean {d.mean():.3f} max {d.max()} px>8 {(d.max(-1) > 8).mean() * 100:.2f}%")
        if montage:
            m = Image.new("RGB", (x.width * 2, x.height))
            m.paste(x, (0, 0))
            m.paste(y, (x.width, 0))
            m.save(montage / f"{ra.stem}.png")


if __name__ == "__main__":
    main(sys.argv[1:])
