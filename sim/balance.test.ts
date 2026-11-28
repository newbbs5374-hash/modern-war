// 밸런스 모의 실험(시험 아님): 무과금 플레이어가 세계정복까지 며칠 걸리는지.
//  C=나라, SEEDS=씨앗들, DAYS=실제 날 수, LOGINS=하루 접속 시각(쉼표), SKILL=0 맡기기/1 직접 잘함, WARS=동시에 싸울 나라 수
//  OUT=결과 json 경로
import { test, vi } from 'vitest';
// BAL='{"REBEL_CHANCE":0.004}' 처럼 balance.ts 숫자를 바꿔서 돌려 볼 수 있음
// OFF='{"GRAND_COOLDOWN_HOURS":10}' · GRAND_H=3(대전투 준비 시간)
vi.mock('../src/data/officers', async (orig) => {
  const o = await orig<Record<string, unknown>>();
  const mk = { ...(o.MISSION_KINDS as Record<string, { hours: number }>) };
  if (process.env.GRAND_H) mk['대전투'] = { ...mk['대전투'], hours: Number(process.env.GRAND_H) };
  return { ...o, MISSION_KINDS: mk, ...JSON.parse(process.env.OFF ?? '{}') };
});
vi.mock('../src/game/balance', async (orig) => {
  const o = await orig<Record<string, unknown>>();
  const m = Number(process.env.AI_MULT ?? 1); // AI 나라 힘 배율을 한꺼번에 올리거나 내려 보기
  const ai = o.aiStrength as (id: string, player: string) => number;
  return { ...o, ...(m !== 1 ? { aiStrength: (id: string, player: string) => (id === player ? 1 : ai(id, player) * m) } : {}), ...JSON.parse(process.env.BAL ?? '{}') };
});
import { writeFileSync } from 'node:fs';
import { advance, newGame, defOf, budgetPerDay, type GameState } from '../src/game/state';
import { claimPay } from '../src/game/payday';
import { trackGoals, claimAll, claimDaily, goalsOf, rubyOf, goalsTick, SPOILS } from '../src/game/goals';
import { boostsOf, useBoost, boostLeft, BOOST_MS } from '../src/game/boost';
import { canDiplo, doDiplo } from '../src/game/command';
import { canGrand, claimMission, grandTargets, startGrand, canTrain, startTraining, finishTraining, boardNow, startMission, missionChance } from '../src/game/officer';
import { canChore, claimChore, startChore, produce, canProduce, canUpgrade, upgradeFacility } from '../src/game/economy';
import { BUILDING_IDS } from '../src/data/economy';
import { UNITS, TRAININGS } from '../src/data/catalog';
import { FRONT, cityById } from '../src/data/cities';
import { COUNTRIES, countryById } from '../src/data/world';
import { isAlive, relationOf, homeOf } from '../src/game/world';
import { canVote, startVote, occupiedCities, annexedCount, canChoose, makePuppet } from '../src/game/annex';
import { canResearch, startResearch, civOf, hasTech } from '../src/game/civ';
import { TECHS } from '../src/data/civ';
import { Rng } from '../src/game/rng';
import { actGoals } from '../src/game/acts';
import { victoryProgress } from '../src/game/victory';
import { buyGrand, canBuyGrand } from '../src/game/acts';
import { canMobilize, canStep, cbOf, doStep, ladderOf, mobilize, type StepId } from '../src/game/ladder';
import { canUnify, proposeUnify } from '../src/game/unify';
import { influenceProgress } from '../src/game/influence';

