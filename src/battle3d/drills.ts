// 3D 훈련 전장(11-26 안 1·3): 훈련 12개마다 작은 3D 실전 1개 + 명령 스킬 사격장 7개.
// 모두 3D 전투 계산(sim.ts) 위에서 돈다: 전장(Stage)에 끝 규칙(rule)·매 계산 할 일(tick)·준비(setup)를 붙여서.
// 점수 0~1 → 별(0.4 성공 · 0.65 ★2 · 0.85 ★3, 미니게임과 같음).
import {
  COAST, CMD, DEF, TICK, createSim, dist, doCmd, setupDeploy, spawnFoe, startBattle, step, useStage,
  type CmdKey, type Kind, type Pick3, type Place, type Sim, type Stage, type Unit,
} from './sim';
import { STREET } from './stages';

export interface Drill {
  id: string;
  training: string;
  name: string;
  how: string;
  stage: Stage;
  /** 우리 부대(고정이면 lock) */
  preset: Pick3[];
  lock: boolean;
  budget?: number;
  cp0?: number;
  /** 0~1 */
  score(S: Sim): number;
  bar?(S: Sim): { label: string; pct: number; txt: string };
  endText?(S: Sim, win: boolean): string;
  /** 전투 중 땅을 누르면(집중 사격 · 정찰) */
  tap?(S: Sim, x: number, z: number, u: Unit | null): string | void;
  /** 숙련이 쌓이는 병과(없으면 출전한 병과) */
  kinds?: Kind[];
}

/* ───────── 도우미 ───────── */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const foes = (S: Sim) => S.units.filter((u) => u.side === 'foe' && u.kind !== 'hq' && !u.d.missile);
const mine = (S: Sim) => S.units.filter((u) => u.side === 'us' && !u.d.missile && u.kind !== 'cvjet');
const aliveUs = (S: Sim) => mine(S).filter((u) => u.alive);
const hpFrac = (list: Unit[]) => { const m = list.reduce((s, u) => s + u.max, 0); return m ? list.reduce((s, u) => s + (u.alive ? u.hp : 0), 0) / m : 0; };
const hqOf = (S: Sim) => S.units.find((u) => u.kind === 'hq');
const D = (S: Sim) => (S.drill ??= {});
const at = (kind: Kind, x: number, z: number, goal?: { x: number; z: number }): Pick3 => ({ kind, tile: -1, at: [x, z], goal });
/** 제자리 지키는 부대 */
const hold = (kind: Kind, x: number, z: number): Pick3 => ({ kind, tile: -1, at: [x, z], goal: { x, z }, hold: true });
/** 해안 전장을 바탕으로 훈련 전장 하나 */
function field(id: string, goal: string, over: Partial<Stage>): Stage {
  return { ...COAST, enemy: [], id: `drill-${id}`, name: '훈련', op: `DRILL-${id.toUpperCase()}`, goal, timeLimit: 90, usGoal: { x: 5, z: -12 }, drill: true, ...over };
}
/** 지휘소(훈련용 체력) */
function hqHp(S: Sim, hp: number) { const h = hqOf(S); if (h) { h.max = hp; h.hp = hp; } }
/** 끝 규칙: 지휘소를 부수면 이김 */
const hqRule = (S: Sim) => (!hqOf(S)?.alive ? 'win' : !aliveUs(S).length && !S.pending.length ? 'lose' : S.simT >= S.drillLimit! ? 'time' : null);
/** 지휘소 공격 점수: 이기면 0.55 + 손실 적게 0.25 + 빨리 0.2, 지면 지휘소 깎은 만큼 */
function hqScore(S: Sim) {
  const h = hqOf(S)!;
  if (!h.alive) { const m = mine(S); const loss = m.filter((u) => !u.alive).length / Math.max(1, m.length); return clamp01(0.55 + 0.25 * (1 - loss) + 0.2 * (1 - S.simT / S.drillLimit!)); }
  return clamp01(0.38 * (1 - h.hp / h.max));
}
const hqBar = (S: Sim) => { const h = hqOf(S); return { label: '적 지휘소', pct: h ? (h.hp / h.max) * 100 : 0, txt: h ? `${Math.round((h.hp / h.max) * 100)}%` : '' }; };
const killBar = (label: string) => (S: Sim) => { const f = foes(S); const k = f.filter((u) => !u.alive).length; return { label, pct: 100 - (k / Math.max(1, f.length)) * 100, txt: `${k}/${f.length}` }; };
/** 정해진 시각에 적을 내보냄 */
function waves(S: Sim, plan: Array<{ at: number; list: Place[]; aggr?: boolean; goal?: { x: number; z: number }; hp?: number }>) {
  const d = D(S);
  plan.forEach((w, i) => {
    if (d[`w${i}`] || S.simT < w.at) return;
    d[`w${i}`] = 1;
    w.list.forEach(([k, x, z]) => { const u = spawnFoe(S, k, x, z, !!w.aggr); if (w.goal) u.goal = w.goal; if (w.hp) { u.max = Math.round(u.max * w.hp); u.hp = u.max; } });
    S.hooks.log?.(i === 0 ? '적이 나타났어요' : `적 ${i + 1}차 공격`, 'x');
  });
}
declare module './sim' { interface Sim { drillLimit?: number } }

/* ───────── 1단계: 전술 · 포격 · 통솔 · 항공 ───────── */
const TAC: Drill = {
  id: 'd3-tac', training: '전술', name: '다리 두 개', how: '예산 150 안에서 땅 부대를 놓고 다리 두 개 중 한쪽으로 밀어붙여요. 적 지휘소를 2분 안에 부수면 성공.',
  stage: field('tac', '목표: 다리를 건너 적 지휘소 파괴', {
    enemy: [['hq', 4.4, -9.5], ['tank', 1.6, -1.6], ['inf', .9, -1], ['inf', 2.4, -1.2], ['ifv', 6.2, -1.6], ['tank', 6.9, -1.2], ['inf', 5.6, -1], ['aa', 4.6, -5], ['spg', 7.2, -8.4], ['spg', 2, -8.6], ['inf', 3.4, -8], ['tank', 4.4, -7.4]],
    timeLimit: 120, kinds: ['inf', 'sf', 'ifv', 'tank', 'spg', 'aa', 'hack'], cmds: ['arty', 'smoke'],
    setup: (S) => { hqHp(S, 1400); S.drillLimit = 120; foes(S).forEach((u) => (u.goal = { x: u.x, z: u.z })); },
    rule: hqRule, cam: { tz: 1, dist: 28 },
  }),
  preset: [], lock: false, budget: 150, cp0: 3, score: hqScore, bar: hqBar,
};

const COLUMN: Place[] = [['tank', 1.6, -13.4], ['tank', 1.6, -11.8], ['ifv', 1.6, -10.2], ['tank', 6.2, -13.8], ['ifv', 6.2, -12.2], ['tank', 4, -14.2]];
const ARTY: Drill = {
  id: 'd3-arty', training: '포격', name: '대열 끊기 3D', how: '다리로 내려오는 적 전차 대열에 "포격"·"순항 미사일"을 떨어뜨려요. 포탄은 1초 뒤, 미사일은 2초 뒤 떨어져요. 다리 아래(우리 진지)까지 못 오게 막아요.',
  stage: field('arty', '목표: 적 대열이 진지까지 못 오게 막기', {
    enemy: COLUMN, timeLimit: 75, foeGoal: { x: 4, z: 11 }, cmds: ['arty', 'cruise'], cpRate: .75,
    setup: (S) => { S.drillLimit = 75; foes(S).forEach((u) => { u.max = Math.round(u.max * .8); u.hp = u.max; }); },
    rule: (S) => {
      if (foes(S).some((u) => u.alive && u.z > 9.6)) return 'lose';
      if (!foes(S).some((u) => u.alive)) return 'win';
      if (!aliveUs(S).length) return 'lose';
      return S.simT >= 75 ? 'win' : null;
    },
    cam: { tz: 0, dist: 30 },
  }),
  preset: [hold('spg', 2.4, 12.4), hold('spg', 5.8, 12.4), hold('tank', 1.6, 7.8), hold('tank', 6.2, 7.8), hold('inf', 4, 8.6)],
  lock: true, cp0: 6,
  score: (S) => { const f = foes(S); const k = f.filter((u) => !u.alive).length / f.length; const breach = f.some((u) => u.alive && u.z > 9.6); return clamp01(k * 0.82 + (breach ? 0 : 0.18)); },
  bar: killBar('격파한 대열'),
};

