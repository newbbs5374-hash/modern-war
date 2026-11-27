// 어떤 전투를 열지 정하는 곳: 훈련 12개 · 임무 · 작전(여러 판) · 대전투(도시 점령) · 승급 심사 · 연습장 · 파병 전투.
// 11-26 대장 지시: 전투는 3D 전투만 남김(격자 턴제·옆보기·포물선·슈팅·퍼즐·2.5D·위성 지도 전투 모두 없앰).
// 임무마다 어울리는 큰 3D 전장 여러 곳 중 하나를 씨앗으로 골라 돌아가며 씀(battle3d/pick.ts).
import { drillName as threeName, threeFor } from '../battle3d/train3d';
import type { ActiveMission } from '../game/officer';
import type { MissionKind } from '../data/officers';
import { EXAM_FIELDS, KIND_FIELDS, fieldById, pickBySeed } from '../battle3d/pick';
import { BIG_FIELDS, URBAN_FIELDS } from '../battle3d/fields';
import { DEPLOY_FIELDS } from '../battle3d/deployFields';
import { pickMini } from './minigames';

export type Frame = 'mini' | 'b3d' | 'd3';
export type Source = 'mission' | 'practice' | 'training' | 'occupy' | 'deploy' | 'counter';

export interface BattleSpec {
  frame: Frame;
  variant: string;
  /** 단계 이름(작전·대전투) */
  label?: string;
  title: string;
  difficulty: number;
  seed: number;
  /** 적 이름(예: 중국군) */
  enemy?: string;
  /** 대상 도시 id(공성전: 바닷가 도시면 1막에 바다가 있는 전장) · 도시 방어도 */
  city?: string;
  defense?: number;
  /** 11-26 파병 전투: 쓸 수 있는 병과 · 배치 예산 */
  kinds?: string[];
  budget?: number;
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
  /** 점령지 관리 임무(11-26): 도시 · 임무 */
  occupy?: { city: string; task: string };
  /** 파병 교전(11-26): 파병 번호 · 교전 id */
  deploy?: { dep: number; clash: string };
  /** 반격 방어전(11-27): 반격 번호 */
  counter?: number;
}

/** 점령지 관리 임무 = 미니게임 한 판 */
export function occupyPlan(city: string, cityName: string, task: string, taskName: string, mini: string, seed: number): BattlePlan {
  return { title: `${cityName} · ${taskName}`, source: 'occupy', mainIdx: 0, occupy: { city, task }, stages: [{ frame: 'mini', variant: mini, title: `${cityName} · ${taskName}`, difficulty: 1, seed }] };
}

export const FRAME_NAMES: Record<Frame, string> = {
  mini: '🎮 훈련 미니게임',
  b3d: '🪖 3D 전투',
  d3: '🪖 3D 훈련',
};

type Pick = { frame: Frame; variant: string; label?: string };

/** 계급이 오르면 같은 훈련도 커짐(이름) */
export function trainingScale(name: string, rank: number): string {
  if (name === '잠입') return rank < 2 ? '혼자 잠입' : '분대 3명 잠입';
  if (name === '포격') return rank < 3 ? '박격포' : rank < 6 ? '자주포' : rank < 8 ? '함포' : '미사일 유도';
  if (name === '통솔') return rank < 4 ? '분대 지휘' : rank < 7 ? '중대 지휘' : '대대 지휘';
  if (name === '체력') return rank < 3 ? '장애물 코스' : '장거리 행군 코스';
  return '';
}

