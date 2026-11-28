// 11-28 새 전체 화면 훈련 묶음 B(계산만, 화면은 ui/battle/mini/fullB.tsx).
// 6 시가전 엄폐 사격(보병) · 7 함대 포격전(수상함) · 8 어둠 속 사냥(잠수함) · 9 자폭 보트 돌격(무인정) · 10 스텔스 침투(첨단항공기)
import { Rng } from '../game/rng';

export interface Pt { x: number; y: number }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ───────────────────────── 6 시가전 엄폐 사격 ─────────────────────────
// 모래주머니 뒤에 숨었다(꾹 누르기) 일어나서(떼기) 창문·문에 나온 적을 눌러 쏨. 숨어 있으면 탄창이 참.
// 적은 빨간 고리가 다 차면 쏨: 그때 일어서 있으면 맞음. 민간인(흰 옷)은 쏘면 감점.
export const CW = 1600, CH = 900, MAG = 6, CHP = 5;
export const SPOTS: Pt[] = (() => {
  const out: Pt[] = [];
  for (const bx of [120, 620, 1120]) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push({ x: bx + 70 + c * 120, y: 170 + r * 150 });
    out.push({ x: bx + 190, y: 650 });
  }
  return out;
})();
export interface Foe { x: number; y: number; aim: number; aimMax: number; alive: boolean; civ: boolean; life: number; spot: number }
export interface Cover {
  foes: Foe[]; queue: Array<{ at: number; spot: number; civ: boolean }>; up: boolean; ammo: number; hp: number; t: number; kills: number; total: number; civHit: number; reload: number; done: boolean; level: number; hurt: number;
}
export function newCover(seed: number, level = 1): Cover {
  const rng = new Rng(seed >>> 0 || 1);
  const queue: Cover['queue'] = [];
  let at = 1.2;
  for (let i = 0; i < 22; i++) {
    queue.push({ at, spot: Math.floor(rng.next() * SPOTS.length), civ: i > 2 && rng.chance(0.16) });
    at += rng.range(0.9, 2.2) / Math.min(1.6, level);
  }
  return { foes: [], queue, up: true, ammo: MAG, hp: CHP, t: 0, kills: 0, total: queue.filter((q) => !q.civ).length, civHit: 0, reload: 0, done: false, level, hurt: 0 };
}
export function stepCover(s: Cover, dt: number, up: boolean): void {
  if (s.done) return;
  s.t += dt;
  s.up = up;
  s.hurt = Math.max(0, s.hurt - dt);
  while (s.queue.length && s.queue[0].at <= s.t) {
    const q = s.queue.shift()!;
    if (s.foes.some((f) => f.spot === q.spot && (f.alive || f.life > 0))) {
      q.at = s.t + 0.6;
      s.queue.push(q);
      s.queue.sort((a, b) => a.at - b.at);
      break;
    }
    const aimMax = 2.4 / Math.min(1.6, s.level);
    s.foes.push({ ...SPOTS[q.spot], spot: q.spot, aim: aimMax, aimMax, alive: true, civ: q.civ, life: q.civ ? 3 : 0 });
  }
  for (const f of s.foes) {
    if (!f.alive) continue;
    if (f.civ) {
      f.life -= dt;
      if (f.life <= 0) f.alive = false;
      continue;
    }
    f.aim -= dt;
    if (f.aim <= 0) {
      if (s.up) {
        s.hp--;
        s.hurt = 0.4;
      }
      f.aimMax = 1.9 / Math.min(1.6, s.level);
      f.aim = f.aimMax;
    }
  }
  s.foes = s.foes.filter((f) => f.alive);
  if (!up) {
    s.reload += dt;
    if (s.reload >= 0.7) s.ammo = MAG;
  } else s.reload = 0;
  if (s.hp <= 0 || (!s.queue.length && !s.foes.length)) s.done = true;
}
/** 쏘기(일어서 있을 때만). 맞힌 것: 'foe' | 'civ' | 'miss' | null(못 쏨) */
export function shootCover(s: Cover, x: number, y: number): 'foe' | 'civ' | 'miss' | null {
  if (s.done || !s.up || s.ammo <= 0) return null;
  s.ammo--;
  const f = s.foes.filter((q) => q.alive).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  if (!f || Math.hypot(f.x - x, f.y - y) > 55) return 'miss';
  f.alive = false;
  if (f.civ) {
    s.civHit++;
    return 'civ';
  }
  s.kills++;
  return 'foe';
}
export function coverScore(s: Cover): number {
  return clamp((s.kills / Math.max(1, s.total)) * 0.75 + (s.hp / CHP) * 0.25 - s.civHit * 0.1, 0, 1);
}

