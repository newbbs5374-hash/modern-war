// 11-27 종합 확장안 내정 8: 국가 대계획.
// 여러 주에 걸쳐 4단계를 밟는 초대형 사업 3가지(우주 정거장 · 해저 터널 · 핵융합 발전).
// 한 번에 한 단계만 진행(가속 없음). 단계를 끝낼 때마다 장면이 사진첩에 남고 영구 효과가 붙음.
// 세 가지를 모두 끝내면 「과학 승리」(전쟁을 안 하는 사람의 2달 목표).
import { domLog, registerDomRows, snap, payTreasury, type Rows } from './domestic';
import { pushReport } from './report';
import { priceBase, type GameState } from './state';
import type { LawKey } from './laws';

const DAY = 24 * 3600e3;
export type MegaId = 'space' | 'tunnel' | 'fusion';
export interface MegaStage { name: string; text: string; scene: string }
export interface MegaDef {
  id: MegaId;
  icon: string;
  name: string;
  /** 단계 하나마다 붙는 영구 효과 */
  key: LawKey;
  per: number;
  /** 다 끝냈을 때 덤 */
  endKey: LawKey;
  endV: number;
  effText: string;
  stages: MegaStage[];
}
export const MEGAS: MegaDef[] = [
  {
    id: 'space', icon: '🛰️', name: '우주 정거장', key: 'research', per: 0.03, endKey: 'defense', endV: 5, effText: '단계마다 연구 +3% · 완성하면 안보 +5',
    stages: [
      { name: '우주청 설립', text: '우주청을 세우고 과학자를 모아요.', scene: 'signing' },
      { name: '발사체 개발', text: '우리 손으로 만든 로켓을 쏘아 올려요.', scene: 'launch' },
      { name: '모듈 조립', text: '정거장 몸통을 궤도에 하나씩 올려요.', scene: 'factory' },
      { name: '우주인 상주', text: '우리 우주인이 정거장에서 살기 시작해요.', scene: 'ceremony' },
    ],
  },
  {
    id: 'tunnel', icon: '🚇', name: '해저 터널', key: 'budget', per: 0.02, endKey: 'economy', endV: 5, effText: '단계마다 나라 예산 +2% · 완성하면 경제 +5',
    stages: [
      { name: '해저 지질 조사', text: '바다 밑 땅을 샅샅이 조사해요.', scene: 'port' },
      { name: '착공', text: '양쪽 끝에서 굴착기가 돌기 시작해요.', scene: 'groundbreak' },
      { name: '관통', text: '바다 밑에서 두 굴이 만나요.', scene: 'meeting' },
      { name: '개통', text: '첫 열차가 바다 밑을 달려요.', scene: 'ceremony' },
    ],
  },
  {
    id: 'fusion', icon: '⚛️', name: '핵융합 발전', key: 'res', per: 0.03, endKey: 'society', endV: 5, effText: '단계마다 자원 +3% · 완성하면 사회 +5',
    stages: [
      { name: '연구 단지', text: '핵융합 연구 단지를 지어요.', scene: 'groundbreak' },
      { name: '실험로 점화', text: '실험로에 첫 불이 붙어요.', scene: 'factory' },
      { name: '100초 유지', text: '1억 도 불꽃을 100초 동안 붙들어요.', scene: 'school' },
      { name: '상업 발전', text: '인공 태양이 도시에 전기를 보내요.', scene: 'ceremony' },
    ],
  },
];
export const megaById = (id: MegaId) => MEGAS.find((m) => m.id === id)!;
export const MEGA_STAGES = 4;
/** 단계마다 값(하루 예산 × 이만큼)과 걸리는 실제 날 수 */
export const MEGA_COST_DAYS = [2, 3, 4, 5];
export const MEGA_DAYS = [1.5, 2, 2.5, 3];
export const MEGA_FAME = [60, 80, 100, 200];

export interface MegaState {
  lv: Partial<Record<MegaId, number>>;
  run: { id: MegaId; endMs: number } | null;
}
export const megaOf = (s: GameState): MegaState => s.mega ?? { lv: {}, run: null };
export const megaLv = (s: GameState, id: MegaId) => megaOf(s).lv[id] ?? 0;
export const megaDoneAll = (s: GameState) => MEGAS.every((m) => megaLv(s, m.id) >= MEGA_STAGES);
export const megaTotal = (s: GameState) => MEGAS.reduce((a, m) => a + megaLv(s, m.id), 0);
export const megaCost = (s: GameState, id: MegaId) => Math.round(priceBase(s) * MEGA_COST_DAYS[Math.min(megaLv(s, id), MEGA_STAGES - 1)]);

export function canMega(s: GameState, id: MegaId): string | null {
  const m = megaOf(s);
  if (megaLv(s, id) >= MEGA_STAGES) return '이미 완성했어요';
  if (m.run) return m.run.id === id ? '진행 중이에요' : `${megaById(m.run.id).name} 단계가 끝나야 해요`;
  if (s.nations[s.player.countryId].treasury < megaCost(s, id)) return '나라 예산이 모자라요';
  return null;
}
export function startMega(s: GameState, id: MegaId): GameState {
  if (canMega(s, id)) return s;
  const lv = megaLv(s, id);
  const ns = payTreasury(s, megaCost(s, id));
  if (!ns) return s;
  const d = megaById(id);
  return domLog({ ...ns, mega: { ...megaOf(s), run: { id, endMs: s.worldMs + MEGA_DAYS[lv] * DAY } } }, `${d.icon} ${d.name} ${lv + 1}단계 「${d.stages[lv].name}」 시작`);
}

/** 세계 판단마다: 단계가 끝났는지 */
export function megaTick(s: GameState): GameState {
  const m = s.mega;
  if (!m?.run || s.worldMs < m.run.endMs) return s;
  const d = megaById(m.run.id);
  const lv = megaLv(s, d.id);
  const st = d.stages[lv];
  let ns: GameState = { ...s, mega: { lv: { ...m.lv, [d.id]: lv + 1 }, run: null }, officer: { ...s.officer, fame: s.officer.fame + MEGA_FAME[lv] } };
  ns = snap(ns, st.scene, `${d.name}: ${st.name}`, st.text);
  const all = megaDoneAll(ns);
  return pushReport(ns, {
    icon: d.icon,
    text: lv + 1 >= MEGA_STAGES ? `${d.name}을(를) 완성했습니다! 명성 +${MEGA_FAME[lv]}.${all ? ' 세 가지 대계획을 모두 이뤘습니다.' : ''}` : `${d.name} ${lv + 1}단계 「${st.name}」을(를) 마쳤습니다. 명성 +${MEGA_FAME[lv]}. 다음 단계를 시작할 수 있습니다.`,
  });
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  for (const d of MEGAS) {
    const lv = megaLv(s, d.id);
    if (lv && d.key === key) rows.push([`${d.icon} ${d.name} ${lv}단계`, d.per * lv]);
    if (lv >= MEGA_STAGES && d.endKey === key) rows.push([`${d.icon} ${d.name} 완성`, d.endV]);
  }
  return rows;
});
