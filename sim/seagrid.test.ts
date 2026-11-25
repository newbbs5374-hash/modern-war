// 바닷길 칸 자료 만들기: npm run seagrid → src/data/seaGrid.ts
// 4px 칸마다 "가운데와 둘레 네 점(1.5px)이 모두 바다"면 배가 지나갈 수 있는 칸(1)
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { GEO, isLand } from '../src/data/realmap';
import { GRID_C } from '../src/data/seaPath';

it('sea grid', () => {
  const C = GRID_C;
  const GW = Math.ceil(GEO.W / C);
  const GH = Math.ceil(GEO.H / C);
  const bytes = new Uint8Array(Math.ceil((GW * GH) / 8));
  for (let cy = 0; cy < GH; cy++)
    for (let cx = 0; cx < GW; cx++) {
      const x = cx * C + C / 2;
      const y = cy * C + C / 2;
      const land = isLand(x, y) || isLand(x - 1.5, y) || isLand(x + 1.5, y) || isLand(x, y - 1.5) || isLand(x, y + 1.5);
      if (!land) {
        const k = cy * GW + cx;
        bytes[k >> 3] |= 1 << (k & 7);
      }
    }
  const b64 = Buffer.from(bytes).toString('base64');
  writeFileSync(
    'src/data/seaGrid.ts',
    `// 자동 생성(npm run seagrid, sim/seagrid.test.ts). 세계지도 4px 칸마다 배가 지나갈 수 있으면 1(비트)\nexport const SEA_GRID = { W: ${GW}, H: ${GH}, bits: "${b64}" };\n`,
  );
});
