// 11-27 종합 확장안 내정 9: 방첩과 내부 단속.
// 가끔 적 첩자가 내 부처 5곳 가운데 한 곳에 숨어듦. 숨어 있는 동안 연구와 첩보가 새어 나감.
// 「조사」로 단서를 모으면 결백한 부처가 하나씩 지워지고, 「체포」로 부처를 찍어 잡음.
// 맞히면 정보·명성을 얻고 보낸 나라가 드러남. 틀리면 신뢰도·지지도가 깎임. 4일 안에 못 잡으면 달아남.
import { COUNTRIES, countryById } from '../data/world';
import { addPresMod } from './approval';
import { addFavorNote } from './civ';
import { domOf, registerDomRows, type Rows } from './domestic';
import { pushReport } from './report';
import { addPrisoner } from './agents';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, isRival, relationOf } from './world';

const H = 3600e3;
export const MOLE_FIRST_MS = 36 * H;
export const MOLE_GAP_MS: [number, number] = [60 * H, 96 * H];
export const MOLE_STAY_MS = 4 * 24 * H;
export const CLUE_GAP_MS = 4 * H;
/** 조사 한 번 값(하루 예산의 몫) */
export const CLUE_COST = 0.03;
export const LEAK_RESEARCH = -0.06;
export const LEAK_SPY = -0.05;
export const CATCH_INTEL = 25;
export const CATCH_FAME = 30;

export const MOLE_SPOTS = [
  { icon: '🪖', name: '국방부', clue: '국방부 문서고 출입 기록은 깨끗했어요.' },
  { icon: '🌐', name: '외교부', clue: '외교부 암호 전문에는 손댄 흔적이 없어요.' },
  { icon: '🕵️', name: '정보원', clue: '정보원 직원 전원이 거짓말 탐지기를 통과했어요.' },
  { icon: '🔬', name: '과학기술부', clue: '과학기술부 연구소 서버는 뚫리지 않았어요.' },
  { icon: '💰', name: '재무부', clue: '재무부 계좌 흐름에 이상한 돈이 없어요.' },
] as const;

export interface MoleState {
  nextMs: number;
  open: { from: string; at: number; clear: number[]; clueMs: number; untilMs: number } | null;
  caught: number;
  missed: number;
  seed: number;
}
export const moleOf = (s: GameState): MoleState => s.mole ?? { nextMs: s.worldMs + MOLE_FIRST_MS, open: null, caught: 0, missed: 0, seed: (s.world.seed ^ 0x5bd1e995) >>> 0 };
export const clueCost = (s: GameState) => Math.max(30, Math.round(priceBase(s) * CLUE_COST));

/** 첩자를 보낼 만한 나라(전쟁 상대 · 맞수 먼저) */
function senders(s: GameState): string[] {
  const me = s.player.countryId;
  const alive = COUNTRIES.map((c) => c.id).filter((id) => id !== me && isAlive(s.world, id) && relationOf(s.world, me, id) !== '연합');
  const hot = alive.filter((id) => relationOf(s.world, me, id) === '전쟁' || isRival(me, id));
  return hot.length ? hot : alive;
}

export function canClue(s: GameState): string | null {
  const m = moleOf(s);
  if (!m.open) return '숨어든 첩자가 없어요';
  if (m.open.clear.length >= MOLE_SPOTS.length - 1) return '이제 한 곳만 남았어요';
  if (s.worldMs < m.open.clueMs) return '조사 결과를 기다리는 중이에요';
  if (s.nations[s.player.countryId].treasury < clueCost(s)) return '나라 예산이 모자라요';
  return null;
}
/** 조사: 결백한 부처 한 곳이 지워짐 */
export function findClue(s: GameState): { state: GameState; text: string } {
  if (canClue(s)) return { state: s, text: '' };
  const me = s.player.countryId;
  const m = structuredClone(moleOf(s));
  const o = m.open!;
  const rng = new Rng(m.seed);
  const left = MOLE_SPOTS.map((_, i) => i).filter((i) => i !== o.at && !o.clear.includes(i));
  const pick = rng.pick(left)!;
  m.seed = rng.seed;
  o.clear.push(pick);
  o.clueMs = s.worldMs + CLUE_GAP_MS;
  const text = `🔎 ${MOLE_SPOTS[pick].clue}`;
  return { state: { ...s, mole: m, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - clueCost(s) } } }, text };
}

