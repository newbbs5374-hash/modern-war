// 3D 전투 계산기(시험판 "철벽 작전" v5.4에서 옮김, 수치·규칙 그대로).
// 1초에 20번(0.05초마다) 돌고, 같은 배치·같은 명령이면 항상 같은 결과가 나온다.
// 화면(view.ts)은 hooks로 알림만 받고, 체력·피해는 절대 바꾸지 않는다.

export type Dom = 'land' | 'sea' | 'sub' | 'air';
export type Side = 'us' | 'foe';
export type Kind =
  | 'inf' | 'sf' | 'ifv' | 'hack' | 'tank' | 'spg' | 'aa'
  | 'drone' | 'heli' | 'jet' | 'bomber' | 'missile'
  | 'dd' | 'cv' | 'sub' | 'lha' | 'ssn' | 'laser'
  | 'cvjet' | 'hq'
  /** 11-26 새 전장용: 무장 고속정(해적) · 무장 트럭(반군) · 지켜야 할 상선 · 지켜야 할 차량·민간인 */
  | 'boat' | 'tech' | 'cargo' | 'vip'
  /** 11-26 새 병과 10개: 탄도미사일 · 다연장로켓 · 장거리 방공 · 해안 미사일 · 정찰 무인기 · 스텔스 전투기 · 조기경보기 · 지상 공격기 · 상륙장갑차 · 바다 드론 */
  | 'bm' | 'mlrs' | 'sam' | 'csm' | 'uav' | 'f35' | 'awacs' | 'gunship' | 'aav' | 'usv'
  /** 11-28 새 병과: 공병 · 극초음속 미사일 */
  | 'eng' | 'hgv'
  /** 11-28 대잠 초계기 · 전자전기 · 군집 드론 · 대드론 레이저 차량 · 무인 전투 로봇 · 해병대 · 공중급유기 · 기뢰 부설함 */
  | 'mpa' | 'ewa' | 'swarm' | 'cuas' | 'ugv' | 'marine' | 'tanker' | 'mlay';
export type CmdKey = 'arty' | 'smoke' | 'air' | 'cruise' | 'emp' | 'repair' | 'para' | 'sat';

export interface UnitDef {
  name: string; cost: number; hp: number; atk: number; def: number; range: number; cd: number; spd: number;
  dom: Dom; hits: Partial<Record<Dom, number>>; r: number;
  y?: number; minR?: number; splash?: number; stealth?: boolean; hack?: boolean; kamikaze?: boolean; jet?: boolean;
  bomber?: boolean; missile?: boolean; carrier?: boolean; lha?: boolean; cruise?: boolean; aura?: boolean; model?: string;
  /** 11-26 다른 병과 모형을 빌려 씀(크기 배수) · 지켜야 할 대상(쓰러지면 짐) */
  look?: Kind; lookScale?: number; ally?: boolean;
  /** 11-26 새 병과: 멀리 날아가는 탄도탄(요격될 수 있음) · 로켓 일제 사격 · 날아오는 탄 요격 · 둘레 적을 드러냄 · 조기경보(둘레 공군 사거리↑, 뒤에서 돔) · 땅과 바다를 둘 다 다님 */
  ballistic?: boolean; salvo?: boolean; intercept?: boolean; spot?: boolean; awacs?: boolean; amph?: boolean;
  /** 11-28 극초음속(빨리 떨어지고 요격이 거의 안 됨) · 공병(둘레 아군 엄폐·지뢰·지휘소 벽 뚫기) */
  hyper?: boolean; engineer?: boolean;
  /** 11-28 대잠 초계기: 둘레 숨은 잠수함을 소노부이로 찾고, 잠수함에 큰 피해 */
  sonar?: boolean;
  /** 11-28 전자전기(둘레 적 멀리 쏘는 무기 −30%·적 방공 사거리↓) · 군집 드론(한 발짜리 방공에 덜 맞음) · 대드론(드론·미사일 3배) · 미끼(적이 먼저 노림) · 급유(둘레 공군 공격 빠르게) · 바다 기뢰 */
  ewar?: boolean; swarm?: boolean; antiDrone?: boolean; decoy?: boolean; refuel?: boolean; seaMines?: boolean;
}