const LEAD_WAVES = [
  { at: 2, list: [['inf', 2.5, -10], ['inf', 5.5, -10], ['tank', 4, -11]] as Place[], aggr: true },
  { at: 24, list: [['tank', 1.6, -11], ['ifv', 6.2, -11], ['inf', 3, -12], ['inf', 5, -12], ['drone', 4, -13]] as Place[], aggr: true },
  { at: 46, list: [['tank', 1.6, -11], ['tank', 6.2, -11], ['ifv', 4, -12], ['spg', 4, -14], ['heli', 2, -13], ['inf', 6, -12]] as Place[], aggr: true },
];
const LEAD: Drill = {
  id: 'd3-lead', training: '통솔', name: '버티기', how: '적이 3번 몰려와요. 지휘력을 아껴 두었다가 "긴급 수리"·"연막"·"포격"을 제때 써서 70초를 버텨요.',
  stage: field('lead', '목표: 70초 버티기', {
    timeLimit: 70, foeGoal: { x: 4, z: 8 }, cmds: ['repair', 'smoke', 'arty'],
    setup: (S) => { S.drillLimit = 70; },
    tick: (S) => waves(S, LEAD_WAVES),
    rule: (S) => (!aliveUs(S).length ? 'lose' : S.simT >= 70 ? 'win' : null),
    cam: { tz: 2, dist: 28 },
  }),
  preset: [hold('inf', 2.6, 7.6), hold('inf', 4.2, 7.2), hold('inf', 5.8, 7.6), hold('tank', 3, 8.8), hold('tank', 5.4, 8.8), hold('aa', 4.2, 10.2)],
  lock: true, cp0: 4,
  score: (S) => (S.simT >= 70 && aliveUs(S).length ? clamp01(0.45 + 0.55 * hpFrac(mine(S))) : clamp01(0.38 * (S.simT / 70))),
  bar: (S) => ({ label: '버틴 시간', pct: 100 - (S.simT / 70) * 100, txt: `${Math.floor(S.simT)}/70초` }),
};

const AIR: Drill = {
  id: 'd3-air', training: '항공', name: '방공망 뚫기', how: '예산 130 안에서 공군만 골라 띄워요. 방공부대 2곳을 피하거나 먼저 부수고 지휘소를 쳐요. "공습"·"전자전"으로 방공을 묶어요.',
  stage: field('air', '목표: 방공망을 뚫고 지휘소 파괴', {
    enemy: [['hq', 5, -10], ['aa', 2.6, -6.4], ['aa', 7.2, -7], ['inf', 4, -8], ['inf', 6, -9], ['tank', 5, -7.6]],
    timeLimit: 100, kinds: ['drone', 'heli', 'jet', 'bomber', 'missile'], cmds: ['air', 'emp'],
    setup: (S) => { hqHp(S, 900); S.drillLimit = 100; foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; if (u.kind === 'aa') { u.max = 220; u.hp = 220; u.d = { ...u.d, atk: 7 }; } }); },
    rule: hqRule, cam: { tz: -1, dist: 30 },
  }),
  preset: [], lock: false, budget: 130, cp0: 5, score: hqScore, bar: hqBar,
};

/* ───────── 2단계: 사격 · 해상 · 해킹 · 보급 ───────── */
const VILLAGE = STREET.blocks!.filter((b) => b.z0 > -10);
const POP: Array<[number, number]> = [[-6.4, -4.4], [-1.2, -4.4], [4, -4.4], [-6.4, 1.2], [1.4, -7.2], [4, 1.2], [-3.8, -2], [7.6, -2], [-1.2, 1.2]];
const SHOOT: Drill = {
  id: 'd3-shoot', training: '사격', name: '마을 사격장', how: '골목에 적 보병이 잠깐씩 나타나요. 적을 누르면 우리 분대가 그 적부터 쏴요(집중 사격). 60초 동안 많이 쓰러뜨려요.',
  stage: {
    ...STREET, id: 'drill-shoot', name: '훈련', op: 'DRILL-SHOOT', goal: '목표: 나타난 적 많이 쓰러뜨리기', drill: true, points: [], reinf: undefined, enemy: [], timeLimit: 60, usGoal: { x: -1.2, z: 6 }, blocks: VILLAGE,
    cmds: [], kinds: [],
    setup: (S) => { S.drillLimit = 60; D(S).n = 0; aliveUs(S).forEach((u) => (u.d = { ...u.d, range: 8.5 })); },
    tick: (S) => {
      const d = D(S);
      if (S.simT >= (d.next ?? 1.5) && d.n < 14) {
        const i = Math.floor(((d.n * 7 + 3) % POP.length));
        const [x, z] = POP[i];
        const u = spawnFoe(S, 'inf', x, z, false); u.max = 130; u.hp = 130; u.goal = { x, z }; u.bornT = S.simT;
        d.n++; d.next = S.simT + 3.6;
      }
      for (const u of foes(S)) if (u.alive && S.simT - (u.bornT as number) > 6.5) { u.gone = true; u.alive = false; u.hidden = true; }
    },
    rule: (S) => (!aliveUs(S).length ? 'lose' : S.simT >= 60 || (D(S).n >= 14 && !foes(S).some((u) => u.alive)) ? 'win' : null),
    cam: { tz: -1, dist: 24 },
  },
  preset: [hold('inf', -2.4, 6.4), hold('inf', 0, 6.4), hold('sf', -1.2, 7.4), hold('inf', 2.4, 6.4)],
  lock: true, cp0: 0,
  score: (S) => clamp01(S.units.filter((u) => u.side === 'foe' && !u.alive && !u.gone).length / 14 / 0.85),
  bar: (S) => { const k = S.units.filter((u) => u.side === 'foe' && !u.alive && !u.gone).length; return { label: '쓰러뜨린 적', pct: 100 - (k / 14) * 100, txt: `${k}/14` }; },
  tap: (S, _x, _z, u) => { if (!u) return; S.focus = u.id; return '집중 사격!'; },
};

const SEA: Drill = {
  id: 'd3-sea', training: '해상', name: '잠수함 사냥', how: '물속 잠수함 4척이 상륙함을 노려요. 구축함·헬기 가까이 오면 소나에 잡혀 보여요. "연막"·"긴급 수리"로 상륙함을 지키며 4척을 잡아요.',
  stage: field('sea', '목표: 잠수함 4척 격침 · 상륙함 지키기', {
    enemy: [['sub', -6, -8], ['sub', -8.2, -3.5], ['sub', -5.4, -12], ['sub', -7.4, -13.4]],
    timeLimit: 90, foeGoal: { x: -7.4, z: 11 }, cmds: ['smoke', 'repair'],
    setup: (S) => { S.drillLimit = 90; foes(S).forEach((u) => { u.hidden = true; u.max = Math.round(u.max * 1.2); u.hp = u.max; }); },
    tick: (S) => {
      const hunters = aliveUs(S).filter((u) => u.kind === 'dd' || u.kind === 'heli');
      for (const f of foes(S)) if (f.alive) f.hidden = !hunters.some((h) => dist(h, f) < 3.6);
    },
    rule: (S) => {
      const lha = S.units.find((u) => u.kind === 'lha' && u.side === 'us');
      if (!lha?.alive) return 'lose';
      if (!foes(S).some((u) => u.alive)) return 'win';
      return S.simT >= 90 ? 'time' : null;
    },
    cam: { tx: -5, tz: 1, dist: 28 },
  }),
  preset: [hold('dd', -5.6, 8.4), hold('dd', -8.6, 8.8), at('heli', -6.8, 9.6), hold('lha', -7.4, 11.4)],
  lock: true, cp0: 3,
  score: (S) => { const k = foes(S).filter((u) => !u.alive).length / 4; const lha = S.units.find((u) => u.kind === 'lha')!; return clamp01(k * 0.7 + (lha.alive ? (lha.hp / lha.max) * 0.3 : 0)); },
  bar: killBar('격침'),
};

