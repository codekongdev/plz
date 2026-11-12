"""Measure an orthographic reference sheet and prepare the projection textures.

Usage:
  python -I measure_views.py <model spec.json> <work dir>

Reads the sheet that the spec points at (`sheet`, default the spec's parent folder):
views/*.webp with transparent background and measurements.json (px/cm per view, pivot).
Writes <work>/measure.json (profiles, front widths, eye, spread planform, mapping
constants for Blender) and the textures the Blender build projects:
  tex_side/top/front/back.png   padded colour per view (legs removed unless texture.keepLegs)
  tex_wingmask.png              folded-wing outline on the side view   (bird wings)
  tex_side_flank.png            side view with the folded wing filled  (bird wings)
  tex_spread_rgb.png            padded glide view for the wingless back (bird wings)
  <id>_wing_top/under.png       RGBA spread-wing textures, alpha = silhouette (bird wings)

Coordinates: f = forward cm from the foot pivot (+ = head), z = height cm, x = lateral cm.
Views must be oriented like plz-model-sheet's output: side and top with the head to the right,
front and back upright, the glide (spread) view with the head up.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


# ---------------------------------------------------------------- image helpers
def load(path):
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255
    return im, im[..., 3] > 0.5


def shift(a, dy, dx):
    """Shift without wrap-around (np.roll wraps and smears one image edge into the other)."""
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = \
        a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def window_count(mask, k, axis):
    """Number of True pixels in a centred window of size k along axis (outside the image counts as False)."""
    m = mask.astype(np.int32)
    pad = [(0, 0), (0, 0)]
    pad[axis] = (k // 2 + 1, k - k // 2)
    c = np.cumsum(np.pad(m, pad), axis=axis)
    n = mask.shape[axis]
    return np.take(c, np.arange(k, k + n), axis=axis) - np.take(c, np.arange(0, n), axis=axis)


def window_all(mask, k, axis):
    """True where every pixel in a centred window of size k along axis is True."""
    return window_count(mask, k, axis) == k


def erode(mask, k):
    return window_all(window_all(mask, k, 0), k, 1)


def open_box(mask, size_cm, px):
    """Morphological opening with a [height, width] cm box: drops parts thinner than the box in
    either direction (whiskers, paw bumps on the top outline) and keeps everything wider."""
    if not size_cm:
        return mask
    kh, kw = (max(1, int(round(s * px)) | 1) for s in size_cm)      # odd sizes keep the window centred
    e = window_all(window_all(mask, kh, 0), kw, 1)
    return (window_count(window_count(e, kh, 0) > 0, kw, 1) > 0) & mask


def cut_polygons(mask, polygons):
    """Remove pixel polygons (x right, y down) from a silhouette, e.g. ears above the head line."""
    if not polygons:
        return mask
    img = Image.new("L", (mask.shape[1], mask.shape[0]), 0)
    for poly in polygons:
        ImageDraw.Draw(img).polygon([tuple(p) for p in poly], fill=255)
    return mask & (np.asarray(img) == 0)


def nonempty_column(mask, c, towards_left, reach=4):
    """Rows of column c; at a 1-px tip trimmed by the opening, step up to `reach` px inwards."""
    for i in range(reach + 1):
        cc = min(max(c - i if towards_left else c + i, 0), mask.shape[1] - 1)
        rows = np.nonzero(mask[:, cc])[0]
        if len(rows):
            return rows
    return rows


def half_widths(mask, centre, ground, px, step, dec):
    """[[z, half width]] of a front/back silhouette every `step` cm, from its centre column."""
    hw = []
    for zc in np.arange(0, ground / px + 0.5, step):
        r = int(round(ground - zc * px))
        if 0 <= r < mask.shape[0] and mask[r].any():
            c = np.nonzero(mask[r])[0]
            hw.append([round(float(zc), dec), round(float(max(centre - c.min(), c.max() - centre) / px), dec)])
    return hw


def shape_mask(shape, entries):
    """Mask of pixel circles [cx, cy, r] and polygons [[x, y], ...] (x right, y down)."""
    img = Image.new("L", (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(img)
    for e in entries:
        if isinstance(e[0], (int, float)):
            cx, cy, r = e
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        else:
            d.polygon([tuple(p) for p in e], fill=255)
    return np.asarray(img) > 0


def write_textures(spec, name, im, source, pad_iters, work):
    """tex_<name>.png: the view with its silhouette padded outwards. With `texture.bodyFillPx`
    for this view also tex_<name>_body.png, where the listed areas (painted eyes that the eyeballs
    replace, an ear drawn in front of the head) are diffusion-filled from around them: the body is
    baked from that copy, separate parts (ears) from the plain one."""
    Image.fromarray(to_u8(pad_colours(im, source, pad_iters))).save(work / f"tex_{name}.png")
    fills = spec["texture"].get("bodyFillPx", {}).get(name)
    if not fills:
        return
    hole = shape_mask(source.shape, fills)
    rgb = diffuse_fill(im[..., :3], source & ~hole, spec["texture"].get("fillIters", 400), spec["texture"].get("fillScale", 4))
    filled = np.dstack([rgb, im[..., 3:]])
    Image.fromarray(to_u8(pad_colours(filled, source, pad_iters))).save(work / f"tex_{name}_body.png")


def geometry_mask(spec, name, mask, px):
    """Silhouette used for shape measurements: `silhouette.openCm` and `silhouette.cutsPx` per view.
    Textures keep the full silhouette, so cut parts (ears, paws) still get their colour."""
    sil = spec.get("silhouette", {})
    return cut_polygons(open_box(mask, sil.get("openCm", {}).get(name), px), sil.get("cutsPx", {}).get(name))


def body_mask(mask, px, ground_row, cols, rm):
    """Remove legs and toes: rows under toeCm are dropped, rows up to cutCm keep only horizontal
    runs of at least minRunCm (the belly), inside the column range `cols`."""
    out = mask.copy()
    c0, c1 = cols
    for r in range(mask.shape[0]):
        z = (ground_row - r) / px
        if z >= rm["cutCm"]:
            continue
        row = mask[r, c0:c1]
        if z < rm["toeCm"]:
            out[r, c0:c1] = False
            continue
        keep = np.zeros_like(row)
        idx = np.nonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))[0].reshape(-1, 2)
        for a, b in idx:
            if (b - a) / px >= rm["minRunCm"]:
                keep[a:b] = True
        out[r, c0:c1] = keep
    return out


def pad_colours(im, source, iters):
    """Fill everything outside `source` with the average of filled 8-neighbours, repeatedly, so
    projection rays that miss the silhouette by a little still get the subject's colour."""
    rgb = im[..., :3] * source[..., None]
    w = source.astype(np.float32)
    for _ in range(iters):
        if w.min() > 0:
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros_like(w)
        cw = rgb * w[..., None]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            acc += shift(cw, dy, dx)
            cnt += shift(w, dy, dx)
        grow = (w == 0) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow, None]
        w = np.where(grow, 1.0, w)
    rgb[w == 0] = rgb[w > 0].mean(0)
    return rgb


