"""지도 위 전투(메인 전투) 실제 위성 바탕·실제 땅 모양 만들기(11/25 대장 결정 ③).

도시마다 실제 경도·위도를 가운데로 약 41km × 41km 를 잘라
  - public/field-sat/<도시 id>.webp : 위성 사진(땅 = ESA WorldCover 2021 Sentinel-2 합성 10m, CC BY 4.0 / 바다 = Mapzen Terrarium 수심 색)
  - src/data/fieldReal.json         : 전투 육각 169칸의 실제 땅 모양(ESA WorldCover 땅 덮개 + Terrarium 높이)
를 만든다. 게임은 이 둘이 있으면 예전 육각 세계지도 땅 대신 이것을 쓴다(battle/field.ts buildField).

입력: python3 scripts/gen_fieldsat.py <fieldcities.json> [도시 id ...]
  fieldcities.json: OUT=... npx vitest run --config sim/vitest.config.ts sim/fieldcities.test.ts
칸 기호: p 평지 · f 숲 · m 산 · c 시가지 · d 도심 · s 바다 · t 해협
"""
import json, math, os, sys, time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '4')
os.environ.setdefault('GDAL_HTTP_RETRY_DELAY', '1')
import rasterio  # noqa: E402
from rasterio.windows import from_bounds  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_homerelief as R  # noqa: E402
from gen_homesat import tone  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_P = os.path.join(ROOT, 'public/field-sat')
OUT_J = os.path.join(ROOT, 'src/data/fieldReal.json')
os.makedirs(OUT_P, exist_ok=True)

# 전투 화면 육각(battle/field.ts 와 같아야 함)
FIELD_HEX = 14
FIELD_R = 7
SQ3 = math.sqrt(3)
HEX_KM = 2.5  # 이웃 칸 가운데 사이 거리(km)
KM_PER_UNIT = HEX_KM / (FIELD_HEX * SQ3)
HALF = 200  # 그림 범위: 가운데에서 ±200 화면 단위
PX = 1024


def cells():
    """(dq, dr) 순서: dr -R..R, dq 작은 것부터 (field.ts REAL_ORDER 와 같음)"""
    out = []
    for dr in range(-FIELD_R, FIELD_R + 1):
        for dq in range(max(-FIELD_R, -dr - FIELD_R), min(FIELD_R, -dr + FIELD_R) + 1):
            out.append((dq, dr))
    return out


CELLS = cells()


def tname(la, lo, step):
    return f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}"


def open_retry(u):
    err = None
    for k in range(4):
        try:
            return rasterio.open(u)
        except Exception as e:  # 없는 타일(바다)도 여기로 옴
            err = e
            if 'Not Found' in str(e) or '404' in str(e) or 'does not exist' in str(e):
                return None
            time.sleep(1 + k)
    print('  열기 실패', u[-40:], str(err)[:60])
    return None


def mosaic(lon0, lat0, lon1, lat1, w, h, kind):
    """kind 's2': 4밴드 반사율, 'map': 땅 덮개 분류. 1도(s2)·3도(map) 타일을 이어 붙임"""
    step = 1 if kind == 's2' else 3
    bands = 4 if kind == 's2' else 1
    out = np.zeros((bands, h, w), np.uint16 if kind == 's2' else np.uint8)
    have = np.zeros((h, w), bool)
    ppd_x = w / (lon1 - lon0)
    ppd_y = h / (lat1 - lat0)
    for la in range(int(math.floor(lat0 / step)) * step, int(math.floor(lat1 / step)) * step + 1, step):
        for lo in range(int(math.floor(lon0 / step)) * step, int(math.floor(lon1 / step)) * step + 1, step):
            a0, a1 = max(lon0, lo), min(lon1, lo + step)
            b0, b1 = max(lat0, la), min(lat1, la + step)
            if a1 <= a0 or b1 <= b0:
                continue
            lw = ((lo + 180) % 360) - 180
            name = tname(la, lw, step)
            if kind == 's2':
                u = f'/vsicurl/https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/{name[:3]}/ESA_WorldCover_10m_2021_v200_{name}_S2RGBNIR.tif'
            else:
                u = f'/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{name}_Map.tif'
            c0 = int(round((a0 - lon0) * ppd_x))
            c1 = int(round((a1 - lon0) * ppd_x))
            r0 = int(round((lat1 - b1) * ppd_y))
            r1 = int(round((lat1 - b0) * ppd_y))
            if c1 <= c0 or r1 <= r0:
                continue
            d = open_retry(u)
            if d is None:
                continue
            with d:
                win = from_bounds(a0 - lo + lw, b0, a1 - lo + lw, b1, d.transform)
                rs = rasterio.enums.Resampling.average if kind == 's2' else rasterio.enums.Resampling.mode
                a = d.read(out_shape=(bands, r1 - r0, c1 - c0), window=win, resampling=rs)
            out[:, r0:r1, c0:c1] = a
            have[r0:r1, c0:c1] = True
    return out, have


