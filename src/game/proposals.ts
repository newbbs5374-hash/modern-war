// 장관·참모·장군·부관의 건의(11-25 대장 요청 1번).
// 자리에 앉은 사람이 몇 시간마다 자기 분야에 맞는 발전 방안을 올림. 실제 도시 상황(민심·빈 구역·없는 시설)을 보고 고름.
// 받아들이면 그 도시가 알맞은 칸을 스스로 골라 짓고, 돈·자원이 모자라면 '도시 개발 계획'에 올려 두었다가 모이는 대로 지음.
// 어느 나라로 해도 똑같이 돌아가게 도시는 citiesOf(내 나라)로만 고름.
import { DISTRICTS, districtById, type DistrictId } from '../data/civ';
import { ministryById, type MinistryId, type Trait } from '../data/cabinet';
import { BUILDINGS, type BuildingId } from '../data/economy';
import { GOV_FACILITIES, GOV_FAC_SCALE, govFacById, govFacCost } from '../data/govFacilities';
import type { MarkKind } from '../data/krCities';
import { NEEDS } from '../data/needs';
import { postById, type PostId } from '../data/staff';
import { cityById, isCoastalCity } from '../data/cities';
import { hexKey } from '../data/hexmap';
import { adjCount, buildDistrict, canDistrict, canUpgradeMark, cityCiv, markAt, terrainOf, cityMarks, cityTiles, markCostOf, markLevel, upgradeMark } from './civ';
import { canUpgrade, upgradeCost, upgradeFacility } from './economy';
import { buildGovFac, canBuildGovFac, govFacCity, govFacLevel } from './govFac';
import { fitPct, minLevel, type Person } from './cabinet';
import { canTask, canUpMinistry, minUpCost, startTask, upMinistry } from './cabinetOps';
import { loyaltyOf } from './loyal';
import { note } from './officer';
import { tone } from './advice';
import { Rng } from './rng';
import type { GameState } from './state';
import { citiesOf, eul } from './world';

const H = 3600_000;
/** 한 사람이 다음 건의를 올리기까지 실제 3~6시간 */
export const PROP_GAP: [number, number] = [3 * H, 6 * H];
/** 건의는 실제 하루 동안 기다림 */
export const PROP_TTL = 24 * H;
/** 한꺼번에 쌓이는 건의 수 */
export const PROP_MAX = 8;
/** 대화에서 "건의할 것 있나요?"로 바로 듣기: 사람마다 실제 1시간에 한 번 */
export const ASK_GAP = H;
/** 계획에 올려 둘 수 있는 수 */
export const PLAN_MAX = 12;
/** 받아들이면 충성 +3, 미루면 −1(충직·신중파는 0) */
export const ACCEPT_LOYAL = 3;

export type PropAct =
  | { kind: 'district'; city: string; id: DistrictId }
  | { kind: 'mark'; city: string; id: string }
  | { kind: 'govfac'; id: string }
  | { kind: 'facility'; id: BuildingId }
  | { kind: 'minup'; min: MinistryId }
  | { kind: 'task'; min: MinistryId; task: string };

export interface Proposal {
  id: number;
  /** 'p:<인물 번호>' 내각 사람 · 'g:<번호>' 장군 · 'a:<번호>' 부관 */
  who: string;
  whoName: string;
  role: string;
  /** 어느 부처 화면에 보일지(장군·부관은 국방부) */
  min: MinistryId;
  act: PropAct;
  /** 건의 말(성향 말투) */
  text: string;
  /** 왜 필요한지 */
  why: string;
  atMs: number;
  untilMs: number;
}
export interface CityPlan {
  id: number;
  act: PropAct;
  who: string;
  whoName: string;
  title: string;
  sinceMs: number;
}
export interface PropState {
  seed: number;
  seq: number;
  list: Proposal[];
  plans: CityPlan[];
  /** 사람 → 다음 건의 시각 */
  next: Record<string, number>;
  /** 사람 → 대화에서 마지막으로 건의를 물은 시각 */
  asked: Record<string, number>;
  /** 알아서 하게 맡긴 사람(건의를 바로 받아들임) */
  trusted: string[];
  /** 받아들인·미룬 수(보고용) */
  yes: number;
  no: number;
  log: string[];
}

export const propOf = (s: GameState): PropState =>
  s.props ?? {
    seed: 9173 + (s.worldMs % 9973),
    seq: 1,
    list: [],
    plans: [],
    next: {},
    asked: {},
    trusted: [],
    yes: 0,
    no: 0,
    log: [],
  };

