// 11-28 새 전체 화면 훈련 1 "포격전"(기갑화력): 포트리스형 턴제 포격.
// 넓은 땅(2400×1000) 양쪽에 전차 한 대씩. 각도·힘·바람을 보고 번갈아 쏨. 맞은 자리는 땅이 패임.
// 화면은 카메라가 포탄을 따라가고, 포탄이 높이 날면 화면을 넓게 줄여서 끝까지 보여 줌(ui/battle/mini/fortress.tsx).
// 여기는 계산만(시험 가능).
import { Rng } from '../game/rng';

export const FW = 2400;
export const FH = 1000;
export const STEP = 8;
export const G = 420;
export const BLAST = 70;
export const MAX_POWER = 900;
export const MAX_TURNS = 10;
export const MOVE_FUEL = 160;

export interface Tank { x: number; y: number; hp: number; angle: number; power: number; fuel: number }
export interface FShot { pts: Array<[number, number]>; hit: { x: number; y: number } | null; dmgMe: number; dmgFoe: number }
export interface FBattle { ground: number[]; me: Tank; foe: Tank; wind: number; turn: number; shots: number; over: 'win' | 'lose' | 'draw' | null; seed: number }

export const groundAt = (b: FBattle, x: number) => {
  const i = Math.max(0, Math.min(b.ground.length - 1, x / STEP));
  const a = Math.floor(i), c = Math.min(b.ground.length - 1, a + 1);
  return b.ground[a] + (b.ground[c] - b.ground[a]) * (i - a);
};

/** 새 판: 언덕 땅·양쪽 전차·바람 */
export function newFortress(seed: number, level = 1): FBattle {
  const rng = new Rng(seed >>> 0 || 1);
  const n = Math.ceil(FW / STEP) + 1;
  const waves = Array.from({ length: 3 }, (_, i) => ({ a: rng.range(30, 110) / (i + 1), f: rng.range(0.6, 1.4) * (i + 1), p: rng.range(0, Math.PI * 2) }));
  const ground: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let y = FH * 0.66;
    for (const w of waves) y -= w.a * Math.sin(t * w.f + w.p);
    // 가운데 큰 산
    const mid = (i * STEP - FW / 2) / 380;
    y -= 230 * Math.exp(-mid * mid) * rng.range(0.85, 1.15);
    ground.push(Math.max(FH * 0.25, Math.min(FH * 0.92, y)));
  }
  const b: FBattle = {
    ground,
    me: { x: 260 + rng.range(-60, 60), y: 0, hp: 100, angle: 50, power: 520, fuel: MOVE_FUEL },
    foe: { x: FW - 260 + rng.range(-120, 60), y: 0, hp: 100, angle: 130, power: 520, fuel: MOVE_FUEL },
    wind: Math.round(rng.range(-60, 60) * Math.min(1.6, level)),
    turn: 0,
    shots: 0,
    over: null,
    seed: rng.seed,
  };
  // 전차 자리는 평평하게
  for (const t of [b.me, b.foe]) {
    const c = Math.round(t.x / STEP);
    const h = b.ground[c];
    for (let k = -4; k <= 4; k++) if (b.ground[c + k] != null) b.ground[c + k] = h;
    t.y = h;
  }
  return b;
}

/** 포탄 길(바람 포함). 땅·전차에 닿거나 화면 옆으로 나가면 멈춤. 위로는 얼마든지 나가도 계속 셈 */
export function flyPath(b: FBattle, from: Tank, angle: number, power: number, wind: number): { pts: Array<[number, number]>; hit: { x: number; y: number } | null } {
  const rad = (angle * Math.PI) / 180;
  let x = from.x + Math.cos(rad) * 26, y = from.y - 22 - Math.sin(rad) * 26;
  let vx = Math.cos(rad) * power, vy = -Math.sin(rad) * power;
  const pts: Array<[number, number]> = [[x, y]];
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 30; i++) {
    vx += wind * dt;
    vy += G * dt;
    x += vx * dt;
    y += vy * dt;
    pts.push([x, y]);
    if (x < -200 || x > FW + 200) return { pts, hit: null };
    for (const t of [b.me, b.foe]) if (t !== from && Math.hypot(t.x - x, t.y - 14 - y) < 22) return { pts, hit: { x, y } };
    if (x >= 0 && x <= FW && y >= groundAt(b, x)) return { pts, hit: { x, y: groundAt(b, x) } };
  }
  return { pts, hit: null };
}

