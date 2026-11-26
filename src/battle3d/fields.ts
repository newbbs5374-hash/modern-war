// 11-26 큰 3D 전장 모음(대장 요청 "같은 전장을 나눠 쓰지 말고 10개 이상의 큰 전장을 만들어 전투에 맞게 돌아가며").
// 전장마다 넓이(28×41, 시험판 해안 전장의 약 2배) · 생김새 · 바다/강/산/건물 · 적 배치 · 이기는 조건이 다르다.
// 계산(sim.ts)은 같은 규칙을 쓰고, 화면(view.ts)은 theme·hills·woods·roads·blocks로 꾸민다.
import type { Block, Kind, Place, PointDef, Stage, Theme, WinRule } from './sim';

/** 큰 전장 넓이: 가로 28 · 세로 41 */
export const BIG = { xMin: -14, xMax: 14, zTop: -21, zBot: 20 };
/** 아주 큰 전장(대평원·해전): 가로 32 · 세로 45 */
export const HUGE = { xMin: -16, xMax: 16, zTop: -23, zBot: 22 };

type SeaKind = 'none' | 'left' | 'all' | 'amph' | 'foesea';
export interface FieldSpec {
  id: string; name: string; op: string; goal: string; desc: string; theme: Theme; win: WinRule;
  field?: Stage['field'];
  /** 바다: 없음 · 왼쪽 해안 · 온통 바다 · 우리 쪽이 바다(상륙) · 적 쪽이 바다 */
  sea?: SeaKind; seaAt?: number;
  /** 강: 가운데 높이 z · 굽이 · 다리 x */
  river?: { z: number; amp?: number; bridges: number[] };
  /** 산: [x, z, 반지름, 높이] · 땅 울퉁불퉁한 정도 */
  hills?: Array<[number, number, number, number]>; rough?: number;
  blocks?: Block[]; points?: PointDef[];
  enemy: Place[]; waves?: Place[][]; timed?: Stage['timed']; reinf?: Stage['reinf'];
  allies?: Place[]; allyGoal?: { x: number; z: number }; foeAggr?: boolean;
  usGoal?: { x: number; z: number }; timeLimit?: number; budget?: number; kinds?: Kind[];
  deploy?: Place[]; roads?: Stage['roads']; woods?: Stage['woods']; urban?: boolean;
  tick?: Stage['tick']; setup?: Stage['setup'];
}

/** 적 무리: [병과, 수] 목록을 (cx, cz) 둘레에 고르게 */
export function squad(list: Array<[Kind, number]>, cx: number, cz: number, gap = 1.2): Place[] {
  const out: Place[] = [];
  const all: Kind[] = list.flatMap(([k, n]) => Array.from({ length: n }, () => k));
  const cols = Math.ceil(Math.sqrt(all.length * 1.6));
  all.forEach((k, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    out.push([k, Math.round((cx + (c - (cols - 1) / 2) * gap + (r % 2) * gap * .4) * 10) / 10, Math.round((cz - r * gap * .9) * 10) / 10]);
  });
  return out;
}
/** 가로 구간 × 세로 구간 건물 덩어리(빼낼 칸 skip) */
export function grid(xs: Array<[number, number]>, zs: Array<[number, number]>, skip: Array<[number, number]> = [], h = 1, rock = false): Block[] {
  const out: Block[] = [];
  xs.forEach(([x0, x1], i) => zs.forEach(([z0, z1], j) => { if (!skip.some(([a, b]) => a === i && b === j)) out.push({ x0, x1, z0, z1, h, ...(rock ? { rock: true } : {}) }); }));
  return out;
}

const noRiver = () => 99;
/** 해안선(x = coastX(z), 바다는 왼쪽) */
function coastOf(k: SeaKind, at = -6): (z: number) => number {
  if (k === 'none') return () => -99;
  if (k === 'all') return () => 99;
  if (k === 'amph') return (z) => at + .62 * z + Math.sin(z * .35) * .7;
  if (k === 'foesea') return (z) => at - .55 * z + Math.sin(z * .4) * .7;
  return (z) => at + Math.sin(z * .2) * 1.3 + Math.sin(z * .57 + 1) * .4;
}

