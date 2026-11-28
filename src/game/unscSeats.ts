// 11-28 7단계 추가 2 "안보리 자리와 거부권"(가벼운 모듈: civ.ts 국제 회의가 거부권을 볼 때 씀).
import type { GameState } from './state';

export const P5_START = ['us', 'cn', 'ru', 'uk', 'fr'];
/** 지금 상임이사국 5자리 */
export const p5Of = (s: GameState): string[] => s.unsc?.seats ?? P5_START;
export const isP5 = (s: GameState, id: string) => p5Of(s).includes(id);
export interface UnscState { seats: string[]; readyMs: number; vetoes: number }
