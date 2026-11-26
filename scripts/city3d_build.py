"""도시 3D 자료 여러 곳 한꺼번에 만들기(GitHub Actions에서 실행).
scripts/city3d_cities.json 목록을 Geofabrik 지역별로 묶어 받고 → osmium으로 도시마다 자르고 → gen_city3d.py.
인자: 다시 만들 파일 이름들(쉼표). 비우면 아직 없는 것만. 둘째 인자: 이 지역만(Actions 나눠 돌리기).
--regions: 만들 지역 목록을 JSON으로 출력(Actions matrix용).
"""
import json, math, os, subprocess, sys

cfg = json.load(open('scripts/city3d_cities.json', encoding='utf-8'))['cities']
args = sys.argv[1:]
plan = bool(args) and args[0] == '--regions'
if plan:
    args = args[1:]
only = [x for x in (args[0] if args else '').split(',') if x]
if only:
    todo = [c for c in cfg if c['file'] in only]
else:
    todo = [c for c in cfg if not os.path.exists(f"public/city3d/{c['file']}.json")]
by = {}
for c in todo:
    by.setdefault(c['region'], []).append(c)
if plan:
    print(json.dumps(sorted(by)))
    sys.exit(0)
if len(args) > 1 and args[1]:
    by = {k: v for k, v in by.items() if k == args[1]}
    todo = [c for v in by.values() for c in v]
print('만들 도시', len(todo), [c['file'] for c in todo], flush=True)
fail = []
os.makedirs('work', exist_ok=True)
for region, cs in by.items():
    pbf = 'work/region.osm.pbf'
    url = f'https://download.geofabrik.de/{region}-latest.osm.pbf'
    print('받기', url, flush=True)
    # 느리거나 멈추면 끊고(1분 동안 초당 50KB 아래) 프랑스 거울 서버로 한 번 더
    cur = ['curl', '-sSfL', '--retry', '3', '--connect-timeout', '30', '--max-time', '2400', '-y', '60', '-Y', '50000', '-o', pbf]
    if subprocess.call(cur + [url]) != 0 and subprocess.call(cur + [f"https://download.openstreetmap.fr/extracts/{region.replace('-', '_')}-latest.osm.pbf"]) != 0:
        print('받기 실패', region, flush=True)
        fail += [c['file'] for c in cs]
        continue
    ext = {'directory': 'work', 'extracts': []}
    for c in cs:
        dlat = c['half'] / 110.54
        dlon = c['half'] / (111.32 * math.cos(math.radians(c['lat'])))
        ext['extracts'].append({'output': f"{c['file']}.osm.pbf", 'bbox': [c['lon'] - dlon, c['lat'] - dlat, c['lon'] + dlon, c['lat'] + dlat]})
    with open('work/ext.json', 'w') as f:
        json.dump(ext, f)
    if subprocess.call(['osmium', 'extract', '-c', 'work/ext.json', '--strategy', 'smart', '--overwrite', pbf]) != 0:
        fail += [c['file'] for c in cs]
        os.remove(pbf)
        continue
    for c in cs:
        f = c['file']
        ok = subprocess.call(['osmium', 'tags-filter', f'work/{f}.osm.pbf', 'nwr/building', 'w/highway=motorway,trunk,primary,secondary', 'nwr/natural=water,wood', 'w/waterway=riverbank', 'nwr/leisure=park', 'nwr/landuse=grass,forest', '-o', f'work/{f}.f.pbf', '--overwrite']) == 0
        ok = ok and subprocess.call(['osmium', 'export', '-f', 'geojsonseq', f'work/{f}.f.pbf', '-o', f'work/{f}.geojsonseq', '--overwrite']) == 0
        ok = ok and subprocess.call([sys.executable, 'scripts/gen_city3d.py', f'work/{f}.geojsonseq', f, str(c['lon']), str(c['lat']), str(c['max']), c['name']]) == 0
        if not ok:
            fail.append(f)
    os.remove(pbf)
print('실패', fail, flush=True)
sys.exit(1 if fail and len(fail) == len(todo) else 0)
