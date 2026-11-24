import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { pairKey, relationOf } from './world';
import { sanctionMult } from './civ';
import { CITIES } from '../data/cities';
import { playerKeys } from '../data/looks';

describe('지금 세계 정세로 시작(11-24)', () => {
  it('러시아-우크라이나는 전쟁, 이스라엘-이란·남북은 휴전, 러시아는 제재', () => {
    const s = newGame('t', 'kr', 0, { seed: 3, realWorld: true });
    expect(relationOf(s.world, 'ru', 'ua')).toBe('전쟁');
    expect(relationOf(s.world, 'il', 'ir')).toBe('휴전');
    expect(relationOf(s.world, 'kr', 'kp')).toBe('휴전');
    expect(s.world.pairs[pairKey('cn', 'in')].tension).toBe(40);
    const kh = CITIES.find((c) => c.name === '하르키우')!;
    expect(s.world.defense[kh.id]).toBe(55);
    expect(sanctionMult(s, 'ru')).toBe(0.8);
    expect(s.world.events.some((e) => e.text.includes('러시아-우크라이나') )).toBe(true);
    expect(s.world.events.find((e) => e.text.includes('한반도'))!.mine).toBe(true);
  });
  it('끄면 예전처럼 모두 평화', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    expect(relationOf(s.world, 'ru', 'ua')).toBe('중립');
    expect(sanctionMult(s, 'ru')).toBe(1);
  });
  it('얼굴 고르기: 고른 얼굴 → 임시 그림 → 예전 그림 순', () => {
    const s = newGame('t', 'ua', 0, { seed: 3, look: 'f30' });
    expect(s.player.look).toBe('f30');
    expect(playerKeys(s.player)[0]).toBe('player-f30');
    expect(playerKeys({ countryId: 'kr' })).toEqual(['player', 'leader-kr']);
  });
});