/** 전장 설명서 → 계산용 Stage */
export function makeField(f: FieldSpec): Stage {
  const field = f.field ?? BIG;
  const cx = coastOf(f.sea ?? 'none', f.seaAt);
  const rz = f.river ? (x: number) => f.river!.z + Math.sin(x * .38) * (f.river!.amp ?? .9) + Math.sin(x * .9 + 2) * .25 : noRiver;
  const rough = f.rough ?? 1;
  const hills = f.hills ?? [];
  const allSea = f.sea === 'all';
  const hAt = (x: number, z: number) => {
    if (allSea) return -1.4 + Math.sin(x * .3 + z * .2) * .15;
    let h = .2 + (Math.sin(x * .41 + z * .23) * .15 + Math.sin(z * .33 - x * .21) * .13 + Math.sin(x * 1.2) * Math.cos(z * 1.05) * .05) * rough;
    for (const [hx, hz, r, hh] of hills) { const q = Math.hypot(x - hx, z - hz) / r; if (q < 2.2) h += hh * Math.exp(-q * q); }
    const edge = Math.max(0, Math.abs(x) - (field.xMax - 1.4)); h += edge * edge * .2;
    const d = x - cx(z);
    if (d < 1.2) { const k = Math.max(0, d) / 1.2; h = h * k + .06 * (1 - k); }
    if (d < 0) h = .06 + d * .75;
    if (d > 0 && f.river) { const riv = Math.abs(z - rz(x)); if (riv < .9) h = Math.min(h, -.28 + riv * .4); }
    return Math.max(h, -1.8);
  };
  // 전장 밖으로 삐져나간 자리는 안쪽으로
  const cl = (ps?: Place[]) => ps?.map(([k, x, z]) => [k, Math.max(field.xMin + .6, Math.min(field.xMax - .6, x)), Math.max(field.zTop - 2, Math.min(field.zBot - .6, z))] as Place);
  f = { ...f, enemy: cl(f.enemy)!, waves: f.waves?.map((w) => cl(w)!), timed: f.timed?.map((t) => ({ ...t, list: cl(t.list)! })), allies: cl(f.allies), reinf: f.reinf && { ...f.reinf, list: cl(f.reinf.list)! } };
  return {
    id: f.id, name: f.name, op: f.op, goal: f.goal, desc: f.desc, theme: f.theme, win: f.win, field,
    coastX: cx, riverZ: rz, bridges: f.river?.bridges ?? [], hAt,
    enemy: f.enemy, timeLimit: f.timeLimit ?? 300, usGoal: f.usGoal ?? { x: 0, z: field.zTop + 4 },
    urban: f.urban, blocks: f.blocks, points: f.points, waves: f.waves, timed: f.timed, reinf: f.reinf,
    allies: f.allies, allyGoal: f.allyGoal, foeAggr: f.foeAggr, budget: f.budget ?? 560, kinds: f.kinds, deploy: f.deploy,
    roads: f.roads, woods: f.woods, hills: f.hills, tick: f.tick, setup: f.setup,
  };
}

const SEA_KINDS: Kind[] = ['dd', 'cv', 'sub', 'lha', 'ssn', 'laser', 'drone', 'heli', 'jet', 'bomber', 'missile'];
export const LAND_AIR: Kind[] = ['inf', 'sf', 'ifv', 'hack', 'tank', 'spg', 'aa', 'drone', 'heli', 'jet', 'bomber', 'missile'];

/* ───────── 임무·작전·대전투에 쓰는 큰 전장 ───────── */

/** ① 산악 고지: 양옆 큰 산, 가운데 강, 적 지휘소는 고지 위 */
export const HIGHLAND = makeField({
  id: 'highland', name: '산악 고지', op: 'RIDGELINE-21', goal: '목표: 고지 위 지휘소 파괴 → 최후 저항 막기', theme: 'green', win: 'hqwaves',
  desc: '양옆으로 큰 산이 막고 가운데 강이 흐르는 고지대예요. 다리 두 곳으로 건너 고지 위 지휘소를 부숴요.',
  river: { z: 1, bridges: [-6.5, 5.5] }, hills: [[-12, -4, 4, 1.6], [12, 3, 4, 1.5], [0, -17, 5, 1.1], [-9, 11, 3, .7], [9, -12, 3, .9]],
  woods: [[-8, -9, 2.6], [8, -4, 2.4], [-3, 7, 1.6], [6, 9, 1.8], [-10, -15, 2]],
  roads: [[[-1, 19], [-6.5, 6], [-6.5, -3], [-2, -10], [0, -17]], [[4, 19], [5.5, 6], [5.5, -4], [1, -15]]],
  enemy: [['hq', 0, -17.5],
    ...squad([['tank', 3], ['inf', 3], ['ifv', 2]], -6.5, -4), ...squad([['tank', 3], ['inf', 3], ['sf', 1], ['ifv', 1]], 5.5, -4.5),
    ...squad([['aa', 2], ['spg', 2], ['hack', 1]], 0, -13), ...squad([['inf', 3], ['tank', 1]], 0, -16, 1.4),
    ['heli', -3, -14], ['heli', 3, -14], ['jet', 0, -19], ['drone', -5, -12], ['drone', 5, -12], ['bomber', 8, -19]],
  timed: [{ at: 70, list: squad([['tank', 1], ['ifv', 1], ['inf', 2]], 12, -20), msg: '동쪽 산길로 적 반격 부대가 내려와요' }, { at: 130, list: squad([['tank', 1], ['inf', 2], ['sf', 1]], -12, -20), msg: '서쪽 산길로 적 반격 부대가 내려와요' }],
  waves: [squad([['tank', 2], ['ifv', 1], ['inf', 2]], 0, -20.4), [...squad([['tank', 1], ['inf', 2]], -12, -10), ...squad([['tank', 1], ['inf', 1], ['heli', 1]], 12, -10)]],
});

