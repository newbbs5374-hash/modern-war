"""세계지도 나라 모양(src/data/realGeo.ts) 만들기.

원본: johan/world.geo.json countries.geo.json(공개 자료)
쓰는 법: python3 scripts/gen_realgeo.py countries.geo.json src/data/realGeo.ts
- 투영: 정거원통, 경도 L0~L1(L0보다 서쪽 경도는 +360), 위도 B0~B1, 1도 = PX칸
- GEO_PATH: 게임 나라 id → SVG 경로(소수 1자리), x = 게임 밖 나라(회색)
- GEO_POLYS: 모든 땅 다각형(정수 점 목록, 바다 길 찾기용)
11-27: 남반구·남미까지 넓힘(위도 -56~80, 경도 -15~330). 북쪽 좌표(y = (B1-위도)*PX)는 그대로.
"""
import json, sys
from shapely.geometry import shape, box, Polygon
from shapely.ops import transform

L0, L1, B0, B1, PX = -15, 330, -56, 80, 6
W, H = (L1 - L0) * PX, (B1 - B0) * PX
GAME = {
    'us': 'USA', 'cn': 'CHN', 'ru': 'RUS', 'de': 'DEU', 'jp': 'JPN', 'uk': 'GBR', 'in': 'IND', 'kr': 'KOR', 'tr': 'TUR',
    'il': 'ISR', 'ir': 'IRN', 'ua': 'UKR', 'kp': 'PRK', 'tw': 'TWN', 'pl': 'POL', 'ph': 'PHL', 'pk': 'PAK', 'sa': 'SAU',
}
# 새 나라(게임에 들어온 나라만 넣음: 명령줄 셋째 인자로 쉼표 목록)
NEW = {
    'eg': 'EGY', 'ng': 'NGA', 'za': 'ZAF', 'et': 'ETH', 'dz': 'DZA', 'br': 'BRA', 'ar': 'ARG', 'co': 'COL', 've': 'VEN',
    'cl': 'CHL', 'au': 'AUS', 'ca': 'CAN', 'mx': 'MEX', 'fr': 'FRA', 'it': 'ITA', 'es': 'ESP', 'gr': 'GRC', 'fi': 'FIN',
}
if len(sys.argv) > 3 and sys.argv[3]:
    for k in sys.argv[3].split(','):
        GAME[k] = NEW[k]
A3 = {v: k for k, v in GAME.items()}
FRAME = box(0, 0, W, H)


def proj_ring(ring):
    lons = [p[0] for p in ring]
    # 날짜변경선 건너 동쪽(러시아 추코트카·미국 알래스카 서쪽 끝 등)은 +360
    shift = 360 if max(lons) < L0 else 0
    return [((x + shift - L0) * PX, (B1 - y) * PX) for x, y in ring]


def fmt(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def polys_of(geom):
    if geom['type'] == 'Polygon':
        yield geom['coordinates']
    else:
        yield from geom['coordinates']


feats = json.load(open(sys.argv[1]))['features']
paths = {}
land = []
for f in feats:
    key = A3.get(f['id'], 'x')
    for rings in polys_of(f['geometry']):
        outer = proj_ring(rings[0])
        p = Polygon(outer)
        if not p.is_valid:
            p = p.buffer(0)
        if p.is_empty or not p.intersects(FRAME):
            continue
        if not FRAME.contains(p):
            p = p.intersection(FRAME)
            parts = [g for g in (p.geoms if hasattr(p, 'geoms') else [p]) if isinstance(g, Polygon) and g.area > 1]
            pts_list = [list(g.exterior.coords)[:-1] for g in parts]
        else:
            pts_list = [outer[:-1] if outer[0] == outer[-1] else outer]
        for pts in pts_list:
            d = 'M' + 'L'.join(f'{fmt(x)},{fmt(y)}' for x, y in pts) + 'Z'
            paths[key] = paths.get(key, '') + d
            ip = []
            for x, y in pts:
                q = [round(x), round(y)]
                if not ip or ip[-2:] != q:
                    ip += q
            if len(ip) >= 10:
                land.append(ip)
order = ['x'] + [k for k in GAME if k in paths]
ts = '// 현실 세계지도 모양(자동 생성: scripts/gen_realgeo.py, 원본 johan/world.geo.json 공개 자료). 직접 고치지 마세요.\n'
ts += f'// 투영: 정거원통(경도 {L0}~{L1}, 위도 {B0}~{B1}), 1도 = {PX}px. 지도 크기 {W}×{H}\n'
ts += f'export const GEO = {{ L0: {L0}, L1: {L1}, B0: {B0}, B1: {B1}, PX: {PX}, W: {W}, H: {H} }};\n'
ts += '/** 나라 id → SVG 경로(d). x = 게임 나라 밖의 나라(회색) */\nexport const GEO_PATH: Record<string, string> = {\n'
for k in order:
    ts += f'  {k}: "{paths[k]}",\n'
ts += '};\n/** 땅 다각형(바다 길 찾기용, 점 목록) */\n'
ts += 'export const GEO_POLYS: number[][] = ' + json.dumps(land, separators=(',', ':')) + ';\n'
open(sys.argv[2], 'w').write(ts)
print('나라', len(order), '땅 다각형', len(land), 'bytes', len(ts))