/* ───────── 숫자(초안) ───────── */
export const DEF: Record<Kind, UnitDef> = {
  inf:   { name: '보병', cost: 10, hp: 260, atk: 12, def: 8, range: 2.4, cd: .55, spd: .8, dom: 'land', hits: { land: 1, air: .4 }, r: .42 },
  sf:    { name: '특수부대', cost: 18, hp: 240, atk: 26, def: 12, range: 2.8, cd: .9, spd: 1.05, dom: 'land', hits: { land: 1.2, sea: .3, air: .3 }, r: .38, stealth: true },
  ifv:   { name: '기갑병', cost: 20, hp: 420, atk: 16, def: 40, range: 2.8, cd: .5, spd: 1.45, dom: 'land', hits: { land: 1, air: .5, sea: .3 }, r: .55 },
  hack:  { name: '해킹부대', cost: 18, hp: 220, atk: 6, def: 10, range: 3.6, cd: 2.2, spd: .85, dom: 'land', hits: { land: 1, sea: 1, air: 1, sub: 1 }, r: .5, hack: true },
  tank:  { name: '전차', cost: 25, hp: 640, atk: 42, def: 60, range: 3.4, cd: 1.7, spd: 1, dom: 'land', hits: { land: 1, sea: .6 }, r: .6 },
  spg:   { name: '포병', cost: 28, hp: 300, atk: 56, def: 20, range: 10, minR: 2.5, cd: 4.2, spd: .5, dom: 'land', hits: { land: 1, sea: .8 }, splash: 1.2, r: .62 },
  aa:    { name: '방공부대', cost: 18, hp: 340, atk: 12, def: 30, range: 4.6, cd: .35, spd: .9, dom: 'land', hits: { air: 3, land: .4 }, r: .58 },
  drone: { name: '무인드론', cost: 8, hp: 90, atk: 150, def: 0, range: .55, cd: 99, spd: 2.4, dom: 'air', y: 1.5, hits: { land: 1, sea: 1 }, kamikaze: true, splash: .9, r: .32 },
  heli:  { name: '공격헬기', cost: 22, hp: 300, atk: 22, def: 10, range: 3, cd: 1.1, spd: 1.35, dom: 'air', y: 1.7, hits: { land: 1, sea: .8, sub: .7 }, r: .7 },
  jet:   { name: '전투기', cost: 26, hp: 260, atk: 24, def: 15, range: 3.3, cd: .8, spd: 2.9, dom: 'air', y: 2.8, jet: true, hits: { air: 1.4, land: .6, sea: .5 }, r: .6 },
  bomber: { name: '폭격기', cost: 34, hp: 520, atk: 70, def: 25, range: 1.3, cd: 2.4, spd: 2.1, dom: 'air', y: 3.7, jet: true, bomber: true, splash: 1.4, hits: { land: 1, sea: 1 }, r: .9 },
  missile: { name: '미사일', cost: 20, hp: 60, atk: 330, def: 0, range: .6, cd: 99, spd: 4.4, dom: 'air', y: 2.6, missile: true, splash: 1.9, hits: { land: 1, sea: 1 }, r: .3 },
  dd:    { name: '구축함', cost: 32, hp: 900, atk: 30, def: 45, range: 4.6, cd: 1.2, spd: .9, dom: 'sea', hits: { sea: 1, air: 1.2, land: .8, sub: 1 }, r: .95 },
  cv:    { name: '항공모함', cost: 50, hp: 1500, atk: 10, def: 50, range: 3.5, cd: .6, spd: .5, dom: 'sea', hits: { air: 1, sea: .3 }, r: 1.45, carrier: true },
  sub:   { name: '잠수함', cost: 30, hp: 520, atk: 70, def: 30, range: 3.8, cd: 3.2, spd: .8, dom: 'sub', hits: { sea: 1.3, sub: 1 }, r: .7 },
  lha:   { name: '강습상륙함', cost: 36, hp: 1100, atk: 14, def: 40, range: 3.2, cd: .7, spd: .7, dom: 'sea', hits: { air: .8, land: .6, sea: .5 }, r: 1.25, lha: true },
  ssn:   { name: '원자력 잠수함', cost: 42, hp: 760, atk: 80, def: 40, range: 4.2, cd: 3, spd: 1, dom: 'sub', hits: { sea: 1.3, sub: 1.2 }, r: .8, cruise: true },
  laser: { name: '레이저 방공함', cost: 34, hp: 950, atk: 30, def: 40, range: 5, cd: .25, spd: .8, dom: 'sea', hits: { air: 3.5, sea: .4 }, r: 1, aura: true },
  cvjet: { name: '함재기', cost: 0, hp: 200, atk: 20, def: 10, range: 3.2, cd: .8, spd: 2.8, dom: 'air', y: 2.6, jet: true, hits: { air: 1.3, land: .6, sea: .5 }, r: .55, model: 'jet' },
  hq:    { name: '지휘소', cost: 0, hp: 3000, atk: 0, def: 40, range: 0, cd: 99, spd: 0, dom: 'land', hits: {}, r: 1.4 },
  boat:  { name: '무장 고속정', cost: 12, hp: 300, atk: 15, def: 10, range: 3.2, cd: .6, spd: 1.5, dom: 'sea', hits: { sea: 1, land: .5, air: .3 }, r: .6, look: 'dd', lookScale: .55 },
  tech:  { name: '무장 트럭', cost: 10, hp: 280, atk: 14, def: 12, range: 2.8, cd: .6, spd: 1.6, dom: 'land', hits: { land: 1, air: .3 }, r: .5, look: 'ifv', lookScale: .85 },
  cargo: { name: '상선', cost: 0, hp: 1500, atk: 0, def: 30, range: 0, cd: 99, spd: .32, dom: 'sea', hits: {}, r: 1.2, look: 'lha', ally: true },
  vip:   { name: '호송 차량', cost: 0, hp: 900, atk: 0, def: 45, range: 0, cd: 99, spd: .3, dom: 'land', hits: {}, r: .6, look: 'hack', ally: true },
  // 11-26 새 병과 10개
  bm:    { name: '탄도미사일', cost: 30, hp: 280, atk: 240, def: 15, range: 30, minR: 5, cd: 16, spd: .55, dom: 'land', hits: { land: 1, sea: 1 }, splash: 1.8, r: .66, ballistic: true },
  mlrs:  { name: '다연장로켓', cost: 26, hp: 300, atk: 34, def: 18, range: 14, minR: 3, cd: 10, spd: .65, dom: 'land', hits: { land: 1, sea: .6 }, splash: .85, r: .62, salvo: true },
  sam:   { name: '장거리 방공', cost: 26, hp: 320, atk: 46, def: 25, range: 9, cd: 1.8, spd: .6, dom: 'land', hits: { air: 3 }, r: .62, intercept: true },
  csm:   { name: '해안 미사일', cost: 24, hp: 300, atk: 150, def: 20, range: 9, cd: 4, spd: .7, dom: 'land', hits: { sea: 1.3, sub: .4 }, r: .6 },
  uav:   { name: '정찰 무인기', cost: 14, hp: 200, atk: 8, def: 10, range: 3, cd: 1, spd: 1.1, dom: 'air', y: 3.2, hits: { land: .6, sea: .5 }, r: .6, spot: true },
  f35:   { name: '스텔스 전투기', cost: 32, hp: 280, atk: 30, def: 18, range: 3.4, cd: .8, spd: 3, dom: 'air', y: 2.9, jet: true, stealth: true, hits: { air: 1.5, land: .8, sea: .6 }, r: .6 },
  awacs: { name: '조기경보기', cost: 22, hp: 440, atk: 0, def: 20, range: 0, cd: 99, spd: 1.6, dom: 'air', y: 4.3, jet: true, hits: {}, r: 1, spot: true, awacs: true },
  gunship: { name: '지상 공격기', cost: 28, hp: 620, atk: 16, def: 20, range: 3.8, cd: .45, spd: 1, dom: 'air', y: 3.3, hits: { land: 1.2, sea: .6 }, r: .9 },
  aav:   { name: '상륙장갑차', cost: 18, hp: 460, atk: 15, def: 36, range: 2.8, cd: .55, spd: 1.2, dom: 'land', amph: true, hits: { land: 1, sea: .4, air: .3 }, r: .55 },
  // 11-28 새 병과 3개
  eng:   { name: '공병', cost: 16, hp: 380, atk: 10, def: 35, range: 2.6, cd: .8, spd: .9, dom: 'land', hits: { land: 1 }, r: .5, look: 'aav', lookScale: .85, engineer: true },
  hgv:   { name: '극초음속 미사일', cost: 38, hp: 240, atk: 280, def: 15, range: 34, minR: 5, cd: 18, spd: .55, dom: 'land', hits: { land: 1, sea: 1 }, splash: 1.6, r: .66, ballistic: true, hyper: true, look: 'bm', lookScale: 1.08 },
  mpa:   { name: '대잠 초계기', cost: 24, hp: 460, atk: 46, def: 20, range: 3.8, cd: 2.4, spd: 1.5, dom: 'air', y: 3.9, jet: true, hits: { sub: 2.6, sea: .7 }, r: .95, look: 'awacs', lookScale: .9, sonar: true },
  ewa:   { name: '전자전기', cost: 24, hp: 420, atk: 0, def: 20, range: 0, cd: 99, spd: 1.6, dom: 'air', y: 4.1, jet: true, hits: {}, r: .95, look: 'awacs', lookScale: .85, awacs: true, ewar: true },
  swarm: { name: '군집 드론', cost: 22, hp: 420, atk: 260, def: 0, range: .7, cd: 99, spd: 2.2, dom: 'air', y: 1.6, kamikaze: true, splash: 1.7, hits: { land: 1, sea: 1 }, r: .6, look: 'drone', swarm: true },
  cuas:  { name: '대드론 레이저 차량', cost: 20, hp: 360, atk: 22, def: 30, range: 5, cd: .22, spd: .8, dom: 'land', hits: { air: 1 }, r: .55, look: 'aa', antiDrone: true },
  ugv:   { name: '무인 전투 로봇', cost: 16, hp: 560, atk: 16, def: 48, range: 2.6, cd: .6, spd: .9, dom: 'land', hits: { land: 1, air: .2 }, r: .5, look: 'ifv', lookScale: .7, decoy: true },
  marine: { name: '해병대', cost: 14, hp: 300, atk: 16, def: 12, range: 2.6, cd: .55, spd: .95, dom: 'land', amph: true, hits: { land: 1.1, sea: .4, air: .3 }, r: .4, look: 'inf' },
  tanker: { name: '공중급유기', cost: 20, hp: 540, atk: 0, def: 25, range: 0, cd: 99, spd: 1.5, dom: 'air', y: 4.4, jet: true, hits: {}, r: 1, look: 'awacs', awacs: true, refuel: true },
  mlay:  { name: '기뢰 부설함', cost: 18, hp: 620, atk: 10, def: 30, range: 3, cd: 1.2, spd: .8, dom: 'sea', hits: { sea: .5, air: .3 }, r: .8, look: 'dd', lookScale: .7, seaMines: true },
  usv:   { name: '바다 드론', cost: 8, hp: 110, atk: 190, def: 0, range: .6, cd: 99, spd: 2.6, dom: 'sea', kamikaze: true, splash: .9, hits: { sea: 1, sub: .6 }, r: .36 },
};
/** 11-26 새 병과 10개(훈련·시험에서 씀) */
export const NEW_KINDS: Kind[] = ['bm', 'mlrs', 'sam', 'csm', 'uav', 'f35', 'awacs', 'gunship', 'aav', 'usv'];
export const TABS: Array<{ id: 'land' | 'sea' | 'air'; name: string; kinds: Kind[] }> = [
  { id: 'land', name: '육군', kinds: ['inf', 'sf', 'ifv', 'hack', 'tank', 'spg', 'aa', 'mlrs', 'bm', 'sam', 'csm', 'aav', 'eng', 'hgv', 'cuas', 'ugv', 'marine'] },
  { id: 'sea', name: '해군', kinds: ['dd', 'cv', 'sub', 'lha', 'ssn', 'laser', 'usv', 'mlay'] },
  { id: 'air', name: '공군', kinds: ['drone', 'heli', 'jet', 'bomber', 'missile', 'uav', 'f35', 'awacs', 'gunship', 'mpa', 'ewa', 'swarm', 'tanker'] },
];
export const BUDGET = 460, TICK = 0.05, FOE_MUL = 0.78, SC = .72;
/** 전투 시간 한도(초) */
export const TIME_LIMIT = 180;
export const CMD: Record<CmdKey, { cost: number; r: number; name: string }> = {
  arty: { cost: 4, r: 1.9, name: '포격' }, smoke: { cost: 3, r: 2.1, name: '연막' }, air: { cost: 6, r: 1.4, name: '공습' },
  cruise: { cost: 7, r: 1.7, name: '순항 미사일' }, emp: { cost: 4, r: 2.6, name: '전자전' }, repair: { cost: 3, r: 2.2, name: '긴급 수리' }, para: { cost: 5, r: 1, name: '공수 투입' },
  sat: { cost: 4, r: 30, name: '위성 유도' },
};
export const CMD_ORDER: CmdKey[] = ['arty', 'smoke', 'air', 'cruise', 'emp', 'repair', 'para', 'sat'];
/** 전장 넓이(기본 = 시험판 해안 전장). 11-26: 큰 전장은 Stage.field로 넓힘(useStage가 바꿈) */
export const FIELD0 = { xMin: -10, xMax: 10, zTop: -15, zBot: 14 };
export let FIELD = FIELD0;
export type Place = [Kind, number, number];
export const ENEMY: Place[] = [['hq', 5, -13],
  ['tank', 2.2, -8.8], ['tank', 4.6, -8.6], ['tank', 7, -8.8], ['inf', 1, -7.6], ['inf', 3.4, -7.4], ['inf', 6, -7.6], ['sf', 8.4, -7.8], ['ifv', 3.4, -9.8], ['ifv', 6.2, -10],
  ['hack', 8.2, -11], ['spg', 2.6, -12], ['spg', 7.2, -12.2], ['aa', 3.6, -11.4], ['aa', 6.4, -11.6],
  ['dd', -5.8, -9.6], ['dd', -8.2, -8.2], ['sub', -6.6, -7.2], ['cv', -8, -12.2], ['laser', -5.6, -11.8], ['lha', -4.6, -8.2],
  ['drone', 1.4, -10.4], ['drone', 8.6, -10.2], ['heli', 2, -10.8], ['jet', 5, -10.8], ['bomber', -2, -12.6]];
export const DEFAULT: Place[] = [['tank', 1.6, 9.8], ['tank', 4.4, 9.8], ['tank', 7.2, 9.8], ['inf', .2, 9.8], ['inf', 3, 9.8], ['sf', 8.6, 9.8], ['ifv', 3, 11.2], ['ifv', 6, 11.2], ['hack', 8.6, 11.2], ['spg', 1.6, 12.6], ['spg', 6, 12.6], ['aa', 3, 12.6], ['aa', 7.2, 12.6],
  ['dd', -5.6, 9.6], ['dd', -8.6, 9.6], ['sub', -7.1, 9.6], ['cv', -7.1, 12.6], ['laser', -5.6, 11.1], ['lha', -8.6, 11.1],
  ['jet', 4.4, 11.2], ['heli', 1.6, 11.2], ['bomber', -4.1, 12.6], ['drone', .2, 11.2], ['drone', 8.6, 12.6], ['missile', .2, 12.6]];