/** ② 사막 정유 기지: 모래 언덕, 무장 트럭이 많고 넓게 트임 */
export const DUNE = makeField({
  id: 'dune', name: '사막 정유 기지', op: 'SANDSTORM-08', goal: '목표: 정유 기지 지휘소 파괴 → 최후 저항 막기', theme: 'desert', win: 'hqwaves',
  desc: '모래 언덕이 이어진 사막이에요. 숨을 곳이 적고 무장 트럭이 빠르게 몰려와요. 정유 기지 지휘소를 부숴요.',
  hills: [[-9, -2, 3.5, .8], [8, 4, 3, .7], [-3, -11, 2.5, .5], [10, -10, 3, .9], [-11, 10, 3, .6], [2, 8, 2.2, .4]], rough: .6,
  blocks: grid([[3.5, 5.5], [7.5, 9.5]], [[-19.5, -18], [-16, -14.5]], [], .9),
  roads: [[[0, 19], [1, 4], [3, -8], [6, -17]]],
  enemy: [['hq', 6.5, -17],
    ...squad([['tech', 4], ['inf', 2]], -6, -2, 1.3), ...squad([['tech', 4], ['ifv', 2]], 7, -1, 1.3),
    ...squad([['tank', 4], ['inf', 2], ['aa', 2]], 3, -10), ...squad([['spg', 3], ['aa', 1], ['hack', 1]], 0, -16),
    ['heli', -2, -12], ['heli', 9, -12], ['drone', 0, -8], ['drone', 5, -8], ['jet', 4, -20], ['bomber', -6, -19]],
  timed: [{ at: 40, list: squad([['tech', 5]], -13, -6, 1.3), msg: '모래 폭풍 속에서 무장 트럭이 옆구리를 쳐요' }, { at: 100, list: squad([['tech', 4], ['tank', 2]], 13, -12, 1.3), msg: '동쪽 사막에서 적 기갑이 돌아 들어와요' }],
  waves: [[...squad([['tech', 4], ['inf', 2]], -10, -20), ...squad([['tank', 3], ['tech', 3]], 12, -20)]],
});

/** ③ 설원 방어선: 눈 덮인 숲, 4분 동안 전방 기지를 지킴 */
export const FROST = makeField({
  id: 'frost', name: '설원 방어선', op: 'WHITEOUT-14', goal: '목표: 4분 동안 전방 기지 지키기', theme: 'snow', win: 'survive', timeLimit: 240,
  desc: '눈 덮인 침엽수림이에요. 적이 네 번에 걸쳐 몰려와요. 전방 기지 차량이 쓰러지면 져요. 4분을 버티세요.',
  hills: [[-11, -8, 3.5, 1], [11, -6, 3.5, 1.1], [0, -18, 4, .7]],
  woods: [[-7, -2, 3], [7, 0, 3], [-11, 6, 2.4], [11, 8, 2.4], [0, -10, 2.4], [-5, -15, 2.2], [6, -14, 2]],
  allies: [['vip', 0, 13.2]],
  enemy: [...squad([['inf', 3], ['tank', 2]], -5, -12), ...squad([['inf', 3], ['ifv', 2]], 5, -12), ['spg', -2, -18], ['spg', 2, -18], ['aa', 0, -16]],
  timed: [
    { at: 20, list: squad([['inf', 4], ['tank', 2], ['ifv', 1]], -6, -19) },
    { at: 75, list: squad([['tank', 3], ['ifv', 2], ['drone', 2]], 6, -19) },
    { at: 135, list: squad([['inf', 4], ['tank', 3], ['heli', 2]], 0, -19) },
    { at: 190, list: [...squad([['tank', 2], ['sf', 2]], -7, -19), ...squad([['tank', 2], ['jet', 1]], 7, -19)], msg: '마지막 대공세! 끝까지 버티세요' },
  ],
});

/** ④ 밀림 강: 넓은 강과 다리 세 곳, 거점 세 곳 */
export const RAINFOREST = makeField({
  id: 'rainforest', name: '밀림 강 건너기', op: 'GREENHELL-03', goal: '목표: 강 건너 거점 3곳 차지', theme: 'jungle', win: 'points',
  desc: '빽빽한 밀림 사이로 넓은 강이 흘러요. 다리 세 곳을 건너 거점 3곳을 차지하면 이겨요. 적이 거점을 쥐는 동안 증원이 와요.',
  river: { z: 2, amp: 1.2, bridges: [-8, 0, 7.5] },
  woods: [[-11, -6, 3], [11, -5, 3], [-4, -13, 2.6], [5, -16, 2.4], [-11, 10, 2.6], [10, 11, 2.4], [0, 9, 1.6], [-6, -1, 1.6], [4, -2, 1.5]],
  points: [{ name: '서쪽 나루', x: -8, z: -5, r: 1.8 }, { name: '고무 농장', x: 2, z: -9, r: 1.9 }, { name: '동쪽 마을', x: 8, z: -14, r: 1.8 }],
  enemy: [...squad([['inf', 3], ['tank', 1], ['sf', 1]], -8, -5), ...squad([['inf', 4], ['ifv', 1], ['tank', 1], ['aa', 1]], 2, -9), ...squad([['inf', 3], ['tank', 2], ['hack', 1], ['aa', 1]], 8, -14),
    ...squad([['inf', 3]], -1, 0), ['spg', -3, -17], ['spg', 4, -19], ['heli', 0, -15], ['drone', -6, -12], ['drone', 9, -9]],
  reinf: { every: 25, max: 5, list: [['inf', -6, -20], ['tech', 2, -20], ['inf', 8, -20], ['tank', 0, -20.5]] },
  timed: [{ at: 45, list: squad([['inf', 3], ['tech', 2], ['heli', 1]], -12, -18), msg: '서쪽 밀림에서 적이 거점을 되찾으러 와요' }, { at: 95, list: squad([['tank', 2], ['inf', 3], ['sf', 1]], 12, -18), msg: '동쪽 밀림에서 적이 거점을 되찾으러 와요' }],
});

