// 균형 시뮬(시험 아님): 하루 3번 접속하는 사람이 자동전투로만 해도 어디까지 가는지.
import { test } from 'vitest';
import { autoResult } from '../src/battle/auto';
import { planForMission, planOutcome, nextDifficulty, trainingPlan } from '../src/battle/spec';
import { TRAININGS } from '../src/data/catalog';
import { advance, claimSalary, newGame, type GameState } from '../src/game/state';
import { COMMAND_TOP, canDiplo, diploChance, diploReady, doDiplo } from '../src/game/command';
import { boardNow, canGrand, canTrain, claimMission, finishTraining, grandTargets, missionChance, perkBonus, promotionCheck, startExam, startGrand, startMission, startTraining } from '../src/game/officer';
import { canChore, claimChore, startChore, produce, canProduce } from '../src/game/economy';
import { UNITS } from '../src/data/catalog';
import { CITIES } from '../src/data/cities';
import { COUNTRIES } from '../src/data/world';
import { relationOf } from '../src/game/world';

const H = 3600e3;
const SKILL = Number(process.env.SKILL ?? 0); // 0 = 자동만, 1 = 직접(별 +1)

function stats(s: GameState) {
  const st: Record<string, number> = { ...s.officer.stats };
  for (const [k, v] of Object.entries(perkBonus(s.officer))) st[k] = (st[k] ?? 0) + v;
  return st;
}
function fight(s: GameState): { win: boolean; stars: number } {
  const a = s.officer.active!;
  const plan = planForMission(a, s.player.rankIndex, s.officer.seed);
  const res: Array<{ win: boolean; stars: number }> = [];
  for (const st of plan.stages) {
    const r = autoResult({ spec: { ...st, difficulty: nextDifficulty(st.difficulty, res) }, stats: stats(s), rank: s.player.rankIndex, aides: s.officer.aides });
    res.push({ win: r.win, stars: Math.min(3, r.stars + SKILL) });
  }
  return planOutcome(plan, res);
}

function session(s: GameState, log: string[]): GameState {
  s = claimSalary(s);
  // 끝난 임무
  if (s.officer.active && s.worldMs >= s.officer.active.endMs) {
    const r = claimMission(s, fight(s));
    s = r.state;
    if (r.text && (r.text.includes('진급') || r.text.includes('통과') || r.text.includes('점령'))) log.push(`d${(s.worldMs / H / 24).toFixed(1)} r${s.player.rankIndex} ${r.text}`);
  }
  // 훈련: 계급 맞는 것 돌아가며
  const ok = TRAININGS.filter((t) => t.rank <= s.player.rankIndex);
  let k = 0;
  while (!canTrain(s, ok[k % ok.length].name) && k < 50) {
    const t = ok[k % ok.length].name;
    s = startTraining(s, t);
    const plan = trainingPlan(t, s.player.rankIndex, s.officer.training!.seed);
    const r = autoResult({ spec: plan.stages[0], stats: stats(s), rank: s.player.rankIndex, aides: [] });
    s = finishTraining(s, { win: r.win, stars: Math.min(3, r.stars + SKILL), auto: SKILL === 0 }).state;
    k++;
  }
  // 내정
  if (s.economy.chore && s.worldMs >= s.economy.chore.endMs) s = claimChore(s);
  if (!canChore(s)) s = startChore(s, '산업');
  for (const u of [...UNITS].reverse()) if (!canProduce(s, u.name)) { s = produce(s, u.name); break; }
  // 총사령관 외교: 가장 될 것 같은 연합 제안
  if (s.player.rankIndex >= COMMAND_TOP && s.worldMs >= diploReady(s)) {
    const opts = COUNTRIES.filter((c) => c.id !== s.player.countryId && !canDiplo(s, c.id, '연합 제안'))
      .map((c) => ({ id: c.id, p: diploChance(s, c.id, '연합 제안') }))
      .sort((x, y) => y.p - x.p);
    if (opts[0]) {
      const r = doDiplo(s, opts[0].id, '연합 제안');
      s = r.state;
      log.push(`d${Math.floor(s.worldMs / 86400e3)} ${r.text}`);
    }
  }
  // 진급 심사 > 대전투 > 임무
  if (!s.officer.active) {
    if (promotionCheck(s).ready) s = startExam(s);
    else if (!canGrand(s)) s = startGrand(s, grandTargets(s)[0]);
    else {
      const b = boardNow(s);
      s = b.state;
      const best = [...b.board].sort((x, y) => missionChance(s, y) * y.difficulty * (y.kind === '작전' ? 2.2 : 1) - missionChance(s, x) * x.difficulty * (x.kind === '작전' ? 2.2 : 1))[0];
      if (best) s = startMission(s, best.id);
    }
  }
  return s;
}

test('한 판 시뮬', () => {
  for (const country of (process.env.C ?? 'kr,us,kp').split(',')) {
    let s = newGame('sim', country, 0, { seed: 11 });
    const log: string[] = [];
    const rankDay: number[] = [0];
    let won = '';
    const times = [8, 13, 21]; // 아침·점심·밤 접속
    for (let day = 0; day < 160; day++) {
      for (const h of times) {
        const target = (day * 24 + h) * H;
        // 임무가 짧으면 한 번 접속에서 끝날 때까지 기다리지 않음
        s = advance(s, target - s.worldMs);
        s = session(s, log);
        while (rankDay.length <= s.player.rankIndex) rankDay.push(day);
        if (s.ending && !won) won = `${s.ending.kind} d${day}`;
      }
    }
    const me = s.player.countryId;
    const mine = CITIES.filter((c) => s.world.owner[c.id] === me).length;
    const allied = CITIES.filter((c) => { const o = s.world.owner[c.id]; return o === me || relationOf(s.world, me, o) === '연합'; }).length;
    console.log(country, 'WIN', won, 'rank by day', rankDay.join(','), 'final rank', s.player.rankIndex, 'cities', mine, 'allied', allied, '/', CITIES.length, 'power', s.economy.power, 'stars?', s.officer.stars, 'merit', Math.round(s.officer.merit), 'trust', Math.round(s.officer.trust));
    console.log(log.filter((l) => l.includes('점령')).length, 'captures;', log.slice(-6).join('\n'));
  }
}, 600_000);
