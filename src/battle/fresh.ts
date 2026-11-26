// 새 훈련 12개(11-26 대장 결정: 틀 A~D 모두 + 훈련마다 ★★ 1개).
// 틀 A 1인칭 눈높이 · B 계획 짜고 재생 · C 대화로 풀기 · D 기지 관리판.
// 여기는 화면 없는 계산만(시험에서 그대로 돌림). 화면은 src/ui/battle/mini/fresh*.tsx
import { Rng } from '../game/rng';

/** a~b 정수(둘 다 포함) */
export const ri = (rng: Rng, a: number, b: number) => a + Math.floor(rng.next() * (b - a + 1));

export type FreshFrame = 'A' | 'B' | 'C' | 'D';
export const FRAME_NAME: Record<FreshFrame, string> = { A: '1인칭', B: '계획→재생', C: '대화', D: '관리판' };

/* ═════════════ 틀 B-1 전술: 작전 지도 동시 진행 ═════════════ */
export const WG = { W: 9, H: 11, ROUNDS: 4, SECS: 8, RANGE: 3, HP: 100 } as const;
export type Cell = 'o' | 'f' | 'h'; // 들판 · 숲 · 건물(엄폐)
export interface WUnit { id: string; side: 'us' | 'foe'; c: number; r: number; hp: number; path: Array<[number, number]> }
export interface WGame { map: Cell[][]; units: WUnit[]; flag: [number, number]; round: number; log: string[] }

export function wegoNew(seed: number): WGame {
  const rng = new Rng(seed >>> 0 || 1);
  const map: Cell[][] = Array.from({ length: WG.H }, () => Array.from({ length: WG.W }, () => 'o' as Cell));
  // 숲 덩어리 4개 · 건물 5채(씨앗마다 다름)
  for (let k = 0; k < 4; k++) {
    const c = ri(rng, 0, WG.W - 2), r = ri(rng, 2, WG.H - 4);
    for (let i = 0; i < 4; i++) map[r + (i >> 1)][c + (i & 1)] = 'f';
  }
  for (let k = 0; k < 5; k++) map[ri(rng, 1, WG.H - 3)][ri(rng, 0, WG.W - 1)] = 'h';
  const flag: [number, number] = [4, 1];
  map[1][4] = 'h';
  const units: WUnit[] = [];
  [2, 4, 6].forEach((c, i) => units.push({ id: `u${i}`, side: 'us', c, r: WG.H - 1, hp: WG.HP, path: [] }));
  [[1, 2], [4, 0], [7, 2], [4, 3]].forEach(([c, r], i) => units.push({ id: `e${i}`, side: 'foe', c, r, hp: WG.HP, path: [] }));
  return { map, units, flag, round: 0, log: [] };
}

const cheb = (a: { c: number; r: number }, b: { c: number; r: number }) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const inMap = (c: number, r: number) => c >= 0 && r >= 0 && c < WG.W && r < WG.H;

/** 적 계획: 가까이 오면 엄폐물에서 버티고, 멀면 가장 가까운 우리 쪽 엄폐 칸으로 한 걸음씩 */
export function wegoFoePlan(g: WGame): void {
  const us = g.units.filter((u) => u.side === 'us' && u.hp > 0);
  g.units.filter((u) => u.side === 'foe' && u.hp > 0).forEach((e, i) => {
    e.path = [];
    if (!us.length) return;
    const near = us.reduce((a, b) => (cheb(a, e) <= cheb(b, e) ? a : b));
    if (i === 1 || cheb(near, e) <= WG.RANGE + 1) return; // 하나는 깃발 지킴, 가까우면 버팀
    let best: [number, number] | null = null;
    let bd = 99;
    for (let r = 0; r < WG.H; r++)
      for (let c = 0; c < WG.W; c++) {
        if (g.map[r][c] === 'o' || cheb({ c, r }, e) > 3) continue;
        const d = cheb({ c, r }, near);
        if (d < bd && d >= 2) (bd = d), (best = [c, r]);
      }
    if (best) e.path = [best];
  });
}