/* ───────── 전장(막마다 바뀜) ───────── */
/** 건물 덩어리(위에서 본 네모). 땅 부대는 못 지나가고, 붙어 있으면 덜 맞음 */
export interface Block { x0: number; x1: number; z0: number; z1: number; h?: number; /** 11-26 rock = 바위 절벽(건물 대신) */ rock?: boolean }
/** 거점: 원 안에 우리 땅 부대만 있으면 조금씩 차지함 */
export interface PointDef { name: string; x: number; z: number; r: number }
export interface Stage {
  /** coast·street·core = 공성전, 그 밖(drill-…) = 훈련 전장 */
  id: string;
  name: string; op: string; goal: string;
  coastX(z: number): number; riverZ(x: number): number; bridges: number[];
  hAt(x: number, z: number): number;
  enemy: Place[]; timeLimit: number;
  /** 칠 대상이 없을 때 우리 땅 부대가 가는 곳 */
  usGoal: { x: number; z: number };
  urban?: boolean; blocks?: Block[]; points?: PointDef[];
  /** 지휘소가 무너지면 몰려오는 최후 저항 */
  waves?: Place[][];
  /** 적이 거점을 하나라도 쥐고 있으면 every초마다 증원(최대 max번) */
  reinf?: { every: number; max: number; list: Place[] };
  /** 11-26 훈련 전장(drill-…): 끝 규칙 · 매 계산 할 일 · 쓸 수 있는 명령 · 배치 카드 · 지휘력 차는 빠르기 · 적이 갈 곳 · 처음 시점 */
  drill?: boolean;
  rule?(S: Sim): 'win' | 'lose' | 'time' | null;
  setup?(S: Sim): void;
  tick?(S: Sim): void;
  cmds?: CmdKey[]; kinds?: Kind[]; cpRate?: number; foeGoal?: { x: number; z: number };
  cam?: { tx?: number; tz?: number; dist?: number; pitch?: number };
  /** 11-26 큰 전장: 넓이 · 생김새(풀밭·사막·눈·밀림·밤·바다…) · 이기는 조건 · 우리 편 지킬 대상 · 지킬 대상이 갈 곳 · 적이 처음부터 몰려옴 · 기본 배치 · 예산 · 소개 글 */
  field?: { xMin: number; xMax: number; zTop: number; zBot: number };
  theme?: Theme;
  win?: WinRule;
  allies?: Place[]; allyGoal?: { x: number; z: number };
  foeAggr?: boolean;
  deploy?: Place[]; budget?: number; desc?: string;
  /** 정해진 시각(초)에 몰려오는 적(버티기·습격) */
  timed?: Array<{ at: number; list: Place[]; msg?: string }>;
  /** 화면 꾸미기: 길(점 목록) · 숲 무리 · 산 */
  roads?: Array<Array<[number, number]>>; woods?: Array<[number, number, number]>; hills?: Array<[number, number, number, number]>;
}
/** 생김새 */
export type Theme = 'green' | 'desert' | 'snow' | 'jungle' | 'night' | 'steppe' | 'ocean' | 'arctic' | 'dusk' | 'rock';
/** 이기는 조건: hq = 지휘소 파괴 · points = 거점 모두 · all = 적 모두 · hqwaves = 지휘소 → 최후 저항 → 남은 적 · survive = 시간까지 버티기 · escort = 지킬 대상이 목적지 도착 */
export type WinRule = 'hq' | 'points' | 'all' | 'hqwaves' | 'survive' | 'escort';
export const winOf = (st: Stage): WinRule => st.win ?? (st.id === 'coast' ? 'hq' : st.id === 'street' ? 'points' : 'hqwaves');

function coastXC(z: number) { return -3.2 + Math.sin(z * .22) * 1.1 + Math.sin(z * .61 + 1) * .35; }
function riverZC(x: number) { return 0.6 + Math.sin(x * .5) * .8; }
function hAtC(x: number, z: number) {
  let h = .24 + Math.sin(x * .45 + z * .2) * .17 + Math.sin(z * .37 - x * .18) * .15 + Math.sin(x * 1.3) * Math.cos(z * 1.1) * .06;
  const edge = Math.max(0, x - 8.6); h += edge * edge * .2;
  if (z < -10.5 && x > 1 && x < 9) h *= .25; // 적 기지 평탄
  const d = x - coastXC(z); // 해안까지 거리(+땅, -바다)
  if (d < 1.2) { const k = Math.max(0, d) / 1.2; h = h * k + .06 * (1 - k); } // 해변
  if (d < 0) h = .06 + d * .75; // 바닷속으로 내려감
  if (d > 0) { const riv = Math.abs(z - riverZC(x)); if (riv < .9) h = Math.min(h, -.28 + riv * .4); }
  return Math.max(h, -1.8);
}
/** 1막 외곽: 시험판 해안 전장 그대로 */
export const COAST: Stage = {
  id: 'coast', name: '1막 · 외곽', op: 'COASTLINE-05', goal: '목표: 외곽 지휘소 파괴',
  desc: '바다와 강이 있는 해안 들판이에요. 육군·해군·공군이 함께 싸워요. 외곽 지휘소를 부수면 이겨요.',
  coastX: coastXC, riverZ: riverZC, bridges: [1.6, 6.2], hAt: hAtC, enemy: ENEMY, timeLimit: TIME_LIMIT, usGoal: { x: 5, z: -12 },
};
/** 지금 쓰는 전장(배치할 때 정함) */
export let ST: Stage = COAST;
export let BRIDGES = ST.bridges;
export function coastX(z: number) { return ST.coastX(z); }
export function riverZ(x: number) { return ST.riverZ(x); }
export function isSea(x: number, z: number, m?: number) { return x < coastX(z) - (m || 0); }
export const WATER_Y = -.12;
export function hAt(x: number, z: number) { return ST.hAt(x, z); }
export function groundY(x: number, z: number) { return Math.max(hAt(x, z), WATER_Y); }
export function angDiff(b: number, a: number) { return ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }
export function inBlock(x: number, z: number, m = 0) { return (ST.blocks ?? []).find((b) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m); }

/* ───────── 배치 칸 (땅 칸 · 바다 칸) ───────── */
export interface Tile { x: number; z: number; dom: 'land' | 'sea' }
function makeTiles(): Tile[] {
  const out: Tile[] = [];
  const cols = 13 + Math.round((FIELD.xMax - FIELD.xMin - 20) / 1.5), x0 = (FIELD.xMin + FIELD.xMax) / 2 - 9.6 - Math.round((FIELD.xMax - FIELD.xMin - 20) / 1.5) * .75;
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + 1 + c * 1.5, z = FIELD.zBot - 4.2 + r * 1.4, cx = coastX(z);
    const dom = x < cx - .75 ? 'sea' : x > cx + .65 ? 'land' : null; if (!dom) continue;
    if (inBlock(x, z, .3)) continue;
    out.push({ x, z, dom });
  }
  return out;
}
export let TILES: Tile[] = makeTiles();
/** 전장 바꾸기(배치 전에 부름) */
export function useStage(st: Stage) { ST = st; FIELD = st.field ?? FIELD0; BRIDGES = st.bridges; TILES = makeTiles(); }
export function tileOk(t: Tile, kind: Kind) { const dm = DEF[kind].dom; return dm === 'air' || !!DEF[kind].amph || (dm === 'sub' ? 'sea' : dm) === t.dom; }

/* ───────── 전투 상태 ───────── */
export interface Unit {
  id: number; kind: Kind; side: Side; d: UnitDef; hp: number; max: number; x: number; z: number;
  cd: number; cd2: number; spawnCd: number; tgt: Unit | null; alive: boolean; deadT: number; jam: number; kids: number;
  hd: number; launchAt?: number; waitT?: number; mom?: Unit; aim?: number; moving?: boolean; moveFace?: number; flying?: boolean; bank?: number;
  hitT?: number; healT?: number; mineT?: number;
  /** 시가전·도심: 지키는 자리(적) · 끝까지 쫓아가는 부대(최후 저항) */
  home?: { x: number; z: number }; aggr?: boolean;
  /** 앞 막에서 넘어온 부대 */
  carried?: boolean;
  /** 11-26 훈련: 이 부대만 가는 곳 · 숨어 있음(화면에 안 보임, 찾으면 보임) · 공격 배수(병과 숙련) */
  goal?: { x: number; z: number }; hidden?: boolean; buff?: number; /** 11-27 적 나라 특별 병과 */ special?: boolean;
  /** 제자리 지키기(goal에 서서 쏨) · 이 병과만 노림 */
  hold?: boolean; only?: Kind;
  /** 11-26 조기경보기 둘레면 사거리 배수(1초마다 다시 셈) */
  rk?: number;
  /** 화면 연출용(계산에는 안 씀): 마지막 사격 · 순항 미사일 */
  visFire?: VisFire | null; visCruise?: { x: number; z: number } | null;
  /** 화면이 붙이는 모형(계산에는 안 씀) */
  [view: string]: unknown;
}
export interface VisFire { kind: Kind; tx: number; tz: number; tgt?: Unit; air?: boolean; fly?: number }
export type Phase = 'deploy' | 'battle' | 'aim' | 'end';
/** 화면에 보내는 연출 신호(계산에는 영향 없음) */
export type SimEvent =
  | { type: 'boom'; x: number; z: number; size: number }
  | { type: 'landing'; ship: Unit; unit: Unit }
  | { type: 'arty'; x: number; z: number; delay: number }
  | { type: 'smoke'; x: number; z: number; r: number }
  | { type: 'airstrike'; x: number; z: number }
  | { type: 'cruise'; x: number; z: number }
  | { type: 'emp'; x: number; z: number; r: number }
  | { type: 'repair'; x: number; z: number; r: number }
  | { type: 'para'; x: number; z: number }
  | { type: 'point'; name: string; own: Side; x: number; z: number }
  | { type: 'reinf'; n: number }
  | { type: 'wave'; n: number; of: number }
  /** 11-26 탄도탄: 떨어질 곳 경고 · 공중 요격 */
  | { type: 'warn'; x: number; z: number; t: number; side: Side }
  | { type: 'intercept'; x: number; z: number; by: Kind };
