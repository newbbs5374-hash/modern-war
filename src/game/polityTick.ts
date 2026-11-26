// 내정 새 콘텐츠 8가지 시간 흐름(실제 15분마다, domesticTick이 부름). 이 파일을 부르면 효과 줄 등록도 함께 됨.
import type { GameState } from './state';
import { newPolity } from './polity';
import { seatsTick } from './seats';
import { econTick } from './econ';
import { disasterTick } from './disaster';
import { probeTick } from './probe';
import { governorsTick } from './governors';
import { popTick } from './population';
import { amendTick } from './amend';
import { speechTick } from './speech';

export function polityTick(s: GameState): GameState {
  const ns = s.polity ? s : { ...s, polity: newPolity(s) };
  return speechTick(amendTick(popTick(governorsTick(probeTick(disasterTick(econTick(seatsTick(ns))))))));
}