const HACK: Drill = {
  id: 'd3-hack', training: '해킹', name: '전자전 타이밍', how: '적 돌격대가 뭉쳐서 와요. 가장 많이 모인 순간 "전자전"으로 6초 묶고, 그동안 "포격"과 우리 부대로 부숴요.',
  stage: field('hack', '목표: 돌격대 막기', {
    timeLimit: 80, foeGoal: { x: 4, z: 9 }, cmds: ['emp', 'arty'],
    setup: (S) => { S.drillLimit = 80; },
    tick: (S) => waves(S, [{ at: 1, aggr: true, hp: .8, list: [['tank', 3.4, -9], ['tank', 4.8, -9], ['ifv', 2.8, -10.4], ['ifv', 5.4, -10.4], ['ifv', 4, -11.2], ['inf', 3.4, -12], ['inf', 4.8, -12]] }]),
    rule: (S) => (!aliveUs(S).length ? 'lose' : S.simT > 2 && !foes(S).some((u) => u.alive) ? 'win' : S.simT >= 80 ? 'time' : null),
    cam: { tz: 1, dist: 28 },
  }),
  preset: [hold('hack', 3, 9.6), hold('hack', 5.4, 9.6), hold('tank', 2.4, 8.2), hold('tank', 6, 8.2), hold('inf', 3.4, 7.4), hold('inf', 5, 7.4)],
  lock: true, cp0: 4,
  score: (S) => { const f = foes(S); const k = f.filter((u) => !u.alive).length / Math.max(1, f.length); return f.length && k >= 1 ? clamp01(0.55 + 0.45 * hpFrac(mine(S))) : clamp01(k * 0.6 + hpFrac(mine(S)) * 0.2); },
  bar: killBar('막아 낸 적'),
};

const DEPOT = { x: 5.4, z: -11 };
const arrived = (S: Sim, kind: Kind, goal: { x: number; z: number }) => mine(S).filter((u) => u.alive && u.kind === kind && dist(u, goal) < 2.2).length;
const SUP: Drill = {
  id: 'd3-sup', training: '보급', name: '호송 작전', how: '보급 장갑차 3대를 북쪽 전선 보급소까지 보내요. 길가 매복과 드론 기습을 방공부대·연막으로 막아요. 2대 넘게 도착하면 성공.',
  stage: field('sup', '목표: 장갑차 2대 이상 보급소 도착', {
    enemy: [['inf', 6.9, -2.4], ['inf', 5.6, -2.8], ['tank', 6.2, -4.4], ['sf', 2.4, -4], ['spg', 8.8, -13], ['tank', 4.2, -8.2], ['inf', 6.8, -7.6]],
    timeLimit: 100, cmds: ['smoke', 'repair'],
    setup: (S) => { S.drillLimit = 100; foes(S).forEach((u) => (u.goal = { x: u.x, z: u.z })); },
    tick: (S) => waves(S, [6, 14, 22, 30, 38, 46].map((t, i) => ({ at: t, aggr: true, list: [['drone', i % 2 ? -1 : 9.4, -6 + i * 2], ['drone', i % 2 ? 9.4 : -1, -8 + i * 2], ['drone', 4, -14]] as Place[] }))),
    rule: (S) => {
      const ifv = mine(S).filter((u) => u.kind === 'ifv');
      if (arrived(S, 'ifv', DEPOT) >= Math.min(3, ifv.filter((u) => u.alive).length) && arrived(S, 'ifv', DEPOT) >= 2) return 'win';
      if (ifv.filter((u) => u.alive).length < 2) return 'lose';
      return S.simT >= 100 ? 'time' : null;
    },
    cam: { tz: 0, dist: 30 },
  }),
  preset: [at('ifv', 5, 11.4, DEPOT), at('ifv', 6.4, 12.2, DEPOT), at('ifv', 3.8, 12.4, DEPOT), at('aa', 5.4, 13, DEPOT), at('inf', 6.2, 10.4, { x: 6.2, z: -2 })],
  lock: true, cp0: 3,
  score: (S) => clamp01((arrived(S, 'ifv', DEPOT) / 3) * 0.7 + hpFrac(mine(S).filter((u) => u.kind === 'ifv')) * 0.3),
  bar: (S) => ({ label: '도착한 장갑차', pct: 100 - (arrived(S, 'ifv', DEPOT) / 3) * 100, txt: `${arrived(S, 'ifv', DEPOT)}/3` }),
};

/* ───────── 3단계: 잠입 · 정보 · 모병 · 체력 ───────── */
const SNEAK: Drill = {
  id: 'd3-sneak', training: '잠입', name: '연막 속 침투', how: '특수부대 2개 분대가 적 통신소(지휘소)를 부숴요. 적 가까이에서 연막 밖에 있으면 들켜서 전차가 몰려와요. "연막"으로 숨고 "공수 투입"으로 거들어요.',
  stage: field('sneak', '목표: 들키지 않고 통신소 파괴', {
    enemy: [['hq', 7.4, -9.6], ['tank', 5, -5], ['inf', 8.2, -4.2], ['inf', 5.2, -6.8], ['aa', 4.4, -9.6], ['inf', 9.4, -6.2]],
    timeLimit: 90, cmds: ['smoke', 'para'],
    setup: (S) => { hqHp(S, 380); S.drillLimit = 90; foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; }); aliveUs(S).forEach((u) => (u.only = 'hq')); },
    tick: (S) => {
      const d = D(S);
      if (d.seen) return;
      const inSmoke = (u: Unit) => S.smokes.some((s) => Math.hypot(s.x - u.x, s.z - u.z) < s.r);
      const spotted = aliveUs(S).some((u) => u.kind === 'sf' && !inSmoke(u) && foes(S).some((f) => f.alive && f.d.dom === 'land' && dist(f, u) < 2.2));
      if (spotted) {
        d.seen = 1;
        S.hooks.log?.('들켰어요! 적 전차가 몰려와요', 'x');
        [['tank', 9, -12], ['tank', 3, -12], ['ifv', 6, -13]].forEach(([k, x, z]) => spawnFoe(S, k as Kind, x as number, z as number, true));
      }
    },
    rule: hqRule, cam: { tz: -1, dist: 27 },
  }),
  preset: [at('sf', 8.4, 11.2, { x: 7.4, z: -8.4 }), at('sf', 9.2, 12.2, { x: 7.8, z: -8.6 })],
  kinds: ['sf'],
  lock: true, cp0: 4,
  score: (S) => (!hqOf(S)!.alive ? clamp01((D(S).seen ? 0.62 : 0.92) + 0.08 * hpFrac(mine(S))) : clamp01(0.35 * (1 - hqOf(S)!.hp / hqOf(S)!.max))),
  bar: (S) => ({ ...hqBar(S), label: D(S).seen ? '통신소 · 들킴!' : '통신소 · 숨어 있음' }),
};

