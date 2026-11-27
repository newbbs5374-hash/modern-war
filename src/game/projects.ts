// A4 국가 대형 사업(11/24): 고속철도·원전·우주발사체 등 10개. 설계 → 공사 → 마무리 → 완공, 단계마다 나라 예산과 실제 시간.
// 한꺼번에 2개까지. 완공하면 판 끝까지 효과 + 이익집단 반응. 공사 중인 도시는 본부 지도·도시 화면에 공사 모습.
import type { GameState } from './state';
import type { LawKey } from './laws';
import { domLog, domOf, payTreasury, registerDomRows, snap, withDom, type ProjectState, type Rows } from './domestic';
import { registerGroupRows } from './groups';
import { addPresMod } from './approval';
import { cityById, isCoastalCity } from '../data/cities';
import { priceBase } from './state';
import { myCityIds } from './zones';

const H = 3600e3;
export const PROJECT_MAX = 2;
export const STAGES = ['설계', '공사', '마무리'] as const;
/** 단계별 시간(실제 시간) */
export const STAGE_HOURS = [4, 16, 8];
/** 단계별 비용(시간당 나라 예산 수입의 몇 배) */
export const STAGE_COST = [2, 6, 3];

export interface ProjectDef {
  id: string;
  icon: string;
  name: string;
  text: string;
  /** 비용·시간 배율 */
  scale: number;
  eff: Partial<Record<LawKey, number>>;
  groups: Partial<Record<string, number>>;
  /** 어떤 도시에 지을지 */
  where: 'any' | 'coastal' | 'notCapital';
  scene: string;
}
export const PROJECTS: ProjectDef[] = [
  { id: 'rail', icon: '🚄', name: '고속철도', text: '자원 +5% · 모든 도시 민심 +3', scale: 1, eff: { res: 0.05, loyalty: 3 }, groups: { labor: 3, biz: 3 }, where: 'any', scene: 'groundbreak' },
  { id: 'nuke', icon: '⚛️', name: '원자력 발전소', text: '자원 +8% · 경제 +2', scale: 1.2, eff: { res: 0.08, economy: 2 }, groups: { biz: 4, civic: -8, youth: -2 }, where: 'coastal', scene: 'factory' },
  { id: 'space', icon: '🚀', name: '우주발사체', text: '연구 +10% · 외교 +2', scale: 1.4, eff: { research: 0.1, diplo: 2 }, groups: { youth: 6, press: 3 }, where: 'coastal', scene: 'launch' },
  { id: 'chip', icon: '💽', name: '반도체 클러스터', text: '나라 예산 +6% · 연구 +4%', scale: 1.3, eff: { budget: 0.06, research: 0.04 }, groups: { biz: 6, youth: 4 }, where: 'any', scene: 'factory' },
  { id: 'air', icon: '🛫', name: '신공항', text: '외교 +4 · 경제 +3', scale: 1, eff: { diplo: 4, economy: 3 }, groups: { biz: 4, civic: -2 }, where: 'coastal', scene: 'groundbreak' },
  { id: 'carrier', icon: '🛳️', name: '항공모함 건조', text: '모집 +5% · 안보 +4', scale: 1.5, eff: { build: 0.05, defense: 4 }, groups: { mil: 6, civic: -3 }, where: 'coastal', scene: 'port' },
  { id: 'sub', icon: '🌊', name: '핵추진 잠수함', text: '안보 +6 · 첩보 +4%', scale: 1.4, eff: { defense: 6, spy: 0.04 }, groups: { mil: 6, civic: -4 }, where: 'coastal', scene: 'port' },
  { id: 'capital', icon: '🏛️', name: '행정수도 이전', text: '사회 +5 · 신뢰도 +3', scale: 1.2, eff: { society: 5, trust: 3 }, groups: { civic: 4, biz: -3 }, where: 'notCapital', scene: 'ceremony' },
  { id: 'olympic', icon: '🏟️', name: '올림픽 유치', text: '지지도 +4 · 외교 +5', scale: 1.1, eff: { approval: 4, diplo: 5 }, groups: { youth: 6, press: 3 }, where: 'any', scene: 'ceremony' },
  { id: 'shield', icon: '🛡️', name: '미사일 방어망', text: '안보 +8', scale: 1.3, eff: { defense: 8 }, groups: { mil: 4, civic: -2 }, where: 'any', scene: 'airbase' },
  // 11-28 국정 37 강화(국가 사업 10 → 20)
  { id: 'tunnel', icon: '🚇', name: '해저터널', text: '자원 +4% · 외교 +3', scale: 1.4, eff: { res: 0.04, diplo: 3 }, groups: { biz: 5, civic: -2 }, where: 'coastal', scene: 'groundbreak' },
  { id: 'smart', icon: '🏙️', name: '스마트시티', text: '나라 예산 +4% · 민심 +4', scale: 1.2, eff: { budget: 0.04, loyalty: 4 }, groups: { youth: 5, biz: 3 }, where: 'notCapital', scene: 'groundbreak' },
  { id: 'station', icon: '🛰️', name: '우주정거장', text: '연구 +8% · 첩보 +3%', scale: 1.6, eff: { research: 0.08, spy: 0.03 }, groups: { youth: 5, press: 3 }, where: 'coastal', scene: 'launch' },
  { id: 'fusion', icon: '☀️', name: '핵융합 실험로', text: '자원 +6% · 연구 +5%', scale: 1.7, eff: { res: 0.06, research: 0.05 }, groups: { biz: 4, civic: -3 }, where: 'any', scene: 'factory' },
  { id: 'port', icon: '⚓', name: '국제 물류 항만', text: '나라 예산 +5% · 경제 +2', scale: 1.1, eff: { budget: 0.05, economy: 2 }, groups: { labor: 4, biz: 4 }, where: 'coastal', scene: 'port' },
  { id: 'dam', icon: '🌊', name: '다목적 댐', text: '자원 +3% · 지지도 +2', scale: 0.9, eff: { res: 0.03, approval: 2 }, groups: { labor: 3, civic: -4 }, where: 'any', scene: 'groundbreak' },
  { id: 'aiLab', icon: '🤖', name: '국가 AI 연구원', text: '연구 +7% · 모집 +3%', scale: 1.3, eff: { research: 0.07, build: 0.03 }, groups: { youth: 6, labor: -3 }, where: 'any', scene: 'factory' },
  { id: 'expo', icon: '🎡', name: '세계 박람회', text: '외교 +5 · 지지도 +3', scale: 1, eff: { diplo: 5, approval: 3 }, groups: { biz: 4, press: 3 }, where: 'any', scene: 'ceremony' },
  { id: 'arsenal', icon: '🏭', name: '국가 방산 단지', text: '모집 +6% · 안보 +3', scale: 1.3, eff: { build: 0.06, defense: 3 }, groups: { mil: 6, labor: 3, civic: -3 }, where: 'notCapital', scene: 'factory' },
  { id: 'gps', icon: '📡', name: '독자 위성항법망', text: '안보 +5 · 첩보 +4%', scale: 1.4, eff: { defense: 5, spy: 0.04 }, groups: { mil: 4, youth: 2 }, where: 'coastal', scene: 'launch' },
];
export const projectById = (id: string) => PROJECTS.find((p) => p.id === id)!;