/** ⑤ 대평원 전차전: 아주 넓고 트인 들판, 양쪽 전차 대군이 맞부딪침 */
export const PLAINS = makeField({
  id: 'plains', name: '대평원 전차전', op: 'STEEL-RAIN-30', goal: '목표: 적 기갑 부대 모두 격파', theme: 'steppe', win: 'all', field: HUGE, foeAggr: true, budget: 620,
  desc: '끝없이 트인 들판이에요. 적 전차 대군이 정면으로 밀고 와요. 모두 격파하면 이겨요.',
  hills: [[-12, -6, 4, .6], [12, 2, 4, .5], [0, -4, 3, .3]], rough: .5,
  woods: [[-13, 12, 2], [13, -14, 2], [-6, -16, 1.6]],
  enemy: [...squad([['tank', 4], ['ifv', 2]], -6, -14, 1.3), ...squad([['tank', 4], ['ifv', 2]], 6, -14, 1.3),
    ...squad([['spg', 3], ['aa', 2], ['inf', 3]], 0, -19), ['heli', -4, -18], ['jet', 0, -21]],
  timed: [{ at: 70, list: squad([['tank', 3], ['ifv', 2]], -15, -22, 1.3), msg: '적 2제대 전차가 서쪽 지평선에 나타났어요' }, { at: 140, list: [...squad([['tank', 3], ['ifv', 1]], 15, -22, 1.3), ['heli', 0, -23]], msg: '적 3제대가 동쪽에서 밀고 와요' }],
});

/** ⑥ 상륙 해안: 우리는 바다에서, 적은 해안 벙커 뒤 언덕 위 */
export const BEACHHEAD = makeField({
  id: 'beachhead', name: '상륙 해안', op: 'TIDEFALL-06', goal: '목표: 해안을 넘어 지휘소 파괴 → 최후 저항 막기', theme: 'green', win: 'hqwaves', sea: 'amph', seaAt: -1.5, timeLimit: 360,
  desc: '우리 쪽은 바다, 적은 해안 벙커 뒤 언덕에 있어요. 배로 해안을 두드리고 상륙해 지휘소를 부숴요.',
  hills: [[6, -14, 4, 1.1], [-8, -17, 3.5, .8]], woods: [[9, -6, 2.2], [-4, -16, 2], [12, -16, 1.6]],
  enemy: [['hq', 5, -17],
    ...squad([['inf', 4], ['tank', 2]], 4, -2), ...squad([['inf', 3], ['tank', 2], ['aa', 1]], -3, -8), ...squad([['spg', 3], ['aa', 2], ['hack', 1]], 6, -12),
    ['dd', -10, 4], ['dd', -8, 8], ['sub', -11, 10], ['boat', -6, 3], ['boat', -9, 0],
    ['heli', 2, -13], ['jet', 4, -20], ['drone', 0, -10], ['drone', 8, -9]],
  timed: [{ at: 60, list: squad([['tank', 2], ['inf', 3]], 12, -20), msg: '적 예비대가 해안으로 내려와요' }],
  waves: [squad([['tank', 2], ['ifv', 1], ['inf', 2]], 10, -20.4)],
});

/** ⑦ 항구 습격: 왼쪽 바다, 부두 창고 거리, 거점 3곳(부두) */
export const HARBOR = makeField({
  id: 'harbor', name: '항구 습격', op: 'DOCKSIDE-17', goal: '목표: 부두 거점 3곳 차지', theme: 'dusk', win: 'points', sea: 'left', seaAt: -7,
  desc: '해 질 녘 항구예요. 왼쪽은 바다, 오른쪽은 창고 거리예요. 부두 거점 3곳을 차지하면 이겨요. 배끼리도 싸워요.',
  blocks: [...grid([[-3.5, -1], [1, 3.5], [5.5, 8.5], [10, 12.5]], [[-17, -14.5], [-12.5, -10], [-6, -3.5]], [[1, 1], [3, 2]], .9)],
  points: [{ name: '1번 부두', x: -5, z: -12, r: 1.7 }, { name: '컨테이너 야적장', x: 4.5, z: -8, r: 1.9 }, { name: '세관', x: 9, z: -1, r: 1.7 }],
  enemy: [...squad([['inf', 3], ['tank', 1], ['aa', 1]], -5, -11.6, 1), ...squad([['inf', 3], ['ifv', 2]], 4.5, -8), ...squad([['inf', 2], ['tank', 2], ['sf', 1]], 9, -1),
    ['dd', -11, -12], ['dd', -12, -4], ['boat', -10, 2], ['boat', -11, 6], ['sub', -12, -16], ['spg', 7, -19.5], ['spg', 11, -19.5], ['heli', 2, -19], ['drone', 6, -14]],
  reinf: { every: 28, max: 4, list: [['inf', 4, -20], ['tech', 8, -20], ['inf', 0, -20], ['tank', 11, -20]] },
  timed: [{ at: 50, list: [['dd', -12, -20], ['boat', -11, -18], ['boat', -12.5, -16]], msg: '적 함정이 항구로 들어와요' }],
});

