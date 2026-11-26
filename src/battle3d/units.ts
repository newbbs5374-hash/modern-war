// 3D 메인 전투(시험판 "철벽 작전" v5.4에서 옮겨 옴) — 병과·명령 수치. 숫자는 모두 초안.
// 화면 코드는 이 숫자를 읽기만 하고 바꾸지 않음.

/** 영역: land 땅 · sea 바다 · sub 물속 · air 하늘 */
export type Dom = 'land' | 'sea' | 'sub' | 'air';
export type Side = 'us' | 'foe';

export interface UnitDef {
  name: string;
  cost: number;
  hp: number;
  atk: number;
  def: number;
  /** 사거리(전장 칸 단위) */
  range: number;
  /** 포병 최소 사거리 */
  minR?: number;
  /** 재사용(초) */
  cd: number;
  spd: number;
  dom: Dom;
  /** 하늘 유닛 높이 */
  y?: number;
  /** 어느 영역을 얼마나 세게 때리는지(없으면 못 때림) */
  hits: Partial<Record<Dom, number>>;
  /** 몸 크기(밀어내기·고리 크기) */
  r: number;
  splash?: number;
  stealth?: boolean;
  hack?: boolean;
  kamikaze?: boolean;
  jet?: boolean;
  bomber?: boolean;
  missile?: boolean;
  carrier?: boolean;
  lha?: boolean;
  cruise?: boolean;
  aura?: boolean;
  /** 다른 병과의 모형을 빌려 씀 */
  model?: string;
}

export const DEF = {
  inf: { name: '보병', cost: 10, hp: 260, atk: 12, def: 8, range: 2.4, cd: 0.55, spd: 0.8, dom: 'land', hits: { land: 1, air: 0.4 }, r: 0.42 },
  sf: { name: '특수부대', cost: 18, hp: 240, atk: 26, def: 12, range: 2.8, cd: 0.9, spd: 1.05, dom: 'land', hits: { land: 1.2, sea: 0.3, air: 0.3 }, r: 0.38, stealth: true },
  ifv: { name: '기갑병', cost: 20, hp: 420, atk: 16, def: 40, range: 2.8, cd: 0.5, spd: 1.45, dom: 'land', hits: { land: 1, air: 0.5, sea: 0.3 }, r: 0.55 },
  hack: { name: '해킹부대', cost: 18, hp: 220, atk: 6, def: 10, range: 3.6, cd: 2.2, spd: 0.85, dom: 'land', hits: { land: 1, sea: 1, air: 1, sub: 1 }, r: 0.5, hack: true },
  tank: { name: '전차', cost: 25, hp: 640, atk: 42, def: 60, range: 3.4, cd: 1.7, spd: 1, dom: 'land', hits: { land: 1, sea: 0.6 }, r: 0.6 },
  spg: { name: '포병', cost: 28, hp: 300, atk: 56, def: 20, range: 10, minR: 2.5, cd: 4.2, spd: 0.5, dom: 'land', hits: { land: 1, sea: 0.8 }, splash: 1.2, r: 0.62 },
  aa: { name: '방공부대', cost: 18, hp: 340, atk: 12, def: 30, range: 4.6, cd: 0.35, spd: 0.9, dom: 'land', hits: { air: 3, land: 0.4 }, r: 0.58 },
  drone: { name: '무인드론', cost: 8, hp: 90, atk: 150, def: 0, range: 0.55, cd: 99, spd: 2.4, dom: 'air', y: 1.5, hits: { land: 1, sea: 1 }, kamikaze: true, splash: 0.9, r: 0.32 },
  heli: { name: '공격헬기', cost: 22, hp: 300, atk: 22, def: 10, range: 3, cd: 1.1, spd: 1.35, dom: 'air', y: 1.7, hits: { land: 1, sea: 0.8, sub: 0.7 }, r: 0.7 },
  jet: { name: '전투기', cost: 26, hp: 260, atk: 24, def: 15, range: 3.3, cd: 0.8, spd: 2.9, dom: 'air', y: 2.8, jet: true, hits: { air: 1.4, land: 0.6, sea: 0.5 }, r: 0.6 },
  bomber: { name: '폭격기', cost: 34, hp: 520, atk: 70, def: 25, range: 1.3, cd: 2.4, spd: 2.1, dom: 'air', y: 3.7, jet: true, bomber: true, splash: 1.4, hits: { land: 1, sea: 1 }, r: 0.9 },
  missile: { name: '미사일', cost: 20, hp: 60, atk: 330, def: 0, range: 0.6, cd: 99, spd: 4.4, dom: 'air', y: 2.6, missile: true, splash: 1.9, hits: { land: 1, sea: 1 }, r: 0.3 },
  dd: { name: '구축함', cost: 32, hp: 900, atk: 30, def: 45, range: 4.6, cd: 1.2, spd: 0.9, dom: 'sea', hits: { sea: 1, air: 1.2, land: 0.8, sub: 1 }, r: 0.95 },
  cv: { name: '항공모함', cost: 50, hp: 1500, atk: 10, def: 50, range: 3.5, cd: 0.6, spd: 0.5, dom: 'sea', hits: { air: 1, sea: 0.3 }, r: 1.45, carrier: true },
  sub: { name: '잠수함', cost: 30, hp: 520, atk: 70, def: 30, range: 3.8, cd: 3.2, spd: 0.8, dom: 'sub', hits: { sea: 1.3, sub: 1 }, r: 0.7 },
  lha: { name: '강습상륙함', cost: 36, hp: 1100, atk: 14, def: 40, range: 3.2, cd: 0.7, spd: 0.7, dom: 'sea', hits: { air: 0.8, land: 0.6, sea: 0.5 }, r: 1.25, lha: true },
  ssn: { name: '원자력 잠수함', cost: 42, hp: 760, atk: 80, def: 40, range: 4.2, cd: 3, spd: 1, dom: 'sub', hits: { sea: 1.3, sub: 1.2 }, r: 0.8, cruise: true },
  laser: { name: '레이저 방공함', cost: 34, hp: 950, atk: 30, def: 40, range: 5, cd: 0.25, spd: 0.8, dom: 'sea', hits: { air: 3.5, sea: 0.4 }, r: 1, aura: true },
  cvjet: { name: '함재기', cost: 0, hp: 200, atk: 20, def: 10, range: 3.2, cd: 0.8, spd: 2.8, dom: 'air', y: 2.6, jet: true, hits: { air: 1.3, land: 0.6, sea: 0.5 }, r: 0.55, model: 'jet' },
  hq: { name: '지휘소', cost: 0, hp: 3000, atk: 0, def: 40, range: 0, cd: 99, spd: 0, dom: 'land', hits: {}, r: 1.4 },
} satisfies Record<string, UnitDef>;

