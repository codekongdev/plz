"""Find and download licensed reference photos from Wikimedia Commons.

Usage:
  python commons_refs.py article "Cat"                  # images used in an English Wikipedia article (curated, usually best)
  python commons_refs.py search "Felis catus standing"  # full-text search of Commons files
  python commons_refs.py category "Felis catus in profile"
  python commons_refs.py preview OUT_DIR "File:A.jpg" "File:B.jpg" ...   # small thumbnails + contact.png
  python commons_refs.py fetch OUT_DIR "File:A.jpg" "File:B.jpg" [--width 1200]

Listing modes print size | license | author | title for each candidate.
preview and fetch refuse a non-empty OUT_DIR (downloads are untrusted data: keep each
batch in its own fresh folder). preview saves 360 px thumbnails and contact.png, a
numbered sheet to look at; fetch saves ref-1.jpg, ref-2.jpg ... at --width and
OUT_DIR/sources.json with title, page, license, licence URL and author. Only openly
licensed files are downloaded; credit them. Rate limits (HTTP 429) are retried with backoff.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HEADERS = {'User-Agent': 'plz-model-sheet/1.0 (reference research)'}
COMMONS = 'https://commons.wikimedia.org/w/api.php'
OPEN_LICENCES = ('CC0', 'Public domain', 'CC BY', 'CC-BY', 'PD')


def get(url: str, timeout: int = 30) -> bytes:
    """GET with backoff: Wikimedia answers bursts with 429 Too Many Requests."""
    for wait in (0, 5, 15, 40):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 503):
                raise SystemExit(f'HTTP {error.code} for {url}')
    raise SystemExit('Wikimedia is still rate-limiting (HTTP 429). Wait a few minutes, then retry with fewer requests.')


def api(url: str, params: dict) -> dict:
    return json.loads(get(f"{url}?{urllib.parse.urlencode({**params, 'format': 'json'})}"))


def info(titles: list[str], width: int | None = None) -> list[dict]:
    rows = []
    for i in range(0, len(titles), 40):
        params = {'action': 'query', 'titles': '|'.join(titles[i:i + 40]), 'prop': 'imageinfo',
                  'iiprop': 'url|size|extmetadata', 'iiextmetadatafilter': 'LicenseShortName|LicenseUrl|Artist|ImageDescription'}
        if width:
            params['iiurlwidth'] = width
        for page in api(COMMONS, params)['query']['pages'].values():
            if 'imageinfo' not in page:
                continue
            ii = page['imageinfo'][0]
            meta = ii.get('extmetadata', {})
            text = lambda key: re.sub('<[^>]+>', '', meta.get(key, {}).get('value', '')).strip()
            rows.append({'title': page['title'], 'page': ii['descriptionurl'], 'license': text('LicenseShortName'),
                         'licenseUrl': text('LicenseUrl'), 'author': text('Artist'), 'size': [ii['width'], ii['height']],
                         'description': text('ImageDescription')[:120], 'thumb': ii.get('thumburl')})
    order = {t: n for n, t in enumerate(titles)}
    return sorted(rows, key=lambda r: order.get(r['title'], 0))


def list_titles(mode: str, term: str) -> list[str]:
    if mode == 'article':
        pages = api('https://en.wikipedia.org/w/api.php', {'action': 'query', 'titles': term, 'prop': 'images', 'imlimit': 100})['query']['pages']
        titles = [i['title'] for p in pages.values() for i in p.get('images', [])]
    elif mode == 'category':
        cat = term if term.startswith('Category:') else f'Category:{term}'
        titles = [m['title'] for m in api(COMMONS, {'action': 'query', 'list': 'categorymembers', 'cmtitle': cat,
                                                     'cmtype': 'file', 'cmlimit': 60})['query']['categorymembers']]
    else:
        found = api(COMMONS, {'action': 'query', 'list': 'search', 'srsearch': term, 'srnamespace': 6, 'srlimit': 40})
        titles = [h['title'] for h in found['query']['search']]
    return [t for t in titles if t.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]


def download(out: Path, titles: list[str], width: int) -> list[dict]:
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f'{out} is not empty; download into a new folder')
    out.mkdir(parents=True, exist_ok=True)
    rows = info(titles, width)
    for n, row in enumerate(rows, 1):
        if not row['license'].startswith(OPEN_LICENCES):
            print(f"SKIP {row['title']}: licence {row['license']!r} is not open")
            continue
        row['file'] = f'ref-{n}.jpg'
        (out / row['file']).write_bytes(get(row['thumb'], timeout=60))
        print(f"{row['file']}: {row['license']} | {row['author'][:40]} | {row['title']}")
    kept = [r for r in rows if 'file' in r]
    (out / 'sources.json').write_text(json.dumps(kept, ensure_ascii=False, indent=1), encoding='utf-8')
    return kept


def contact_sheet(out: Path, rows: list[dict]) -> None:
    from PIL import Image, ImageDraw  # only needed here; run with the skill's venv
    cell, cols = 380, 4
    sheet = Image.new('RGB', (cols * cell, ((len(rows) + cols - 1) // cols) * (cell + 24)), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(rows):
        thumb = Image.open(out / row['file']).convert('RGB')
        thumb.thumbnail((cell - 10, cell - 10))
        x, y = (i % cols) * cell, (i // cols) * (cell + 24)
        sheet.paste(thumb, (x + 5, y + 5))
        draw.text((x + 6, y + cell + 4), f"{row['file']}  {row['license']}", fill='black')
    sheet.save(out / 'contact.png')
    print(f"{out / 'contact.png'}: look at it, then fetch the chosen titles into another new folder")


def main() -> None:
    mode = sys.argv[1]
    if mode in ('fetch', 'preview'):
        out = Path(sys.argv[2])
        titles = [a for a in sys.argv[3:] if a.startswith('File:')]
        width = int(sys.argv[sys.argv.index('--width') + 1]) if '--width' in sys.argv else (360 if mode == 'preview' else 1200)
        rows = download(out, titles, width)
        if mode == 'preview' and rows:
            contact_sheet(out, rows)
        return
    for row in info(list_titles(mode, ' '.join(sys.argv[2:]))):
        print(f"{row['size'][0]}x{row['size'][1]} | {row['license']} | {row['author'][:30]} | {row['title']} | {row['description'][:60]}")


if __name__ == '__main__':
    main()