/* ───────── 건의하는 사람 ───────── */

type Tag = 'mil' | 'sci' | 'people' | 'econ' | 'org';
interface Plan {
  d?: DistrictId[];
  b?: BuildingId[];
  m?: MarkKind[];
}
/** 부처마다 건의할 거리(구역·나라 시설·도시 실제 시설). 소속 시설·청사·업무는 모든 부처 공통 */
const MIN_PLAN: Partial<Record<MinistryId, Plan>> = {
  mnd: {
    d: ['airfield', 'arms', 'adl', 'missile'],
    b: ['방공포대', '훈련소', '비축창고'],
    m: ['army', 'air', 'navy'],
  },
  nis: { d: ['cyber'], b: ['정보본부'], m: ['intel'] },
  mofa: { b: ['국제무역항'] },
  mof: { d: ['industry'], b: ['군수공장', '석유화학단지'], m: ['bank'] },
  moti: {
    d: ['industry'],
    b: ['제련소', '첨단공단', '반도체팹', '석유화학단지', '조선소', '항공우주단지'],
    m: ['industry', 'energy'],
  },
  mois: { d: ['housing'], b: ['치안청'], m: ['gov'] },
  mohw: { d: ['housing'], b: ['군병원', '공공주택단지', '보훈복지관'] },
  msit: {
    d: ['lab', 'drone', 'aero'],
    b: ['기초과학연구원', '인공지능센터', '원자력연구원', '국방과학연구소', '우주기지', '정보통신망'],
    m: ['lab'],
  },
  kocis: { b: ['문화체육센터'], m: ['culture', 'tourism'] },
  moj: { b: ['치안청'] },
  moe: { d: ['lab'], b: ['국립대학교'], m: ['univ'] },
  molit: {
    d: ['housing', 'industry', 'airfield'],
    b: ['철도망', '고속도로망', '발전소', '공공주택단지'],
    m: ['airport', 'port'],
  },
  mofs: {
    d: ['harbor', 'shipyard'],
    b: ['군항', '국제무역항', '해양과학기지', '조선소'],
    m: ['port', 'shipyard'],
  },
  moel: { d: ['industry'], b: ['징병소'] },
  mafra: { m: ['nature'] },
  mcee: { b: ['발전소', '원자력연구원'], m: ['energy', 'nature'] },
  mss: { d: ['industry'] },
  mpva: { b: ['보훈복지관'] },
  mogef: { d: ['housing'] },
  mcst: { b: ['문화체육센터'], m: ['culture', 'tourism'] },
};
/** 대통령실 참모·총리 → 같이 보는 부처 */
const POST_MIN: Partial<Record<PostId, MinistryId>> = {
  pm: 'mois',
  policy: 'molit',
  econ: 'mof',
  social: 'mohw',
  sci: 'msit',
  nsa: 'mnd',
  nsa1: 'mofa',
  nsa2: 'mnd',
  chief: 'mois',
};
const GEN_PLAN: Record<string, Plan> = {
  합참: { d: ['missile', 'adl'], b: ['방공포대', '우주기지'], m: ['army'] },
  육군: { d: ['arms', 'adl'], b: ['철도망', '훈련소'], m: ['army'] },
  해군: {
    d: ['harbor', 'shipyard'],
    b: ['군항', '조선소'],
    m: ['navy', 'shipyard'],
  },
  공군: {
    d: ['airfield', 'aero'],
    b: ['공군기지', '항공우주단지', '방공포대'],
    m: ['air', 'airport'],
  },
  정보: { d: ['cyber'], b: ['정보본부'], m: ['intel'] },
  군수: { d: ['industry'], b: ['비축창고', '제련소'], m: ['industry'] },
};
const AIDE_PLAN: Record<string, Plan> = {
  저격: { d: ['arms'], b: ['훈련소', '철도망'], m: ['army'] },
  의무: { d: ['housing'], b: ['군병원', '징병소'], m: ['army'] },
  통신: { d: ['cyber', 'airfield'], b: ['정보통신망', '공군기지'], m: ['intel', 'air'] },
  공병: { d: ['industry', 'harbor'], b: ['고속도로망', '비축창고', '군항'], m: ['navy'] },
  정찰: { d: ['airfield'], b: ['정보본부', '공군기지'], m: ['air', 'intel'] },
};
const GEN_STYLE_TRAIT: Record<string, Trait> = {
  공격적: '강경파',
  신중함: '신중파',
  기동형: '현장형',
};

