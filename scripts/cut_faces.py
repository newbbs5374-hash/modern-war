#!/usr/bin/env python3
"""나라별 얼굴 그림 자르기(11/24).

대장이 만든 sheet-<나라>-<번호>.png(4×4 · 3×3 · 2×2, 수행비서는 한 사람 그림)를 칸마다 잘라
src/assets/portraits/face-<묶음>-<성별>-<나이대>-<번호>.webp(256px)로 저장하고,
같은 나라 안에서 너무 닮은 얼굴 쌍을 알려 줘요(다시 만들 칸 목록).

쓰는 법:  python3 scripts/cut_faces.py <그림 폴더> [저장 폴더]
칸 배치는 scripts/face-sheets.json(npm run faces로 만듦)을 따라요.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZE = 256
TRIM = 0.035  # 칸 가장자리(틈) 조금 잘라 냄
SIMILAR = 10  # dHash 거리(64비트 중) 이 값 이하면 "너무 닮음"


def dhash(img: Image.Image, n: int = 8) -> int:
    g = img.convert('L').resize((n + 1, n), Image.LANCZOS)
    px = list(g.tobytes())
    v = 0
    for r in range(n):
        for c in range(n):
            v = (v << 1) | (1 if px[r * (n + 1) + c] > px[r * (n + 1) + c + 1] else 0)
    return v


def find(folder: Path, name: str):
    for ext in ('png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG', 'WEBP'):
        p = folder / f'{name}.{ext}'
        if p.exists():
            return p
    return None


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'src/assets/portraits'
    out.mkdir(parents=True, exist_ok=True)
    sheets = []
    # 2 = 추가 22장(sheet-<나라>-6~8) · 3 = 수행비서(secretary-<나라>, 한 사람) · 젊은 부관(sheet-<나라>-y1…) · 4×4 장관급(sheet-<나라>-9~13)
    for jf in ('scripts/face-sheets.json', 'scripts/face-sheets-2.json', 'scripts/face-sheets-3.json', 'scripts/face-sheets-4.json'):  # 4 = 11-26 새 나라 5개
        if (ROOT / jf).exists():
            sheets += json.loads((ROOT / jf).read_text())
    done, missing, hashes = 0, [], {}
    for sh in sheets:
        p = find(src, sh['sheet'])
        if not p:
            missing.append(sh['sheet'])
            continue
        img = Image.open(p).convert('RGB')
        w, h = img.size
        s = min(w, h)
        img = img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
        g = sh['grid']
        cell = s / g
        for i, file in enumerate(sh['cells']):
            r, c = divmod(i, g)
            m = cell * TRIM if g > 1 else 0
            box = (round(c * cell + m), round(r * cell + m), round((c + 1) * cell - m), round((r + 1) * cell - m))
            face = img.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
            face.save(out / f'{file}.webp', 'WEBP', quality=86, method=6)
            country = file.split('-')[1]
            hashes.setdefault(country, []).append((file, dhash(face.crop((48, 24, 208, 200)))))
            done += 1
    print(f'잘라 낸 얼굴 {done}장 → {out}')
    if missing:
        print(f'없는 그림 {len(missing)}장: {", ".join(missing)}')
    pairs = []
    for country, hs in hashes.items():
        for a in range(len(hs)):
            for b in range(a + 1, len(hs)):
                d = bin(hs[a][1] ^ hs[b][1]).count('1')
                if d <= SIMILAR:
                    pairs.append((d, hs[a][0], hs[b][0]))
    if pairs:
        print(f'너무 닮은 쌍 {len(pairs)}개(뒤쪽 칸을 다시 만들면 좋아요):')
        for d, a, b in sorted(pairs):
            print(f'  {a} ↔ {b} (거리 {d})')
    else:
        print('너무 닮은 얼굴 없음')


if __name__ == '__main__':
    main()
