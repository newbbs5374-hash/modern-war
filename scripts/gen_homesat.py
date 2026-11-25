"""본부 지도 실제 위성 바탕 만들기(11/25 대장 요청 K1·K2·K3).

자료: ESA WorldCover 2021 Sentinel-2 구름 없는 합성 사진(10m, CC BY 4.0)
      https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/...
      (1도×1도 COG, 안의 작은 그림(overview)만 HTTP로 읽음)
입력: python3 scripts/gen_homesat.py <homeviews.json> <s2tiles.json> [나라 id ...]
  - homeviews.json: sim/homeview.test.ts 가 만든 나라별 본부 지도 범위와 1도당 칸 수
  - s2tiles.json : 있는 타일 이름 목록(N37E126 …)
출력(public/home-sat/, 필요할 때만 내려받음):
  - <id>-0.webp        : 나라 전체 한 장(확대 1배용). 바다는 투명
  - <id>/1-<x>-<y>.webp: 확대용 고해상 조각(512칸). 빈 조각(전부 바다)은 만들지 않음
  - <id>.json          : 범위·조각 목록 + 정밀 해안선(세계 좌표 1도=6)
"""
import json, math, os, sys, time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from skimage import measure

os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '4')
os.environ.setdefault('GDAL_HTTP_RETRY_DELAY', '1')
import rasterio  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/home-sat')
L0, B1, PX = -15, 80, 6
TILE = 512
MAX_SIDE1 = 4096  # 확대용 전체 크기 상한
MAX_SIDE0 = 1400  # 1배용 한 장 상한



def tname(la, lo):
    return f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}"


def read_tile(args):
    la, lo, n = args
    name = tname(la, lo)
    u = f'/vsicurl/https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/{name[:3]}/ESA_WorldCover_10m_2021_v200_{name}_S2RGBNIR.tif'
    for k in range(4):
        try:
            with rasterio.open(u) as d:
                return d.read(out_shape=(4, n, n), resampling=rasterio.enums.Resampling.average)
        except Exception as e:  # 네트워크 끊김: 다시
            err = e
            time.sleep(1 + k)
    print('  읽기 실패', name, str(err)[:60])
    return None


def tone(a):
    """반사율(0~10000) → 화면 색. 게임의 반실사 느낌에 맞춰 조금 밝고 진하게"""
    rgb = a[:3].transpose(1, 2, 0).astype(np.float32) / 10000.0
    rgb = np.clip(rgb / 0.22, 0, 1) ** (1 / 1.7)
    # 채도 조금 올림
    g = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(g + (rgb - g) * 1.25, 0, 1)
    return rgb


def wx(lon):
    return ((lon if lon >= L0 else lon + 360) - L0) * PX