/** 한 판(8초) 돌리기: 모두 동시에 1초에 한 칸, 사거리 안 가장 가까운 적을 쏨 */
export function wegoRun(g: WGame): WGame {
  for (let t = 0; t < WG.SECS; t++) {
    const moved = new Set<string>();
    for (const u of g.units) {
      if (u.hp <= 0 || !u.path.length) continue;
      const [tc, tr] = u.path[0];
      const nc = u.c + Math.sign(tc - u.c), nr = u.r + Math.sign(tr - u.r);
      if (inMap(nc, nr) && !g.units.some((o) => o !== u && o.hp > 0 && o.c === nc && o.r === nr)) {
        u.c = nc;
        u.r = nr;
        moved.add(u.id);
      }
      if (u.c === tc && u.r === tr) u.path.shift();
    }
    const dmg = new Map<WUnit, number>();
    for (const u of g.units) {
      if (u.hp <= 0) continue;
      const foes = g.units.filter((o) => o.side !== u.side && o.hp > 0 && cheb(o, u) <= WG.RANGE);
      if (!foes.length) continue;
      const tgt = foes.reduce((a, b) => (cheb(a, u) <= cheb(b, u) ? a : b));
      const cover = g.map[tgt.r][tgt.c] === 'h' ? 0.4 : g.map[tgt.r][tgt.c] === 'f' ? 0.6 : 1;
      dmg.set(tgt, (dmg.get(tgt) ?? 0) + 14 * cover * (moved.has(u.id) ? 0.6 : 1) * (u.side === 'foe' ? 0.85 : 1));
    }
    dmg.forEach((d, u) => (u.hp = Math.max(0, u.hp - d)));
  }
  g.round++;
  for (const u of g.units) u.path = [];
  return g;
}

export function wegoScore(g: WGame): number {
  const foes = g.units.filter((u) => u.side === 'foe');
  const us = g.units.filter((u) => u.side === 'us');
  const killed = foes.filter((u) => u.hp <= 0).length / foes.length;
  const alive = us.filter((u) => u.hp > 0);
  const hold = alive.some((u) => cheb(u, { c: g.flag[0], r: g.flag[1] }) <= 1) && !foes.some((u) => u.hp > 0 && cheb(u, { c: g.flag[0], r: g.flag[1] }) <= 1);
  return Math.max(0, Math.min(1, killed * 0.6 + (hold ? 0.3 : 0) + (alive.length / us.length) * 0.1));
}

/* ═════════════ 틀 B-2 해킹: 서버 침투 지도 ═════════════ */
export interface NetNode { id: number; x: number; y: number; sec: number; wall: boolean }
export interface Net { nodes: NetNode[]; links: Array<[number, number]>; entry: number; target: number; tracer: number[] }

export function makeNet(seed: number, level = 1): Net {
  const rng = new Rng(seed >>> 0 || 1);
  const nodes: NetNode[] = [{ id: 0, x: 0, y: 1, sec: 0, wall: false }];
  const layers: number[][] = [[0]];
  for (let L = 1; L <= 4; L++) {
    const row: number[] = [];
    for (let k = 0; k < 3; k++) {
      const id = nodes.length;
      nodes.push({ id, x: L, y: k, sec: ri(rng, 0, Math.round(2 + level)), wall: rng.chance(0.25) });
      row.push(id);
    }
    layers.push(row);
  }
  const target = nodes.length;
  nodes.push({ id: target, x: 5, y: 1, sec: 1, wall: false });
  layers.push([target]);
  const links: Array<[number, number]> = [];
  for (let L = 0; L < layers.length - 1; L++)
    for (const a of layers[L])
      for (const b of layers[L + 1]) if (layers[L].length === 1 || layers[L + 1].length === 1 || Math.abs(nodes[a].y - nodes[b].y) <= 1) links.push([a, b]);
  // 탐지기: 가운데 층을 도는 순찰(같은 층 위아래로)
  const mid = layers[2 + ri(rng, 0, 1)];
  const tracer = [...mid, ...mid.slice(1, -1).reverse()];
  return { nodes, links, entry: 0, target, tracer };
}
export const linked = (n: Net, a: number, b: number) => n.links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** 길 실행: 한 칸 1틱, 방화벽은 2틱 더. 보안 수치 + 탐지기와 같은 칸이면 +4. 10 넘으면 들킴 */
export function runNetPath(n: Net, path: number[]): { ok: boolean; det: number; ticks: number; caught: boolean } {
  if (path[0] !== n.entry || path[path.length - 1] !== n.target) return { ok: false, det: 10, ticks: 0, caught: false };
  for (let i = 1; i < path.length; i++) if (!linked(n, path[i - 1], path[i])) return { ok: false, det: 10, ticks: 0, caught: false };
  let det = 0, tick = 0;
  for (const id of path) {
    const node = n.nodes[id];
    const stay = node.wall ? 3 : 1;
    for (let s = 0; s < stay; s++) {
      if (n.tracer[tick % n.tracer.length] === id) det += 4;
      tick++;
    }
    det += node.sec;
    if (det >= 10) return { ok: true, det: 10, ticks: tick, caught: true };
  }
  return { ok: true, det, ticks: tick, caught: false };
}
export const netScore = (r: { ok: boolean; det: number; caught: boolean }) => (!r.ok || r.caught ? 0 : Math.max(0.2, 1 - r.det / 10));

