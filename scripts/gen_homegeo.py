"""본부 지도 실사화 자료 만들기(C2: 밤 불빛·지형 음영·실제 도로·철도·강).

입력(공개 자료, 직접 내려받아 DL 폴더에):
- earth-night.jpg  : NASA Black Marble 야간 사진(three-globe 예제 4096×2048)
- elev_bump_4k.jpg : 지형 높이(webgl-earth 예제, NASA 자료 4096×2048)
- water_4k.png     : 바다 가리개(같은 곳)
- ne_10m_roads / ne_10m_railroads / ne_10m_rivers_lake_centerlines .geojson (Natural Earth)
- homeviews.json   : 나라별 본부 지도 범위(sim/homeview.test.ts가 만듦)
출력:
- src/assets/home/night-<id>.webp, relief-<id>.webp
- src/assets/home/geo-<id>.json 도로·철도·강(세계 좌표 1도=6, 경도 -15~300). 나라마다 필요할 때만 불러옴
"""
import json, math, os, sys
from PIL import Image, ImageFilter
import numpy as np

DL = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_IMG = os.path.join(ROOT, 'src/assets/home')
os.makedirs(OUT_IMG, exist_ok=True)
L0, B1, PX = -15, 80, 6
views = json.load(open(os.path.join(DL, 'homeviews.json')))

night = np.asarray(Image.open(os.path.join(DL, 'earth-night.jpg')).convert('RGB')).astype(np.float32) / 255
elev = np.asarray(Image.open(os.path.join(DL, 'elev_bump_4k.jpg')).convert('L')).astype(np.float32) / 255
water = np.asarray(Image.open(os.path.join(DL, 'water_4k.png')).convert('L')).astype(np.float32) / 255
WN, HN = night.shape[1], night.shape[0]
WE, HE = elev.shape[1], elev.shape[0]

# 지형 음영(북서쪽 빛)
gy, gx = np.gradient(elev * 40.0)
az, alt = math.radians(315), math.radians(40)
slope = np.arctan(np.hypot(gx, gy))
aspect = np.arctan2(-gx, gy)
shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
shade = np.clip(shade, 0, 1)
flat = math.sin(alt)
land = (water < 0.5).astype(np.float32)


def crop(arr, w, h, lon0, lat0, lon1, lat1, ow, oh):
    """정거원통 전 지구 그림에서 경도·위도 범위를 잘라 ow×oh로(경도는 돌아감)"""
    xs = ((np.linspace(lon0, lon1, ow) + 180) % 360) / 360 * w
    ys = (90 - np.linspace(lat1, lat0, oh)) / 180 * h
    xi = np.clip(xs, 0, w - 1.001)
    yi = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(xi).astype(int); y0 = np.floor(yi).astype(int)
    fx = (xi - x0)[None, :]; fy = (yi - y0)[:, None]
    x1 = (x0 + 1) % w; y1 = np.minimum(y0 + 1, h - 1)
    def g(yy, xx):
        return arr[yy[:, None], xx[None, :]]
    if arr.ndim == 3:
        fx = fx[..., None]; fy = fy[..., None]
    return (g(y0, x0) * (1 - fx) + g(y0, x1) * fx) * (1 - fy) + (g(y1, x0) * (1 - fx) + g(y1, x1) * fx) * fy


def wx(lon):
    return ((lon if lon >= L0 else lon + 360) - L0) * PX