def coast_path(alpha, lon0, lat1, ppd, tol_deg, min_area_px):
    """땅 가리개 → 해안선(세계 좌표 path)"""
    a = ndimage.gaussian_filter(alpha.astype(np.float32), 1.0)
    a = np.pad(a, 1)
    out = []
    for c in measure.find_contours(a, 0.5):
        if len(c) < 8:
            continue
        ys, xs = c[:, 0] - 1, c[:, 1] - 1
        area = 0.5 * abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1)))
        if area < min_area_px:
            continue
        poly = measure.approximate_polygon(np.stack([xs, ys], 1), tolerance=tol_deg * ppd)
        if len(poly) < 4:
            continue
        pts = [(wx(lon0 + x / ppd), (B1 - (lat1 - y / ppd)) * PX) for x, y in poly]
        out.append('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + 'Z')
    return ''.join(out)


def build(cid):
    lon0, lat0, lon1, lat1, ppd = views[cid]
    lat0, lat1 = max(lat0, -56), min(lat1, 83.5)
    # 확대용 해상도(1도당 칸): 화면 1배의 6배, 상한 MAX_SIDE1
    span = max(lon1 - lon0, lat1 - lat0)
    p1 = int(min(ppd * 6, 750, MAX_SIDE1 / span))
    p0 = min(ppd * 2.2, MAX_SIDE0 / span)
    gl0, gl1 = math.floor(lon0), math.ceil(lon1)
    ga0, ga1 = math.floor(lat0), math.ceil(lat1)
    gw, gh = (gl1 - gl0) * p1, (ga1 - ga0) * p1
    mos = np.zeros((4, gh, gw), np.uint16)
    jobs = []
    for la in range(ga0, ga1):
        for lo in range(gl0, gl1):
            lw = ((lo + 180) % 360) - 180
            if tname(la, lw) in have:
                jobs.append((la, lw, p1, lo))
    t = time.time()
    print(cid, f'타일 {len(jobs)}개, 1도={p1}칸, 바탕 {gw}x{gh}', flush=True)
    with ThreadPoolExecutor(24) as ex:
        for (la, lw, n, lo), a in zip(jobs, ex.map(read_tile, [(la, lw, n) for la, lw, n, _ in jobs])):
            if a is None:
                continue
            x = (lo - gl0) * p1
            y = (ga1 - 1 - la) * p1
            mos[:, y : y + p1, x : x + p1] = a
    print(cid, f'읽기 {time.time() - t:.0f}초', flush=True)
    # 정확한 범위로 자르기(소수 칸은 버림)
    cx0 = int(round((lon0 - gl0) * p1))
    cy0 = int(round((ga1 - lat1) * p1))
    W1 = int(round((lon1 - lon0) * p1))
    H1 = int(round((lat1 - lat0) * p1))
    mos = mos[:, cy0 : cy0 + H1, cx0 : cx0 + W1]
    rgb = tone(mos)
    G = mos[1].astype(np.float32)
    N = mos[3].astype(np.float32)
    nodata = mos[:3].sum(axis=0) == 0
    ndwi = (G - N) / np.maximum(G + N, 1)
    water = ((ndwi > 0.02) & (G < 1800)) | nodata
    # 바다 = 큰 물(전체의 0.2% 넘거나 가장자리에 닿음). 작은 호수·강은 위성 그대로
    lab, nlab = ndimage.label(water)
    if nlab:
        sizes = ndimage.sum(water, lab, range(1, nlab + 1))
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        big = np.array([0] + [1 if (sizes[i - 1] > water.size * 0.002 or i in edge) else 0 for i in range(1, nlab + 1)], bool)
        sea = big[lab]
    else:
        sea = water
    land = ~sea
    # 작은 구멍·잡티 정리
    land = ndimage.binary_opening(land, iterations=1)
    land = ndimage.binary_fill_holes(land) | (land & ~water)
    alpha = ndimage.gaussian_filter(land.astype(np.float32), 0.8)
    img = np.dstack([rgb, alpha])
    img8 = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    full = Image.fromarray(img8, 'RGBA')
    os.makedirs(os.path.join(OUT, cid), exist_ok=True)
    for f in os.listdir(os.path.join(OUT, cid)):
        os.remove(os.path.join(OUT, cid, f))
    # 1배용 한 장
    W0, H0 = max(64, int((lon1 - lon0) * p0)), max(64, int((lat1 - lat0) * p0))
    full.resize((W0, H0), Image.LANCZOS).save(os.path.join(OUT, f'{cid}-0.webp'), quality=78, method=6)
    # 확대용 조각
    tiles = []
    for ty in range(0, H1, TILE):
        for tx in range(0, W1, TILE):
            a = img8[ty : ty + TILE, tx : tx + TILE]
            if a[..., 3].max() < 8:
                continue
            Image.fromarray(a, 'RGBA').save(os.path.join(OUT, cid, f'1-{tx // TILE}-{ty // TILE}.webp'), quality=74, method=6)
            tiles.append([tx // TILE, ty // TILE])
    # 해안선: 1배 화면 0.25칸 정도로 단순화
    tol = 0.25 / ppd
    coast = coast_path(land, lon0, lat1, p1, tol, min_area_px=(p1 / ppd) ** 2 * 1.5)
    meta = {
        'b': [round(lon0, 4), round(lat0, 4), round(lon1, 4), round(lat1, 4)],
        'w1': W1,
        'h1': H1,
        'tile': TILE,
        'tiles': tiles,
        'coast': coast,
    }
    json.dump(meta, open(os.path.join(OUT, f'{cid}.json'), 'w'), separators=(',', ':'))
    print(cid, f'완료 1배 {W0}x{H0}, 조각 {len(tiles)}개, 해안선 {len(coast) // 1000}KB, {time.time() - t:.0f}초', flush=True)


if __name__ == '__main__':
    views = json.load(open(sys.argv[1]))
    have = set(json.load(open(sys.argv[2])))
    for cid in sys.argv[3:] or list(views):
        build(cid)