export interface SimHooks {
  spawn?(u: Unit): void;
  death?(u: Unit, src?: Unit | null): void;
  log?(msg: string, cls: 'k' | 'x' | 'c' | ''): void;
  event?(e: SimEvent): void;
  end?(win: boolean, timeout: boolean): void;
}
export interface Sim {
  units: Unit[]; phase: Phase; simT: number; cp: number; nid: number; seed: number;
  pending: Array<{ at: number; fn: () => void }>; smokes: Array<{ x: number; z: number; r: number; end: number }>;
  result: { win: boolean; timeout: boolean; t: number } | null;
  hooks: SimHooks;
  /** 거점(own=지금 주인, prog=우리 쪽으로 차지한 정도 0~1) */
  pts: Array<PointDef & { own: Side; prog: number }>;
  /** 최후 저항: 나온 파도 수 · 마지막 파도 시각 · 증원 횟수 */
  wave: number; waveT: number; reinfN: number; reinfT: number;
  /** 적 체력 배수(난이도) */
  foeHp: number;
  foeBuff?: Partial<Record<Kind, number>>;
  /** 적 병과별 나온 수(특별 병과는 그중 몇 대마다 한 대) */
  foeN?: Partial<Record<Kind, number>>;
  /** 11-26 훈련: 집중 사격 대상(누른 적) · 훈련이 쓰는 숫자들 */
  focus?: number; drill?: Record<string, number>;
  /** 11-26 정해진 시각 증원이 몇 번 나왔나 */
  tn?: number;
  /** 11-28 공병이 묻은 지뢰(보이지 않음, 적 땅 부대가 밟으면 터짐) */
  mines?: Array<{ x: number; z: number; side: Side; by: number; sea?: boolean }>;
  /** 11-28 우주군: 정찰 위성 수(있으면 시작 때 적 배치 공개 + 「위성 유도」 명령) · 위성 유도가 끝나는 때 */
  sat?: number; satT?: number;
}

export function createSim(hooks: SimHooks = {}): Sim {
  return { units: [], phase: 'deploy', simT: 0, cp: 3, nid: 1, seed: 1, pending: [], smokes: [], result: null, hooks, pts: [], wave: 0, waveT: 0, reinfN: 0, reinfT: 0, foeHp: 1 };
}
export function rnd(S: Sim) { S.seed = (S.seed * 1664525 + 1013904223) >>> 0; return S.seed / 4294967296; }
const SURF: Dom[] = ['land', 'sea'];
const nm = (u: Unit) => (u.side === 'us' ? '아군' : '적');

export function makeUnit(S: Sim, kind: Kind, side: Side, x: number, z: number): Unit {
  const d = DEF[kind];
  const u: Unit = { id: S.nid++, kind, side, d, hp: d.hp, max: d.hp, x, z, cd: rnd(S) * Math.min(d.cd, 3), cd2: 4 + rnd(S) * 3, spawnCd: 6 + rnd(S) * 4, tgt: null, alive: true, deadT: 0, jam: 0, kids: 0, hd: side === 'us' ? Math.PI : 0 };
  if (d.missile) u.launchAt = 1.5 + rnd(S) * 1.5;
  S.units.push(u);
  S.hooks.spawn?.(u);
  return u;
}
export function removeUnit(S: Sim, u: Unit) { S.units = S.units.filter((o) => o !== u); }
export const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const hitMul = (u: Unit, t: Unit) => u.d.hits[t.d.dom] || 0;
const inSmoke = (S: Sim, u: Unit) => S.smokes.some((s) => Math.hypot(s.x - u.x, s.z - u.z) < s.r);
/** 11-26 정찰 무인기·조기경보기가 이 부대를 보고 있나(by 편의 눈) */
export const spotted = (S: Sim, t: { x: number; z: number }, by: Side) => S.units.some((o) => o.alive && o.side === by && o.d.spot && dist(o, t) < (o.d.awacs ? 7 : 5));
/** 11-26 날아오는 탄도탄을 막는 부대(x,z에 떨어질 탄, side = 막는 편). 없으면 null */
function interceptor(S: Sim, x: number, z: number, side: Side, odds = 1): Unit | null {
  const eye = S.units.some((o) => o.alive && o.side === side && o.d.awacs) ? .1 : 0;
  for (const o of S.units) {
    if (!o.alive || o.side !== side || o.jam > S.simT) continue;
    const q = Math.hypot(o.x - x, o.z - z);
    const p = o.d.intercept ? (q < 10 ? .55 : 0) : o.d.aura ? (q < 6 ? .45 : 0) : o.d.antiDrone ? (q < 5 ? .3 : 0) : o.kind === 'dd' ? (q < 6 ? .2 : 0) : o.kind === 'aa' ? (q < 4 ? .2 : 0) : 0;
    if (p && rnd(S) < (p + eye) * odds) return o;
  }
  return null;
}

export function damage(S: Sim, t: Unit, amt: number, src: Unit | null) {
  if (!t.alive) return;
  let a = amt * 100 / (100 + t.d.def) * (src && src.side === 'foe' ? FOE_MUL : 1) * (src?.buff ?? 1);
  if (inSmoke(S, t)) a *= .4;
  if (S.units.some((o) => o.alive && o.d.aura && o.side === t.side && o !== t && dist(o, t) < 2.4)) a *= .7; // 레이저 방공함 보호막
  if (t.d.dom === 'land' && S.units.some((o) => o.alive && o.d.engineer && o.side === t.side && dist(o, t) < 2.2)) a *= .82; // 11-28 공병 모래주머니·참호
  if (ST.blocks && t.d.dom === 'land' && inBlock(t.x, t.z, t.d.r * .6 + .55)) a *= .75; // 건물에 붙으면 엄폐
  if (t.d.swarm && src && !src.d.antiDrone && !src.d.aura && src.d.cd < 2) a *= .45; // 11-28 군집 드론: 한 발씩 쏘는 방공으로는 다 못 막음
  if (src && (src.d.range >= 5 || src.d.missile || src.d.cruise) && S.units.some((o) => o.alive && o.d.ewar && o.side !== src.side && dist(o, src) < 5.5)) a *= .7; // 11-28 전자전기 교란
  if (src && src.side === 'us' && (S.satT ?? 0) > S.simT) a *= 1.25; // 11-28 위성 유도
  t.hp -= a; t.hitT = S.simT;
  if (t.hp <= 0) { t.hp = 0; t.alive = false; t.deadT = 0; onDeath(S, t, src); }
}
function splash(S: Sim, x: number, z: number, r: number, amt: number, side: Side | null, src: Unit | null, doms?: Dom[]) {
  S.units.forEach((t) => { if (!t.alive || (side && t.side === side)) return; if (doms && !doms.includes(t.d.dom)) return; const dd = Math.hypot(t.x - x, t.z - z); if (dd < r) damage(S, t, amt * (1 - dd / r * .5), src); });
}
function onDeath(S: Sim, t: Unit, src?: Unit | null) {
  if (!(t.d.missile || t.d.kamikaze)) {
    const who = (t.side === 'us' ? '아군 ' : '적 ') + t.d.name;
    S.hooks.log?.(t.side === 'us' ? `${who} 손실` : `${who} 격파`, t.side === 'us' ? 'x' : 'k');
  }
  S.hooks.death?.(t, src);
}
function goalFor(S: Sim, u: Unit) { // 칠 대상이 없을 때 향할 곳
  if (u.goal) return u.goal;
  if (u.d.sonar) { // 11-28 대잠 초계기: 적 잠수함이 있는 바다를 훑음(숨어 있어도 그쪽 바다로)
    let b: Unit | null = null;
    for (const o of S.units) if (o.alive && o.side !== u.side && o.d.dom === 'sub' && (!b || dist(u, o) < dist(u, b))) b = o;
    if (b) return { x: b.x + Math.sin(S.simT * .7 + u.id) * 1.2, z: b.z + Math.cos(S.simT * .7 + u.id) * 1.2 };
  }
  if (ST.drill) return u.side === 'us' ? ST.usGoal : ST.foeGoal ?? u.home ?? { x: u.x, z: u.z };
  if (ST.id !== 'coast') {
    if (u.side === 'foe') {
      // 빼앗긴 거점이 가까우면 되찾으러 감, 아니면 제자리 지킴
      if (!u.aggr) for (const p of S.pts) if (p.own === 'us' && dist(u, p) < 7) return { x: p.x, z: p.z };
      if (u.aggr || !u.home) { const a = S.units.find((o) => o.alive && o.d.ally); return a ? { x: a.x, z: a.z } : ST.foeGoal ?? { x: (FIELD.xMin + FIELD.xMax) / 2, z: FIELD.zBot - 3 }; }
      return u.home;
    }
    const open = S.pts.filter((p) => p.own === 'foe');
    if (open.length) { let b = open[0]; for (const p of open) if (dist(u, p) < dist(u, b)) b = p; return { x: b.x, z: b.z }; }
    const hq = S.units.find((o) => o.kind === 'hq' && o.alive);
    if (hq) return { x: hq.x, z: hq.z + 1.6 };
    if (winOf(ST) === 'escort' || winOf(ST) === 'survive') { const a = S.units.find((o) => o.alive && o.d.ally); if (a) return { x: a.x + (u.id % 3 - 1) * 1.2, z: a.z - 1.5 }; }
    let best: Unit | null = null;
    for (const o of S.units) if (o.alive && o.side === 'foe' && (!best || dist(u, o) < dist(u, best))) best = o;
    return best ? { x: best.x, z: best.z } : ST.usGoal;
  }
  if (u.side === 'us') return u.d.dom === 'sea' || u.d.dom === 'sub' ? { x: Math.min(u.x, coastX(-10) - 1.5), z: -10 } : { x: 5, z: -12 };
  return u.d.dom === 'sea' || u.d.dom === 'sub' ? { x: Math.min(u.x, coastX(10) - 1.5), z: 10 } : { x: 4, z: 11 };
}
function clampDomain(u: Unit) {
  u.x = Math.max(FIELD.xMin + .4, Math.min(FIELD.xMax - .4, u.x)); u.z = Math.max(FIELD.zTop + .3, Math.min(FIELD.zBot - .3, u.z));
  if (u.d.dom === 'land' && !u.d.amph) { const m = coastX(u.z) + .35; if (u.x < m) u.x = m; }
  else if (u.d.dom === 'sea' || u.d.dom === 'sub') { const m = coastX(u.z) - (u.d.r * .55 + .35); if (u.x > m) u.x = m; }
  if (ST.blocks && u.d.dom === 'land') {
    const m = u.d.r * .55; const b = inBlock(u.x, u.z, m);
    if (b) { // 가장 가까운 벽 밖으로 밀어냄
      const dx0 = u.x - (b.x0 - m), dx1 = b.x1 + m - u.x, dz0 = u.z - (b.z0 - m), dz1 = b.z1 + m - u.z, k = Math.min(dx0, dx1, dz0, dz1);
      if (k === dx0) u.x = b.x0 - m; else if (k === dx1) u.x = b.x1 + m; else if (k === dz0) u.z = b.z0 - m; else u.z = b.z1 + m;
    }
  }
}
/** 건물 앞에서 벽을 따라 돌아가기: 막히는 쪽 힘을 빼고, 목표에 가까운 모서리 쪽으로 */
function steer(u: Unit, vx: number, vz: number, gx: number, gz: number): [number, number] {
  if (!ST.blocks || u.d.dom !== 'land') return [vx, vz];
  const m = u.d.r * .55 + .05, L = Math.hypot(vx, vz) || 1;
  const nx = u.x + vx / L * .7, nz = u.z + vz / L * .7;
  const b = inBlock(nx, nz, m); if (!b) return [vx, vz];
  const x0 = b.x0 - m, x1 = b.x1 + m, z0 = b.z0 - m, z1 = b.z1 + m;
  const around = (p: number, lo: number, hi: number, g: number) => (Math.abs(p - lo) + Math.abs(g - lo) <= Math.abs(p - hi) + Math.abs(g - hi) ? -1 : 1);
  if (u.x <= x0 + .02 || u.x >= x1 - .02) { vx = 0; vz = Math.abs(vz) < .35 * L ? around(u.z, z0, z1, gz) * L : vz; }
  else { vz = 0; vx = Math.abs(vx) < .35 * L ? around(u.x, x0, x1, gx) * L : vx; }
  return [vx, vz];
}

