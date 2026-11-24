import { test } from 'vitest';
import { advance, newGame } from '../src/game/state';
import { relationOf } from '../src/game/world';
import { CITIES } from '../src/data/cities';
test('러-우 전쟁 흐름', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let s = newGame('t', 'kr', 0, { seed, realWorld: process.env.RW !== '0' });
    const out: string[] = [];
    for (let d = 1; d <= 30; d++) {
      s = advance(s, 3600e3);
      const ua = CITIES.filter((c) => c.home === 'ua').map((c) => (s.world.owner[c.id] === 'ua' ? 'U' : 'R')).join('');
      if (d % 5 === 0) out.push(`d${d}:${relationOf(s.world, 'ru', 'ua')}${ua} il-ir:${relationOf(s.world, 'il', 'ir')} kr-kp:${relationOf(s.world, 'kr', 'kp')}`);
    }
    console.log(seed, out.join(' | '));
  }
});