export interface Speaker {
  key: string;
  name: string;
  role: string;
  trait: Trait;
  min: MinistryId;
  /** 상황을 잘 보는 정도 0.3~0.95(높으면 정말 급한 것을 짚음) */
  sense: number;
  loyalty: number;
  plan: Plan;
  /** 건의할 소속 시설 */
  facs: string[];
  /** 청사·업무를 건의할 부처(장관만) */
  own?: MinistryId;
  kind: 'p' | 'g' | 'a';
  person?: Person;
}

function facsFor(min: MinistryId | null, post: PostId | null): string[] {
  return GOV_FACILITIES.filter((f) => (post ? 'post' in f.owner && f.owner.post === post : 'min' in f.owner && f.owner.min === min)).map((f) => f.id);
}

/** 건의하는 사람 모두(장관 · 청장·참모 · 장군 · 부관) */
export function speakers(s: GameState): Speaker[] {
  const out: Speaker[] = [];
  const c = s.cabinet;
  if (c)
    for (const p of c.people) {
      if (p.group !== '내각') continue;
      if (p.seat?.kind === 'min') {
        const m = ministryById(p.seat.id);
        out.push({
          key: `p:${p.id}`,
          name: p.name,
          role: `${m.name} ${m.kind === '처' ? '처장' : '장관'}`,
          trait: p.trait,
          min: m.id,
          sense: senseOf(fitPct(p, NEEDS[m.id], m.spec)),
          loyalty: p.loyalty,
          plan: MIN_PLAN[m.id] ?? {},
          facs: facsFor(m.id, null),
          own: m.id,
          kind: 'p',
          person: p,
        });
      } else if (p.post) {
        const post = postById(p.post);
        const min = post.parent ?? POST_MIN[p.post];
        if (!min) continue;
        out.push({
          key: `p:${p.id}`,
          name: p.name,
          role: post.name,
          trait: p.trait,
          min,
          sense: senseOf(fitPct(p, NEEDS[p.post] ?? NEEDS[min], post.spec)),
          loyalty: p.loyalty,
          plan: post.parent ? {} : (MIN_PLAN[min] ?? {}),
          facs: post.parent ? facsFor(null, p.post) : [],
          kind: 'p',
          person: p,
        });
      }
    }
  for (const g of s.officer.generals)
    out.push({
      key: `g:${g.id}`,
      name: g.name,
      role: `${g.field} 장군`,
      trait: GEN_STYLE_TRAIT[g.style] ?? '현장형',
      min: 'mnd',
      sense: Math.min(0.95, 0.3 + g.skill * 0.065),
      loyalty: g.loyalty,
      plan: GEN_PLAN[g.field] ?? {},
      facs: [],
      kind: 'g',
    });
  for (const a of s.officer.aides)
    out.push({
      key: `a:${a.id}`,
      name: a.name,
      role: `${a.specialty} 부관`,
      trait: '충직',
      min: 'mnd',
      sense: Math.min(0.9, 0.35 + a.level * 0.05),
      loyalty: loyaltyOf(a),
      plan: AIDE_PLAN[a.specialty] ?? {},
      facs: [],
      kind: 'a',
    });
  return out;
}
const senseOf = (fit: number) => Math.max(0.3, Math.min(0.95, 0.2 + fit / 120));
export const speakerOf = (s: GameState, key: string) => speakers(s).find((x) => x.key === key) ?? null;

/* ───────── 건의 거리 고르기 ───────── */

/** 돈·자원·경험치·공사만 모자란 것(기다리면 할 수 있는 것) */
const WAIT = /국방예산|개 필요|경험치|공사 중/;
const okOrWait = (why: string | null) => why === null || WAIT.test(why);
const won = (v: number) => (v >= 10000 ? `${Math.round(v / 1000) / 10}만` : `${Math.round(v / 100) / 10}천`);

/** 구역 이름(국방부·공군이 말하는 비행장은 '군 공항') */
function dName(id: DistrictId, sp?: Speaker): string {
  if (id === 'airfield' && sp && (sp.min === 'mnd' || sp.role.startsWith('공군'))) return '군 공항';
  if (id === 'housing') return '주거 구역';
  return districtById(id).name;
}

