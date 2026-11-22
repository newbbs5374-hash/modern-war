// 전투 틀 ② 옆보기 실시간: 옆에서 본 전장, 1초 20번 계산. 명령(포격·연막·돌격)을 고를 때만 멈춤.
// 호송(트럭을 끝까지) · 돌파(적 진지 부수기) · 버티기(시간 끝까지). 같은 씨앗 + 같은 입력 = 같은 결과.
import { Rng } from '../game/rng';
import { UNIT_BASE, combatBonus, hitChance, moraleMult, rollDamage, typeMult, type UnitKind } from './calc';

export type SideGoal = 'escort' | 'breakthrough' | 'hold';
export type Command = '포격' | '연막' | '돌격';

export const SIDE_TICK_MS = 50;
export const FIELD = 1000;
const SCALE = 40; // 칸 1개 = 40px(사거리 환산)

export interface SUnit {
  id: number;
  side: 'me' | 'foe';
  kind: UnitKind | '트럭' | '진지';
  x: number;
  lane: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  range: number;
  cd: number;
  cdMax: number;
  morale: number;
  hit: number;
}

export interface SideBattle {
  goal: SideGoal;
  t: number;
  timeLimit: number;
  units: SUnit[];
  /** 투입 점수(통솔로 차오름) */
  points: number;
  pointsRate: number;
  cooldowns: Record<Command, number>;
  smokeUntil: number;
  chargeUntil: number;
  /** 포격이 떨어진 자리(그림용) */
  blasts: Array<{ x: number; t: number }>;
  waves: Array<{ t: number; kinds: UnitKind[] }>;
  seed: number;
  nextId: number;
  lostMine: number;
  foePower: number;
  arty: number;
  result: { win: boolean; stars: number; text: string } | null;
  log: string[];
}

export const DEPLOY_COST: Partial<Record<UnitKind, number>> = { 소총: 3, 기관총: 5, 저격: 5, 의무: 4, 전차: 10 };
export const COMMAND_CD: Record<Command, number> = { 포격: 12_000, 연막: 15_000, 돌격: 18_000 };
export const COMMAND_TEXT: Record<Command, string> = {
  포격: '고른 자리에 포탄(넓게 피해)',
  연막: '6초 동안 적 명중 절반',
  돌격: '5초 동안 우리 부대 빠르고 세게',
};
const GOAL_TEXT: Record<SideGoal, string> = {
  escort: '보급 트럭을 오른쪽 끝까지 지키기',
  breakthrough: '오른쪽 적 진지 부수기',
  hold: '90초 동안 왼쪽 우리 진지 지키기',
};
export const sideGoalText = (g: SideGoal) => GOAL_TEXT[g];

export interface SideSetup {
  goal: SideGoal;
  difficulty: number;
  rank: number;
  stats: Record<string, number>;
  seed: number;
}

function speedOf(kind: SUnit['kind']) {
  return kind === '전차' ? 34 : kind === '트럭' ? 13 : kind === '진지' ? 0 : kind === '기관총' || kind === '저격' ? 28 : 36; // px/초
}

function mk(b: SideBattle, side: 'me' | 'foe', kind: SUnit['kind'], x: number, mult = 1, extra: Partial<SUnit> = {}): SUnit {
  const base = kind === '트럭' ? { hp: 40, atk: 0, def: 2, range: 0 } : kind === '진지' ? { hp: 80, atk: 3, def: 3, range: 4 } : UNIT_BASE[kind];
  const hp = Math.round(base.hp * 2 * (side === 'foe' ? mult : 1));
  const u: SUnit = {
    id: b.nextId++,
    side,
    kind,
    x,
    lane: b.nextId % 3,
    hp,
    maxHp: hp,
    atk: base.atk * (side === 'foe' ? mult : 1),
    def: base.def,
    speed: speedOf(kind),
    range: Math.max(1, base.range) * SCALE,
    cd: 0,
    cdMax: kind === '기관총' ? 700 : kind === '저격' ? 2000 : kind === '전차' ? 1800 : kind === '진지' ? 1500 : 1100,
    morale: 70,
    hit: 0,
    ...extra,
  };
  return u;
}

