// 거점 도시 목록. 세계지도 자리는 실제 경도·위도(realmap.ts), 크기·도시 칸은 육각 타일 지도(hexmap.ts): 대도시 61칸 · 중도시 37칸 · 소도시 19칸
import { COUNTRIES } from './world';
import { CITY_HEX, type CitySize } from './hexmap';
import { CITY_LONLAT, project } from './realmap';

/** 수입 무게: 대도시 1.5 · 중도시 1.2 · 소도시 1 */
const VALUE: Record<CitySize, number> = { 4: 1.5, 3: 1.2, 2: 1 };

export interface City {
  id: string;
  name: string;
  /** 처음 주인 */
  home: string;
  capital: boolean;
  /** 육각 반지름: 2 소도시 · 3 중도시 · 4 대도시 */
  size: CitySize;
  /** 수입 무게 */
  value: number;
  x: number;
  y: number;
  /** 점령 도시(전쟁으로 직접 빼앗을 수 있는 거점, 11-25). 아니면 내정 도시 */
  front: boolean;
  /** 따라가는 점령 도시 id(점령 도시는 자기 자신). 내정 도시는 이 도시 주인을 따라감 */
  hub: string;
}

/** 나라별 점령 도시(11-25 대장 결정). 나머지는 내정 도시 */
export const FRONT_CITIES: Record<string, string[]> = {
  kr: ['서울', '부산', '대전', '강릉', '전주', '여수'],
  us: ['워싱턴', '뉴욕', '로스앤젤레스', '휴스턴', '샌프란시스코', '호놀룰루', '시카고', '마이애미'], // 11-26 미국이 가장 강하게: 점령 도시 8곳
  cn: ['베이징', '상하이', '광저우', '선전', '톈진', '우한', '충칭'],
  ru: ['모스크바', '상트페테르부르크', '블라디보스토크', '무르만스크', '노보시비르스크', '예카테린부르크'],
  in: ['뉴델리', '뭄바이', '콜카타', '첸나이', '벵갈루루', '하이데라바드'],
  de: ['베를린', '함부르크', '뮌헨', '프랑크푸르트', '쾰른'],
  jp: ['도쿄', '오사카', '나고야', '후쿠오카', '삿포로'],
  uk: ['런던', '버밍엄', '맨체스터', '글래스고', '포츠머스'],
  tr: ['앙카라', '이스탄불', '이즈미르', '아다나', '트라브존'],
  il: ['텔아비브', '하이파', '베르셰바', '아슈도드', '에일라트'],
  ir: ['테헤란', '이스파한', '시라즈', '반다르아바스', '타브리즈'],
  ua: ['키이우', '하르키우', '오데사', '리비우', '드니프로'],
  kp: ['평양', '남포', '원산', '신의주', '함흥'],
};

export const CITIES: City[] = COUNTRIES.flatMap((c) =>
  c.cities.map((name, i) => {
    const id = `${c.id}-${i}`;
    const h = CITY_HEX[id];
    // 세계지도 자리 = 실제 위치(육각 칸 자리는 CITY_HEX, 도시·전투 화면용)
    const p = project(...CITY_LONLAT[name]);
    const front = i === 0 || (FRONT_CITIES[c.id] ?? c.cities).includes(name);
    return { id, name, home: c.id, capital: i === 0, size: h.size, value: VALUE[h.size], x: p.x, y: p.y, front, hub: id };
  }),
);
// 내정 도시 → 실제 거리로 가장 가까운 같은 나라 점령 도시
for (const c of CITIES) {
  if (c.front) continue;
  const fronts = CITIES.filter((f) => f.home === c.home && f.front);
  c.hub = fronts.slice().sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0].id;
}
/** 점령 도시만(전쟁·승리 계산) */
export const FRONT: City[] = CITIES.filter((c) => c.front);
/** 그 점령 도시를 따라가는 내정 도시 */
export const followersOf = (hubId: string) => CITIES.filter((c) => !c.front && c.hub === hubId);

/** 실제로 바다에 닿은 도시(항만 구역을 지을 수 있음). 강 하구 항구 포함. 서울은 11/24부터 실제 행정구역 모양이라 내륙(인천항은 서울 밖) */
export const COASTAL_CITIES: ReadonlySet<string> = new Set([
  '워싱턴', '뉴욕', '샌프란시스코', '호놀룰루', '휴스턴',
  '톈진', '광저우', '선전', '상하이',
  '상트페테르부르크', '무르만스크', '아르한겔스크', '블라디보스토크',
  '함부르크', '도쿄', '후쿠오카', '런던',
  '콜카타', '첸나이', '뭄바이',
  '부산', '강릉', '제주', '여수', '순천', '인천', '울산',
  '로스앤젤레스', '시애틀', '보스턴', '칭다오', '칼리닌그라드', '코치', '비샤카파트남',
  '오사카', '나고야', '삿포로', '히로시마', '센다이', '나하',
  '글래스고', '포츠머스', '에든버러', '카디프', '벨파스트',
  '트라브존', '안탈리아', '아슈도드', '에일라트', '네타냐', '부셰르', '미콜라이우',
  '원산', '함흥', '청진', '나선', '신의주',
  '마이애미', '샌디에이고', '노퍽', '다롄',
  '이스탄불', '이즈미르', '텔아비브', '하이파', '반다르아바스', '오데사', '남포',
]);
/** 도시가 바다에 닿았는지(분쟁 지역처럼 도시가 아닌 곳은 늘 바닷가) */
export function isCoastalCity(id: string): boolean {
  const c = CITIES.find((x) => x.id === id);
  return c ? COASTAL_CITIES.has(c.name) : true;
}

const byId = new Map(CITIES.map((c) => [c.id, c]));
export function cityById(id: string): City {
  const c = byId.get(id);
  if (!c) throw new Error(`없는 도시: ${id}`);
  return c;
}

/** 나라가 처음 가진 도시 무게 합 */
export function homeValue(countryId: string): number {
  return CITIES.filter((c) => c.home === countryId).reduce((s, c) => s + c.value, 0);
}