/** 폭발: 땅 패임 · 피해(가까울수록 큼, 포격 능력 배율) */
export function blast(b: FBattle, at: { x: number; y: number }, power = 1): { dmgMe: number; dmgFoe: number } {
  for (let i = 0; i < b.ground.length; i++) {
    const dx = i * STEP - at.x;
    if (Math.abs(dx) > BLAST) continue;
    const dig = Math.sqrt(BLAST * BLAST - dx * dx) * 0.8;
    b.ground[i] = Math.min(FH - 10, Math.max(b.ground[i], at.y + dig));
  }
  const hurt = (t: Tank) => {
    const d = Math.hypot(t.x - at.x, t.y - 10 - at.y);
    return d > BLAST * 1.3 ? 0 : Math.round(Math.min(60, 60 * (1 - d / (BLAST * 1.3))) * power);
  };
  const dmgMe = hurt(b.me), dmgFoe = hurt(b.foe);
  b.me.hp = Math.max(0, b.me.hp - dmgMe);
  b.foe.hp = Math.max(0, b.foe.hp - dmgFoe);
  // 전차가 패인 땅으로 내려앉음
  b.me.y = groundAt(b, b.me.x);
  b.foe.y = groundAt(b, b.foe.x);
  return { dmgMe, dmgFoe };
}

/** 한 발 쏘기(누가 쏘든). b를 바꿈 */
export function fire(b: FBattle, who: 'me' | 'foe', dmgMul = 1): FShot {
  const t = who === 'me' ? b.me : b.foe;
  const { pts, hit } = flyPath(b, t, t.angle, t.power, b.wind);
  let dmgMe = 0, dmgFoe = 0;
  if (hit) ({ dmgMe, dmgFoe } = blast(b, hit, dmgMul));
  if (who === 'me') b.shots++;
  return { pts, hit, dmgMe, dmgFoe };
}

/** 차례 넘기기: 바람이 바뀌고, 승패 확인 */
export function nextTurn(b: FBattle): void {
  const rng = new Rng(b.seed);
  b.turn++;
  b.wind = Math.round(Math.max(-90, Math.min(90, b.wind + rng.range(-25, 25))));
  b.me.fuel = MOVE_FUEL;
  b.foe.fuel = MOVE_FUEL;
  b.seed = rng.seed;
  if (b.foe.hp <= 0 && b.me.hp <= 0) b.over = 'draw';
  else if (b.foe.hp <= 0) b.over = 'win';
  else if (b.me.hp <= 0) b.over = 'lose';
  else if (b.turn >= MAX_TURNS * 2) b.over = b.me.hp > b.foe.hp ? 'win' : b.me.hp < b.foe.hp ? 'lose' : 'draw';
}

/** 전차 옮기기(연료만큼, 너무 가파르면 못 감) */
export function moveTank(b: FBattle, who: 'me' | 'foe', dx: number): void {
  const t = who === 'me' ? b.me : b.foe;
  const step = Math.sign(dx) * Math.min(Math.abs(dx), t.fuel);
  const nx = Math.max(40, Math.min(FW - 40, t.x + step));
  if (Math.abs(groundAt(b, nx) - t.y) > 60) return;
  t.fuel -= Math.abs(nx - t.x);
  t.x = nx;
  t.y = groundAt(b, nx);
}

/** AI 조준: 힘을 바꿔 가며 가장 가까이 떨어지는 값을 고르고, 단계가 낮을수록 흔들림 */
export function aiAim(b: FBattle, level: number): { angle: number; power: number } {
  const rng = new Rng(b.seed ^ 0x9e3779b9);
  let best = { angle: 130, power: 500, d: Infinity };
  for (let a = 100; a <= 165; a += 5)
    for (let p = 250; p <= MAX_POWER; p += 25) {
      const { hit } = flyPath(b, b.foe, a, p, b.wind);
      if (!hit) continue;
      const d = Math.abs(hit.x - b.me.x);
      if (d < best.d) best = { angle: a, power: p, d };
    }
  // 첫 발은 크게 빗나가고 차례가 갈수록 정확해짐(단계가 높으면 더 빨리)
  const err = Math.max(0.02, 0.16 - b.turn * 0.012 * level) * (2 - Math.min(1.8, level));
  return { angle: best.angle + rng.range(-4, 4) * err * 4, power: best.power * (1 + rng.range(-err, err)) };
}

/** 점수(0~1): 이기면 0.6 + 남은 체력·적게 쏜 만큼, 지면 준 피해만큼 */
export function fortressScore(b: FBattle): number {
  const dealt = (100 - b.foe.hp) / 100;
  if (b.over === 'win') return Math.min(1, 0.6 + (b.me.hp / 100) * 0.25 + Math.max(0, (MAX_TURNS - b.shots) / MAX_TURNS) * 0.15);
  return Math.min(0.55, dealt * 0.55);
}

/** 화면에 담을 범위(포탄·내 전차·적 전차를 모두 담고, 화면 비율에 맞춤) */
export function camFit(pts: Array<[number, number]>, ratio: number): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const pad = 120;
  x0 -= pad; x1 += pad; y0 -= pad * 2.2; y1 += pad; // 위는 점수판 자리만큼 더
  y1 = Math.max(y1, FH);
  let w = Math.max(700, x1 - x0), h = y1 - y0;
  if (w / h < ratio) w = h * ratio;
  else h = w / ratio;
  const cx = (x0 + x1) / 2;
  return { x: cx - w / 2, y: y1 - h, w, h };
}