export function createSideBattle(o: SideSetup): SideBattle {
  const rng = new Rng(o.seed >>> 0);
  const bonus = combatBonus(o.stats);
  const p = 0.85 + (o.difficulty - 1) * 0.8 + o.rank * 0.2;
  const b: SideBattle = {
    goal: o.goal,
    t: 0,
    timeLimit: o.goal === 'hold' ? 90_000 : 150_000,
    units: [],
    points: 8,
    pointsRate: 0.5 + (o.stats['통솔'] ?? 8) / 60 + o.rank * 0.08,
    cooldowns: { 포격: 0, 연막: 0, 돌격: 0 },
    smokeUntil: 0,
    chargeUntil: 0,
    blasts: [],
    waves: [],
    seed: 0,
    nextId: 1,
    lostMine: 0,
    foePower: 0.6 + 0.4 * p,
    arty: 1 + ((o.stats['포격'] ?? 8) - 8) / 40,
    result: null,
    log: [],
  };
  const me = (k: SUnit['kind'], x: number) => {
    const u = mk(b, 'me', k, x);
    u.atk *= bonus.atkMult;
    u.hp += bonus.hpAdd * 2 + o.rank * 2;
    u.maxHp = u.hp;
    u.morale = bonus.morale;
    u.hit = bonus.hit;
    b.units.push(u);
  };
  // 시작 부대
  if (o.goal === 'escort') me('트럭', 60);
  if (o.goal !== 'escort') me('진지', 10);
  me('소총', 80);
  me('소총', 70);
  me('기관총', 50);
  if (o.goal === 'breakthrough') b.units.push(mk(b, 'foe', '진지', FIELD - 10, b.foePower));
  // 적 물결
  const kinds: UnitKind[] = ['소총', '소총', '기관총', '저격'];
  const n = o.goal === 'hold' ? 10 : o.goal === 'breakthrough' ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const t = 3000 + i * (o.goal === 'hold' ? 8_000 : 10_000);
    const size = 2 + Math.floor(i * 0.7) + (o.difficulty > 1.1 ? 1 : 0) + Math.floor(o.rank / 3);
    const list: UnitKind[] = [];
    for (let k = 0; k < size; k++) list.push(rng.pick(kinds));
    if ((o.rank >= 3 || o.difficulty >= 1.15) && i % 3 === 2) list.push('전차');
    b.waves.push({ t, kinds: list });
  }
  b.seed = rng.seed;
  b.log = [`작전 목표: ${GOAL_TEXT[o.goal]}`];
  return b;
}

function clone(b: SideBattle): SideBattle {
  return {
    ...b,
    units: b.units.map((u) => ({ ...u })),
    cooldowns: { ...b.cooldowns },
    blasts: [...b.blasts],
    waves: b.waves.map((w) => ({ ...w, kinds: [...w.kinds] })),
    log: [...b.log],
  };
}
const say = (b: SideBattle, t: string) => (b.log = [t, ...b.log].slice(0, 20));

export function deploy(b0: SideBattle, kind: UnitKind): SideBattle {
  const cost = DEPLOY_COST[kind];
  if (!cost || b0.points < cost || b0.result) return b0;
  const b = clone(b0);
  b.points -= cost;
  const u = mk(b, 'me', kind, 20);
  const src = b.units.find((x) => x.side === 'me' && x.kind === '소총');
  if (src) {
    u.atk = UNIT_BASE[kind].atk * (src.atk / UNIT_BASE['소총'].atk);
    u.hit = src.hit;
    u.morale = src.morale;
  }
  b.units.push(u);
  return b;
}

/** 명령. 포격은 x 자리에 */
export function command(b0: SideBattle, c: Command, x = 0): SideBattle {
  if (b0.cooldowns[c] > 0 || b0.result) return b0;
  const b = clone(b0);
  b.cooldowns[c] = COMMAND_CD[c];
  if (c === '포격') {
    const rng = new Rng(b.seed);
    let hits = 0;
    for (const u of b.units) {
      if (u.hp <= 0) continue;
      const d = Math.abs(u.x - x);
      if (d > 70) continue;
      const dmg = Math.round(rollDamage(rng, 14 * b.arty, u.def, 1) * (1 - d / 100));
      u.hp = Math.max(0, u.hp - dmg);
      if (u.side === 'foe') hits++;
      if (u.hp === 0) onDeath(b, u);
    }
    b.seed = rng.seed;
    b.blasts.push({ x, t: b.t });
    say(b, `포격! 적 ${hits}명에게 맞음`);
  } else if (c === '연막') {
    b.smokeUntil = b.t + 6000;
    say(b, '연막: 적 명중 절반');
  } else {
    b.chargeUntil = b.t + 5000;
    say(b, '돌격!');
  }
  return b;
}

