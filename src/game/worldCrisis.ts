// 11-27 종합 확장안 전투 8: 주간 세계 위기.
// 실제 7일마다 큰 사건 하나가 사흘 동안 열림(해협 봉쇄 · 핵 시설 위기 · 초대형 요새).
// 모든 나라가 두 편으로 갈리고, 나도 한쪽에 서거나 중립을 지킴. 편에 서면 3번까지 힘을 보탤 수 있음.
// 끝나면 점수가 높은 편이 이기고, 결과가 일주일 동안 세계에 남음(이긴 편에 섰으면 덤, 진 편이면 벌).
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { domOf, registerDomRows, type Rows } from './domestic';
import { goalsOf } from './goals';
import type { LawKey } from './laws';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, relationOf } from './world';

const DAY = 24 * 3600e3;
export const WC_FIRST_MS = 5 * DAY;
export const WC_GAP_MS = 7 * DAY;
export const WC_OPEN_MS = 3 * DAY;
export const WC_EFFECT_MS = 7 * DAY;
export const WC_GIVE_MAX = 3;
export const WC_GIVE_PTS = 15;
/** 힘 보태기 한 번 값(하루 예산의 몫) */
export const WC_GIVE_COST = 0.1;
export const WC_RUBY = 15;
export const WC_FAME = 40;

export interface WcDef {
  id: string; icon: string; title: string; text: string; a: string; b: string; key: LawKey; v: number; effText: string; aWin: string; bWin: string;
  /** 11-28 중-5 세계 충격: 위기가 열린 사흘 동안 모든 나라에 바뀌는 세계 규칙 */
  rule?: { key: LawKey; v: number; text: string };
}
export const WCS: WcDef[] = [
  { id: 'strait', icon: '🚢', title: '해협 봉쇄', text: '세계 기름의 다섯에 하나가 지나는 해협이 막혔어요. 군함을 보내 뚫자는 나라와 봉쇄를 편드는 나라로 갈렸어요.', a: '항행의 자유', b: '봉쇄 지지', key: 'res', v: 0.06, effText: '자원 6%', aWin: '해협이 다시 열렸어요.', bWin: '해협이 닫힌 채 남았어요.' },
  { id: 'nuke', icon: '☢️', title: '핵 시설 위기', text: '한 나라의 숨겨진 핵 시설이 드러났어요. 사찰과 제재를 밀어붙이자는 편과 주권을 지켜 주자는 편이 맞섰어요.', a: '사찰과 제재', b: '주권 존중', key: 'defense', v: 5, effText: '안보 5', aWin: '사찰단이 들어갔어요.', bWin: '시설은 그대로 남았어요.' },
  { id: 'fort', icon: '🏰', title: '초대형 요새', text: '분쟁 지역 한가운데 누구도 뚫지 못한 요새가 섰어요. 힘을 모아 치자는 편과 건드리지 말자는 편이 갈렸어요.', a: '공동 공격', b: '현상 유지', key: 'diplo', v: 5, effText: '외교 5', aWin: '요새가 무너졌어요.', bWin: '요새가 버텨 냈어요.' },
  // 11-28 중-5 세계 충격 사건(열린 사흘 동안 세계 규칙이 바뀜)
  { id: 'oil', icon: '🛢️', title: '유가 폭등', text: '산유국들이 기름을 줄여 값이 세 배로 뛰었어요. 증산을 밀어붙이자는 편과 감산에 맞추자는 편이 갈렸어요.', a: '증산 압박', b: '감산 동조', key: 'res', v: 0.06, effText: '자원 6%', aWin: '기름값이 내려앉았어요.', bWin: '비싼 기름이 굳어졌어요.', rule: { key: 'res', v: -0.08, text: '자원 −8%' } },
  { id: 'finance', icon: '📉', title: '세계 금융 위기', text: '큰 은행들이 잇달아 무너졌어요. 함께 돈을 풀어 막자는 편과 각자 살길을 찾자는 편이 맞섰어요.', a: '공조 구제', b: '각자도생', key: 'budget', v: 0.04, effText: '나라 예산 4%', aWin: '시장이 되살아났어요.', bWin: '돈줄이 한동안 말랐어요.', rule: { key: 'budget', v: -0.06, text: '나라 예산 −6%' } },
  { id: 'quake', icon: '🌋', title: '초대형 지진', text: '한 대륙을 흔든 큰 지진이 났어요. 국제 구호대를 보내자는 편과 남의 일에 끼지 말자는 편이 갈렸어요.', a: '국제 구호', b: '불개입', key: 'diplo', v: 5, effText: '외교 5', aWin: '구호대가 많은 목숨을 살렸어요.', bWin: '피해 나라들이 서운해했어요.', rule: { key: 'build', v: -0.1, text: '부대 모집 −10%' } },
  { id: 'pandemic', icon: '🦠', title: '세계 전염병', text: '새 전염병이 퍼지고 있어요. 국경을 닫자는 편과 열어 두고 백신을 나누자는 편이 맞섰어요.', a: '국경 봉쇄', b: '백신 나눔', key: 'defense', v: 4, effText: '안보 4', aWin: '병이 빨리 잡혔어요.', bWin: '함께 백신을 나눴어요.', rule: { key: 'troop', v: -0.06, text: '병력 모집 −6%' } },
];
export const wcById = (id: string) => WCS.find((d) => d.id === id) ?? WCS[0];