/** 구역을 지을 가장 좋은 칸(옆 칸 보너스가 큰 곳). 없으면 null */
export function bestTile(s: GameState, city: string, id: DistrictId): string | null {
  // 도시 단위 조건(연구·주인·바다·구역 수·하나만)이 맞는지 먼저: 맞으면 '칸이 아니에요'가 나옴
  if (canDistrict(s, city, 'x', id) !== '이 도시 칸이 아니에요') return null;
  const cc = cityCiv(s, city);
  const where = districtById(id).where;
  const used = new Set([...cc.districts.map((x) => x.tile), ...(cc.mines ?? []).map((x) => x.tile)]);
  const tiles: Array<{ k: string; v: number }> = [];
  for (const t of cityTiles(city)) {
    if (t.center) continue;
    const k = hexKey(t.q, t.r);
    if (used.has(k) || markAt(city, k)) continue;
    if (where !== '아무 칸') {
      const ter = terrainOf(city, t.q, t.r);
      if (where === '바닷가 칸' && ter !== '바닷가') continue;
      if (where === '평지 칸' && ter !== '평지') continue;
      if (where === '평지·바닷가 칸' && ter !== '평지' && ter !== '바닷가') continue;
    }
    tiles.push({ k, v: adjCount(city, k, id, cc) });
  }
  tiles.sort((x, y) => y.v - x.v);
  for (const t of tiles.slice(0, 5)) if (okOrWait(canDistrict(s, city, t.k, id))) return t.k;
  return null;
}

interface Cand {
  act: PropAct;
  tag: Tag;
  /** 급한 정도 */
  w: number;
  why: string;
}

const MIL_D = new Set<DistrictId>(['airfield', 'arms', 'adl', 'missile', 'harbor', 'shipyard', 'cyber', 'drone', 'aero']);
const SCI_D = new Set<DistrictId>(['lab', 'drone', 'aero', 'cyber', 'adl']);