/** 배치 화면 준비: 적을 놓고(같은 순서·같은 난수), 우리 배치 목록을 다시 놓음 */
export interface DeployOpt { /** 11-28 정찰 위성 수 */ sat?: number; cp0?: number; foeHp?: number; /** 11-26 병과 숙련: 우리 병과별 체력·공격 배수 */ usBuff?: Partial<Record<Kind, number>>; /** 11-27 적 나라 특별 병과: 적 병과별 체력·공격 배수 */ foeBuff?: Partial<Record<Kind, number>> }
/** 우리 배치 한 칸. hp = 앞 막에서 남은 체력 비율, carried = 앞 막에서 넘어온 부대 */
export interface Pick3 { kind: Kind; tile: number; hp?: number; carried?: boolean; /** 11-26 훈련: 칸 대신 이 자리에 · 갈 곳 · 제자리 지키기 */ at?: [number, number]; goal?: { x: number; z: number }; hold?: boolean }
export function setupDeploy(S: Sim, mine: Pick3[], opt: DeployOpt = {}): Unit[] {
  S.units = []; S.pending = []; S.smokes = []; S.result = null;
  S.seed = 7; S.nid = 1; S.simT = 0; S.cp = Math.min(10, opt.cp0 ?? 3); S.phase = 'deploy';
  S.foeHp = opt.foeHp ?? 1; S.foeBuff = opt.foeBuff; S.foeN = {}; S.sat = opt.sat || 0; S.satT = 0; S.mines = [];
  // 11-27 적 특별 병과가 세진 만큼 나머지 적은 조금 약하게(밸런스 4~5주 유지)
  if (opt.foeBuff && Object.keys(opt.foeBuff).length) S.foeHp *= FOE_SPECIAL_REST; S.wave = 0; S.waveT = 0; S.reinfN = 0; S.reinfT = 0;
  S.pts = (ST.points ?? []).map((p) => ({ ...p, own: 'foe' as Side, prog: 0 })); S.tn = 0;
  ST.enemy.forEach(([k, x, z]) => { const d = DEF[k]; if (d.dom === 'sea' || d.dom === 'sub') x = Math.min(x, coastX(z) - d.r * .55 - .5); if (d.dom === 'land') x = Math.max(x, coastX(z) + .6); spawnFoe(S, k, x, z, false); });
  const out = mine.map((d) => {
    const t = d.at ? { x: d.at[0], z: d.at[1] } : TILES[d.tile]; const u = makeUnit(S, d.kind, 'us', t.x, t.z);
    const b = opt.usBuff?.[d.kind]; if (b && b !== 1) { u.buff = b; u.max = Math.round(u.max * b); u.hp = u.max; }
    if (d.hp != null && d.hp < 1) u.hp = Math.max(1, Math.round(u.max * d.hp)); if (d.carried) u.carried = true; if (d.goal) u.goal = d.goal; if (d.hold) u.hold = true; return u;
  });
  for (const [k, x, z] of ST.allies ?? []) { const a = makeUnit(S, k, 'us', x, z); a.goal = ST.allyGoal ?? { x, z }; if (!ST.allyGoal) a.hold = true; }
  ST.setup?.(S);
  return out;
}
/** 적 나라 특별 병과 비율: 그 병과 N대 중 1대(1이면 모두) */
export let FOE_SPECIAL_EVERY = 3;
/** 적 특별 병과가 있을 때 나머지 적 체력 배수 */
export let FOE_SPECIAL_REST = 0.96;
export const setFoeSpecialRest = (v: number) => { FOE_SPECIAL_REST = v; };
export const setFoeSpecialEvery = (n: number) => { FOE_SPECIAL_EVERY = Math.max(1, Math.round(n)); };
export function spawnFoe(S: Sim, k: Kind, x: number, z: number, aggr: boolean) {
  const u = makeUnit(S, k, 'foe', x, z);
  if (S.foeHp !== 1) { u.max = Math.round(u.max * S.foeHp); u.hp = u.max; }
  // 11-27 적 나라 특별 병과: 그 병과 적 FOE_SPECIAL_EVERY대 중 1대가 특별 병과(체력·공격 ×1.3)
  const fb = S.foeBuff?.[k];
  if (fb && fb !== 1) { const i = (S.foeN ??= {})[k] = ((S.foeN[k] ?? 0) + 1); if (i % FOE_SPECIAL_EVERY === 1 || FOE_SPECIAL_EVERY === 1) { u.buff = fb; u.max = Math.round(u.max * fb); u.hp = u.max; u.special = true; } }
  if (ST.id !== 'coast') { u.home = { x, z }; if (aggr || ST.foeAggr) u.aggr = true; }
  return u;
}
/** 기본 배치(예산 안에서 가까운 칸) */
export function defaultDeploy(): Array<{ kind: Kind; tile: number }> {
  const out: Array<{ kind: Kind; tile: number }> = [];
  const spent = () => out.reduce((s, d) => s + DEF[d.kind].cost, 0);
  for (const [kind, x, z] of DEFAULT) {
    const i = nearestTile(out, kind, x, z);
    if (i < 0 || spent() + DEF[kind].cost > BUDGET) continue;
    out.push({ kind, tile: i });
  }
  return out;
}
/** 11-26 어느 전장이든 기본 배치: 전장의 deploy 목록 → 남은 예산은 쓸 수 있는 병과로 채움 */
export function autoDeploy(budget = ST.budget ?? BUDGET): Array<{ kind: Kind; tile: number }> {
  if (ST.id === 'coast' && budget === BUDGET) return defaultDeploy();
  const out: Array<{ kind: Kind; tile: number }> = [];
  let spent = 0;
  const ok = (k: Kind) => !ST.kinds || ST.kinds.includes(k);
  const add = (kind: Kind, x: number, z: number) => {
    if (!ok(kind) || spent + DEF[kind].cost > budget) return false;
    const i = nearestTile(out, kind, x, z); if (i < 0) return false;
    out.push({ kind, tile: i }); spent += DEF[kind].cost; return true;
  };
  const zb = FIELD.zBot, cx = (FIELD.xMin + FIELD.xMax) / 2;
  for (const [kind, x, z] of ST.deploy ?? DEFAULT.map(([k, x, z]) => [k, x + cx, z - 14 + zb] as Place)) add(kind, x, z);
  const fill: Kind[] = ['tank', 'inf', 'ifv', 'aa', 'spg', 'dd', 'jet', 'heli', 'sf', 'sub', 'tank', 'drone', 'inf', 'laser', 'jet'];
  for (let n = 0, i = 0; n < 60 && budget - spent >= 8; n++, i++) add(fill[i % fill.length], cx + ((i * 3.7) % 16) - 8, zb - 3.6 + (i % 3) * 1.3);
  return out;
}
export function nearestTile(taken: Array<{ tile: number }>, kind: Kind, x: number, z: number) {
  let best = -1, bd = 1e9;
  TILES.forEach((t, i) => { if (!tileOk(t, kind) || taken.some((d) => d.tile === i)) return; const q = Math.hypot(t.x - x, t.z - z); if (q < bd) { bd = q; best = i; } });
  return best;
}
export function startBattle(S: Sim) {
  S.seed = 11; S.phase = 'battle'; S.simT = 0;
  S.hooks.log?.('작전 개시 · 육해공 동시 진격', 'c');
  if (S.sat) { // 11-28 우주군: 위성 사진으로 숨은 적 배치를 미리 봄
    let n = 0; for (const u of S.units) if (u.side === 'foe' && u.hidden && !u.d.ally) { u.hidden = false; n++; }
    S.hooks.log?.(`🛰️ 정찰 위성 ${S.sat}기가 적 배치를 찍었어요${n ? ` · 숨은 적 ${n} 공개` : ''}`, 'c');
  }
}

