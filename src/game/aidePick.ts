// 부관 임명(11-24 대장 지시): 조건 없이, 병과마다 특화된 후보 여러 명 중에서 골라 임명.
// - 병과 = 부관 전문 분야 5가지(저격·의무·통신·공병·정찰), 병과마다 후보 4명(성향이 모두 다름)
// - 후보는 실제 12시간마다 새로 바뀜. 임명은 돈·레벨·시간 조건 없음. 자리가 꽉 차면 한 명과 바꿈
// - 얼굴은 나라별 얼굴(faces.ts)을 쓰고, 이름도 내 나라 이름표에서 뽑음
import { AIDE_SPECIALTIES, aideSlots, type AideSpecialty } from '../data/officers';
import { KR_NAMED_YOUNG, deckSize, faceFile, faceTag, youngFile, youngReady, youngSize } from '../data/faces';
import { makeNameEth } from '../data/names';
import { cabinetOf } from './cabinet';
import { note, withOfficer, type Aide, type OfficerState } from './officer';
import { Rng } from './rng';
import type { GameState } from './state';

const H = 3600e3;
/** 후보가 바뀌는 간격(실제 시간) */
export const CAND_EVERY_MS = 12 * H;
export const CANDS_PER_BRANCH = 4;

/** 후보 성향: 시작 레벨·인연·충성이 달라짐 */
export type AideTrait = '노련' | '충직' | '친화' | '유망';
export const AIDE_TRAITS: Record<AideTrait, { icon: string; text: string; level: number; bond: number; loyalty: number }> = {
  노련: { icon: '🎖️', text: '경험 많은 베테랑. 처음부터 레벨이 높아 전투에 바로 강해요', level: 3, bond: 10, loyalty: 45 },
  충직: { icon: '🫡', text: '명령에 충실함. 처음부터 충성이 높아 쉽게 떠나지 않아요', level: 1, bond: 15, loyalty: 75 },
  친화: { icon: '💗', text: '사람을 잘 따름. 처음부터 인연이 깊어 이야기·보너스가 빨리 열려요', level: 1, bond: 35, loyalty: 50 },
  유망: { icon: '🌱', text: '두루 고른 신예. 레벨·인연·충성이 모두 중간이에요', level: 2, bond: 22, loyalty: 58 },
};
const TRAIT_ORDER: AideTrait[] = ['노련', '충직', '친화', '유망'];

/** 병과마다 경력 한 줄(후보마다 하나씩) */
export const AIDE_CAREERS: Record<AideSpecialty, string[]> = {
  저격: ['특수전 저격팀 12년, 장거리 사격 대회 우승', '해병 수색대 저격수 출신', '사격 국가대표에서 군에 들어온 명사수', '대테러 부대 저격 교관', '산악 저격 소대장 출신'],
  의무: ['야전병원 외과 군의관 출신', '해외 파병 의무대장', '응급구조 부사관 15년', '화생방 의무 교관', '군 병원 응급실장 출신'],
  통신: ['사이버작전 부대 출신', '위성통신 대대 운용 장교', '합참 상황실 당직 장교 8년', '전자전 부대 분석관', '전술 데이터링크 개발 장교'],
  공병: ['폭발물 처리반 팀장(지뢰 제거 전문)', '교량·진지 건설 공병대대장', '건설 기술자 출신 예비역 장교', '방호 시설 설계 담당관', '도하 작전 공병 중대장 출신'],
  정찰: ['특수정찰대 침투조 출신', '무인기 정찰대 운용관', '국경 수색대 팀장', '정보사령부 현장 요원', '야간 정찰 교관'],
};

export interface AideCand {
  /** 이번 후보 묶음 안에서의 이름표(period-번호) */
  key: string;
  name: string;
  specialty: AideSpecialty;
  trait: AideTrait;
  sex: 'm' | 'f';
  age: number;
  eth?: string;
  faceKey: string;
  level: number;
  bond: number;
  loyalty: number;
  career: string;
}