const HIDE: Array<[number, number]> = [[1, -6.4], [8.6, -5.2], [3.4, -10.6], [7.6, -11.6], [5.2, -3.6]];
const INTEL: Drill = {
  id: 'd3-intel', training: '정보', name: '드론 정찰', how: '숲에 숨은 적 5대를 찾아요. 땅을 누르면 정찰 드론이 그 둘레를 살펴요(6번). 찾은 적은 우리 자주포가 쏘고, "순항 미사일"로도 칠 수 있어요.',
  stage: field('intel', '목표: 숨은 적 5대 찾아 부수기', {
    enemy: [['tank', ...HIDE[0]], ['tank', ...HIDE[1]], ['spg', ...HIDE[2]], ['tank', ...HIDE[3]], ['ifv', ...HIDE[4]]] as Place[],
    timeLimit: 90, cmds: ['cruise'], cpRate: .5,
    setup: (S) => { S.drillLimit = 90; D(S).scans = 6; foes(S).forEach((u) => { u.hidden = true; u.goal = { x: u.x, z: u.z }; u.hold = true; u.waitT = 1e9; }); },
    rule: (S) => (!foes(S).some((u) => u.alive) ? 'win' : !aliveUs(S).length ? 'lose' : S.simT >= 90 ? 'time' : null),
    cam: { tz: -2, dist: 30 },
  }),
  preset: [hold('spg', 2.4, 3.4), hold('spg', 6.2, 3.4), hold('aa', 4.3, 4.6)],
  lock: true, cp0: 3,
  score: (S) => clamp01(foes(S).filter((u) => !u.alive).length / 5 + (D(S).scans ?? 0) * 0.02),
  bar: (S) => { const k = foes(S).filter((u) => !u.alive).length; return { label: `부순 적 · 정찰 ${D(S).scans ?? 0}번 남음`, pct: 100 - (k / 5) * 100, txt: `${k}/5` }; },
  tap: (S, x, z) => {
    const d = D(S);
    if (!d.scans) return '정찰 드론을 다 썼어요';
    d.scans--;
    let n = 0;
    for (const f of foes(S)) if (f.alive && f.hidden && Math.hypot(f.x - x, f.z - z) < 2.6) { f.hidden = false; f.waitT = 0; n++; }
    S.hooks.event?.({ type: 'emp', x, z, r: 2.6 });
    return n ? `적 ${n}대 찾았어요!` : '아무것도 없어요';
  },
};

/** 모병: 씨앗마다 신병 병과 4가지만 나옴 */
const REC_POOL: Kind[] = ['inf', 'sf', 'ifv', 'tank', 'spg', 'aa', 'hack', 'drone', 'heli'];
export function recruitKinds(seed: number): Kind[] {
  const pool = REC_POOL.slice();
  const out: Kind[] = [];
  let s = (seed >>> 0) || 1;
  while (out.length < 4) { s = (s * 1664525 + 1013904223) >>> 0; out.push(pool.splice(s % pool.length, 1)[0]); }
  return out;
}
const REC: Drill = {
  id: 'd3-rec', training: '모병', name: '신병 모의전', how: '이번에 들어온 신병 병과 4가지만 쓸 수 있어요. 예산 120 안에서 잘 나눠 넣고 모의 지휘소를 부숴요.',
  stage: field('rec', '목표: 신병만으로 모의 지휘소 파괴', {
    enemy: [['hq', 5, -8.4], ['tank', 4, -4.6], ['tank', 6.2, -4.2], ['inf', 2.4, -5], ['inf', 6.4, -5.4], ['aa', 5, -6.6], ['ifv', 3, -7.6], ['spg', 6.6, -9.6]],
    timeLimit: 110, cmds: ['para'],
    setup: (S) => { hqHp(S, 1200); S.drillLimit = 110; foes(S).forEach((u) => (u.goal = { x: u.x, z: u.z })); },
    rule: hqRule, cam: { tz: 1, dist: 28 },
  }),
  preset: [], lock: false, budget: 120, cp0: 4, score: hqScore, bar: hqBar,
};

const CAMP = { x: 6.2, z: -11.4 };
const FIT: Drill = {
  id: 'd3-fit', training: '체력', name: '긴 행군', how: '보병 4개 분대가 북쪽 야영지까지 걸어가요. 가는 길에 포격과 드론이 괴롭혀요. "긴급 수리"로 체력을 채우고 "연막"으로 숨어서 2개 분대 넘게 도착시켜요.',
  stage: field('fit', '목표: 보병 2개 분대 이상 야영지 도착', {
    enemy: [['spg', 9.2, -14.4], ['spg', 1.2, -14.6]],
    timeLimit: 110, cmds: ['repair', 'smoke'],
    setup: (S) => { S.drillLimit = 110; foes(S).forEach((u) => (u.goal = { x: u.x, z: u.z })); },
    tick: (S) => waves(S, [12, 30, 48, 66].map((t, i) => ({ at: t, aggr: true, list: [['drone', i % 2 ? 9.6 : -1, -2 + i], ['drone', 4, -14]] as Place[] }))),
    rule: (S) => {
      const n = arrived(S, 'inf', CAMP), alive = mine(S).filter((u) => u.kind === 'inf' && u.alive).length;
      if (n >= 2 && n >= alive) return 'win';
      if (alive < 2) return 'lose';
      return S.simT >= 110 ? 'time' : null;
    },
    cam: { tz: 0, dist: 31 },
  }),
  preset: [at('inf', 7.6, 12, CAMP), at('inf', 8.6, 12.6, CAMP), at('inf', 6.6, 12.8, CAMP), at('inf', 7.8, 13.4, CAMP)],
  lock: true, cp0: 3,
  score: (S) => clamp01((arrived(S, 'inf', CAMP) / 4) * 0.7 + hpFrac(mine(S)) * 0.3),
  bar: (S) => ({ label: '도착한 분대', pct: 100 - (arrived(S, 'inf', CAMP) / 4) * 100, txt: `${arrived(S, 'inf', CAMP)}/4` }),
};

