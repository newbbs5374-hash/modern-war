// 11-28 국정 37 강화: 대륙 회의 · 패권 도전. 우리 대륙 2·3등이면 1등(패권국)에 도전할 수 있음.
// 대륙 회의를 열어 표를 모음: 이길 확률 = 힘 비율 + 대륙 나라들 호감. 이기면 3일 동안 "대륙 맹주"(나라 예산 +10%·대륙 나라 호감 +4),
// 지면 신뢰도 −4·패권국과 긴장 +10. 실제 48시간마다 한 번, 나라 예산이 듦.
import { regionName, regionOf } from '../data/regions';
import { countryById } from '../data/world';
import { addFavorNote, favorOf } from './civ';
import { registerDomRows } from './domestic';
import { regionStanding } from './hegemony';
import { note } from './officer';
import { Rng } from './rng';
import type { GameState } from './state';
import { pairKey } from './world';

const H = 3600e3;
export const CH_COST = 5000;
export const CH_WAIT = 48 * H;
export const CH_CROWN = 72 * H;
export const CH_RATIO = 0.6;
export const CH_BONUS = 0.1;
export interface RegionCrown {
  region: string;
  untilMs: number;
  nextMs: number;
  wins: number;
  losses: number;
}
const crownOf = (s: GameState): RegionCrown => s.crown ?? { region: '', untilMs: 0, nextMs: 0, wins: 0, losses: 0 };
export const isCrowned = (s: GameState) => crownOf(s).untilMs > s.worldMs;

export function challengeInfo(s: GameState) {
  const me = s.player.countryId;
  const rid = regionOf(me);
  const st = regionStanding(s, rid);
  const top = st[0];
  const rank = st.findIndex((x) => x.id === me) + 1;
  const mine = st.find((x) => x.id === me)?.score ?? 0;
  const ratio = top && top.score > 0 ? mine / top.score : 0;
  const others = st.filter((x) => x.id !== me && x.id !== top?.id);
  const fav = others.length ? others.reduce((a, x) => a + favorOf(s, x.id), 0) / others.length : 0;
  const chance = Math.max(0.05, Math.min(0.9, 0.25 + (ratio - CH_RATIO) * 1.2 + fav / 150));
  return { rid, name: regionName(rid), hegemon: top?.id ?? '', rank, ratio, fav, chance, members: others.map((x) => x.id) };
}

export function canChallenge(s: GameState): string | null {
  const i = challengeInfo(s);
  if (isCrowned(s)) return '이미 대륙 맹주예요';
  if (i.rank <= 1) return '우리가 대륙 1등이에요';
  if (i.rank > 3) return '대륙 3등 안에 들어야 해요';
  if (i.ratio < CH_RATIO) return `힘이 1등의 ${Math.round(CH_RATIO * 100)}% 넘어야 해요(지금 ${Math.round(i.ratio * 100)}%)`;
  const c = crownOf(s);
  if (s.worldMs < c.nextMs) return `${Math.ceil((c.nextMs - s.worldMs) / H)}시간 뒤에 다시 열 수 있어요`;
  if ((s.nations[s.player.countryId]?.treasury ?? 0) < CH_COST) return `나라 예산 ${CH_COST.toLocaleString('ko-KR')} 필요`;
  return null;
}

export function challenge(s: GameState): { state: GameState; text: string } {
  const why = canChallenge(s);
  if (why) return { state: s, text: why };
  const i = challengeInfo(s);
  const me = s.player.countryId;
  const rng = new Rng(((Math.floor(s.worldMs / H) * 2246822519 + 7) >>> 0) || 1);
  const win = rng.chance(i.chance);
  const c = crownOf(s);
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - CH_COST } } };
  const k = pairKey(me, i.hegemon);
  const p = ns.world.pairs[k];
  const tz = win ? 20 : 10;
  if (p) ns = { ...ns, world: { ...ns.world, events: [...ns.world.events], pairs: { ...ns.world.pairs, [k]: { ...p, tension: Math.min(100, p.tension + tz) } } } };
  const hn = countryById(i.hegemon).name;
  let text: string;
  if (win) {
    ns = { ...ns, crown: { region: i.rid, untilMs: s.worldMs + CH_CROWN, nextMs: s.worldMs + CH_WAIT, wins: c.wins + 1, losses: c.losses } };
    for (const id of i.members) ns = addFavorNote(ns, id, '대륙 회의에서 우리를 맹주로 뽑음', 4);
    text = `👑 ${i.name} 대륙 회의에서 이겼어요! 3일 동안 대륙 맹주: 나라 예산 +${Math.round(CH_BONUS * 100)}% · 대륙 나라 호감 +4. ${hn}와 긴장 +${tz}`;
  } else {
    ns = { ...ns, crown: { ...c, nextMs: s.worldMs + CH_WAIT, losses: c.losses + 1 }, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - 4) } };
    ns = addFavorNote(ns, i.hegemon, '대륙 패권에 도전함', -8);
    text = `❌ ${i.name} 대륙 회의에서 ${hn}에 밀렸어요. 신뢰도 −4 · ${hn}와 긴장 +${tz}`;
  }
  note(ns, text);
  return { state: ns, text };
}

registerDomRows((s, key) => (key === 'budget' && isCrowned(s) ? [['👑 대륙 맹주', CH_BONUS]] : []));