// ───────────────────────── 7 함대 포격전 ─────────────────────────
// 8×8 바다 두 판. 적 판을 눌러 포격, 맞히면 한 번 더. 적도 같은 규칙으로 쏨. 배 5척(4·3·3·2·2)을 먼저 다 가라앉히면 이김.
export const NN = 8, SHIPS = [4, 3, 3, 2, 2];
export interface Ship { cells: Array<[number, number]>; hits: number }
export interface Fleet { ships: Ship[]; shot: number[][] }
export interface Naval { me: Fleet; foe: Fleet; turn: 'me' | 'foe'; over: 'win' | 'lose' | null; myShots: number; seed: number; level: number }
export function placeFleet(rng: Rng): Fleet {
  for (let tries = 0; tries < 200; tries++) {
    const ships: Ship[] = [];
    const used = new Set<string>();
    let ok = true;
    for (const len of SHIPS) {
      let placed = false;
      for (let k = 0; k < 100 && !placed; k++) {
        const h = rng.chance(0.5);
        const r = Math.floor(rng.next() * (h ? NN : NN - len + 1)), c = Math.floor(rng.next() * (h ? NN - len + 1 : NN));
        const cells: Array<[number, number]> = Array.from({ length: len }, (_, i) => (h ? [r, c + i] : [r + i, c]));
        // 서로 붙지 않게
        if (cells.some(([a, b]) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => used.has(`${a + dr},${b + dc}`))))) continue;
        cells.forEach(([a, b]) => used.add(`${a},${b}`));
        ships.push({ cells, hits: 0 });
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (ok) return { ships, shot: Array.from({ length: NN }, () => Array(NN).fill(0)) };
  }
  throw new Error('배를 놓을 수 없음');
}
export function newNaval(seed: number, level = 1): Naval {
  const rng = new Rng(seed >>> 0 || 1);
  const me = placeFleet(rng), foe = placeFleet(rng);
  return { me, foe, turn: 'me', over: null, myShots: 0, seed: rng.seed, level };
}
export const shipAt = (f: Fleet, r: number, c: number) => f.ships.find((s) => s.cells.some(([a, b]) => a === r && b === c));
export const sunk = (s: Ship) => s.hits >= s.cells.length;
export const allSunk = (f: Fleet) => f.ships.every(sunk);
/** 쏘기: shot 1 = 빗나감 · 2 = 맞음 */
export function fireAt(f: Fleet, r: number, c: number): 'miss' | 'hit' | 'sunk' | 'again' {
  if (f.shot[r][c]) return 'again';
  const s = shipAt(f, r, c);
  if (!s) {
    f.shot[r][c] = 1;
    return 'miss';
  }
  f.shot[r][c] = 2;
  s.hits++;
  if (sunk(s)) {
    // 가라앉은 배 둘레는 빗나감으로 표시
    for (const [a, b] of s.cells) for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) if (f.shot[a + dr]?.[b + dc] === 0) f.shot[a + dr][b + dc] = 1;
    return 'sunk';
  }
  return 'hit';
}
/** 내 차례 쏘기 */
export function navalShoot(n: Naval, r: number, c: number): 'miss' | 'hit' | 'sunk' | 'again' | null {
  if (n.over || n.turn !== 'me') return null;
  const res = fireAt(n.foe, r, c);
  if (res === 'again') return res;
  n.myShots++;
  if (allSunk(n.foe)) n.over = 'win';
  else if (res === 'miss') n.turn = 'foe';
  return res;
}
/** 적 조준: 맞힌 배 둘레 먼저(찾기·쫓기), 없으면 바둑판 무늬로 아무 데나. 단계가 낮으면 가끔 헛쏨 */
export function aiPick(n: Naval): [number, number] {
  const f = n.me;
  const rng = new Rng(n.seed);
  const open = (r: number, c: number) => r >= 0 && c >= 0 && r < NN && c < NN && f.shot[r][c] === 0;
  const hits: Array<[number, number]> = [];
  for (let r = 0; r < NN; r++) for (let c = 0; c < NN; c++) if (f.shot[r][c] === 2 && !sunk(shipAt(f, r, c)!)) hits.push([r, c]);
  let pick: [number, number] | null = null;
  if (hits.length && rng.next() < 0.55 + n.level * 0.25) {
    const cand: Array<[number, number]> = [];
    if (hits.length >= 2) {
      const sameR = hits.every((h) => h[0] === hits[0][0]);
      const rs = hits.map((h) => h[0]), cs = hits.map((h) => h[1]);
      if (sameR) cand.push([hits[0][0], Math.min(...cs) - 1], [hits[0][0], Math.max(...cs) + 1]);
      else cand.push([Math.min(...rs) - 1, hits[0][1]], [Math.max(...rs) + 1, hits[0][1]]);
    }
    for (const [r, c] of hits) cand.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    const ok = cand.filter(([r, c]) => open(r, c));
    if (ok.length) pick = ok[0];
  }
  if (!pick) {
    const all: Array<[number, number]> = [];
    for (let r = 0; r < NN; r++) for (let c = 0; c < NN; c++) if (open(r, c) && (r + c) % 2 === 0) all.push([r, c]);
    if (!all.length) for (let r = 0; r < NN; r++) for (let c = 0; c < NN; c++) if (open(r, c)) all.push([r, c]);
    pick = all[Math.floor(rng.next() * all.length)];
  }
  n.seed = rng.seed;
  return pick;
}
/** 적 한 발 */
export function aiShoot(n: Naval): { at: [number, number]; res: 'miss' | 'hit' | 'sunk' | 'again' } | null {
  if (n.over || n.turn !== 'foe') return null;
  const at = aiPick(n);
  const res = fireAt(n.me, at[0], at[1]);
  if (allSunk(n.me)) n.over = 'lose';
  else if (res === 'miss') n.turn = 'me';
  return { at, res };
}
export function navalScore(n: Naval): number {
  const sunkN = n.foe.ships.filter(sunk).length / n.foe.ships.length;
  if (n.over === 'win') return clamp(0.7 + (1 - n.myShots / (NN * NN)) * 0.45, 0, 1);
  return Math.min(0.65, sunkN * 0.6);
}

