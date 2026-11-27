// 내정 지표(국정 과제 목표·뉴스·사진첩이 읽음). 함수 안에서만 다른 계산을 부름(순환 안전).
import { MIL_TECHS, SOC_TECHS } from '../data/civ';
import { budgetPerDay, type GameState } from './state';
import { civOf, cityTotals } from './civ';
import { armyPower } from './economy';
import { approvalOf, fieldValue } from './approval';
import { domOf } from './domestic';
import { liveZones } from './zones';
import './arms'; // 효과 줄 등록(방산 수출)
import './citySpec'; // 효과 줄 등록(도시 특화)

export type MetricId =
  | 'troops' | 'power' | 'budget' | 'mil' | 'soc' | 'approval' | 'trust' | 'loyalty' | 'pop'
  | 'agree' | 'laws' | 'trade' | 'projects' | 'zones' | 'fdef' | 'fdip' | 'fsoc' | 'feco' | 'fame' | 'codes';

export const METRICS: Record<MetricId, { icon: string; name: string; unit: string; scaled?: boolean; plus?: boolean }> = {
  troops: { icon: '🪖', name: '병력', unit: '명', scaled: true },
  power: { icon: '⚔️', name: '부대 전투력', unit: '', scaled: true },
  budget: { icon: '💵', name: '하루 나라 예산', unit: '', scaled: true },
  mil: { icon: '⚙️', name: '군사 연구', unit: '개' },
  soc: { icon: '📜', name: '사회 연구', unit: '개' },
  approval: { icon: '🙂', name: '지지도', unit: '', plus: true },
  trust: { icon: '🤝', name: '신뢰도', unit: '', plus: true },
  loyalty: { icon: '🏘️', name: '도시 민심 평균', unit: '', plus: true },
  pop: { icon: '👪', name: '도시 인구 합', unit: '단계', scaled: true },
  agree: { icon: '📄', name: '맺은 협정', unit: '개' },
  laws: { icon: '📜', name: '통과시킨 법안', unit: '개' },
  trade: { icon: '🚢', name: '무역 계약', unit: '개' },
  projects: { icon: '🏗️', name: '완공한 국가 사업', unit: '개' },
  zones: { icon: '🏙️', name: '지정한 특구', unit: '곳' },
  fdef: { icon: '🛡️', name: '안보 점수', unit: '', plus: true },
  fdip: { icon: '🌐', name: '외교 위상', unit: '', plus: true },
  fsoc: { icon: '👥', name: '사회 안정', unit: '', plus: true },
  feco: { icon: '💰', name: '경제 지수', unit: '', plus: true },
  fame: { icon: '⭐', name: '명성', unit: '' },
  codes: { icon: '⚖️', name: '바꾼 기본법', unit: '칸' },
};

const MIL = new Set(MIL_TECHS.map((t) => t.id));
const SOC = new Set(SOC_TECHS.map((t) => t.id));

export function metric(s: GameState, id: MetricId): number {
  const me = s.player.countryId;
  switch (id) {
    case 'troops':
      return s.nations[me]?.troops ?? 0;
    case 'power':
      return armyPower(s);
    case 'budget':
      return budgetPerDay(s, me);
    case 'mil':
      return civOf(s).done.filter((t) => MIL.has(t)).length;
    case 'soc':
      return civOf(s).done.filter((t) => SOC.has(t)).length;
    case 'approval':
      return approvalOf(s);
    case 'trust':
      return s.officer.trust;
    case 'loyalty':
      return cityTotals(s).avgLoyalty;
    case 'pop':
      return cityTotals(s).pop;
    case 'agree':
      return civOf(s).agreements.filter((a) => a.untilMs > s.worldMs).length;
    case 'laws':
      return s.assembly?.passed ?? 0;
    case 'trade':
      return s.economy.contracts?.length ?? 0;
    case 'projects':
      return Object.values(domOf(s).projects).filter((p) => p.stage >= 3).length;
    case 'zones':
      return liveZones(s).length;
    case 'fdef':
      return fieldValue(s, 'defense');
    case 'fdip':
      return fieldValue(s, 'diplo');
    case 'fsoc':
      return fieldValue(s, 'society');
    case 'feco':
      return fieldValue(s, 'economy');
    case 'fame':
      return s.officer.fame;
    case 'codes':
      return Object.values(domOf(s).codes.pick).filter((v) => v !== 1).length;
  }
}