/** 20Hz 계산 한 번 */
export function step(S: Sim) {
  S.simT += TICK;
  S.cp = Math.min(10, S.cp + TICK * (ST.cpRate ?? .45));
  ST.tick?.(S);
  for (let i = S.pending.length - 1; i >= 0; i--) { const e = S.pending[i]; if (S.simT >= e.at) { S.pending.splice(i, 1); e.fn(); } }
  for (let i = S.smokes.length - 1; i >= 0; i--) { if (S.simT > S.smokes[i].end) S.smokes.splice(i, 1); }
  if (S.mines?.length) for (let i = S.mines.length - 1; i >= 0; i--) { // 11-28 지뢰
    const m = S.mines[i];
    const hit = S.units.find((t) => t.alive && t.side !== m.side && !t.d.ally && (m.sea ? t.d.dom === 'sea' || t.d.dom === 'sub' : t.d.dom === 'land') && Math.hypot(t.x - m.x, t.z - m.z) < (m.sea ? .9 : .7));
    if (!hit) continue;
    S.mines.splice(i, 1);
    const by = S.units.find((o) => o.id === m.by) ?? null;
    if (m.sea) splash(S, m.x, m.z, 1.3, 220, m.side, by, ['sea', 'sub']); else splash(S, m.x, m.z, 1.1, 110, m.side, by, ['land']);
    S.hooks.event?.({ type: 'boom', x: m.x, z: m.z, size: 1.2 });
    S.hooks.log?.(`${m.side === 'us' ? '우리' : '적'} ${m.sea ? '기뢰' : '지뢰'}가 터졌어요`, m.side === 'us' ? 'k' : 'x');
  }
  const list = S.units.slice();
  for (const u of list) {
    if (!u.alive || u.kind === 'hq') continue;
    if (u.waitT && S.simT < u.waitT) continue;
    const jam = u.jam > S.simT;
    // 목표 고르기(1초마다)
    if (!u.tgt || !u.tgt.alive || ((S.simT * 20 | 0) % 20 === u.id % 20)) {
      let best: Unit | null = null, bd = 1e9;
      const leash = leashOf(S, u);
      // 11-26 조기경보기 둘레 공군은 사거리 +15% · 정찰기는 둘레 숨은 적을 드러냄
      u.rk = u.d.dom === 'air' && !u.d.awacs && S.units.some((o) => o.alive && o.side === u.side && o.d.awacs && !o.d.ewar && !o.d.refuel && dist(o, u) < 6) ? 1.15 : 1;
      if ((u.kind === 'aa' || u.d.intercept || u.d.antiDrone) && S.units.some((o) => o.alive && o.d.ewar && o.side !== u.side && dist(o, u) < 6)) u.rk *= .8; // 11-28 전자전기: 적 방공 레이더 교란
      if (u.d.sonar) for (const o of S.units) if (o.hidden && o.alive && o.side !== u.side && o.d.dom === 'sub' && dist(o, u) < 5.5) { o.hidden = false; S.hooks.log?.(`${u.d.name} 소노부이가 숨은 ${o.d.name}을 찾았어요`, u.side === 'us' ? 'k' : 'x'); }
      if (u.d.spot) for (const o of S.units) if (o.hidden && o.alive && o.side !== u.side && dist(o, u) < 3.5) { o.hidden = false; S.hooks.log?.(`${u.d.name}이 숨은 ${o.d.name}을 찾았어요`, u.side === 'us' ? 'k' : 'x'); }
      for (const t of S.units) {
        if (!t.alive || t.side === u.side || t.hidden || (u.only && t.kind !== u.only)) continue; if (!hitMul(u, t)) continue;
        if (leash && dist(u, t) > leash) continue;
        const seen = !t.d.stealth || spotted(S, t, u.side);
        // 스텔스 비행기는 아주 가까이 오거나 우리 눈(정찰기·조기경보기)이 볼 때만 잡힘
        if (!seen && t.d.dom === 'air' && dist(u, t) > u.d.range * .55) continue;
        let dd = dist(u, t); if (t.id === S.focus && u.side === 'us') dd -= 40; if (t.kind === 'hq') dd += 6; if (!seen) dd += 3; if (u.d.minR && dd < u.d.minR) dd += 20; if (u.kind === 'aa' && t.d.dom === 'air') dd -= 4; if (u.d.aura && t.d.missile) dd -= 8;
        if (u.d.intercept && (t.d.missile || t.d.bomber)) dd -= 10;
        if (u.d.antiDrone && (t.d.kamikaze || t.d.missile || t.kind === 'uav' || t.kind === 'drone')) dd -= 8;
        if (t.d.decoy) dd -= 2.5; // 11-28 무인 로봇: 앞에서 맞아 줌
        if (u.d.missile) dd = -t.max + dd * 20;
        if (dd < bd) { bd = dd; best = t; }
      }
      u.tgt = best;
    }
    const t = u.tgt;
    // 11-28 공병: 9초마다 발밑에 지뢰(한 공병당 4개까지)
    if (u.d.engineer && !jam) {
      u.mineT = (u.mineT ?? 4) - TICK;
      if (u.mineT <= 0) {
        u.mineT = 9;
        S.mines ??= [];
        if (S.mines.filter((m) => m.by === u.id).length < 4) {
          const f = u.side === 'us' ? -1 : 1;
          S.mines.push({ x: u.x + (rnd(S) - .5) * 1.2, z: u.z + f * (.8 + rnd(S) * .8), side: u.side, by: u.id });
          if (S.mines.filter((m) => m.by === u.id).length === 1) S.hooks.log?.(`${nm(u)} 공병이 지뢰를 묻기 시작했어요`, u.side === 'us' ? 'k' : 'x');
        }
      }
    }
    // 11-28 기뢰 부설함: 8초마다 앞바다에 기뢰(한 척당 5개까지)
    if (u.d.seaMines && !jam) {
      u.mineT = (u.mineT ?? 3) - TICK;
      if (u.mineT <= 0) {
        u.mineT = 8;
        S.mines ??= [];
        if (S.mines.filter((m) => m.by === u.id).length < 5) {
          const f = u.side === 'us' ? -1 : 1, mz = u.z + f * (1.5 + rnd(S) * 2), mx = Math.min(u.x + (rnd(S) - .5) * 2, coastX(mz) - .8);
          S.mines.push({ x: mx, z: mz, side: u.side, by: u.id, sea: true });
          if (S.mines.filter((m) => m.by === u.id).length === 1) S.hooks.log?.(`${nm(u)} 기뢰 부설함이 바다에 기뢰를 깔기 시작했어요`, u.side === 'us' ? 'k' : 'x');
        }
      }
    }
    // 특수 행동: 항모 함재기 · 상륙함 · 원자력 잠수함 순항 미사일
    if (u.d.carrier) { u.spawnCd -= TICK; if (u.spawnCd <= 0) { u.spawnCd = 20; if (u.kids < 2) { const j = makeUnit(S, 'cvjet', u.side, u.x, u.z); j.mom = u; u.kids++; S.hooks.log?.(`${nm(u)} 함재기 출격`, u.side === 'us' ? 'k' : 'x'); } } }
    if (u.d.lha) { u.spawnCd -= TICK; if (u.spawnCd <= 0) { const lx = coastX(u.z) + .7; if (lx - u.x < 3.2 && u.kids < 3) { u.spawnCd = 16; u.kids++; const s = makeUnit(S, 'inf', u.side, lx, u.z); s.waitT = S.simT + 1.2; S.hooks.event?.({ type: 'landing', ship: u, unit: s }); S.hooks.log?.(`${nm(u)} 상륙 부대 해안 도착`, u.side === 'us' ? 'k' : 'x'); } else u.spawnCd = 2; } }
    if (u.d.cruise) {
      u.cd2 -= TICK;
      if (u.cd2 <= 0 && !jam) {
        let lt: Unit | null = null, ld = 11;
        for (const o of S.units) { if (o.alive && o.side !== u.side && o.d.dom === 'land') { const q = dist(u, o) + (o.kind === 'hq' ? -3 : 0); if (q < ld) { ld = q; lt = o; } } }
        if (lt) { u.cd2 = 9; const tx = lt.x, tz = lt.z; S.pending.push({ at: S.simT + 1.6, fn: () => splash(S, tx, tz, 1.1, 90, u.side, u, SURF) }); u.visCruise = { x: tx, z: tz }; } else u.cd2 = 1;
      }
    }
    // 11-26 훈련: 제자리 지키기(hold) = 갈 곳에 서서 사거리 안 적만 쏨
    if (u.hold && u.goal && !u.d.jet && !u.d.missile && !u.d.kamikaze) {
      const g = u.goal, gd = Math.hypot(g.x - u.x, g.z - u.z);
      if (gd > .3) { const a = Math.atan2(g.x - u.x, g.z - u.z); u.x += Math.sin(a) * u.d.spd * TICK; u.z += Math.cos(a) * u.d.spd * TICK; clampDomain(u); u.moveFace = a; u.moving = true; } else u.moving = false;
      if (t) u.aim = Math.atan2(t.x - u.x, t.z - u.z);
      u.cd -= TICK;
      if (t && !jam && dist(u, t) <= u.d.range * (u.rk ?? 1) && u.cd <= 0) { u.cd = u.d.cd * (.9 + rnd(S) * .2) * cdMul(S, u); fire(S, u, t); }
      continue;
    }
    let gx: number, gz: number;
    if (t) { gx = t.x; gz = t.z; } else { const g = goalFor(S, u); gx = g.x; gz = g.z; }
    const dd = Math.hypot(gx - u.x, gz - u.z), want = Math.atan2(gx - u.x, gz - u.z); u.aim = want;
    const sp = u.d.spd * (jam ? .5 : 1);
    // 미사일: 발사대에서 기다렸다가 곧장 날아감
    if (u.d.missile) {
      if (S.simT < u.launchAt!) continue;
      u.flying = true; u.hd = want; u.x += Math.sin(want) * sp * TICK; u.z += Math.cos(want) * sp * TICK; u.moving = true;
      if (t && dd < u.d.range) { splash(S, u.x, u.z, u.d.splash!, u.d.atk, u.side, u, SURF); u.hp = 0; u.alive = false; onDeath(S, u); }
      continue;
    }
    if (u.d.kamikaze) {
      if (!t) { u.moving = false; continue; }
      u.x += Math.sin(want) * sp * TICK; u.z += Math.cos(want) * sp * TICK; u.moving = true; u.moveFace = want;
      if (u.d.dom !== 'air') clampDomain(u);
      if (dd < u.d.range) { splash(S, u.x, u.z, u.d.splash!, u.d.atk, u.side, u, SURF); u.hp = 0; u.alive = false; onDeath(S, u); }
      continue;
    }
    if (u.d.jet) {
      let ta = want;
      if (u.d.awacs) { // 조기경보기: 우리 쪽 뒤 하늘에서 크게 돎
        const cx = (FIELD.xMin + FIELD.xMax) / 2 + 2, cz = u.side === 'us' ? FIELD.zBot - 4.5 : FIELD.zTop + 4.5, a = S.simT * .25 + u.id;
        ta = Math.atan2(cx + Math.sin(a) * 3.5 - u.x, cz + Math.cos(a) * 3.5 - u.z);
      } else if (u.x < FIELD.xMin + 1.6 || u.x > FIELD.xMax - 1.6 || u.z < FIELD.zTop + 1.4 || u.z > FIELD.zBot - 1.6) ta = Math.atan2((FIELD.xMin + FIELD.xMax) / 2 + 2 - u.x, (FIELD.zTop + FIELD.zBot) / 2 - .5 - u.z);
      else if (dd < 1.2 && !u.d.bomber) ta = u.hd;
      const diff = angDiff(ta, u.hd), mt = (u.d.bomber ? 1.3 : 2.1) * TICK;
      u.hd += Math.max(-mt, Math.min(mt, diff)); u.bank = Math.max(-1, Math.min(1, diff * 1.6));
      u.x += Math.sin(u.hd) * sp * TICK; u.z += Math.cos(u.hd) * sp * TICK;
      u.x = Math.max(FIELD.xMin - 1, Math.min(FIELD.xMax + 1, u.x)); u.z = Math.max(FIELD.zTop - 1, Math.min(FIELD.zBot + 1, u.z));
      u.moving = true; u.moveFace = u.hd; u.cd -= TICK;
      if (t && !jam && dd <= u.d.range * (u.rk ?? 1) && (u.d.bomber || Math.abs(angDiff(want, u.hd)) < .5) && u.cd <= 0) { u.cd = u.d.cd * (.9 + rnd(S) * .2) * cdMul(S, u); fire(S, u, t); }
      continue;
    }
    const reach = t ? u.d.range * (u.rk ?? 1) * .92 : .4;
    if (dd > reach) {
      let vx = Math.sin(want), vz = Math.cos(want);
      const grp = u.d.dom === 'air' ? 'air' : u.d.dom === 'land' ? 'land' : 'sea';
      for (const o of S.units) {
        if (o === u || !o.alive || o.d.jet || o.d.missile) continue; const og = o.d.dom === 'air' ? 'air' : o.d.dom === 'land' ? 'land' : 'sea'; if (og !== grp) continue;
        const ox = u.x - o.x, oz = u.z - o.z, od = Math.hypot(ox, oz), R = (u.d.r + o.d.r) * .95; if (od < R && od > 0.001) { vx += ox / od * (R - od) * 1.6; vz += oz / od * (R - od) * 1.6; }
      }
      [vx, vz] = steer(u, vx, vz, gx, gz);
      const L = Math.hypot(vx, vz) || 1; let s2 = sp;
      if (u.d.dom === 'land' && !u.d.amph && Math.abs(u.z - riverZ(u.x)) < .9 && !BRIDGES.some((bx) => Math.abs(u.x - bx) < .7)) s2 *= .45;
      if (u.d.amph && isSea(u.x, u.z)) s2 *= .6; // 상륙장갑차: 물에서는 느림
      // 바다 쪽 유닛은 해안에 막히면 해안을 따라 미끄러짐
      u.x += vx / L * s2 * TICK; u.z += vz / L * s2 * TICK; clampDomain(u);
      u.moveFace = Math.atan2(vx, vz); u.moving = true;
    } else u.moving = false;
    u.cd -= TICK;
    if (t && !jam && dd <= u.d.range * (u.rk ?? 1) && u.cd <= 0) { u.cd = u.d.cd * (.9 + rnd(S) * .2) * cdMul(S, u); fire(S, u, t); }
  }
  if (ST.rule) { const r = ST.rule(S); if (r) endBattle(S, r === 'win', r === 'time'); return; }
  const usLeft = S.units.some((u) => u.alive && u.side === 'us' && !u.d.missile && !u.d.ally);
  const won = ST.id === 'coast' ? !S.units.find((u) => u.kind === 'hq')!.alive : stageRules(S);
  const allyLost = S.units.some((u) => u.d.ally && !u.alive);
  if (won) endBattle(S, true, false);
  else if (allyLost) endBattle(S, false, false);
  else if (!usLeft && !S.pending.length) endBattle(S, false, false);
  else if (S.simT >= ST.timeLimit) endBattle(S, winOf(ST) === 'survive', true);
}
/** 시가전·도심: 이만큼 안의 적만 노림(먼 적은 무시하고 거점·지휘소로 감) */
function leashOf(S: Sim, u: Unit): number {
  if (ST.id === 'coast' || ST.drill || u.d.dom !== 'land' || u.aggr) return 0;
  if (u.side === 'foe') return u.d.range + 4;
  const busy = S.pts.some((p) => p.own === 'foe') || S.units.some((o) => o.kind === 'hq' && o.alive);
  return busy ? u.d.range + 2.5 : 0;
}
const landIn = (S: Sim, side: Side, p: { x: number; z: number; r: number }) => S.units.filter((u) => u.alive && u.side === side && u.d.dom === 'land' && u.kind !== 'hq' && (!u.waitT || S.simT >= u.waitT) && dist(u, p) < p.r).length;
/** 거점 차지 · 증원 · 최후 저항. 이겼으면 true */
function stageRules(S: Sim): boolean {
  const T = ST.timed;
  while (T && (S.tn ?? 0) < T.length && S.simT >= T[S.tn ?? 0].at) {
    const e = T[S.tn ?? 0]; S.tn = (S.tn ?? 0) + 1;
    e.list.forEach(([k, x, z]) => spawnFoe(S, k, x, z, true));
    S.hooks.log?.(e.msg ?? `적 ${e.list.length}개 부대가 몰려와요(${S.tn}/${T.length})`, 'x');
    S.hooks.event?.({ type: 'wave', n: S.tn!, of: T.length });
  }
  // 거점: 우리만 있으면 6초에 걸쳐 차지, 적만 있으면 되돌림
  for (const p of S.pts) {
    const us = landIn(S, 'us', p), foe = landIn(S, 'foe', p);
    if (us && !foe) p.prog = Math.min(1, p.prog + TICK / 6 * Math.min(2, .8 + us * .2));
    else if (foe && !us) p.prog = Math.max(0, p.prog - TICK / 6);
    if (p.own === 'foe' && p.prog >= 1) { p.own = 'us'; S.cp = Math.min(10, S.cp + 2); S.hooks.log?.(`거점 「${p.name}」 확보 · 지휘력 +2`, 'k'); S.hooks.event?.({ type: 'point', name: p.name, own: 'us', x: p.x, z: p.z }); }
    else if (p.own === 'us' && p.prog <= 0) { p.own = 'foe'; S.hooks.log?.(`거점 「${p.name}」을 빼앗겼어요`, 'x'); S.hooks.event?.({ type: 'point', name: p.name, own: 'foe', x: p.x, z: p.z }); }
  }
  // 증원: 적이 거점을 쥐고 있는 동안
  const R = ST.reinf;
  if (R && S.reinfN < R.max && S.pts.some((p) => p.own === 'foe')) {
    S.reinfT += TICK;
    if (S.reinfT >= R.every) { S.reinfT = 0; S.reinfN++; R.list.forEach(([k, x, z]) => { const u = spawnFoe(S, k, x, z, false); const tgt = S.pts.find((p) => p.own === 'foe') ?? S.pts[0]; if (tgt) u.home = { x: tgt.x + (rnd(S) - .5) * 1.4, z: tgt.z + (rnd(S) - .5) * 1.4 }; }); S.hooks.log?.(`적 증원 부대 도착(${S.reinfN}/${R.max})`, 'x'); S.hooks.event?.({ type: 'reinf', n: S.reinfN }); }
  }
  const foeAlive = S.units.some((u) => u.alive && u.side === 'foe' && u.kind !== 'hq');
  const rule = winOf(ST);
  if (rule === 'points') return S.pts.length > 0 && S.pts.every((p) => p.own === 'us');
  if (rule === 'all') return (S.tn ?? 0) >= (T?.length ?? 0) && !S.units.some((u) => u.alive && u.side === 'foe');
  if (rule === 'survive') return false;
  if (rule === 'escort') { const al = S.units.filter((u) => u.d.ally); return al.length > 0 && al.every((u) => u.alive && dist(u, ST.allyGoal ?? ST.usGoal) < 1.8); }
  if (rule === 'hq') { const h = S.units.find((u) => u.kind === 'hq'); return h ? !h.alive : !foeAlive; }
  // 도심: 지휘소 → 최후 저항 파도들 → 남은 적 모두
  const hq = S.units.find((u) => u.kind === 'hq');
  if (hq?.alive) return false;
  const W = ST.waves ?? [];
  if (S.wave < W.length) {
    const prevLeft = S.units.some((u) => u.alive && u.side === 'foe' && u.aggr);
    if (S.wave === 0 || !prevLeft || S.simT - S.waveT > 35) {
      W[S.wave].forEach(([k, x, z]) => spawnFoe(S, k, x, z, true));
      S.wave++; S.waveT = S.simT;
      S.hooks.log?.(S.wave === 1 ? '지휘소 붕괴! 최후 저항 부대가 몰려와요' : `최후 저항 ${S.wave}차 공격`, 'x');
      S.hooks.event?.({ type: 'wave', n: S.wave, of: W.length });
    }
    return false;
  }
  return !foeAlive;
}
/** 11-28 공중급유기 둘레 우리 공군은 공격이 15% 빠름 */
function cdMul(S: Sim, u: Unit) { return u.d.dom === 'air' && !u.d.refuel && S.units.some((o) => o.alive && o.d.refuel && o.side === u.side && dist(o, u) < 6.5) ? .85 : 1; }
function fire(S: Sim, u: Unit, t: Unit) {
  let mul = hitMul(u, t);
  // 11-26 멀리 쏘는 병과는 우리 눈(정찰기·조기경보기)이 보는 적에게 +20%
  if ((u.kind === 'spg' || u.d.ballistic || u.d.salvo || u.kind === 'csm') && spotted(S, t, u.side)) mul *= 1.2;
  if (u.d.ballistic) { // 탄도탄: 떨어질 곳에 경고 → 3.2초 뒤 떨어짐(그 사이 방공에 요격될 수 있음)
    const tx = t.x, tz = t.z, fly = u.d.hyper ? 1.4 : 3.2, def: Side = u.side === 'us' ? 'foe' : 'us';
    u.visFire = { kind: 'bm', tx, tz, fly };
    S.hooks.event?.({ type: 'warn', x: tx, z: tz, t: fly, side: u.side });
    S.pending.push({ at: S.simT + fly, fn: () => {
      const by = interceptor(S, tx, tz, def, u.d.hyper ? .15 : 1);
      if (by) { S.hooks.event?.({ type: 'intercept', x: tx, z: tz, by: by.kind }); S.hooks.log?.(`${def === 'us' ? '아군' : '적'} ${by.d.name}이 탄도탄을 요격했어요`, def === 'us' ? 'k' : 'x'); return; }
      splash(S, tx, tz, u.d.splash!, u.d.atk * mul, u.side, u, SURF); S.hooks.event?.({ type: 'boom', x: tx, z: tz, size: 2.2 });
    } });
    return;
  }
  if (u.d.salvo) { // 다연장로켓: 12발을 넓게 뿌림
    const fly = 1.2 + dist(u, t) * .06;
    u.visFire = { kind: 'mlrs', tx: t.x, tz: t.z, fly };
    for (let i = 0; i < 12; i++) {
      const a = rnd(S) * Math.PI * 2, r = Math.sqrt(rnd(S)) * 1.6, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      S.pending.push({ at: S.simT + fly + i * .08, fn: () => splash(S, x, z, u.d.splash!, u.d.atk * mul, u.side, u, SURF) });
    }
    return;
  }
  if (u.kind === 'spg') {
    const tx = t.x + (rnd(S) - .5) * .9, tz = t.z + (rnd(S) - .5) * .9; const fly = 1.4 + dist(u, t) * .08;
    u.visFire = { kind: 'spg', tx, tz, fly };
    S.pending.push({ at: S.simT + fly, fn: () => { splash(S, tx, tz, u.d.splash!, u.d.atk * mul, u.side, u, SURF); S.hooks.event?.({ type: 'boom', x: tx, z: tz, size: 1.35 }); } });
    return;
  }
  if (u.d.bomber) {
    const tx = t.x, tz = t.z;
    for (let i = 0; i < 4; i++) {
      const bx = tx + (i - 1.5) * .45 * Math.sin(u.hd + Math.PI / 2), bz = tz + (i - 1.5) * .45 * Math.cos(u.hd + Math.PI / 2);
      S.pending.push({ at: S.simT + .7 + i * .12, fn: () => { splash(S, bx, bz, u.d.splash! * .6, u.d.atk * .4, u.side, u, SURF); } });
    }
    u.visFire = { kind: 'bomber', tx, tz }; return;
  }
  if (t.d.dom === 'sub' && u.d.dom !== 'sub' && S.units.some((o) => o.alive && o.d.sonar && o.side === u.side && dist(o, t) < 5.5)) mul *= 1.3; // 11-28 소노부이로 위치를 알면 모두 더 잘 맞힘
  if (u.d.engineer && t.kind === 'hq') mul *= 3; // 11-28 공병: 지휘소 벽 폭파
  if (u.d.antiDrone && (t.d.kamikaze || t.d.missile || t.kind === 'uav' || t.kind === 'drone')) mul *= 3; // 11-28 대드론 레이저
  if (u.kind === 'marine' && Math.abs(u.x - coastX(u.z)) < 2.5) mul *= 1.3; // 11-28 해병대: 해안 돌격
  if (u.d.hack) { t.jam = S.simT + 3; S.pending.push({ at: S.simT + .1, fn: () => { if (t.alive) damage(S, t, u.d.atk * mul, u); } }); u.visFire = { kind: 'hack', tx: t.x, tz: t.z, tgt: t }; return; }
  const delay = u.kind === 'tank' ? .12 : (u.kind === 'sub' || u.kind === 'ssn') ? Math.min(2, dist(u, t) * .25) : u.kind === 'heli' ? .35 : u.kind === 'csm' ? 1.4 : u.kind === 'sam' ? .5 : .05;
  S.pending.push({ at: S.simT + delay, fn: () => { if (t.alive) damage(S, t, u.d.atk * mul, u); } });
  u.visFire = { kind: u.d.look ?? u.kind, tx: t.x, tz: t.z, tgt: t, air: t.d.dom === 'air', fly: delay };
}
function endBattle(S: Sim, win: boolean, timeout: boolean) {
  if (S.phase !== 'battle') return; S.phase = 'end';
  S.result = { win, timeout, t: S.simT };
  S.hooks.end?.(win, timeout);
}