/** 훈련 = 3D 훈련 1판(11-26: 2D 미니게임은 훈련에서 뺌). mini = 고른 훈련 id(없으면 그 훈련의 3D 실전) */
export function trainingPlan(name: string, rank: number, seed: number, mini?: string): BattlePlan {
  void rank;
  const m = mini && !/^(d3-|c3-|n3-|p3|w3)/.test(mini) ? pickMini(name, seed, mini) : undefined;
  if (m && m.id === mini) {
    return { title: `${name} 훈련 · ${m.name}`, source: 'training', training: name, mainIdx: 0, stages: [{ frame: 'mini', variant: m.id, title: `${name} 훈련`, difficulty: 1, seed }] };
  }
  // 3D 훈련(실전 d3-* · 사격장 c3-* · 배치 퍼즐 p3 · 주간 합동 w3). 고르지 않았으면 그 훈련의 3D 실전
  const id = mini && /^(d3-|c3-|n3-|p3|w3)/.test(mini) ? mini : (threeFor(name).find((x) => x.tag === '3D 실전') ?? threeFor(name)[0])?.id ?? 'd3-tac';
  const t3 = threeName(id);
  return { title: `${name} 훈련 · ${t3}`, source: 'training', training: name, mainIdx: 0, stages: [{ frame: 'd3', variant: id, title: `${name} 훈련`, difficulty: 1, seed }] };
}

/** 임무 종류 → 3D 전장 고르기 표시(@종류 → 씨앗으로 그 종류의 전장 중 하나) */
const KIND_BATTLE = (k: MissionKind): Pick => ({ frame: 'b3d', variant: `@${k}` });

/** 작전(대위부터): 전선 도시 하나를 두고 여러 판(판마다 다른 3D 전장)을 이어 싸움 */
export const OPERATIONS: Array<{ name: string; attack: boolean; stages: Pick[] }> = [
  { name: '고지 뺏기', attack: true, stages: [{ frame: 'b3d', variant: 'canyon', label: '협곡 돌파' }, { frame: 'b3d', variant: 'highland', label: '고지 돌격' }] },
  { name: '방어선 지키기', attack: false, stages: [{ frame: 'b3d', variant: 'bridgehold', label: '다리 사수' }, { frame: 'b3d', variant: 'frost', label: '마지막 방어선' }] },
  { name: '돌파 작전', attack: true, stages: [{ frame: 'b3d', variant: 'rainforest', label: '강 건너기' }, { frame: 'b3d', variant: 'plains', label: '대평원 돌파' }] },
  { name: '보급로 확보', attack: false, stages: [{ frame: 'b3d', variant: 'mountainpass', label: '산길 호송' }, { frame: 'b3d', variant: 'supply', label: '보급로 호송' }] },
  { name: '사령부 기습', attack: true, stages: [{ frame: 'b3d', variant: 'nightwood', label: '야간 침투' }, { frame: 'b3d', variant: 'airfield', label: '비행장 기습' }] },
  { name: '잠수함 사냥', attack: true, stages: [{ frame: 'b3d', variant: 'strait', label: '해협 해전' }, { frame: 'b3d', variant: 'beachhead', label: '상륙 해안' }] },
];

/** 도시 점령 대전투 = 3D 3막 공성전(외곽 → 시가전 → 도심, 막마다 여러 전장 중 돌아가며) */
export const FIELD_PICK: Pick = { frame: 'b3d', variant: 'siege', label: '3막 공성전' };

export function picksOf(a: ActiveMission, rank: number): { picks: Pick[]; mainIdx: number } {
  if (a.exam) return { picks: [{ frame: 'b3d', variant: EXAM_FIELDS[Math.min(rank, EXAM_FIELDS.length - 1)] }], mainIdx: 0 };
  if (a.kind === '작전') {
    const op = OPERATIONS[(a.op ?? 0) % OPERATIONS.length];
    return { picks: op.stages, mainIdx: op.stages.length - 1 };
  }
  if (a.kind === '대전투') return { picks: [FIELD_PICK], mainIdx: 0 };
  return { picks: [KIND_BATTLE(a.kind)], mainIdx: 0 };
}

/** '@종류' → 그 종류에 어울리는 전장 중 하나(씨앗) */
export function resolveField(variant: string, seed: number): string {
  if (!variant.startsWith('@')) return variant;
  return pickBySeed(KIND_FIELDS[variant.slice(1)] ?? ['highland'], seed);
}

