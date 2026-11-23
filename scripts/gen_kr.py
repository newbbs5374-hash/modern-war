import json,sys
L0,B1,PX=-15,80,6
def P(lon,lat): return ((lon-L0)*PX,(B1-lat)*PX)
def rdp(pts,eps):
    if len(pts)<3: return pts
    (x1,y1),(x2,y2)=pts[0],pts[-1]
    dx,dy=x2-x1,y2-y1; L=(dx*dx+dy*dy)**.5 or 1e-9
    best,bi=0,0
    for i in range(1,len(pts)-1):
        x,y=pts[i]; d=abs(dy*x-dx*y+x2*y1-y2*x1)/L
        if d>best: best,bi=d,i
    if best>eps: return rdp(pts[:bi+1],eps)[:-1]+rdp(pts[bi:],eps)
    return [pts[0],pts[-1]]
def area(p): return abs(sum(p[i][0]*p[i-1][1]-p[i-1][0]*p[i][1] for i in range(len(p))))/2
SHORT={'제주특별자치도':'제주','경상남도':'경남','경상북도':'경북','전라남도':'전남','전라북도':'전북','충청남도':'충남','충청북도':'충북','강원도':'강원','경기도':'경기','세종특별자치시':'세종','울산광역시':'울산','대전광역시':'대전','광주광역시':'광주','인천광역시':'인천','대구광역시':'대구','부산광역시':'부산','서울특별시':'서울'}
d=json.load(open(sys.argv[1])); out=[]
for f in d['features']:
    g=f['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    rings=[]
    for poly in polys:
        r=[P(*c) for c in poly[0]]
        if area(r)<0.15: continue
        m=len(r)//2; r=rdp(r[:m+1],0.05)[:-1]+rdp(r[m:],0.05)
        if len(r)>=4: rings.append(r)
    if not rings: print("EMPTY",f["properties"]["name"],[area([P(*c) for c in p[0]]) for p in polys][:3]); continue
    big=max(rings,key=area)
    cx=sum(x for x,y in big)/len(big); cy=sum(y for x,y in big)/len(big)
    path=''.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in r[:-1])+'Z' for r in rings)
    n=f['properties']['name']
    out.append({'name':SHORT[n],'full':n,'metro':n.endswith('시'),'x':round(cx,2),'y':round(cy,2),'d':path})
ts='// 대한민국 시·도 경계(통계청 2013, southkorea/southkorea-maps). gen_kr.py로 만듦. 세계지도와 같은 투영.\n'
ts+='export type Province = { name: string; full: string; metro: boolean; x: number; y: number; d: string };\n'
ts+='export const KR_PROVINCES: Province[] = '+json.dumps(out,ensure_ascii=False)+';\n'
open(sys.argv[2],'w').write(ts); print(len(ts))

# 바깥 해안선(합친 모양)과 시·도 사이 안쪽 경계선만 따로
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union, transform, linemerge
from shapely import affinity
geoms=[shape(f['geometry']).buffer(0.01) for f in d['features']]
proj=lambda g: transform(lambda x,y,z=None:((x-L0)*PX,(B1-y)*PX), g)
outline=proj(unary_union(geoms).buffer(-0.01)).simplify(0.05)
polys=[p for p in (outline.geoms if isinstance(outline,MultiPolygon) else [outline]) if p.area>=0.15]
print('holes',sum(len(p.interiors) for p in polys))
op=''.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in list(p.exterior.coords)[:-1])+'Z' for p in polys)
inner=unary_union([proj(shape(f['geometry'])).boundary for f in d['features']]).difference(unary_union([Polygon(p.exterior) for p in (outline.geoms if isinstance(outline,MultiPolygon) else [outline])]).boundary.buffer(0.25))
inner=linemerge(inner) if inner.geom_type=='MultiLineString' else inner
inner=inner.simplify(0.05)
print('innerlen',inner.length)
lines=[l for l in (inner.geoms if hasattr(inner,'geoms') else [inner]) if l.length>0.3]
ip=''.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in l.coords) for l in lines)
with open(sys.argv[2],'a') as fo:
    fo.write('/** 대한민국 바깥 모양(시·도를 합친 것) */\nexport const KR_OUTLINE = '+json.dumps(op)+';\n')
    fo.write('/** 시·도 사이 안쪽 경계선(해안은 뺌) */\nexport const KR_INNER = '+json.dumps(ip)+';\n')
print(len(op),len(ip),len(polys),len(lines))