def diffuse_fill(rgb, known, iters, scale):
    """Fill unknown pixels from known ones by neighbour averaging on a downsampled grid."""
    h, w = known.shape
    hs, ws = h // scale, w // scale
    small = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8)).resize((ws, hs), Image.BOX)).astype(np.float32) / 255
    ks = np.asarray(Image.fromarray(known.astype(np.uint8) * 255).resize((ws, hs), Image.BOX)) > 250
    col = small * ks[..., None]
    wgt = ks.astype(np.float32)
    for _ in range(iters):
        acc = np.zeros_like(col)
        cnt = np.zeros_like(wgt)
        cw = col * wgt[..., None]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc += shift(cw, dy, dx)
            cnt += shift(wgt, dy, dx)
        upd = ~ks & (cnt > 0)
        col[upd] = acc[upd] / cnt[upd, None]
        wgt = np.where(upd, 1.0, wgt)
    big = np.asarray(Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 255
    return np.where(known[..., None], rgb, big)


def to_u8(rgb):
    return (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)


def colour_mask(im, mask, ground, px, detect):
    """Pixels of a distinct eye colour above minHeightCm. Only 'orange' is calibrated so far."""
    rows = np.arange(mask.shape[0])[:, None]
    mask = mask & ((ground - rows) / px > detect["minHeightCm"])
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    if detect["colour"] != "orange":
        raise SystemExit(f"eye colour '{detect['colour']}' is not calibrated; give eyes.position in the spec")
    return mask & (r > 0.55) & (g > 0.2) & (g < 0.55) & (b < 0.3) & (r - g > 0.25)


def smooth(a, k):
    p = np.pad(a, k // 2, mode="edge")
    return np.convolve(p, np.ones(k) / k, mode="valid")


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)]) / 255


