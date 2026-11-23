import { describe, expect, it } from 'vitest';
import { advance, newGame } from './state';
import { canChoreAt, canUpgrade, upgradeFacility } from './economy';
import { facBonus } from './facility';
import { parseSave } from './save';
import { BUILDINGS } from '../data/economy';

describe('시설 15개(11-23)', () => {
  it('새 시설 6개는 빈 땅에서 시작하고 지으면 1단계가 된다', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    expect(BUILDINGS.length).toBe(15);
    expect(s.economy.buildings['국방과학연구소'].level).toBe(0);
    expect(s.economy.buildings['군수공장'].level).toBe(1);
    expect(facBonus(s, '국방과학연구소')).toBe(0);
    expect(canChoreAt(s, '훈련소')).toBe('먼저 지어야 해요');
    s = { ...s, economy: { ...s.economy, facilities: { ...s.economy.facilities, 과학: { ...s.economy.facilities.과학, exp: 100 } } } };
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 99999 } } };
    expect(canUpgrade(s, '국방과학연구소')).toBeNull();
    s = upgradeFacility(s, '국방과학연구소');
    s = advance(s, 2 * 3600e3);
    expect(s.economy.buildings['국방과학연구소'].level).toBe(1);
    expect(facBonus(s, '국방과학연구소')).toBeCloseTo(0.05);
  });
  it('옛 저장(시설 9개)에 새 시설이 빈 땅으로 붙는다', () => {
    const s = newGame('t', 'kr', 0, { seed: 4 });
    const old = JSON.parse(JSON.stringify(s));
    for (const id of ['국방과학연구소', '정보본부', '우주기지', '방공포대', '훈련소', '비축창고']) delete old.economy.buildings[id];
    delete old.economy.facilities.과학;
    delete old.economy.facilities.국방;
    const back = parseSave(JSON.stringify(old))!;
    expect(back).not.toBeNull();
    expect(back.economy.buildings['비축창고'].level).toBe(0);
    expect(typeof back.economy.facilities.국방.exp).toBe('number');
  });
});
