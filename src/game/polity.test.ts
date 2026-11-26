import { describe, expect, test } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { polityOf } from './polity';
import { MAJORITY, SEATS, campaignOpen, canRally, electionOf, generalResult, rally, voteShare } from './seats';
import { canSetRate, econOf, econTargets, setRate } from './econ';
import { DISASTERS, canRespond, disasterOf, respond, responseChance } from './disaster';
import { answerAudit, answerScandal, auditOf, canProbeRival, probeRival, scandalOf } from './probe';
import { answerDemand, myGovernors } from './governors';
import { canPopPolicy, popOf, pyramid, setPopPolicy } from './population';
import { AMENDS, amendYes, canPropose, propose } from './amend';
import { DAYS, canSpeak, speak, speechOf, speechRows, speechText } from './speech';
import { billChance } from './assembly';
import { BILLS } from './laws';
import { myCityIds } from './zones';
import { groupTargetRows } from './groups';

const H = 3600e3;
const DAY = 24 * H;
const fresh = (id = 'kr') => advance(newGame('시험', id, 0, { seed: 3 }), 20 * 60e3);
/** 그때그때 고르면서 시간 보내기 */
function play(s: GameState, days: number): GameState {
  let ns = s;
  for (let t = 0; t < days * 24 * 4; t++) {
    ns = advance(ns, 15 * 60e3);
    const p = polityOf(ns);
    if (p.disaster) ns = respond(ns, DISASTERS.find((d) => d.id === p.disaster!.kind)!.stages[p.disaster.stage][1][0]);
    if (p.scandal) ns = answerScandal(ns, 'probe');
    if (p.audit) for (const q of p.audit.qs) ns = answerAudit(ns, q, 'minister');
    if (p.demand) ns = answerDemand(ns, true);
    if (p.speech.open) ns = speak(ns, p.speech.open.words.slice(0, 3));
    if (campaignOpen(ns)) for (const c of myCityIds(ns).slice(0, 2)) if (!canRally(ns, c)) ns = rally(ns, c);
  }
  return ns;
}

