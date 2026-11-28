// 안 1 국회 의석·선거(11/26): 국회 300석(여당·야당·무소속). 여당 의석이 법안·기본법·예산안 통과 확률을 바꿈.
// 실제 7일마다 총선과 지방선거가 번갈아 열리고, 투표 2일 전부터 하루 2곳씩 유세. 득표는 지지도·경제·유세·야당 대표 영향력으로 정해짐.
import { approvalOf } from './approval';
import { payTreasury, registerDomRows, snap } from './domestic';
import { econOf } from './econ';
import { localElection } from './governors';
import { DAY, H, bumpRival, bumpTrust, clamp, polityOf, polityLog, r1, registerPolityInit, roll, seatBonus, tell, withPolity, type Election, type Seats } from './polity';
import { priceBase, type GameState } from './state';
import { myCityIds } from './zones';
import { cityById } from '../data/cities';
import { ladderOf } from './ladder';
import { pairKey } from './world';
import { COUNTRIES } from '../data/world';
import { isHometown } from '../data/krCities';

export const SEATS = 300;
export const MAJORITY = 151;
export const TWO_THIRDS = 200;
export const ELECTION_GAP_MS = 7 * DAY;
export const CAMPAIGN_MS = 2 * DAY;
export const RALLY_PER_DAY = 2;
export const RALLY_GAIN = 1.2;
export const RALLY_MAX = 10;
/** 한 사람이 오래 다스리는 나라(여당이 크게 시작, 선거에서 +15) */
export const STRONG_RULE = ['cn', 'ru', 'kp', 'ir', 'sa', 'eg', 've', 'et', 'dz'];

const START: Record<string, Seats> = {
  cn: { ruling: 230, opp: 30, ind: 40 },
  ru: { ruling: 210, opp: 55, ind: 35 },
  kp: { ruling: 280, opp: 0, ind: 20 },
  ir: { ruling: 190, opp: 70, ind: 40 },
  sa: { ruling: 250, opp: 0, ind: 50 }, // 국왕이 임명하는 슈라 위원회
  // 11-27 새 나라: 여당이 크게 이기는 나라
  eg: { ruling: 200, opp: 40, ind: 60 },
  ve: { ruling: 210, opp: 70, ind: 20 },
  et: { ruling: 240, opp: 30, ind: 30 },
  dz: { ruling: 180, opp: 60, ind: 60 },
};
registerPolityInit((s, p) => {
  p.seats = { ...(START[s.player.countryId] ?? { ruling: 140, opp: 125, ind: 35 }) };
});

export const seatsOf = (s: GameState) => polityOf(s).seats;
export const electionOf = (s: GameState): Election => polityOf(s).election;
export const campaignOpen = (s: GameState) => electionOf(s).atMs - s.worldMs <= CAMPAIGN_MS;
export const electionName = (e: Election) => (e.kind === 'general' ? '총선' : '지방선거');

export function seatRow(s: GameState): [string, number] | null {
  if (!s.polity) return null;
  const v = seatBonus(s);
  return v ? [`🏛️ 여당 의석 ${seatsOf(s).ruling}/${SEATS}`, v] : null;
}

