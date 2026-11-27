// 부대·훈련·분쟁 지역 아이콘 그림 칸. 대장이 만든 그림을 src/assets/icons/ 에 정해진 이름으로 넣으면 바로 바뀜.
// 순서: 아이콘 그림(icons/) → 지도 전투 말 그림(field/, 있으면) → 지금 이모지.
// 목록과 GPT 명령문은 src/assets/icons/README.md (= /mnt/project-files/guides/icon-art-prompts.md)
import { MINISTRIES } from '../data/cabinet';
import type { ReactNode } from 'react';
import { EXCLUSIVES, specialById } from '../data/specials';
import { PIONEER_ISLANDS } from '../data/hexmap';
import { BUILDINGS, RESOURCES, RES_ICON, type Res } from '../data/economy';
import { CARDS, ERAS, GOVS, TECHS } from '../data/civ';
import { fieldArt } from './fieldArt';
import { TRAINING_ICON, UNIT_ICON } from './icons';

const FILES = import.meta.glob('../assets/icons/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) URLS[path.split('/').pop()!.replace(/\.[^.]+$/, '')] = url;
export const iconArt = (key: string): string | null => URLS[key] ?? null;

/** 병과 이름 → 그림 이름표(icon-unit-<key>) · 지도 전투 말 그림이 있으면 그 이름(unit-<field>) */
export const UNIT_KEY: Record<string, { key: string; field?: string; who: string }> = {
  보병: { key: 'infantry', field: 'unit-infantry', who: '보병' },
  특수부대: { key: 'special', who: '특수부대' },
  기갑병: { key: 'ifv', who: '기갑병(장갑차)' },
  무인드론: { key: 'drone', field: 'unit-drone', who: '무인드론' },
  해킹부대: { key: 'hacker', who: '해킹부대' },
  전차: { key: 'tank', field: 'unit-tank', who: '전차' },
  포병: { key: 'artillery', field: 'unit-artillery', who: '포병' },
  방공부대: { key: 'aa', field: 'unit-aa', who: '방공부대' },
  공격헬기: { key: 'heli', who: '공격헬기' },
  전투기: { key: 'fighter', field: 'unit-fighter', who: '전투기' },
  구축함: { key: 'destroyer', field: 'unit-destroyer', who: '구축함' },
  폭격기: { key: 'bomber', who: '폭격기' },
  잠수함: { key: 'submarine', field: 'unit-submarine', who: '잠수함' },
  미사일: { key: 'missile', who: '미사일' },
  항공모함: { key: 'carrier', field: 'unit-carrier', who: '항공모함' },
  탄도미사일: { key: 'ballistic', who: '탄도미사일' },
  다연장로켓: { key: 'mlrs', who: '다연장로켓' },
  '장거리 방공': { key: 'sam', who: '장거리 방공' },
  '해안 미사일': { key: 'coastal', who: '해안 미사일' },
  '정찰 무인기': { key: 'uav', who: '정찰 무인기' },
  '스텔스 전투기': { key: 'stealth', who: '스텔스 전투기' },
  조기경보기: { key: 'awacs', who: '조기경보기' },
  '지상 공격기': { key: 'gunship', who: '지상 공격기' },
  상륙장갑차: { key: 'aav', who: '상륙장갑차' },
  '바다 드론': { key: 'usv', who: '바다 드론' },
};
export const TRAIN_KEY: Record<string, string> = {
  잠입: 'stealth', 체력: 'fitness', 전술: 'tactics', 사격: 'shooting', 포격: 'artillery', 정보: 'intel',
  통솔: 'command', 보급: 'supply', 해킹: 'hacking', 모병: 'recruit', 항공: 'air', 해상: 'naval',
};

function Img({ url, alt, cls = '' }: { url: string; alt: string; cls?: string }) {
  return <img className={`art-ico ${cls}`} src={url} alt={alt} draggable={false} />;
}

/** 병과 그림의 주소(없으면 null). sp = 특화 유닛 id('us-1') */
export function unitArtUrl(unit: string, sp?: string): string | null {
  if (sp) {
    const d = specialById(sp);
    return iconArt(`icon-sp-${sp}`) ?? fieldArt(`unit-sp-${sp}`) ?? (d ? unitArtUrl(d.base) : null);
  }
  const ex = EXCLUSIVES.find((x) => x.name === unit);
  if (ex) return iconArt(`icon-ex-${ex.key}`) ?? fieldArt(`unit-ex-${ex.key}`);
  const k = UNIT_KEY[unit];
  if (!k) return null;
  return iconArt(`icon-unit-${k.key}`) ?? (k.field ? fieldArt(k.field) : null);
}

/** 병과 아이콘: 그림이 있으면 그림, 없으면 이모지. 특화 유닛은 🌟 작은 표가 붙음 */
export function UnitIcon({ unit, sp, fallback, lock }: { unit: string; sp?: string; fallback?: string; lock?: boolean }): ReactNode {
  const url = unitArtUrl(unit, sp);
  const emoji = lock ? '🔒' : fallback ?? (sp ? '🌟' : EXCLUSIVES.some((x) => x.name === unit) ? '👑' : UNIT_ICON[unit] ?? '❔');
  if (!url) return <>{emoji}</>;
  const tag = lock ? '🔒' : sp ? '🌟' : EXCLUSIVES.some((x) => x.name === unit) ? '👑' : null;
  return (
    <span className="art-ico-wrap">
      <Img url={url} alt={unit} />
      {tag && <i className="art-ico-tag">{tag}</i>}
    </span>
  );
}

/** 훈련 아이콘 */
export function TrainIcon({ name, lock }: { name: string; lock?: boolean }): ReactNode {
  const url = iconArt(`icon-train-${TRAIN_KEY[name]}`);
  if (!url) return <>{lock ? '🔒' : TRAINING_ICON[name] ?? '🎯'}</>;
  if (!lock) return <Img url={url} alt={name} />;
  return (
    <span className="art-ico-wrap">
      <Img url={url} alt={name} />
      <i className="art-ico-tag">🔒</i>
    </span>
  );
}

/** 분쟁 지역 그림 주소(island-<id 앞 p- 뺀 이름>, 예: island-whale) */
export const islandArtUrl = (id: string): string | null => iconArt(`island-${id.replace(/^p-/, '')}`);

/** 분쟁 지역 아이콘: 섬 그림 + 구석에 작은 표(1등 나라 깃발 또는 자원). 그림이 없으면 표만 */
export function IslandIcon({ id, badge }: { id: string; badge?: ReactNode }): ReactNode {
  const url = islandArtUrl(id);
  if (!url) return <>{badge ?? '🏝️'}</>;
  return (
    <span className="art-ico-wrap island">
      <Img url={url} alt={PIONEER_ISLANDS.find((p) => p.id === id)?.name ?? ''} cls="island" />
      {badge && <i className="art-ico-tag">{badge}</i>}
    </span>
  );
}

/** 자원 이름 → 그림 이름표(icon-res-<key>) */
export const RES_KEY: Record<Res, string> = {
  강철: 'steel', 석유: 'oil', 알루미늄: 'aluminum', 티타늄: 'titanium', 희토류: 'rare-earth', 리튬: 'lithium', 반도체: 'chip',
  구리: 'copper', 우라늄: 'uranium', 복합소재: 'composite', 갈륨: 'gallium', 향신료: 'spice', 진주: 'pearl', 차잎: 'tea', 산호: 'coral',
  니켈: 'nickel', 텅스텐: 'tungsten', 코발트: 'cobalt', 특수강: 'special-steel', 정밀부품: 'precision-parts', 게르마늄: 'germanium', 헬륨: 'helium', 커피: 'coffee', 비단: 'silk',
  천연가스: 'natural-gas', 석탄: 'coal', 마그네슘: 'magnesium', 망간: 'manganese', 크롬: 'chromium', 바나듐: 'vanadium', 몰리브덴: 'molybdenum', 백금: 'platinum', 인듐: 'indium', 금: 'gold', 와인: 'wine', 카카오: 'cocoa',
};
export const resArtUrl = (r: Res): string | null => iconArt(`icon-res-${RES_KEY[r]}`);
/** 자원 아이콘. inline = 글 사이에 끼는 작은 크기 */
export function ResIcon({ res, inline }: { res: Res; inline?: boolean }): ReactNode {
  const url = resArtUrl(res);
  return url ? <Img url={url} alt={res} cls={inline ? 'inline' : ''} /> : <>{RES_ICON[res]}</>;
}

/** 설정 화면용: 아이콘 그림 칸 전체 */
export function iconSlots(): Array<{ key: string; who: string; url: string | null; own: boolean }> {
  const row = (key: string, who: string, url: string | null) => ({ key, who, url, own: !!iconArt(key) });
  return [
    ...Object.entries(UNIT_KEY).map(([n, k]) => row(`icon-unit-${k.key}`, `부대 · ${k.who}`, unitArtUrl(n))),
    ...Object.entries(TRAIN_KEY).map(([n, k]) => row(`icon-train-${k}`, `훈련 · ${n}`, iconArt(`icon-train-${k}`))),
    ...RESOURCES.map((r) => row(`icon-res-${RES_KEY[r]}`, `자원 · ${r}`, resArtUrl(r))),
    ...PIONEER_ISLANDS.map((p) => row(`island-${p.id.replace(/^p-/, '')}`, `분쟁 지역 · ${p.name}`, islandArtUrl(p.id))),
    ...moreSlots().map((x) => row(x.key, x.who, iconArt(x.key))),
  ];
}

/** 부처 청사 그림 이름표(11-25): 1단계 icon-min-<id>, 2~5단계 icon-min-<id>-<단계> */
export const minArtKey = (id: string, lv: number) => (lv <= 1 ? `icon-min-${id}` : `icon-min-${id}-${lv}`);
/** 그 단계 그림, 없으면 아래 단계 중 가장 높은 그림. [주소, 그림 단계] */
export function minArtAt(id: string, lv: number): [string, number] | null {
  for (let l = lv; l >= 1; l--) {
    const u = iconArt(minArtKey(id, l));
    if (u) return [u, l];
  }
  return null;
}

/* ───────── 금고·연구·체제·시설 그림 칸 (11/23) ───────── */

/** 그림이 있으면 그림, 없으면 이모지. 아무 이름표에나 씀 */
export function ArtIcon({ k, emoji, alt = '', cls = '' }: { k: string; emoji: ReactNode; alt?: string; cls?: string }): ReactNode {
  const url = iconArt(k);
  return url ? <Img url={url} alt={alt} cls={cls} /> : <>{emoji}</>;
}

/** 금고 칸 10개 → icon-vault-<key> */
export const VAULT_KEY = {
  '나라 예산': 'budget', 국방예산: 'budget', 국방비: 'power', 병력: 'troops', 봉급: 'salary', 도시: 'cities', 전투력: 'power',
  외교: 'diplo', '자원 값어치': 'stock', '무역 계약': 'trade', 시설: 'facility', '정보 · 신뢰': 'intel',
} as const;
export type VaultName = keyof typeof VAULT_KEY;
export const vaultArtUrl = (n: VaultName): string | null => iconArt(`icon-vault-${VAULT_KEY[n]}`);

/** 연구 → icon-tech-<연구 id>(예: icon-tech-m-drone), 시대 → icon-era-<1~4> */
export const techArtKey = (id: string) => `icon-tech-${id}`;
export const eraArtKey = (era: number) => `icon-era-${era}`;

/** 체제 → icon-gov-<id>, 정책 카드 → icon-card-<key> */
export const govArtKey = (id: string) => `icon-gov-${id}`;
export const CARD_KEY: Record<string, string> = {
  '군-훈련': 'mil-drill', '군-보급': 'mil-supply', '군-징집': 'mil-conscript', '군-해병': 'mil-marine',
  '군-조종': 'mil-pilot', '군-방위': 'mil-defense', '군-동원': 'mil-mobilize', '군-정예': 'mil-elite',
  '경-세금': 'eco-tax', '경-광산': 'eco-mine', '경-개척': 'eco-develop', '경-도시': 'eco-urban',
  '경-상회': 'eco-port', '경-학자': 'eco-scholar', '경-복지': 'eco-ration', '경-연방': 'eco-invest',
  '외-사절': 'dip-envoy', '외-친선': 'dip-goodwill', '외-정보': 'dip-intel', '외-불가침': 'dip-border',
  '외-방위': 'dip-alliance', '외-회의': 'dip-lobby', '외-방송': 'dip-broadcast', '외-연방': 'dip-friendship',
  // 11-23 새 카드 12장
  '군-첩보': 'mil-spy', '군-예비': 'mil-reserve', '군-보훈': 'mil-veterans', '군-기동': 'mil-rapid',
  '경-조세': 'eco-taxreform', '경-관세': 'eco-tariff', '경-채굴': 'eco-mining', '경-산업': 'eco-industry',
  '외-문화': 'dip-culture', '외-동맹': 'dip-pact', '외-원조': 'dip-aid', '외-중재': 'dip-mediate',
};
export const cardArtKey = (id: string) => `icon-card-${CARD_KEY[id] ?? id}`;

/** 시설 → fac-<key>-<단계>.webp (단계마다 다른 그림) */
export const BUILDING_KEY: Record<string, string> = {
  군수공장: 'arms', 제련소: 'smelter', 첨단공단: 'hitech',
  철도망: 'rail', 군항: 'port', 공군기지: 'airbase',
  징병소: 'draft', 군병원: 'hospital', 치안청: 'police',
  국방과학연구소: 'lab', 정보본부: 'intel', 우주기지: 'space',
  방공포대: 'airdef', 훈련소: 'camp', 비축창고: 'depot',
  반도체팹: 'fab', 석유화학단지: 'petro', 조선소: 'shipyard', 항공우주단지: 'aerospace',
  발전소: 'power', 고속도로망: 'highway', 국제무역항: 'tradeport', 정보통신망: 'telecom',
  공공주택단지: 'housing', 국립대학교: 'univ', 문화체육센터: 'sports', 보훈복지관: 'veterans',
  기초과학연구원: 'basicsci', 원자력연구원: 'nuclear', 인공지능센터: 'ai', 해양과학기지: 'ocean',
};
/** 그 단계 그림 → 없으면 아래 단계 그림 → 없으면 위 단계 그림 → 없으면 null */
export function facilityArtUrl(id: string, level: number, max = 5): string | null {
  const k = BUILDING_KEY[id];
  if (!k) return null;
  const lv = Math.max(1, level);
  for (let l = lv; l >= 1; l--) {
    const u = iconArt(`fac-${k}-${l}`);
    if (u) return u;
  }
  for (let l = lv + 1; l <= max; l++) {
    const u = iconArt(`fac-${k}-${l}`);
    if (u) return u;
  }
  return null;
}
/** 시설 그림만 정확히 그 단계(설정 화면·단계 미리보기용) */
export const facilityArtExact = (id: string, level: number): string | null => iconArt(`fac-${BUILDING_KEY[id]}-${level}`);

/** 금고·연구·시대·체제·카드·시설(단계별) 칸 목록 */
function moreSlots(): Array<{ key: string; who: string }> {
  return [
    ...(Object.keys(VAULT_KEY) as VaultName[]).map((n) => ({ key: `icon-vault-${VAULT_KEY[n]}`, who: `금고 · ${n}` })),
    ...TECHS.map((t) => ({ key: techArtKey(t.id), who: `연구 · ${t.name}` })),
    ...[1, 2, 3, 4].map((e) => ({ key: eraArtKey(e), who: `시대 · ${ERAS[e as 1].name}` })),
    ...GOVS.map((g) => ({ key: govArtKey(g.id), who: `체제 · ${g.name}` })),
    ...CARDS.map((c) => ({ key: cardArtKey(c.id), who: `정책 카드 · ${c.name}` })),
    ...BUILDINGS.flatMap((b) => [1, 2, 3, 4, 5].map((lv) => ({ key: `fac-${BUILDING_KEY[b.id]}-${lv}`, who: `시설 · ${b.id} ${lv}단계` }))),
    ...MINISTRIES.flatMap((m) => [1, 2, 3, 4, 5].map((lv) => ({ key: minArtKey(m.id, lv), who: `부처 · ${m.name} ${lv}단계` }))),
  ];
}
