// 안 1 국회 의석·선거(11/26): 국회 300석(여당·야당·무소속). 여당 의석이 법안·기본법·예산안 통과 확률을 바꿈.
// 실제 7일마다 총선과 지방선거가 번갈아 열리고, 투표 2일 전부터 하루 2곳씩 유세. 득표는 지지도·경제·유세·야당 대표 영향력으로 정해짐.
import { approvalOf } from './approval';
import { payTreasury, registerDomRows, snap } from './domestic';
import { econOf } from './econ';
import { localElection } from './governors';
import { DAY, H, bumpRival, bumpTrust, clamp, polityOf, polityLog, r1, registerPolityInit, roll, seatBonus, tell, withPolity, type Election, type Seats } from './polity';
import { budgetPerDay, type GameState } from './state';
import { myCityIds } from './zones';
import { cityById } from '../data/cities';
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
export const STRONG_RULE = ['cn', 'ru', 'kp', 'ir'];

const START: Record<string, Seats> = {
  cn: { ruling: 230, opp: 30, ind: 40 },
  ru: { ruling: 210, opp: 55, ind: 35 },
  kp: { ruling: 280, opp: 0, ind: 20 },
  ir: { ruling: 190, opp: 70, ind: 40 },
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
  return rows;
}
export const voteShare = (s: GameState) => clamp(voteRows(s).reduce((a, [, v]) => a + v, 0), 10, 90);

export const rallyCost = (s: GameState) => Math.round(budgetPerDay(s, s.player.countryId) * 0.3);
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

/** 15분마다: 유세 창 알림·투표 */
export function seatsTick(s: GameState): GameState {
  if (!s.polity) return s;
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

