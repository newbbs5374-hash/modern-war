// 세계지도에서 움직이는 나라별 병과(11/24 대장 요청: 그 나라가 가진 병과로).
// AI 나라는 실제 군 구성을 참고한 대표 병과, 내 나라는 직접 만든 부대(없으면 이 목록).
import { SPECIALS } from './specials';

export type MapDomain = 'sea' | 'air' | 'land';
export const MAP_DOMAIN: Record<string, MapDomain> = {
  항공모함: 'sea', 구축함: 'sea', 잠수함: 'sea', 강습상륙함: 'sea', '원자력 잠수함': 'sea', '레이저 방공함': 'sea',
  전투기: 'air', 폭격기: 'air', 무인드론: 'air', 공격헬기: 'air',
  '정찰 무인기': 'air', '스텔스 전투기': 'air', 조기경보기: 'air', '지상 공격기': 'air', '바다 드론': 'sea',
  탄도미사일: 'land', 다연장로켓: 'land', '장거리 방공': 'land', '해안 미사일': 'land', 상륙장갑차: 'land',
  전차: 'land', 기갑병: 'land', 포병: 'land', 미사일: 'land', 방공부대: 'land', 보병: 'land', 특수부대: 'land',
};

export const COUNTRY_FORCES: Record<string, string[]> = {
  us: ['항공모함', '구축함', '원자력 잠수함', '전투기', '폭격기', '무인드론', '전차'],
  cn: ['항공모함', '구축함', '잠수함', '전투기', '폭격기', '무인드론', '전차', '미사일'],
  ru: ['구축함', '원자력 잠수함', '전투기', '폭격기', '전차', '미사일'],
  de: ['구축함', '전투기', '전차', '포병'],
  jp: ['강습상륙함', '구축함', '잠수함', '전투기', '공격헬기'],
  uk: ['항공모함', '구축함', '원자력 잠수함', '전투기'],
  in: ['항공모함', '구축함', '전투기', '전차', '미사일'],
  kr: ['강습상륙함', '구축함', '잠수함', '전투기', '무인드론', '전차'],
  tr: ['강습상륙함', '구축함', '무인드론', '전투기', '전차'],
  il: ['전투기', '무인드론', '전차', '방공부대'],
  ir: ['구축함', '무인드론', '미사일', '전차'],
  ua: ['무인드론', '전차', '포병', '전투기'],
  kp: ['잠수함', '미사일', '전차', '포병'],
};

/** 특화 유닛 이름 → 바탕 병과 */
export const baseUnit = (name: string) => SPECIALS.find((d) => d.name === name)?.base ?? name;

/** 지도에 그릴 병과(바다·하늘·땅 각각 많은 순 최대 3) */
export function mapForces(countryId: string, army?: Record<string, number>): Record<MapDomain, string[]> {
  const out: Record<MapDomain, string[]> = { sea: [], air: [], land: [] };
  const mine = army ? Object.entries(army).filter(([, k]) => k > 0) : [];
  if (mine.length) {
    const sum: Record<string, number> = {};
    for (const [n, k] of mine) {
      const b = baseUnit(n);
      sum[b] = (sum[b] ?? 0) + k;
    }
    for (const [n] of Object.entries(sum).sort((a, b) => b[1] - a[1])) {
      const d = MAP_DOMAIN[n];
      if (d && out[d].length < 3) out[d].push(n);
    }
    return out;
  }
  for (const n of COUNTRY_FORCES[countryId] ?? []) {
    const d = MAP_DOMAIN[n];
    if (d && out[d].length < 3) out[d].push(n);
  }
  return out;
}
