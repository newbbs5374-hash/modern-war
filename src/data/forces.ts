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
  tw: ['구축함', '잠수함', '전투기', '해안 미사일', '장거리 방공'],
  pl: ['전차', '다연장로켓', '전투기', '공격헬기', '포병'],
  ph: ['구축함', '전투기', '정찰 무인기', '해안 미사일'],
  pk: ['잠수함', '전투기', '전차', '탄도미사일', '포병'],
  sa: ['전투기', '구축함', '장거리 방공', '전차', '탄도미사일'],
  // 11-27 새 나라 18개
  eg: ['전차', '전투기', '구축함', '공격헬기', '포병'],
  ng: ['보병', '공격헬기', '구축함', '전투기'],
  za: ['공격헬기', '잠수함', '구축함', '전투기'],
  et: ['보병', '전차', '포병', '무인드론'],
  dz: ['전차', '잠수함', '전투기', '장거리 방공', '포병'],
  br: ['구축함', '잠수함', '전투기', '전차', '지상 공격기'],
  ar: ['전차', '구축함', '전투기', '포병'],
  co: ['특수부대', '공격헬기', '구축함', '전투기'],
  ve: ['전투기', '장거리 방공', '전차', '구축함'],
  cl: ['잠수함', '구축함', '전투기', '전차'],
  au: ['잠수함', '구축함', '스텔스 전투기', '조기경보기', '전차'],
  ca: ['구축함', '전투기', '잠수함', '전차'],
  mx: ['보병', '공격헬기', '구축함', '전투기'],
  fr: ['항공모함', '원자력 잠수함', '구축함', '전투기', '전차'],
  it: ['항공모함', '구축함', '잠수함', '스텔스 전투기', '전차'],
  es: ['구축함', '잠수함', '전투기', '상륙장갑차'],
  gr: ['구축함', '잠수함', '전투기', '전차'],
  fi: ['포병', '다연장로켓', '스텔스 전투기', '전차', '특수부대'],
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
