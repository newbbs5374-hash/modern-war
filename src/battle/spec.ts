// 어떤 전투를 열지 정하는 곳: 임무 종류·진급 심사·연습장 → 전투 틀과 세부 방식.
import type { ActiveMission } from '../game/officer';
import type { MissionKind } from '../data/officers';
import type { Goal } from './grid';
import type { SideGoal } from './side';
import type { PuzzleKind } from './puzzle';

export type Frame = 'grid' | 'side' | 'arty' | 'shooter' | 'puzzle';
export type BattleSpec =
  | { frame: 'grid'; variant: Goal; title: string; difficulty: number; seed: number; practice: boolean }
  | { frame: 'side'; variant: SideGoal; title: string; difficulty: number; seed: number; practice: boolean }
  | { frame: 'arty'; variant: 'duel'; title: string; difficulty: number; seed: number; practice: boolean }
  | { frame: 'shooter'; variant: 'air'; title: string; difficulty: number; seed: number; practice: boolean }
  | { frame: 'puzzle'; variant: PuzzleKind; title: string; difficulty: number; seed: number; practice: boolean };

export const FRAME_NAMES: Record<Frame, string> = {
  grid: '① 격자 턴제',
  side: '② 옆보기 실시간',
  arty: '③ 포물선 대결',
  shooter: '④ 위에서 본 슈팅',
  puzzle: '⑤ 퍼즐·카드',
};

type Pick = { frame: Frame; variant: string };
const KIND_BATTLE: Record<MissionKind, Pick> = {
  방어: { frame: 'grid', variant: 'survive' },
  기습: { frame: 'grid', variant: 'eliminate' },
  구출: { frame: 'grid', variant: 'rescue' },
  정찰: { frame: 'grid', variant: 'reach' },
  호송: { frame: 'side', variant: 'escort' },
};
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
  { frame: 'side', variant: 'breakthrough' }, // 군단 상륙
  { frame: 'puzzle', variant: '정보' }, // 총사령관 심의
];

export function battleOf(a: ActiveMission, rank: number): Pick {
  return a.exam ? EXAM_BATTLE[Math.min(rank, EXAM_BATTLE.length - 1)] : KIND_BATTLE[a.kind];
}

export function specForMission(a: ActiveMission, rank: number, officerSeed: number): BattleSpec {
  const p = battleOf(a, rank);
  return { ...p, title: a.title, difficulty: a.difficulty, seed: (a.id * 7919 + officerSeed) >>> 0, practice: false } as BattleSpec;
}

/** 연습장 목록(보상 없음). 5단계에서 훈련 12개로 바뀜 */
export const PRACTICE: Array<{ label: string; frame: Frame; variant: string }> = [
  { label: '방어(깃발 지키기)', frame: 'grid', variant: 'survive' },
  { label: '기습(적 전멸)', frame: 'grid', variant: 'eliminate' },
  { label: '구출(인질)', frame: 'grid', variant: 'rescue' },
  { label: '정찰(목표 닿기)', frame: 'grid', variant: 'reach' },
  { label: '호송(트럭)', frame: 'side', variant: 'escort' },
  { label: '돌파(적 진지)', frame: 'side', variant: 'breakthrough' },
  { label: '버티기(90초)', frame: 'side', variant: 'hold' },
  { label: '포격 대결', frame: 'arty', variant: 'duel' },
  { label: '공중전', frame: 'shooter', variant: 'air' },
  { label: '모병(카드)', frame: 'puzzle', variant: '모병' },
  { label: '정보(암호)', frame: 'puzzle', variant: '정보' },
  { label: '보급(길 잇기)', frame: 'puzzle', variant: '보급' },
  { label: '해킹(보안망)', frame: 'puzzle', variant: '해킹' },
];

const PRACTICE_KEY = 'modern-war-practice';
export function setPractice(spec: BattleSpec | null) {
  try {
    if (spec) sessionStorage.setItem(PRACTICE_KEY, JSON.stringify(spec));
    else sessionStorage.removeItem(PRACTICE_KEY);
  } catch {
    /* 무시 */
  }
}
export function getPractice(): BattleSpec | null {
  try {
    const t = sessionStorage.getItem(PRACTICE_KEY);
    return t ? (JSON.parse(t) as BattleSpec) : null;
  } catch {
    return null;
  }
}
export function practiceSpec(i: number, seed: number): BattleSpec {
  const p = PRACTICE[i];
  return { frame: p.frame, variant: p.variant, title: `연습: ${p.label}`, difficulty: 1, seed, practice: true } as BattleSpec;
}
