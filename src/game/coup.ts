// 11-28 7단계 추가 8 "후계자와 쿠데타": 지지도가 너무 낮거나(25% 밑) 수도권 본토 도시를 절반 넘게 잃으면 군부·정적이 나섬.
//  · 48시간 카운트다운. 그 사이 숙청(신뢰도 −8, 위험 크게 ↓) · 양보 개각(나라 예산, 지지도 +6, 위험 ↓) · 대국민 연설(지지도 +3, 위험 조금 ↓)
//  · 끝날 때 위험 확률로 쿠데타 성공 → 후계자가 판을 이어 감(지도자 이름이 바뀌고 명성 절반 · 신뢰도 50 · 호칭 한 단계 ↓). 실패하면 지지도 +5
//  · 한 번 끝나면 5일 동안 다시 안 옴
import { FRONT } from '../data/cities';
import { addPresMod, approvalOf } from './approval';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';

const H = 3600e3;
const DAY = 24 * H;
export const COUP_MS = 48 * H;
export const COUP_GAP = 5 * DAY;
export const COUP_APPROVAL = 25;
const HEIRS = ['한도윤', '서지후', '윤채원', '강민재', '정하율', '오세린', '임태오', '백서윤'];

export interface CoupOpen { by: string; startMs: number; endMs: number; risk: number; did: string[] }
export interface CoupState { open: CoupOpen | null; nextMs: number; heirs: number; seed: number }
export const coupOf = (s: GameState): CoupState => s.coup ?? { open: null, nextMs: s.worldMs + DAY, heirs: 0, seed: (s.world.seed ^ 0x7f4a7c15) >>> 0 };
export const concedeCost = (s: GameState) => Math.max(300, Math.round(priceBase(s) * 1.5));

function homeLost(s: GameState): boolean {
  const me = s.player.countryId;
  const home = FRONT.filter((c) => c.home === me);
  return home.filter((c) => s.world.owner[c.id] === me).length * 2 < home.length;
}

export type CoupMove = 'purge' | 'concede' | 'speech';
export const COUP_MOVES: Record<CoupMove, { icon: string; name: string; text: string; risk: number }> = {
  purge: { icon: '⚔️', name: '숙청', text: '주동자를 잡아들임. 신뢰도 −8', risk: -0.3 },
  concede: { icon: '🤝', name: '양보 개각', text: '정적에게 자리를 나눔. 나라 예산 · 지지도 +6', risk: -0.2 },
  speech: { icon: '🎤', name: '대국민 연설', text: '국민에게 호소. 지지도 +3', risk: -0.1 },
};
export function canCoupMove(s: GameState, m: CoupMove): string | null {
  const o = coupOf(s).open;
  if (!o) return '쿠데타 위협이 없어요';
  if (o.did.includes(m)) return '이미 했어요';
  if (m === 'concede' && s.nations[s.player.countryId].treasury < concedeCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function coupMove(s: GameState, m: CoupMove): { state: GameState; text: string } {
  const why = canCoupMove(s, m);
  if (why) return { state: s, text: why };
  const c = coupOf(s);
  const o = c.open!;
  const d = COUP_MOVES[m];
  const me = s.player.countryId;
  let ns: GameState = { ...s, coup: { ...c, open: { ...o, risk: Math.max(0.03, o.risk + d.risk), did: [...o.did, m] } } };
  if (m === 'purge') ns = { ...ns, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - 8) } };
  if (m === 'concede') {
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury - concedeCost(s) } } };
    ns = addPresMod(ns, '🤝 양보 개각', 6, 72);
  }
  if (m === 'speech') ns = addPresMod(ns, '🎤 쿠데타 앞 대국민 연설', 3, 48);
  return { state: ns, text: `${d.icon} ${d.name}: ${d.text}. 쿠데타 성공 확률 ${Math.round(ns.coup!.open!.risk * 100)}%` };
}

export function coupTick(s: GameState): GameState {
  if (s.ending) return s;
  const c = coupOf(s);
  const rng = new Rng(c.seed);
  if (c.open) {
    if (s.worldMs < c.open.endMs) return s.coup ? s : { ...s, coup: c };
    const o = c.open;
    if (rng.chance(o.risk)) {
      const heir = HEIRS[(c.heirs + Math.floor(rng.next() * HEIRS.length)) % HEIRS.length];
      const ns: GameState = {
        ...s,
        coup: { ...c, open: null, nextMs: s.worldMs + COUP_GAP, heirs: c.heirs + 1, seed: rng.seed },
        player: { ...s.player, name: heir, rankIndex: Math.max(0, s.player.rankIndex - 1) },
        officer: { ...s.officer, fame: Math.round(s.officer.fame / 2), trust: 50 },
      };
      return pushReport(addPresMod(ns, '🕊️ 새 지도자 기대', 15, 72), { icon: '🪖', text: `${o.by} 세력의 쿠데타로 지도자가 물러났습니다. 후계자 ${heir}이(가) 나라를 이어받습니다. 명성 절반 · 호칭 한 단계 ↓ · 신뢰도 50, 새 지도자 기대로 지지도 +15(사흘).` });
    }
    const ns = addPresMod({ ...s, coup: { ...c, open: null, nextMs: s.worldMs + COUP_GAP, seed: rng.seed } }, '🛡️ 쿠데타를 막아 냄', 5, 72);
    return pushReport(ns, { icon: '🛡️', text: `대장님, ${o.by} 세력의 쿠데타 시도를 막아 냈습니다! 지지도 +5(사흘).` });
  }
  if (s.worldMs < c.nextMs) return s.coup ? s : { ...s, coup: c };
  const ap = approvalOf(s);
  const lost = homeLost(s);
  if (ap >= COUP_APPROVAL && !lost) return { ...s, coup: { ...c, nextMs: s.worldMs + 6 * H } };
  const risk = Math.min(0.8, 0.25 + Math.max(0, COUP_APPROVAL - ap) / 40 + (lost ? 0.2 : 0));
  const rv = s.officer.rivals.find((r) => !r.ally && (r.role === '군부 실력자' || r.role === '퇴역 대장')) ?? s.officer.rivals.find((r) => !r.ally);
  const by = rv ? `${rv.name}(${rv.role ?? '정적'})` : '군부';
  return pushReport(
    { ...s, coup: { ...c, open: { by, startMs: s.worldMs, endMs: s.worldMs + COUP_MS, risk, did: [] }, nextMs: s.worldMs + COUP_GAP, seed: rng.seed } },
    { icon: '🪖', text: `대장님, ${by} 세력이 쿠데타를 준비하고 있습니다(${lost ? '본토를 크게 잃음' : `지지도 ${Math.round(ap)}%`}). 48시간 안에 외교 → 🌐 진영에서 숙청·양보 개각·대국민 연설로 막으십시오. 지금 성공 확률 ${Math.round(risk * 100)}%.` },
  );
}
