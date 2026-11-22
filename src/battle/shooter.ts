// 전투 틀 ④ 위에서 본 슈팅: 위에서 본 하늘, 실시간(1초 20번). 손가락으로 움직이면 기관포는 자동 발사.
// 적 전투기 물결을 넘기고 마지막 폭격기를 떨어뜨리면 승리.
import { Rng } from '../game/rng';

export const SH_W = 300;
export const SH_H = 460;
export const SH_TICK = 50;

export interface Plane {
  id: number;
  kind: '전투기' | '지그재그' | '포대' | '폭격기';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  cd: number;
  born: number;
}
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mine: boolean;
}

export interface ShooterBattle {
  t: number;
  me: { x: number; y: number; hp: number; maxHp: number; cd: number; hurtUntil: number };
  aim: { x: number; y: number };
  planes: Plane[];
  bullets: Bullet[];
  spawns: Array<{ t: number; kind: Plane['kind']; x: number }>;
  seed: number;
  nextId: number;
  dmg: number;
  speed: number;
  foePower: number;
  kills: number;
  bossSpawned: boolean;
  result: { win: boolean; stars: number; text: string } | null;
}

export interface ShooterSetup {
  difficulty: number;
  rank: number;
  stats: Record<string, number>;
  seed: number;
}

const HP: Record<Plane['kind'], number> = { 전투기: 3, 지그재그: 4, 포대: 8, 폭격기: 60 };

export function createShooter(o: ShooterSetup): ShooterBattle {
  const rng = new Rng(o.seed >>> 0);
  const cap = 20 + o.rank * 10;
  const rel = (k: string) => Math.min(1, (o.stats[k] ?? 8) / cap);
  const p = 0.95 + (o.difficulty - 1) * 0.8 + o.rank * 0.08;
  const spawns: ShooterBattle['spawns'] = [];
  // 45초 동안 물결 9개
  for (let i = 0; i < 9; i++) {
    const t = 1500 + i * 5000;
    const kind: Plane['kind'] = i % 4 === 3 ? '포대' : i % 2 ? '지그재그' : '전투기';
    const n = kind === '포대' ? 1 + Math.floor(p) : 3 + Math.floor(i / 3) + Math.floor(p - 0.85);
    for (let k = 0; k < n; k++) spawns.push({ t: t + k * 350, kind, x: kind === '포대' ? rng.range(40, SH_W - 40) : 30 + ((k * 61 + i * 37) % (SH_W - 60)) });
  }
  const maxHp = 5 + Math.floor(o.rank / 3) + Math.round(rel('체력') * 2);
  return {
    t: 0,
    me: { x: SH_W / 2, y: SH_H - 50, hp: maxHp, maxHp, cd: 0, hurtUntil: 0 },
    aim: { x: SH_W / 2, y: SH_H - 50 },
    planes: [],
    bullets: [],
    spawns,
    seed: rng.seed,
    nextId: 1,
    dmg: 1 + rel('사격') * 0.8,
    speed: 220 + rel('전술') * 80,
    foePower: p,
    kills: 0,
    bossSpawned: false,
    result: null,
  };
}

function clone(b: ShooterBattle): ShooterBattle {
  return {
    ...b,
    me: { ...b.me },
    aim: { ...b.aim },
    planes: b.planes.map((x) => ({ ...x })),
    bullets: b.bullets.map((x) => ({ ...x })),
    spawns: [...b.spawns],
  };
}

function spawn(b: ShooterBattle, kind: Plane['kind'], x: number) {
  const hp = Math.round(HP[kind] * (0.7 + 0.3 * b.foePower));
  const pl: Plane = { id: b.nextId++, kind, x, y: -20, vx: 0, vy: 0, hp, maxHp: hp, cd: 800, born: b.t };
  if (kind === '전투기') pl.vy = 90;
  if (kind === '지그재그') pl.vy = 70;
  if (kind === '포대') pl.vy = 40;
  if (kind === '폭격기') {
    pl.vy = 14;
    pl.x = SH_W / 2;
  }
  b.planes.push(pl);
}

