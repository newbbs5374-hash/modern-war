// 11-27 종합 확장안 전투 10: 전투 기록관.
// 끝난 전투(대전투 · 작전 · 반격 방어)를 차례로 적어 두고, 전적과 연승 · 훈장을 보여 줌.
import type { GameState } from './state';

export const LOG_MAX = 60;
export interface BattleRec { t: number; kind: string; title: string; city?: string; win: boolean; stars: number; direct: boolean }
export interface BattleLogState { list: BattleRec[]; wins: number; losses: number; streak: number; best: number; stars3: number }
export const logOf = (s: GameState): BattleLogState => s.blog ?? { list: [], wins: 0, losses: 0, streak: 0, best: 0, stars3: 0 };

/** 전투 하나를 적음(새 상태를 돌려줌) */
export function logBattle(s: GameState, r: Omit<BattleRec, 't'>): GameState {
  const b = structuredClone(logOf(s));
  b.list.unshift({ ...r, t: s.worldMs });
  b.list.length = Math.min(b.list.length, LOG_MAX);
  if (r.win) { b.wins++; b.streak++; b.best = Math.max(b.best, b.streak); if (r.stars >= 3) b.stars3++; }
  else { b.losses++; b.streak = 0; }
  return { ...s, blog: b };
}

export interface Medal { id: string; icon: string; name: string; need: string; got: boolean }
export function medals(s: GameState): Medal[] {
  const b = logOf(s);
  const caps = b.list.filter((r) => r.kind === '대전투' && r.win).length;
  const def = b.list.filter((r) => r.kind === '반격 방어' && r.win).length;
  return [
    { id: 'first', icon: '🎖️', name: '첫 승리', need: '전투 1번 이기기', got: b.wins >= 1 },
    { id: 'w10', icon: '🏅', name: '백전노장', need: '전투 10번 이기기', got: b.wins >= 10 },
    { id: 'w30', icon: '🏆', name: '불패의 지휘', need: '전투 30번 이기기', got: b.wins >= 30 },
    { id: 's3', icon: '🔥', name: '3연승', need: '내리 3번 이기기', got: b.best >= 3 },
    { id: 's7', icon: '⚡', name: '7연승', need: '내리 7번 이기기', got: b.best >= 7 },
    { id: 'star', icon: '⭐', name: '완벽한 작전', need: '별 3개 승리 5번', got: b.stars3 >= 5 },
    { id: 'cap', icon: '🏙️', name: '도시 사냥꾼', need: '대전투 승리 3번(최근 기록)', got: caps >= 3 },
    { id: 'def', icon: '🛡️', name: '철벽', need: '반격 방어 2번(최근 기록)', got: def >= 2 },
  ];
}
export const winRate = (s: GameState) => { const b = logOf(s); return b.wins + b.losses ? b.wins / (b.wins + b.losses) : 0; };