/** ⑧ 야간 숲 기습: 어두운 숲, 적이 잠든 사이 사령부 기습 */
export const NIGHTWOOD = makeField({
  id: 'nightwood', name: '야간 숲 기습', op: 'NIGHTFALL-09', goal: '목표: 숲속 사령부 파괴 → 최후 저항 막기', theme: 'night', win: 'hqwaves',
  desc: '달빛만 있는 깊은 숲이에요. 적 사령부가 숲 한가운데 숨어 있어요. 들키기 전에 빠르게 부숴요.',
  woods: [[-9, -3, 3.4], [9, -2, 3.4], [-4, -10, 2.4], [5, -11, 2.4], [-10, 8, 2.6], [10, 9, 2.6], [0, 3, 2], [-11, -15, 2.4], [11, -16, 2.4]],
  hills: [[0, -16, 4, .6]],
  enemy: [['hq', 0, -15],
    ...squad([['inf', 3], ['sf', 2]], -6, -6), ...squad([['inf', 3], ['tank', 1], ['ifv', 1]], 6, -6),
    ...squad([['tank', 2], ['aa', 2], ['spg', 2], ['hack', 1]], 0, -11), ...squad([['inf', 4], ['tank', 2]], 0, -18, 1.4), ['heli', -4, -17], ['drone', 4, -17], ['drone', -2, -9]],
  timed: [{ at: 45, list: squad([['inf', 3], ['sf', 2], ['tank', 1]], -13, -12), msg: '비상! 잠에서 깬 적이 서쪽 숲에서 나와요' }, { at: 100, list: squad([['inf', 3], ['tank', 2], ['ifv', 1]], 13, -12), msg: '동쪽 숲에서도 적이 몰려와요' }],
  waves: [[...squad([['inf', 3], ['sf', 2]], -12, -20), ...squad([['tank', 2], ['ifv', 2], ['inf', 2]], 12, -20)]],
});

/** ⑨ 협곡 돌파: 바위 절벽 사이 좁은 길 세 갈래 */
export const CANYON = makeField({
  id: 'canyon', name: '협곡 돌파', op: 'STONEGATE-11', goal: '목표: 협곡 끝 지휘소 파괴 → 최후 저항 막기', theme: 'rock', win: 'hqwaves',
  desc: '붉은 바위 절벽 사이로 좁은 길 세 갈래가 나 있어요. 길목마다 적이 지키고 있어요. 협곡 끝 지휘소를 부숴요.',
  blocks: [
    ...grid([[-14, -10.5], [-7.5, -2], [2, 7.5], [10.5, 14]], [[-9, 6]], [], 1.4, true),
    ...grid([[-14, -6.5], [-3.5, 3.5], [6.5, 14]], [[-16, -11.5]], [], 1.4, true),
  ],
  hills: [[-12, 0, 3, 1.6], [12, 0, 3, 1.6], [0, -2, 3, 1.4]], rough: 1.3,
  enemy: [['hq', 0, -19],
    ...squad([['inf', 3], ['tank', 1]], -9, -2), ...squad([['inf', 2], ['tank', 2]], 0, 8), ...squad([['inf', 3], ['ifv', 1]], 9, -2),
    ['inf', -5, -13], ['tank', -5, -14.6], ['inf', 5, -13], ['tank', 5, -14.6],
    ...squad([['tank', 2], ['aa', 2], ['spg', 2], ['inf', 1]], -6, -18.2), ...squad([['tank', 1], ['sf', 1], ['spg', 1], ['hack', 1], ['aa', 1]], 6, -18.2),
    ['heli', 0, -18], ['drone', -3, -18], ['drone', 3, -18], ['jet', 7, -20]],
  waves: [squad([['tank', 2], ['inf', 3], ['sf', 1]], 0, -20.5)],
});