export type Side = 'a' | 'b';
export interface WcOpen { def: string; endMs: number; a: string[]; b: string[]; side: Side | 'n' | null; gave: number; pa: number; pb: number }
export interface WcState {
  nextMs: number;
  open: WcOpen | null;
  /** 지난 위기 결과와 남은 효과 */
  last?: { def: string; won: Side; mine: 1 | -1 | 0; untilMs: number };
  n: number;
  seed: number;
}
export const wcOf = (s: GameState): WcState => s.wcrisis ?? { nextMs: s.worldMs + WC_FIRST_MS, open: null, n: 0, seed: (s.world.seed ^ 0xc2b2ae35) >>> 0 };
export const giveCost = (s: GameState) => Math.max(50, Math.round(priceBase(s) * WC_GIVE_COST));

export function canSide(s: GameState): string | null {
  const o = wcOf(s).open;
  if (!o) return '열린 세계 위기가 없어요';
  if (o.side) return '이미 정했어요';
  return null;
}
/** 편 정하기(중립 = 'n'). 같은 편 나라 호감 +3, 맞은편 −3 */
export function pickSide(s: GameState, side: Side | 'n'): GameState {
  if (canSide(s)) return s;
  const w = structuredClone(wcOf(s));
  w.open!.side = side;
  let ns: GameState = { ...s, wcrisis: w };
  if (side === 'n') return ns;
  const d = wcById(w.open!.def);
  for (const id of w.open![side]) ns = addFavorNote(ns, id, `${d.icon} ${d.title}에서 같은 편`, 3);
  for (const id of w.open![side === 'a' ? 'b' : 'a']) ns = addFavorNote(ns, id, `${d.icon} ${d.title}에서 맞은편`, -3);
  return ns;
}
export function canGive(s: GameState): string | null {
  const o = wcOf(s).open;
  if (!o) return '열린 세계 위기가 없어요';
  if (o.side !== 'a' && o.side !== 'b') return '먼저 편을 정하세요';
  if (o.gave >= WC_GIVE_MAX) return `힘 보태기는 ${WC_GIVE_MAX}번까지예요`;
  if (s.nations[s.player.countryId].treasury < giveCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function give(s: GameState): GameState {
  if (canGive(s)) return s;
  const me = s.player.countryId;
  const w = structuredClone(wcOf(s));
  const o = w.open!;
  o.gave++;
  if (o.side === 'a') o.pa += WC_GIVE_PTS;
  else o.pb += WC_GIVE_PTS;
  return { ...s, wcrisis: w, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - giveCost(s) } } };
}