export interface AidePickState {
  /** 이미 임명한 후보 이름표(같은 묶음에서 다시 안 나오게) */
  hired: string[];
  /** 후보를 새로 받은 횟수(새로 받기를 누르면 늘어남) */
  reroll?: number;
  /** 새로 받기를 쓴 묶음 번호 · 그 묶음에서 쓴 횟수 */
  rerollPeriod?: number;
  rerollUsed?: number;
}
const pickOf = (o: OfficerState): AidePickState => o.aidePick ?? { hired: [] };

export const candPeriod = (worldMs: number) => Math.floor(worldMs / CAND_EVERY_MS);
/** 다음 후보 교체까지 남은 시간(ms) */
export const candLeftMs = (worldMs: number) => (candPeriod(worldMs) + 1) * CAND_EVERY_MS - worldMs;

const mixSeed = (...xs: number[]) => xs.reduce((h, x) => (Math.imul(h ^ (x >>> 0), 2654435761) + 0x9e3779b9) >>> 0, 0x1234567);
const strNum = (t: string) => [...t].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/** 이미 쓰고 있는 얼굴 수(내 나라 사람·부관) */
function faceUse(s: GameState): Map<string, number> {
  const m = new Map<string, number>();
  const add = (k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const p of cabinetOf(s).people) if (p.face !== undefined) add(faceFile(faceTag(p.country, p.eth), p.sex, p.face));
  for (const a of s.officer.aides) if (a.faceKey) add(a.faceKey);
  for (const g of s.officer.generals) if (g.faceKey) add(g.faceKey);
  for (const r of s.officer.rivals) if (r.faceKey) add(r.faceKey);
  return m;
}

/** 젊은 얼굴(부관용) 중 안 쓴 것 하나. 없으면 null */
function pickYoung(use: Map<string, number>, tag: string, sex: 'm' | 'f', rng: Rng): string | null {
  const files = Array.from({ length: youngSize(tag, sex) }, (_, i) => youngFile(tag, sex, i)).filter((f) => !use.get(f));
  if (!files.length) return null;
  const f = rng.pick(files);
  use.set(f, 1);
  return f;
}
const youngFree = (use: Map<string, number>, tag: string, sex: 'm' | 'f') => Array.from({ length: youngSize(tag, sex) }, (_, i) => youngFile(tag, sex, i)).filter((f) => !use.get(f)).length;

/** 가장 덜 쓴 얼굴 하나 고르기(고른 얼굴은 use에 더함) */
function pickFace(use: Map<string, number>, tag: string, sex: 'm' | 'f', rng: Rng): string {
  const n = deckSize(tag, sex);
  const files = Array.from({ length: n }, (_, i) => faceFile(tag, sex, i));
  const min = Math.min(...files.map((f) => use.get(f) ?? 0));
  const free = files.filter((f) => (use.get(f) ?? 0) === min);
  const f = rng.pick(free);
  use.set(f, (use.get(f) ?? 0) + 1);
  return f;
}

/** 후보 한 명 만들기 */
function makeCand(s: GameState, rng: Rng, specialty: AideSpecialty, trait: AideTrait, key: string, taken: Set<string>, use: Map<string, number>, careerIdx: number): AideCand {
  const country = s.player.countryId;
  let sex: 'm' | 'f' = rng.chance(0.35) ? 'f' : 'm';
  let nm = makeNameEth(country, sex, rng, taken);
  let faceKey: string | null = null;
  // 11-24 대장 "부관들은 젊은 나이의 인물로": 젊은 얼굴이 있는 나라는 젊은 얼굴(장관 얼굴과 안 겹침), 그 성별이 다 찼으면 다른 성별
  if (youngReady(country)) {
    for (let k = 0; k < 8 && !faceKey; k++) {
      if (k === 4) sex = sex === 'm' ? 'f' : 'm';
      if (k > 0) nm = makeNameEth(country, sex, rng, taken);
      if (youngFree(use, faceTag(country, nm.eth), sex) > 0) faceKey = pickYoung(use, faceTag(country, nm.eth), sex, rng);
    }
  }
  const { name, eth } = nm;
  taken.add(name);
  const t = AIDE_TRAITS[trait];
  const jig = () => Math.round(rng.range(-4, 4));
  return {
    key,
    name,
    specialty,
    trait,
    sex,
    age: faceKey ? Math.round(rng.range(25, 36)) : Math.round(rng.range(28, 39)),
    eth,
    faceKey: faceKey ?? pickFace(use, faceTag(country, eth), sex, rng),
    level: t.level + (trait === '노련' && rng.chance(0.4) ? 1 : 0),
    bond: Math.max(5, t.bond + jig()),
    loyalty: Math.max(30, Math.min(90, t.loyalty + jig())),
    career: AIDE_CAREERS[specialty][careerIdx % AIDE_CAREERS[specialty].length],
  };
}

