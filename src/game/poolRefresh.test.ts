import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { POOL_SIZE, REFRESH_RUBY, cabinetOf, originsFor, refreshPool } from './cabinet';
import { PERSON_ORIGINS } from '../data/cabinet';
import { neededSpec, recommend } from './recommend';

const withRuby = (s: GameState, n = 100): GameState => ({ ...s, goals: { ...s.goals!, ruby: n } });
const pool = (s: GameState) => cabinetOf(s).people.filter((p) => p.group === '인재');

describe('명단 새로 받기 성향·분야(11-26)', () => {
  it('성향·분야를 고르면 16명 모두 그 조건', () => {
    const s = withRuby(newGame('t', 'kr', 0, { seed: 11 }));
    const s2 = refreshPool(s, { faction: '군부파', spec: '육군통' });
    const list = pool(s2);
    expect(list.length).toBe(POOL_SIZE);
    for (const p of list) {
      expect(p.faction).toBe('군부파');
      expect(p.spec).toBe('육군통');
      expect(PERSON_ORIGINS[p.origin].spec).toContain('육군통');
    }
    expect(s2.goals!.ruby).toBe(100 - REFRESH_RUBY);
  });
  it('성향만·분야만도 되고, 안 맞는 짝은 분야 쪽 출신으로', () => {
    const s = withRuby(newGame('t', 'kr', 0, { seed: 12 }));
    expect(pool(refreshPool(s, { faction: '경제파' })).every((p) => p.faction === '경제파')).toBe(true);
    expect(pool(refreshPool(s, { spec: '과학자' })).every((p) => p.spec === '과학자')).toBe(true);
    // 해군통인 경제파 출신은 없음 → 해군통 출신에서 고르고 성향만 경제파로
    expect(originsFor({ faction: '경제파', spec: '해군통' }).every((o) => PERSON_ORIGINS[o].spec.includes('해군통'))).toBe(true);
    const mix = pool(refreshPool(s, { faction: '경제파', spec: '해군통' }));
    expect(mix.every((p) => p.faction === '경제파' && p.spec === '해군통')).toBe(true);
  });
  it('조건 없으면 예전 그대로, 루비 모자라면 안 됨', () => {
    const s = withRuby(newGame('t', 'kr', 0, { seed: 13 }));
    expect(pool(refreshPool(s)).length).toBe(POOL_SIZE);
    const poor = withRuby(s, REFRESH_RUBY - 1);
    expect(refreshPool(poor, { spec: '외교통' })).toBe(poor);
  });
  it('비서 추천 분야는 빈 자리에 필요한 분야 중 하나', () => {
    const s = newGame('t', 'kr', 0, { seed: 14 });
    const rep = recommend(s);
    const sp = neededSpec(rep);
    if (rep.noOne.length) expect(sp).not.toBeNull();
    else expect(sp).toBeNull();
  });
});
