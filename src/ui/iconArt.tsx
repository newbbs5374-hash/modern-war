// 부대·훈련·분쟁 섬 아이콘 그림 칸. 대장이 만든 그림을 src/assets/icons/ 에 정해진 이름으로 넣으면 바로 바뀜.
// 순서: 아이콘 그림(icons/) → 지도 전투 말 그림(field/, 있으면) → 지금 이모지.
// 목록과 GPT 명령문은 src/assets/icons/README.md (= /mnt/project-files/guides/icon-art-prompts.md)
import type { ReactNode } from 'react';
import { EXCLUSIVES, specialById } from '../data/specials';
import { PIONEER_ISLANDS } from '../data/hexmap';
import { RESOURCES, RES_ICON, type Res } from '../data/economy';
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

/** 분쟁 섬 그림 주소(island-<id 앞 p- 뺀 이름>, 예: island-whale) */
export const islandArtUrl = (id: string): string | null => iconArt(`island-${id.replace(/^p-/, '')}`);

/** 분쟁 섬 아이콘: 섬 그림 + 구석에 작은 표(1등 나라 깃발 또는 자원). 그림이 없으면 표만 */
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
    ...PIONEER_ISLANDS.map((p) => row(`island-${p.id.replace(/^p-/, '')}`, `분쟁 섬 · ${p.name}`, islandArtUrl(p.id))),
  ];
}
