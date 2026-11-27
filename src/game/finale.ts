// 11-27 종합 확장안 개편 7: 4장 「마지막 위기」.
// 승리 조건을 채워 4장에 들어서면 ① 가장 센 나라들이 손잡고 선전포고(세계 연합)
// ② 버티는 7일 동안 큰 위기 카드 3장(총공세 · 핵 위기 · 쿠데타)이 차례로 옴.
// 조건을 놓치면 3장으로 돌아가고, 다시 채우면 위기가 처음부터 다시 옴(선전포고는 평화인 나라만).
import { COUNTRIES, countryById } from '../data/world';
import { CRISIS_ANSWER_MS, crisisOf, registerCrises, type CrisisDef } from './crisis';
import { EVENT_LOG_MAX } from './balance';
import { pushReport } from './report';
import type { GameState } from './state';
import { lordOf } from './surrender';
import { declareWar, isAlive, isRival, relationOf } from './world';

const H = 3600e3;
/** 세계 연합에 끼는 나라 수 */
export const FINALE_FOES = 3;
/** 4장에 들어선 뒤 위기 카드가 오는 때(시간) */
export const FINALE_AT_H = [18, 66, 114];

export const FINALE_CRISES: CrisisDef[] = [
  {
    id: 'fin-coalition',
    icon: '🌐',
    title: '세계 연합 총공세',
    text: '우리를 막으려는 나라들이 한꺼번에 군대를 움직였어요. 모든 전선에서 경보가 울려요.',
    auto: 2,
    options: [
      { label: '총동원령을 내려요', fx: [{ k: 'money', v: -8000 }, { k: 'trust', v: 6 }, { k: 'approval', v: -4 }], say: '온 나라가 전선을 받칩니다. 버틸 수 있습니다, 지도자님.' },
      { label: '연합을 외교로 갈라놓아요', fx: [{ k: 'money', v: -5000 }, { k: 'favor', who: 'all', v: 8 }, { k: 'fame', v: 5 }], say: '몇 나라가 발을 뺐습니다. 연합에 금이 갔습니다.' },
      { label: '지금 병력으로 버텨요', fx: [{ k: 'troops', v: -0.08 }, { k: 'trust', v: -4 }], say: '피해가 컸지만 전선은 지켰습니다.' },
    ],
  },
  {
    id: 'fin-nuke',
    icon: '☢️',
    title: '핵 위기',
    text: '{X}의 {L}이(가) 핵 부대에 경계 태세를 내렸어요. 세계가 숨을 죽이고 우리를 봐요.',
    target: 'rival',
    auto: 1,
    options: [
      { label: '물러서지 않고 맞대응해요', fx: [{ k: 'tension', v: 30 }, { k: 'fame', v: 12 }, { k: 'approval', v: 5 }], say: '우리도 태세를 올렸습니다. 온 세계가 지도자님을 지켜봅니다.' },
      { label: '핫라인으로 직접 통화해요', fx: [{ k: 'money', v: -4000 }, { k: 'favor', who: 'target', v: 15 }, { k: 'tension', v: -20 }], say: '통화가 길었지만 경계 태세가 풀렸습니다.' },
      { label: '방공망을 모두 켜고 지켜봐요', fx: [{ k: 'money', v: -3000 }, { k: 'trust', v: 4 }, { k: 'intel', v: 2 }], say: '밤새 하늘을 지켰습니다. 아직은 조용합니다.' },
    ],
  },
  {
    id: 'fin-coup',
    icon: '🗡️',
    title: '쿠데타 시도',
    text: '전쟁에 지친 일부 장교들이 수도로 부대를 움직였어요. 방송국 앞에 장갑차가 섰어요.',
    auto: 1,
    options: [
      { label: '충성파 부대로 진압해요', fx: [{ k: 'troops', v: -0.04 }, { k: 'trust', v: 5 }, { k: 'approval', v: -6 }], say: '반란은 하루 만에 끝났습니다. 수도는 조용합니다.' },
      { label: '국민 앞에서 담화해요', fx: [{ k: 'money', v: -2000 }, { k: 'approval', v: 8 }, { k: 'fame', v: 6 }], say: '시민들이 거리로 나와 지도자님 편에 섰습니다.' },
      { label: '주동자와 타협해요', fx: [{ k: 'trust', v: 2 }, { k: 'fame', v: -8 }, { k: 'merit', v: -200 }], say: '총성 없이 끝났지만 뒷말이 남았습니다.' },
    ],
  },
];

registerCrises(FINALE_CRISES);

export interface FinaleState { sinceMs: number; step: number }

/** 세계 연합에 낄 나라: 살아 있고, 나와 평화이며, 내 속국·연합국이 아닌 나라 중 군사력 순 */
export function finaleFoes(s: GameState): string[] {
  const me = s.player.countryId;
  return COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id) && lordOf(s, c.id) !== me && !['전쟁', '연합'].includes(relationOf(s.world, me, c.id)))
    .sort((a, b) => b.military - a.military)
    .slice(0, FINALE_FOES)
    .map((c) => c.id);
}

/** 세계 판단마다(actsTick 뒤). 4장이 아니면 진행을 지움 */
export function finaleTick(s: GameState): GameState {
  if (s.world.act == null) return s;
  if (s.world.act !== 4) return s.finale ? { ...s, finale: undefined } : s;
  const me = s.player.countryId;
  if (!s.finale) {
    const foes = finaleFoes(s);
    const w = structuredClone(s.world);
    for (const f of foes) declareWar(w, s.worldMs, me, f, me, '세계 연합');
    const names = foes.map((f) => countryById(f).name).join('·');
    const text = foes.length ? `🌐 세계 연합! ${names}이(가) 손잡고 우리에게 선전포고했어요.` : '🌐 남은 나라들이 마지막으로 뭉치고 있어요.';
    w.events = [{ t: s.worldMs, kind: '외교' as const, text, mine: true }, ...w.events].slice(0, EVENT_LOG_MAX);
    return pushReport({ ...s, world: w, finale: { sinceMs: s.worldMs, step: 0 } }, { icon: '🔥', text: `마지막 위기입니다. ${text} 승리 조건을 끝까지 지켜 주십시오.` });
  }
  const f = s.finale;
  if (f.step >= FINALE_CRISES.length || s.worldMs < f.sinceMs + FINALE_AT_H[f.step] * H) return s;
  const c = crisisOf(s);
  if (c.open) return s; // 다른 사건을 고르는 중이면 기다림
  const d = FINALE_CRISES[f.step];
  let target: string | null = null;
  if (d.target) {
    const alive = COUNTRIES.map((x) => x.id).filter((id) => id !== me && isAlive(s.world, id));
    const wars = alive.filter((id) => relationOf(s.world, me, id) === '전쟁');
    const rivals = alive.filter((id) => isRival(me, id));
    target = (wars.length ? wars : rivals.length ? rivals : alive).sort((a, b) => countryById(b).military - countryById(a).military)[0] ?? null;
  }
  const ns: GameState = { ...s, finale: { ...f, step: f.step + 1 }, crisis: { ...c, open: { id: c.nextId, def: d.id, target, untilMs: s.worldMs + CRISIS_ANSWER_MS }, nextId: c.nextId + 1 } };
  return pushReport(ns, { icon: d.icon, text: `마지막 위기 ${f.step + 1}/${FINALE_CRISES.length}: ${d.title} — 본부에서 결정해 주세요.` });
}