/* ───────── 안 3: 명령 스킬 사격장 7개 ───────── */
function range(cmd: CmdKey, training: string, name: string, how: string, enemy: Place[], over: Partial<Drill> & { tick?: Stage['tick']; setup?: Stage['setup']; usSide?: Pick3[] } = {}): Drill {
  const total = (S: Sim) => foes(S).reduce((s, u) => s + u.max, 0);
  const dealt = (S: Sim) => foes(S).reduce((s, u) => s + (u.max - (u.alive ? u.hp : 0)), 0);
  const secs = 45;
  return {
    id: `c3-${cmd}`, training, name, how, lock: true, cp0: 10,
    stage: field(`c3${cmd}`, `목표: "${CMD[cmd].name}" 명령으로 최대한 피해 주기`, {
      enemy, timeLimit: secs, cmds: [cmd], cpRate: .55,
      setup: (S) => { S.drillLimit = secs; foes(S).forEach((u) => { if (!over.tick) u.goal = { x: u.x, z: u.z }; }); over.setup?.(S); },
      tick: over.tick,
      rule: (S) => (S.simT >= secs || (!foes(S).some((u) => u.alive) && S.simT > 1) ? 'win' : null),
      cam: { tz: -3, dist: 26 },
    }),
    preset: over.usSide ?? [at('aa', 4, 13.4, { x: 4, z: 13.4 })],
    score: over.score ?? ((S) => clamp01((dealt(S) / Math.max(1, total(S))) * 1.25)),
    bar: over.bar ?? ((S) => ({ label: '준 피해', pct: 100 - (dealt(S) / Math.max(1, total(S))) * 100, txt: `${Math.round((dealt(S) / Math.max(1, total(S))) * 100)}%` })),
    endText: over.endText,
  };
}
const RANGES: Drill[] = [
  range('arty', '포격', '포격 사격장', '움직이는 전차 대열 앞에 "포격"을 떨어뜨려요. 포탄 8발이 1초 뒤부터 떨어져요.', [['tank', 9, -6], ['tank', 10, -6.6], ['ifv', 11, -6], ['ifv', 12, -6.6], ['tank', 13, -6]], {
    setup: (S) => foes(S).forEach((u) => (u.goal = { x: -1, z: u.z })), tick: () => undefined,
  }),
  range('air', '항공', '공습 사격장', '길 위에 줄지어 선 차량을 "공습"으로 한 번에 쓸어요. 폭탄 5발이 가로로 떨어져요.', [['ifv', 0.6, -6], ['ifv', 1.6, -6.2], ['ifv', 2.6, -6], ['ifv', 5.6, -9], ['ifv', 6.6, -9.2], ['ifv', 7.6, -9]]),
  range('cruise', '정보', '순항 미사일 사격장', '흩어진 자주포 3대를 "순항 미사일"로 한 발씩 정확히 맞혀요. 2.2초 뒤에 떨어져요.', [['spg', 1.4, -5], ['spg', 6.8, -8], ['spg', 3.6, -11.6]], {
    setup: (S) => foes(S).forEach((u) => { u.max = Math.round(u.max * 1.4); u.hp = u.max; }),
  }),
  range('emp', '해킹', '전자전 사격장', '흩어져 오는 적을 "전자전"으로 많이, 오래 묶어요. 한꺼번에 많이 묶을수록 점수가 높아요.', [['tank', 2, -9], ['tank', 4, -10], ['tank', 6, -9], ['ifv', 3, -11], ['ifv', 5, -11], ['inf', 1, -12], ['inf', 7, -12], ['inf', 4, -13]], {
    setup: (S) => foes(S).forEach((u) => (u.goal = { x: 4, z: 6 })), tick: (S) => { const d = D(S); d.jam = (d.jam ?? 0) + foes(S).filter((u) => u.alive && u.jam > S.simT).length * TICK; },
    score: (S) => clamp01((D(S).jam ?? 0) / (8 * 45 * 0.62)),
    bar: (S) => ({ label: '묶은 시간', pct: 100 - clamp01((D(S).jam ?? 0) / (8 * 45 * 0.62)) * 100, txt: `${Math.round(D(S).jam ?? 0)}초` }),
  }),
  range('repair', '통솔', '긴급 수리 훈련', '적 포격을 받는 우리 부대를 "긴급 수리"로 살려요. 많이 다친 곳에, 여럿이 모인 곳에 써요. 45초 뒤 남은 체력이 점수예요.', [['spg', 3, -14], ['spg', 7, -14], ['spg', 5, -13]], {
    usSide: [at('tank', 3, 4, { x: 3, z: 4 }), at('tank', 5.6, 4.4, { x: 5.6, z: 4.4 }), at('inf', 4.2, 5.4, { x: 4.2, z: 5.4 }), at('inf', 2, 5.8, { x: 2, z: 5.8 }), at('ifv', 6.6, 5.6, { x: 6.6, z: 5.6 })],
    setup: (S) => { foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; u.d = { ...u.d, range: 20, minR: 0 }; }); S.units.forEach((u) => { if (u.side === 'us') u.d = { ...u.d, hits: {} }; }); },
    score: (S) => clamp01((hpFrac(mine(S)) - 0.42) / 0.5),
    bar: (S) => ({ label: '우리 체력', pct: hpFrac(mine(S)) * 100, txt: `${Math.round(hpFrac(mine(S)) * 100)}%` }),
  }),
  range('smoke', '잠입', '연막 훈련', '보병 4개 분대가 적 진지 앞 들판을 건너요. "연막"을 길 앞에 깔아 맞는 피해를 줄여요. 건너간 분대 체력이 점수예요.', [['ifv', 2.4, -7], ['ifv', 6.2, -7], ['tank', 4.4, -8.4]], {
    usSide: [at('inf', 3, 11, { x: 3, z: -2.6 }), at('inf', 4.4, 11.6, { x: 4.4, z: -2.6 }), at('inf', 5.8, 11, { x: 5.8, z: -2.6 }), at('inf', 4.4, 10.2, { x: 4.4, z: -2.6 })],
    setup: (S) => { foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; u.d = { ...u.d, range: 8, atk: u.d.atk * .45 }; }); S.units.forEach((u) => { if (u.side === 'us') u.d = { ...u.d, hits: {} }; }); },
    score: (S) => { const m = mine(S); const across = m.filter((u) => u.alive && u.z < -1.6); return clamp01((across.reduce((s, u) => s + u.hp / u.max, 0) / m.length) * 1.15); },
    bar: (S) => { const n = mine(S).filter((u) => u.alive && u.z < -1.6).length; return { label: '건너간 분대', pct: 100 - (n / 4) * 100, txt: `${n}/4` }; },
  }),
  range('para', '체력', '공수 강하 훈련', '멀리 있는 적 자주포 3대 곁에 "공수 투입"으로 보병을 떨어뜨려 부숴요. 바다에는 못 내려요.', [['spg', 2, -12], ['spg', 6.2, -12.6], ['spg', 8.6, -9.4]], {
    setup: (S) => foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.max = 220; u.hp = 220; }),
    score: (S) => clamp01(foes(S).filter((u) => !u.alive).length / 3 + 0.1 * (1 - hpFrac(foes(S)))),
    bar: killBar('부순 자주포'),
  }),
];
RANGES.forEach((r) => { r.stage.timeLimit = 45; });

/* ───────── 새 병과 훈련 10개(11-26 대장 "훈련 컨텐츠까지 모두") ───────── */
const killFrac = (S: Sim) => { const f = foes(S); return f.filter((u) => !u.alive).length / Math.max(1, f.length); };
const BM: Drill = {
  id: 'n3-bm', training: '포격', name: '탄도탄 정밀 타격', how: '멀리 있는 적 지휘소에 탄도미사일을 쏴요. 적 장거리 방공이 날아오는 탄도탄을 떨어뜨려요. "순항 미사일"로 방공부터 부수면 탄도탄이 잘 맞아요.',
  stage: field('bm', '목표: 탄도미사일로 적 지휘소 파괴', {
    enemy: [['hq', 5, -13], ['sam', 3.2, -10.4], ['sam', 7, -11], ['inf', 4.4, -9], ['tank', 6, -8.4]],
    timeLimit: 100, cmds: ['cruise'], cpRate: .6,
    setup: (S) => { hqHp(S, 1000); S.drillLimit = 100; foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; }); aliveUs(S).forEach((u) => { if (u.kind === 'bm') { u.only = 'hq'; u.d = { ...u.d, cd: 9 }; } }); },
    rule: hqRule, cam: { tz: -1, dist: 32 },
  }),
  preset: [hold('bm', 3, 13), hold('bm', 6, 13.2), hold('aa', 4.5, 11.6)],
  kinds: ['bm'], lock: true, cp0: 4, score: hqScore, bar: hqBar,
};

const MLRS_WAVES = [
  { at: 1, hp: .55, list: squad3([['inf', 4], ['ifv', 2]], 4, -12) },
  { at: 24, hp: .55, list: squad3([['inf', 3], ['ifv', 2], ['tank', 1]], 2, -13) },
  { at: 46, hp: .55, list: squad3([['inf', 4], ['tank', 2]], 6.4, -13) },
];
const MLRS: Drill = {
  id: 'n3-mlrs', training: '사격', name: '로켓 일제 사격', how: '뭉쳐서 몰려오는 적 무리에 다연장로켓 12발이 한꺼번에 떨어져요. 적을 누르면 로켓이 그 무리부터 노려요. 다리 아래 진지까지 못 오게 막아요.',
  stage: field('mlrs', '목표: 몰려오는 적 무리 막기', {
    timeLimit: 80, foeGoal: { x: 4, z: 11 }, cmds: ['arty'], cpRate: .5,
    setup: (S) => { S.drillLimit = 80; },
    tick: (S) => waves(S, MLRS_WAVES),
    rule: (S) => (foes(S).some((u) => u.alive && u.z > 10.4) ? 'lose' : !aliveUs(S).length ? 'lose' : S.simT >= 80 || (S.simT > 46 && !foes(S).some((u) => u.alive)) ? 'win' : null),
    cam: { tz: 0, dist: 30 },
  }),
  preset: [hold('mlrs', 2.4, 13), hold('mlrs', 6, 13), hold('tank', 2, 8.2), hold('tank', 6.2, 8.2), hold('inf', 4, 8.8)],
  kinds: ['mlrs'], lock: true, cp0: 2,
  score: (S) => clamp01(killFrac(S) * 0.82 + (foes(S).some((u) => u.alive && u.z > 10.4) ? 0 : 0.18)),
  bar: killBar('막아 낸 적'),
  tap: (S, _x, _z, u) => { if (!u || u.side !== 'foe') return; S.focus = u.id; return '로켓 표적 지정!'; },
};

