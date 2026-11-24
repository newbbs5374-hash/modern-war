// 연구 성좌판 가지 순서 만들기: npx tsx scripts/gen-tech-sky.ts
import { writeFileSync } from 'node:fs';
import { MIL_TECHS, SOC_TECHS } from '../src/data/civ';
import { optimizeSky, layoutSky } from '../src/ui/techSky';

const out: Record<string, Record<string, string[]>> = {};
for (const [line, list] of [['mil', MIL_TECHS], ['soc', SOC_TECHS]] as const) {
  const r = optimizeSky(list, 3000);
  out[line] = r.order;
  console.log(line, 'score', r.score.toFixed(1));
}
writeFileSync(
  new URL('../src/ui/techSkyOrder.ts', import.meta.url),
  `// 연구 성좌판 가지 순서(선이 겹치지 않게 미리 골라 둔 값). scripts/gen-tech-sky.ts가 만듦 — 손으로 고치지 말 것.\nexport const SKY_ORDER: Record<string, Record<string, string[]>> = ${JSON.stringify(out, null, 1)};\n`,
);
void layoutSky;
