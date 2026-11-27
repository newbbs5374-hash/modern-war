# 36개국 도(주·성·현) 경계 만들기. 원본: Natural Earth 10m admin-1(공개 자료) + johan/world.geo.json(세계지도 나라 모양).
# 쓰는 법: python3 scripts/gen_prov.py ne_10m_admin_1_states_provinces.geojson countries.geo.json src/data/provinces.ts
# 대한민국은 krProvinces.ts(gen_kr.py)를 그대로 씀. 나라 모양 안을 빈틈없이 나누고(빈 곳은 가까운 도로), 나라 모양 밖은 자름.
import json, sys
from shapely.geometry import shape, MultiPolygon, Polygon
from shapely.ops import unary_union, transform
L0, B1, PX = -15, 80, 6
GAME = {'us':'USA','cn':'CHN','ru':'RUS','de':'DEU','jp':'JPN','uk':'GBR','in':'IND','tr':'TUR','il':'ISR','ir':'IRN','ua':'UKR','kp':'PRK','tw':'TWN','pl':'POL','ph':'PHL','pk':'PAK','sa':'SAU','eg':'EGY','ng':'NGA','za':'ZAF','et':'ETH','dz':'DZA','br':'BRA','ar':'ARG','co':'COL','ve':'VEN','cl':'CHL','au':'AUS','ca':'CAN','mx':'MEX','fr':'FRA','it':'ITA','es':'ESP','gr':'GRC','fi':'FIN'}
A3 = {v:k for k,v in GAME.items()}
REG = {
  'FRA': {'Auvergne-Rhône-Alpes':'오베르뉴론알프','Bourgogne-Franche-Comté':'부르고뉴프랑슈콩테','Bretagne':'브르타뉴','Centre-Val de Loire':'상트르발드루아르','Corse':'코르시카','Grand Est':'그랑테스트','Hauts-de-France':'오드프랑스','Normandie':'노르망디','Nouvelle-Aquitaine':'누벨아키텐','Occitanie':'옥시타니','Pays de la Loire':'페이드라루아르',"Provence-Alpes-Côte-d'Azur":'프로방스','Île-de-France':'일드프랑스'},
  'ITA': {'Abruzzo':'아브루초','Apulia':'풀리아','Basilicata':'바실리카타','Calabria':'칼라브리아','Campania':'캄파니아','Emilia-Romagna':'에밀리아로마냐','Friuli-Venezia Giulia':'프리울리','Lazio':'라치오','Liguria':'리구리아','Lombardia':'롬바르디아','Marche':'마르케','Molise':'몰리세','Piemonte':'피에몬테','Sardegna':'사르데냐','Sicily':'시칠리아','Toscana':'토스카나','Trentino-Alto Adige':'트렌티노','Umbria':'움브리아',"Valle d'Aosta":'발레다오스타','Veneto':'베네토'},
  'ESP': {'Andalucía':'안달루시아','Aragón':'아라곤','Asturias':'아스투리아스','Canary Is.':'카나리아','Cantabria':'칸타브리아','Castilla y León':'카스티야이레온','Castilla-La Mancha':'카스티야라만차','Cataluña':'카탈루냐','Ceuta':'세우타','Extremadura':'에스트레마두라','Foral de Navarra':'나바라','Galicia':'갈리시아','Islas Baleares':'발레아레스','La Rioja':'라리오하','Madrid':'마드리드','Melilla':'멜리야','Murcia':'무르시아','País Vasco':'바스크','Valenciana':'발렌시아'},
}
def proj(g):
    return transform(lambda x, y, z=None: (((x + 360 if x < L0 else x) - L0) * PX, (B1 - y) * PX), g)
def polys(g):
    return [p for p in (g.geoms if hasattr(g, 'geoms') else [g]) if isinstance(p, Polygon)]
