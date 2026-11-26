import { test } from 'vitest';
import { advance, newGame } from '../src/game/state';
import { GROW_TRACKS } from '../src/game/aiGrowth';
test('AI 나라 성장 흐름', () => {
  let s = newGame('t', 'kr', 0, { seed: 3, realWorld: true });
  for (let d = 1; d <= 90; d++) {
    s = advance(s, 3600e3 * 24);
    if (d % 15 === 0) {
      console.log(`day ${d}`);
      for (const [id, g] of Object.entries(s.world.grow ?? {})) console.log(' ', id, GROW_TRACKS.map((t) => `${t}${g.lv[t]}`).join(' '), g.plan, Math.round(s.nations[id].treasury));
    }
  }
  console.log(s.world.events.filter((e) => e.kind === '성장').slice(0, 8).map((e) => e.text).join('\n'));
}, 600000);