# ---------------------------------------------------------------- main
def main():
    spec_path, work = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
    work.mkdir(parents=True, exist_ok=True)
    spec = json.loads(spec_path.read_text())
    sheet = (spec_path.parent / spec.get("sheet", "..")).resolve()
    meas = json.loads((sheet / "measurements.json").read_text())
    px = dict(meas["sourcePxPerCm"])
    px.update(spec.get("pxPerCm", {}))
    beak_f = spec.get("frontCm", meas["pivot_cm"]["front"])
    tail_f = -spec.get("backCm", meas["pivot_cm"]["back"])
    views = {k: sheet / v for k, v in spec["views"].items()}
    rm = spec["legRemoval"]
    loft = spec["loft"]
    dec = loft.get("decimals", 2)
    pad_iters = spec["texture"].get("padIters", 80)
    keep_legs = spec["texture"].get("keepLegs", False)     # quadrupeds: legs are modelled, so texture them
    out = {"id": spec["id"], "sheet": str(sheet), "px": px, "beakF": beak_f, "tailF": tail_f, "views": {}}

    # side ------------------------------------------------------------------
    im, m = load(views["side"])
    H, W = m.shape
    ks = px["side"]
    rows, cols = np.nonzero(m)
    ground = int(rows.max())
    beak_col = int(cols.max())
    pivot = beak_col - beak_f * ks
    lo, hi = rm["sideRangeCm"]
    bm = body_mask(geometry_mask(spec, "side", m, ks), ks, ground, (int(pivot + lo * ks), int(pivot + hi * ks)), rm)
    dbg = (im[..., :3] * 255).astype(np.uint8)
    dbg[m & ~bm] = [255, 0, 0]
    Image.fromarray(dbg).save(work / "debug_side_legs.png")
    out["views"]["side"] = {"W": W, "H": H, "ground": ground, "pivot": float(pivot), "px": ks}
    eyes = spec.get("eyes")
    if eyes and "position" not in eyes:
        e = colour_mask(im, m, ground, ks, eyes["detect"])
        er, ec = np.nonzero(e)
        out["eye"] = {"f": round(float((ec.mean() - pivot) / ks), dec), "z": round(float((ground - er.mean()) / ks), dec)}
    src = m if keep_legs else bm
    write_textures(spec, "side", im, erode(src & (im[..., 3] > 0.99), 3), pad_iters, work)

    # top -------------------------------------------------------------------
    imt, mt = load(views["top"])
    Ht, Wt = mt.shape
    kt = px["top"]
    rt, ct = np.nonzero(mt)
    beak_t = int(ct.max())
    centre_t = float((rt.min() + rt.max()) / 2)
    out["views"]["top"] = {"W": Wt, "H": Ht, "beakCol": beak_t, "centreRow": centre_t, "px": kt}
    write_textures(spec, "top", imt, erode(mt & (imt[..., 3] > 0.99), 3), pad_iters, work)
    mtg = geometry_mask(spec, "top", mt, kt)

    # front / back ------------------------------------------------------------
    widths = {}
    for name in ("front", "back"):
        imf, mf = load(views[name])
        Hf, Wf = mf.shape
        kf = px[name]
        rf, _ = np.nonzero(mf)
        gf = int(rf.max())
        bmf = body_mask(geometry_mask(spec, name, mf, kf), kf, gf, (0, Wf), rm)
        _, bc = np.nonzero(bmf)
        centre = float((bc.min() + bc.max()) / 2)
        out["views"][name] = {"W": Wf, "H": Hf, "ground": gf, "centre": centre, "px": kf}
        widths[name] = half_widths(bmf, centre, gf, kf, loft.get("frontStepCm", 0.5), dec)
        if name == "front":
            out["frontHalfWidth"] = widths[name]
            if eyes and "position" not in eyes:
                e = colour_mask(imf, mf, gf, kf, eyes["detect"])
                er, ec = np.nonzero(e)
                left = ec < centre
                out["eyeFront"] = {"x": round(float((ec[~left].mean() - ec[left].mean()) / 2 / kf), 3),
                                   "z": round(float((gf - er.mean()) / kf), 3)}
        src = mf if keep_legs else bmf
        write_textures(spec, name, imf, erode(src & (imf[..., 3] > 0.99), 3), pad_iters, work)
    if loft.get("clampViews"):
        # per height, the widest of the listed views: a silhouette bounds every section at that height
        tables = [dict((z, w) for z, w in widths[v]) for v in loft["clampViews"]]
        zs = sorted(set().union(*tables))
        out["clampHalfWidth"] = [[z, max(t[z] for t in tables if z in t)] for z in zs]

    # loft profile: silhouette top/bottom (side) and half width (top) every 0.25 cm ----------
    prof = []
    for f in np.arange(tail_f, beak_f + 1e-6, 0.25):
        c = min(max(int(round(pivot + f * ks)), 0), W - 1)
        col = nonempty_column(bm, c, f > 0)
        ct_ = min(max(int(round(beak_t - (beak_f - f) * kt)), 0), Wt - 1)
        tcol = nonempty_column(mtg, ct_, f > 0)
        if len(col) == 0 or len(tcol) == 0:
            raise SystemExit(f"empty silhouette at f={f:.2f} cm; check view alignment")
        prof.append([round(float(f), 3), round(float((ground - col.min()) / ks), 3),
                     round(float((ground - col.max()) / ks), 3), round(float((tcol.max() - tcol.min()) / 2 / kt), 3)])
    p = np.array(prof)
    fs = p[:, 0]
    zt, zb, hwid = (smooth(p[:, i], loft["smooth"]) for i in (1, 2, 3))
    tip = fs > loft["rawTipFromCm"]          # keep the raw beak/nose point, smoothing blunts it
    zt[tip], zb[tip], hwid[tip] = p[tip, 1], p[tip, 2], p[tip, 3]
    stations = np.concatenate([np.arange(*s) for s in loft["stations"]])
    out["profile"] = [[round(float(s), dec), round(float(np.interp(s, fs, zt)), dec),
                       round(float(np.interp(s, fs, zb)), dec), round(float(np.interp(s, fs, hwid)), dec)]
                      for s in stations]
    if spec.get("tail"):
        # smoothed silhouette centre line, for tail landmarks spaced by arc length along the tail
        out["sideCentre"] = [[round(float(f), 3), round(float((a + b) / 2), dec)] for f, a, b in zip(fs, zt, zb)]

    # bird wings ----------------------------------------------------------------
    wings = spec.get("wings")
    if wings and wings.get("type") == "bird":
        bird_wings(spec, wings, out, work, im, m, ground, ks, views, px, tail_f, dec)

    (work / "measure.json").write_text(json.dumps(out, indent=1))
    pr = out["profile"]
    print(f"side {W}x{H} pivot {pivot:.2f} ground {ground}; top {Wt}x{Ht}; stations {len(pr)}; "
          f"front widths {len(out['frontHalfWidth'])}; eye {out.get('eye')} front {out.get('eyeFront')}")