function candidates(s: GameState, sp: Speaker, rng: Rng): Cand[] {
  const me = s.player.countryId;
  const mine = citiesOf(s.world, me);
  if (!mine.length) return [];
  const out: Cand[] = [];
  const pending = new Set([...propOf(s).list, ...propOf(s).plans].map((x) => JSON.stringify(x.act)));
  const add = (c: Cand) => !pending.has(JSON.stringify(c.act)) && out.push(c);
  // 도시는 많아도 몇 곳만 봄(도시 수가 늘어도 가볍게)
  const byLoy = [...mine].sort((a, b) => cityCiv(s, a).loyalty - cityCiv(s, b).loyalty);
  const shuffled = [...mine].sort(() => rng.next() - 0.5);
  const look = (id: DistrictId) => (id === 'housing' ? byLoy.slice(0, 4) : shuffled.slice(0, 6));
  for (const id of sp.plan.d ?? []) {
    const d = DISTRICTS.find((x) => x.id === id);
    if (!d) continue;
    for (const city of look(id)) {
      if ((id === 'harbor' || id === 'shipyard') && !isCoastalCity(city)) continue;
      const tile = bestTile(s, city, id);
      if (!tile) continue;
      const cc = cityCiv(s, city);
      const nm = cityById(city).name;
      let w = 2;
      let why = `${nm}: ${d.text}`;
      if (id === 'housing') {
        w = 1 + Math.max(0, 75 - cc.loyalty) / 6;
        why = `${nm} 민심이 ${Math.round(cc.loyalty)}예요. 집이 늘면 민심 +10 · 인구가 더 늘어요.`;
      } else if (id === 'airfield' || id === 'harbor') {
        const have = mine.some((x) => cityCiv(s, x).districts.some((y) => y.id === id));
        w = have ? 1.5 : 4;
        why = have ? `${nm}에 ${dName(id, sp)}이 있으면 ${id === 'airfield' ? '공군' : '해군'} 모집이 빨라져요.` : `우리 나라엔 아직 ${dName(id, sp)}이 없어요. ${d.text}`;
      } else if (id === 'industry') w = 1.5 + cityById(city).size * 0.4;
      add({
        act: { kind: 'district', city, id },
        tag: MIL_D.has(id) ? (SCI_D.has(id) ? 'sci' : 'mil') : id === 'housing' ? 'people' : id === 'lab' ? 'sci' : 'econ',
        w,
        why,
      });
    }
  }
  for (const id of sp.plan.b ?? []) {
    const st = s.economy.buildings[id];
    if (!st || !okOrWait(canUpgrade(s, id))) continue;
    const b = BUILDINGS.find((x) => x.id === id)!;
    add({
      act: { kind: 'facility', id },
      tag: b.fac === '국방' ? 'mil' : b.fac === '과학' ? 'sci' : b.fac === '복지' ? 'people' : 'econ',
      w: 1.5 + (st.level === 0 ? 1.5 : (5 - st.level) * 0.3),
      why: `${b.icon} ${id} ${st.level ? `${st.level}→${st.level + 1}단계` : '새로 짓기'}: ${b.does}`,
    });
  }
  for (const kind of sp.plan.m ?? []) {
    for (const city of shuffled.slice(0, 8)) {
      for (const lm of cityMarks(city)) {
        if (lm.kind !== kind || !okOrWait(canUpgradeMark(s, city, lm.id))) continue;
        const lv = markLevel(s, city, lm.id);
        add({
          act: { kind: 'mark', city, id: lm.id },
          tag: ['army', 'navy', 'air', 'shipyard', 'intel'].includes(kind) ? 'mil' : kind === 'lab' || kind === 'univ' ? 'sci' : ['culture', 'tourism', 'nature', 'gov'].includes(kind) ? 'people' : 'econ',
          w: 1.2 + (lv === 0 ? 1 : 0),
          why: `${cityById(city).name} ${lm.name}: ${lm.note}`,
        });
      }
    }
  }
  for (const id of sp.facs) {
    const f = govFacById(id);
    if (!f || !okOrWait(canBuildGovFac(s, id))) continue;
    const lv = govFacLevel(s, id);
    add({
      act: { kind: 'govfac', id },
      tag: 'org',
      w: 2.2 + (lv === 0 ? 1.5 : 0) - lv * 0.2,
      why: `${f.icon} ${f.name}(📍${cityById(govFacCity(s, f))?.name ?? ''}) ${GOV_FAC_SCALE[lv]} → ${GOV_FAC_SCALE[lv + 1]}. ${f.text}`,
    });
  }
  if (sp.own) {
    if (okOrWait(canUpMinistry(s, sp.own)))
      add({
        act: { kind: 'minup', min: sp.own },
        tag: 'org',
        w: 2,
        why: `청사를 ${minLevel(s.cabinet, sp.own) + 1}단계로 키우면 부처 힘이 커져요.`,
      });
    if (!canTask(s, sp.own)) {
      const m = ministryById(sp.own);
      const t = m.tasks[Math.floor(rng.next() * m.tasks.length)];
      if (t)
        add({
          act: { kind: 'task', min: sp.own, task: t.id },
          tag: 'org',
          w: 0.8,
          why: `${t.icon} ${t.name}: ${t.text}`,
        });
    }
  }
  return out;
}

/** 성향이 좋아하는 건의 */
const TRAIT_LIKE: Partial<Record<Trait, Tag>> = {
  강경파: 'mil',
  혁신가: 'sci',
  인기인: 'people',
  실용주의: 'econ',
  신중파: 'org',
  원칙주의: 'org',
  현장형: 'people',
  냉철: 'mil',
  야심: 'econ',
};

