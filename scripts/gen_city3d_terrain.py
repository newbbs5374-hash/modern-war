"""도시 3D 높낮이 자료(11/27 도시 4). 한국 13곳 먼저.
AWS Terrain Tiles(terrarium, Mapzen · 공개 자료)에서 도시 중심 둘레 ±HALF m 의 높이를 N×N 칸으로 뽑아
public/city3d/<파일>-h.json 으로 저장: {half, n, base, h:[N*N, 북서쪽부터 동쪽으로 한 줄씩, 바닥(base)보다 높은 m]}
쓰는 법: python3 scripts/gen_city3d_terrain.py
"""
import io, json, math, os, sys, urllib.request
import numpy as np
from PIL import Image

Z = 11
N = 96
HALF = 12000
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'city3d')
KR = ['seoul', 'busan', 'daegu', 'gwangju', 'daejeon', 'jeonju', 'gangneung', 'jeju', 'yeosu', 'suncheon', 'iksan', 'incheon', 'ulsan']
_cache = {}

def tile(x, y):
    k = (x, y)
    if k not in _cache:
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
        with urllib.request.urlopen(url, timeout=30) as r:
            a = np.asarray(Image.open(io.BytesIO(r.read())).convert('RGB'), dtype=np.float64)
        _cache[k] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
    return _cache[k]

def elev(lon, lat):
    n = 2 ** Z
    fx = (lon + 180) / 360 * n
    fy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    t = tile(int(fx), int(fy))
    return t[min(255, int((fy % 1) * 256)), min(255, int((fx % 1) * 256))]

def run(file):
    d = json.load(open(os.path.join(ROOT, file + '.json')))
    lon0, lat0 = d['center']
    mlat = 111320.0
    mlon = 111320.0 * math.cos(math.radians(lat0))
    g = np.zeros((N, N))
    for j in range(N):
        for i in range(N):
            x = -HALF + 2 * HALF * i / (N - 1)
            y = HALF - 2 * HALF * j / (N - 1)
            g[j, i] = max(0.0, elev(lon0 + x / mlon, lat0 + y / mlat))
    # 바닥 = 건물 있는 곳 높이의 아래쪽 값
    xs, ys = [], []
    for b in d['b'][::25]:
        xs.append(b[2]); ys.append(b[3])
    hs = sorted(max(0.0, elev(lon0 + x / mlon, lat0 + y / mlat)) for x, y in zip(xs, ys))
    base = hs[len(hs) // 5] if hs else 0.0
    rel = np.maximum(0, g - base).round().astype(int)
    out = {'half': HALF, 'n': N, 'base': round(base), 'h': rel.flatten().tolist(), 'credit': 'Terrain Tiles (Mapzen, AWS Open Data)'}
    json.dump(out, open(os.path.join(ROOT, file + '-h.json'), 'w'), separators=(',', ':'))
    print(file, 'base', round(base), 'max', int(rel.max()))

for f in (sys.argv[1:] or KR):
    _cache.clear()
    run(f)
