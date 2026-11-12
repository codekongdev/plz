"""Cut generated views out of their white background, rotate and crop them.

Usage: python prepare_views.py SPEC.json RAW_DIR OUT_DIR

For every view in the spec, reads RAW_DIR/<file>, writes OUT_DIR/views/<name>.webp
(RGBA, cropped to the subject). Only the background connected to the image border is
removed, so white markings inside the subject (a white rump patch, a cat's chest) stay.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def cutout(path: Path) -> Image.Image:
    image = Image.open(path)
    if image.mode == 'RGBA' and np.asarray(image)[..., 3].min() < 250:
        return image  # already transparent
    rgb = np.asarray(image.convert('RGB')).astype(np.int16)
    minc = rgb.min(axis=2)
    whiteish = (minc > 226) & ((rgb.max(axis=2) - minc) < 16)
    bg = np.zeros_like(whiteish)
    bg[0, :], bg[-1, :], bg[:, 0], bg[:, -1] = whiteish[0, :], whiteish[-1, :], whiteish[:, 0], whiteish[:, -1]
    while True:  # grow the border region through connected near-white pixels
        grown = bg.copy()
        grown[1:, :] |= bg[:-1, :]
        grown[:-1, :] |= bg[1:, :]
        grown[:, 1:] |= bg[:, :-1]
        grown[:, :-1] |= bg[:, 1:]
        grown &= whiteish
        if (grown == bg).all():
            break
        bg = grown
    # Soft edge: near-white border pixels fade instead of leaving a white halo.
    alpha = np.where(bg, np.clip((250 - minc) / 24.0, 0, 1), 1.0)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)]), 'RGBA')


def crop_to_subject(image: Image.Image) -> Image.Image:
    solid = np.asarray(image)[..., 3] > 127
    rows = np.nonzero(solid.sum(axis=1) > 2)[0]
    cols = np.nonzero(solid.sum(axis=0) > 2)[0]
    return image.crop((int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1))


def main() -> None:
    spec_path, raw, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    (out / 'views').mkdir(parents=True, exist_ok=True)
    for view in spec['views']:
        image = cutout(raw / view['file'])
        if view.get('rotate'):
            image = image.rotate(view['rotate'], expand=True)  # degrees, counter-clockwise
        image = crop_to_subject(image)
        target = out / 'views' / f"{view['name']}.webp"
        image.save(target, 'WEBP', quality=90, method=6)
        print(f"{view['name']}: {image.size[0]}x{image.size[1]} -> {target}")


if __name__ == '__main__':
    main()