const SKY_WAVES = [
  { at: 3, aggr: true, list: [['missile', 2, -16], ['missile', 6.4, -16]] as Place[] },
  { at: 16, aggr: true, list: [['bomber', 4, -17], ['jet', 1.4, -16], ['jet', 7, -16]] as Place[] },
  { at: 32, aggr: true, list: [['missile', 0.6, -16], ['missile', 4, -17], ['missile', 8, -16]] as Place[] },
  { at: 48, aggr: true, list: [['bomber', 2.6, -17], ['bomber', 6, -17], ['heli', 4, -15]] as Place[] },
];
const SAM: Drill = {
  id: 'n3-sam', training: '항공', name: '하늘 지키기', how: '적 미사일·폭격기·전투기가 4번 날아와요. 장거리 방공이 멀리서 미사일을 요격해요. "전자전"으로 적 편대를 묶어 방공이 쏠 시간을 벌어요. 우리 진지를 지켜요.',
  stage: field('sam', '목표: 날아오는 적 모두 떨어뜨리기', {
    timeLimit: 75, foeGoal: { x: 4, z: 10 }, cmds: ['emp'], cpRate: .5,
    setup: (S) => { S.drillLimit = 75; },
    tick: (S) => waves(S, SKY_WAVES),
    rule: (S) => (!aliveUs(S).length ? 'lose' : S.simT >= 75 || (S.simT > 50 && !foes(S).some((u) => u.alive)) ? 'win' : null),
    cam: { tz: 1, dist: 30 },
  }),
  preset: [hold('sam', 2.6, 10.4), hold('sam', 6, 10.4), hold('inf', 3, 8.6), hold('inf', 5.6, 8.6), hold('spg', 4.3, 12)],
  kinds: ['sam'], lock: true, cp0: 3,
  score: (S) => clamp01(killFrac(S) * 0.6 + hpFrac(mine(S)) * 0.4),
  bar: killBar('떨어뜨린 적'),
};

const CSM: Drill = {
  id: 'n3-csm', training: '해상', name: '해안 지키기', how: '적 군함과 고속정이 바닷길로 우리 항구를 노려요. 바닷가 해안 미사일이 멀리서 배를 잡아요. "포격"으로 거들고, 배가 항구(아래쪽)까지 못 오게 막아요.',
  stage: field('csm', '목표: 적 배가 항구까지 못 오게', {
    timeLimit: 85, foeGoal: { x: -7, z: 12 }, cmds: ['arty'], cpRate: .5,
    setup: (S) => { S.drillLimit = 85; },
    tick: (S) => waves(S, [
      { at: 1, aggr: true, list: [['dd', -7, -12], ['boat', -5.6, -10], ['boat', -8.4, -10]] },
      { at: 22, aggr: true, list: [['boat', -6, -13], ['boat', -8, -13], ['boat', -7, -14.4], ['dd', -6.4, -16]] },
      { at: 42, aggr: true, list: [['boat', -5.4, -12], ['boat', -6.6, -12.4], ['boat', -7.8, -12], ['boat', -9, -12.4], ['dd', -7, -15], ['dd', -5.6, -16]] },
    ]),
    rule: (S) => (foes(S).some((u) => u.alive && u.z > 9.4) ? 'lose' : !aliveUs(S).length ? 'lose' : S.simT >= 85 || (S.simT > 44 && !foes(S).some((u) => u.alive)) ? 'win' : null),
    cam: { tx: -3, tz: 0, dist: 30 },
  }),
  preset: [hold('csm', -1, 4), hold('csm', -.6, 8.6), hold('aa', .8, 6.4)],
  kinds: ['csm'], lock: true, cp0: 3,
  score: (S) => clamp01(killFrac(S) * 0.8 + (foes(S).some((u) => u.alive && u.z > 9.4) ? 0 : 0.2)),
  bar: killBar('격침'),
};

const UAV_HIDE: Place[] = [['tank', 1.4, -7], ['spg', 8.4, -6], ['tank', 3.6, -11.4], ['tank', 7.4, -12], ['ifv', 5.4, -4.2], ['spg', 1, -13]];
const UAV: Drill = {
  id: 'n3-uav', training: '정보', name: '무인기 관측 사격', how: '숲에 숨은 적 6대를 정찰 무인기가 찾아요. 땅을 누르면 무인기가 그쪽으로 날아가요. 무인기가 본 적은 우리 자주포가 더 잘 맞혀요.',
  stage: field('uav', '목표: 숨은 적 6대 찾아 부수기', {
    enemy: UAV_HIDE, timeLimit: 95, cmds: [],
    setup: (S) => { S.drillLimit = 95; foes(S).forEach((u) => { u.hidden = true; u.goal = { x: u.x, z: u.z }; u.hold = true; u.waitT = 1e9; u.max = Math.round(u.max * .7); u.hp = u.max; }); aliveUs(S).forEach((u) => { if (u.kind === 'spg') u.d = { ...u.d, range: 15 }; if (u.kind === 'uav') u.only = 'hq'; }); },
    tick: (S) => {
      const eyes = aliveUs(S).filter((u) => u.kind === 'uav');
      for (const f of foes(S)) if (f.alive && f.hidden && eyes.some((e) => dist(e, f) < 3.6)) { f.hidden = false; f.waitT = 0; S.hooks.log?.('무인기가 숨은 적을 찾았어요', 'c'); }
      const d = D(S);
      if (!d.tapped && eyes.length) { const e = eyes[0]; const cur = d.eye != null ? S.units.find((u) => u.id === d.eye) : null; if (!cur || !cur.alive || !cur.hidden) { const t = foes(S).filter((u) => u.alive && u.hidden).sort((a, b) => dist(a, e) - dist(b, e))[0]; if (t) { d.eye = t.id; e.goal = { x: t.x, z: t.z + 1.5 }; } } }
    },
    rule: (S) => (!foes(S).some((u) => u.alive) ? 'win' : !aliveUs(S).length ? 'lose' : S.simT >= 95 ? 'time' : null),
    cam: { tz: -2, dist: 30 },
  }),
  preset: [at('uav', 4.4, 9, { x: 4.4, z: -4 }), hold('spg', 2.4, 3), hold('spg', 6.2, 3), hold('mlrs', 4.3, 4.6), hold('aa', 4.3, 6)],
  kinds: ['uav'], lock: true, cp0: 0,
  score: (S) => clamp01(killFrac(S) * 0.9 + hpFrac(mine(S)) * 0.1),
  bar: killBar('부순 적'),
  tap: (S, x, z) => { const e = aliveUs(S).find((u) => u.kind === 'uav'); if (!e) return '무인기가 없어요'; D(S).tapped = 1; e.goal = { x, z }; return '무인기 이동!'; },
};