/** 가장 좋은 길(시험·자동용) */
export function bestNetPath(n: Net): number[] {
  let best: number[] = [], bs = -1;
  const go = (p: number[]) => {
    const last = p[p.length - 1];
    if (last === n.target) {
      const s = netScore(runNetPath(n, p));
      if (s > bs) (bs = s), (best = p.slice());
      return;
    }
    for (const [a, b] of n.links) if (a === last && n.nodes[b].x === n.nodes[last].x + 1) go([...p, b]);
  };
  go([n.entry]);
  return best;
}

/* ═════════════ 틀 C 정보: 포로 심문 ═════════════ */
export interface Case { who: string; face: string; lines: string[]; cards: Array<{ id: string; name: string; text: string }>; lies: Record<number, string>; press: Record<number, string>; truth: string }
export const CASES: Case[] = [
  {
    who: '정찰병 박 하사(적군)',
    face: '😠',
    lines: [
      '나는 그냥 길 잃은 정찰병이다.',
      '혼자 왔다. 동료는 없다.',
      '어젯밤엔 숲속 초소에서 잤다.',
      '무전기는 고장 나서 버렸다.',
      '우리 부대는 북쪽 50km 밖에 있다.',
      '나는 지도를 볼 줄 모른다.',
    ],
    cards: [
      { id: 'foot', name: '발자국 사진', text: '포로를 잡은 곳 둘레에 군화 자국 3쌍' },
      { id: 'radio', name: '감청 기록', text: '어젯밤 02시, 같은 주파수로 "정찰조 셋 도착"' },
      { id: 'map', name: '빼앗은 지도', text: '포로 가방 속 지도에 우리 다리 3곳 표시' },
      { id: 'ration', name: '전투식량 봉지', text: '오늘 아침 날짜가 찍힌 적군 보급품' },
    ],
    lies: { 1: 'foot', 3: 'radio', 5: 'map' },
    press: { 0: '"길을 잃었다면서 왜 우리 다리 근처에 있었지?" — 눈을 피해요.', 1: '"정말 혼자야?" — 대답이 늦어요.', 2: '"초소 위치는?" — 아무 데나 손가락으로 가리켜요.', 3: '"어디에 버렸지?" — 기억이 안 난대요.', 4: '"50km를 걸어왔다고?" — 다리가 멀쩡해요.', 5: '"정말?" — 손에 나침반 자국이 있어요.' },
    truth: '정찰조 3명이 다리 3곳을 살피러 왔어요. 나머지 둘은 동쪽 숲에 숨어 있어요.',
  },
  {
    who: '수송 장교 최 대위(적군)',
    face: '😐',
    lines: [
      '나는 전투와 상관없는 수송 장교다.',
      '트럭엔 식량만 실려 있었다.',
      '목적지는 남쪽 마을 병원이었다.',
      '이번 주엔 처음 이 길을 지났다.',
      '포탄 같은 건 본 적도 없다.',
      '부대 이름은 모른다. 그냥 운전만 했다.',
    ],
    cards: [
      { id: 'cargo', name: '트럭 짐칸 사진', text: '포탄 상자 40개, 위에 쌀 포대로 덮음' },
      { id: 'log', name: '검문소 기록', text: '같은 트럭 번호가 이번 주 4번 지나감' },
      { id: 'badge', name: '어깨 부대 마크', text: '제7 포병여단 마크' },
      { id: 'note', name: '주머니 쪽지', text: '"화요일 새벽, 언덕 포대에 탄 전달"' },
    ],
    lies: { 1: 'cargo', 3: 'log', 5: 'badge' },
    press: { 0: '"수송 장교가 왜 권총을 두 자루나?" — 입을 다물어요.', 1: '"식량치고 트럭이 너무 무거웠어." — 땀을 흘려요.', 2: '"병원 이름은?" — 대답을 못 해요.', 3: '"처음이라면서 길을 잘 알던데?" — 웃어 넘겨요.', 4: '"손에 화약 냄새가 나." — 손을 숨겨요.', 5: '"정말 모른다고?" — 어깨를 움츠려요.' },
    truth: '제7 포병여단 탄약을 실어 날랐어요. 화요일 새벽 언덕 포대에 탄을 대 줄 계획이에요.',
  },
  {
    who: '통신병 한 일병(적군)',
    face: '😟',
    lines: [
      '나는 신병이라 아무것도 모른다.',
      '통신소는 산꼭대기에 하나뿐이다.',
      '암호는 장교들만 안다.',
      '어제 공격 계획 같은 건 들은 적 없다.',
      '우리 통신은 낮에만 한다.',
      '전쟁이 끝나면 집에 가고 싶다.',
    ],
    cards: [
      { id: 'sat', name: '위성 사진', text: '골짜기 2곳에 같은 안테나가 더 있음' },
      { id: 'codebook', name: '수첩', text: '포로 글씨로 쓴 오늘 암호표' },
      { id: 'night', name: '전파 기록', text: '밤 23시~03시에 전파가 가장 많음' },
      { id: 'letter', name: '편지', text: '"엄마, 곧 큰 공격이 있대요. 걱정 마세요"' },
    ],
    lies: { 1: 'sat', 2: 'codebook', 4: 'night' },
    press: { 0: '"신병이 이런 장비를?" — 고개를 숙여요.', 1: '"정말 하나뿐?" — 손가락을 꼼지락거려요.', 2: '"장교들만?" — 주머니를 만져요.', 3: '"편지를 보면 다르던데." — 울먹여요.', 4: '"낮에만?" — 시계를 봐요.', 5: '진심 같아요. 이 말은 참말이에요.' },
    truth: '통신소는 3곳이고, 밤마다 바뀌는 암호로 큰 공격을 준비하고 있어요.',
  },
];
export const caseFor = (seed: number) => CASES[Math.abs(seed) % CASES.length];
/** 찾은 거짓말 수 · 잘못 내민 증거 수 → 점수 */
export const interroScore = (found: number, wrong: number) => Math.max(0, Math.min(1, found / 3 - wrong * 0.1));

