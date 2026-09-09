from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image
import base64
import io
import re

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name('drive-manifest.tsv')
MASTER = ROOT / 'assets' / 'aroma-lab' / 'master'
WEB = ROOT / 'assets' / 'aroma-lab'
MASTER.mkdir(parents=True, exist_ok=True)
WEB.mkdir(parents=True, exist_ok=True)

rows = []
for raw in MANIFEST.read_text(encoding='utf-8').splitlines():
    raw = raw.strip()
    if not raw or raw.startswith('#'):
        continue
    name, file_id = raw.split('\t', 1)
    rows.append((name, file_id))

if len(rows) != 60 or len({name for name, _ in rows}) != 60:
    raise SystemExit(f'Expected 60 unique images, got {len(rows)}')

PNG_SIG = b'\x89PNG\r\n\x1a\n'

def download_drive_png(file_id: str, name: str) -> bytes:
    candidates = [
        f'https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t',
        f'https://drive.google.com/uc?export=download&id={file_id}&confirm=t',
        f'https://drive.google.com/uc?export=view&id={file_id}',
        f'https://lh3.googleusercontent.com/d/{file_id}',
    ]
    last = None
    for url in candidates:
        try:
            req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urlopen(req, timeout=90) as response:
                data = response.read()
                content_type = response.headers.get('Content-Type', '')
            if data.startswith(PNG_SIG):
                return data
            # Google Drive's unauthenticated viewer can embed the preview PNG as base64.
            text = data.decode('utf-8', errors='ignore')
            match = re.search(r'iVBORw0KGgo[A-Za-z0-9+/=]{1000,}', text)
            if match:
                decoded = base64.b64decode(match.group(0))
                if decoded.startswith(PNG_SIG):
                    return decoded
            last = f'{url}: {content_type}, {len(data)} bytes, embedded_png={"yes" if "iVBORw0KGgo" in text else "no"}'
        except Exception as exc:
            last = f'{url}: {type(exc).__name__}: {exc}'
    raise RuntimeError(f'{name}: unable to retrieve PNG; last attempt: {last}')

for index, (name, file_id) in enumerate(rows, 1):
    print(f'[{index:02d}/60] {name}', flush=True)
    data = download_drive_png(file_id, name)
    master_path = MASTER / name
    master_path.write_bytes(data)

    with Image.open(io.BytesIO(data)) as image:
        image.load()
        if image.size != (1254, 1254):
            raise RuntimeError(f'{name}: unexpected source size {image.size}')
        rgba = image.convert('RGBA')
        alpha = rgba.getchannel('A')
        lo, hi = alpha.getextrema()
        if lo != 0 or hi != 255:
            raise RuntimeError(f'{name}: source transparency range is {(lo, hi)}, expected (0, 255)')
        web = rgba.resize((192, 192), Image.Resampling.LANCZOS)
        web.save(WEB / name, 'PNG', optimize=True, compress_level=9)

masters = sorted(MASTER.glob('aroma-*.png'))
webs = sorted(p for p in WEB.glob('aroma-*.png') if p.is_file())
if len(masters) != 60 or len(webs) != 60:
    raise RuntimeError(f'Asset count mismatch: masters={len(masters)} web={len(webs)}')
print('AROMA LAB assets ready: 60 masters + 60 web PNGs')
