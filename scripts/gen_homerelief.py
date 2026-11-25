"""본부 지도 바다 깊이 색·해 방향 산 그림자 만들기(11/25 대장 요청 K4·K5).

자료: Mapzen Terrarium 높이 타일(AWS Open Data, 땅 높이 + 바다 깊이)
      https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
입력: python3 scripts/gen_homerelief.py <homeviews.json> [나라 id ...]
출력(public/home-sat/):
  - <id>-depth.webp : 바다 깊이 색(얕은 청록 → 깊은 남색). 땅 위는 아무 색(위성 사진이 덮음)
  - <id>-sh-am.webp / -sh-noon.webp / -sh-pm.webp : 아침(동쪽 해)·한낮·저녁(서쪽 해) 산 그림자(검정, 알파)
  - <id>-relief.json : 그림 범위
"""
import io, json, math, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/home-sat')
os.makedirs(OUT, exist_ok=True)
CACHE = '/tmp/terrarium'
os.makedirs(CACHE, exist_ok=True)
MAX_SIDE = 1400


def tile(z, x, y):
    x %= 2**z
    p = os.path.join(CACHE, f'{z}-{x}-{y}.png')
    if not os.path.exists(p):
        for k in range(4):
            try:
                d = urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', timeout=30).read()
                open(p, 'wb').write(d)
                break
            except Exception:
                if k == 3:
                    return np.zeros((256, 256), np.float32)
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


def merc_y(lat, z):
    lat = np.clip(lat, -85.05, 85.05)
    r = np.radians(lat)
    return (1 - np.log(np.tan(r) + 1 / np.cos(r)) / math.pi) / 2 * 2**z * 256


def elevation(lon0, lat0, lon1, lat1, w, h, z):
    lons = np.linspace(lon0, lon1, w)
    lats = np.linspace(lat1, lat0, h)
    px = (((lons + 180) % 360) / 360) * 2**z * 256
    py = merc_y(lats, z)
    tx0, tx1 = int(px.min() // 256), int(px.max() // 256)
    ty0, ty1 = int(py.min() // 256), int(py.max() // 256)
    # 경도가 한 바퀴 넘으면(px가 줄어듦) 타일을 따로 셈
    xs = sorted(set(int(v // 256) for v in px))
    need = [(x, y) for x in xs for y in range(ty0, ty1 + 1)]
    with ThreadPoolExecutor(16) as ex:
        got = dict(zip(need, ex.map(lambda t: tile(z, t[0], t[1]), need)))
    out = np.zeros((h, w), np.float32)
    xi = (px // 256).astype(int)
    yi = (py // 256).astype(int)
    fx = np.clip(px - xi * 256, 0, 255).astype(int)
    fy = np.clip(py - yi * 256, 0, 255).astype(int)
    for ty in range(ty0, ty1 + 1):
        rows = np.where(yi == ty)[0]
        if not len(rows):
            continue
        for tx in xs:
            cols = np.where(xi == tx)[0]
            if not len(cols):
                continue
            t = got[(tx, ty)]
            out[np.ix_(rows, cols)] = t[np.ix_(fy[rows], fx[cols])]
    return out


def shade(el, ppd, lat_mid, az_deg, alt_deg, exag):
    # 1칸 = 1/ppd 도. 미터로 바꿔 기울기
    dx = 111320 * math.cos(math.radians(lat_mid)) / ppd
    dy = 111320 / ppd
    e = np.maximum(el, 0) * exag
    gy, gx = np.gradient(e, dy, dx)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = math.radians(az_deg), math.radians(alt_deg)
    s = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    flat = math.sin(alt)
    dark = np.clip((flat - s) / max(flat, 0.2), 0, 1)
    return dark


def depth_color(el):
    d = np.clip(-el, 0, 6000)
    # 깊이(m) → 색: 0 얕은 청록, 50 맑은 청록, 200 푸른 바다, 1000 짙은 남색, 4000 아주 짙은 남색
    stops = [(0, (72, 178, 182)), (12, (46, 140, 166)), (35, (32, 110, 154)), (80, (25, 90, 142)), (250, (20, 72, 126)), (1200, (14, 52, 102)), (3500, (9, 36, 78)), (6000, (7, 28, 62))]
    ds = np.array([s[0] for s in stops], np.float32)
    rgb = np.zeros(el.shape + (3,), np.float32)
    for c in range(3):
        rgb[..., c] = np.interp(d, ds, [s[1][c] for s in stops])
    return rgb


def build(cid):
    lon0, lat0, lon1, lat1, ppd = views[cid]
    lat0, lat1 = max(lat0, -60), min(lat1, 84)
    span = max(lon1 - lon0, lat1 - lat0)
    p = min(ppd * 2.2, MAX_SIDE / span)
    w, h = max(64, int((lon1 - lon0) * p)), max(64, int((lat1 - lat0) * p))
    lat_mid = (lat0 + lat1) / 2
    # 타일 줌: 1도당 칸이 p 이상
    z = int(min(10, max(2, math.ceil(math.log2(max(1.0, p * math.cos(math.radians(lat_mid)) * 360 / 256))))))
    el = elevation(lon0, lat0, lon1, lat1, w, h, z)
    # 바다 깊이 색(살짝 흐리게)
    rgb = depth_color(el)
    Image.fromarray(rgb.astype(np.uint8), 'RGB').filter(ImageFilter.GaussianBlur(1.2)).save(os.path.join(OUT, f'{cid}-depth.webp'), quality=80)
    # 산 그림자 3장(큰 나라는 산이 작게 보여 과장을 키움)
    exag = 1.6 if ppd > 40 else 3 if ppd > 12 else 5
    for name, az, alt in (('am', 100, 22), ('noon', 180, 50), ('pm', 260, 22)):
        dk = shade(el, p, lat_mid, az, alt, exag)
        a = np.clip(dk ** 0.9, 0, 1) * (el > 1)
        img = np.zeros((h, w, 4), np.uint8)
        img[..., 0:3] = (12, 18, 30)
        img[..., 3] = (a * 255).astype(np.uint8)
        # 그림자는 부드러워서 절반 크기로 충분(용량 ↓)
        Image.fromarray(img, 'RGBA').filter(ImageFilter.GaussianBlur(0.8)).resize((w // 2, h // 2), Image.LANCZOS).save(os.path.join(OUT, f'{cid}-sh-{name}.webp'), quality=70)
    json.dump({'b': [round(lon0, 4), round(lat0, 4), round(lon1, 4), round(lat1, 4)]}, open(os.path.join(OUT, f'{cid}-relief.json'), 'w'))
    print(cid, f'{w}x{h} z{z}', flush=True)


if __name__ == '__main__':
    views = json.load(open(sys.argv[1]))
    for cid in sys.argv[2:] or list(views):
        build(cid)