/** 체포: 부처를 찍음 */
export function arrest(s: GameState, at: number): { state: GameState; text: string; ok: boolean } {
  const m = structuredClone(moleOf(s));
  const o = m.open;
  if (!o || o.clear.includes(at) || !MOLE_SPOTS[at]) return { state: s, text: '', ok: false };
  const spot = MOLE_SPOTS[at];
  if (at === o.at) {
    const from = countryById(o.from).name;
    m.open = null;
    m.caught++;
    let ns: GameState = { ...s, mole: m, officer: { ...s.officer, intel: s.officer.intel + CATCH_INTEL, fame: s.officer.fame + CATCH_FAME } };
    ns = addFavorNote(ns, o.from, '🕵️ 우리 부처에 첩자를 심음', -8);
    ns = addPrisoner(ns, o.from); // 11-28 잡은 첩자는 포로로(붙잡힌 우리 요원과 맞바꿀 수 있음)
    const text = `🚨 ${spot.name}에 숨어 있던 ${from} 첩자를 잡았습니다! 정보 +${CATCH_INTEL} · 명성 +${CATCH_FAME}`;
    return { state: pushReport(ns, { icon: '🚨', text }), text, ok: true };
  }
  o.clear.push(at);
  let ns: GameState = { ...s, mole: m, officer: { ...s.officer, trust: Math.max(0, s.officer.trust - 3) } };
  ns = addPresMod(ns, '🙅 엉뚱한 사람 체포', -2, 24);
  return { state: ns, text: `🙅 ${spot.name}에는 첩자가 없었어요. 신뢰도 −3 · 지지도 −2(하루)`, ok: false };
}

/** 세계 판단마다 */
export function moleTick(s: GameState): GameState {
  if (s.ending) return s;
  const m0 = moleOf(s);
  if (m0.open) {
    if (s.worldMs < m0.open.untilMs) return s.mole ? s : { ...s, mole: m0 };
    const m = structuredClone(m0);
    const from = countryById(m.open!.from).name;
    const spot = MOLE_SPOTS[m.open!.at];
    m.open = null;
    m.missed++;
    const ns: GameState = { ...s, mole: m, officer: { ...s.officer, trust: Math.max(0, s.officer.trust - 3) } };
    return pushReport(ns, { icon: '🕳️', text: `${spot.name}에 숨어 있던 ${from} 첩자가 자료를 들고 달아났습니다. 신뢰도 −3` });
  }
  if (s.worldMs < m0.nextMs) return s.mole ? s : { ...s, mole: m0 };
  const list = senders(s);
  const m = structuredClone(m0);
  const rng = new Rng(m.seed);
  m.nextMs = s.worldMs + MOLE_STAY_MS + rng.range(MOLE_GAP_MS[0], MOLE_GAP_MS[1]);
  if (!list.length) {
    m.seed = rng.seed;
    return { ...s, mole: m };
  }
  m.open = { from: rng.pick(list)!, at: Math.floor(rng.next() * MOLE_SPOTS.length), clear: [], clueMs: 0, untilMs: s.worldMs + MOLE_STAY_MS };
  m.seed = rng.seed;
  return pushReport({ ...s, mole: m, dom: domOf(s) }, { icon: '🕵️', text: '각하, 우리 부처 어딘가에 적 첩자가 숨어든 것 같습니다. 연구와 첩보가 새고 있습니다. 작전 → 정보전에서 찾아내 주십시오.' });
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  if (!s.mole?.open) return rows;
  if (key === 'research') rows.push(['🕵️ 숨어든 첩자(자료 유출)', LEAK_RESEARCH]);
  if (key === 'spy') rows.push(['🕵️ 숨어든 첩자(작전 누설)', LEAK_SPY]);
  return rows;
});
