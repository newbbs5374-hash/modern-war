// 전장 설정의 모양. 전장 하나 = 이 모양을 채운 파일 하나(fields/ 아래).
// 계산기(sim.ts)와 화면(view.ts)이 둘 다 이 설정만 보고 움직이므로, 파일을 바꿔 끼우면 다른 전장이 됨.
import type { DeployKind, UnitKind } from './units';

export interface FieldConfig {
  id: string;
  /** 화면 위 작전 이름(예: COASTLINE-05) */
  opCode: string;
  name: string;
  /** 육해공 중 무엇이 나오는지 한 줄 */
  subtitle: string;
  /** 전장 경계(가로 x, 세로 z. z가 작을수록 적 쪽) */
  bounds: { xMin: number; xMax: number; zTop: number; zBot: number };
  /** 배치 예산 */
  budget: number;
  /** 적 체력·공격 배율(적이 주는 피해에 곱함) */
  foeMul: number;
  /** 제한 시간(초). 지나면 패배 */
  timeLimit: number;
  /** 물 높이 */
  waterY: number;

  // ── 지형(계산기와 화면이 같이 씀) ──
  /** 해안선: 이 x보다 왼쪽이 바다. 바다 없는 전장은 -Infinity, 바다만 있는 전장은 Infinity */
  coastX(z: number): number;
  /** 땅 높이(화면 · 미사일 착탄 높이) */
  hAt(x: number, z: number): number;
  /** 강(있으면): x에서의 강 중심 z. 강 위(±0.9)는 다리가 아니면 땅 유닛이 느려짐 */
  riverZ?(x: number): number;
  /** 다리 x 위치 */
  bridges: number[];

  // ── 유닛 ──
  /** 적 배치 [병과, x, z]. 'hq'(지휘소)를 부수면 승리 */
  enemy: Array<[UnitKind, number, number]>;
  /** 기본 배치(처음 열었을 때 자동으로 놓이는 것) */
  defaultDeploy: Array<[DeployKind, number, number]>;
  /** 배치 칸 격자: x0 + c*dx, z0 + r*dz. 해안과 가까운 칸은 뺌 */
  deployGrid: { x0: number; dx: number; cols: number; z0: number; dz: number; rows: number; seaGap: number; landGap: number };
  /** 칠 대상이 없을 때 향할 곳(땅 목표 · 바다는 이 z로) */
  goals: { us: { land: { x: number; z: number }; seaZ: number }; foe: { land: { x: number; z: number }; seaZ: number } };
  /** 전투기가 경계 근처에서 돌아올 때 향하는 점 */
  airCenter: { x: number; z: number };

  // ── 화면 전용 ──
  /** 길 [x, z] 꺾은선 */
  roads: Array<[number, number]>;
  /** 나무·마을·항구 같은 꾸미기(화면 view.ts의 SCENERY에서 고름) */
  scenery: string;
}

export interface DeployTile {
  x: number;
  z: number;
  dom: 'land' | 'sea';
}

/** 배치 칸 목록(순서가 기본 배치 결과에 영향을 주므로 바꾸지 말 것) */
export function deployTiles(f: FieldConfig): DeployTile[] {
  const g = f.deployGrid;
  const out: DeployTile[] = [];
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      const x = g.x0 + c * g.dx,
        z = g.z0 + r * g.dz,
        cx = f.coastX(z);
      const dom = x < cx - g.seaGap ? 'sea' : x > cx + g.landGap ? 'land' : null;
      if (!dom) continue;
      out.push({ x, z, dom });
    }
  return out;
}

export const isSea = (f: FieldConfig, x: number, z: number, m = 0) => x < f.coastX(z) - m;
export const groundY = (f: FieldConfig, x: number, z: number) => Math.max(f.hAt(x, z), f.waterY);