def bird_wings(spec, wings, out, work, side, ms, ground, ks, views, px, tail_f, dec):
    H, W = ms.shape
    # 1. folded-wing outline mask on the side view (supersampled, softened)
    SS = 4
    big = Image.new("L", (W * SS, H * SS), 0)
    ImageDraw.Draw(big).polygon([(x * SS, y * SS) for x, y in wings["foldOutlinePx"]], fill=255)
    mask_img = big.resize((W, H), Image.BOX).filter(ImageFilter.GaussianBlur(1.5))
    mask_img.save(work / "tex_wingmask.png")
    wing = np.asarray(mask_img) > 127

    # 2. side view without the folded wing: diffuse the flank colour, then pull it towards the
    #    body colour key because the reference belly is shaded darker by its lighting
    fl = wings["flank"]
    known = ms & ~wing & (side[..., 3] > 0.99)
    rows = np.arange(H)[:, None]
    cols = np.arange(W)[None, :]
    known &= ~(rows > ground + 1 - spec["legRemoval"]["toeCm"] * ks)
    for x0, y0, x1, y1 in fl.get("excludePx", []):
        known &= ~((cols >= x0) & (cols < x1) & (rows >= y0) & (rows < y1))
    flank = diffuse_fill(side[..., :3], known, fl.get("iters", 400), fl.get("scale", 4))
    key = hex_rgb(fl["keyColour"]) * fl["keyScale"]
    mix = (np.asarray(mask_img).astype(np.float32) / 255)[..., None] * fl["keyMix"]
    flank = flank * (1 - mix) + key * mix
    Image.fromarray(to_u8(flank)).save(work / "tex_side_flank.png")

    # 3. glide view: planform per span station, textures
    sw = wings["spread"]
    sp, msp = load(views["spread"])
    Hs, Ws = msp.shape
    k = px["spread"]
    r, c = np.nonzero(msp)
    tail_row = int(r.max())
    centre = float((c.min() + c.max()) / 2)
    out["views"]["spread"] = {"W": Ws, "H": Hs, "tailRow": tail_row, "centre": centre, "px": k}

    def f_of_row(row):
        return tail_f + (tail_row + 1 - row) / k

    st = []
    for x in np.arange(2.0, sw["spanCm"] + 0.01, 0.25):
        o = []
        for sgn in (1, -1):
            col = int(round(centre + sgn * x * k))
            if not (0 <= col < Ws):
                continue
            rr = np.nonzero(msp[:, col])[0]
            if len(rr) == 0:
                continue
            runs = np.split(rr, np.nonzero(np.diff(rr) > 3)[0] + 1)
            last = runs[-1] if x > sw["tailClearCm"] else runs[0]   # inside the tail's width the 2nd run is the tail
            o.append((f_of_row(runs[0].min()), f_of_row(last.max())))
        if o:
            st.append([round(float(x), 2), round(float(np.mean([a[0] for a in o])), 2), round(float(np.mean([a[1] for a in o])), 2)])
    s = np.array(st)
    ok = s[:, 0] >= sw["rootFromCm"]
    x, le, te = s[ok, 0], smooth(s[ok, 1], sw["smooth"]), smooth(s[ok, 2], sw["smooth"])
    plan = []
    for xi in sw["stations"]:
        xe = max(xi, sw["rootFromCm"])
        plan.append([xi, round(float(np.interp(xe, x, le)) + sw["leadPadCm"], dec),
                     round(float(np.interp(xe, x, te)) - sw["trailPadCm"], dec)])
    mid = (plan[-1][1] + plan[-1][2]) / 2
    plan.append([sw["tip"]["xCm"], round(mid + sw["tip"]["halfChordCm"], dec), round(mid - sw["tip"]["halfChordCm"], dec)])
    out["spreadPlan"] = plan
    out["spreadStations"] = st

    src = msp & (sp[..., 3] > 0.99)
    rgb = diffuse_fill(sp[..., :3], src, sw.get("padIters", 60), sw.get("padScale", 2))
    alpha = (sp[..., 3] * 255 + 0.5).astype(np.uint8)
    Image.fromarray(to_u8(rgb)).save(work / "tex_spread_rgb.png")
    top = np.dstack([to_u8(rgb), alpha])
    lum = rgb.mean(axis=2, keepdims=True)
    u = sw["underside"]
    pale = np.array(u["pale"])
    under = np.where(lum < u["darkBelow"], lum * u["darkGain"], (1 - u["paleMix"]) * lum + u["paleMix"] * pale)
    under = np.dstack([to_u8(under), alpha])
    # glTF keeps alpha textures as PNG even in JPEG mode and copies the packed bytes, so shrink them:
    # flatten colour outside the alpha (keeping padPx of padding for filtering) and optimise.
    pad = sw.get("alphaPadPx", 6)
    for name, arr, scale in (("top", top, 1.0), ("under", under, u.get("scale", 0.5))):
        a = Image.fromarray(arr[..., 3])
        near = np.asarray(a.filter(ImageFilter.MaxFilter(2 * pad + 1))) > 0
        arr = arr.copy()
        mean = arr[np.asarray(a) > 200][:, :3].mean(0).astype(np.uint8)
        arr[~near, :3] = mean
        img = Image.fromarray(arr, "RGBA")
        if scale != 1.0:
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
        img.save(work / f"{spec['id']}_wing_{name}.png", optimize=True, compress_level=9)


if __name__ == "__main__":
    main()
