import { describe, expect, it } from 'vitest';
import { battleGeneral, genSkillOf } from './generalSkill';
import type { General } from './officer';

const g = (id: number, field: General['field'], skill: number, loyalty: number): General => ({ id, name: `장군${id}`, field, style: '신중함', skill, loyalty, from: '영입' });

describe('장군 지휘 기술', () => {
  it('장군이 없거나 충성이 너무 낮으면 기술이 없다', () => {
    expect(genSkillOf({ generals: [] })).toBeNull();
    expect(genSkillOf({ generals: [g(1, '육군', 9, 10)] })).toBeNull();
  });
  it('능력×충성이 가장 높은 장군이 나가고, 분야가 기술을 정한다', () => {
    const o = { generals: [g(1, '육군', 5, 60), g(2, '공군', 8, 80), g(3, '해군', 9, 40)] };
    expect(battleGeneral(o)?.id).toBe(2);
    const s = genSkillOf(o)!;
    expect(s.k).toBe('air');
    expect(s.twice).toBe(true);
    expect(genSkillOf({ generals: [g(1, '육군', 5, 60)] })!.twice).toBe(false);
  });
});