def build(c):
    lon, lat = c['ll']
    km = HALF * KM_PER_UNIT
    dlon = km / (111.32 * math.cos(math.radians(lat)))
    dlat = km / 110.57
    lon0, lon1, lat0, lat1 = lon - dlon, lon + dlon, lat - dlat, lat + dlat
    s2, s2have = mosaic(lon0, lat0, lon1, lat1, PX, PX, 's2')
    lc, lchave = mosaic(lon0, lat0, lon1, lat1, PX, PX, 'map')
    el = R.elevation(lon0, lat0, lon1, lat1, 256, 256, 10)
    el_big = np.asarray(Image.fromarray(el).resize((PX, PX), Image.BILINEAR))
    cls = lc[0].astype(np.int32)
    cls[~lchave] = 80  # 타일이 없으면 바다
    # 사진: 땅은 위성, 사진이 없거나 바다(분류 80이고 높이 0 아래)는 수심 색
    rgb = tone(s2) * 255
    sea_col = R.depth_color(np.minimum(el_big, -1))
    valid = s2have & (s2.max(axis=0) > 0)
    deep = (cls == 80) & (el_big < -5)
    use_sea = (~valid) | deep
    # 바다와 사진 사이를 부드럽게
    from scipy import ndimage

    k = ndimage.gaussian_filter(use_sea.astype(np.float32), 2.0)[..., None]
    img = rgb * (1 - k) + sea_col * k
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(OUT_P, f"{c['id']}.webp"), quality=68, method=6)

    # 육각 칸 땅 모양
    yy, xx = np.mgrid[0:PX, 0:PX]
    ux = (xx + 0.5) / PX * 2 * HALF - HALF  # 화면 단위
    uy = (yy + 0.5) / PX * 2 * HALF - HALF
    eh = np.asarray(Image.fromarray(el).resize((PX, PX), Image.BILINEAR))
    codes = []
    for dq, dr in CELLS:
        cx = FIELD_HEX * SQ3 * (dq + dr / 2)
        cy = FIELD_HEX * 1.5 * dr
        x0 = int((cx - 12 + HALF) / (2 * HALF) * PX)
        x1 = int((cx + 12 + HALF) / (2 * HALF) * PX)
        y0 = int((cy - 12 + HALF) / (2 * HALF) * PX)
        y1 = int((cy + 12 + HALF) / (2 * HALF) * PX)
        sub = (ux[y0:y1, x0:x1] - cx) ** 2 + (uy[y0:y1, x0:x1] - cy) ** 2 < 12**2
        cc = cls[y0:y1, x0:x1][sub]
        ee = eh[y0:y1, x0:x1][sub]
        n = max(1, cc.size)
        water = np.isin(cc, [80]).sum() / n
        built = (cc == 50).sum() / n
        tree = np.isin(cc, [10, 95]).sum() / n
        if dq == 0 and dr == 0:
            codes.append('d')
        elif water >= 0.55:
            codes.append('s')
        elif built >= 0.42:
            codes.append('c')
        elif ee.std() > 70 or (ee.mean() > 900 and ee.std() > 35):
            codes.append('m')
        elif tree >= 0.5:
            codes.append('f')
        else:
            codes.append('p')
    return ''.join(codes)


def main():
    cities = json.load(open(sys.argv[1]))
    only = set(sys.argv[2:])
    if only:
        cities = [c for c in cities if c['id'] in only]
    old = json.load(open(OUT_J)) if os.path.exists(OUT_J) else {'hexKm': HEX_KM, 'half': HALF, 'cities': {}}
    t = time.time()
    with ThreadPoolExecutor(6) as ex:
        for c, codes in zip(cities, ex.map(build, cities)):
            old['cities'][c['id']] = codes
            print(c['id'], c['name'], codes.count('s'), '바다', codes.count('c'), '시가지', codes.count('m'), '산', f'{time.time() - t:.0f}s', flush=True)
    old['hexKm'] = HEX_KM
    old['half'] = HALF
    old['cities'] = dict(sorted(old['cities'].items()))
    json.dump(old, open(OUT_J, 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