// ───────────────────────── 8 어둠 속 사냥 ─────────────────────────
// 깜깜한 바다. 바다를 누르면 그쪽으로 감. 📡 핑을 치면 적 잠수함이 잠깐 보이지만 적도 내 위치를 앎(어뢰가 옴).
// 🎯 어뢰 버튼을 누르고 바다를 누르면 그쪽으로 어뢰. 적 3척을 잡아요. 적 어뢰는 가까우면 소리로 보임.
export const OW = 1600, OH = 900, OHP = 3, OTORPS = 8;
export interface ESub { x: number; y: number; wx: number; wy: number; alive: boolean; alert: number; cool: number; kx: number; ky: number }
export interface Torp { x: number; y: number; vx: number; vy: number; mine: boolean; left: number }
export interface Hunt {
  me: { x: number; y: number; tx: number; ty: number; hp: number }; foes: ESub[]; torps: Torp[]; pings: Array<Pt & { t: number; mine: boolean }>; contacts: Array<Pt & { t: number }>;
  pingCool: number; ammo: number; t: number; done: boolean; kills: number; seed: number; level: number; hurt: number;
}
export function newHunt(seed: number, level = 1): Hunt {
  const rng = new Rng(seed >>> 0 || 1);
  const foes: ESub[] = Array.from({ length: 3 }, (_, i) => {
    const x = rng.range(900, 1500), y = 150 + i * 280 + rng.range(-60, 60);
    return { x, y, wx: x, wy: y, alive: true, alert: 0, cool: rng.range(2, 4), kx: 0, ky: 0 };
  });
  return { me: { x: 180, y: OH / 2, tx: 180, ty: OH / 2, hp: OHP }, foes, torps: [], pings: [], contacts: [], pingCool: 0, ammo: OTORPS, t: 0, done: false, kills: 0, seed: rng.seed, level, hurt: 0 };
}
export function huntPing(s: Hunt): boolean {
  if (s.done || s.pingCool > 0) return false;
  s.pingCool = 3;
  s.pings.push({ x: s.me.x, y: s.me.y, t: 0, mine: true });
  for (const f of s.foes) {
    if (!f.alive) continue;
    const d = Math.hypot(f.x - s.me.x, f.y - s.me.y);
    if (d < 1100) s.contacts.push({ x: f.x, y: f.y, t: 0 });
    if (d < 1300) {
      f.alert = 6;
      f.kx = s.me.x;
      f.ky = s.me.y;
      f.cool = Math.min(f.cool, 1.4 / Math.min(1.6, s.level));
    }
  }
  return true;
}
export function huntMove(s: Hunt, x: number, y: number) {
  s.me.tx = clamp(x, 40, OW - 40);
  s.me.ty = clamp(y, 60, OH - 40);
}
export function huntFire(s: Hunt, x: number, y: number): boolean {
  if (s.done || s.ammo <= 0) return false;
  const d = Math.hypot(x - s.me.x, y - s.me.y);
  if (d < 10) return false;
  s.ammo--;
  s.torps.push({ x: s.me.x, y: s.me.y, vx: ((x - s.me.x) / d) * 280, vy: ((y - s.me.y) / d) * 280, mine: true, left: 1500 });
  return true;
}
export function stepHunt(s: Hunt, dt: number): void {
  if (s.done) return;
  s.t += dt;
  s.hurt = Math.max(0, s.hurt - dt);
  s.pingCool = Math.max(0, s.pingCool - dt);
  const rng = new Rng(s.seed);
  const m = s.me;
  const d = Math.hypot(m.tx - m.x, m.ty - m.y);
  if (d > 2) {
    const v = Math.min(d, 95 * dt);
    m.x += ((m.tx - m.x) / d) * v;
    m.y += ((m.ty - m.y) / d) * v;
  }
  const lv = Math.min(1.6, s.level);
  for (const f of s.foes) {
    if (!f.alive) continue;
    // 가까우면 엔진 소리로 알아챔
    if (Math.hypot(f.x - m.x, f.y - m.y) < 200) {
      f.alert = 4;
      f.kx = m.x;
      f.ky = m.y;
    }
    const gx = f.alert > 0 ? f.kx + (f.x > f.kx ? 350 : -350) : f.wx, gy = f.alert > 0 ? f.ky : f.wy;
    const fd = Math.hypot(gx - f.x, gy - f.y);
    if (fd < 20) {
      f.wx = rng.range(600, OW - 80);
      f.wy = rng.range(80, OH - 60);
    } else {
      const v = 38 * lv * dt;
      f.x += ((gx - f.x) / fd) * v;
      f.y += ((gy - f.y) / fd) * v;
    }
    f.alert = Math.max(0, f.alert - dt);
    f.cool -= dt;
    if (f.alert > 0 && f.cool <= 0) {
      const td = Math.hypot(f.kx - f.x, f.ky - f.y) || 1;
      s.torps.push({ x: f.x, y: f.y, vx: ((f.kx - f.x) / td) * 170 * lv, vy: ((f.ky - f.y) / td) * 170 * lv, mine: false, left: 1400 });
      f.cool = 4.5 / lv;
      s.pings.push({ x: f.x, y: f.y, t: 0.6, mine: false });
    }
  }
  for (const t of s.torps) {
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.left -= Math.hypot(t.vx, t.vy) * dt;
    if (t.mine) {
      const f = s.foes.find((q) => q.alive && Math.hypot(q.x - t.x, q.y - t.y) < 42);
      if (f) {
        f.alive = false;
        s.kills++;
        t.left = 0;
        s.pings.push({ x: f.x, y: f.y, t: 0.5, mine: false });
      }
    } else if (Math.hypot(m.x - t.x, m.y - t.y) < 34) {
      m.hp--;
      s.hurt = 0.6;
      t.left = 0;
    }
  }
  s.torps = s.torps.filter((t) => t.left > 0 && t.x > -50 && t.x < OW + 50 && t.y > -50 && t.y < OH + 50);
  for (const p of s.pings) p.t += dt;
  s.pings = s.pings.filter((p) => p.t < 2.2);
  for (const c of s.contacts) c.t += dt;
  s.contacts = s.contacts.filter((c) => c.t < 3);
  s.seed = rng.seed;
  if (m.hp <= 0 || s.kills >= s.foes.length || (s.ammo <= 0 && !s.torps.some((t) => t.mine))) s.done = true;
}
export function huntScore(s: Hunt): number {
  return clamp((s.kills / s.foes.length) * 0.7 + (s.kills >= s.foes.length ? (s.me.hp / OHP) * 0.3 : 0), 0, 1);
}