/** 건의 말 */
export function actTitle(s: GameState, act: PropAct, sp?: Speaker): string {
  switch (act.kind) {
    case 'district': {
      const nm = cityById(act.city).name;
      const n = cityCiv(s, act.city).districts.filter((x) => x.id === act.id).length;
      return `"${nm}"에 ${eul(dName(act.id, sp))} ${n ? '더 늘려야' : '지어야'} 합니다`;
    }
    case 'mark': {
      const lm = cityMarks(act.city).find((x) => x.id === act.id);
      const lv = markLevel(s, act.city, act.id);
      return `"${cityById(act.city).name}" ${eul(lm?.name ?? '시설')} ${lv ? `${lv + 1}단계로 키워야` : '지어야'} 합니다`;
    }
    case 'govfac': {
      const f = govFacById(act.id)!;
      const lv = govFacLevel(s, act.id);
      return lv ? `${f.name}의 규모를 ${GOV_FAC_SCALE[lv + 1] ?? '더 크게'}(으)로 늘려야 합니다` : `${eul(f.name)} 세워야 합니다`;
    }
    case 'facility': {
      const lv = s.economy.buildings[act.id]?.level ?? 0;
      return lv ? `${eul(act.id)} ${lv + 1}단계로 키워야 합니다` : `${eul(act.id)} 새로 지어야 합니다`;
    }
    case 'minup':
      return `우리 부처 청사를 ${minLevel(s.cabinet, act.min) + 1}단계로 넓혀야 합니다`;
    case 'task':
      return `지금 '${ministryById(act.min).tasks.find((t) => t.id === act.task)?.name ?? '업무'}'에 나서야 합니다`;
  }
}
/** 드는 값(보여 주기용) */
export function actCost(s: GameState, act: PropAct): string {
  switch (act.kind) {
    case 'district': {
      const d = districtById(act.id);
      return `💵${won(d.cost)}${Object.entries(d.res)
        .map(([r, v]) => ` · ${r} ${v}`)
        .join('')} · ${d.hours}시간`;
    }
    case 'mark': {
      const c = markCostOf(act.city, act.id, markLevel(s, act.city, act.id));
      return `💵${won(c.cost)}${Object.entries(c.res)
        .map(([r, v]) => ` · ${r} ${v}`)
        .join('')} · ${c.hours}시간`;
    }
    case 'govfac':
      return `💵${won(govFacCost(govFacLevel(s, act.id)))}`;
    case 'facility': {
      const c = upgradeCost(s, act.id);
      return `💵${won(c.money)} · 경험치 ${c.exp} · ${c.hours}시간`;
    }
    case 'minup': {
      const c = minUpCost(s, act.min);
      return `💵${won(c.money)} · ${c.hours}시간`;
    }
    case 'task':
      return '무료 · 업무 시간만';
  }
}

/** 지금 할 수 있는지(null = 됨). 기다리면 되는 까닭이면 wait: true */
export function actWhy(s: GameState, act: PropAct): { why: string | null; wait: boolean } {
  let why: string | null;
  switch (act.kind) {
    case 'district': {
      const t = bestTile(s, act.city, act.id);
      why = t ? canDistrict(s, act.city, t, act.id) : '지을 칸이 없어요';
      break;
    }
    case 'mark':
      why = canUpgradeMark(s, act.city, act.id);
      break;
    case 'govfac':
      why = canBuildGovFac(s, act.id);
      break;
    case 'facility':
      why = canUpgrade(s, act.id);
      break;
    case 'minup':
      why = canUpMinistry(s, act.min);
      break;
    case 'task':
      why = canTask(s, act.min);
      break;
  }
  return { why, wait: !!why && WAIT.test(why) };
}

/** 실제로 짓기(도시가 칸을 스스로 고름) */
export function runAct(s: GameState, act: PropAct): GameState {
  switch (act.kind) {
    case 'district': {
      const t = bestTile(s, act.city, act.id);
      return t ? buildDistrict(s, act.city, t, act.id) : s;
    }
    case 'mark':
      return upgradeMark(s, act.city, act.id);
    case 'govfac':
      return buildGovFac(s, act.id);
    case 'facility':
      return upgradeFacility(s, act.id);
    case 'minup':
      return upMinistry(s, act.min);
    case 'task':
      return startTask(s, act.min, act.task);
  }
}

/** 한 사람의 건의 하나 만들기(없으면 null). 눈이 밝을수록 가장 급한 것을 고름 */
export function makeProposal(s: GameState, sp: Speaker, rng: Rng, id: number): Proposal | null {
  const cands = candidates(s, sp, rng);
  if (!cands.length) return null;
  const like = TRAIT_LIKE[sp.trait];
  const score = (c: Cand) => c.w * (c.tag === like ? 1.5 : 1);
  const pick = rng.chance(sp.sense) ? [...cands].sort((a, b) => score(b) - score(a))[0] : rng.weighted(cands, (c) => 1 + score(c) * 0.3)!;
  return {
    id,
    who: sp.key,
    whoName: sp.name,
    role: sp.role,
    min: sp.min,
    act: pick.act,
    text: tone(sp.trait, `${actTitle(s, pick.act, sp)}.`),
    why: pick.why,
    atMs: s.worldMs,
    untilMs: s.worldMs + PROP_TTL,
  };
}

/* ───────── 충성 바꾸기(사람 종류마다) ───────── */

