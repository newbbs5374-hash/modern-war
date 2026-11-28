// 11/28 디자인 개편 9단계: 국정·사람 칸 아이콘을 이모지 → 반실사 그림으로.
// 대장 그림(icon-tab-<가지>-<칸>.webp, 명령문 guides/design-revamp/design-revamp-art.md)이 오면 그것을,
// 오기 전에는 이미 있는 비슷한 그림을, 그것도 없으면 이모지를 쓴다.
import type { ReactNode } from 'react';
import { iconArt } from './iconArt';

/** 그림이 오기 전 임시로 빌려 쓰는 그림 */
const STAND_IN: Record<string, string> = {
  'defense/ops': 'icon-ui-orders', 'defense/train': 'icon-train-shooting', 'defense/forces': 'icon-unit-infantry', 'defense/command': 'icon-stat-command',
  'defense/spy': 'icon-train-intel', 'defense/tech': 'icon-tech-m-radar', 'defense/fac': 'icon-card-mil-defense',
  'diplo/mofa': 'icon-ui-diplo', 'diplo/nations': 'icon-vault-intel', 'diplo/heg': 'icon-vault-power', 'diplo/rel': 'icon-card-dip-alliance',
  'diplo/agree': 'icon-card-dip-pact', 'diplo/deploy': 'icon-card-mil-rapid', 'diplo/isle': 'island-coral', 'diplo/council': 'icon-card-dip-mediate',
  'society/mins': 'icon-min-mois', 'society/city': 'icon-vault-cities', 'society/gov': 'icon-gov-republic', 'society/tech': 'icon-tech-s-school',
  'society/politics': 'icon-gov-assembly', 'society/nation': 'icon-ui-briefing', 'society/press': 'icon-card-dip-broadcast', 'society/opinion': 'icon-ui-society',
  'economy/vault': 'icon-vault-budget', 'economy/macro': 'icon-vault-stock', 'economy/tax': 'icon-card-eco-tax', 'economy/res': 'icon-res-oil',
  'economy/ind': 'icon-card-eco-industry', 'economy/trade': 'icon-vault-trade', 'economy/facall': 'icon-vault-facility', 'economy/proj': 'icon-card-eco-develop',
  'culture/venue': 'icon-cul-stage-3', 'culture/works': 'icon-cul-work-relic-1', 'culture/stars': 'icon-cul-star-artist', 'culture/tour': 'icon-cul-course-cruise',
  'culture/event': 'icon-cul-ev-fireworks', 'culture/world': 'icon-ui-culture',
  'personal/profile': 'icon-ui-personal', 'personal/win': 'icon-cul-ev-olympics', 'personal/aides': 'icon-ui-aide', 'personal/talent': 'icon-stat-leadership',
  'personal/meet': 'icon-stat-charisma', 'personal/plan': 'icon-ui-briefing', 'personal/agenda': 'icon-ui-orders',
};

export function tabArtUrl(key: string): string | null {
  const [b, l] = key.split('/');
  return iconArt(`icon-tab-${b}-${l}`) ?? (STAND_IN[key] ? iconArt(STAND_IN[key]) : null);
}

/** 칸 아이콘: 그림 있으면 그림, 없으면 이모지 */
export function TabArt({ k, e, cls = 'tab-art' }: { k: string; e: ReactNode; cls?: string }) {
  const url = tabArtUrl(k);
  return url ? <img className={cls} src={url} alt="" draggable={false} /> : <>{e}</>;
}

/** 탭 목록의 이모지를 그림으로 바꿔 줌(잠긴 칸은 kit의 Tabs가 🔒로 그림) */
export function artTabs<T extends { id: string; icon: ReactNode }>(branch: string, tabs: T[]): T[] {
  return tabs.map((t) => ({ ...t, icon: <TabArt k={`${branch}/${t.id}`} e={t.icon} /> }));
}
