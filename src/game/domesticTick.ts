// 내정 확장 시간 흐름(실제 15분마다, state.advance가 부름). 이 파일을 부르면 효과 줄 등록도 함께 됨.
import type { GameState } from './state';
import { newDom } from './domestic';
import { agendaTick } from './agenda';
import { groupsTick } from './groups';
import { codesTick } from './codes';
import { budgetTick } from './budgetSeason';
import './zones';
import './projects';

export function domTick(s: GameState): GameState {
  const ns = s.dom ? s : { ...s, dom: newDom(s) };
  return budgetTick(codesTick(groupsTick(agendaTick(ns))));
}
