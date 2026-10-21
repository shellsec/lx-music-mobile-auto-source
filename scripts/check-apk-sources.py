"""Verify release APKs contain no standalone JavaScript scripts or old provider markers."""
import sys
import zipfile
from pathlib import Path

markers = [
    '-'.join(['lx-music', 'source']), '-'.join(['gh', 'proxy']),
    ''.join(['野', '花']), ''.join(['六', '音']), ''.join(['Hui', 'bq']),
    ''.join(['i', 'kun']), ''.join(['野', '草']), ''.join(['综合', 'API']),
    ''.join(['全都', '要']),
]
files = [Path(arg) for arg in sys.argv[1:]] if len(sys.argv) > 1 else sorted(Path('android/app/build/outputs/apk/release').glob('*.apk'))
if not files:
    raise SystemExit('No APKs found; artifact verification did not run.')
for file in files:
    with zipfile.ZipFile(file) as apk:
        for name in apk.namelist():
            # The sole upstream QuickJS bridge implements the import runtime, not a source.
            if name == 'assets/script/user-api-preload.js':
                expected = Path('android/app/src/main/assets/script/user-api-preload.js').read_bytes()
                if apk.read(name) != expected:
                    raise SystemExit(f'Unexpected import runtime in {file.name}')
                continue
            if name.lower().endswith(('.js', '.ts', '.jsx', '.tsx')):
                raise SystemExit(f'Unexpected script in {file.name}: {name}')
            if name.startswith('assets/'):
                body = apk.read(name)
                for marker in markers:
                    for encoding in ['utf-8', 'utf-16-le']:
                        if marker.encode(encoding) in body:
                            raise SystemExit(f'Preset source marker in {file.name}: {name}')
    print(f'Artifact check passed: {file.name}')
