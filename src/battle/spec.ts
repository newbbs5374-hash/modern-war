// 어떤 전투를 열지 정하는 곳: 훈련 12개 · 임무 · 작전(여러 판) · 대전투(도시 점령) · 진급 심사 · 연습장.
import type { ActiveMission } from '../game/officer';
import type { MissionKind } from '../data/officers';

export type Frame = 'grid' | 'side' | 'arty' | 'shooter' | 'puzzle' | 'course' | 'range';
export type Source = 'mission' | 'practice' | 'training';

export interface BattleSpec {
  frame: Frame;
  variant: string;
  /** 단계 이름(작전·대전투) */
  label?: string;
  title: string;
  difficulty: number;
  seed: number;
  squadSize?: number;
}

/** 한 번에 치르는 전투 묶음(훈련·임무는 1판, 작전 2~3판, 대전투 5판) */
export interface BattlePlan {
  title: string;
  source: Source;
  stages: BattleSpec[];
  /** 꼭 이겨야 하는 판(작전 = 마지막, 대전투 = 시가지 돌입) */
  mainIdx: number;
  training?: string;
  /** 단계 사이 이야기(대전투) */
  intro?: string;
}

export const FRAME_NAMES: Record<Frame, string> = {
  grid: '① 격자 턴제',
  side: '② 옆보기 실시간',
  course: '② 옆보기 실시간',
  range: '② 옆보기 실시간',
  arty: '③ 포물선 대결',
  shooter: '④ 위에서 본 슈팅',
  puzzle: '⑤ 퍼즐·카드',
};

type Pick = { frame: Frame; variant: string; label?: string };

/** 훈련 12개 → 전투 틀 */
export const TRAINING_BATTLE: Record<string, Pick> = {
  잠입: { frame: 'grid', variant: 'infiltrate' },
  전술: { frame: 'grid', variant: 'eliminate' },
  해상: { frame: 'grid', variant: 'naval' },
  통솔: { frame: 'side', variant: 'hold' },
  체력: { frame: 'course', variant: 'run' },
  사격: { frame: 'range', variant: 'shoot' },
  포격: { frame: 'arty', variant: 'duel' },
  항공: { frame: 'shooter', variant: 'air' },
  모병: { frame: 'puzzle', variant: '모병' },
  정보: { frame: 'puzzle', variant: '정보' },
  보급: { frame: 'puzzle', variant: '보급' },
  해킹: { frame: 'puzzle', variant: '해킹' },
};

/** 계급이 오르면 같은 훈련도 커짐(이름) */
export function trainingScale(name: string, rank: number): string {
  if (name === '잠입') return rank < 2 ? '혼자 잠입' : '분대 3명 잠입';
  if (name === '포격') return rank < 3 ? '박격포' : rank < 6 ? '자주포' : rank < 8 ? '함포' : '미사일 유도';
  if (name === '통솔') return rank < 4 ? '분대 지휘' : rank < 7 ? '중대 지휘' : '대대 지휘';
  if (name === '체력') return rank < 3 ? '장애물 코스' : '장거리 행군 코스';
  return '';
}

export function trainingPlan(name: string, rank: number, seed: number): BattlePlan {
  const p = TRAINING_BATTLE[name];
  const scale = trainingScale(name, rank);
  return {
    title: `${name} 훈련${scale ? ` · ${scale}` : ''}`,
    source: 'training',
    training: name,
    mainIdx: 0,
    stages: [{ ...p, title: `${name} 훈련`, difficulty: 1, seed, squadSize: name === '잠입' ? (rank < 2 ? 1 : 3) : undefined }],
  };
}

const KIND_BATTLE: Partial<Record<MissionKind, Pick>> = {
  방어: { frame: 'grid', variant: 'survive' },
  기습: { frame: 'grid', variant: 'eliminate' },
  구출: { frame: 'grid', variant: 'rescue' },
  정찰: { frame: 'grid', variant: 'reach' },
  호송: { frame: 'side', variant: 'escort' },
};

/** 작전(대위부터): 전선 도시 하나를 두고 여러 판을 이어 싸움 */
export const OPERATIONS: Array<{ name: string; attack: boolean; stages: Pick[] }> = [
  { name: '고지 뺏기', attack: true, stages: [{ frame: 'arty', variant: 'duel', label: '준비 포격' }, { frame: 'grid', variant: 'eliminate', label: '고지 돌격' }] },
  {
    name: '방어선 지키기',
    attack: false,
    stages: [
      { frame: 'puzzle', variant: '정보', label: '적 공격 미리 알기' },
      { frame: 'side', variant: 'hold', label: '방어선' },
      { frame: 'grid', variant: 'survive', label: '마지막 진지' },
    ],
  },
  { name: '돌파 작전', attack: true, stages: [{ frame: 'puzzle', variant: '해킹', label: '통신 마비' }, { frame: 'side', variant: 'breakthrough', label: '돌파' }] },
  { name: '보급선 지키기', attack: false, stages: [{ frame: 'puzzle', variant: '보급', label: '보급로 잇기' }, { frame: 'side', variant: 'escort', label: '트럭 호송' }] },
  { name: '사령부 기습', attack: true, stages: [{ frame: 'grid', variant: 'infiltrate', label: '잠입' }, { frame: 'grid', variant: 'eliminate', label: '사령부 소탕' }] },
  { name: '잠수함 사냥', attack: true, stages: [{ frame: 'grid', variant: 'naval', label: '잠수함 사냥' }, { frame: 'shooter', variant: 'air', label: '초계기 엄호' }] },
];

