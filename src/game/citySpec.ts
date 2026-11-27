// 내정 1 도시 특화 나무(11/27 종합 확장안): 내 도시마다 길 하나(산업·과학·관광·군사·금융)를 골라 3단계까지 키움.
// 도시마다 성격이 생기고, 같은 길을 3곳 넘게 키우면 '벨트' 덤이 붙음. 길을 바꾸면 처음부터 다시.
import { cityById } from '../data/cities';
import type { LawKey } from './laws';
import { domLog, domOf, payTreasury, registerDomRows, snap, withDom, type Rows } from './domestic';
import { cityStage } from './growth';
import { budgetPerDay, type GameState } from './state';

export type SpecId = 'ind' | 'sci' | 'tour' | 'mil' | 'fin';
export interface SpecDef {
  id: SpecId;
  icon: string;
  name: string;
  belt: string;
  /** 단계 이름 3개 */
  steps: [string, string, string];
  /** 단계 하나마다 나라 전체에 더해지는 효과 */
  eff: Partial<Record<LawKey, number>>;
  text: string;
}
export const SPECS: SpecDef[] = [
  { id: 'ind', icon: '🏭', name: '산업', belt: '산업 벨트', steps: ['공단 조성', '중화학 단지', '첨단 제조 도시'], eff: { res: 0.012, build: 0.008 }, text: '자원 +1.2% · 모집 +0.8%' },
  { id: 'sci', icon: '🔬', name: '과학', belt: '연구 벨트', steps: ['대학 도시', '연구 단지', '과학 수도'], eff: { research: 0.014 }, text: '연구 +1.4%' },
  { id: 'tour', icon: '🎡', name: '관광', belt: '관광 벨트', steps: ['관광 거리', '국제 행사 도시', '세계 관광 도시'], eff: { approval: 0.3, diplo: 0.5 }, text: '지지도 +0.3 · 외교 +0.5' },
  { id: 'mil', icon: '🪖', name: '군사', belt: '방위 벨트', steps: ['주둔 도시', '군수 도시', '요새 도시'], eff: { defense: 0.7, troop: 0.008 }, text: '안보 +0.7 · 병력 +0.8%' },
  { id: 'fin', icon: '🏦', name: '금융', belt: '금융 벨트', steps: ['금융 거리', '금융 중심지', '국제 금융 도시'], eff: { budget: 0.008, economy: 0.4 }, text: '나라 예산 +0.8% · 경제 +0.4' },
];
export const specById = (id: string) => SPECS.find((x) => x.id === id);
/** 단계별 값(나라 하루 예산의 며칠 치)·필요한 도시 단계 */
export const SPEC_COST_DAYS = [1, 2.5, 5];
export const SPEC_NEED_STAGE = [0, 2, 4];
/** 같은 길 도시가 이만큼이면 그 길 효과 ×SPEC_BELT_MUL */
export const SPEC_BELT_AT = 3;
export const SPEC_BELT_MUL = 1.25;

export interface CitySpec {
  path: SpecId;
  lv: number;
}
export const specMap = (s: GameState): Record<string, CitySpec> => domOf(s).spec ?? {};
/** 지금 내 도시의 특화만 */
export function liveSpecs(s: GameState): Array<[string, CitySpec]> {
  const me = s.player.countryId;
  return Object.entries(specMap(s)).filter(([c, v]) => s.world.owner[c] === me && v.lv > 0 && !!specById(v.path));
}
export const beltOn = (s: GameState, path: SpecId) => liveSpecs(s).filter(([, v]) => v.path === path).length >= SPEC_BELT_AT;

export function specCost(s: GameState, cityId: string, lv: number): number {
  const v = cityById(cityId)?.value ?? 1;
  return Math.round(budgetPerDay(s, s.player.countryId) * SPEC_COST_DAYS[lv - 1] * v);
}
/** 그 도시를 그 길로 한 단계 올릴 수 있는지(다른 길이면 1단계부터 다시) */
export function canSpec(s: GameState, cityId: string, path: SpecId): string | null {
  if (!specById(path)) return '없는 길이에요';
  if (s.world.owner[cityId] !== s.player.countryId) return '내 도시가 아니에요';
  const cur = specMap(s)[cityId];
  const next = cur && cur.path === path ? cur.lv + 1 : 1;
  if (next > 3) return '끝까지 키웠어요';
  const need = SPEC_NEED_STAGE[next - 1];
  if (cityStage(s, cityId).stage.lv < need) return `도시 ${need}단계부터`;
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < specCost(s, cityId, next)) return '나라 예산이 모자라요';
  return null;
}
export function upSpec(s: GameState, cityId: string, path: SpecId): GameState {
  if (canSpec(s, cityId, path)) return s;
  const cur = specMap(s)[cityId];
  const next = cur && cur.path === path ? cur.lv + 1 : 1;
  const paid = payTreasury(s, specCost(s, cityId, next));
  if (!paid) return s;
  const def = specById(path)!;
  const name = cityById(cityId)?.name ?? cityId;
  const hadBelt = beltOn(paid, path);
  let ns = withDom(paid, { spec: { ...specMap(paid), [cityId]: { path, lv: next } } });
  ns = domLog(ns, `${def.icon} ${name} ${def.steps[next - 1]}(${def.name} ${next}단계)`);
  if (!hadBelt && beltOn(ns, path)) ns = domLog(ns, `✨ ${def.belt} 완성: ${def.name} 효과 ×${SPEC_BELT_MUL}`);
  return next === 3 ? snap(ns, 'groundbreak', `${name}, ${def.steps[2]}`, `${def.name}의 길을 끝까지 걸었어요.`) : ns;
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  const live = liveSpecs(s);
  for (const def of SPECS) {
    const per = def.eff[key];
    if (!per) continue;
    const mine = live.filter(([, v]) => v.path === def.id);
    const lv = mine.reduce((a, [, v]) => a + v.lv, 0);
    if (!lv) continue;
    const belt = mine.length >= SPEC_BELT_AT;
    rows.push([`${def.icon} ${belt ? def.belt : `${def.name} 도시`} ${mine.length}곳`, per * lv * (belt ? SPEC_BELT_MUL : 1)]);
  }
  return rows;
});