const H = 3600e3;
const env = (k: string, d: string) => process.env[k] ?? d;
const SKILL = Number(env('SKILL', '0'));
const WARS = Number(env('WARS', '2'));
const DAYS = Number(env('DAYS', '50'));
const LOGINS = env('LOGINS', '8,13,21').split(',').map(Number);
const ENGAGE = Number(env('ENGAGE', '0.7')); // 모의 실험이 흉내 못 내는 할 일(투표·사건·첩보·협정)을 해낼 확률
const TRAINS = Number(env('TRAINS', '3')); // 접속마다 훈련 수
const PUPPET = env('PUPPET', '0') === '1';
const USE_BOOST = env('USE_BOOST', '1') === '1';
const BOOST_SHARE = Number(env('BOOST_SHARE', '1')); // 얻은 루비·가속권 중 정복(대전투)에 쓰는 몫. 나머지는 건물·연구 등 다른 데 쓴 것으로 침
// 11-28 중후반 개편 뒤: PAID=하루 산 루비(중과금 150) · EXTRA=1 대전투 추가 구매 · LADDER=1 분쟁 사다리(명분→총동원 24h)로 선포 · UNIFY=1 통일 권유
const PAID = Number(env('PAID', '0'));
const EXTRA = env('EXTRA', '1') === '1';
const LADDER = env('LADDER', '1') === '1';
const UNIFY = env('UNIFY', '1') === '1';

/** 맡기기(자동) 3막 공성전 승률: sim/siege.test.ts 로 잰 값 */
function grandWinChance(d: number): number {
  if (SKILL >= 1) return 0.95;
  const pts: Array<[number, number]> = [[1.1, 1], [1.2, 0.73], [1.3, 0.75], [1.5, 0.58], [2.0, 0.27], [2.7, 0.04]];
  if (d <= pts[0][0]) return 1;
  for (let i = 1; i < pts.length; i++) if (d <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (d - x0)) / (x1 - x0); }
  return 0.04;
}

interface Tally { mobs: number; steps: number; blocked: Record<string, number>; unifyTry: number; unifyOk: number; bought: number; grandTry: number; grandWin: number; boostsUsed: number; rubySpent: number; declared: number; boostGot: number; src: Record<string, number>; bsrc: Record<string, number>; lostRebel: number; lostInv: number; lostHome: number; seenT: number; elsewhere: number }

