// 아무것도 안 하고 둘 때 의회 신뢰도가 어떻게 흐르는지(정적 발언·방해 영향)
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { advance, newGame } from '../src/game/state';
test('trust idle', () => {
  const out: Record<string, number[]> = {};
  for (const seed of [11, 23, 37]) {
    let s = newGame('sim', 'kr', 0, { seed, realWorld: true });
    const row = [s.officer.trust];
    for (let h = 1; h <= 24 * 7; h++) { s = advance(s, 3600e3); if (h % 6 === 0) row.push(Math.round(s.officer.trust * 10) / 10); }
    out[seed] = row;
  }
  console.log(JSON.stringify(out));
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));
}, 600000);