/* ───────── 명령 스킬 ───────── */
export function doCmd(S: Sim, k: CmdKey, x: number, z: number, gridRef: string) {
  const c = CMD[k]; S.cp -= c.cost;
  S.hooks.log?.(`${c.name} 명령 · 좌표 ${gridRef}`, 'c');
  if (k === 'arty') {
    for (let i = 0; i < 8; i++) {
      const a = rnd(S) * Math.PI * 2, r = Math.sqrt(rnd(S)) * c.r, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, at = S.simT + 1.1 + i * .2;
      S.pending.push({ at, fn: () => { splash(S, tx, tz, 1.1, 62, 'us', null, SURF); } });
      S.hooks.event?.({ type: 'arty', x: tx, z: tz, delay: i * .2 });
    }
  } else if (k === 'smoke') {
    S.smokes.push({ x, z, r: c.r, end: S.simT + 9 });
    S.hooks.event?.({ type: 'smoke', x, z, r: c.r });
  } else if (k === 'air') {
    for (let i = 0; i < 5; i++) { const tx = x - 2 + i, tz = z; S.pending.push({ at: S.simT + 1.6 + i * .12, fn: () => splash(S, tx, tz, c.r, 120, 'us', null, ['land', 'sea', 'air']) }); }
    S.hooks.event?.({ type: 'airstrike', x, z });
  } else if (k === 'cruise') {
    S.pending.push({ at: S.simT + 2.2, fn: () => splash(S, x, z, c.r, 300, 'us', null, SURF) });
    S.hooks.event?.({ type: 'cruise', x, z });
  } else if (k === 'emp') {
    S.pending.push({ at: S.simT + .3, fn: () => { S.units.forEach((t) => { if (t.alive && t.side === 'foe' && Math.hypot(t.x - x, t.z - z) < c.r) { t.jam = S.simT + 6; damage(S, t, 20, null); } }); } });
    S.hooks.event?.({ type: 'emp', x, z, r: c.r });
  } else if (k === 'repair') {
    S.units.forEach((t) => { if (t.alive && t.side === 'us' && Math.hypot(t.x - x, t.z - z) < c.r) { t.hp = Math.min(t.max, t.hp + t.max * .35); t.healT = S.simT; } });
    S.hooks.event?.({ type: 'repair', x, z, r: c.r });
  } else if (k === 'sat') { // 11-28 위성 유도: 숨은 적을 모두 드러내고 12초 동안 우리 공격 +25%
    S.units.forEach((t) => { if (t.alive && t.side === 'foe' && !t.d.ally) t.hidden = false; });
    S.satT = S.simT + 12;
    S.hooks.event?.({ type: 'emp', x, z, r: 3 });
  } else if (k === 'para') {
    const pts = [[x - .4, z], [x + .4, z + .1]].filter(([px, pz]) => !isSea(px, pz, -.3));
    pts.forEach(([px, pz], i) => { S.pending.push({ at: S.simT + 2.6 + i * .3, fn: () => { const s = makeUnit(S, 'inf', 'us', px, pz); s.waitT = S.simT + .6; } }); });
    S.hooks.event?.({ type: 'para', x, z });
  }
}