export function stageCost(s: GameState, id: string, stage: number): number {
  return Math.round(priceBase(s) * STAGE_COST[stage] * projectById(id).scale);
}
export function stageMs(id: string, stage: number): number {
  return STAGE_HOURS[stage] * projectById(id).scale * H;
}
/** 지을 수 있는 도시 */
export function projectCities(s: GameState, id: string): string[] {
  const p = projectById(id);
  return myCityIds(s).filter((c) => {
    if (p.where === 'coastal') return isCoastalCity(c);
    if (p.where === 'notCapital') return !cityById(c)?.capital;
    return true;
  });
}
export function busyProjects(s: GameState): Array<[string, ProjectState]> {
  return Object.entries(domOf(s).projects).filter(([, p]) => p.stage < 3 && s.world.owner[p.cityId] === s.player.countryId);
}
/** 11-28 사업 도시를 잃었나(공사 중이면 멈춤, 완공이면 효과 없음) — 되찾거나 다른 도시로 옮기면 다시 이어 감 */
export function projectLost(s: GameState, id: string): boolean {
  const pr = domOf(s).projects[id];
  return !!pr && s.world.owner[pr.cityId] !== s.player.countryId;
}
/** 옮겨 짓는 단계(완공했던 사업은 마무리부터 다시) */
const moveStage = (pr: ProjectState) => Math.min(2, pr.stage);
export const moveCost = (s: GameState, id: string) => {
  const pr = domOf(s).projects[id];
  return pr ? stageCost(s, id, moveStage(pr)) : 0;
};
export function canMoveProject(s: GameState, id: string, cityId: string): string | null {
  if (!projectLost(s, id)) return '사업 도시를 잃지 않았어요';
  const pr = domOf(s).projects[id];
  if (pr.stage < 3 && busyProjects(s).length >= PROJECT_MAX) return `한꺼번에 ${PROJECT_MAX}개까지 할 수 있어요`;
  if (!projectCities(s, id).includes(cityId)) return projectById(id).where === 'coastal' ? '바닷가 도시만 돼요' : '이 도시엔 지을 수 없어요';
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < moveCost(s, id)) return '나라 예산이 모자라요';
  return null;
}
/** 다른 도시로 옮겨 다시 짓기: 지금 단계를 처음부터(완공했던 사업은 마무리부터) */
export function moveProject(s: GameState, id: string, cityId: string): GameState {
  if (canMoveProject(s, id, cityId)) return s;
  const paid = payTreasury(s, moveCost(s, id));
  if (!paid) return s;
  const d = domOf(paid);
  const pr = d.projects[id];
  const st = moveStage(pr);
  const p = projectById(id);
  const ns = withDom(paid, { projects: { ...d.projects, [id]: { stage: st, endMs: s.worldMs + stageMs(id, st), cityId } } });
  return domLog(ns, `${p.icon} ${p.name}을(를) ${cityById(cityId)?.name ?? ''}(으)로 옮겨 ${STAGES[st]}부터 다시 시작`);
}
export function canStartProject(s: GameState, id: string, cityId: string): string | null {
  if (domOf(s).projects[id]) return '이미 시작한 사업이에요';
  if (busyProjects(s).length >= PROJECT_MAX) return `한꺼번에 ${PROJECT_MAX}개까지 할 수 있어요`;
  if (!projectCities(s, id).includes(cityId)) return projectById(id).where === 'coastal' ? '바닷가 도시만 돼요' : '이 도시엔 지을 수 없어요';
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < stageCost(s, id, 0)) return '나라 예산이 모자라요';
  return null;
}
export function startProject(s: GameState, id: string, cityId: string): GameState {
  if (canStartProject(s, id, cityId)) return s;
  const paid = payTreasury(s, stageCost(s, id, 0));
  if (!paid) return s;
  const p = projectById(id);
  const d = domOf(paid);
  let ns = withDom(paid, { projects: { ...d.projects, [id]: { stage: 0, endMs: s.worldMs + stageMs(id, 0), cityId } } });
  ns = domLog(ns, `${p.icon} ${p.name} 설계 시작(${cityById(cityId)?.name ?? ''})`);
  return ns;
}
/** 다음 단계로 넘어가려면 낼 돈(단계가 끝났을 때) */
export function canAdvanceProject(s: GameState, id: string): string | null {
  const pr = domOf(s).projects[id];
  if (!pr || pr.stage >= 3) return '진행 중인 사업이 아니에요';
  if (projectLost(s, id)) return '공사 도시를 잃어 멈췄어요. 되찾거나 다른 도시로 옮기세요';
  if (pr.endMs > s.worldMs) return '지금 단계가 아직 안 끝났어요';
  if (pr.stage === 2) return null;
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < stageCost(s, id, pr.stage + 1)) return '나라 예산이 모자라요';
  return null;
}
export function advanceProject(s: GameState, id: string): GameState {
  if (canAdvanceProject(s, id)) return s;
  const d = domOf(s);
  const pr = d.projects[id];
  const p = projectById(id);
  const city = cityById(pr.cityId)?.name ?? '';
  if (pr.stage === 2) {
    let ns = withDom(s, { projects: { ...d.projects, [id]: { ...pr, stage: 3, endMs: 0 } } });
    ns = addPresMod(ns, `${p.icon} ${p.name} 완공`, 4, 24);
    ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 25 } };
    ns = domLog(ns, `🎉 ${p.icon} ${p.name} 완공!(${city}) ${p.text}`);
    return snap(ns, p.scene === 'launch' ? 'launch' : 'ceremony', `${p.name} 완공`, `${city} · ${p.text}`);
  }
  const paid = payTreasury(s, stageCost(s, id, pr.stage + 1));
  if (!paid) return s;
  const next = pr.stage + 1;
  let ns = withDom(paid, { projects: { ...domOf(paid).projects, [id]: { ...pr, stage: next, endMs: s.worldMs + stageMs(id, next) } } });
  ns = domLog(ns, `${p.icon} ${p.name} ${STAGES[next]} 시작(${city})`);
  if (next === 1) ns = snap(ns, 'groundbreak', `${p.name} 착공`, city);
  return ns;
}
/** 공사 중인 도시(지도 연출) */
export function buildingCities(s: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, p] of busyProjects(s)) if (p.stage >= 1) out[p.cityId] = projectById(id).icon;
  return out;
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  for (const [id, pr] of Object.entries(domOf(s).projects)) {
    const p = projectById(id);
    if (pr.stage >= 3 && p?.eff[key] && s.world.owner[pr.cityId] === s.player.countryId) rows.push([`${p.icon} ${p.name}`, p.eff[key]!]);
  }
  return rows;
});
registerGroupRows((s, g) => {
  const rows: Rows = [];
  for (const [id, pr] of Object.entries(domOf(s).projects)) {
    const p = projectById(id);
    if (pr.stage >= 1 && p?.groups[g]) rows.push([`${p.icon} ${p.name}${pr.stage >= 3 ? '' : ' 공사'}`, p.groups[g]!]);
  }
  return rows;
});