/** 득표율(여당) 근거 줄. 합 = 득표율 % */
export function voteRows(s: GameState): Array<[string, number]> {
  const e = electionOf(s);
  const ec = econOf(s);
  const rows: Array<[string, number]> = [['기본', 48]];
  rows.push([`📊 지지도 ${Math.round(approvalOf(s))}`, r1((approvalOf(s) - 50) * 0.5)]);
  const rally = Math.min(RALLY_MAX, e.rally.length * RALLY_GAIN);
  if (rally) rows.push([`📣 유세 ${e.rally.length}번`, r1(rally)]);
  const eco = r1((ec.growth - 2) * 1.5 - Math.max(0, ec.cpi - 3) * 1.5 - Math.max(0, ec.unemp - 5));
  if (eco) rows.push(['📈 경제 상황', eco]);
  if (STRONG_RULE.includes(s.player.countryId)) rows.push(['🏛️ 오랜 집권 체제', 15]);
  s.officer.rivals.forEach((rv, i) => {
    const role = rv.role ?? (['야당 대표', '군부 실력자', '재벌'] as const)[i % 3];
    if (role !== '야당 대표') return;
    const inf = rv.influence ?? 40;
    rows.push(rv.ally ? [`🤝 야당 대표 ${rv.name}(협력)`, 4] : [`🗳️ 야당 대표 ${rv.name} 영향력 ${Math.round(inf)}`, -r1(inf / 16)]);
  });
  const p = polityOf(s);
  if (p.scandal) rows.push(['🔍 비리 의혹', -3]);
  if (p.econ.crisis) rows.push(['📉 경제 위기', -5]);
  // 11-28 중-4 선거와 전쟁 피로: 전쟁을 오래 끌수록 표가 빠짐
  const tired = warWeariness(s);
  if (tired >= 1) rows.push(['⚔️ 전쟁 피로', -Math.min(8, r1(tired / 15))]);
  return rows;
}
/** 내 전쟁들의 피로 합 */
export function warWeariness(s: GameState): number {
  const me = s.player.countryId;
  let v = 0;
  for (const c of COUNTRIES) {
    if (c.id === me) continue;
    const p = s.world.pairs[pairKey(me, c.id)];
    if (p?.rel === '전쟁') v += p.weariness;
  }
  return v;
}
export const WAR_CURB_MS = 2 * DAY;
export const voteShare = (s: GameState) => clamp(voteRows(s).reduce((a, [, v]) => a + v, 0), 10, 90);