/** 지금 볼 수 있는 후보(병과마다 4명, 이미 임명한 사람은 빠짐). 상태를 바꾸지 않음 */
export function aideCandidates(s: GameState): AideCand[] {
  const o = s.officer;
  const ps = pickOf(o);
  const period = candPeriod(s.worldMs);
  const rng = new Rng(mixSeed(period, strNum(s.player.countryId), strNum(s.player.name ?? ''), ps.reroll ?? 0, 0xa1de));
  const taken = new Set<string>([...o.aides.map((a) => a.name), ...o.generals.map((g) => g.name), ...o.rivals.map((r) => r.name), ...cabinetOf(s).people.map((p) => p.name)]);
  const use = faceUse(s);
  const out: AideCand[] = [];
  AIDE_SPECIALTIES.forEach((sp, si) => {
    const start = Math.floor(rng.next() * 5);
    TRAIT_ORDER.forEach((tr, ti) => {
      const key = `${period}.${ps.reroll ?? 0}-${si}${ti}`;
      const c = makeCand(s, rng, sp, tr, key, taken, use, start + ti);
      if (!ps.hired.includes(key)) out.push(c);
    });
  });
  return out;
}

export const candsOf = (s: GameState, sp: AideSpecialty) => aideCandidates(s).filter((c) => c.specialty === sp);

/** 부관 자리 수(지금은 늘 3) */
export const aideSeats = (s: GameState) => Math.max(1, aideSlots(s.player.rankIndex));

/** 후보 → 부관 */
function candToAide(o: OfficerState, c: AideCand, worldMs: number): Aide {
  return {
    id: o.nextId++,
    name: c.name,
    specialty: c.specialty,
    level: c.level,
    exp: 0,
    bond: c.bond,
    loyalty: c.loyalty,
    stories: 0,
    errand: null,
    seenMs: worldMs,
    sex: c.sex,
    age: c.age,
    eth: c.eth,
    faceKey: c.faceKey,
    trait: c.trait,
    career: c.career,
  };
}

/** 임명 못 하는 까닭(되면 null) */
export function canAppointAide(s: GameState, key: string, replaceId?: number | null): string | null {
  if (!aideCandidates(s).some((c) => c.key === key)) return '이미 임명했거나 후보가 바뀌었어요';
  if (s.officer.aides.length >= aideSeats(s)) {
    if (replaceId == null) return `부관 자리(${aideSeats(s)})가 꽉 찼어요. 바꿀 부관을 골라 주세요`;
    const r = s.officer.aides.find((a) => a.id === replaceId);
    if (!r) return '바꿀 부관을 골라 주세요';
    if (r.school) return `${r.name}은(는) 장군 교육 중이라 바꿀 수 없어요`;
  }
  return null;
}

/** 조건 없이 임명(꽉 찼으면 replaceId 부관과 교대) */
export function appointAide(s: GameState, key: string, replaceId?: number | null): GameState {
  if (canAppointAide(s, key, replaceId)) return s;
  const c = aideCandidates(s).find((x) => x.key === key)!;
  return withOfficer(s, (o, _rng, ns) => {
    const ps = pickOf(o);
    o.aidePick = { ...ps, hired: [...ps.hired, key].slice(-40) };
    let out = '';
    if (o.aides.length >= aideSeats(ns)) {
      const r = o.aides.find((a) => a.id === replaceId)!;
      o.aides = o.aides.filter((a) => a.id !== replaceId);
      out = ` ${r.name} 부관은 원래 부대로 돌아갔어요.`;
    }
    o.aides.push(candToAide(o, c, ns.worldMs));
    note(ns, `🧑‍✈️ ${c.name}을(를) ${c.specialty} 부관으로 임명했어요(${c.trait}).${out}`);
  });
}

