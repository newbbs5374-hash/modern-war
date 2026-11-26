// 연구 카드 트리의 열 안 순서를 오래 골라 src/ui/techCardOrder.ts 에 적어 둠.
// 연구를 더하거나 선행을 바꾸면 다시 돌림: npx tsx scripts/gen-tech-cards.ts
// 엇갈림이 남으면 씨앗을 바꿔 가며 다시 고름(최대 40번).
import { writeFileSync } from 'node:fs';
import { MIL_TECHS, SOC_TECHS } from '../src/data/civ';
import { layoutCards } from '../src/ui/techCards';
import { CARD_ORDER } from '../src/ui/techCardOrder';

const out: Record<string, string[][]> = {};
for (const [line, list] of [['mil', MIL_TECHS], ['soc', SOC_TECHS]] as const) {
  // 지난번 순서가 아직 맞으면 거기서 시작(맞지 않으면 처음부터)
  let L = layoutCards(list, CARD_ORDER[line], 2_000_000);
  for (let s = 1; L.crossings && s <= Number(process.env.TRIES ?? 40); s++) {
    console.log(line, '씨앗', s - 1, '엇갈림', L.crossings);
    // 앞에서 고른 가장 좋은 순서에서 이어서 다시 고름
    L = layoutCards(list, L.order, 2_000_000, 20261124 + s * 7919);
  }
  if (L.crossings) {
    // 어느 선끼리 엇갈리는지 알려 줌(선행을 바꿀 때 참고)
    const pos: Record<string, [number, number]> = {};
    L.order.forEach((l, c) => l.forEach((id, i) => (pos[id] = [c, i])));
    const segs: Array<[string, string, string]> = [];
    for (const t of list)
      for (const n of t.needs) {
        const ids = [n];
        for (let c = L.nodes[n].col + 1; c < L.nodes[t.id].col; c++) ids.push(`${n}>${t.id}#${c}`);
        ids.push(t.id);
        for (let k = 0; k + 1 < ids.length; k++) segs.push([ids[k], ids[k + 1], `${n} → ${t.id}`]);
      }
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++) {
        const [a, b, la] = segs[i];
        const [c, d, lb] = segs[j];
        if (pos[a][0] === pos[c][0] && (pos[a][1] - pos[c][1]) * (pos[b][1] - pos[d][1]) < 0) console.log('엇갈림:', la, '×', lb);
      }
    throw new Error(`${line}: 선 엇갈림 ${L.crossings}개가 남음 — 선행 관계를 살펴 주세요`);
  }
  out[line] = L.order;
  console.log(line, '엇갈림 0, 열', L.cols);
}
writeFileSync(
  new URL('../src/ui/techCardOrder.ts', import.meta.url),
  `// 자동 생성(scripts/gen-tech-cards.ts). 연구 카드 트리의 열마다 위→아래 순서. 손으로 고치지 말고 스크립트를 다시 돌릴 것.\nexport const CARD_ORDER: Record<'mil' | 'soc', string[][]> = ${JSON.stringify(out, null, 2)};\n`,
);