/** 세계 판단마다 */
export function wcTick(s: GameState): GameState {
  if (s.ending) return s;
  const w0 = wcOf(s);
  const me = s.player.countryId;
  if (w0.open) {
    if (s.worldMs < w0.open.endMs) return s.wcrisis ? s : { ...s, wcrisis: w0 };
    const w = structuredClone(w0);
    const o = w.open!;
    const d = wcById(o.def);
    const won: Side = o.pa >= o.pb ? 'a' : 'b';
    const mine: 1 | -1 | 0 = o.side === won ? 1 : o.side === 'a' || o.side === 'b' ? -1 : 0;
    w.open = null;
    w.last = { def: d.id, won, mine, untilMs: s.worldMs + WC_EFFECT_MS };
    let ns: GameState = { ...s, wcrisis: w, dom: domOf(s) };
    let tail = '우리는 중립을 지켰습니다.';
    if (mine === 1) {
      const g = goalsOf(ns);
      ns = { ...ns, goals: { ...g, ruby: g.ruby + WC_RUBY }, officer: { ...ns.officer, fame: ns.officer.fame + WC_FAME } };
      tail = `우리 편이 이겼습니다! 💎 +${WC_RUBY} · 명성 +${WC_FAME} · 일주일 동안 ${d.effText} 덤`;
    } else if (mine === -1) {
      ns = { ...ns, officer: { ...ns.officer, fame: Math.max(0, ns.officer.fame - WC_FAME / 2) } };
      tail = `우리 편이 졌습니다. 명성 −${WC_FAME / 2} · 일주일 동안 ${d.effText}의 절반만큼 손해`;
    }
    const text = `${d.icon} 세계 위기 「${d.title}」 결과: 「${won === 'a' ? d.a : d.b}」 쪽 승리(${Math.round(o.pa)} 대 ${Math.round(o.pb)}). ${won === 'a' ? d.aWin : d.bWin} ${tail}`;
    ns = { ...ns, world: { ...ns.world, events: [{ t: s.worldMs, kind: '외교' as const, text, mine: mine !== 0 }, ...ns.world.events].slice(0, 200) } };
    return pushReport(ns, { icon: d.icon, text });
  }
  if (s.worldMs < w0.nextMs) return s.wcrisis ? s : { ...s, wcrisis: w0 };
  const w = structuredClone(w0);
  const rng = new Rng(w.seed);
  const d = WCS[w.n % WCS.length];
  const alive = COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id)).sort((x, y) => y.military - x.military);
  w.nextMs = s.worldMs + WC_GAP_MS;
  w.n++;
  if (alive.length < 2) {
    w.seed = rng.seed;
    return { ...s, wcrisis: w };
  }
  // 가장 센 두 나라가 편의 머리, 나머지는 머리와 사이가 좋은 쪽(전쟁 중이면 반대편)으로
  const [ha, hb] = [alive[0], alive[1]];
  const a = [ha.id], b = [hb.id];
  let pa = ha.military / 5, pb = hb.military / 5;
  for (const c of alive.slice(2)) {
    const ra = relationOf(s.world, c.id, ha.id), rb = relationOf(s.world, c.id, hb.id);
    const toA = ra === '연합' || rb === '전쟁' ? true : rb === '연합' || ra === '전쟁' ? false : c.bloc === ha.bloc ? true : c.bloc === hb.bloc ? false : rng.chance(0.5);
    if (toA) { a.push(c.id); pa += (c.military / 10) * rng.range(0.7, 1.3); }
    else { b.push(c.id); pb += (c.military / 10) * rng.range(0.7, 1.3); }
  }
  w.seed = rng.seed;
  w.open = { def: d.id, endMs: s.worldMs + WC_OPEN_MS, a, b, side: null, gave: 0, pa, pb };
  return pushReport({ ...s, wcrisis: w }, { icon: d.icon, text: `세계 위기 「${d.title}」이(가) 터졌습니다. ${countryById(ha.id).name} 쪽(${d.a})과 ${countryById(hb.id).name} 쪽(${d.b})으로 세계가 갈렸습니다. 사흘 안에 본부에서 편을 정해 주십시오.` });
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  const o = s.wcrisis?.open;
  const r = o ? wcById(o.def).rule : undefined;
  if (o && r && r.key === key) rows.push([`${wcById(o.def).icon} 세계 충격: ${wcById(o.def).title}`, r.v]);
  const l = s.wcrisis?.last;
  if (!l || !l.mine || l.untilMs <= s.worldMs) return rows;
  const d = wcById(l.def);
  if (d.key === key) rows.push([`${d.icon} 세계 위기 ${l.mine > 0 ? '승리' : '패배'}`, l.mine > 0 ? d.v : -d.v / 2]);
  return rows;
});