/** ⑩ 보급로 호송: 들판 길을 따라 수송 차량 2대를 끝까지 데려감 */
export const SUPPLY = makeField({
  id: 'supply', name: '보급로 호송', op: 'LIFELINE-04', goal: '목표: 수송 차량 2대를 북쪽 보급소까지', theme: 'steppe', win: 'escort', timeLimit: 330,
  desc: '들판을 가로지르는 보급로예요. 수송 차량 2대가 북쪽 보급소까지 가야 해요. 길가 숲·언덕에 매복이 있어요. 한 대라도 잃으면 져요.',
  allies: [['vip', -1, 14], ['vip', 1, 15.4]], allyGoal: { x: 0, z: -18 },
  hills: [[-9, -5, 3, .7], [9, 4, 3, .7]], woods: [[-6, 2, 2.2], [6, -6, 2.2], [-5, -12, 2], [7, 9, 1.8]],
  roads: [[[0, 19], [0, -19]]],
  enemy: [...squad([['inf', 3], ['tech', 2]], -6, 3), ...squad([['inf', 2], ['tank', 2], ['aa', 1]], 6, -5),
    ...squad([['inf', 3], ['tech', 2], ['sf', 1]], -5, -11), ...squad([['tank', 2], ['ifv', 2], ['spg', 2]], 5, -16), ['drone', -8, -8], ['heli', 8, -12]],
  timed: [{ at: 30, list: squad([['tech', 3], ['inf', 2]], 13, 4), msg: '동쪽에서 무장 트럭이 기습해요!' }, { at: 80, list: squad([['tank', 2], ['tech', 3]], -13, -4), msg: '서쪽에서 적 전차가 길을 막아요!' },
    { at: 140, list: [...squad([['tech', 3], ['inf', 2]], 13, -14), ['heli', 0, -22], ['drone', -6, -22]], msg: '보급소 앞에서 마지막 매복!' }],
});

/** ⑪ 인질 구출: 적 마을에 갇힌 인질 차량 → 둘레를 치우면 우리 진지로 돌아옴 */
export const HOSTAGE = makeField({
  id: 'hostage', name: '인질 구출', op: 'SAFEHOME-02', goal: '목표: 마을의 적을 치우고 인질을 우리 진지까지', theme: 'green', win: 'escort', timeLimit: 330,
  desc: '적이 점령한 마을에 인질이 잡혀 있어요. 인질 둘레의 적을 모두 치우면 인질 차량이 우리 진지로 돌아와요.',
  blocks: grid([[-5.5, -2.5], [2.5, 5.5]], [[-17, -14.5], [-11.5, -9]], [], .9),
  woods: [[-10, -4, 2.6], [10, -6, 2.6], [-9, 9, 2], [9, 8, 2]], hills: [[0, -16, 4, .3]],
  allies: [['vip', 0, -13]], allyGoal: { x: 0, z: 16 },
  enemy: [...squad([['inf', 4], ['tank', 2], ['sf', 1]], 0, -8), ...squad([['inf', 3], ['aa', 1]], -7, -14), ...squad([['inf', 3], ['ifv', 1]], 7, -14),
    ...squad([['tank', 2], ['inf', 2]], 0, -18), ['spg', -10, -19], ['spg', 10, -19], ['heli', 0, -20], ['drone', 5, -18]],
  setup: (S) => { for (const u of S.units) if (u.d.ally) { u.waitT = 1e9; u.hidden = true; } },
  tick: (S) => {
    const a = S.units.find((u) => u.d.ally && u.alive && u.waitT);
    if (!a || (S.simT * 20 | 0) % 10) return;
    if (!S.units.some((u) => u.alive && u.side === 'foe' && Math.hypot(u.x - a.x, u.z - a.z) < 6)) { a.waitT = 0; a.hidden = false; S.hooks.log?.('인질 구출! 우리 진지로 돌아와요', 'k'); }
  },
});

/** ⑫ 적 비행장: 활주로와 관제탑, 하늘이 적 비행기로 가득 */
export const AIRFIELD = makeField({
  id: 'airfield', name: '적 비행장', op: 'RUNWAY-13', goal: '목표: 관제탑 파괴 → 최후 저항 막기', theme: 'dusk', win: 'hqwaves',
  desc: '사막 끝 적 비행장이에요. 적 전투기·헬기·폭격기가 계속 떠올라요. 방공부대를 앞세우고 관제탑을 부숴요.',
  rough: .5, hills: [[-11, 6, 3, .5], [11, -10, 3, .6]],
  blocks: grid([[-9, -6], [6, 9]], [[-19, -16.5]], [], .9),
  roads: [[[-11, -13], [11, -13]], [[0, 19], [0, -12]]],
  enemy: [['hq', 0, -17],
    ...squad([['aa', 3], ['inf', 3], ['tank', 2]], -5, -9), ...squad([['aa', 3], ['inf', 2], ['tank', 2], ['ifv', 1]], 5, -9),
    ['jet', -8, -14], ['jet', -4, -14], ['jet', 4, -14], ['jet', 8, -14], ['heli', -2, -12], ['heli', 2, -12], ['bomber', 0, -20], ['bomber', -9, -20], ['drone', -6, -4], ['drone', 6, -4], ['spg', 0, -14]],
  timed: [{ at: 45, list: [['jet', -12, -21], ['jet', 12, -21], ['heli', 0, -21]], msg: '적 전투기가 더 떠올라요' }, { at: 100, list: [['bomber', 0, -22], ['jet', 4, -22], ...squad([['tank', 2], ['inf', 2]], -12, -18)], msg: '적 폭격기가 이륙하고 경비대가 달려와요' }],
  waves: [[...squad([['aa', 2], ['inf', 3], ['tank', 2]], 0, -20.4), ['jet', -6, -22], ['jet', 6, -22]]],
});