/* ═════════════ 틀 D-1 보급: 보급 기지 운영 ═════════════ */
export const SUP_KINDS = ['탄약', '연료', '식량', '부품'] as const;
export type SupKind = (typeof SUP_KINDS)[number];
export interface SupReq { id: number; unit: string; kind: SupKind; qty: number; left: number; state: 'wait' | 'go' | 'done' | 'late' }
export interface SupState { t: number; stock: Record<SupKind, number>; trucks: number[]; orders: Array<{ kind: SupKind; at: number }>; budget: number; reqs: SupReq[]; next: number; made: number; done: number; late: number }
const UNITS = ['1중대', '2중대', '3중대', '포병대', '전차대', '공병대'];
export const SUP = { TRUCKS: 3, TRIP: 8, DEADLINE: 20, ORDER: 6, BUDGET: 8, SECS: 75 } as const;
export function supNew(): SupState {
  return { t: 0, stock: { 탄약: 6, 연료: 5, 식량: 6, 부품: 3 }, trucks: [0, 0, 0], orders: [], budget: SUP.BUDGET, reqs: [], next: 1, made: 0, done: 0, late: 0 };
}
export function supTick(s: SupState, dt: number, rng: Rng, level = 1): void {
  s.t += dt;
  if (s.t >= s.next && s.t < SUP.SECS - 8) {
    s.next = s.t + rng.range(3, 5) / level;
    s.reqs.push({ id: ++s.made, unit: rng.pick(UNITS), kind: rng.pick([...SUP_KINDS]), qty: ri(rng, 1, 3), left: SUP.DEADLINE, state: 'wait' });
  }
  for (const r of s.reqs) {
    if (r.state === 'wait') {
      r.left -= dt;
      if (r.left <= 0) (r.state = 'late'), s.late++;
    }
  }
  s.trucks = s.trucks.map((x) => Math.max(0, x - dt));
  for (const o of s.orders) if (o.at > 0 && s.t >= o.at) (s.stock[o.kind] += 4), (o.at = -1);
  s.orders = s.orders.filter((o) => o.at > 0);
}
/** 요청 보내기: 빈 트럭 + 재고가 있어야 */
export function supSend(s: SupState, id: number): string | null {
  const r = s.reqs.find((q) => q.id === id && q.state === 'wait');
  if (!r) return '이미 끝난 요청이에요';
  const tr = s.trucks.findIndex((x) => x <= 0);
  if (tr < 0) return '빈 트럭이 없어요';
  if (s.stock[r.kind] < r.qty) return `${r.kind}이(가) 모자라요. 공장에 주문하세요`;
  s.stock[r.kind] -= r.qty;
  s.trucks[tr] = SUP.TRIP;
  r.state = 'done';
  s.done++;
  return null;
}
export function supOrder(s: SupState, kind: SupKind): string | null {
  if (s.budget <= 0) return '예산이 없어요';
  s.budget--;
  s.orders.push({ kind, at: s.t + SUP.ORDER });
  return null;
}
export const supScore = (s: SupState) => (s.made ? Math.max(0, Math.min(1, s.done / Math.max(1, s.done + s.late + s.reqs.filter((r) => r.state === 'wait').length * 0.5))) : 0);

