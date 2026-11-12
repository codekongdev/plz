"""Quick checks on generated or prepared views.

Usage:
  python measure.py IMAGE [IMAGE ...]      # subject bounding box and height/width ratio
  python measure.py grid IMAGE OUT.png     # subject with a 0.1 fraction grid, for reading
                                           # landmark 'y' and colour 'box' values for spec.json

Raw images are measured against their white background; prepared views (views/*.webp)
use their transparency. Fractions are relative to the subject's bounding box, exactly as
spec.json expects.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw


def subject_mask(image: Image.Image, threshold: int = 238) -> np.ndarray:
    if image.mode == 'RGBA' and np.asarray(image)[..., 3].min() < 250:
        mask = np.asarray(image)[..., 3] > 127
    else:
        rgb = np.asarray(image.convert('RGB')).astype(np.int16)
        # Background is near-white; anything darker or noticeably coloured is the subject.
        mask = (rgb.min(axis=2) < threshold) | ((rgb.max(axis=2) - rgb.min(axis=2)) > 18)
    # Drop isolated specks so stray noise does not stretch the box.
    rows = mask.sum(axis=1) > 2
    cols = mask.sum(axis=0) > 2
    return mask & rows[:, None] & cols[None, :]


def bbox(image: Image.Image):
    ys, xs = np.nonzero(subject_mask(image))
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def measure(path: str) -> dict:
    image = Image.open(path)
    left, top, right, bottom = bbox(image)
    width, height = right - left, bottom - top
    w, h = image.size
    return {
        'image': f'{w}x{h}', 'bbox': [left, top, right, bottom],
        'width': width, 'height': height, 'h_over_w': round(height / width, 3),
        'fill_w': round(width / w, 3), 'fill_h': round(height / h, 3),
    }


def grid(path: str, out: str) -> None:
    image = Image.open(path).convert('RGBA')
    crop = image.crop(bbox(image))
    scale = min(1.0, 1400 / max(crop.size))
    crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))))
    pad = 44
    sheet = Image.new('RGB', (crop.width + 2 * pad, crop.height + 2 * pad), 'white')
    sheet.paste(crop, (pad, pad), crop)
    draw = ImageDraw.Draw(sheet)
    for i in range(11):
        f = i / 10
        x, y = pad + f * crop.width, pad + f * crop.height
        colour = (200, 40, 40) if i % 5 == 0 else (60, 120, 220)
        draw.line([(x, pad), (x, pad + crop.height)], fill=colour, width=1)
        draw.line([(pad, y), (pad + crop.width, y)], fill=colour, width=1)
        draw.text((x - 8, 6), f'{f:.1f}', fill=colour)
        draw.text((4, y - 6), f'{f:.1f}', fill=colour)
    sheet.save(out)
    print(f'{out}: fraction grid over the {crop.width}x{crop.height} subject box (red every 0.5)')


if __name__ == '__main__':
    if sys.argv[1] == 'grid':
        grid(sys.argv[2], sys.argv[3])
    else:
        for path in sys.argv[1:]:
            print(path.rsplit('/', 1)[-1], measure(path))
