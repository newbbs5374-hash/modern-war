// 11/28 대장 요청: 📨 보고 창 "자동 모두 승인".
// 켜 두면 시간이 흐를 때마다(접속하지 않은 동안에도) 건의·점령지 관리청 건의를
// 예산이 허락하는 만큼 모두 승인한다(돈이 모자란 건은 그대로 남겨 둠).
import { acceptProposal, actWhy, propOf } from './proposals';
import { approveAll } from './occAdmin';
import type { GameState } from './state';

export const autoApproveOn = (s: GameState) => !!s.props?.autoAll;

export function setAutoApprove(s: GameState, on: boolean): GameState {
  return { ...s, props: { ...propOf(s), autoAll: on } };
}

/** 지금 승인할 수 있는 건 모두 승인(버튼·자동 공용) */
export function acceptAllNow(s: GameState): { state: GameState; n: number; texts: string[] } {
  let ns = s;
  const texts: string[] = [];
  for (const pr of propOf(s).list) {
    if (actWhy(ns, pr.act).why) continue;
    const r = acceptProposal(ns, pr.id);
    ns = r.state;
    texts.push(r.text);
  }
  const o = approveAll(ns);
  return { state: o.state, n: texts.length + o.n, texts };
}

/** 시간이 흐를 때(15분마다): 켜져 있으면 모두 승인 */
export function autoApproveTick(s: GameState): GameState {
  if (!autoApproveOn(s)) return s;
  if (!propOf(s).list.length && !s.occAdmin?.list.length) return s;
  const r = acceptAllNow(s);
  if (!r.n) return r.state;
  const p = propOf(r.state);
  return { ...r.state, props: { ...p, autoN: (p.autoN ?? 0) + r.n, log: [`🤖 자동 승인 ${r.n}건`, ...p.log].slice(0, 30) } };
}