const clamp = (v: number) => Math.max(0, Math.min(100, v));
export function bumpLoyal(s: GameState, key: string, v: number): GameState {
  const [k, n] = [key[0], Number(key.slice(2))];
  if (k === 'p' && s.cabinet)
    return {
      ...s,
      cabinet: {
        ...s.cabinet,
        people: s.cabinet.people.map((p) => (p.id === n ? { ...p, loyalty: clamp(p.loyalty + v) } : p)),
      },
    };
  if (k === 'g')
    return {
      ...s,
      officer: {
        ...s.officer,
        generals: s.officer.generals.map((g) => (g.id === n ? { ...g, loyalty: clamp(g.loyalty + v), seenMs: s.worldMs } : g)),
      },
    };
  if (k === 'a')
    return {
      ...s,
      officer: {
        ...s.officer,
        aides: s.officer.aides.map((a) => (a.id === n ? { ...a, loyalty: clamp(loyaltyOf(a) + v), seenMs: s.worldMs } : a)),
      },
    };
  return s;
}

/* ───────── 받아들이기 · 미루기 ───────── */

const plog = (p: PropState, t: string) => (p.log = [t, ...p.log].slice(0, 30));

/** 받아들이기: 바로 지을 수 있으면 공사 시작, 돈이 모자라면 도시 개발 계획에 올림 */
export function acceptProposal(s: GameState, id: number): { state: GameState; text: string } {
  const p0 = propOf(s);
  const pr = p0.list.find((x) => x.id === id);
  if (!pr) return { state: s, text: '' };
  let ns = bumpLoyal(s, pr.who, ACCEPT_LOYAL);
  const p: PropState = {
    ...structuredClone(p0),
    list: p0.list.filter((x) => x.id !== id),
    yes: p0.yes + 1,
  };
  const w = actWhy(ns, pr.act);
  let text: string;
  if (!w.why) {
    ns = runAct(ns, pr.act);
    text = `✅ ${pr.whoName} ${pr.role}의 건의를 받아들였습니다. ${placeLine(ns, pr.act)} 공사를 시작합니다. (충성 +${ACCEPT_LOYAL})`;
  } else if (w.wait && p.plans.length < PLAN_MAX) {
    p.plans.push({
      id: p.seq++,
      act: pr.act,
      who: pr.who,
      whoName: pr.whoName,
      title: actTitle(s, pr.act, speakerOf(s, pr.who) ?? undefined),
      sinceMs: s.worldMs,
    });
    text = `📋 ${pr.whoName} ${pr.role}의 건의를 받아들였습니다. 지금은 ${w.why} — 도시 개발 계획에 올려 두고, 모이는 대로 알아서 짓겠습니다. (충성 +${ACCEPT_LOYAL})`;
  } else {
    text = `⚠️ 받아들였지만 지금은 할 수 없어요: ${w.why ?? '계획이 가득 찼어요'}`;
  }
  plog(p, text);
  return { state: { ...ns, props: p }, text };
}
/** 미루기 */
export function rejectProposal(s: GameState, id: number): GameState {
  const p0 = propOf(s);
  const pr = p0.list.find((x) => x.id === id);
  if (!pr) return s;
  const sp = speakerOf(s, pr.who);
  const cut = sp && (sp.trait === '충직' || sp.trait === '신중파') ? 0 : -1;
  const ns = cut ? bumpLoyal(s, pr.who, cut) : s;
  return {
    ...ns,
    props: { ...p0, list: p0.list.filter((x) => x.id !== id), no: p0.no + 1 },
  };
}
/** 계획 빼기 */
export function dropPlan(s: GameState, id: number): GameState {
  const p = propOf(s);
  return { ...s, props: { ...p, plans: p.plans.filter((x) => x.id !== id) } };
}
/** 알아서 하게 맡기기(그 사람 건의는 바로 받아들임) */
export function setTrusted(s: GameState, key: string, on: boolean): GameState {
  const p = propOf(s);
  const trusted = on ? [...new Set([...p.trusted, key])] : p.trusted.filter((x) => x !== key);
  return { ...s, props: { ...p, trusted } };
}

/** 어디에 짓는지 한 줄 */
function placeLine(s: GameState, act: PropAct): string {
  switch (act.kind) {
    case 'district':
      return `${cityById(act.city).name}이(가) 알맞은 칸을 골라 ${districtById(act.id).name}`;
    case 'mark':
      return `${cityById(act.city).name} ${cityMarks(act.city).find((x) => x.id === act.id)?.name ?? ''}`;
    case 'govfac': {
      const f = govFacById(act.id)!;
      return `${cityById(govFacCity(s, f))?.name ?? ''} ${f.name}`;
    }
    case 'facility':
      return act.id;
    case 'minup':
      return `${ministryById(act.min).name} 청사`;
    case 'task':
      return `${ministryById(act.min).name} 업무`;
  }
}

