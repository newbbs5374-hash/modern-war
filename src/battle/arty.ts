// 전투 틀 ③ 포물선 대결: 옆에서 본 넓은 땅, 한 발씩 번갈아. 각도·힘·바람.
// 맞은 자리는 땅이 패임. 포격 스탯이 높으면 피해가 크고, 탄도 안내선이 길어짐.
import { Rng } from '../game/rng';

export const ARTY_W = 600;
export const ARTY_H = 300;
const STEP = 5; // 땅 높이 점 간격(px)
const G = 300;
const DT = 0.02;
const BLAST = 42;
const MAX_ROUNDS = 8;

export interface Gun {
  x: number;
  hp: number;
  maxHp: number;
}

export interface Shot {
  path: Array<[number, number]>;
  impact: { x: number; y: number } | null;
  dmgMe: number;
  dmgFoe: number;
}

export interface ArtyBattle {
  ground: number[];
  me: Gun;
  foe: Gun;
  wind: number;
  turn: 'me' | 'foe';
  round: number;
  seed: number;
  power: number; // 포격 배율
  guide: number; // 안내선 비율(0~1)
  foeSkill: number; // 적 조준 실력(작을수록 잘 맞힘 = 오차)
  myAim: number; // 자동전투 오차
  foeShots: number;
  last: Shot | null;
  result: { win: boolean; stars: number; text: string } | null;
  log: string[];
}

export interface ArtySetup {
  difficulty: number;
  rank: number;
  stats: Record<string, number>;
  seed: number;
}

export function heightAt(b: { ground: number[] }, x: number): number {
  const i = Math.max(0, Math.min(b.ground.length - 1, x / STEP));
  const a = Math.floor(i);
  const c = Math.min(b.ground.length - 1, a + 1);
  return b.ground[a] + (b.ground[c] - b.ground[a]) * (i - a);
}

export function createArty(o: ArtySetup): ArtyBattle {
  const rng = new Rng(o.seed >>> 0);
  const n = ARTY_W / STEP + 1;
  // 언덕 몇 개를 겹친 땅
  const hills = [0, 1, 2].map(() => ({ c: rng.range(150, 450), h: rng.range(30, 110), w: rng.range(50, 120) }));
  const ground = Array.from({ length: n }, (_, i) => {
    const x = i * STEP;
    let y = 70;
    for (const h of hills) y += h.h * Math.exp(-((x - h.c) ** 2) / (2 * h.w * h.w));
    return Math.round(y);
  });
  const art = o.stats['포격'] ?? 8;
  const rel = Math.min(1, art / (20 + o.rank * 10));
  const p = 0.85 + (o.difficulty - 1) * 0.8 + o.rank * 0.2;
  const foeHp = Math.round(100 * (0.7 + 0.3 * p));
  return {
    ground,
    me: { x: 50, hp: 100 + o.rank * 5, maxHp: 100 + o.rank * 5 },
    foe: { x: ARTY_W - 50, hp: foeHp, maxHp: foeHp },
    wind: Math.round(rng.range(-3, 3)),
    turn: 'me',
    round: 1,
    seed: rng.seed,
    power: 1 + (rel - 0.3) * 0.5 + o.rank * 0.03,
    guide: 0.15 + 0.45 * rel,
    foeSkill: Math.max(2, 8 - (o.difficulty - 1) * 10 - o.rank * 0.25),
    myAim: 7 - 5 * rel,
    foeShots: 0,
    last: null,
    result: null,
    log: ['작전 목표: 적 포를 먼저 부수기(8번씩 쏘고 끝나면 남은 체력으로 판정)'],
  };
}

function gunY(b: ArtyBattle, g: Gun) {
  return heightAt(b, g.x) + 8;
}

/** 쏘면 날아가는 길(바람 포함). preview면 땅·포에 닿는 곳까지만 */
export function trajectory(b: ArtyBattle, who: 'me' | 'foe', angle: number, power: number): Shot {
  const g = who === 'me' ? b.me : b.foe;
  const dir = who === 'me' ? 1 : -1;
  const rad = (angle * Math.PI) / 180;
  const v = power * 6;
  let x = g.x + dir * 8;
  let y = gunY(b, g) + 6;
  let vx = Math.cos(rad) * v * dir;
  let vy = Math.sin(rad) * v;
  const path: Array<[number, number]> = [[x, y]];
  let impact: { x: number; y: number } | null = null;
  for (let i = 0; i < 1500; i++) {
    vx += b.wind * 15 * DT;
    vy -= G * DT;
    x += vx * DT;
    y += vy * DT;
    path.push([x, y]);
    if (x < 0 || x > ARTY_W) break;
    const other = who === 'me' ? b.foe : b.me;
    if (Math.abs(x - other.x) < 10 && Math.abs(y - gunY(b, other)) < 10) {
      impact = { x, y };
      break;
    }
    if (y <= heightAt(b, x)) {
      impact = { x, y: heightAt(b, x) };
      break;
    }
  }
  return { path, impact, dmgMe: 0, dmgFoe: 0 };
}

