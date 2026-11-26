// 3막 공성전 전장: 1막 외곽(해안) → 2막 시가전(거점 4곳) → 3막 도심 내부(지휘소 + 최후 저항 2번)
import { COAST, type Block, type Place, type Stage } from './sim';

const flat = (x: number, z: number) => .05 + Math.sin(x * .7 + z * .3) * .012 + Math.cos(z * .9 - x * .4) * .01;
const noSea = () => -99, noRiver = () => 99;
/** 가로 구간 × 세로 구간으로 건물 덩어리를 만들고, 빼낼 칸(광장)은 [i,j]로 */
function grid(xs: Array<[number, number]>, zs: Array<[number, number]>, skip: Array<[number, number]> = [], h = 1): Block[] {
  const out: Block[] = [];
  xs.forEach(([x0, x1], i) => zs.forEach(([z0, z1], j) => { if (!skip.some(([a, b]) => a === i && b === j)) out.push({ x0, x1, z0, z1, h }); }));
  return out;
}

/** 2막 시가전: 큰길 3개 × 골목 4개. 앞쪽 교차로 2곳 → 방송국 광장 → 구청 앞 */
export const STREET: Stage = {
  id: 'street', name: '2막 · 시가전', op: 'URBAN-12', goal: '목표: 거점 4곳 모두 차지',
  coastX: noSea, riverZ: noRiver, bridges: [], hAt: flat, timeLimit: 240, usGoal: { x: -1.2, z: -10 }, urban: true,
  blocks: grid(
    [[-10.6, -7.3], [-5.5, -2.1], [-.3, 3.1], [4.9, 10.6]],
    [[-15.6, -10.9], [-9.1, -5.3], [-3.5, .3], [2.1, 5.7]],
    [[2, 1]],
  ),
  points: [
    { name: '기차역 앞', x: -6.4, z: 1.2, r: 1.7 },
    { name: '시장 사거리', x: 4, z: 1.2, r: 1.7 },
    { name: '방송국 광장', x: 1.4, z: -7.2, r: 1.9 },
    { name: '구청 앞', x: -1.2, z: -10, r: 1.7 },
  ],
  enemy: [
    ['inf', -6.9, .8], ['inf', -5.9, 1.6], ['tank', -6.4, -.4], ['sf', -7, 2.4],
    ['inf', 3.5, .8], ['inf', 4.5, 1.6], ['tank', 4, -.4], ['ifv', 4.2, 2.4],
    ['tank', 1, -6.6], ['ifv', 1.9, -7.8], ['inf', .6, -7.6], ['aa', 2.2, -6.4], ['hack', 1.4, -8.4],
    ['tank', -1.2, -9.2], ['inf', -1.8, -10.4], ['inf', -.6, -10.6], ['sf', -1.2, -11.4], ['aa', -1.2, -12.6],
    ['spg', -6.4, -13.2], ['spg', 4, -13.2],
    ['drone', -3.8, -12.6], ['drone', 6, -12.4], ['heli', 1.4, -12.2],
  ],
  reinf: { every: 30, max: 3, list: [['inf', -6.4, -14.6], ['ifv', 4, -14.6], ['inf', -1.2, -14.6]] },
};

/** 3막 도심 내부: 가운데 큰 광장에 지휘소. 무너뜨리면 양옆·뒤에서 최후 저항 */
export const CORE: Stage = {
  id: 'core', name: '3막 · 도심 내부', op: 'CITADEL-01', goal: '목표: 지휘소 파괴 → 최후 저항 막기',
  coastX: noSea, riverZ: noRiver, bridges: [], hAt: flat, timeLimit: 240, usGoal: { x: 0, z: -9 }, urban: true,
  blocks: [
    ...grid(
      [[-10.6, -6.1], [-4.3, -1.1], [1.1, 4.3], [6.1, 10.6]],
      [[-15.6, -14.1], [-12.3, -4.9], [-3.1, 1.7], [3.5, 8.2]],
      [[1, 1], [2, 1]],
      1.3,
    ),
    // 광장 둘레 바리케이드(낮은 벽)
    { x0: -3.4, x1: -2.2, z0: -5.6, z1: -5.2, h: .2 }, { x0: 2.2, x1: 3.4, z0: -5.6, z1: -5.2, h: .2 },
  ],
  enemy: [
    ['hq', 0, -9.6],
    ['tank', -2, -7.2], ['tank', 2, -7.2], ['ifv', 0, -6.6],
    ['inf', -1.2, -6.2], ['inf', 1.2, -6.2], ['inf', -3.2, -8.4], ['sf', 3.2, -8.4],
    ['aa', -2.4, -10.8], ['aa', 2.4, -10.8], ['hack', 0, -11.6],
    ['spg', -3.2, -11.6], ['spg', 3.2, -11.6],
    ['inf', -5.2, -1], ['tank', 5.2, -1.4], ['inf', 0, -.6],
    ['heli', -1, -12.6], ['drone', 1.6, -12.8],
  ],
  waves: [
    [['tank', -9.6, -4], ['ifv', -9.6, -4.2], ['inf', -9.2, -3.4], ['sf', -9.9, -3.6],
      ['tank', 9.6, -4], ['ifv', 9.6, -4.2], ['inf', 9.2, -3.4], ['inf', 9.9, -3.6]],
    [['tank', -.5, -14.9], ['tank', .5, -15.3], ['ifv', 0, -14.4], ['inf', -5.2, -14.9], ['inf', 5.2, -14.9], ['sf', 0, -15],
      ['heli', -4, -14.6], ['drone', 4, -14.6], ['drone', -2, -14.8]],
  ],
};

export const ACTS: Stage[] = [COAST, STREET, CORE];
/** 2·3막 기본 보충(예산 안에서 앞에서부터) */
export const URBAN_FILL: Place[] = [
  ['tank', 1.6, 9.8], ['inf', 3, 9.8], ['ifv', 4.4, 9.8], ['tank', -2.6, 9.8], ['aa', 3, 11.2], ['spg', 1.6, 12.6],
  ['inf', -1.2, 9.8], ['sf', 6, 9.8], ['hack', -2.6, 11.2], ['drone', 0, 11.2], ['heli', 4.4, 11.2], ['tank', 7.2, 9.8],
];