FIX = {'키예프':'키이우','None':'','크림 자치 공화국':'크림'}
ne = json.load(open(sys.argv[1]))['features']
wd = {f['id']: f for f in json.load(open(sys.argv[2]))['features']}
coarse = {k: proj(shape(wd[a3]['geometry'])).buffer(0) for k, a3 in GAME.items()}
# 후보: 13개국 자료(크림처럼 겹치는 곳은 세계지도 나라 모양에 더 많이 겹치는 쪽)
groups = {}
for f in ne:
    p = f['properties']
    if p['adm0_a3'] not in A3: continue
    if 'Overseas' in (p['type'] or ''): continue  # 프랑스 해외 영토(기아나 등)는 뺌
    g = proj(shape(f['geometry'])).buffer(0)
    key = (p['adm0_a3'], p['name_en'] or p['name'])
    if p['adm0_a3'] == 'GBR':
        key = ('GBR', p['region'] if p['geonunit'] == 'England' else p['geonunit'])
    nm = p['name_ko'] or p['name']
    if p['adm0_a3'] in REG:  # 11-27 프랑스·이탈리아·스페인은 도(데파르트망·현)가 너무 잘아 큰 지방으로 묶음
        key = (p['adm0_a3'], p['region']); nm = REG[p['adm0_a3']].get(p['region'], p['region'])
    if p['adm0_a3'] == 'GBR':
        nm = {'Scotland':'스코틀랜드','Wales':'웨일스','Northern Ireland':'북아일랜드','Greater London':'런던','South East':'남동부','South West':'남서부','East':'동부','East Midlands':'이스트미들랜즈','West Midlands':'웨스트미들랜즈','North West':'북서부','North East':'북동부','Yorkshire and the Humber':'요크셔'}[key[1]]
    if p['name_en'] == 'Shaanxi': nm = '섬서성'
    nm = FIX.get(nm, nm)
    if key in groups: groups[key]['g'] = groups[key]['g'].union(g)
    else: groups[key] = {'g': g, 'name': nm, 'a3': p['adm0_a3']}
out = []
inner = {}
for k in GAME:
    C = coarse[k]
    mine = []
    for key, v in groups.items():
        g = v['g']
        best = max(GAME, key=lambda c: g.intersection(coarse[c]).area)
        if best == k and g.intersection(C).area > 0: mine.append(v)
    shapes = [v['g'].intersection(C).buffer(0) for v in mine]
    # 빈틈은 가장 가까운 도에 붙임
    gap = C.difference(unary_union(shapes)).buffer(0)
    for piece in polys(gap):
        if piece.area < 1e-6: continue
        i = min(range(len(shapes)), key=lambda j: shapes[j].distance(piece))
        shapes[i] = shapes[i].union(piece).buffer(0)
    tol = 0.25
    for v, s in zip(mine, shapes):
        s = s.simplify(tol, preserve_topology=True)
        ps = [p for p in polys(s) if p.area >= 0.08]
        if not ps: continue
        big = max(ps, key=lambda p: p.area)
        lp = big.representative_point()
        d = ''.join('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in list(p.exterior.coords)[:-1]) + 'Z' for p in ps)
        out.append({'c': k, 'name': v['name'], 'x': round(lp.x, 1), 'y': round(lp.y, 1), 'a': round(sum(p.area for p in ps), 1), 'd': d})
    # 안쪽 경계선(해안 뺌)
    bnd = unary_union([s.boundary for s in shapes]).difference(C.boundary.buffer(0.3))
    bnd = bnd.simplify(tol)
    ls = [l for l in (bnd.geoms if hasattr(bnd, 'geoms') else [bnd]) if l.length > 0.5 and l.geom_type == 'LineString']
    inner[k] = ''.join('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in l.coords) for l in ls)
    print(k, len([o for o in out if o['c'] == k]), len(inner[k]))
ts = '// 36개국 도(주·성·현) 경계. scripts/gen_prov.py로 자동 생성(Natural Earth admin-1 공개 자료). 직접 고치지 마세요. 대한민국은 krProvinces.ts.\n'
ts += 'export type GeoProv = { c: string; name: string; x: number; y: number; a: number; d: string };\n'
ts += 'export const GEO_PROVS: GeoProv[] = ' + json.dumps(out, ensure_ascii=False) + ';\n'
ts += '/** 나라 id → 도 사이 안쪽 경계선(해안 뺌) */\nexport const GEO_PROV_INNER: Record<string, string> = ' + json.dumps(inner, ensure_ascii=False) + ';\n'
open(sys.argv[3], 'w').write(ts)
print('bytes', len(ts.encode()))