function blastDamage(b: ArtyBattle, g: Gun, impact: { x: number; y: number }, mult: number) {
  const d = Math.hypot(impact.x - g.x, impact.y - gunY(b, g));
  if (d > BLAST) return 0;
  return Math.round(44 * mult * (1 - d / BLAST) + (d < 10 ? 8 : 0));
}

function clone(b: ArtyBattle): ArtyBattle {
  return { ...b, ground: [...b.ground], me: { ...b.me }, foe: { ...b.foe }, log: [...b.log] };
}

/** 한 발 쏘기(지금 차례인 쪽) */
export function fire(b0: ArtyBattle, angle: number, power: number): ArtyBattle {
  if (b0.result) return b0;
  const b = clone(b0);
  const who = b.turn;
  const shot = trajectory(b, who, angle, power);
  if (shot.impact) {
    const mult = who === 'me' ? b.power : 1;
    shot.dmgFoe = blastDamage(b, b.foe, shot.impact, mult);
    shot.dmgMe = blastDamage(b, b.me, shot.impact, mult);
    b.foe.hp = Math.max(0, b.foe.hp - shot.dmgFoe);
    b.me.hp = Math.max(0, b.me.hp - shot.dmgMe);
    // 땅이 패임
    for (let i = 0; i < b.ground.length; i++) {
      const dx = i * STEP - shot.impact.x;
      if (Math.abs(dx) < 20) b.ground[i] = Math.max(10, b.ground[i] - Math.round(Math.sqrt(400 - dx * dx) * 0.6));
    }
  }
  b.last = shot;
  const name = who === 'me' ? '우리 포' : '적 포';
  const hit = who === 'me' ? shot.dmgFoe : shot.dmgMe;
  b.log = [`${name}: ${hit ? `${hit} 피해!` : shot.impact ? '빗나감' : '화면 밖으로'}`, ...b.log].slice(0, 12);
  if (who === 'foe') b.foeShots++;
  // 차례·바람
  const rng = new Rng(b.seed);
  if (who === 'foe') b.round++;
  b.turn = who === 'me' ? 'foe' : 'me';
  b.wind = Math.max(-4, Math.min(4, b.wind + Math.round(rng.range(-1.4, 1.4))));
  b.seed = rng.seed;
  end(b);
  return b;
}

function end(b: ArtyBattle) {
  if (b.result) return;
  const stars = () => (b.me.hp / b.me.maxHp >= 0.7 ? 3 : b.me.hp / b.me.maxHp >= 0.35 ? 2 : 1);
  if (b.foe.hp <= 0) b.result = { win: true, stars: stars(), text: '적 포를 부쉈어요! 포격전 승리.' };
  else if (b.me.hp <= 0) b.result = { win: false, stars: 0, text: '우리 포가 부서졌어요. 포격전 패배.' };
  else if (b.round > MAX_ROUNDS) {
    const win = b.me.hp / b.me.maxHp > b.foe.hp / b.foe.maxHp;
    b.result = { win, stars: win ? 1 : 0, text: win ? '탄이 떨어졌지만 우리가 더 버텼어요. 판정승.' : '탄이 떨어졌어요. 판정패.' };
  }
  if (b.result) b.log = [b.result.text, ...b.log];
}

/** 맞히는 각도·힘을 찾음(인공지능). 오차는 바깥에서 더함 */
export function solve(b: ArtyBattle, who: 'me' | 'foe'): { angle: number; power: number } {
  const target = who === 'me' ? b.foe : b.me;
  let best = { angle: 45, power: 60, d: 1e9 };
  for (let a = 20; a <= 75; a += 5) {
    for (let p = 20; p <= 100; p += 2) {
      const s = trajectory(b, who, a, p);
      if (!s.impact) continue;
      const d = Math.abs(s.impact.x - target.x) + Math.abs(s.impact.y - gunY(b, target)) * 0.5;
      if (d < best.d) best = { angle: a, power: p, d };
    }
  }
  return { angle: best.angle, power: best.power };
}

/** 인공지능이 한 발(적 차례 또는 자동전투의 내 차례) */
export function aiFire(b: ArtyBattle): ArtyBattle {
  if (b.result) return b;
  const who = b.turn;
  const s = solve(b, who);
  const rng = new Rng(b.seed);
  // 적은 쏠수록 정확해짐
  const err = who === 'foe' ? b.foeSkill * Math.max(0.35, 1 - b.foeShots * 0.18) : b.myAim;
  const angle = Math.round(s.angle + rng.range(-1, 1) * err * 0.6);
  const power = Math.round(s.power + rng.range(-1, 1) * err);
  const nb = { ...b, seed: rng.seed };
  return fire(nb, Math.max(5, Math.min(85, angle)), Math.max(10, Math.min(100, power)));
}

export function finishArty(b0: ArtyBattle): ArtyBattle {
  let b = b0;
  for (let i = 0; i < 40 && !b.result; i++) b = aiFire(b);
  return b;
}