function onDeath(b: SideBattle, u: SUnit) {
  if (u.side === 'me' && u.kind !== '트럭' && u.kind !== '진지') b.lostMine++;
  for (const v of b.units) if (v.hp > 0 && v.side === u.side) v.morale = Math.max(0, v.morale - 6);
}

/** 1틱(50ms) 진행. 그대로 고쳐 씀(빠르게 돌리려고) — 바깥에서는 stepSide를 씀 */
function tick(b: SideBattle, rng: Rng) {
  const dt = SIDE_TICK_MS;
  b.t += dt;
  b.points = Math.min(30, b.points + (b.pointsRate * dt) / 1000);
  for (const k of Object.keys(b.cooldowns) as Command[]) b.cooldowns[k] = Math.max(0, b.cooldowns[k] - dt);
  // 적 물결
  while (b.waves.length && b.waves[0].t <= b.t) {
    const w = b.waves.shift()!;
    w.kinds.forEach((k, i) => b.units.push(mk(b, 'foe', k, FIELD + 10 + i * 18, b.foePower)));
  }
  const charge = b.t < b.chargeUntil;
  const smoke = b.t < b.smokeUntil;
  const live = b.units.filter((u) => u.hp > 0);
  for (const u of live) {
    if (u.hp <= 0) continue;
    const dir = u.side === 'me' ? 1 : -1;
    // 가장 가까운 앞쪽 적
    let target: SUnit | null = null;
    let best = 1e9;
    for (const v of live) {
      if (v.hp <= 0 || v.side === u.side) continue;
      const d = (v.x - u.x) * dir;
      if (d < -20) continue;
      const ad = Math.abs(v.x - u.x);
      if (ad < best) {
        best = ad;
        target = v;
      }
    }
    u.cd = Math.max(0, u.cd - dt);
    const inRange = target && best <= u.range;
    if (inRange && u.atk > 0) {
      if (u.cd <= 0) {
        u.cd = u.cdMax;
        let p = hitChance(u.kind === '저격' ? '저격' : '소총', 0.05, best / SCALE, u.hit);
        if (u.side === 'foe' && smoke) p *= 0.5;
        if (rng.chance(p)) {
          let mult = moraleMult(u.morale);
          if (u.kind !== '트럭' && u.kind !== '진지' && target!.kind !== '트럭' && target!.kind !== '진지')
            mult *= typeMult(u.kind as UnitKind, target!.kind as UnitKind);
          if (u.side === 'me' && charge) mult *= 1.4;
          const dmg = rollDamage(rng, u.atk, target!.def, mult);
          target!.hp = Math.max(0, target!.hp - dmg);
          if (target!.hp === 0) onDeath(b, target!);
        }
      }
    } else if (u.kind === '의무') {
      // 의무병: 뒤에서 다친 아군 치료
      const hurt = live.find((v) => v.side === u.side && v.hp > 0 && v.hp < v.maxHp && Math.abs(v.x - u.x) < 40 && v.kind !== '진지');
      if (hurt && u.cd <= 0) {
        hurt.hp = Math.min(hurt.maxHp, hurt.hp + 3);
        u.cd = 1500;
      } else u.x += (dir * u.speed * dt) / 1000;
    } else if (u.speed > 0) {
      // 트럭은 앞에 적이 가까우면 멈춤
      if (u.kind === '트럭' && target && best < 90) continue;
      let sp = u.speed * (u.side === 'me' && charge ? 1.6 : 1);
      // 우리 보병은 트럭보다 너무 앞서지 않음(호송)
      if (u.side === 'me' && b.goal === 'escort' && u.kind !== '트럭') {
        const truck = live.find((v) => v.kind === '트럭');
        if (truck && u.x > truck.x + 140) sp = 0;
      }
      if (u.side === 'me' && b.goal === 'hold' && u.x > 420) sp = 0;
      u.x = Math.max(0, Math.min(FIELD + 40, u.x + (dir * sp * dt) / 1000));
    }
  }
  b.units = b.units.filter((u) => u.hp > 0 || u.kind === '트럭' || u.kind === '진지');
  b.blasts = b.blasts.filter((x) => b.t - x.t < 800);
  checkEnd(b);
}