/** 대화에서 "건의할 것 있나요?": 바로 하나 듣기 */
export function canAsk(s: GameState, key: string): string | null {
  const p = propOf(s);
  if (p.list.some((x) => x.who === key)) return '이미 올린 건의가 있어요';
  const at = p.asked[key] ?? -Infinity;
  if (s.worldMs - at < ASK_GAP) return `${Math.ceil((ASK_GAP - (s.worldMs - at)) / 60000)}분 뒤에 다시 물어보세요`;
  return null;
}
export function askProposal(s: GameState, key: string): { state: GameState; prop: Proposal | null } {
  const sp = speakerOf(s, key);
  if (!sp || canAsk(s, key)) return { state: s, prop: null };
  const p = structuredClone(propOf(s));
  const rng = new Rng(p.seed);
  const pr = makeProposal(s, sp, rng, p.seq);
  p.seed = rng.seed;
  p.asked[key] = s.worldMs;
  if (pr) {
    p.seq++;
    p.list.push(pr);
    p.next[key] = s.worldMs + rng.range(...PROP_GAP);
  }
  return { state: { ...s, props: p }, prop: pr };
}

/* ───────── 시간이 흐를 때 ───────── */

/** 실제 15분마다: 기한 지난 건의 정리 · 새 건의 · 맡긴 사람 건의 바로 받기 · 계획 공사 */
export function propTick(s: GameState): GameState {
  if (!s.cabinet && !s.officer.generals.length && !s.officer.aides.length) return s;
  let p = structuredClone(propOf(s));
  const rng = new Rng(p.seed);
  const sps = speakers(s);
  const alive = new Set(sps.map((x) => x.key));
  p.list = p.list.filter((x) => x.untilMs > s.worldMs && alive.has(x.who));
  const notes: string[] = [];
  let ns: GameState = s;
  for (const sp of sps) {
    if (p.list.length >= PROP_MAX) break;
    const at = p.next[sp.key];
    if (at === undefined) {
      // 처음 자리에 앉으면 1~3시간 뒤 첫 건의
      p.next[sp.key] = s.worldMs + rng.range(1 * H, 3 * H);
      continue;
    }
    if (s.worldMs < at || p.list.some((x) => x.who === sp.key)) continue;
    p.next[sp.key] = s.worldMs + rng.range(...PROP_GAP);
    const pr = makeProposal(ns, sp, rng, p.seq);
    if (!pr) continue;
    p.seq++;
    p.list.push(pr);
    if (p.trusted.includes(sp.key)) {
      const r = acceptProposal({ ...ns, props: p }, pr.id);
      ns = r.state;
      p = structuredClone(propOf(ns));
      notes.push(`🤝 맡겨 둔 ${sp.name} ${sp.role}: ${r.text.replace(/^[^ ]+ /, '')}`);
    } else notes.push(`📨 ${sp.name} ${sp.role}의 건의: ${actTitle(ns, pr.act, sp)}`);
  }
  // 도시 개발 계획: 돈·자원이 모이면 알아서 공사(한 번에 2건까지)
  let built = 0;
  for (const plan of [...p.plans]) {
    if (built >= 2) break;
    const w = actWhy(ns, plan.act);
    if (!w.why) {
      ns = runAct(ns, plan.act);
      p.plans = p.plans.filter((x) => x.id !== plan.id);
      built++;
      notes.push(`🏗️ 도시 개발 계획: ${placeLine(ns, plan.act)} 공사를 시작했어요(${plan.whoName} 건의).`);
    } else if (!w.wait) {
      p.plans = p.plans.filter((x) => x.id !== plan.id);
      notes.push(`🗑️ 도시 개발 계획에서 뺐어요: ${plan.title.replace(/"/g, '')} — ${w.why}`);
    }
  }
  p.seed = rng.seed;
  for (const t of notes) plog(p, t);
  ns = { ...ns, props: p };
  if (notes.length) {
    ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
    for (const t of notes) note(ns, t);
  }
  return ns;
}

/** 부처 화면에 보일 건의(부처 묶음) */
export const propsFor = (s: GameState, mins: MinistryId[]) => propOf(s).list.filter((x) => mins.includes(x.min));
export const propsOfWho = (s: GameState, key: string) => propOf(s).list.filter((x) => x.who === key);
/** 사람 열쇠 */
export const keyOfPerson = (p: Person) => `p:${p.id}`;
