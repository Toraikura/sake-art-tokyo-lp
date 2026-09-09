from pathlib import Path
from PIL import Image
import gdown
import io
import tempfile

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

with tempfile.TemporaryDirectory(prefix='aroma-lab-') as tmp:
    tmp_dir = Path(tmp)
    for index, (name, file_id) in enumerate(rows, 1):
        print(f'[{index:02d}/60] {name}', flush=True)
        tmp_path = tmp_dir / name
        result = gdown.download(id=file_id, output=str(tmp_path), quiet=True)
        if not result or not tmp_path.exists():
            raise RuntimeError(f'{name}: Google Drive download failed')
        data = tmp_path.read_bytes()
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise RuntimeError(f'{name}: Google Drive response is not PNG ({len(data)} bytes)')

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
