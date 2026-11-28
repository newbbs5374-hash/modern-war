// 11-28 새 전체 화면 훈련 2 "침투 작전"(특수전·잠입): 옆으로 가는 플랫폼(마리오형) + 잠입.
// 달리기·점프·숙이기. 그림자 속에서 숙이면 보이지 않고, 상자 뒤에 숙이면 경비병 시선이 막힘.
// 경비병·감시 카메라 시야에 오래 있으면 경보 → 목숨 하나 잃고 지난 깃발로. 구덩이에 빠져도 마찬가지. 목숨 3개.
// 계산만(화면은 ui/battle/mini/infiltrate.tsx).
import { Rng } from '../game/rng';

export const IW = 3600;
export const IH = 600;
export const FLOOR = 520;
export const GRAV = 1900;
export const JUMP = 720;
export const RUN = 240;
export const CROUCH = 110;
export const PW = 26;
export const PH = 44;
export const PH_LOW = 26;
export const LIVES = 3;

export interface Box { x: number; y: number; w: number; h: number }
export interface Guard { x: number; a: number; b: number; dir: 1 | -1; v: number; wait: number; y: number }
export interface Cam { x: number; y: number; base: number; swing: number; t: number; speed: number }
export interface IState {
  px: number; py: number; vx: number; vy: number; ground: boolean; low: boolean;
  lives: number; alert: number; seen: boolean; check: number; t: number; done: boolean; dead: boolean; caught: number;
  solids: Box[]; pits: Array<[number, number]>; shadows: Array<[number, number]>; guards: Guard[]; cams: Cam[]; checks: number[]; end: number;
}

export function newInfiltrate(seed: number, level = 1): IState {
  const rng = new Rng(seed >>> 0 || 1);
  const solids: Box[] = [];
  const pits: Array<[number, number]> = [];
  const shadows: Array<[number, number]> = [];
  const guards: Guard[] = [];
  const cams: Cam[] = [];
  // 구간마다 하나씩: 구덩이 · 상자 · 높은 발판 · 경비병 · 카메라 · 그림자
  for (let x = 420; x < IW - 400; x += rng.range(300, 420)) {
    const k = Math.floor(rng.next() * 5);
    if (k === 0) pits.push([x, x + rng.range(70, 120)]);
    else if (k === 1) solids.push({ x, y: FLOOR - 46, w: 54, h: 46 });
    else if (k === 2) {
      const w = rng.range(120, 200);
      solids.push({ x, y: FLOOR - rng.range(90, 130), w, h: 18 });
      shadows.push([x - 10, x + w + 10]);
    } else if (k === 3) {
      const a = x - 60, b = x + rng.range(160, 260);
      guards.push({ x: a + 10, a, b, dir: 1, v: 55 * Math.min(1.8, level), wait: 0, y: FLOOR });
      solids.push({ x: a - 70, y: FLOOR - 46, w: 50, h: 46 });
    } else {
      cams.push({ x: x + 60, y: FLOOR - 260, base: Math.PI / 2, swing: 0.6, t: rng.range(0, 6), speed: 0.8 * level });
      shadows.push([x - 40, x + 70]);
    }
  }
  const checks = [60, 1200, 2400];
  return { px: 60, py: FLOOR - PH, vx: 0, vy: 0, ground: true, low: false, lives: LIVES, alert: 0, seen: false, check: 0, t: 0, done: false, dead: false, caught: 0, solids, pits, shadows, guards, cams, checks, end: IW - 120 };
}

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inPit = (s: IState, x: number) => s.pits.some(([a, b]) => x + PW / 2 > a + 6 && x + PW / 2 < b - 6);
export const inShadow = (s: IState) => s.shadows.some(([a, b]) => s.px + PW / 2 > a && s.px + PW / 2 < b);
const pHeight = (s: IState) => (s.low ? PH_LOW : PH);

