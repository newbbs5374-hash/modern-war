import { test } from 'vitest';
import { runSiegeHeadless } from '../src/battle3d/siege';
import { actsFor } from '../src/battle3d/stages';
import { foeHpOf } from '../src/battle3d/foeHp';
import { foeBuffs } from '../src/game/losses';
import { setFoeSpecialEvery, setFoeSpecialRest } from '../src/battle3d/sim';
if (process.env.REST) setFoeSpecialRest(Number(process.env.REST));
setFoeSpecialEvery(Number(process.env.EVERY ?? '3'));
const FOE = (process.env.FOE ?? '').split(',').filter(Boolean);
const US = process.env.US ? JSON.parse(process.env.US) : {};
test('siege win rate with specials', () => {
  for (const d of [1.1, 1.2, 1.3, 1.5, 2.0]) {
    let win = 0, n = 0;
    for (const c of FOE.length ? FOE : ['']) for (let seed = 1; seed <= 12; seed++) for (const coast of [true, false]) {
      const r = runSiegeHeadless(foeHpOf(d), undefined, actsFor(seed * 7919, coast), { foeBuff: foeBuffs(c), usBuff: US }).outcome;
      n++; if (r.win) win++;
    }
    console.log('diff', d, 'win', win, '/', n, (win / n).toFixed(2));
  }
}, 1800000);
