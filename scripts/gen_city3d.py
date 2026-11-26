"""서울 3D 시험용 실제 건물 자료 만들기 (OpenStreetMap, ODbL).
Overpass에서 건물·큰길·물·공원을 받아 작은 JSON(public/city3d/seoul.json)으로 줄임.
좌표는 서울시청(126.978, 37.5665) 기준 미터(동 +x, 북 +y), 정수.
실행: GitHub Actions(.github/workflows/city3d-data.yml)가 Geofabrik 한국 파일을 받아 osmium으로 자른 뒤
     python scripts/gen_city3d.py seoul.geojsonseq
"""
import json, math, os, sys, time, urllib.parse, urllib.request

C_LON, C_LAT = 126.978, 37.5665
MAX_B = 16000
OUT = 'seoul'
NAME = '서울'
# 다른 도시: python scripts/gen_city3d.py <geojsonseq> <파일이름> <경도> <위도> <최대 건물 수> <이름>
HALF = 0  # 자른 범위 반쪽(km). 있으면 바다(해안선)를 만듦
if len(sys.argv) > 2:
    OUT, C_LON, C_LAT, MAX_B, NAME = sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
if len(sys.argv) > 7:
    HALF = float(sys.argv[7])
SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
MX = 111320 * math.cos(math.radians(C_LAT))
MY = 110540


def xy(lon, lat):
    return (lon - C_LON) * MX, (lat - C_LAT) * MY


def query(q):
    for k in range(6):
        url = SERVERS[k % len(SERVERS)]
        try:
            data = urllib.parse.urlencode({'data': q}).encode()
            req = urllib.request.Request(url, data=data, headers={'User-Agent': 'modern-war-city3d/1.0'})
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except Exception as e:
            print('retry', k, url, e, file=sys.stderr)
            time.sleep(20)
    raise SystemExit('overpass failed')


def area(p):
    a = 0
    for i in range(len(p)):
        x1, y1 = p[i - 1]
        x2, y2 = p[i]
        a += x1 * y2 - x2 * y1
    return a / 2


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-9
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > best:
            best, bi = d, i
    if best > eps:
        return dp(pts[: bi + 1], eps)[:-1] + dp(pts[bi:], eps)
    return [pts[0], pts[-1]]


def ring(geom, eps=1.5):
    p = [xy(g['lon'], g['lat']) for g in geom]
    if len(p) > 1 and p[0] == p[-1]:
        p = p[:-1]
    if len(p) < 3:
        return None
    # 닫힌 고리 단순화: 두 반쪽으로 나눠 DP
    h = len(p) // 2
    q = dp(p[: h + 1], eps)[:-1] + dp(p[h:] + [p[0]], eps)[:-1]
    if len(q) < 3:
        return None
    if area(q) < 0:
        q.reverse()
    return q


def num(v):
    try:
        return float(str(v).split(';')[0].replace('m', '').strip())
    except Exception:
        return None


def height(t, a):
    h = num(t.get('height'))
    if h and 2 < h < 600:
        return h
    lv = num(t.get('building:levels'))
    if lv and 0 < lv < 130:
        return lv * 3.3 + 1
    b = t.get('building', 'yes')
    if b in ('apartments',):
        return 45
    if b in ('commercial', 'office', 'hotel'):
        return 30 if a > 800 else 18
    if b in ('house', 'detached', 'garage', 'shed', 'hut', 'roof'):
        return 6
    if b in ('industrial', 'warehouse'):
        return 10
    return 12 if a > 400 else 8


def kind(t):
    b = t.get('building', 'yes')
    if b in ('apartments', 'residential', 'house', 'detached', 'dormitory'):
        return 0  # 주거
    if b in ('commercial', 'office', 'retail', 'hotel'):
        return 1  # 상업·사무
    if b in ('industrial', 'warehouse'):
        return 2
    if b in ('school', 'university', 'hospital', 'public', 'government', 'civic', 'church', 'temple'):
        return 3
    return 4


def poly_rings(geom):
    """GeoJSON 도형 → 바깥 고리들(경도·위도 목록)"""
    t = geom['type']
    if t == 'Polygon':
        return [geom['coordinates'][0]]
    if t == 'MultiPolygon':
        return [p[0] for p in geom['coordinates']]
    return []


