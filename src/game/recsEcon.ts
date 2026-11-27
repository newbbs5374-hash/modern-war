// 11-28 국정 37 강화 3단계: 경제 나머지 칸 장관 추천(금고·경기·산업 시설·공사 관리·국가 사업).
import { BUILDING_IDS, buildingInfo } from '../data/economy';
import { canChore, canUpgrade, isDefBuilding, startChore, upgradeCost, upgradeFacility } from './economy';
import { canMoveDef, defMoveAmount, defOf, moveDefToNation } from './defFund';
import { canSetRate, overheat, setRate } from './econ';
import { PROJECTS, PROJECT_MAX, advanceProject, busyProjects, canAdvanceProject, canStartProject, projectCities, stageCost, startProject } from './projects';
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';

/** 금고: 나라 예산이 바닥인데 국방비가 남으면 옮기기 */
export function vaultRecs(s: GameState): Rec[] {
  const t = s.nations[s.player.countryId]?.treasury ?? 0;
  if (canMoveDef(s) || t > defOf(s) * 0.1) return [];
  const m = defMoveAmount(s);
  return [
    {
      id: 'vault:move',
      field: 'economy',
      tab: 'vault',
      icon: '🔄',
      title: `국방비 ${approx(m.from)} → 나라 예산으로 옮기기`,
      value: m.to * 0.5,
      gain: (k) => `예산 +${approx(m.to * k)}`,
      why: `나라 예산(${approx(t)})이 국방비(${approx(defOf(s))})에 비해 너무 적어요. 10%는 행정 비용으로 사라져요.`,
      act: moveDefToNation,
      can: canMoveDef,
    },
  ];
}

/** 경기: 과열이 위기까지 12시간도 안 남으면 금리 올리기 */
export function macroRecs(s: GameState): Rec[] {
  if (!s.polity || s.polity.econ.crisis) return [];
  const o = overheat(s);
  if (o.hoursLeft == null || o.hoursLeft > 12 || canSetRate(s, 1)) return [];
  const h = o.hoursLeft;
  return [
    {
      id: 'macro:up',
      field: 'economy',
      tab: 'macro',
      icon: '📈',
      title: '금리 올리기(과열 식히기)',
      value: 8000 + (12 - h) * 1000,
      gain: () => `위기까지 ${Math.round(h)}시간 → 늦춤`,
      why: `과열 ${Math.round(o.stress)}/${o.at}${o.why.length ? `: ${o.why.slice(0, 2).join(', ')}` : ''}. 위기가 오면 예산·민심이 크게 깎여요.`,
      act: (x) => (canSetRate(x, 1) ? x : setRate(x, 1)),
      can: (x) => canSetRate(x, 1),
    },
  ];
}

/** 산업 시설: 올릴 수 있는 시설 중 가장 싼 것 · 노는 내정 업무 */
export function facRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  const ok = BUILDING_IDS.filter((id) => !isDefBuilding(id) && !canUpgrade(s, id)).sort((a, b) => upgradeCost(s, a).money - upgradeCost(s, b).money);
  if (ok[0]) {
    const id = ok[0];
    const c = upgradeCost(s, id);
    const lv = s.economy.buildings[id].level;
    out.push({
      id: `fac:${id}`,
      field: 'economy',
      tab: 'ind',
      icon: '🏗️',
      title: `${id} ${lv}→${lv + 1}단계 올리기`,
      value: 2500 + c.money * 0.2,
      gain: () => `예산 −${approx(c.money)} · ${c.hours}시간`,
      why: `경험치·돈이 준비된 시설 중 가장 싸게 올릴 수 있어요(${buildingInfo(id).fac}).`,
      act: (x) => upgradeFacility(x, id),
      can: (x) => canUpgrade(x, id),
    });
  }
  if (!canChore(s)) {
    const best = BUILDING_IDS.filter((id) => (s.economy.buildings[id]?.level ?? 0) >= 1).sort((a, b) => s.economy.buildings[b].level - s.economy.buildings[a].level)[0];
    if (best)
      out.push({
        id: `chore:${best}`,
        field: 'economy',
        tab: 'facall',
        icon: '👷',
        title: `${best} 특별 가동 업무 맡기기`,
        value: 1800,
        gain: () => `${buildingInfo(best).fac} 경험치 + 특별 가동`,
        why: '내정 업무 칸이 놀고 있어요. 가장 높은 단계 시설을 돌리면 효과가 커요.',
        act: (x) => startChore(x, best),
        can: canChore,
      });
  }
  return out;
}

/** 국가 사업: 끝난 단계 넘기기 · 빈 칸이면 새 사업 */
export function projectRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  for (const [id, pr] of busyProjects(s)) {
    if (canAdvanceProject(s, id)) continue;
    const p = PROJECTS.find((x) => x.id === id)!;
    const cost = pr.stage < 2 ? stageCost(s, id, pr.stage + 1) : 0;
    out.push({
      id: `proj:adv:${id}`,
      field: 'economy',
      tab: 'proj',
      icon: p.icon,
      title: pr.stage < 2 ? `${p.name} 다음 단계로` : `${p.name} 완공하기`,
      value: 6000 + (pr.stage === 2 ? 6000 : 0),
      gain: () => (pr.stage < 2 ? `예산 −${approx(cost)}` : `완공: ${p.text}`),
      why: '지금 단계가 끝나 기다리고 있어요. 넘기지 않으면 시간이 그냥 흘러요.',
      act: (x) => advanceProject(x, id),
      can: (x) => canAdvanceProject(x, id),
    });
  }
  if (busyProjects(s).length < PROJECT_MAX) {
    // 나라 예산·자원을 키우는 사업 먼저
    const order = ['chip', 'nuke', 'rail', 'air', 'space', 'olympic', 'capital', 'shield', 'carrier', 'sub'];
    for (const id of order) {
      const city = projectCities(s, id).find((c) => !canStartProject(s, id, c));
      if (!city) continue;
      const p = PROJECTS.find((x) => x.id === id)!;
      const cost = stageCost(s, id, 0);
      out.push({
        id: `proj:new:${id}`,
        field: 'economy',
        tab: 'proj',
        icon: p.icon,
        title: `${p.name} 시작하기`,
        value: 4000,
        gain: () => `설계 −${approx(cost)} · 완공하면 ${p.text}`,
        why: `국가 사업 칸이 ${PROJECT_MAX - busyProjects(s).length}개 비어 있어요.`,
        act: (x) => startProject(x, id, city),
        can: (x) => canStartProject(x, id, city),
      });
      break;
    }
  }
  return out;
}

registerRecs('economy', vaultRecs);
registerRecs('economy', macroRecs);
registerRecs('economy', facRecs);
registerRecs('economy', projectRecs);
