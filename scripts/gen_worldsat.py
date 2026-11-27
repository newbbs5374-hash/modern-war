"""세계지도 실제 위성 바탕 만들기(11/25 대장 요청 W1·W2·W3·W5).

자료(모두 공개·무료):
- 땅: ESA WorldCover 2021 Sentinel-2 구름 없는 합성(10m, CC BY 4.0) — gen_homesat.py 와 같은 곳
- 바다 깊이·산 그림자: Mapzen Terrarium 높이 타일(AWS Open Data)
- 밤 불빛: NASA Black Marble(three-globe 예제 earth-night.jpg), 구름: NASA 구름(webgl-earth fair_clouds_4k.png)
입력: python3 scripts/gen_worldsat.py <s2tiles.json> <earth-night.jpg> <clouds.png>
출력:
- src/assets/world/world-map.webp : 확대 1배 바탕(바다 깊이 색 + 위성 땅 + 산 그림자), 1도 = 12칸
- src/assets/world/world-night.webp: 밤 불빛(알파), src/assets/world/world-clouds.webp: 구름(알파)
- public/world-sat/1-x-y.webp + meta.json : 확대용 고해상 땅 조각(1도 = 60칸, 512칸 조각, 바다만 있는 조각은 없음)
게임 좌표(src/data/realGeo.ts): 경도 -15~330, 위도 -56~80, 정거원통.
11-27 남반구로 넓힘: OLD=1 이면 옛 범위(경도 -15~300, 위도 5~80)는 새로 받지 않고 옛 그림·조각을 그대로 붙임.
"""
import json, math, os, sys, time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_homerelief as R  # noqa: E402  (타일 읽기·깊이 색·그림자 재사용)
import gen_homesat as S  # noqa: E402
from gen_homesat import read_tile, tone, tname  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_A = os.path.join(ROOT, 'src/assets/world')
OUT_P = os.path.join(ROOT, 'public/world-sat')
os.makedirs(OUT_P, exist_ok=True)
LON0, LON1, LAT0, LAT1 = -15, 330, -56, 80
OLD = os.environ.get('OLD') == '1'
OLD_LON1, OLD_LAT0 = 300, 5
old_area = lambda la, lo: OLD and lo < OLD_LON1 and la >= OLD_LAT0
P0, P1, TILE = 12, 60, 512
have = set(json.load(open(sys.argv[1])))
S.have = have

W0, H0 = (LON1 - LON0) * P0, (LAT1 - LAT0) * P0
W1, H1 = (LON1 - LON0) * P1, (LAT1 - LAT0) * P1