// ───────────────────────── 9 자폭 보트 돌격 ─────────────────────────
// 무인 자폭 보트가 오른쪽으로 달림. 화면을 위아래로 끌어 방향. 기뢰·부표·경비정 총알을 피하고 ⛽ 연료를 먹어요.
// 끝에서 적 구축함 옆구리(빨간 띠)에 들이받으면 성공.
export const RL = 7000, RH = 900, RHP = 3;
export interface RObs { x: number; y: number; k: 'mine' | 'buoy' | 'patrol' | 'fuel'; vy: number; cool: number; gone: boolean }
export interface Run {
  x: number; y: number; ty: number; hp: number; fuel: number; obs: RObs[]; bullets: Array<{ x: number; y: number; vx: number; vy: number }>; ship: { y: number; h: number };
  done: boolean; win: boolean; t: number; invul: number; seed: number; level: number; bumps: number;
}
export function newRun(seed: number, level = 1): Run {
  const rng = new Rng(seed >>> 0 || 1);
  const obs: RObs[] = [];
  for (let x = 900; x < RL - 700; x += rng.range(140, 260) / Math.min(1.5, level)) {
    const r = rng.next();
    const k: RObs['k'] = r < 0.45 ? 'mine' : r < 0.65 ? 'buoy' : r < 0.82 ? 'patrol' : 'fuel';
    obs.push({ x, y: rng.range(90, RH - 90), k, vy: k === 'patrol' ? rng.range(60, 120) * (rng.chance(0.5) ? 1 : -1) : 0, cool: rng.range(0.5, 1.5), gone: false });
  }
  return { x: 0, y: RH / 2, ty: RH / 2, hp: RHP, fuel: 100, obs, bullets: [], ship: { y: rng.range(250, RH - 250), h: 220 }, done: false, win: false, t: 0, invul: 0, seed: rng.seed, level, bumps: 0 };
}
export const runSpeed = (s: Run) => (420 + (s.x / RL) * 220) * Math.min(1.3, 0.85 + s.level * 0.15);
export function stepRun(s: Run, dt: number): void {
  if (s.done) return;
  s.t += dt;
  s.invul = Math.max(0, s.invul - dt);
  s.x += runSpeed(s) * dt;
  const dy = s.ty - s.y;
  s.y += clamp(dy, -700 * dt, 700 * dt);
  s.y = clamp(s.y, 40, RH - 40);
  s.fuel -= dt * 5.5;
  const hit = () => {
    if (s.invul > 0) return;
    s.hp--;
    s.bumps++;
    s.invul = 1;
  };
  for (const o of s.obs) {
    if (o.gone) continue;
    if (o.k === 'patrol') {
      o.y += o.vy * dt;
      if (o.y < 80 || o.y > RH - 80) o.vy *= -1;
      if (o.x > s.x && o.x - s.x < 900) {
        o.cool -= dt;
        if (o.cool <= 0) {
          o.cool = 1.6 / Math.min(1.5, s.level);
          const d = Math.hypot(s.x - o.x, s.y - o.y) || 1;
          s.bullets.push({ x: o.x, y: o.y, vx: ((s.x - o.x) / d) * 380, vy: ((s.y - o.y) / d) * 380 });
        }
      }
    }
    const r = o.k === 'patrol' ? 55 : o.k === 'fuel' ? 45 : 38;
    if (Math.abs(o.x - s.x) < r && Math.abs(o.y - s.y) < r * 0.8) {
      o.gone = true;
      if (o.k === 'fuel') s.fuel = Math.min(100, s.fuel + 28);
      else hit();
    }
  }
  for (const b of s.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (Math.abs(b.x - s.x) < 30 && Math.abs(b.y - s.y) < 22) {
      b.x = -9999;
      hit();
    }
  }
  s.bullets = s.bullets.filter((b) => b.x > s.x - 400 && b.y > -20 && b.y < RH + 20);
  if (s.hp <= 0 || s.fuel <= 0) {
    s.done = true;
    return;
  }
  if (s.x >= RL - 160) {
    s.done = true;
    s.win = Math.abs(s.y - s.ship.y) < s.ship.h / 2;
  }
}
export function runScore(s: Run): number {
  if (s.win) return clamp(0.7 + (s.hp / RHP) * 0.3, 0, 1);
  return Math.min(0.6, (s.x / RL) * 0.6);
}