const F35: Drill = {
  id: 'n3-f35', training: '잠입', name: '스텔스 침투', how: '스텔스 전투기는 적 방공이 가까이 와야 겨우 봐요. 방공망을 피해 곧장 지휘소만 노려요. "전자전"으로 방공을 묶으면 더 오래 버텨요.',
  stage: field('f35', '목표: 방공망 한가운데 지휘소 파괴', {
    enemy: [['hq', 4.6, -11], ['sam', 2.4, -8.4], ['sam', 7, -9], ['aa', 4.6, -7], ['inf', 3, -12.6]],
    timeLimit: 100, cmds: ['emp'], cpRate: .45,
    setup: (S) => { hqHp(S, 520); S.drillLimit = 100; foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; if (u.kind === 'sam' || u.kind === 'aa') u.d = { ...u.d, atk: u.d.atk * .2 }; }); aliveUs(S).forEach((u) => (u.only = 'hq')); },
    rule: hqRule, cam: { tz: -2, dist: 30 },
  }),
  preset: [at('f35', 3, 12), at('f35', 5.6, 12.4), at('f35', 4.3, 13.4)],
  kinds: ['f35'], lock: true, cp0: 3, score: hqScore, bar: hqBar,
};

const AWACS: Drill = {
  id: 'n3-awacs', training: '통솔', name: '공중 지휘', how: '조기경보기 곁의 우리 전투기는 더 멀리 쏘고, 숨은 적도 봐요. 적 전투기 편대가 3번 와요. 조기경보기를 지키며 적을 떨어뜨려요. "긴급 수리"를 제때 써요.',
  stage: field('awacs', '목표: 조기경보기 지키며 적 편대 격추', {
    timeLimit: 80, foeGoal: { x: 4, z: 11 }, cmds: ['repair'], cpRate: .5,
    setup: (S) => { S.drillLimit = 80; },
    tick: (S) => waves(S, [
      { at: 2, aggr: true, list: [['jet', 2, -16], ['jet', 6.4, -16], ['drone', 4, -15]] },
      { at: 24, aggr: true, list: [['jet', 1, -16], ['jet', 4, -17], ['jet', 7.4, -16]] },
      { at: 46, aggr: true, list: [['jet', 2.4, -16], ['jet', 6, -16], ['bomber', 4, -17], ['heli', 4, -14]] },
    ]),
    rule: (S) => (!S.units.find((u) => u.kind === 'awacs' && u.side === 'us')?.alive ? 'lose' : S.simT >= 80 || (S.simT > 48 && !foes(S).some((u) => u.alive)) ? 'win' : null),
    cam: { tz: 0, dist: 32 },
  }),
  preset: [at('awacs', 4.3, 13), at('jet', 2.4, 10), at('jet', 4.3, 9.4), at('jet', 6.2, 10), hold('aa', 4.3, 11.6)],
  kinds: ['awacs'], lock: true, cp0: 3,
  score: (S) => { const a = S.units.find((u) => u.kind === 'awacs' && u.side === 'us')!; return clamp01(killFrac(S) * 0.7 + (a.alive ? 0.3 * (a.hp / a.max) : 0)); },
  bar: killBar('격추'),
};

const FWD = { x: 6, z: -10.6 };
const GUNSHIP: Drill = {
  id: 'n3-gunship', training: '보급', name: '하늘 엄호 호송', how: '보급 장갑차 3대가 북쪽 보급소로 가요. 지상 공격기가 길 위를 맴돌며 매복한 적을 계속 쏴요. "연막"·"긴급 수리"로 장갑차를 지켜요.',
  stage: field('gun', '목표: 장갑차 2대 이상 보급소 도착', {
    enemy: [['inf', 6.9, -2.6], ['inf', 5.2, -3.2], ['tank', 7.2, -5], ['inf', 4.6, -6.4], ['ifv', 7.4, -7.6], ['inf', 5.4, -8.4], ['tank', 3.6, -9.6]],
    timeLimit: 100, cmds: ['smoke', 'repair'],
    setup: (S) => { S.drillLimit = 100; foes(S).forEach((u) => (u.goal = { x: u.x, z: u.z })); },
    tick: (S) => { const g = aliveUs(S).find((u) => u.kind === 'gunship'); const lead = aliveUs(S).filter((u) => u.kind === 'ifv').sort((a, b) => a.z - b.z)[0]; if (g && lead) g.goal = { x: lead.x, z: lead.z - 3 }; },
    rule: (S) => {
      const ifv = mine(S).filter((u) => u.kind === 'ifv');
      const n = arrived(S, 'ifv', FWD), alive = ifv.filter((u) => u.alive).length;
      if (n >= 2 && n >= alive) return 'win';
      if (alive < 2) return 'lose';
      return S.simT >= 100 ? 'time' : null;
    },
    cam: { tz: 0, dist: 30 },
  }),
  preset: [at('ifv', 6.2, 11.4, FWD), at('ifv', 7.4, 12.2, FWD), at('ifv', 5, 12.4, FWD), at('gunship', 6.2, 9.6, { x: 6.2, z: 2 })],
  kinds: ['gunship'], lock: true, cp0: 3,
  score: (S) => clamp01((arrived(S, 'ifv', FWD) / 3) * 0.7 + hpFrac(mine(S).filter((u) => u.kind === 'ifv')) * 0.3),
  bar: (S) => ({ label: '도착한 장갑차', pct: 100 - (arrived(S, 'ifv', FWD) / 3) * 100, txt: `${arrived(S, 'ifv', FWD)}/3` }),
};

const BEACH = { x: 0.4, z: -9 };
const AAV: Drill = {
  id: 'n3-aav', training: '체력', name: '바다 건너 상륙', how: '상륙장갑차 4대가 바다를 헤엄쳐 건너 적 해안에 올라가요. 물에선 느리고 약해요. "연막"으로 가리고 "긴급 수리"로 버텨서 3대 넘게 상륙시켜요.',
  stage: field('aav', '목표: 상륙장갑차 3대 이상 적 해안 상륙', {
    enemy: [['inf', 1.4, -7.6], ['inf', -.4, -10.6], ['tank', 2.6, -10], ['spg', 5.6, -13], ['inf', 2.2, -12], ['tank', 1, -5.6], ['spg', 3.6, -14]],
    timeLimit: 110, cmds: ['smoke', 'repair'],
    setup: (S) => { S.drillLimit = 110; foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; }); },
    rule: (S) => {
      const a = mine(S).filter((u) => u.kind === 'aav'); const n = arrived(S, 'aav', BEACH), alive = a.filter((u) => u.alive).length;
      if (n >= 3 && n >= alive) return 'win';
      if (alive < 3) return 'lose';
      return S.simT >= 110 ? 'time' : null;
    },
    cam: { tx: -3, tz: 0, dist: 31 },
  }),
  preset: [at('aav', -7, 12, BEACH), at('aav', -8.4, 12.6, BEACH), at('aav', -5.6, 12.8, BEACH), at('aav', -7, 13.6, BEACH)],
  kinds: ['aav'], lock: true, cp0: 3,
  score: (S) => clamp01((arrived(S, 'aav', BEACH) / 4) * 0.7 + hpFrac(mine(S)) * 0.3),
  bar: (S) => ({ label: '상륙한 장갑차', pct: 100 - (arrived(S, 'aav', BEACH) / 4) * 100, txt: `${arrived(S, 'aav', BEACH)}/4` }),
};

const USV: Drill = {
  id: 'n3-usv', training: '해킹', name: '바다 드론 떼', how: '값싼 바다 드론 10척으로 큰 적 군함을 잡아요. 군함 포에 가까이 가기 전에 맞으면 끝나요. "전자전"으로 군함을 묶은 순간 드론이 파고들어요.',
  stage: field('usv', '목표: 적 군함 3척 격침', {
    enemy: [['dd', -6.4, -9], ['lha', -8, -12], ['dd', -5.4, -13.6]],
    timeLimit: 70, cmds: ['emp'], cpRate: .6,
    setup: (S) => { S.drillLimit = 70; foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; u.max = Math.round(u.max * .38); u.hp = u.max; u.d = { ...u.d, atk: u.d.atk * .5 }; }); },
    rule: (S) => (!foes(S).some((u) => u.alive) ? 'win' : !aliveUs(S).length && !S.pending.length ? 'lose' : S.simT >= 70 ? 'time' : null),
    cam: { tx: -4, tz: -1, dist: 30 },
  }),
  preset: [-8.6, -7.8, -7, -6.2, -5.4, -8.2, -7.4, -6.6, -5.8, -5].map((x, i) => at('usv', x, 11 + (i >= 5 ? 1.4 : 0))),
  kinds: ['usv'], lock: true, cp0: 4,
  score: (S) => clamp01(1 - hpFrac(foes(S))) ,
  bar: killBar('격침'),
};