/** ⑬ 북극 해안: 눈 덮인 해안과 얼음 바다(철벽 작전의 겨울판, 더 넓음) */
export const FJORD = makeField({
  id: 'fjord', name: '북극 해안', op: 'POLARIS-19', goal: '목표: 피오르 해안 지휘소 파괴', theme: 'arctic', win: 'hq', sea: 'left', seaAt: -4.5, timeLimit: 420,
  desc: '얼음 바다와 눈 덮인 절벽 해안이에요. 육해공이 함께 싸워요. 해안 위 지휘소를 부숴요.',
  hills: [[10, -4, 4, 1.4], [8, 10, 3, .9], [12, -16, 3, 1.2]], woods: [[6, 2, 2], [9, -10, 2], [3, 12, 1.6]],
  river: { z: -3, amp: .6, bridges: [1, 7] },
  enemy: [['hq', 6, -17],
    ...squad([['tank', 3], ['inf', 3], ['ifv', 2]], 3, -9), ...squad([['inf', 3], ['sf', 1], ['aa', 2]], 8, -11), ...squad([['spg', 2], ['hack', 1], ['aa', 1]], 6, -15),
    ['dd', -9, -12], ['sub', -10, -4], ['cv', -12, -17], ['laser', -8, -16], ['lha', -7, -9],
    ['heli', 2, -14], ['jet', 5, -19], ['drone', 1, -12], ['drone', 10, -12]],
});

/** ⑭ 해협 해전: 온통 바다, 적 함대와 잠수함 */
export const STRAIT = makeField({
  id: 'strait', name: '해협 해전', op: 'DEEPBLUE-27', goal: '목표: 적 함대 모두 격침', theme: 'ocean', win: 'all', sea: 'all', field: HUGE, kinds: SEA_KINDS, budget: 600,
  desc: '섬 하나 없는 넓은 해협이에요. 적 구축함·잠수함·항공모함이 기다려요. 배와 비행기로만 싸워요.',
  enemy: [...squad([['dd', 3], ['laser', 1]], -6, -14, 2.2), ...squad([['dd', 2], ['cv', 1], ['lha', 1]], 6, -17, 2.4), ...squad([['sub', 3], ['ssn', 1]], 0, -8, 2.2),
    ['jet', -4, -20], ['jet', 4, -20], ['heli', 0, -18], ['drone', -8, -10], ['drone', 8, -10]],
  timed: [{ at: 60, list: [['dd', -15, -22], ['dd', -12, -22], ['sub', -14, -18]], msg: '적 2함대가 서쪽에서 들어와요' }, { at: 130, list: [['dd', 15, -22], ['laser', 12, -22], ['jet', 0, -23], ['jet', 4, -23]], msg: '적 3함대와 전투기가 동쪽에서 와요' }],
  deploy: [['dd', -6, 18], ['dd', -3, 18], ['dd', 3, 18], ['dd', 6, 18], ['sub', 0, 18], ['laser', 0, 19.4], ['cv', -4, 19.4], ['jet', 2, 19.4], ['jet', 5, 19.4], ['heli', -7, 19.4], ['missile', 8, 19.4]],
});

/* ───────── 3막 공성전 2·3막에 돌아가며 쓰는 큰 시가지 ───────── */

/** 2막 다른 판: 구시가지(좁은 골목, 거점 5곳) */
export const OLDTOWN = makeField({
  id: 'oldtown', name: '2막 · 구시가지', op: 'ALLEYWAY-22', goal: '목표: 거점 5곳 모두 차지', theme: 'green', win: 'points', urban: true, timeLimit: 300, budget: 300,
  desc: '좁은 골목이 얽힌 구시가지예요. 거점 5곳(성당 앞·시장 골목·우체국·옛 성문·시청 광장)에 우리 땅 부대만 서 있으면 조금씩 차지해요.',
  blocks: grid([[-14, -10], [-8.2, -4.6], [-2.8, .8], [2.6, 6.2], [8, 14]], [[-21, -17.5], [-15.7, -11.6], [-9.8, -5.6], [-3.8, .4], [2.2, 6.6]], [[2, 2], [1, 3], [3, 1]]),
  points: [{ name: '성당 앞', x: -1, z: -7.7, r: 1.7 }, { name: '시장 골목', x: -6.4, z: -1.7, r: 1.6 }, { name: '우체국', x: 4.4, z: -13.6, r: 1.6 }, { name: '옛 성문', x: 7.1, z: 1.3, r: 1.6 }, { name: '시청 광장', x: -1, z: -16.6, r: 1.8 }],
  enemy: [...squad([['inf', 2], ['tank', 1]], -6.4, -1.4, 1), ['inf', 7.1, 1.3], ['ifv', 7.1, 2.9], ['inf', 9, 1.3], ...squad([['inf', 2], ['tank', 1], ['aa', 1]], -1, -7.4, 1),
    ...squad([['inf', 2], ['tank', 1]], 4.4, -13.4, 1), ['inf', -2.2, -16.6], ['inf', .2, -16.6], ['tank', -1, -16.6], ['aa', -3.6, -16.6], ['inf', 1.6, -16.6],
    ['spg', -9.1, -19.5], ['spg', 7.1, -19.5], ['drone', -11, -9], ['heli', 0, -20.2], ['drone', 11, -9]],
  reinf: { every: 32, max: 3, list: [['inf', -11, -20.4], ['ifv', 11, -20.4], ['inf', 0, -20.4]] },
});