/** 상자가 시선을 가리나(숙였을 때만) */
function covered(s: IState, fromX: number): boolean {
  if (!s.low) return false;
  const lo = Math.min(fromX, s.px), hi = Math.max(fromX, s.px + PW);
  return s.solids.some((b) => b.y + b.h >= FLOOR - 1 && b.h >= PH_LOW && b.x > lo && b.x + b.w < hi + 40);
}
/** 경비병이 보나 */
export function guardSees(s: IState, g: Guard): boolean {
  if (s.low && inShadow(s)) return false;
  const cx = s.px + PW / 2;
  const dx = (cx - g.x) * g.dir;
  if (dx < 0 || dx > 240) return false;
  if (Math.abs(s.py + pHeight(s) - g.y) > 70) return false;
  return !covered(s, g.x);
}
export const camAngle = (c: Cam) => c.base + Math.sin(c.t * c.speed) * c.swing;
/** 카메라가 보나(빛 원뿔) */
export function camSees(s: IState, c: Cam): boolean {
  if (inShadow(s) && s.low) return false;
  const cx = s.px + PW / 2, cy = s.py + pHeight(s) / 2;
  const ang = Math.atan2(cy - c.y, cx - c.x);
  const d = Math.hypot(cx - c.x, cy - c.y);
  return d < 320 && Math.abs(ang - camAngle(c)) < 0.22;
}

export interface Input { left: boolean; right: boolean; jump: boolean; low: boolean }

/** 한 걸음(dt초). s를 바꿈 */
export function stepInfiltrate(s: IState, inp: Input, dt: number): void {
  if (s.done || s.dead) return;
  s.t += dt;
  s.low = inp.low && s.ground;
  const sp = s.low ? CROUCH : RUN;
  s.vx = (inp.right ? sp : 0) - (inp.left ? sp : 0);
  if (inp.jump && s.ground) {
    s.vy = -JUMP;
    s.ground = false;
  }
  s.vy += GRAV * dt;
  // 가로
  let nx = Math.max(0, Math.min(IW - PW, s.px + s.vx * dt));
  const h = pHeight(s);
  for (const b of s.solids) if (overlap({ x: nx, y: s.py + (PH - h), w: PW, h }, b)) nx = s.vx > 0 ? b.x - PW : b.x + b.w;
  s.px = nx;
  // 세로
  let ny = s.py + s.vy * dt;
  s.ground = false;
  for (const b of s.solids)
    if (overlap({ x: s.px, y: ny, w: PW, h: PH }, b)) {
      if (s.vy > 0) {
        ny = b.y - PH;
        s.ground = true;
      } else ny = b.y + b.h;
      s.vy = 0;
    }
  if (ny + PH >= FLOOR && !inPit(s, s.px)) {
    ny = FLOOR - PH;
    s.vy = 0;
    s.ground = true;
  }
  s.py = ny;
  if (s.py > IH + 80) return lose(s);
  // 경비병·카메라
  for (const g of s.guards) {
    if (g.wait > 0) g.wait -= dt;
    else {
      g.x += g.dir * g.v * dt;
      if (g.x > g.b) { g.x = g.b; g.dir = -1; g.wait = 1.2; }
      if (g.x < g.a) { g.x = g.a; g.dir = 1; g.wait = 1.2; }
    }
  }
  for (const c of s.cams) c.t += dt;
  s.seen = s.guards.some((g) => guardSees(s, g)) || s.cams.some((c) => camSees(s, c));
  s.alert = Math.max(0, Math.min(1, s.alert + (s.seen ? 1.4 : -0.5) * dt));
  if (s.alert >= 1) {
    s.caught++;
    return lose(s);
  }
  // 깃발
  for (let i = s.checks.length - 1; i > s.check; i--) if (s.px >= s.checks[i]) { s.check = i; break; }
  if (s.px >= s.end) s.done = true;
}
function lose(s: IState) {
  s.lives--;
  s.alert = 0;
  if (s.lives <= 0) {
    s.dead = true;
    return;
  }
  s.px = s.checks[s.check];
  s.py = FLOOR - PH;
  s.vx = s.vy = 0;
}

/** 점수: 간 거리 60% + 끝까지 가면 +, 남은 목숨·덜 들킨 만큼 */
export function infiltrateScore(s: IState): number {
  const prog = Math.min(1, s.px / s.end);
  if (s.done) return Math.min(1, 0.6 + (s.lives / LIVES) * 0.3 + (s.caught === 0 ? 0.1 : 0));
  return Math.min(0.55, prog * 0.55);
}
