// 11-27 대장 요청 2번: 대륙 패권. 나라마다 패권을 다투는 '대륙'(지도 지역과 따로, 실제 대륙에 가깝게).
// 새 나라를 넣으면 REGION_OF에 대륙을 적어 주세요(없으면 지도 지역 id를 대륙으로 씀).
import { countryById } from './world';

export interface Region {
  id: string;
  name: string;
  icon: string;
}

export const REGIONS: Region[] = [
  { id: 'asia', name: '아시아', icon: '🌏' },
  { id: 'europe', name: '유럽', icon: '🌍' },
  { id: 'mideast', name: '중동', icon: '🕌' },
  { id: 'americas', name: '아메리카', icon: '🌎' },
  { id: 'africa', name: '아프리카', icon: '🌍' },
  { id: 'oceania', name: '오세아니아', icon: '🏝️' },
];

export const REGION_OF: Record<string, string> = {
  us: 'americas',
  cn: 'asia', jp: 'asia', kr: 'asia', kp: 'asia', tw: 'asia', ph: 'asia', in: 'asia', pk: 'asia',
  ru: 'europe', de: 'europe', uk: 'europe', ua: 'europe', pl: 'europe',
  tr: 'mideast', il: 'mideast', ir: 'mideast', sa: 'mideast',
};

export const regionOf = (id: string): string => REGION_OF[id] ?? countryById(id).continent;
export const regionName = (rid: string): string => REGIONS.find((r) => r.id === rid)?.name ?? '세계';
export const regionIcon = (rid: string): string => REGIONS.find((r) => r.id === rid)?.icon ?? '🌐';