/** 2막 다른 판: 신도시 고층가(넓은 대로, 거점 4곳) */
export const NEWTOWN = makeField({
  id: 'newtown', name: '2막 · 신도시 고층가', op: 'SKYLINE-15', goal: '목표: 거점 4곳 모두 차지', theme: 'green', win: 'points', urban: true, timeLimit: 300, budget: 300,
  desc: '넓은 대로와 높은 빌딩이 늘어선 신도시예요. 대로는 트여 있어 전차가 빠르지만 적 포격도 잘 닿아요. 거점 4곳을 차지해요.',
  blocks: grid([[-14, -9.5], [-6.5, -2], [2, 6.5], [9.5, 14]], [[-21, -16], [-12.5, -7.5], [-4, 1]], [[1, 1]], 1.5),
  points: [{ name: '중앙역', x: -4.2, z: -10, r: 1.9 }, { name: '방송 센터', x: 8, z: -1.5, r: 1.8 }, { name: '대로 사거리', x: 0, z: -1.5, r: 1.9 }, { name: '금융가', x: 0, z: -14.2, r: 1.8 }],
  enemy: [...squad([['inf', 2], ['tank', 1], ['ifv', 1]], 0, -1.2, 1.1), ...squad([['inf', 2], ['tank', 1], ['aa', 1]], 8, -1.2, 1.1), ...squad([['inf', 2], ['tank', 1], ['hack', 1]], -4.2, -9.6, 1.1),
    ...squad([['inf', 2], ['tank', 1], ['aa', 1]], 0, -14, 1.1), ['spg', -8, -19.5], ['heli', -3, -19.5], ['drone', 3, -19.5]],
  reinf: { every: 35, max: 3, list: [['tank', -8, -20.4], ['inf', 8, -20.4], ['inf', 0, -20.4]] },
});

/** 3막 다른 판: 정부 청사 단지(지휘소 + 최후 저항 3번) */
export const PALACE = makeField({
  id: 'palace', name: '3막 · 정부 청사', op: 'CAPITOL-07', goal: '목표: 청사 지휘소 파괴 → 최후 저항 막기', theme: 'green', win: 'hqwaves', urban: true, timeLimit: 300, budget: 300,
  desc: '정부 청사 단지 한가운데 적 지휘소가 있어요. 지휘소를 부수면 최후 저항 부대가 세 번 몰려와요.',
  blocks: [...grid([[-14, -8], [-5.5, -2.5], [2.5, 5.5], [8, 14]], [[-21, -19], [-17, -8], [-5.5, 1.5]], [[1, 1], [2, 1]], 1.4),
    { x0: -4.2, x1: -2.6, z0: -7.6, z1: -7.1, h: .2 }, { x0: 2.6, x1: 4.2, z0: -7.6, z1: -7.1, h: .2 }],
  enemy: [['hq', 0, -13.5],
    ...squad([['tank', 1], ['ifv', 1], ['inf', 3]], 0, -9.4, 1.1), ...squad([['aa', 1], ['hack', 1], ['spg', 2]], 0, -17.2, 1.2), ['inf', -6.8, -6.5], ['tank', 6.8, -6.5],
    ['heli', -2, -18], ['drone', 2, -18]],
  waves: [
    [...squad([['tank', 1], ['ifv', 1], ['inf', 2]], -11, -6.6), ...squad([['tank', 1], ['ifv', 1], ['inf', 2]], 11, -6.6)],
    [...squad([['tank', 1], ['sf', 2], ['heli', 1]], 0, -20), ['drone', 6, -20]],
    [...squad([['tank', 2], ['inf', 2]], -11, -17.6), ...squad([['tank', 1], ['ifv', 1]], 11, -17.6)],
  ],
});

/** 임무·연습에 쓰는 큰 전장(14개) */
export const BIG_FIELDS: Stage[] = [HIGHLAND, DUNE, FROST, RAINFOREST, PLAINS, BEACHHEAD, HARBOR, NIGHTWOOD, CANYON, SUPPLY, HOSTAGE, AIRFIELD, FJORD, STRAIT];
/** 공성전 막마다 돌아가며 쓰는 판(1막 외곽 · 2막 시가전 · 3막 도심) */
export const URBAN_FIELDS: Stage[] = [OLDTOWN, NEWTOWN, PALACE];