/** 화면 없이 끝까지 돌리기(시험·자동 전투용) */
export function runHeadless(mine = defaultDeploy(), maxSteps = 4000, opt: DeployOpt = {}): Sim {
  const S = createSim();
  setupDeploy(S, mine, opt);
  startBattle(S);
  for (let i = 0; i < maxSteps && S.phase === 'battle'; i++) step(S);
  return S;
}

/** 전투 결과 → 별·글(임무 결과로 씀). 손실 1/4 이하 + 시간 60% 안 = ★3, 손실 절반 이하 = ★2 */
export function outcome(r: { win: boolean; timeout: boolean; t: number; lost: number; total: number; dead?: Record<string, number> }): { win: boolean; stars: number; text: string; dead?: Record<string, number> } {
  const loss = r.total ? r.lost / r.total : 1;
  const stars = r.win ? (loss <= 0.25 && r.t <= ST.timeLimit * 0.6 ? 3 : loss <= 0.5 ? 2 : 1) : 0;
  const m = Math.floor(r.t / 60), s = Math.floor(r.t % 60);
  const head = winText(r.win, r.timeout);
  return { win: r.win, stars, text: `${head} 걸린 시간 ${m}분 ${s}초 · 아군 손실 ${r.lost}/${r.total}`, dead: r.dead };
}
/** 이기고 진 까닭(이기는 조건마다) */
export function winText(win: boolean, timeout: boolean): string {
  const rule = winOf(ST), lim = `${Math.round(ST.timeLimit / 60 * 10) / 10}분`;
  if (win) return rule === 'points' ? '거점을 모두 차지했어요.' : rule === 'all' ? '적을 모두 물리쳤어요.' : rule === 'survive' ? `${lim}을 끝까지 버텼어요.` : rule === 'escort' ? '지킬 대상을 무사히 목적지까지 데려갔어요.' : rule === 'hqwaves' && ST.waves ? '지휘소를 부수고 최후 저항까지 막아 냈어요.' : '적 지휘소를 무너뜨렸어요.';
  if (timeout) return rule === 'escort' ? `제한 시간 ${lim} 안에 목적지에 닿지 못했어요.` : `제한 시간 ${lim} 안에 끝내지 못했어요.`;
  return '아군 부대가 모두 쓰러졌거나 지킬 대상을 잃었어요.';
}
/** 화면 없이 돌린 전투의 결과 */
export function headlessOutcome(S: Sim) {
  const mine = S.units.filter((u) => u.side === 'us' && !u.d.missile && u.kind !== 'cvjet' && !u.d.ally);
  const r = S.result ?? { win: false, timeout: true, t: S.simT };
  return outcome({ ...r, lost: mine.filter((u) => !u.alive).length, total: mine.length });
}
