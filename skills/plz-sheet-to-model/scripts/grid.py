"""Overlay a labelled pixel grid on a view, for reading outline points (e.g. wings.foldOutlinePx).

Usage:
  python -I grid.py <view.webp> <out.png> [--step 50]

Lines every `step` px (darker and labelled every 2*step). Coordinates are image pixels with
x to the right and y down, exactly what the spec's *Px polygons use.
"""
import sys

from PIL import Image, ImageDraw


def main(argv):
    src, dst = argv[0], argv[1]
    step = int(argv[argv.index("--step") + 1]) if "--step" in argv else 50
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    W, H = im.size
    for x in range(0, W, step):
        major = x % (2 * step) == 0
        d.line([(x, 0), (x, H)], fill=(255, 0, 0, 255) if major else (255, 160, 160, 255), width=1)
        if major:
            d.text((x + 2, 2), str(x), fill=(200, 0, 0, 255))
    for y in range(0, H, step):
        major = y % (2 * step) == 0
        d.line([(0, y), (W, y)], fill=(0, 0, 255, 255) if major else (160, 160, 255, 255), width=1)
        if major:
            d.text((2, y + 2), str(y), fill=(0, 0, 200, 255))
    bg.convert("RGB").save(dst)


if __name__ == "__main__":
    main(sys.argv[1:])