function checkEnd(b: SideBattle) {
  if (b.result) return;
  const finish = (win: boolean, text: string) => {
    // 별: 지킨 것(트럭·진지)이 얼마나 남았나, 돌파는 빠르기
    const keep = b.units.find((u) => u.side === 'me' && (u.kind === '트럭' || u.kind === '진지'));
    const q = b.goal === 'breakthrough' ? 1 - b.t / b.timeLimit : keep ? keep.hp / keep.maxHp : 0;
    const stars = !win ? 0 : q >= 0.6 && b.lostMine <= 3 ? 3 : q >= 0.3 ? 2 : 1;
    b.result = { win, stars, text };
    say(b, text);
  };
  const truck = b.units.find((u) => u.kind === '트럭');
  const myBase = b.units.find((u) => u.kind === '진지' && u.side === 'me');
  const foeBase = b.units.find((u) => u.kind === '진지' && u.side === 'foe');
  const foeAlive = b.units.some((u) => u.side === 'foe' && u.hp > 0 && u.kind !== '진지');
  if (b.goal === 'escort') {
    if (truck && truck.hp <= 0) return finish(false, '트럭이 부서졌어요. 호송 실패.');
    if (truck && truck.x >= FIELD - 20) return finish(true, '트럭이 도착했어요! 호송 성공.');
  }
  if (myBase && myBase.hp <= 0) return finish(false, '우리 진지가 무너졌어요. 작전 실패.');
  // 적이 우리 진지 뒤(왼쪽 끝)까지 오면 실패
  if (b.goal !== 'escort' && b.units.some((u) => u.side === 'foe' && u.hp > 0 && u.x <= 0)) return finish(false, '적이 우리 진지를 넘었어요. 작전 실패.');
  if (b.goal === 'breakthrough' && foeBase && foeBase.hp <= 0) return finish(true, '적 진지를 부쉈어요! 돌파 성공.');
  if (b.goal === 'hold' && b.t >= b.timeLimit) return finish(true, '끝까지 버텼어요! 방어 성공.');
  if (b.goal === 'hold' && !b.waves.length && !foeAlive) return finish(true, '적을 모두 막았어요! 방어 성공.');
  if (b.t >= b.timeLimit) finish(false, '시간이 다 됐어요. 작전 실패.');
}

/** 자동전투: 점수가 차면 투입, 명령은 쿨이 끝나면 적이 몰린 곳에 */
function autoAct(b: SideBattle): SideBattle {
  let nb = b;
  const foes = nb.units.filter((u) => u.side === 'foe' && u.hp > 0 && u.kind !== '진지');
  if (foes.length) {
    // 가장 많이 몰린 자리
    let bestX = foes[0].x;
    let bestN = 0;
    for (const f of foes) {
      const n = foes.filter((g) => Math.abs(g.x - f.x) < 70).length;
      if (n > bestN) {
        bestN = n;
        bestX = f.x;
      }
    }
    const nearestMine = Math.max(...nb.units.filter((u) => u.side === 'me' && u.hp > 0).map((u) => u.x), 0);
    if (nb.cooldowns['포격'] <= 0 && bestN >= 2 && bestX - nearestMine > 60) nb = command(nb, '포격', bestX);
    const close = foes.some((f) => f.x - nearestMine < 160);
    if (nb.cooldowns['연막'] <= 0 && close && foes.length >= 3) nb = command(nb, '연막');
    if (nb.cooldowns['돌격'] <= 0 && close && foes.length <= 3) nb = command(nb, '돌격');
  }
  const want: UnitKind = nb.points >= 10 && foes.some((f) => f.kind === '전차') ? '저격' : nb.units.filter((u) => u.side === 'me' && u.kind === '기관총' && u.hp > 0).length < 2 ? '기관총' : '소총';
  if (nb.points >= (DEPLOY_COST[want] ?? 99) + (want === '소총' ? 2 : 0)) nb = deploy(nb, want);
  return nb;
}

/** ms만큼 진행(auto면 자동 지휘). 새 상태를 돌려줌 */
export function stepSide(b0: SideBattle, ms: number, auto: boolean): SideBattle {
  if (b0.result) return b0;
  let b = clone(b0);
  const rng = new Rng(b.seed);
  const n = Math.floor(ms / SIDE_TICK_MS);
  for (let i = 0; i < n && !b.result; i++) {
    if (auto && b.t % 500 === 0) {
      b.seed = rng.seed;
      b = autoAct(b);
      rng.seed = b.seed;
    }
    tick(b, rng);
  }
  b.seed = rng.seed;
  return b;
}

/** 즉시완료(자동전투와 같은 결과) */
export function finishSide(b0: SideBattle): SideBattle {
  let b = b0;
  for (let i = 0; i < 400 && !b.result; i++) b = stepSide(b, 500, true);
  return b;
}
