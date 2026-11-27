// 11-28 국정 37 강화(국방·부대): 편성 묶음 — 상륙전·방어·공습 묶음을 한 번에 모집 줄에 세움(만들 수 있는 것만, 줄이 차면 멈춤).
import { canProduce, produce, QUEUE_MAX } from './economy';
import type { GameState } from './state';

export interface Preset {
  id: string;
  icon: string;
  name: string;
  /** 차례대로 세울 병과(앞에서부터, 못 만들면 건너뜀) */
  units: string[];
  text: string;
}
export const PRESETS: Preset[] = [
  { id: 'land', icon: '🚢', name: '상륙전', units: ['강습상륙함', '상륙장갑차', '구축함', '보병', '공격헬기'], text: '바닷가 도시 점령용' },
  { id: 'guard', icon: '🛡️', name: '방어', units: ['방공부대', '전차', '포병', '보병', '조기경보기'], text: '미사일·침공 막기' },
  { id: 'air', icon: '✈️', name: '공습', units: ['전투기', '폭격기', '무인드론', '미사일', '조기경보기'], text: '먼 도시를 하늘에서' },
];
/** 지금 그 묶음에서 세울 수 있는 병과 */
export function presetPlan(s: GameState, p: Preset): string[] {
  const out: string[] = [];
  let ns = s;
  for (const u of p.units) {
    if (ns.economy.queue.length >= QUEUE_MAX) break;
    if (canProduce(ns, u)) continue;
    ns = produce(ns, u);
    out.push(u);
  }
  return out;
}
export function canPreset(s: GameState, p: Preset): string | null {
  if (s.economy.queue.length >= QUEUE_MAX) return '모집 줄이 다 찼어요';
  return presetPlan(s, p).length ? null : '지금 이 묶음에서 만들 수 있는 부대가 없어요(호칭·연구·자원 확인)';
}
export function producePreset(s: GameState, p: Preset): GameState {
  let ns = s;
  for (const u of p.units) {
    if (ns.economy.queue.length >= QUEUE_MAX) break;
    if (!canProduce(ns, u)) ns = produce(ns, u);
  }
  return ns;
}