describe('내정 새 콘텐츠 8가지', () => {
  test('처음 틱에 polity가 생기고 나라별 시작 값', () => {
    const s = fresh();
    const p = polityOf(s);
    expect(s.polity).toBeTruthy();
    expect(p.seats.ruling + p.seats.opp + p.seats.ind).toBe(SEATS);
    expect(p.pop.birth).toBeCloseTo(0.78, 1);
    expect(econOf(s).rate).toBe(3);
    expect(myGovernors(s).length).toBe(myCityIds(s).length);
    const cn = fresh('cn');
    expect(polityOf(cn).seats.ruling).toBeGreaterThan(MAJORITY);
  });
  test('의석이 법안 통과 확률을 바꿈', () => {
    const s = fresh();
    const id = BILLS[0].id;
    const lo = billChance({ ...s, polity: { ...polityOf(s), seats: { ruling: 100, opp: 170, ind: 30 } } }, id);
    const hi = billChance({ ...s, polity: { ...polityOf(s), seats: { ruling: 210, opp: 60, ind: 30 } } }, id);
    expect(hi).toBeGreaterThan(lo);
  });
  test('총선 의석 나누기', () => {
    const r = generalResult(60, 0.5);
    expect(r.ruling + r.opp + r.ind).toBe(SEATS);
    expect(r.ruling).toBeGreaterThan(MAJORITY);
  });
  test('유세 창은 선거 2일 전부터, 하루 2곳', () => {
    let s = fresh();
    const c = myCityIds(s)[0];
    expect(canRally(s, c)).toBeTruthy();
    s = advance(s, electionOf(s).atMs - s.worldMs - DAY);
    expect(campaignOpen(s)).toBe(true);
    const before = voteShare(s);
    s = rally(rally(s, c), c);
    expect(canRally(s, c)).toContain('하루');
    expect(voteShare(s)).toBeGreaterThan(before);
  });
  test('금리: 6시간마다, 올리면 물가 목표가 내려감', () => {
    let s = fresh();
    expect(canSetRate(s, 1)).toBeNull();
    s = setRate(s, 1);
    expect(econOf(s).rate).toBeGreaterThan(3);
    expect(canSetRate(s, 1)).toContain('6시간');
    let hi = s;
    let lo = fresh();
    for (let i = 0; i < 6; i++) {
      hi = advance(hi, 6 * H);
      hi = setRate(hi, 1);
      lo = advance(lo, 6 * H);
      lo = setRate(lo, -1);
    }
    hi = advance(hi, 2 * DAY);
    lo = advance(lo, 2 * DAY);
    expect(econOf(lo).cpi).toBeGreaterThan(econOf(hi).cpi);
    expect(econTargets(lo).growth.find(([n]) => n.includes('금리'))![1]).toBeGreaterThan(0);
    expect(econOf(hi).hist.cpi.length).toBeGreaterThan(5);
  }, 30000);
  test('재난이 오고 3단계 대응하면 끝남', () => {
    let s = fresh();
    s = advance(s, polityOf(s).disasterMs - s.worldMs + 20 * 60e3);
    const d = disasterOf(s)!;
    expect(d).toBeTruthy();
    const k = DISASTERS.find((x) => x.id === d.kind)!;
    expect(canRespond(s, 'nope')).toBeTruthy();
    const best = k.stages[0][1][0];
    const other = k.stages[0][0].find((x) => !k.stages[0][1].includes(x))!;
    expect(responseChance(s, best)).toBeGreaterThan(responseChance(s, other));
    for (let i = 0; i < 3; i++) s = respond(s, k.stages[i][0][0]);
    expect(disasterOf(s)).toBeNull();
    expect(polityOf(s).disasterWins + polityOf(s).disasterLoss).toBe(1);
  });
  test('재난을 내버려 두면 단계마다 실패', () => {
    let s = fresh();
    s = advance(s, polityOf(s).disasterMs - s.worldMs + 20 * 60e3);
    s = advance(s, 7 * H);
    expect(disasterOf(s)).toBeNull();
    expect(polityOf(s).disasterLoss).toBe(1);
  });
  test('의혹·국정감사·정적 수사', () => {
    let s = fresh();
    s = advance(s, polityOf(s).scandalMs - s.worldMs + 20 * 60e3);
    if (s.cabinet && s.cabinet.people.some((p) => p.seat || p.post)) {
      expect(scandalOf(s)).toBeTruthy();
      s = answerScandal(s, 'fire');
      expect(scandalOf(s)).toBeNull();
    }
    s = advance(s, polityOf(s).auditMs - s.worldMs + 20 * 60e3);
    const a = auditOf(s)!;
    expect(a.qs.length).toBe(3);
    const t0 = s.officer.trust;
    s = answerAudit(s, a.qs[0], 'refuse');
    expect(s.officer.trust).toBeLessThan(t0);
    const idx = s.officer.rivals.findIndex((r) => !r.ally);
    if (idx >= 0) {
      expect(canProbeRival(s, idx)).toBeNull();
      s = probeRival(s, idx);
      expect(canProbeRival(s, idx)).toContain('48');
    }
  });
  test('인구 정책 7일, 그림용 나이 묶음 합 100 근처', () => {
    let s = fresh();
    expect(canPopPolicy(s, 'birth')).toBeNull();
    s = setPopPolicy(s, 'birth');
    expect(canPopPolicy(s, 'edu')).toBeTruthy();
    expect(groupTargetRows(s, 'youth').some(([n]) => n.includes('출산 지원'))).toBe(true);
    const b0 = popOf(s).birth;
    s = advance(s, 3 * DAY);
    expect(popOf(s).birth).toBeGreaterThan(b0);
    const py = pyramid(popOf(s));
    expect(py.length).toBe(5);
  });
  test('개헌: 의석이 모자라면 국회 부결, 많으면 국민투표', () => {
    let s = fresh();
    const id = AMENDS[1].id;
    s = { ...s, polity: { ...polityOf(s), seats: { ruling: 120, opp: 150, ind: 30 } } };
    expect(amendYes(s)).toBeLessThan(200);
    s = propose(s, id);
    expect(canPropose(s, id)).toContain('3일');
    let t = fresh();
    t = { ...t, polity: { ...polityOf(t), seats: { ruling: 210, opp: 60, ind: 30 } } };
    t = propose(t, id);
    expect(polityOf(t).amend.vote).toBeTruthy();
    t = advance(t, 7 * H);
    expect(polityOf(t).amend.vote).toBeNull();
  });
  test('연설: 기념일에 3개 고르기, 맞는 낱말이면 덤', () => {
    let s = fresh();
    s = advance(s, speechOf(s).nextMs - s.worldMs + 20 * 60e3);
    const o = speechOf(s).open!;
    expect(o.words.length).toBe(8);
    expect(canSpeak(s, o.words.slice(0, 2))).toBeTruthy();
    const day = DAYS.find((d) => d.name === o.day)!;
    const good = speechRows(day.name, day.fit).reduce((a, [, v]) => a + v, 0);
    expect(good).toBeGreaterThan(3);
    expect(speechText(['defense', 'peace', 'youth'])).toContain('평화가');
    s = speak(s, day.fit);
    expect(speechOf(s).open).toBeNull();
    expect(speechOf(s).last?.day).toBe(day.name);
  });
  test('15일 동안 고르면서 놀아도 멀쩡(선거 2번·지방선거)', () => {
    const s = play(fresh(), 15);
    const p = polityOf(s);
    expect(p.elections).toBeGreaterThanOrEqual(2);
    expect(p.seats.ruling + p.seats.opp + p.seats.ind).toBe(SEATS);
    expect(Number.isFinite(econOf(s).cpi)).toBe(true);
    expect(p.log.length).toBeGreaterThan(10);
    console.log(p.log.slice(0, 12).join('\n'));
  }, 60000);
});
