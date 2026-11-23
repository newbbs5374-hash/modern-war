// 지도 위 전투 그림 칸. 대장이 만든 그림을 src/assets/field/ 에 정해진 이름으로 넣으면 바로 나옴.
// 그림이 없으면 임시 그림(이모지·색 육각형)을 씀. 목록과 GPT 프롬프트는 src/assets/field/README.md
import type { FKind, FTerrain } from '../battle/field';
import { EXCLUSIVES, SPECIALS } from '../data/specials';
import { countryById } from '../data/world';

const FILES = import.meta.glob('../assets/field/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) URLS[path.split('/').pop()!.replace(/\.[^.]+$/, '')] = url;

export const fieldArt = (key: string): string | null => URLS[key] ?? null;

export const UNIT_ART: Record<FKind, string> = {
  infantry: 'unit-infantry',
  tank: 'unit-tank',
  artillery: 'unit-artillery',
  aa: 'unit-aa',
  drone: 'unit-drone',
  fighter: 'unit-fighter',
  destroyer: 'unit-destroyer',
  submarine: 'unit-submarine',
  carrier: 'unit-carrier',
  cruiser: 'unit-cruiser',
  hq: 'unit-hq',
};
export const TILE_ART: Record<FTerrain, string> = {
  평지: 'tile-plain',
  숲: 'tile-forest',
  산: 'tile-mountain',
  시가지: 'tile-city',
  도심: 'tile-downtown',
  바다: 'tile-sea',
  해협: 'tile-strait',
  해안: 'tile-beach',
};
export const FX_ART = { explosion: 'fx-explosion', wreck: 'fx-wreck', landing: 'mark-landing' };
/** 특화 유닛·독점 병과 그림 칸: unit-sp-us-2, unit-ex-lhd … 없으면 바탕 병과 그림 */
export const spArt = (sp: string): string => {
  const x = EXCLUSIVES.find((e) => e.name === sp);
  return x ? `unit-ex-${x.key}` : `unit-sp-${sp}`;
};

/** 본부 지도(수도) 꾸밈 그림 칸: 없으면 지금처럼 도형으로 그림 */
export const LAND_ART = {
  landmark: 'land-landmark',
  towers: ['land-tower-1', 'land-tower-2'],
  offices: ['land-office-1', 'land-office-2'],
  houses: ['land-house-1', 'land-house-2'],
  factory: 'land-factory',
  port: 'land-port',
  base: 'land-base',
  trees: ['land-tree-1', 'land-tree-2'],
  mountain: 'land-mountain',
} as const;
const LAND_WHO: Record<string, string> = {
  'land-landmark': '수도 랜드마크', 'land-tower-1': '고층 빌딩 1', 'land-tower-2': '고층 빌딩 2', 'land-office-1': '중간 빌딩 1',
  'land-office-2': '중간 빌딩 2', 'land-house-1': '주택 1', 'land-house-2': '주택 2', 'land-factory': '공장',
  'land-port': '항구', 'land-base': '군 기지', 'land-tree-1': '나무(활엽수)', 'land-tree-2': '나무(침엽수)', 'land-mountain': '산',
};
/** 여러 장 중 그림이 있는 것만(없으면 빈 배열 = 도형으로 그림) */
export const landPick = (keys: readonly string[]): string[] => keys.map((k) => fieldArt(k)).filter((u): u is string => !!u);

/** 그림 칸 전체(설정 화면에서 무엇이 들어왔는지 보기) */
export function fieldSlots(): Array<{ key: string; who: string }> {
  const U: Record<FKind, string> = {
    infantry: '보병', tank: '전차', artillery: '포병', aa: '방공부대', drone: '정찰 드론', fighter: '전투기 비행단',
    destroyer: '구축함', submarine: '잠수함', carrier: '항공모함', cruiser: '적 기함(순양함)', hq: '적 사령부',
  };
  return [
    ...(Object.keys(UNIT_ART) as FKind[]).map((k) => ({ key: UNIT_ART[k], who: `말 · ${U[k]}` })),
    ...(Object.keys(TILE_ART) as FTerrain[]).map((k) => ({ key: TILE_ART[k], who: `지형 · ${k}` })),
    { key: FX_ART.explosion, who: '효과 · 폭발' },
    { key: FX_ART.wreck, who: '효과 · 부서진 자리' },
    { key: FX_ART.landing, who: '표시 · 상륙 거점' },
    ...SPECIALS.map((d) => ({ key: spArt(d.id), who: `특화 · ${countryById(d.country).name} ${d.name}` })),
    ...EXCLUSIVES.map((x) => ({ key: spArt(x.name), who: `독점 · ${x.name}` })),
    ...Object.keys(LAND_WHO).map((k) => ({ key: k, who: `본부 지도 · ${LAND_WHO[k]}` })),
  ];
}