function tick(b: ShooterBattle, rng: Rng) {
  const dt = SH_TICK / 1000;
  b.t += SH_TICK;
  while (b.spawns.length && b.spawns[0].t <= b.t) {
    const s = b.spawns.shift()!;
    spawn(b, s.kind, s.x);
  }
  if (!b.spawns.length && !b.bossSpawned && b.t >= 48_000) {
    b.bossSpawned = true;
    spawn(b, '폭격기', SH_W / 2);
  }
  // 내 비행기: 목표 쪽으로
  const dx = b.aim.x - b.me.x;
  const dy = b.aim.y - b.me.y;
  const d = Math.hypot(dx, dy);
  const step = b.speed * dt;
  if (d > 0.5) {
    b.me.x += (dx / d) * Math.min(step, d);
    b.me.y += (dy / d) * Math.min(step, d);
  }
  b.me.x = Math.max(12, Math.min(SH_W - 12, b.me.x));
  b.me.y = Math.max(SH_H * 0.45, Math.min(SH_H - 14, b.me.y));
  b.me.cd -= SH_TICK;
  if (b.me.cd <= 0) {
    b.me.cd = 180;
    b.bullets.push({ x: b.me.x - 5, y: b.me.y - 12, vx: 0, vy: -620, mine: true }, { x: b.me.x + 5, y: b.me.y - 12, vx: 0, vy: -620, mine: true });
  }
  // 적
  for (const p of b.planes) {
    if (p.kind === '지그재그') p.vx = Math.sin((b.t - p.born) / 400) * 110;
    if (p.kind === '포대' && p.y > 90) p.vy = 0;
    if (p.kind === '폭격기' && p.y > 70 && b.t - p.born < 25_000) p.vy = 4;
    if (p.kind === '폭격기' && b.t - p.born >= 25_000) p.vy = 30;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.cd -= SH_TICK;
    if (p.cd <= 0 && p.y > 0) {
      const rate = p.kind === '폭격기' ? 600 : p.kind === '포대' ? 1100 : 1700;
      p.cd = rate / Math.max(0.6, b.foePower) + rng.range(0, 300);
      const ax = b.me.x - p.x;
      const ay = b.me.y - p.y;
      const al = Math.hypot(ax, ay) || 1;
      const sp = 170 + b.foePower * 30;
      if (p.kind === '폭격기') {
        for (const a of [-0.35, 0, 0.35]) {
          const ang = Math.atan2(ay, ax) + a;
          b.bullets.push({ x: p.x, y: p.y + 14, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, mine: false });
        }
      } else b.bullets.push({ x: p.x, y: p.y + 8, vx: (ax / al) * sp, vy: (ay / al) * sp, mine: false });
    }
  }
  // 총알
  for (const u of b.bullets) {
    u.x += u.vx * dt;
    u.y += u.vy * dt;
  }
  for (const u of b.bullets) {
    if (u.mine) {
      for (const p of b.planes) {
        const r = p.kind === '폭격기' ? 34 : 13;
        if (p.hp > 0 && Math.abs(u.x - p.x) < r && Math.abs(u.y - p.y) < r) {
          p.hp -= b.dmg;
          u.y = -999;
          if (p.hp <= 0) b.kills++;
          break;
        }
      }
    } else if (b.t >= b.me.hurtUntil && Math.abs(u.x - b.me.x) < 9 && Math.abs(u.y - b.me.y) < 11) {
      b.me.hp -= 1;
      b.me.hurtUntil = b.t + 900;
      u.y = 9999;
    }
  }
  // 몸통 박치기
  for (const p of b.planes) {
    if (p.hp > 0 && p.kind !== '폭격기' && b.t >= b.me.hurtUntil && Math.abs(p.x - b.me.x) < 16 && Math.abs(p.y - b.me.y) < 16) {
      b.me.hp -= 1;
      p.hp = 0;
      b.me.hurtUntil = b.t + 900;
    }
  }
  const boss = b.planes.find((p) => p.kind === '폭격기');
  b.bullets = b.bullets.filter((u) => u.y > -20 && u.y < SH_H + 20 && u.x > -20 && u.x < SH_W + 20);
  b.planes = b.planes.filter((p) => p.hp > 0 && p.y < SH_H + 30);
  // 승패
  if (b.me.hp <= 0) b.result = { win: false, stars: 0, text: '격추당했어요. 공중전 패배.' };
  else if (b.bossSpawned && boss && boss.hp <= 0) {
    const q = b.me.hp / b.me.maxHp;
    b.result = { win: true, stars: q >= 0.7 ? 3 : q >= 0.4 ? 2 : 1, text: '폭격기를 떨어뜨렸어요! 공중전 승리.' };
  } else if (b.bossSpawned && !boss) b.result = { win: false, stars: 0, text: '폭격기가 빠져나갔어요. 공중전 실패.' };
}

/** 자동 조종: 다가오는 총알을 피하고, 가까운 적 아래로 */
function autoAim(b: ShooterBattle) {
  const look = 0.7;
  const danger = (x: number, y: number) => {
    let s = 0;
    for (const u of b.bullets) {
      if (u.mine) continue;
      for (let k = 1; k <= 7; k++) {
        const tt = (look * k) / 7;
        const bx = u.x + u.vx * tt;
        const by = u.y + u.vy * tt;
        if (Math.abs(bx - x) < 16 && Math.abs(by - y) < 18) s += 8 - k;
      }
    }
    for (const p of b.planes) if (p.kind !== '폭격기' && Math.abs(p.x - x) < 26 && p.y > y - 120 && p.y < y + 20) s += 6;
    return s;
  };
  const target = [...b.planes].sort((a, c) => (a.kind === '폭격기' ? -1 : 0) - (c.kind === '폭격기' ? -1 : 0) || c.y - a.y)[0];
  const want = target ? target.x : SH_W / 2;
  let best = { x: b.me.x, y: b.me.y, s: 1e9 };
  for (let i = -4; i <= 4; i++) {
    for (const yy of [SH_H - 50, SH_H - 110]) {
      const x = Math.max(14, Math.min(SH_W - 14, b.me.x + i * 22));
      const s = danger(x, yy) * 10 + Math.abs(x - want) * 0.05 + Math.abs(yy - b.me.y) * 0.02;
      if (s < best.s) best = { x, y: yy, s };
    }
  }
  b.aim = { x: best.x, y: best.y };
}

/** ms만큼 진행. aim = 손가락 자리(null이면 그대로), auto = 자동 조종 */
export function stepShooter(b0: ShooterBattle, ms: number, auto: boolean, aim: { x: number; y: number } | null): ShooterBattle {
  if (b0.result) return b0;
  const b = clone(b0);
  if (aim) b.aim = { ...aim };
  const rng = new Rng(b.seed);
  const n = Math.floor(ms / SH_TICK);
  for (let i = 0; i < n && !b.result; i++) {
    if (auto && b.t % 100 === 0) autoAim(b);
    tick(b, rng);
  }
  b.seed = rng.seed;
  return b;
}

export function finishShooter(b0: ShooterBattle): ShooterBattle {
  let b = b0;
  for (let i = 0; i < 400 && !b.result; i++) b = stepShooter(b, 500, true, null);
  if (!b.result) b = { ...b, result: { win: false, stars: 0, text: '시간이 다 됐어요.' } };
  return b;
}
