import { test } from 'vitest';
import { runSiegeHeadless } from '../src/battle3d/siege';
import { actsFor } from '../src/battle3d/stages';
import { foeHpOf } from '../src/battle3d/foeHp';
test('siege win rate', () => {
  for (const d of [0.7, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5, 2.0, 2.7]) {
    let win = 0, stars = 0, n = 0; const t0 = Date.now();
    for (let seed = 1; seed <= 24; seed++) for (const coast of [true, false]) {
      const r = runSiegeHeadless(foeHpOf(d), undefined, actsFor(seed * 7919, coast)).outcome;
      n++; if (r.win) { win++; stars += r.stars; }
    }
    console.log('diff', d, 'foeHp', foeHpOf(d).toFixed(2), 'win', win, '/', n, 'avg stars', (stars / Math.max(1, win)).toFixed(2), 'ms each', Math.round((Date.now() - t0) / n));
  }
}, 900000);