// 11-28 새 병과 훈련 2개: 극초음속 미사일 · 공병
const HGV: Drill = {
  id: 'n3-hgv', training: '포격', name: '극초음속 관통 타격', how: '적 장거리 방공 4대가 겹겹이 지키는 지휘소예요. 탄도탄은 거의 다 떨어지지만 극초음속 미사일은 1.4초 만에 떨어져 방공이 거의 못 막아요.',
  stage: field('hgv', '목표: 방공망 뒤 적 지휘소 파괴', {
    enemy: [['hq', 5, -13], ['sam', 3, -10.6], ['sam', 7, -10.6], ['sam', 4, -12], ['sam', 6, -12], ['inf', 4.4, -9], ['tank', 6, -8.4]],
    timeLimit: 90, cmds: [], cpRate: .6,
    setup: (S) => { hqHp(S, 1700); S.drillLimit = 90; foes(S).forEach((u) => { u.goal = { x: u.x, z: u.z }; u.hold = true; }); aliveUs(S).forEach((u) => { if (u.kind === 'hgv') { u.only = 'hq'; u.d = { ...u.d, cd: 8 }; } }); },
    rule: hqRule, cam: { tz: -1, dist: 32 },
  }),
  preset: [hold('hgv', 3, 13), hold('hgv', 6, 13.2), hold('aa', 4.5, 11.6)],
  kinds: ['hgv'], lock: true, cp0: 2, score: hqScore, bar: hqBar,
};
const ENG_WAVES = [
  { at: 6, hp: .6, list: squad3([['inf', 4], ['ifv', 1]], 4, -12) },
  { at: 28, hp: .6, list: squad3([['inf', 3], ['ifv', 2]], 2.4, -13) },
  { at: 50, hp: .6, list: squad3([['inf', 3], ['tank', 1], ['ifv', 1]], 5.6, -13) },
];
const ENG: Drill = {
  id: 'n3-eng', training: '전술', name: '공병 방어선', how: '공병이 앞에 지뢰를 묻고 둘레 아군을 모래주머니로 지켜요(받는 피해 −18%). 적이 오기 전에 공병을 길목에 두면 지뢰가 먼저 터져요.',
  stage: field('eng', '목표: 지뢰와 진지로 길목 지키기', {
    timeLimit: 80, foeGoal: { x: 4, z: 11 }, cmds: ['arty'], cpRate: .5,
    setup: (S) => { S.drillLimit = 80; },
    tick: (S) => waves(S, ENG_WAVES),
    rule: (S) => (foes(S).some((u) => u.alive && u.z > 10.4) ? 'lose' : !aliveUs(S).length ? 'lose' : S.simT >= 80 || (S.simT > 50 && !foes(S).some((u) => u.alive)) ? 'win' : null),
    cam: { tz: 0, dist: 30 },
  }),
  preset: [hold('eng', 2.6, 5.6), hold('eng', 5.8, 5.6), hold('inf', 3, 8), hold('inf', 5.4, 8), hold('tank', 4.2, 9.2)],
  kinds: ['eng'], lock: true, cp0: 2,
  score: (S) => clamp01(killFrac(S) * 0.82 + (foes(S).some((u) => u.alive && u.z > 10.4) ? 0 : 0.18)),
  bar: killBar('막아 낸 적'),
};
const NEW_DRILLS: Drill[] = [BM, MLRS, SAM, CSM, UAV, F35, AWACS, GUNSHIP, AAV, USV, HGV, ENG];
/** 무리 하나(종류×수를 가로로 늘어놓음) */
function squad3(list: Array<[Kind, number]>, x: number, z: number): Place[] {
  const out: Place[] = [];
  list.forEach(([k, n]) => { for (let i = 0; i < n; i++) out.push([k, x + ((out.length % 4) - 1.5) * .9, z - Math.floor(out.length / 4) * .9]); });
  return out;
}

export const DRILLS: Drill[] = [TAC, ARTY, LEAD, AIR, SHOOT, SEA, HACK, SUP, SNEAK, INTEL, REC, FIT, ...RANGES, ...NEW_DRILLS];
export const drillById = (id: string) => DRILLS.find((d) => d.id === id);

/** 이 훈련 판의 전장(모병은 씨앗마다 신병 병과가 바뀜) */
export function drillStage(d: Drill, seed: number): Stage {
  return d.id === 'd3-rec' ? { ...d.stage, kinds: recruitKinds(seed) } : d.stage;
}

/* ───────── 화면 없이 돌리기(시험 · 자동) ───────── */
/** 간단한 지휘관: 지휘력이 차면 적이 가장 많이 모인 곳(수리는 우리 쪽)에 명령 */
export function botCommand(S: Sim, cmds: CmdKey[]) {
  for (const k of cmds) {
    if (S.cp < CMD[k].cost) continue;
    const pool = k === 'repair' || k === 'smoke' ? aliveUs(S).filter((u) => k !== 'repair' || u.hp < u.max * .7) : foes(S).filter((u) => u.alive && !u.hidden);
    if (!pool.length) continue;
    let best = pool[0], bn = -1;
    for (const u of pool) { const n = pool.filter((o) => dist(o, u) < CMD[k].r).length; if (n > bn) { bn = n; best = u; } }
    const lead = k === 'arty' || k === 'air' ? 1.2 : k === 'cruise' ? 2 : 0;
    const tz = best.z + (best.side === 'foe' && best.moving ? lead : 0);
    doCmd(S, k, best.x, tz, '');
    return;
  }
}
/** 끝까지 돌림. bot = 명령을 저절로 씀 · picks = 배치(없으면 예산 안 기본) */
export function runDrill(d: Drill, seed = 1, opt: { bot?: boolean; picks?: Pick3[] } = {}): { S: Sim; score: number } {
  const st = drillStage(d, seed);
  useStage(st);
  const S = createSim();
  setupDeploy(S, opt.picks ?? (d.lock ? d.preset : autoPicks(d, st)), { cp0: d.cp0 });
  startBattle(S);
  for (let i = 0; i < 4000 && S.phase === 'battle'; i++) {
    if (opt.bot && i % 10 === 0) botCommand(S, st.cmds ?? []);
    step(S);
    if (opt.bot && d.tap && i % 120 === 60) { const f = foes(S).find((u) => u.alive && u.hidden) ?? foes(S).find((u) => u.alive); if (f) d.tap(S, f.x + .3, f.z + .3, f); }
  }
  const score = d.score(S);
  useStage(COAST);
  return { S, score };
}
/** 예산 배치 훈련의 기본 배치(예산 안에서 앞줄부터 고르게) */
export function autoPicks(d: Drill, st: Stage): Pick3[] {
  const kinds = (st.kinds ?? []).slice().sort((a, b) => DEF[b].cost - DEF[a].cost);
  const out: Pick3[] = [];
  let spent = 0, i = 0;
  const budget = d.budget ?? 100;
  while (kinds.length && i < 40) {
    const k = kinds[i % kinds.length]; i++;
    if (spent + DEF[k].cost > budget) continue;
    const x = 1 + (out.length * 1.6) % 8, z = 10 + Math.floor(out.length / 5) * 1.4;
    out.push({ kind: k, tile: -1, at: [x, z] });
    spent += DEF[k].cost;
  }
  return out;
}