/** 도시 점령 대전투(준장부터): 해킹 → 포격 → 항공 → 시가지 → 사령관 생포 */
export const GRAND_STAGES: Pick[] = [
  { frame: 'puzzle', variant: '해킹', label: '방공망 끄기' },
  { frame: 'arty', variant: 'duel', label: '외곽 진지 포격' },
  { frame: 'shooter', variant: 'air', label: '제공권 잡기' },
  { frame: 'side', variant: 'breakthrough', label: '시가지 돌입' },
  { frame: 'grid', variant: 'infiltrate', label: '적 사령관 생포' },
];
export const GRAND_MAIN = 3;

/** 진급 심사 작전(계급 순서대로) */
const EXAM_BATTLE: Pick[] = [
  { frame: 'grid', variant: 'eliminate' }, // 분대 침투
  { frame: 'grid', variant: 'survive' }, // 고지 방어
  { frame: 'grid', variant: 'rescue' }, // 인질 구출
  { frame: 'side', variant: 'breakthrough' }, // 대대 돌파
  { frame: 'arty', variant: 'duel' }, // 강 건너기(포격 지원)
  { frame: 'side', variant: 'hold' }, // 연대 합동
  { frame: 'shooter', variant: 'air' }, // 여단 반격(제공권)
  { frame: 'grid', variant: 'eliminate' }, // 사단 포위
  { frame: 'grid', variant: 'naval' }, // 군단 상륙(바다 장악)
  { frame: 'puzzle', variant: '정보' }, // 총사령관 심의
];

export function picksOf(a: ActiveMission, rank: number): { picks: Pick[]; mainIdx: number } {
  if (a.exam) return { picks: [EXAM_BATTLE[Math.min(rank, EXAM_BATTLE.length - 1)]], mainIdx: 0 };
  if (a.kind === '작전') {
    const op = OPERATIONS[(a.op ?? 0) % OPERATIONS.length];
    return { picks: op.stages, mainIdx: op.stages.length - 1 };
  }
  if (a.kind === '대전투') return { picks: GRAND_STAGES, mainIdx: GRAND_MAIN };
  return { picks: [KIND_BATTLE[a.kind]!], mainIdx: 0 };
}

/** 화면 표시용: 이 임무가 어떤 전투인지 */
export function battleLabel(a: ActiveMission, rank: number): string {
  const { picks } = picksOf(a, rank);
  if (picks.length === 1) return FRAME_NAMES[picks[0].frame];
  return picks.map((p) => p.label).join(' → ');
}

export function planForMission(a: ActiveMission, rank: number, officerSeed: number): BattlePlan {
  const { picks, mainIdx } = picksOf(a, rank);
  const seed = (a.id * 7919 + officerSeed) >>> 0;
  return {
    title: a.title,
    source: 'mission',
    mainIdx,
    intro: a.kind === '대전투' ? '단계마다 이기면 다음 단계가 쉬워져요. 시가지 돌입은 꼭 이겨야 하고, 다섯 판 중 세 판 이상 이기면 도시를 차지해요. 어떤 단계든 부관에게 맡길 수 있어요(별 최대 2개).' : undefined,
    stages: picks.map((p, i) => ({ ...p, title: p.label ? `${i + 1}. ${p.label}` : a.title, difficulty: a.difficulty, seed: seed + i * 131 })),
  };
}

/** 여러 판 결과 → 임무 결과 */
export function planOutcome(plan: BattlePlan, results: Array<{ win: boolean; stars: number }>): { win: boolean; stars: number } {
  const wins = results.filter((r) => r.win);
  const need = Math.ceil(plan.stages.length / 2);
  const win = !!results[plan.mainIdx]?.win && wins.length >= need;
  const stars = win ? Math.max(1, Math.round(wins.reduce((a, r) => a + r.stars, 0) / wins.length)) : 0;
  return { win, stars };
}

/** 앞 판 결과가 다음 판 난이도에 이어짐 */
export function nextDifficulty(base: number, results: Array<{ win: boolean }>): number {
  return Math.max(0.7, base - results.filter((r) => r.win).length * 0.06 + results.filter((r) => !r.win).length * 0.04);
}

/** 연습장 목록(보상 없음) */
export const PRACTICE: Array<{ label: string } & Pick> = [
  { label: '방어(깃발)', frame: 'grid', variant: 'survive' },
  { label: '구출(인질)', frame: 'grid', variant: 'rescue' },
  { label: '정찰(목표)', frame: 'grid', variant: 'reach' },
  { label: '호송(트럭)', frame: 'side', variant: 'escort' },
  { label: '돌파(진지)', frame: 'side', variant: 'breakthrough' },
];

const PRACTICE_KEY = 'modern-war-plan';
export function setPendingPlan(plan: BattlePlan | null) {
  try {
    if (plan) sessionStorage.setItem(PRACTICE_KEY, JSON.stringify(plan));
    else sessionStorage.removeItem(PRACTICE_KEY);
  } catch {
    /* 무시 */
  }
}
export function getPendingPlan(): BattlePlan | null {
  try {
    const t = sessionStorage.getItem(PRACTICE_KEY);
    return t ? (JSON.parse(t) as BattlePlan) : null;
  } catch {
    return null;
  }
}
export function practicePlan(i: number, seed: number): BattlePlan {
  const p = PRACTICE[i];
  return { title: `연습: ${p.label}`, source: 'practice', mainIdx: 0, stages: [{ ...p, title: `연습: ${p.label}`, difficulty: 1, seed }] };
}