/** 부관을 원래 부대로 돌려보냄(자리 비우기) */
export function dismissAide(s: GameState, id: number): GameState {
  const a = s.officer.aides.find((x) => x.id === id);
  if (!a || a.school) return s;
  return withOfficer(s, (o, _rng, ns) => {
    o.aides = o.aides.filter((x) => x.id !== id);
    note(ns, `${a.name} 부관을 원래 부대로 돌려보냈어요.`);
  });
}

/** 후보 새로 받기(무료, 한 묶음에 3번까지) */
export const REROLL_MAX = 3;
export const rerollsLeft = (s: GameState) => {
  const ps = pickOf(s.officer);
  const used = ps.rerollPeriod === candPeriod(s.worldMs) ? (ps.rerollUsed ?? 0) : 0;
  return REROLL_MAX - used;
};
export function rerollCands(s: GameState): GameState {
  if (rerollsLeft(s) <= 0) return s;
  return withOfficer(s, (o, _rng, ns) => {
    const ps = pickOf(o);
    const period = candPeriod(ns.worldMs);
    const used = ps.rerollPeriod === period ? (ps.rerollUsed ?? 0) : 0;
    o.aidePick = { ...ps, reroll: (ps.reroll ?? 0) + 1, rerollPeriod: period, rerollUsed: used + 1 };
  });
}

/** 첫 부관(새 판): 후보 묶음과 같은 방식으로 한 명 만들어 바로 곁에 둠 */
export function starterAide(s: GameState, o: OfficerState, rng: Rng): Aide {
  const taken = new Set<string>([...o.aides.map((a) => a.name), ...o.generals.map((g) => g.name), ...o.rivals.map((r) => r.name), ...cabinetOf(s).people.map((p) => p.name)]);
  const sp = rng.pick([...AIDE_SPECIALTIES]);
  const c = makeCand(s, rng, sp, '유망', 'start', taken, faceUse(s), Math.floor(rng.next() * 5));
  return candToAide(o, { ...c, level: 1, bond: 10, loyalty: 50 }, s.worldMs);
}

/**
 * 옛 저장(11-24 이전): 부관·장군(부관 출신)이 장관과 같은 중년 얼굴을 쓰던 것을 젊은 얼굴로 바꿈.
 * 한국 이름 부관(강하린 등)은 원래 그림 그대로의 젊은 얼굴 번호로. 서로 겹치지 않게. s를 고침.
 */
export function migrateYoungAides(s: GameState) {
  const country = s.player.countryId;
  if (!youngReady(country) || !s.officer) return;
  const people: Array<{ name: string; sex?: 'm' | 'f'; eth?: string; faceKey?: string; age?: number }> = [...s.officer.aides, ...s.officer.generals.filter((g) => g.from === '부관 임명' || g.from === '부관 승격')];
  const use = new Map<string, number>();
  for (const p of people) if (p.faceKey && /-30-\d+$/.test(p.faceKey)) use.set(p.faceKey, (use.get(p.faceKey) ?? 0) + 1);
  const rng = new Rng(mixSeed(strNum(country), people.length, 0x70a9));
  for (const p of people) {
    if (p.faceKey && /-30-\d+$/.test(p.faceKey) && use.get(p.faceKey) === 1) continue;
    if (p.faceKey && /-30-\d+$/.test(p.faceKey)) use.set(p.faceKey, use.get(p.faceKey)! - 1);
    const named = country === 'kr' ? KR_NAMED_YOUNG[p.name] : undefined;
    if (!p.faceKey && named && !use.get(named)) {
      p.faceKey = named;
      use.set(named, 1);
      continue;
    }
    if (!p.sex) continue; // 성별을 모르는 옛 부관은 이름·분야 그림 그대로
    const f = pickYoung(use, faceTag(country, p.eth), p.sex, rng);
    if (!f) continue;
    p.faceKey = f;
    if (p.age !== undefined && p.age > 39) p.age = 25 + Math.round(rng.next() * 11);
  }
}