BOUNDS = {}
DOTS = {}
for cid, (lon0, lat0, lon1, lat1, ppd) in views.items():
    lat0, lat1 = max(lat0, -60), min(lat1, 85)
    d = min(ppd, 40)
    ow, oh = max(64, int((lon1 - lon0) * d)), max(64, int((lat1 - lat0) * d))
    # 밤: 불빛만 남기고(어두운 바탕 제거) 알파 = 밝기
    n = crop(night, WN, HN, lon0, lat0, lon1, lat1, ow, oh)
    # 불빛은 노란빛(빨강·초록 큼), 푸른 잡티는 버림. 색은 따뜻한 가로등 색으로 고르게
    lum = n[..., 0]  # 바탕(바다·땅)은 빨강이 거의 없음
    a = np.clip((lum - 0.07) / 0.28, 0, 1) ** 0.9
    hot = np.clip((lum - 0.3) / 0.3, 0, 1)[..., None]
    rgb = np.array([1.0, 0.78, 0.42]) * (1 - hot) + np.array([1.0, 0.95, 0.8]) * hot
    img = np.dstack([rgb, a])
    Image.fromarray((img * 255).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(0.6)).save(
        os.path.join(OUT_IMG, f'night-{cid}.webp'), quality=82)
    # 지형 음영: 그림자는 검정, 볕은 흰색, 바다는 투명
    sh = crop(shade, WE, HE, lon0, lat0, lon1, lat1, ow, oh)
    ld = crop(land, WE, HE, lon0, lat0, lon1, lat1, ow, oh)
    dark = np.clip((flat - sh) / flat, 0, 1) * 0.55
    light = np.clip((sh - flat) / (1 - flat), 0, 1) * 0.35
    al = np.maximum(dark, light) * ld
    col = np.where(dark >= light, 0.0, 1.0)
    rel = np.dstack([col, col, col * 0.96, al])
    Image.fromarray((rel * 255).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(0.8)).save(
        os.path.join(OUT_IMG, f'relief-{cid}.webp'), quality=80)
    # 가까이 보는 나라(1도가 25칸 넘음)는 그림을 크게 늘리면 뭉개지므로 불빛을 점으로 찍음(밝기 3단계)
    if ppd >= 25:
        rs = np.random.default_rng(7)
        buckets = ['', '', '']
        cnt = 0
        dens = min(0.9, 7000 / max(1.0, float(a[a >= 0.05].sum())))
        for yy in range(oh):
            for xx in range(ow):
                av = a[yy, xx]
                if av < 0.05:
                    continue
                k = rs.poisson(av * dens)
                for _ in range(k):
                    lon = lon0 + (xx + rs.random()) / ow * (lon1 - lon0)
                    lat = lat1 - (yy + rs.random()) / oh * (lat1 - lat0)
                    b = 0 if av < 0.35 else 1 if av < 0.7 else 2
                    buckets[b] += f'M{wx(lon):.2f},{(B1 - lat) * PX:.2f}h0'
                    cnt += 1
        DOTS[cid] = buckets
        print(cid, 'dots', cnt)
    BOUNDS[cid] = [round(lon0, 3), round(lat0, 3), round(lon1, 3), round(lat1, 3)]
    print(cid, ow, oh)
json.dump(BOUNDS, open(os.path.join(OUT_IMG, 'bounds.json'), 'w'))


# 선 자료


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a
    L = np.hypot(*ab)
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        p = np.array(pts[i])
        dd = abs(ab[0] * (a[1] - p[1]) - ab[1] * (a[0] - p[0])) / L if L else np.hypot(*(p - a))
        if dd > best:
            best, bi = dd, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return dp(pts[: bi + 1], tol)[:-1] + dp(pts[bi:], tol)


def lines(path, keep):
    out = []
    for f in json.load(open(os.path.join(DL, path)))['features']:
        if not keep(f['properties']):
            continue
        g = f['geometry']
        if not g:
            continue
        parts = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for p in parts:
            out.append([(c[0], c[1]) for c in p])
    return out


ROAD = lines('ne_10m_roads.geojson', lambda p: p.get('expressway') == 1 or p.get('type') in ('Major Highway', 'Beltway'))
ROAD2 = lines('ne_10m_roads.geojson', lambda p: p.get('type') == 'Secondary Highway')
RAIL = lines('ne_10m_railroads.geojson', lambda p: p.get('scalerank', 10) <= 8)
RAIL_ALL = lines('ne_10m_railroads.geojson', lambda p: True)
RIVER = lines('ne_10m_rivers_lake_centerlines.geojson', lambda p: True)


def build(segs, lon0, lat0, lon1, lat1, ppd):
    tol = 1.0 / ppd  # 화면 0.7칸
    ds = []
    for s in segs:
        if not any(lon0 <= ((x - lon0) % 360 + lon0) <= lon1 and lat0 <= y <= lat1 for x, y in s):
            continue
        q = dp(s, tol)
        pts = [(wx(x), (B1 - y) * PX) for x, y in q]
        # 경도 360 넘어가는 선 끊김 방지: 큰 점프면 새 선
        d = ''
        prev = None
        for x, y in pts:
            if prev is None or abs(x - prev[0]) > 300:
                d += f'M{x:.1f},{y:.1f}'
            else:
                d += f'L{x:.1f},{y:.1f}'
            prev = (x, y)
        ds.append(d)
    return ''.join(ds)


res = {}
for cid, (lon0, lat0, lon1, lat1, ppd) in views.items():
    # 범위는 화면 그대로(여유 포함)
    lon0w = lon0 + (0 if lon0 >= L0 else 0)
    r = {
        'road': build(ROAD, lon0, lat0, lon1, lat1, ppd),
        'road2': build(ROAD2, lon0, lat0, lon1, lat1, ppd) if ppd >= 25 else '',
        'rail': build(RAIL_ALL if ppd >= 40 else RAIL, lon0, lat0, lon1, lat1, ppd),
        'river': build(RIVER, lon0, lat0, lon1, lat1, ppd),
    }
    r['dots'] = DOTS.get(cid, ['', '', ''])
    res[cid] = r
    print(cid, {k: len(v) for k, v in r.items()})

for cid, r in res.items():
    with open(os.path.join(OUT_IMG, f'geo-{cid}.json'), 'w') as f:
        json.dump(r, f, ensure_ascii=False, separators=(',', ':'))