export type UnitKind = keyof typeof DEF;
/** 배치 카드로 고를 수 있는 병과 */
export type DeployKind = Exclude<UnitKind, 'cvjet' | 'hq'>;

export const unitDef = (k: UnitKind): UnitDef => DEF[k];

export const TABS: Array<{ id: 'land' | 'sea' | 'air'; name: string; kinds: DeployKind[] }> = [
  { id: 'land', name: '육군', kinds: ['inf', 'sf', 'ifv', 'hack', 'tank', 'spg', 'aa'] },
  { id: 'sea', name: '해군', kinds: ['dd', 'cv', 'sub', 'lha', 'ssn', 'laser'] },
  { id: 'air', name: '공군', kinds: ['drone', 'heli', 'jet', 'bomber', 'missile'] },
];

export type CmdKind = 'arty' | 'smoke' | 'air' | 'cruise' | 'emp' | 'repair' | 'para';
/** 명령 스킬: 비용(지휘력) · 범위 */
export const CMD: Record<CmdKind, { cost: number; r: number; name: string }> = {
  arty: { cost: 4, r: 1.9, name: '포격' },
  smoke: { cost: 3, r: 2.1, name: '연막' },
  air: { cost: 6, r: 1.4, name: '공습' },
  cruise: { cost: 7, r: 1.7, name: '순항 미사일' },
  emp: { cost: 4, r: 2.6, name: '전자전' },
  repair: { cost: 3, r: 2.2, name: '긴급 수리' },
  para: { cost: 5, r: 1, name: '공수 투입' },
};
export const CMD_ORDER: CmdKind[] = ['arty', 'smoke', 'air', 'cruise', 'emp', 'repair', 'para'];

/** 계산 한 번 = 0.05초(1초에 20번) */
export const TICK = 0.05;
/** 모형 크기 배율(화면 전용) */
export const SC = 0.72;
/** 지휘력: 시작 · 1초당 · 최대 */
export const CP_START = 3;
export const CP_RATE = 0.45;
export const CP_MAX = 10;