// ───────────────────────── 10 스텔스 침투 ─────────────────────────
// 지도에 손가락으로 비행 길을 그려요(출발 ✈ → 표적 🎯). ▶ 출격하면 그 길로 날아감. 레이더 빛줄기가 스치면 탐지 막대가 참.
// 산골짜기(초록) 위는 낮게 날아 덜 잡힘. 막대가 차면 격추. 작전 3번.
export const AW = 1600, AH = 900, FLY = 270;
export interface Radar { x: number; y: number; r: number; a0: number; spd: number }
export interface Mission { radars: Radar[]; valleys: Array<Pt & { r: number }>; start: Pt; target: Pt; maxLen: number }
export interface Stealth { missions: Mission[]; m: number; path: Pt[]; flying: boolean; pos: number; det: number; res: Array<'ok' | 'shot'>; done: boolean; t: number; ft: number }
export function newStealth(seed: number, level = 1): Stealth {
  const rng = new Rng(seed >>> 0 || 1);
  const missions: Mission[] = [0, 1, 2].map((i) => {
    const start = { x: 110, y: rng.range(150, AH - 150) }, target = { x: AW - 120, y: rng.range(150, AH - 150) };
    const radars: Radar[] = Array.from({ length: 3 + i + (level >= 1.4 ? 1 : 0) }, () => ({ x: rng.range(400, AW - 380), y: rng.range(120, AH - 120), r: rng.range(170, 250), a0: rng.range(0, 6.28), spd: rng.range(0.7, 1.3) * (rng.chance(0.5) ? 1 : -1) * Math.min(1.5, level) }));
    const valleys = Array.from({ length: 4 }, () => ({ x: rng.range(350, AW - 350), y: rng.range(120, AH - 120), r: rng.range(70, 120) }));
    return { radars, valleys, start, target, maxLen: Math.hypot(target.x - start.x, target.y - start.y) * 1.9 };
  });
  return { missions, m: 0, path: [], flying: false, pos: 0, det: 0, res: [], done: false, t: 0, ft: 0 };
}
export const pathLen = (p: Pt[]) => p.reduce((s, q, i) => (i ? s + Math.hypot(q.x - p[i - 1].x, q.y - p[i - 1].y) : 0), 0);
export function pointAt(p: Pt[], d: number): Pt {
  for (let i = 1; i < p.length; i++) {
    const L = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    if (d <= L) {
      const k = L ? d / L : 0;
      return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * k, y: p[i - 1].y + (p[i].y - p[i - 1].y) * k };
    }
    d -= L;
  }
  return p[p.length - 1] ?? { x: 0, y: 0 };
}
/** 길 그리기 한 점 더하기(연료만큼만) */
export function addPoint(s: Stealth, q: Pt): boolean {
  const ms = s.missions[s.m];
  if (!ms || s.flying) return false;
  if (!s.path.length) {
    if (Math.hypot(q.x - ms.start.x, q.y - ms.start.y) > 90) return false;
    s.path = [{ ...ms.start }];
  }
  const last = s.path[s.path.length - 1];
  const d = Math.hypot(q.x - last.x, q.y - last.y);
  if (d < 10) return true;
  if (pathLen(s.path) + d > ms.maxLen) return false;
  s.path.push({ x: clamp(q.x, 0, AW), y: clamp(q.y, 0, AH) });
  return true;
}
export const pathReady = (s: Stealth) => {
  const ms = s.missions[s.m];
  const last = s.path[s.path.length - 1];
  return !!ms && !!last && s.path.length > 2 && Math.hypot(last.x - ms.target.x, last.y - ms.target.y) < 60;
};
export const beamAngle = (r: Radar, t: number) => r.a0 + r.spd * t;
/** 이 자리에서 탐지 속도(초당) */
export function detectRate(ms: Mission, p: Pt, t: number): number {
  let k = 0;
  const low = ms.valleys.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < v.r);
  for (const r of ms.radars) {
    const d = Math.hypot(p.x - r.x, p.y - r.y);
    if (d > r.r) continue;
    let da = Math.atan2(p.y - r.y, p.x - r.x) - beamAngle(r, t);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < 0.4) k += 2.2;
    if (d < r.r * 0.3) k += 0.8;
  }
  return low ? k * 0.3 : k;
}
export function fly(s: Stealth): boolean {
  if (!pathReady(s) || s.flying) return false;
  s.flying = true;
  s.pos = 0;
  s.det = 0;
  s.ft = 0;
  return true;
}
export function stepStealth(s: Stealth, dt: number): void {
  if (s.done) return;
  s.t += dt;
  if (!s.flying) return;
  const ms = s.missions[s.m];
  s.ft += dt;
  s.pos += FLY * dt;
  const p = pointAt(s.path, s.pos);
  const r = detectRate(ms, p, s.t);
  s.det = r > 0 ? s.det + r * dt : Math.max(0, s.det - 0.25 * dt);
  const end = (x: 'ok' | 'shot') => {
    s.res.push(x);
    s.m++;
    s.path = [];
    s.flying = false;
    s.pos = 0;
    if (s.m >= s.missions.length) s.done = true;
  };
  if (s.det >= 1) end('shot');
  else if (s.pos >= pathLen(s.path)) end('ok');
}
export function stealthScore(s: Stealth): number {
  const ok = s.res.filter((x) => x === 'ok').length;
  return clamp((ok / s.missions.length) * 0.95 + (ok === s.missions.length ? 0.05 : 0), 0, 1);
}