export const rallyCost = (s: GameState) => Math.round(priceBase(s) * 0.3);
export function canRally(s: GameState, cityId: string): string | null {
  if (!s.polity) return '아직 준비 중이에요';
  if (!campaignOpen(s)) return '선거 2일 전부터 유세할 수 있어요';
  if (!myCityIds(s).includes(cityId)) return '내 도시가 아니에요';
  const e = electionOf(s);
  const today = s.worldMs - e.dayMs < DAY ? e.dayCount : 0;
  if (today >= RALLY_PER_DAY) return `유세는 하루 ${RALLY_PER_DAY}곳까지예요`;
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < rallyCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function rally(s: GameState, cityId: string): GameState {
  if (canRally(s, cityId)) return s;
  const paid = payTreasury(s, rallyCost(s));
  if (!paid) return s;
  const e = electionOf(paid);
  const fresh = paid.worldMs - e.dayMs >= DAY;
  const name = cityById(cityId).name;
  const home = isHometown(name);
  const rallies = home ? [cityId, cityId] : [cityId];
  let ns = withPolity(paid, {
    election: { ...e, rally: [...e.rally, ...rallies], dayCount: (fresh ? 0 : e.dayCount) + 1, dayMs: fresh ? paid.worldMs : e.dayMs },
  });
  const p = polityOf(ns);
  ns = withPolity(ns, { marks: [...p.marks.filter((m) => m.untilMs > ns.worldMs), { cityId, v: 4, untilMs: ns.worldMs + 48 * H, why: '📣 유세' }] });
  ns = polityLog(ns, `📣 ${name} 유세${home ? '(고향, 효과 2배)' : ''}`);
  return snap(ns, 'rally', `${name} 유세`, `${electionName(e)} 유세 현장`);
}

function nextElection(e: Election, at: number): Election {
  return { kind: e.kind === 'general' ? 'local' : 'general', atMs: at + ELECTION_GAP_MS, rally: [], dayCount: 0, dayMs: 0 };
}

/** 총선: 의석 나누기. 지역구 현역 덕분에 지난 의석이 40% 남음(한 번에 확 뒤집히지 않음) */
export function generalResult(share: number, indRoll: number, before?: Seats): Seats {
  const ind = Math.round(20 + indRoll * 20);
  const fresh = (SEATS - ind) * (share / 100);
  const ruling = Math.max(0, Math.min(SEATS - ind, Math.round(before ? before.ruling * 0.4 + fresh * 0.6 : fresh)));
  return { ruling, opp: SEATS - ind - ruling, ind };
}

/** 11-28 선거 예측: 득표 흔들림(±4%)·무소속 수를 고르게 나눠 본 의석 범위와 과반 확률 */
export const VOTE_HIST_MS = 3 * H;
export const VOTE_HIST_MAX = 24;
export function seatForecast(s: GameState, share = voteShare(s)): { low: number; mid: number; high: number; majority: number } {
  const before = seatsOf(s);
  const kp = s.player.countryId === 'kp';
  const got: number[] = [];
  for (let i = 0; i <= 10; i++)
    for (let j = 0; j <= 4; j++) got.push(kp ? 280 : generalResult(clamp(share + (i / 10 - 0.5) * 8, 5, 95), j / 4, before).ruling);
  got.sort((a, b) => a - b);
  return { low: got[0], mid: got[Math.floor(got.length / 2)], high: got[got.length - 1], majority: got.filter((v) => v >= MAJORITY).length / got.length };
}
/** 3시간마다 예상 득표율을 적어 둠(그래프) */
function recordVote(s: GameState): GameState {
  const p = polityOf(s);
  if (s.worldMs - (p.voteHistMs ?? 0) < VOTE_HIST_MS) return s;
  return withPolity(s, { voteHist: [...(p.voteHist ?? []), Math.round(voteShare(s) * 10) / 10].slice(-VOTE_HIST_MAX), voteHistMs: s.worldMs });
}

/** 15분마다: 유세 창 알림·투표 */
export function seatsTick(s0: GameState): GameState {
  if (!s0.polity) return s0;
  const s = recordVote(s0);
  const e = electionOf(s);
  if (s.worldMs < e.atMs) return s;
  let ns = s;
  const share = voteShare(ns);
  let rnd: number;
  [rnd, ns] = roll(ns);
  const got = clamp(share + (rnd - 0.5) * 8, 5, 95);
  const p = polityOf(ns);
  if (e.kind === 'general') {
    let ir: number;
    [ir, ns] = roll(ns);
    const before = p.seats;
    const seats = STRONG_RULE.includes(ns.player.countryId) && ns.player.countryId === 'kp' ? { ruling: 280, opp: 0, ind: 20 } : generalResult(got, ir, before);
    ns = withPolity(ns, { seats, election: nextElection(e, e.atMs), elections: p.elections + 1 });
    const win = seats.ruling >= MAJORITY;
    const diff = seats.ruling - before.ruling;
    ns = bumpTrust(ns, win ? 5 : -5);
    let who: string | null;
    [ns, who] = bumpRival(ns, '야당 대표', win ? -10 : 12);
    const line = `🗳️ 총선 결과 여당 ${seats.ruling}석(${diff >= 0 ? '+' : ''}${diff}) · 야당 ${seats.opp} · 무소속 ${seats.ind} · 득표 ${Math.round(got)}%`;
    ns = polityLog(ns, line);
    ns = tell(ns, `${line}. ${win ? '과반을 지켰어요!' : `과반을 잃었어요. ${who ? `야당 대표 ${who}: "국민이 정권을 심판했다!"` : ''}`}`);
    ns = snap(ns, 'rally', win ? '총선 승리' : '총선 패배', line);
    // 11-28 중-4: 전쟁 중에 지면 국회가 전쟁 권한을 묶음
    if (!win && warWeariness(ns) > 0) {
      ns = { ...ns, ladder: { ...ladderOf(ns), curbMs: ns.worldMs + WAR_CURB_MS } };
      ns = tell(ns, '⚖️ 전쟁 중에 총선에서 져서 국회가 2일 동안 새 총동원을 막았어요. 지금 전쟁은 계속할 수 있어요.');
    }
  } else {
    ns = withPolity(ns, { election: nextElection(e, e.atMs), elections: p.elections + 1 });
    ns = localElection(ns, got);
  }
  return ns;
}

registerDomRows((s, key) => {
  if (!s.polity || key !== 'trust') return [];
  const r = seatsOf(s).ruling;
  if (r >= TWO_THIRDS) return [['🏛️ 여당 3분의 2 의석', 4]];
  if (r >= MAJORITY) return [['🏛️ 여당 과반', 2]];
  if (r < 120) return [['🏛️ 여소야대', -3]];
  return [];
});