def sea_polys(coast, half_m):
    """해안선(육지가 왼쪽) 조각들 → 범위 안 바다 다각형(섬은 구멍). shapely 필요."""
    try:
        from shapely.geometry import LineString, box
        from shapely.ops import polygonize, unary_union
    except ImportError:
        print('shapely 없음: 바다 생략', file=sys.stderr)
        return []
    if not coast:
        return []
    B = box(-half_m, -half_m, half_m, half_m)
    lines = [LineString(c) for c in coast if len(c) >= 2]
    cut = [l.intersection(B) for l in lines]
    noded = unary_union([g for g in cut if not g.is_empty] + [B.boundary])
    segs = [(c[i], c[i + 1]) for c in coast for i in range(len(c) - 1)]

    def is_sea(pt):
        px, py = pt.x, pt.y
        best, side = 1e30, 0
        for (ax, ay), (bx, by) in segs:
            dx, dy = bx - ax, by - ay
            L = dx * dx + dy * dy
            t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
            qx, qy = ax + t * dx, ay + t * dy
            d = (px - qx) ** 2 + (py - qy) ** 2
            if d < best:
                best, side = d, dx * (py - ay) - dy * (px - ax)
        return side < 0  # 오른쪽 = 바다

    out = []
    for face in polygonize(noded):
        if face.area < 20000 or not is_sea(face.representative_point()):
            continue
        f = face.simplify(12)
        if f.is_empty or f.geom_type != 'Polygon':
            continue
        rings = [list(f.exterior.coords)[:-1]] + [list(h.coords)[:-1] for h in f.interiors if abs(__import__('shapely').geometry.Polygon(h).area) > 5000]
        out.append([[v for pt in r for v in (round(pt[0]), round(pt[1]))] for r in rings])
    return out


def main():
    # 입력: osmium export -f geojsonseq 결과(작업 흐름이 Geofabrik 한국 파일에서 잘라 만듦)
    src = sys.argv[1] if len(sys.argv) > 1 else 'seoul.geojsonseq'
    blds, roads, water, parks, coast = [], [], [], [], []
    with open(src, encoding='utf-8') as f:
        for line in f:
            line = line.strip().lstrip('\x1e')
            if not line:
                continue
            ft = json.loads(line)
            t = ft.get('properties') or {}
            g = ft.get('geometry') or {}
            if t.get('natural') == 'coastline' and g.get('type') == 'LineString':
                coast.append([xy(c[0], c[1]) for c in g['coordinates']])
                continue
            if 'building' in t and t.get('building') != 'no':
                for rr in poly_rings(g):
                    r = ring([{'lon': c[0], 'lat': c[1]} for c in rr])
                    if not r:
                        continue
                    a = area(r)
                    if a < 60:
                        continue
                    blds.append((r, height(t, a), kind(t), a))
            elif t.get('highway') in ('motorway', 'trunk', 'primary', 'secondary') and g.get('type') == 'LineString':
                p = dp([xy(c[0], c[1]) for c in g['coordinates']], 4)
                roads.append((p, {'motorway': 3, 'trunk': 3, 'primary': 2, 'secondary': 1}[t['highway']]))
            elif t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t.get('water'):
                for rr in poly_rings(g):
                    r = ring([{'lon': c[0], 'lat': c[1]} for c in rr], 6)
                    if r and area(r) > 800:
                        water.append(r)
            elif t.get('leisure') == 'park' or t.get('landuse') in ('grass', 'forest') or t.get('natural') == 'wood':
                for rr in poly_rings(g):
                    r = ring([{'lon': c[0], 'lat': c[1]} for c in rr], 6)
                    if r and area(r) > 3000:
                        parks.append(r)
    items = blds
    # 중요도: 부피 큰 것 먼저, 도심 가까운 작은 것도 조금
    items.sort(key=lambda b: -(b[3] * b[1]) / (1 + math.hypot(*b[0][0]) / 4000))
    items = items[:MAX_B]
    rd = lambda p: [v for pt in p for v in (round(pt[0]), round(pt[1]))]
    out = {
        'name': NAME,
        'center': [C_LON, C_LAT],
        'credit': '© OpenStreetMap contributors (ODbL)',
        'b': [[round(h), k] + rd(r) for (r, h, k, a) in items],
        'r': [[w] + rd(p) for (p, w) in roads if len(p) >= 2],
        'w': [rd(r) for r in water],
        'p': [rd(r) for r in parks],
    }
    if HALF:
        sea = sea_polys(coast, HALF * 1000)
        if sea:
            out['s'] = sea
    os.makedirs('public/city3d', exist_ok=True)
    with open(f'public/city3d/{OUT}.json', 'w') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    print(OUT, 'buildings', len(blds), '->', len(out['b']), 'roads', len(out['r']), 'water', len(out['w']), 'parks', len(out['p']), 'sea', len(out.get('s', [])), file=sys.stderr)


main()
