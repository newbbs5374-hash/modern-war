// 전장 1: 해안 상륙(육+해+공). 시험판 "철벽 작전" v5.4의 전장을 그대로 옮김.
// 왼쪽은 바다, 오른쪽은 육지. 가운데를 강이 가로지르고 다리 2개로만 빨리 건넘.
import type { FieldConfig } from '../field';

const coastX = (z: number) => -3.2 + Math.sin(z * 0.22) * 1.1 + Math.sin(z * 0.61 + 1) * 0.35;
const riverZ = (x: number) => 0.6 + Math.sin(x * 0.5) * 0.8;

function hAt(x: number, z: number) {
  let h = 0.24 + Math.sin(x * 0.45 + z * 0.2) * 0.17 + Math.sin(z * 0.37 - x * 0.18) * 0.15 + Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.06;
  const edge = Math.max(0, x - 8.6);
  h += edge * edge * 0.2;
  if (z < -10.5 && x > 1 && x < 9) h *= 0.25; // 적 기지 평탄
  const d = x - coastX(z); // 해안까지 거리(+땅, -바다)
  if (d < 1.2) {
    const k = Math.max(0, d) / 1.2;
    h = h * k + 0.06 * (1 - k);
  } // 해변
  if (d < 0) h = 0.06 + d * 0.75; // 바닷속으로 내려감
  if (d > 0) {
    const riv = Math.abs(z - riverZ(x));
    if (riv < 0.9) h = Math.min(h, -0.28 + riv * 0.4);
  }
  return Math.max(h, -1.8);
}

export const COAST: FieldConfig = {
  id: 'coast',
  opCode: 'COASTLINE-05',
  name: '해안 상륙',
  subtitle: '육해공',
  bounds: { xMin: -10, xMax: 10, zTop: -15, zBot: 14 },
  budget: 460,
  foeMul: 0.78,
  timeLimit: 180,
  waterY: -0.12,
  coastX,
  hAt,
  riverZ,
  bridges: [1.6, 6.2],
  enemy: [
    ['hq', 5, -13],
    ['tank', 2.2, -8.8], ['tank', 4.6, -8.6], ['tank', 7, -8.8], ['inf', 1, -7.6], ['inf', 3.4, -7.4], ['inf', 6, -7.6], ['sf', 8.4, -7.8], ['ifv', 3.4, -9.8], ['ifv', 6.2, -10],
    ['hack', 8.2, -11], ['spg', 2.6, -12], ['spg', 7.2, -12.2], ['aa', 3.6, -11.4], ['aa', 6.4, -11.6],
    ['dd', -5.8, -9.6], ['dd', -8.2, -8.2], ['sub', -6.6, -7.2], ['cv', -8, -12.2], ['laser', -5.6, -11.8], ['lha', -4.6, -8.2],
    ['drone', 1.4, -10.4], ['drone', 8.6, -10.2], ['heli', 2, -10.8], ['jet', 5, -10.8], ['bomber', -2, -12.6],
  ],
  defaultDeploy: [
    ['tank', 1.6, 9.8], ['tank', 4.4, 9.8], ['tank', 7.2, 9.8], ['inf', 0.2, 9.8], ['inf', 3, 9.8], ['sf', 8.6, 9.8], ['ifv', 3, 11.2], ['ifv', 6, 11.2], ['hack', 8.6, 11.2], ['spg', 1.6, 12.6], ['spg', 6, 12.6], ['aa', 3, 12.6], ['aa', 7.2, 12.6],
    ['dd', -5.6, 9.6], ['dd', -8.6, 9.6], ['sub', -7.1, 9.6], ['cv', -7.1, 12.6], ['laser', -5.6, 11.1], ['lha', -8.6, 11.1],
    ['jet', 4.4, 11.2], ['heli', 1.6, 11.2], ['bomber', -4.1, 12.6], ['drone', 0.2, 11.2], ['drone', 8.6, 12.6], ['missile', 0.2, 12.6],
  ],
  deployGrid: { x0: -8.6, dx: 1.5, cols: 13, z0: 9.8, dz: 1.4, rows: 3, seaGap: 0.75, landGap: 0.65 },
  goals: { us: { land: { x: 5, z: -12 }, seaZ: -10 }, foe: { land: { x: 4, z: 11 }, seaZ: 10 } },
  airCenter: { x: 2, z: -1 },
  roads: [[3.8, -12], [3.6, -6], [1.6, -1.5], [1.6, 2.5], [2.6, 7], [3, 13]],
  scenery: 'coast',
};
