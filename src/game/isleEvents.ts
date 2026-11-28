// 11-28 국정 37 강화: 분쟁 지역 사건. 실제 18~30시간마다, 우리가 영향력을 다투는 섬에서 사건이 터짐(돌발 사건 카드로).
// 대상 나라 = 그 섬의 1등(우리가 1등이면 2등). 고른 답에 따라 그 섬 영향력·긴장·호감이 바뀜.
import { PIONEER_ISLANDS } from '../data/hexmap';
import { civOf, islandLeader } from './civ';
import { CRISIS_ANSWER_MS, crisisOf, registerCrises, type CrisisDef } from './crisis';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive } from './world';

const H = 3600e3;
export const ISLE_EV_FIRST = 12 * H;
export const ISLE_EV_GAP: [number, number] = [18, 30];

export const ISLE_CRISES: CrisisDef[] = [
  {
    id: 'isle_fish',
    icon: '🎣',
    title: '분쟁 지역 어선 나포',
    text: '{I} 앞바다에서 {X} 해경이 우리 어선을 붙잡아 갔어요. 어민들이 정부만 바라보고 있어요.',
    target: 'any',
    auto: 1,
    options: [
      { label: '해경 함정을 보내 강하게 맞서요', fx: [{ k: 'isle', v: 12 }, { k: 'tension', v: 15 }, { k: 'favor', who: 'target', v: -6 }], say: '우리 함정이 나타나자 {X} 해경이 어선을 풀어 줬습니다. {I}는 우리 바다입니다!' },
      { label: '외교 채널로 조용히 풀어요', fx: [{ k: 'money', v: -2000 }, { k: 'isle', v: 4 }, { k: 'favor', who: 'target', v: 3 }], say: '{X}와 협상 끝에 어민들이 돌아왔습니다.' },
      { label: '크게 키우지 않고 넘어가요', fx: [{ k: 'isle', v: -6 }, { k: 'trust', v: -3 }], say: '어민들 사이에 정부가 약하다는 말이 돕니다.' },
    ],
  },
  {
    id: 'isle_light',
    icon: '🗼',
    title: '분쟁 지역에 등대 세우기',
    text: '{I}에 우리 등대를 세우자는 말이 나왔어요. {X}는 "선을 넘지 마라"고 경고해요.',
    target: 'any',
    auto: 1,
    options: [
      { label: '등대를 세워요', fx: [{ k: 'money', v: -3000 }, { k: 'isle', v: 15 }, { k: 'tension', v: 8 }], say: '{I}에 우리 등대 불이 켜졌습니다. 이제 누가 봐도 우리 섬입니다.' },
      { label: '{X}에 공동 관리를 제안해요', fx: [{ k: 'isle', v: 5 }, { k: 'favor', who: 'target', v: 6 }], say: '{X}가 공동 관리 제안을 반겼습니다. 영향력도 조금 올랐습니다.' },
      { label: '지금은 미뤄요', fx: [{ k: 'trust', v: -1 }], say: '등대 이야기는 다음으로 미뤘습니다.' },
    ],
  },
  {
    id: 'isle_patrol',
    icon: '🚢',
    title: '분쟁 지역 순시선 대치',
    text: '{I} 근처에서 우리 순시선과 {X} 군함이 서로 비키지 않고 버티고 있어요.',
    target: 'any',
    auto: 2,
    options: [
      { label: '끝까지 버텨요', fx: [{ k: 'troops', v: -0.01 }, { k: 'isle', v: 10 }, { k: 'tension', v: 12 }], say: '{X} 군함이 먼저 물러났습니다! 작은 충돌은 있었지만 {I}를 지켰습니다.' },
      { label: '한발 물러서요', fx: [{ k: 'isle', v: -8 }, { k: 'tension', v: -10 }], say: '충돌은 피했지만 {I}에서 우리 목소리가 작아졌습니다.' },
      { label: '국제 회의에 호소해요', fx: [{ k: 'money', v: -1500 }, { k: 'isle', v: 6 }, { k: 'favor', who: 'all', v: 2 }], say: '여러 나라가 우리 편을 들어 줬습니다.' },
    ],
  },
];
registerCrises(ISLE_CRISES);

/** 사건이 날 섬: 우리 영향력이 있고 1등과 차이가 가장 작은 섬(우리가 1등이면 2등과 차이가 가장 작은 섬) */
export function isleHot(s: GameState): { isle: string; rival: string } | null {
  const me = s.player.countryId;
  const inf = civOf(s).influence;
  let best: { isle: string; rival: string; gap: number } | null = null;
  for (const p of PIONEER_ISLANDS) {
    const m = inf[p.id] ?? {};
    const mine = m[me] ?? 0;
    if (mine <= 0) continue;
    const lead = islandLeader(s, p.id);
    let rival = lead.id;
    let gap = lead.v - mine;
    if (lead.id === me || !lead.id) {
      const second = Object.entries(m)
        .filter(([id]) => id !== me && isAlive(s.world, id))
        .sort((a, b) => b[1] - a[1])[0];
      if (!second) continue;
      rival = second[0];
      gap = mine - second[1];
    }
    if (!rival || rival === me || !isAlive(s.world, rival)) continue;
    if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { isle: p.id, rival, gap };
  }
  return best ? { isle: best.isle, rival: best.rival } : null;
}

export function isleEventTick(s: GameState): GameState {
  if (s.ending) return s;
  if (s.isleEvMs === undefined) return { ...s, isleEvMs: s.worldMs + ISLE_EV_FIRST };
  if (s.worldMs < s.isleEvMs) return s;
  const c = crisisOf(s);
  if (!s.crisis || c.open) return { ...s, isleEvMs: s.worldMs + H };
  const rng = new Rng(((Math.floor(s.worldMs / H) * 40503 + 17) >>> 0) || 1);
  const next = s.worldMs + (ISLE_EV_GAP[0] + rng.next() * (ISLE_EV_GAP[1] - ISLE_EV_GAP[0])) * H;
  const hot = isleHot(s);
  if (!hot) return { ...s, isleEvMs: next };
  const d = rng.pick(ISLE_CRISES);
  return {
    ...s,
    isleEvMs: next,
    crisis: { ...c, open: { id: c.nextId, def: d.id, target: hot.rival, untilMs: s.worldMs + CRISIS_ANSWER_MS, isle: hot.isle }, nextId: c.nextId + 1, nextMs: Math.max(c.nextMs, s.worldMs + CRISIS_ANSWER_MS + 2 * H) },
  };
}