/** 화면 표시용: 이 임무가 어떤 전투인지 */
export function battleLabel(a: ActiveMission, rank: number): string {
  const { picks } = picksOf(a, rank);
  if (picks.length === 1) {
    const v = picks[0].variant;
    if (v === 'siege') return '🏰 3D 3막 공성전';
    if (v.startsWith('@')) return `🪖 3D 전투 · ${(KIND_FIELDS[v.slice(1)] ?? []).map((id) => fieldById(id).name).join('·')} 중 하나`;
    return `🪖 3D 전투 · ${fieldById(v).name}`;
  }
  return '🪖 ' + picks.map((p) => p.label).join(' → ');
}

export function planForMission(a: ActiveMission, rank: number, officerSeed: number, enemy?: string, defense?: number): BattlePlan {
  const { picks, mainIdx } = picksOf(a, rank);
  const seed = (a.id * 7919 + officerSeed) >>> 0;
  return {
    title: a.title,
    source: 'mission',
    mainIdx,
    intro: a.kind === '대전투' ? '3막 공성전이에요. 1막 외곽에서 적을 뚫고, 2막 시가전에서 거점을 모두 차지하고, 3막 도심에서 지휘소와 최후 저항을 꺾으면 점령이에요. 막마다 전장이 여러 곳 중에서 바뀌어요. 살아남은 부대는 다친 그대로 다음 막에 이어져요. 부관에게 맡길 수도 있어요(별 최대 2개).' : undefined,
    stages: picks.map((p, i) => ({ ...p, variant: resolveField(p.variant, seed + i * 131), title: p.label ? `${i + 1}. ${p.label}` : a.title, difficulty: a.difficulty, seed: seed + i * 131, enemy, city: a.city, defense })),
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

/** 11-27 연습장 묶음: 전투 방식(이기는 조건)별로 나눠 접기 */
export const PRACTICE_GROUPS: Array<{ id: string; icon: string; name: string; text: string }> = [
  { id: 'siege', icon: '🏰', name: '공성전 · 시가지', text: '도시를 막마다 빼앗는 전투' },
  { id: 'hq', icon: '🎯', name: '지휘소 파괴', text: '적 지휘소를 부수고 최후 저항을 막기' },
  { id: 'points', icon: '🚩', name: '거점 차지', text: '거점 여러 곳을 모두 차지' },
  { id: 'all', icon: '💥', name: '섬멸전', text: '적 부대·함대를 모두 격파' },
  { id: 'survive', icon: '🛡️', name: '방어전', text: '정해진 시간 동안 버티기' },
  { id: 'escort', icon: '🚚', name: '호송 · 구출', text: '차량·배를 목적지까지 지키기' },
];
const groupOf = (st: { win?: string }): string =>
  st.win === 'hqwaves' || st.win === 'hq' ? 'hq' : st.win ?? 'hq';

/** 연습장 목록(보상 없음): 공성전 · 시험판 해안 전장 · 큰 전장 · 공성전 시가지 · 파병 전장 모두 */
export const PRACTICE: Array<{ label: string; group: string } & Pick> = [
  { label: '3막 공성전(막마다 전장이 바뀜)', group: 'siege', frame: 'b3d', variant: 'siege' },
  ...URBAN_FIELDS.map((st) => ({ label: st.name.replace(/^\d막 · /, ''), group: 'siege', frame: 'b3d' as Frame, variant: st.id })),
  { label: '철벽 작전(시험판 해안 전장)', group: 'hq', frame: 'b3d', variant: 'coast' },
  ...BIG_FIELDS.map((st) => ({ label: st.name, group: groupOf(st), frame: 'b3d' as Frame, variant: st.id })),
  ...DEPLOY_FIELDS.map((st) => ({ label: `파병 · ${st.name}`, group: groupOf(st), frame: 'b3d' as Frame, variant: st.id })),
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
