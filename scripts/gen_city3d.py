"""서울 3D 시험용 실제 건물 자료 만들기 (OpenStreetMap, ODbL).
Overpass에서 건물·큰길·물·공원을 받아 작은 JSON(public/city3d/seoul.json)으로 줄임.
좌표는 서울시청(126.978, 37.5665) 기준 미터(동 +x, 북 +y), 정수.
실행: GitHub Actions(.github/workflows/city3d-data.yml)가 Geofabrik 한국 파일을 받아 osmium으로 자른 뒤
     python scripts/gen_city3d.py seoul.geojsonseq
"""
import json, math, os, sys, time, urllib.parse, urllib.request

C_LON, C_LAT = 126.978, 37.5665
BBOX = (37.49, 126.90, 37.60, 127.08)  # 남, 서, 북, 동
NX, NY = 5, 4
MAX_B = 16000
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


def main():
    # 입력: osmium export -f geojsonseq 결과(작업 흐름이 Geofabrik 한국 파일에서 잘라 만듦)
    src = sys.argv[1] if len(sys.argv) > 1 else 'seoul.geojsonseq'
    blds, roads, water, parks = [], [], [], []
    with open(src, encoding='utf-8') as f:
        for line in f:
            line = line.strip().lstrip('\x1e')
            if not line:
                continue
            ft = json.loads(line)
            t = ft.get('properties') or {}
            g = ft.get('geometry') or {}
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
        'name': '서울',
        'center': [C_LON, C_LAT],
        'credit': '© OpenStreetMap contributors (ODbL)',
        'b': [[round(h), k] + rd(r) for (r, h, k, a) in items],
        'r': [[w] + rd(p) for (p, w) in roads if len(p) >= 2],
        'w': [rd(r) for r in water],
        'p': [rd(r) for r in parks],
    }
    os.makedirs('public/city3d', exist_ok=True)
    with open('public/city3d/seoul.json', 'w') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    print('buildings', len(blds), '->', len(out['b']), 'roads', len(out['r']), 'water', len(out['w']), 'parks', len(out['p']), file=sys.stderr)


main()
