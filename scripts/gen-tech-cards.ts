// 연구 카드 트리의 열 안 순서를 오래 골라 src/ui/techCardOrder.ts 에 적어 둠.
// 연구를 더하거나 선행을 바꾸면 다시 돌림: npx tsx scripts/gen-tech-cards.ts
import { writeFileSync } from 'node:fs';
import { MIL_TECHS, SOC_TECHS } from '../src/data/civ';
import { layoutCards } from '../src/ui/techCards';

const out: Record<string, string[][]> = {};
for (const [line, list] of [['mil', MIL_TECHS], ['soc', SOC_TECHS]] as const) {
  const L = layoutCards(list, undefined, 2_000_000);
  if (L.crossings) throw new Error(`${line}: 선 엇갈림 ${L.crossings}개가 남음 — 선행 관계를 살펴 주세요`);
  out[line] = L.order;
  console.log(line, '엇갈림 0, 열', L.cols);
}
writeFileSync(
  new URL('../src/ui/techCardOrder.ts', import.meta.url),
  `// 자동 생성(scripts/gen-tech-cards.ts). 연구 카드 트리의 열마다 위→아래 순서. 손으로 고치지 말고 스크립트를 다시 돌릴 것.\nexport const CARD_ORDER: Record<'mil' | 'soc', string[][]> = ${JSON.stringify(out, null, 2)};\n`,
);
