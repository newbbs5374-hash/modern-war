"""세계지도 정밀 국경선(11/25 대장 요청 W4). 확대했을 때만 그림(필요할 때 내려받음).

자료: Natural Earth 10m admin-0 boundary lines(공개 자료)
입력: python3 scripts/gen_worldborders.py <ne_10m_admin_0_boundary_lines_land.geojson>
출력: public/world-sat/borders.json  {"d": 세계 좌표(1도=6) path}
"""
import json, os, sys

import numpy as np
from skimage.measure import approximate_polygon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L0, L1, B0, B1, PX = -15, 300, 5, 80, 6
out = []
for f in json.load(open(sys.argv[1]))['features']:
    g = f['geometry']
    parts = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for p in parts:
        a = np.array(p, float)
        a[:, 0] = np.where(a[:, 0] < L0, a[:, 0] + 360, a[:, 0])
        if not ((a[:, 0] <= L1).any() and (a[:, 1] >= B0 - 1).any() and (a[:, 1] <= B1 + 1).any()):
            continue
        a = approximate_polygon(a, tolerance=0.02)
        pts = [((x - L0) * PX, (B1 - y) * PX) for x, y in a]
        d = ''
        prev = None
        for x, y in pts:
            d += ('M' if prev is None or abs(x - prev) > 300 else 'L') + f'{x:.1f},{y:.1f}'
            prev = x
        out.append(d)
json.dump({'d': ''.join(out)}, open(os.path.join(ROOT, 'public/world-sat/borders.json'), 'w'))
print(len(out), sum(map(len, out)) // 1000, 'KB')