function mkBot(seed: number) {
  const rng = new Rng(seed * 977 + 5);
  const tally: Tally = { mobs: 0, steps: 0, blocked: {}, unifyTry: 0, unifyOk: 0, bought: 0, grandTry: 0, grandWin: 0, boostsUsed: 0, rubySpent: 0, declared: 0, boostGot: 0, src: {}, bsrc: {}, lostRebel: 0, lostInv: 0, lostHome: 0, seenT: -1, elsewhere: 0 };
  const add = (o: Record<string, number>, k: string, v: number) => { if (v) o[k] = (o[k] ?? 0) + v; };
  const act = (s: GameState, f: (s: GameState) => GameState): GameState => { const a = f(s); return a === s ? s : trackGoals(s, a); };
  const me = (s: GameState) => s.player.countryId;
  const enemies = (s: GameState) => COUNTRIES.map((c) => c.id).filter((id) => id !== me(s) && isAlive(s.world, id) && relationOf(s.world, me(s), id) === '전쟁');

  function resolve(s: GameState): GameState {
    const a = s.officer.active;
    if (!a || s.worldMs < a.endMs) return s;
    if (a.kind === '대전투') {
      tally.grandTry++;
      const win = rng.chance(grandWinChance(a.difficulty));
      if (win) tally.grandWin++;
      return act(s, (x) => claimMission(x, { win, stars: win ? (SKILL >= 1 ? 3 : 2) : 0 }).state);
    }
    const win = rng.chance(missionChance(s, a));
    return act(s, (x) => claimMission(x, { win, stars: win ? 2 : 0 }).state);
  }
  function spend(s: GameState, kind: 'mission' | 'grand'): GameState {
    const need = Math.ceil(boostLeft(s, { kind }) / BOOST_MS);
    if (need <= 0) return s;
    const b0 = boostsOf(s), r0 = rubyOf(s);
    const ns = useBoost(s, { kind }, need);
    tally.boostsUsed += b0 - boostsOf(ns);
    tally.rubySpent += r0 - rubyOf(ns);
    return ns;
  }
  const afford = (s: GameState) => boostsOf(s) + Math.floor(rubyOf(s) / 5);

  function wars(s: GameState): GameState {
    const cur = enemies(s);
    const myMobs = ladderOf(s).mobs.filter((m) => m.by === me(s)).length;
    if (cur.length + (LADDER ? myMobs : 0) >= WARS) return s;
    // 가까운(같은 대륙) 나라·도시가 적은 나라부터
    const my = countryById(me(s));
    const cand = COUNTRIES.filter((c) => c.id !== me(s) && isAlive(s.world, c.id) && !cur.includes(c.id) && !canDiplo(s, c.id, '선전포고'))
      .map((c) => ({ id: c.id, k: (c.continent === my.continent ? 0 : 1) * 1000 + (s.nations[c.id]?.troops ?? 0) / 1000 + (relationOf(s.world, me(s), c.id) === '연합' ? 500 : 0) }))
      .sort((a, b) => a.k - b.k);
    let out = s;
    if (!LADDER) {
      for (const c of cand.slice(0, WARS - cur.length)) {
        out = act(out, (x) => doDiplo(x, c.id, '선전포고').state);
        tally.declared++;
      }
      return out;
    }
    // 11-28 분쟁 사다리: 명분이 차면 총동원(24시간 뒤 자동 선포), 모자라면 사다리를 오름
    for (const c of cand.slice(0, WARS - cur.length - myMobs)) {
      if (ladderOf(out).mobs.some((m) => m.by === me(out) && m.vs === c.id)) continue;
      const why = canMobilize(out, c.id);
      if (!why) {
        out = act(out, (x) => mobilize(x, c.id).state);
        tally.mobs++;
        continue;
      }
      const key = why.split(' ')[0];
      tally.blocked[key] = (tally.blocked[key] ?? 0) + 1;
      if (cbOf(out, c.id) < 60)
        for (const st of ['strike', 'shadow', 'tariff', 'protest'] as StepId[])
          if (!canStep(out, c.id, st)) {
            out = act(out, (x) => doStep(x, c.id, st).state);
            tally.steps++;
            break;
          }
    }
    return out;
  }

  function grandLoop(s: GameState): GameState {
    let out = s;
    for (let i = 0; i < 40; i++) {
      out = resolve(out);
      if (out.officer.active) {
        // 진행 중: 가속권이 넉넉하면 바로 끝냄
        const need = Math.ceil(boostLeft(out, { kind: 'mission' }) / BOOST_MS);
        if (!USE_BOOST || out.officer.active.kind !== '대전투' || need <= 0 || afford(out) < need) break;
        out = spend(out, 'mission');
        continue;
      }
      if (!grandTargets(out).length) { out = wars(out); if (!grandTargets(out).length) break; }
      let why = canGrand(out);
      if (why && EXTRA && !canBuyGrand(out)) {
        out = buyGrand(out);
        tally.bought++;
        why = canGrand(out);
      }
      if (why) {
        const need = Math.ceil(boostLeft(out, { kind: 'grand' }) / BOOST_MS);
        if (USE_BOOST && need > 0 && out.worldMs < out.officer.grandReadyMs && afford(out) >= need) { out = spend(out, 'grand'); continue; }
        break;
      }
      const t = grandTargets(out)[0];
      out = act(out, (x) => startGrand(x, t, true));
    }
    // 대전투를 못 하는 동안엔 보통 임무
    if (!out.officer.active) {
      const b = boardNow(out); out = b.state;
      const best = [...b.board].sort((x, y) => missionChance(out, y) - missionChance(out, x))[0];
      if (best) out = act(out, (x) => startMission(x, best.id));
    }
    return out;
  }

  function economy(s: GameState): GameState {
    let out = s;
    if (out.economy.chore && out.worldMs >= out.economy.chore.endMs) out = act(out, claimChore);
    if (!canChore(out)) out = act(out, (x) => startChore(x, '산업'));
    // 부대: 만들 수 있는 가장 센 것부터 줄을 채움
    for (let i = 0; i < 5; i++) {
      const u = [...UNITS].reverse().find((u) => !canProduce(out, u.name));
      if (!u) break;
      out = act(out, (x) => produce(x, u.name));
    }
    // 시설: 올릴 수 있는 것 하나
    for (const id of BUILDING_IDS) if (!canUpgrade(out, id)) { out = act(out, (x) => upgradeFacility(x, id)); break; }
    // 연구
    const c = civOf(out);
    for (const line of ['mil', 'soc'] as const) {
      if (c.cur[line]) continue;
      const t = TECHS.find((t) => t.line === line && !canResearch(out, t.id));
      if (t) out = act(out, (x) => startResearch(x, t.id));
    }
    return out;
  }

  function occupation(s: GameState): GameState {
    let out = s;
    for (const id of occupiedCities(out)) {
      if (PUPPET && !canChoose(out, id)) out = act(out, (x) => makePuppet(x, id));
      else if (!canVote(out, id)) out = act(out, (x) => startVote(x, id));
    }
    if (UNIFY)
      for (const c of COUNTRIES) {
        if (c.id === me(out) || !isAlive(out.world, c.id) || canUnify(out, c.id)) continue;
        const r = proposeUnify(out, c.id);
        tally.unifyTry++;
        if (r.ok) tally.unifyOk++;
        out = trackGoals(out, r.state);
      }
    return out;
  }

  function training(s: GameState): GameState {
    let out = s;
    const ok = TRAININGS.filter((t) => t.rank <= out.player.rankIndex);
    for (let k = 0; k < TRAINS; k++) {
      const t = ok[Math.floor(rng.next() * ok.length)].name;
      if (canTrain(out, t)) continue;
      out = act(out, (x) => startTraining(x, t));
      const stars = SKILL >= 1 ? (rng.chance(0.6) ? 3 : 2) : 2;
      out = act(out, (x) => finishTraining(x, { win: true, stars, auto: SKILL < 1 }).state);
    }
    return out;
  }

  function rewards0(s: GameState, lastOfDay: boolean): GameState {
    const pr0 = rubyOf(s), pb0 = boostsOf(s);
    let out = act(s, claimPay);
    add(tally.src, '봉급날', rubyOf(out) - pr0); add(tally.bsrc, '봉급날', boostsOf(out) - pb0);
    tally.boostGot += boostsOf(out) - pb0;
    out = goalsTick(out);
    if (lastOfDay) {
      // 흉내 못 내는 할 일은 확률로 해낸 것으로 침
      const g = goalsOf(out);
      const daily = g.daily.map((d) => (d.have < d.need && ['pact', 'vote', 'event', 'spy'].includes(d.id) && rng.chance(ENGAGE) ? { ...d, have: d.need } : d));
      out = { ...out, goals: { ...g, daily } };
    }
    const b0 = boostsOf(out);
    {
      const g = goalsOf(out);
      let sr = 0, sb = 0;
      for (const x of g.spoils ?? []) { const big = !SPOILS[x.k].small; add(tally.src, big ? `전과(큰): ${SPOILS[x.k].name}` : '전과(작은 것, 하루 상한)', x.ruby); add(tally.bsrc, big ? `전과(큰): ${SPOILS[x.k].name}` : '전과(작은 것, 하루 상한)', x.boosts ?? 0); sr += x.ruby; sb += x.boosts ?? 0; }
      const r1 = rubyOf(out);
      let o2 = out; g.daily.forEach((_, i) => (o2 = claimDaily(o2, i)));
      add(tally.src, '매일 할 일', rubyOf(o2) - r1); add(tally.bsrc, '매일 할 일', boostsOf(o2) - b0);
      const all = claimAll(out);
      add(tally.src, '업적', rubyOf(all) - r1 - sr - (rubyOf(o2) - r1)); add(tally.bsrc, '업적', boostsOf(all) - b0 - sb - (boostsOf(o2) - b0));
    }
    out = claimAll(out);
    tally.boostGot += boostsOf(out) - b0;
    return out;
  }

  function losses(s: GameState) {
    const meName = countryById(me(s)).name;
    for (const e of s.world.events) {
      if (e.t <= tally.seenT) break;
      if (e.kind !== '점령') continue;
      if (e.text.includes('반란') && e.text.includes(`${meName}의 점령이 끝나고`)) tally.lostRebel++;
      else if (e.text.includes('반란') && e.text.includes('되살아났어요') && e.mine) tally.lostRebel++;
      else if (new RegExp(` ${meName}의 .+ (점령했어요|되찾았어요)\\.$`).test(e.text)) tally.lostInv++;
    }
    tally.seenT = s.world.events[0]?.t ?? tally.seenT;
  }
  function rewards(s: GameState, lastOfDay: boolean): GameState {
    const out = rewards0(s, lastOfDay);
    if (BOOST_SHARE >= 1) return out;
    const dr = Math.max(0, rubyOf(out) - rubyOf(s)), db = Math.max(0, boostsOf(out) - boostsOf(s));
    const cut = (n: number) => { const x = n * (1 - BOOST_SHARE); return Math.floor(x) + (rng.chance(x - Math.floor(x)) ? 1 : 0); };
    const cr = cut(dr), cb = cut(db);
    tally.elsewhere += cr / 5 + cb;
    return { ...out, goals: { ...goalsOf(out), ruby: rubyOf(out) - cr }, officer: { ...out.officer, boosts: boostsOf(out) - cb } };
  }
  function session(s: GameState, lastOfDay: boolean): GameState {
    losses(s);
    let out = rewards(s, false);
    out = wars(out);
    out = grandLoop(out);
    out = economy(out);
    out = occupation(out);
    out = training(out);
    out = rewards(out, lastOfDay);
    out = grandLoop(out); // 방금 받은 가속권·루비로 한 번 더
    return out;
  }
  return { session, tally };
}