# ── 1) 땅 위성 사진: 30도 띠씩 ──
land0 = np.zeros((H0, W0, 4), np.float32)  # 1배용(색+알파)
tiles = []
STRIP = 30
for s0 in range(LON0, LON1, STRIP):
    s1 = min(LON1, s0 + STRIP)
    sw = (s1 - s0) * P1
    mos = np.zeros((4, H1, sw), np.uint16)
    jobs = []
    for la in range(LAT0, LAT1):
        for lo in range(s0, s1):
            lw = ((lo + 180) % 360) - 180
            if tname(la, lw) in have and not old_area(la, lo):
                jobs.append((la, lw, lo))
    t = time.time()
    with ThreadPoolExecutor(24) as ex:
        for (la, lw, lo), a in zip(jobs, ex.map(read_tile, [(la, lw, P1) for la, lw, _ in jobs])):
            if a is None:
                continue
            mos[:, (LAT1 - 1 - la) * P1 : (LAT1 - la) * P1, (lo - s0) * P1 : (lo - s0 + 1) * P1] = a
    rgb = tone(mos)
    G = mos[1].astype(np.float32)
    N = mos[3].astype(np.float32)
    nodata = mos[:3].sum(axis=0) == 0
    del mos
    water = (((G - N) / np.maximum(G + N, 1) > 0.02) & (G < 1800)) | nodata
    lab, n = ndimage.label(water)
    if n:
        sizes = ndimage.sum(water, lab, range(1, n + 1))
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        big = np.array([0] + [1 if (sizes[i - 1] > 4000 or i in edge) else 0 for i in range(1, n + 1)], bool)
        sea = big[lab]
    else:
        sea = water
    land = ndimage.binary_opening(~sea, iterations=1)
    alpha = ndimage.gaussian_filter(land.astype(np.float32), 0.8)
    img8 = (np.clip(np.dstack([rgb, alpha]), 0, 1) * 255).astype(np.uint8)
    del rgb
    # 확대용 조각(전체 좌표 기준 512칸 격자)
    gx0 = (s0 - LON0) * P1
    for ty in range(0, H1, TILE):
        for gx in range((gx0 // TILE) * TILE, gx0 + sw, TILE):
            # 이 띠에 걸친 부분만(조각이 두 띠에 걸치면 나중 띠가 이어 그림)
            a0, a1 = max(gx, gx0), min(gx + TILE, gx0 + sw)
            part = img8[ty : ty + TILE, a0 - gx0 : a1 - gx0]
            name = os.path.join(OUT_P, f'1-{gx // TILE}-{ty // TILE}.png')
            if os.path.exists(name):
                cur = np.asarray(Image.open(name)).copy()
            else:
                if part[..., 3].max() < 8:
                    continue
                cur = np.zeros((min(TILE, H1 - ty), min(TILE, W1 - gx), 4), np.uint8)
            if OLD:
                # 옛 조각 위에 새 땅만 얹음(새 땅이 없는 칸은 옛 그림 그대로)
                reg = cur[: part.shape[0], a0 - gx : a1 - gx]
                take = part[..., 3:4] > reg[..., 3:4]
                cur[: part.shape[0], a0 - gx : a1 - gx] = np.where(take, part, reg)
            else:
                cur[: part.shape[0], a0 - gx : a1 - gx] = part
            Image.fromarray(cur, 'RGBA').save(name)
    small = Image.fromarray(img8, 'RGBA').resize(((s1 - s0) * P0, H0), Image.LANCZOS)
    land0[:, (s0 - LON0) * P0 : (s1 - LON0) * P0] = np.asarray(small).astype(np.float32) / 255
    print(f'띠 {s0}~{s1}: 타일 {len(jobs)}개 {time.time() - t:.0f}초', flush=True)

# 조각 png → webp(빈 조각 지움)
for f in sorted(os.listdir(OUT_P)):
    if not f.endswith('.png'):
        continue
    im = Image.open(os.path.join(OUT_P, f))
    os.remove(os.path.join(OUT_P, f))
    if np.asarray(im)[..., 3].max() < 8:
        continue
    im.save(os.path.join(OUT_P, f.replace('.png', '.webp')), quality=72, method=5)
    tx, ty = map(int, f[2:-4].split('-'))
    tiles.append([tx, ty])
json.dump({'b': [LON0, LAT0, LON1, LAT1], 'w1': W1, 'h1': H1, 'tile': TILE, 'tiles': sorted(tiles)}, open(os.path.join(OUT_P, 'meta.json'), 'w'), separators=(',', ':'))
print('조각', len(tiles), flush=True)

# ── 2) 바다 깊이 색 + 산 그림자 ──
el = R.elevation(LON0, LAT0, LON1, LAT1, W0, H0, 5)
sea_rgb = R.depth_color(el) / 255
sea_img = np.asarray(Image.fromarray((sea_rgb * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
a = land0[..., 3:4]
base = sea_img * (1 - a) + land0[..., :3] * a
# 산 그림자(북서쪽 빛, 과장 크게: 세계지도는 산이 작게 보임)
dk = R.shade(el, P0, 45, 315, 35, 6) * (el > 1)
base = base * (1 - 0.45 * dk[..., None])
if OLD:
    oldimg = np.asarray(Image.open(os.path.join(OUT_A, 'world-map.webp')).convert('RGB')).astype(np.float32) / 255
    oh, ow = (80 - OLD_LAT0) * P0, (OLD_LON1 - LON0) * P0
    base[:oh, :ow] = oldimg[:oh, :ow]
Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT_A, 'world-map.webp'), quality=80, method=6)
print('world-map', W0, H0, flush=True)


# ── 3) 밤 불빛·구름: 전 지구 그림 → 게임 범위 ──
def crop(path, mode):
    im = np.asarray(Image.open(path).convert(mode)).astype(np.float32) / 255
    h, w = im.shape[:2]
    xs = ((np.linspace(LON0, LON1, W0, endpoint=False) + 180) % 360) / 360 * w
    ys = (90 - np.linspace(LAT1, LAT0, H0, endpoint=False)) / 180 * h
    return im[np.clip(ys.astype(int), 0, h - 1)[:, None], np.clip(xs.astype(int), 0, w - 1)[None, :]]


night = crop(sys.argv[2], 'RGB')
lum = night[..., 0]
al = np.clip((lum - 0.07) / 0.28, 0, 1) ** 0.9
hot = np.clip((lum - 0.3) / 0.3, 0, 1)[..., None]
col = np.array([1.0, 0.78, 0.42]) * (1 - hot) + np.array([1.0, 0.95, 0.8]) * hot
Image.fromarray((np.dstack([col, al]) * 255).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(0.5)).save(os.path.join(OUT_A, 'world-night.webp'), quality=80)
# 구름 그림은 팔레트+투명: 알파 × 밝기 = 구름 두께. 얇은 구름은 버리고 부드럽게
cl = crop(sys.argv[3], 'RGBA')
thick = cl[..., 3] * cl[..., :3].mean(axis=2)
ca = np.asarray(Image.fromarray((np.clip((thick - 0.3) / 0.6, 0, 1) ** 1.3 * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
Image.fromarray((np.dstack([np.ones_like(ca), np.ones_like(ca), np.ones_like(ca), ca]) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT_A, 'world-clouds.webp'), quality=70)
print('night·clouds 완료', flush=True)
