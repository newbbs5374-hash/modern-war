// 11-28 국방 장관 추천: 생산 줄이 비면 돈값(전투력 ÷ 국방비)이 가장 좋은 부대 만들기.
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';
import { TECHS } from '../data/civ';
import { BUILDING_IDS, UNIT_COST } from '../data/economy';
import { canResearch, civOf, startResearch, techPayWhy, techPrice } from './civ';
import { canProduce, canUpgrade, isDefBuilding, produce, QUEUE_MAX, upgradeCost, upgradeFacility } from './economy';
import { canSpy, spyChance, spyOf, startSpy } from './spy';
import { COUNTRIES } from '../data/world';
import { pairKey, spoilsOf } from './world';
import { canGrand, grandTargets } from './officer';
import { cityById } from '../data/cities';

export function produceRecs(s: GameState): Rec[] {
  const free = QUEUE_MAX - s.economy.queue.length;
  if (free <= 0) return [];
  const ok = Object.entries(UNIT_COST).filter(([n]) => !canProduce(s, n));
  if (!ok.length) return [];
  const [n, c] = ok.sort((a, b) => b[1].power / Math.max(1, b[1].money) - a[1].power / Math.max(1, a[1].money))[0];
  return [
    {
      id: `prod:${n}`,
      field: 'defense',
      tab: 'forces',
      icon: '🏭',
      title: `${n} 만들기 (생산 줄 ${free}칸 빔)`,
      value: c.power * 120 + free * 200,
      gain: (k) => `전투력 +${Math.round(c.power * k)} · 🛡️−${approx(c.money)}`,
      why: `지금 만들 수 있는 부대 중 국방비 대비 전투력이 가장 좋아요(${c.hours}시간).`,
      act: (x) => produce(x, n),
      can: (x) => canProduce(x, n),
    },
  ];
}

registerRecs('defense', produceRecs);

// ── 11-28 4단계: 연구 고르기(국방=군사, 내정=사회) · 국방 시설 · 정보전 ──

/** 멈춘 연구 줄: 지금 시작할 수 있는 가장 짧은 연구(병과를 여는 연구 먼저) */
export function researchRecs(line: 'mil' | 'soc') {
  return (s: GameState): Rec[] => {
    if (civOf(s).cur[line]) return [];
    const ok = TECHS.filter((t) => t.line === line && !canResearch(s, t.id) && !techPayWhy(s, t.id)).sort((a, b) => (b.units ? 1 : 0) - (a.units ? 1 : 0) || a.hours - b.hours);
    const t = ok[0];
    if (!t) return [];
    const p = techPrice(s, t);
    return [
      {
        id: `tech:${t.id}`,
        field: line === 'mil' ? 'defense' : 'society',
        tab: 'tech',
        icon: t.icon,
        title: `${t.name} 연구 시작`,
        value: 6000,
        gain: () => (t.units ? `${t.units.join('·')} 열림` : t.text) + (p.money ? ` · −${approx(p.money)}` : ''),
        why: `${line === 'mil' ? '군사' : '사회'} 연구 줄이 멈춰 있어요. 지금 시작할 수 있는 것 중 ${t.units ? '새 부대를 여는' : '가장 빨리 끝나는'} 연구예요(${t.hours}시간).`,
        act: (x) => startResearch(x, t.id),
        can: (x) => canResearch(x, t.id) ?? techPayWhy(x, t.id),
      },
    ];
  };
}

export function defFacRecs(s: GameState): Rec[] {
  const id = BUILDING_IDS.filter((b) => isDefBuilding(b) && !canUpgrade(s, b)).sort((a, b) => upgradeCost(s, a).money - upgradeCost(s, b).money)[0];
  if (!id) return [];
  const c = upgradeCost(s, id);
  const lv = s.economy.buildings[id].level;
  return [
    {
      id: `deffac:${id}`,
      field: 'defense',
      tab: 'fac',
      icon: '🏗️',
      title: `${id} ${lv}→${lv + 1}단계`,
      value: 2500 + c.money * 0.2,
      gain: () => `🛡️−${approx(c.money)} · ${c.hours}시간`,
      why: '준비된 국방 시설 중 가장 싸게 올릴 수 있어요.',
      act: (x) => upgradeFacility(x, id),
      can: (x) => canUpgrade(x, id),
    },
  ];
}

/** 정보전: 돌아가는 공작이 없으면 긴장이 가장 높은 나라 정찰 */
export function spyRecs(s: GameState): Rec[] {
  if (spyOf(s).active.length) return [];
  const me = s.player.countryId;
  const t = COUNTRIES.filter((c) => c.id !== me && !canSpy(s, 'scout', c.id)).sort((a, b) => (s.world.pairs[pairKey(me, b.id)]?.tension ?? 0) - (s.world.pairs[pairKey(me, a.id)]?.tension ?? 0))[0];
  if (!t) return [];
  const ch = Math.round(spyChance(s, 'scout', t.id) * 100);
  return [
    {
      id: `spy:scout:${t.id}`,
      field: 'defense',
      tab: 'spy',
      icon: '🕵️',
      title: `${t.name} 정찰 공작`,
      value: 2000,
      gain: () => `성공 확률 ${ch}% · 병력·도시 정보`,
      why: '돌아가는 공작이 없어요. 우리와 긴장이 가장 높은 나라부터 살피는 게 좋아요.',
      act: (x) => startSpy(x, 'scout', t.id),
      can: (x) => canSpy(x, 'scout', t.id),
    },
  ];
}

registerRecs('defense', researchRecs('mil'));
registerRecs('society', researchRecs('soc'));
registerRecs('defense', defFacRecs);
registerRecs('defense', spyRecs);

/** 작전: 대전투를 할 수 있으면 방어도가 가장 낮은 도시(직접 출격하는 일이라 보기만) */
export function grandRecs(s: GameState): Rec[] {
  if (canGrand(s)) return [];
  const c = grandTargets(s)[0];
  if (!c) return [];
  const owner = s.world.owner[c];
  const sp = spoilsOf(s.world, c, owner, s.nations[owner]?.treasury ?? 0);
  return [
    {
      id: `grand:${c}`,
      field: 'defense',
      tab: 'ops',
      icon: '🏙️',
      title: `${cityById(c).name} 대전투`,
      value: 8000 + sp.loot * 0.1,
      gain: (k) => `전리품 약 +${approx(sp.loot * k)}`,
      why: `대전투 준비가 끝났어요. 지금 칠 수 있는 도시 중 방어도(${Math.round(s.world.defense[c])})가 가장 낮아요.`,
    },
  ];
}
registerRecs('defense', grandRecs);