/* ═════════════ 틀 D-2 통솔: 동시 무전 지휘 ═════════════ */
export const RADIO_TYPES = [
  { kind: '탄약 부족', msg: '탄약이 떨어져 갑니다!', opts: ['보급조를 보낸다', '돌격하라', '무전 끊어라'], ok: 0 },
  { kind: '부상자', msg: '부상자 둘! 움직일 수 없습니다!', opts: ['계속 전진하라', '의무병 보낸다, 엄폐하라', '버리고 와라'], ok: 1 },
  { kind: '적 발견', msg: '정면에 적 전차 2대!', opts: ['포격 요청한다, 숨어라', '소총으로 쏴라', '못 들은 걸로'], ok: 0 },
  { kind: '길 잃음', msg: '여기가 어딘지 모르겠습니다!', opts: ['알아서 찾아라', '그 자리에서 대기', '연막탄 쏴라, 위치 알려 주마'], ok: 2 },
  { kind: '포위됨', msg: '양쪽에서 적이 옵니다!', opts: ['3중대가 간다, 남쪽으로 빠져라', '끝까지 싸워라', '항복하라'], ok: 0 },
  { kind: '사기 저하', msg: '병사들이 지쳐서 겁을 먹었습니다…', opts: ['꾸짖는다', '조금만 버티면 교대다, 잘하고 있다', '무시한다'], ok: 1 },
] as const;
export interface RadioMsg { id: number; sq: number; type: number; left: number }
export interface RadioState { t: number; morale: number[]; msgs: RadioMsg[]; next: number; made: number; right: number; wrong: number; miss: number }
export const SQUADS = ['1분대', '2분대', '3분대', '4분대', '5분대'];
export const RADIO = { LIFE: 8, SECS: 60 } as const;
export const radioNew = (): RadioState => ({ t: 0, morale: [70, 70, 70, 70, 70], msgs: [], next: 0.8, made: 0, right: 0, wrong: 0, miss: 0 });
export function radioTick(s: RadioState, dt: number, rng: Rng, level = 1): void {
  s.t += dt;
  if (s.t >= s.next) {
    s.next = s.t + rng.range(2.2, 3.6) / level;
    const free = SQUADS.map((_, i) => i).filter((i) => !s.msgs.some((m) => m.sq === i));
    if (free.length) s.msgs.push({ id: ++s.made, sq: rng.pick(free), type: ri(rng, 0, RADIO_TYPES.length - 1), left: RADIO.LIFE });
  }
  for (const m of s.msgs) m.left -= dt;
  for (const m of s.msgs.filter((x) => x.left <= 0)) (s.morale[m.sq] = Math.max(0, s.morale[m.sq] - 15)), s.miss++;
  s.msgs = s.msgs.filter((m) => m.left > 0);
  for (let i = 0; i < s.morale.length; i++) s.morale[i] = Math.max(0, s.morale[i] - dt * 0.4);
}
export function radioAnswer(s: RadioState, id: number, opt: number): boolean {
  const m = s.msgs.find((x) => x.id === id);
  if (!m) return false;
  s.msgs = s.msgs.filter((x) => x !== m);
  const ok = RADIO_TYPES[m.type].ok === opt;
  if (ok) (s.morale[m.sq] = Math.min(100, s.morale[m.sq] + 8 + m.left)), s.right++;
  else (s.morale[m.sq] = Math.max(0, s.morale[m.sq] - 10)), s.wrong++;
  return ok;
}
export const radioScore = (s: RadioState) => {
  const avg = s.morale.reduce((a, b) => a + b, 0) / s.morale.length / 100;
  const tot = s.right + s.wrong + s.miss;
  return Math.max(0, Math.min(1, avg * 0.5 + (tot ? s.right / tot : 0) * 0.5));
};