test('밸런스 모의 실험', () => {
  const all: unknown[] = [];
  for (const country of env('C', 'kr').split(',')) for (const seed of env('SEEDS', '11').split(',').map(Number)) {
    let s = newGame('sim', country, 0, { seed, realWorld: true, acts: env('ACTS', '0') === '1' });
    const bot = mkBot(seed);
    const rows: unknown[] = [];
    const me = country;
    const total = FRONT.length;
    const mile: Record<string, number | null> = { inf600: null, mil100: null, soc70: null, c25: null, win48: null, c76: null, c100: null, firstCap: null, act2: null, act3: null, act4: null, won: null };
    let rubyEarned = 0, rubyPrev = 0;
    const t0 = Date.now();
    for (let day = 0; day < DAYS; day++) {
      if (PAID) s = { ...s, goals: { ...goalsOf(s), ruby: rubyOf(s) + PAID } };
      LOGINS.forEach((h, i) => {
        s = advance(s, (day * 24 + h) * H - s.worldMs);
        const spent0 = bot.tally.rubySpent;
        const r0 = rubyOf(s);
        s = bot.session(s, i === LOGINS.length - 1);
        rubyEarned += rubyOf(s) - r0 + (bot.tally.rubySpent - spent0);
      });
      const mine = FRONT.filter((c) => s.world.owner[c.id] === me).length;
      const homeKept = FRONT.filter((c) => c.home === me && s.world.owner[c.id] === me).length;
      const p = victoryProgress(s);
      const d1 = day + 1;
      if (mile.firstCap == null && mine > FRONT.filter((c) => c.home === me).length) mile.firstCap = d1;
      if (mile.c25 == null && mine >= total * 0.25) mile.c25 = d1;
      if (mile.win48 == null && mine >= p.needAlone) mile.win48 = d1;
      if (mile.c76 == null && mine >= total * 0.76) mile.c76 = d1;
      if (mile.c100 == null && mine >= total) mile.c100 = d1;
      for (const a of [2, 3, 4]) if (mile[`act${a}`] == null && (s.world.act ?? 0) >= a) mile[`act${a}`] = d1;
      // 연구 트리 다 끝낸 날(11-27 연구 비용)
      if (mile.mil100 == null && TECHS.every((t) => t.line !== 'mil' || hasTech(s, t.id))) mile.mil100 = d1;
      if (mile.soc70 == null && TECHS.every((t) => t.line !== 'soc' || hasTech(s, t.id))) mile.soc70 = d1;
      const ai = COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id));
      rows.push({
        day: d1, mine, homeKept, occupied: occupiedCities(s).length, annexed: annexedCount(s), alive: ai.length,
        wars: ai.filter((c) => relationOf(s.world, me, c.id) === '전쟁').length,
        myTroops: Math.round(s.nations[me].troops), aiTroops: Math.round(ai.reduce((a, c) => a + s.nations[c.id].troops, 0)),
        topAi: Math.round(Math.max(0, ...ai.map((c) => s.nations[c.id].troops))),
        treasury: Math.round(s.nations[me].treasury), def: Math.round(defOf(s)), income: Math.round(budgetPerDay(s, me) * 24),
        power: Math.round(s.economy.power), ruby: rubyOf(s), rubyEarned, rubyDay: rubyEarned - rubyPrev, boosts: boostsOf(s), boostGot: bot.tally.boostGot, boostsUsed: bot.tally.boostsUsed, rubySpent: bot.tally.rubySpent,
        grandTry: bot.tally.grandTry, grandWin: bot.tally.grandWin, lostRebel: bot.tally.lostRebel, lostInv: bot.tally.lostInv, trust: Math.round(s.officer.trust), title: s.player.title ?? 0, ending: s.ending?.kind ?? null,
        growAvg: Math.round((ai.reduce((a, c) => a + Object.values(s.world.grow?.[c.id]?.lv ?? {}).reduce((x, y) => x + y, 0), 0) / Math.max(1, ai.length)) * 10) / 10,
      });
      rubyPrev = rubyEarned;
      {
        const ip = influenceProgress(s);
        const r = rows[rows.length - 1] as Record<string, unknown>;
        r.inf = Math.round(ip.mine?.total ?? 0);
        r.infPlace = ip.place;
        r.inf2 = Math.round(ip.second?.total ?? 0);
        if (mile.inf600 == null && ip.ok) mile.inf600 = d1;
      }
      if (s.ending && mile.won == null) {
        mile.won = day;
        (mile as Record<string, unknown>).wonKind = s.ending.kind;
      }
      if (s.ending) s = { ...s, ending: null, wins: [...(s.wins ?? []), s.ending] };
      if (mine >= total) break;
    }
    const last = rows[rows.length - 1] as Record<string, number>;
    const ip = influenceProgress(s);
    console.log(`  11-28: 결말 ${(mile as Record<string, unknown>).wonKind ?? '-'} d${mile.won} · 영향력 ${Math.round(ip.mine?.total ?? 0)}(${ip.place}등, 2등 ${Math.round(ip.second?.total ?? 0)}) 600+1.5배 첫날 d${mile.inf600} · 사다리 ${bot.tally.steps}번 총동원 ${bot.tally.mobs}번 막힘 ${JSON.stringify(bot.tally.blocked)} · 통일 ${bot.tally.unifyOk}/${bot.tally.unifyTry} · 대전투 추가 구매 ${bot.tally.bought}`);
    if (process.env.ACTS) console.log(`  승리 d${mile.won} · 반격 막음 ${s.counter?.won ?? 0} 뺏김 ${s.counter?.lost ?? 0} · 수도 ${victoryProgress(s).capsHave}/3`);
    if (process.env.ACTS) console.log('  장 조건: ' + actGoals(s).map((g) => `${g.text} ${g.have}/${g.need}`).join(' · '));
    console.log(`${country} seed${seed} logins${LOGINS.length} skill${SKILL} wars${WARS} | 첫 점령 d${mile.firstCap} · 25% d${mile.c25} · 정복승리조건(48%) d${mile.win48} · 76% d${mile.c76} · 100% d${mile.c100} · 장 2/3/4 d${mile.act2}/d${mile.act3}/d${mile.act4} · 연구 군사 d${mile.mil100} 사회 d${mile.soc70} | 끝 d${last.day}: 도시 ${last.mine}/${total} 편입 ${last.annexed} 대전투 ${last.grandWin}/${last.grandTry} 루비 번 것 ${last.rubyEarned} 가속권 쓴 것 ${last.boostsUsed}(+루비 ${last.rubySpent}) 신뢰 ${last.trust} 잃음(반란 ${last.lostRebel}·침공 ${last.lostInv}) | ${Math.round((Date.now() - t0) / 1000)}s`);
    all.push({ country, seed, logins: LOGINS, skill: SKILL, wars: WARS, mile, rows, src: bot.tally.src, bsrc: bot.tally.bsrc });
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(all));
}, 3_600_000);
