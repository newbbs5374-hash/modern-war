// 체력 훈련(② 옆보기 실시간): 장애물 코스. 점프·포복 타이밍, 달리기/걷기로 체력 관리.
// 1초 20번 계산, 같은 씨앗 + 같은 입력 = 같은 결과.
import { Rng } from '../game/rng';

export const COURSE_TICK = 50;
export const COURSE_LEN = 1200;
export type Obstacle = { x: number; kind: '허들' | '철조망' | '벽' };
/** 장애물마다 맞는 동작 */
export const OBSTACLE_ACT: Record<Obstacle['kind'], '점프' | '포복'> = { 허들: '점프', 벽: '점프', 철조망: '포복' };
export const OBSTACLE_ICON: Record<Obstacle['kind'], string> = { 허들: '🚧', 벽: '🧱', 철조망: '〰️' };

export interface CourseRun {
  t: number;
  x: number;
  stamina: number;
  staminaMax: number;
  running: boolean;
  /** 누른 동작(잠깐 유지) */
  act: { kind: '점프' | '포복'; until: number } | null;
  /** 넘어져서 멈춘 시간 끝 */
  stunUntil: number;
  obstacles: Obstacle[];
  next: number;
  falls: number;
  par: number;
  timeLimit: number;
  runSpeed: number;
  drain: number;
  result: { win: boolean; stars: number; text: string } | null;
}

export interface CourseSetup {
  rank: number;
  stats: Record<string, number>;
  seed: number;
}

export function createCourse(o: CourseSetup): CourseRun {
  const rng = new Rng(o.seed >>> 0);
  const cap = 20 + o.rank * 10;
  const rel = Math.min(1, (o.stats['체력'] ?? 8) / cap);
  const obstacles: Obstacle[] = [];
  let x = 140;
  const kinds: Obstacle['kind'][] = ['허들', '철조망', '벽'];
  // 계급이 오르면 코스가 길어지고 장애물이 많아짐
  const n = 8 + Math.min(6, o.rank);
  const gap = (COURSE_LEN - 200) / n;
  for (let i = 0; i < n; i++) {
    obstacles.push({ x: Math.round(x + rng.range(-20, 20)), kind: rng.pick(kinds) });
    x += gap;
  }
  const runSpeed = 120 + rel * 30;
  const par = (COURSE_LEN / runSpeed) * 1000 * 1.15;
  return {
    t: 0,
    x: 0,
    stamina: 100,
    staminaMax: 100,
    running: true,
    act: null,
    stunUntil: 0,
    obstacles,
    next: 0,
    falls: 0,
    par,
    timeLimit: par * 1.9,
    runSpeed,
    drain: 16 - rel * 7,
    result: null,
  };
}

function clone(c: CourseRun): CourseRun {
  return { ...c, act: c.act ? { ...c.act } : null };
}

export function press(c0: CourseRun, kind: '점프' | '포복'): CourseRun {
  if (c0.result) return c0;
  return { ...c0, act: { kind, until: c0.t + 450 } };
}
export function setRunning(c0: CourseRun, running: boolean): CourseRun {
  return c0.result ? c0 : { ...c0, running };
}

function tick(c: CourseRun) {
  const dt = COURSE_TICK / 1000;
  c.t += COURSE_TICK;
  if (c.act && c.t > c.act.until) c.act = null;
  const tired = c.stamina <= 0;
  if (c.t >= c.stunUntil) {
    const sp = c.running && !tired ? c.runSpeed : 60;
    // 장애물 앞에서 판정
    const ob = c.obstacles[c.next];
    const nx = c.x + sp * dt;
    if (ob && nx >= ob.x - 8) {
      if (c.act && c.act.kind === OBSTACLE_ACT[ob.kind]) {
        c.next++;
        c.x = nx;
        c.act = null;
      } else {
        // 걸려 넘어짐: 1.2초 멈춤, 장애물은 기어서 넘음
        c.falls++;
        c.stunUntil = c.t + 1200;
        c.next++;
        c.x = ob.x;
      }
    } else c.x = nx;
  }
  c.stamina = Math.max(0, Math.min(c.staminaMax, c.stamina + (c.running && !tired ? -c.drain : 14) * dt));
  if (c.stamina <= 0 && c.running) c.running = false;
  if (c.x >= COURSE_LEN) {
    const stars = c.t <= c.par && c.falls === 0 ? 3 : c.t <= c.par * 1.3 && c.falls <= 2 ? 2 : 1;
    c.result = { win: true, stars, text: `${(c.t / 1000).toFixed(1)}초에 들어왔어요(기준 ${(c.par / 1000).toFixed(1)}초, 넘어짐 ${c.falls}번).` };
  } else if (c.t >= c.timeLimit) c.result = { win: false, stars: 0, text: '제한 시간 안에 못 들어왔어요.' };
}

/** 자동: 장애물 바로 앞에서 맞는 동작, 체력이 30 아래면 걷기 */
function autoAct(c: CourseRun) {
  const ob = c.obstacles[c.next];
  if (ob && ob.x - c.x < 30 && !c.act) c.act = { kind: OBSTACLE_ACT[ob.kind], until: c.t + 450 };
  if (c.running && c.stamina < 20) c.running = false;
  if (!c.running && c.stamina > 60) c.running = true;
}

export function stepCourse(c0: CourseRun, ms: number, auto: boolean): CourseRun {
  if (c0.result) return c0;
  const c = clone(c0);
  const n = Math.floor(ms / COURSE_TICK);
  for (let i = 0; i < n && !c.result; i++) {
    if (auto) autoAct(c);
    tick(c);
  }
  return c;
}

export function finishCourse(c0: CourseRun): CourseRun {
  let c = c0;
  for (let i = 0; i < 400 && !c.result; i++) c = stepCourse(c, 500, true);
  return c;
}