/* ═════════════ 틀 D-3 모병: 광고 캠페인 ═════════════ */
export const ADS = [
  { k: 'TV', icon: '📺' },
  { k: '인터넷', icon: '📱' },
  { k: '학교', icon: '🏫' },
  { k: '박람회', icon: '🎪' },
] as const;
export interface AdState { day: number; spend: number[]; eff: number[]; hist: number[]; total: number; event: string; boost: number }
export const AD = { DAYS: 7, BUDGET: 10, DAY_SECS: 8, TARGET: 420 } as const;
/** 채널마다 숨은 효과(씨앗마다 다름). 같은 곳에 몰면 효과가 줄어요(제곱근) */
export function adNew(seed: number): AdState {
  const rng = new Rng(seed >>> 0 || 1);
  const eff = ADS.map(() => rng.range(6, 16));
  return { day: 0, spend: [3, 3, 2, 2], eff, hist: [], total: 0, event: '', boost: -1 };
}
export function adDay(s: AdState, rng: Rng): number {
  const mult = s.eff.map((e, i) => e * (i === s.boost ? 2 : 1));
  const n = Math.round(s.spend.reduce((a, x, i) => a + mult[i] * Math.sqrt(x), 0) * rng.range(0.9, 1.1));
  s.hist.push(n);
  s.total += n;
  s.day++;
  // 다음 날 일(가끔 한 채널 효과 2배)
  s.boost = rng.chance(0.45) ? ri(rng, 0, ADS.length - 1) : -1;
  s.event = s.boost < 0 ? '' : ['군대 드라마 방영: TV 효과 2배', '유명 유튜버가 부대 체험: 인터넷 효과 2배', '진로 주간: 학교 효과 2배', '주말 큰 행사: 박람회 효과 2배'][s.boost];
  return n;
}
export const adScore = (s: AdState) => Math.max(0, Math.min(1, s.total / AD.TARGET));
