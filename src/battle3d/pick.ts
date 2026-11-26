// 11-26 어느 전투에 어느 3D 전장을 쓸지(대장 요청 "10개 이상의 큰 전장을 돌아가면서 전투에 맞게").
// 임무 종류마다 어울리는 전장 몇 곳을 정해 두고, 임무 씨앗으로 그중 하나를 고른다(같은 전장만 되풀이하지 않게).
import { COAST, type Kind, type Stage } from './sim';
import { mix, stageById } from './stages';
import { DEPLOY_FIELDS } from './deployFields';

/** 임무 종류 → 어울리는 전장 id */
export const KIND_FIELDS: Record<string, string[]> = {
  방어: ['frost', 'oasis', 'bridgehold'],
  기습: ['nightwood', 'airfield', 'dune', 'highland'],
  구출: ['hostage', 'embassy'],
  정찰: ['rainforest', 'harbor', 'canyon'],
  호송: ['supply', 'mountainpass'],
  안보회의: ['frost', 'bridgehold', 'highland'],
  특수작전: ['nightwood', 'canyon', 'hostage'],
  정보보고: ['airfield', 'rainforest', 'harbor'],
  전선시찰: ['frost', 'plains', 'bridgehold'],
  교민철수: ['hostage', 'embassy', 'harbor'],
  군수협상: ['supply', 'mountainpass'],
  현장방문: ['rainforest', 'dune', 'oasis'],
  방산시찰: ['plains', 'strait', 'airfield'],
};
/** 작전(여러 판) · 승급 심사 · 대전투 다섯 판 대신 쓰는 전장 */
export const EXAM_FIELDS = ['nightwood', 'frost', 'hostage', 'canyon', 'rainforest', 'bridgehold', 'airfield', 'plains', 'beachhead', 'highland'];

/** 씨앗으로 목록에서 하나 */
export function pickBySeed<T>(list: T[], seed: number, k = 0): T {
  return list[Math.floor(mix(seed * 7 + k) * list.length)];
}

/** 전장 id → 전장(시험판 해안 전장·큰 전장·공성전 판·파병 전장) */
export function fieldById(id: string): Stage {
  if (id === 'coast') return COAST;
  return stageById(id) ?? DEPLOY_FIELDS.find((s) => s.id === id) ?? COAST;
}

/** 전투 한 판의 전장: variant = 전장 id, 고를 병과·예산이 정해져 있으면 덮어씀(파병 전투) */
export function stageFor(spec: { variant: string; kinds?: string[]; budget?: number }): Stage {
  const st = fieldById(spec.variant);
  if (!spec.kinds && !spec.budget) return st;
  return { ...st, ...(spec.kinds ? { kinds: spec.kinds as Kind[] } : {}), ...(spec.budget ? { budget: spec.budget } : {}) };
}
