# 대한민국 10개 도시의 도시 화면 칸(실제 행정구역 모양)을 만든다.
# 자료: southkorea/southkorea-maps kostat 2013 시군구(skorea_municipalities_geo_simple.json), 시도(skorea_provinces_geo_simple.json)
# 사용: python3 scripts/gen_kr_cities.py muni.json prov.json src/data/krCityShapes.ts
import json, math, sys
from shapely.geometry import shape, Point
from shapely.ops import unary_union

muni = json.load(open(sys.argv[1]))
prov = json.load(open(sys.argv[2]))
land = unary_union([shape(f['geometry']).buffer(0) for f in prov['features']])

# 도시: (id, 칸 수, 시군구 고르기, 도심 [경도,위도])
CITIES = [
    ('kr-0', 397, lambda c, n: c.startswith('11'), (126.978, 37.5665)),
    ('kr-1', 271, lambda c, n: c.startswith('21'), (129.075, 35.18)),
    ('kr-2', 271, lambda c, n: c.startswith('22'), (128.601, 35.871)),
    ('kr-3', 271, lambda c, n: c.startswith('24'), (126.851, 35.160)),
    ('kr-4', 271, lambda c, n: c.startswith('25'), (127.385, 36.350)),
    ('kr-5', 169, lambda c, n: c in ('35011', '35012'), (127.148, 35.824)),
    ('kr-6', 169, lambda c, n: c == '32030', (128.876, 37.752)),
    ('kr-7', 169, lambda c, n: c in ('39010', '39020'), (126.531, 33.4996)),
    ('kr-8', 169, lambda c, n: c == '36020', (127.662, 34.760)),
    ('kr-9', 169, lambda c, n: c == '36030', (127.487, 34.950)),
]
SQ3 = math.sqrt(3)

def short(n):
    # "전주시완산구" → "완산구", "서귀포시" 그대로
    for p in ('전주시',):
        if n.startswith(p) and len(n) > len(p): return n[len(p):]
    return n

out = {}
for cid, target, pick, center in CITIES:
    feats = [f for f in muni['features'] if pick(f['properties']['code'], f['properties']['name'])]
    lat0 = center[1]
    cs = math.cos(math.radians(lat0))
    P = lambda lon, lat: (lon * cs, -lat)
    def proj_geom(g):
        from shapely.ops import transform
        return transform(lambda x, y, z=None: (x * cs, -y), g)
    gus = [(short(f['properties']['name']), proj_geom(shape(f['geometry']).buffer(0))) for f in feats]
    city = unary_union([g for _, g in gus])
    pland = proj_geom(land)
    cx, cy = P(*center)
    x0, y0, x1, y1 = city.bounds
    def cells(h):
        res = []
        rmin = int((y0 - cy) / (1.5 * h)) - 2
        rmax = int((y1 - cy) / (1.5 * h)) + 2
        for r in range(rmin, rmax + 1):
            qmin = int((x0 - cx) / (SQ3 * h) - r / 2) - 2
            qmax = int((x1 - cx) / (SQ3 * h) - r / 2) + 2
            for q in range(qmin, qmax + 1):
                x = cx + SQ3 * h * (q + r / 2)
                y = cy + 1.5 * h * r
                if city.contains(Point(x, y)): res.append((q, r, x, y))
        return res
    lo, hi = 1e-4, 1.0
    for _ in range(40):
        mid = math.sqrt(lo * hi)
        n = len(cells(mid))
        if n > target: lo = mid
        else: hi = mid
    h = hi
    tl = cells(h)
    # 가장 가까운 개수로(모자라면 lo 쪽)
    tl2 = cells(lo)
    if abs(len(tl2) - target) < abs(len(tl) - target): h, tl = lo, tl2
    # 도심 칸(0,0)이 꼭 들어가게
    if not any(q == 0 and r == 0 for q, r, _, _ in tl): tl.append((0, 0, cx, cy))
    have = {(q, r) for q, r, _, _ in tl}
    rows = []
    for q, r, x, y in tl:
        g = 0
        pt = Point(x, y)
        best = 1e9
        for i, (_, gg) in enumerate(gus):
            d = gg.distance(pt)
            if d < best: best, g = d, i
        rows.append(f'{q},{r},{g}')
    # 바깥 둘레(4칸) 가운데 땅인 칸: 이웃 땅(들판)으로 그림. 나머지는 바다
    D = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)]
    ring = set(have)
    for _ in range(4):
        nx = set()
        for (q, r) in ring:
            for dq, dr in D: nx.add((q + dq, r + dr))
        ring |= nx
    outland = []
    for (q, r) in sorted(ring - have):
        x = cx + SQ3 * h * (q + r / 2)
        y = cy + 1.5 * h * r
        if pland.contains(Point(x, y)): outland.append(f'{q},{r}')
    out[cid] = {
        'k': round(h, 7), 'cs': round(cs, 6), 'c': center,
        'gu': [n for n, _ in gus], 't': ';'.join(rows), 'o': ';'.join(outland),
    }
    print(cid, len(tl), 'hex', round(h, 5), 'gu', len(gus), 'out-land', len(outland))

ts = '// 대한민국 10개 도시 화면 칸: 실제 행정구역(통계청 2013 시군구, southkorea/southkorea-maps) 모양. scripts/gen_kr_cities.py로 만듦.\n'
ts += '// k = 칸 크기(경도·위도 단위), cs = cos(위도), c = 도심 [경도,위도], gu = 구·군 이름, t = "q,r,구번호;…", o = 도시 밖 둘레 땅 칸 "q,r;…"(나머지는 바다)\n'
ts += 'export const KR_CITY_SHAPES: Record<string, { k: number; cs: number; c: [number, number]; gu: string[]; t: string; o: string }> = ' + json.dumps(out, ensure_ascii=False) + ';\n'
open(sys.argv[3], 'w').write(ts)
print(len(ts))
