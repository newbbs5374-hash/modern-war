// 문명식 운영(기획서 "문명 5·6에서 배울 것", 11-22 대장 결정 반영) 데이터:
// 연구 두 줄(군사 기술 40 · 사회 제도 30) · 시대 4개 · 번뜩임 · 나라 체제 8가지 · 정책 카드 36장(11-23 대장 요청으로 늘림)
// · 협정 5종 · 도시 구역 5가지 · 국제 회의 안건. 숫자는 시험판 초안.
import type { Res } from './economy';

/** 효과 하나. 연구·체제·카드·회의 결과가 모두 이 모양을 씀 */
export interface Eff {
  /** 생산 시간 배율(0.1 = 10% 빨라짐). 'all' 또는 '육'·'해'·'공' */
  build?: { dom: 'all' | '육' | '해' | '공'; v: number };
  /** 만든 부대 전투력 + 비율 */
  power?: { dom: 'all' | '육' | '해' | '공'; v: number };
  /** 연구 속도 + 비율 */
  research?: number;
  /** 나라 예산 수입 + 비율 */
  budget?: number;
  /** 자원 생산 + 비율 */
  res?: number;
  /** 모든 도시 민심 목표 + */
  loyalty?: number;
  /** 모든 나라 호감 + */
  favor?: number;
  /** 분쟁 지역 영향력 얻는 양 + 비율 */
  influence?: number;
  /** 임무 성공률 + (0.05 = 5%p) */
  mission?: number;
  /** 무역 값 이득(0.1 = 사는 값 10% 싸고 파는 값 10% 비쌈) */
  trade?: number;
  /** 정기 무역 계약 칸 + */
  contracts?: number;
  /** 국제 회의 표 + */
  votes?: number;
  /** 도시 인구 자라는 속도 + 비율 */
  growth?: number;
  /** 구역 짓는 시간 − 비율 */
  district?: number;
}

export type Era = 1 | 2 | 3 | 4;
export const ERAS: Record<Era, { name: string; icon: string; text: string }> = {
  1: { name: '도약기', icon: '🌱', text: '산업과 항구를 다시 키우는 때' },
  2: { name: '항로기', icon: '🧭', text: '섬과 섬 사이 바닷길이 열리는 때' },
  3: { name: '제공기', icon: '✈️', text: '하늘을 차지하는 쪽이 이기는 때' },
  4: { name: '대양기', icon: '🌊', text: '항모 전단이 먼 바다를 누비는 때' },
};

/** 번뜩임: 이 일을 해내면 그 연구가 절반으로 줄어듦 */
export type EurekaKey =
  | { kind: 'train'; name: string; stars: number }
  | { kind: 'mission'; name: string }
  | { kind: 'talk'; att?: string }
  | { kind: 'district'; id: DistrictId }
  | { kind: 'agree'; id: AgreeId }
  | { kind: 'island' }
  | { kind: 'rank'; at: number }
  | { kind: 'army'; count: number };

export interface Tech {
  id: string;
  line: 'mil' | 'soc';
  name: string;
  icon: string;
  era: Era;
  /** 기본 속도로 걸리는 실제 시간 */
  hours: number;
  needs: string[];
  /** 여는 병과(병과는 지도자 등급 + 이 연구 둘 다 있어야 열림) */
  units?: string[];
  /** 여는 정책 카드 · 협정 · 구역 */
  cards?: string[];
  agree?: AgreeId[];
  districts?: DistrictId[];
  eff?: Eff;
  /** 한 줄 설명 */
  text: string;
  eureka?: { key: EurekaKey; text: string };
}

const T = (t: Tech) => t;

/** 군사 기술 100개(11-26 대장 요청으로 40 → 100) */
export const MIL_TECHS: Tech[] = [
  // 도약기
  T({ id: 'm-drone', line: 'mil', name: '무인기 기술', icon: '🛸', era: 1, hours: 1, needs: [], units: ['무인드론'], text: '싸고 빠른 정찰·자폭 드론', eureka: { key: { kind: 'train', name: '정보', stars: 2 }, text: '정보 훈련 별 2개 이상' } }),
  T({ id: 'm-mech', line: 'mil', name: '기계화 보병', icon: '🚙', era: 1, hours: 1, needs: [], units: ['기갑병'], text: '보병을 장갑차에 태워 빠르게', eureka: { key: { kind: 'train', name: '체력', stars: 2 }, text: '체력 훈련 별 2개 이상' } }),
  T({ id: 'm-cyber', line: 'mil', name: '전자전', icon: '💻', era: 1, hours: 1.5, needs: [], units: ['해킹부대'], text: '적 통신·방공망을 흔드는 부대', eureka: { key: { kind: 'train', name: '해킹', stars: 1 }, text: '해킹 훈련 성공' } }),
  T({ id: 'm-arty', line: 'mil', name: '자주포', icon: '💥', era: 1, hours: 1.5, needs: [], units: ['포병'], text: '멀리서 넓게 때리는 대포', eureka: { key: { kind: 'train', name: '포격', stars: 2 }, text: '포격 훈련 별 2개 이상' } }),
  T({ id: 'm-armor', line: 'mil', name: '복합 장갑', icon: '🛡️', era: 1, hours: 2, needs: ['m-mech'], units: ['전차'], text: '두꺼운 장갑의 주력 전차', eureka: { key: { kind: 'mission', name: '안보회의' }, text: '방어 안보회의 성공' } }),
  // 항로기
  T({ id: 'm-radar', line: 'mil', name: '방공 레이더', icon: '📡', era: 2, hours: 3, needs: ['m-cyber'], units: ['방공부대'], text: '하늘을 지키는 방공 부대', eureka: { key: { kind: 'train', name: '항공', stars: 1 }, text: '항공 훈련 성공' } }),
  T({ id: 'm-heli', line: 'mil', name: '회전익 항공', icon: '🚁', era: 2, hours: 3, needs: ['m-drone'], units: ['공격헬기'], text: '낮게 날아 전차를 사냥', eureka: { key: { kind: 'mission', name: '특수작전' }, text: '특수작전 승인 성공' } }),
  T({ id: 'm-aegis', line: 'mil', name: '이지스 구축함', icon: '🚢', era: 2, hours: 3.5, needs: [], units: ['구축함', '강습상륙함'], text: '호위·대잠·대공 군함 · 강습상륙함(독점)', eureka: { key: { kind: 'district', id: 'harbor' }, text: '항만 구역 첫 완공' } }),
  T({ id: 'm-jet', line: 'mil', name: '제트 전투기', icon: '✈️', era: 2, hours: 4, needs: ['m-heli'], units: ['전투기'], text: '하늘 장악의 주인공', eureka: { key: { kind: 'district', id: 'airfield' }, text: '비행장 구역 첫 완공' } }),
  T({ id: 'm-supply', line: 'mil', name: '해상 보급선', icon: '📦', era: 2, hours: 3, needs: [], eff: { build: { dom: 'all', v: 0.1 } }, text: '모든 부대 모집 시간 −10%', eureka: { key: { kind: 'mission', name: '군수협상' }, text: '무기 지원 협상 성공' } }),
  // 제공기
  T({ id: 'm-bomber', line: 'mil', name: '전략 폭격', icon: '🛩️', era: 3, hours: 6, needs: ['m-jet'], units: ['폭격기'], text: '도시·기지에 큰 피해', eureka: { key: { kind: 'train', name: '항공', stars: 3 }, text: '항공 훈련 별 3개' } }),
  T({ id: 'm-silent', line: 'mil', name: '잠수함 정숙화', icon: '🫧', era: 3, hours: 6, needs: ['m-aegis'], units: ['잠수함', '원자력 잠수함'], text: '소리 없이 숨어 기습 · 원자력 잠수함(독점)', eureka: { key: { kind: 'train', name: '해상', stars: 2 }, text: '해상 훈련 별 2개 이상(해전 승리)' } }),
  T({ id: 'm-guided', line: 'mil', name: '정밀 유도', icon: '🚀', era: 3, hours: 6, needs: ['m-radar'], units: ['미사일'], text: '아주 멀리서 정확히', eureka: { key: { kind: 'train', name: '포격', stars: 3 }, text: '포격 훈련 별 3개' } }),
  T({ id: 'm-stealth', line: 'mil', name: '스텔스 도료', icon: '🦇', era: 3, hours: 7, needs: ['m-jet'], eff: { power: { dom: '공', v: 0.15 } }, text: '공군 전투력 +15%', eureka: { key: { kind: 'train', name: '잠입', stars: 3 }, text: '잠입 훈련 별 3개' } }),
  T({ id: 'm-sat', line: 'mil', name: '정찰 위성', icon: '🛰️', era: 3, hours: 7, needs: ['m-radar'], eff: { mission: 0.05 }, text: '임무 성공률 +5%', eureka: { key: { kind: 'mission', name: '정보보고' }, text: '정보 보고 임무 성공' } }),
  // 대양기
  T({ id: 'm-carrier', line: 'mil', name: '항모 운용', icon: '🛳️', era: 4, hours: 10, needs: ['m-jet', 'm-aegis'], units: ['항공모함'], text: '바다 위 비행장, 함재기 출격', eureka: { key: { kind: 'train', name: '항공', stars: 2 }, text: '항공 훈련 별 2개 이상(함재기 운용)' } }),
  T({ id: 'm-secret', line: 'mil', name: '국가 비밀 병기', icon: '🌟', era: 4, hours: 9, needs: ['m-armor'], text: '특화 유닛 전투력 +15%', eureka: { key: { kind: 'mission', name: '대전투' }, text: '대전투 승리' } }),
  T({ id: 'm-crystal', line: 'mil', name: '갈륨 레이더', icon: '🧪', era: 4, hours: 10, needs: ['m-silent'], units: ['레이저 방공함'], eff: { power: { dom: 'all', v: 0.1 } }, text: '갈륨으로 모든 전투력 +10% · 특화 유닛 갈륨 개량형 · 레이저 방공함(독점)', eureka: { key: { kind: 'island' }, text: '분쟁 지역 한 곳에서 영향력 1등' } }),
  T({ id: 'm-net', line: 'mil', name: '통합 전장망', icon: '🕸️', era: 4, hours: 11, needs: ['m-sat'], eff: { mission: 0.05, power: { dom: '육', v: 0.15 } }, text: '임무 성공률 +5% · 육군 전투력 +15%', eureka: { key: { kind: 'army', count: 20 }, text: '부대 20개 보유' } }),
  T({ id: 'm-fleet', line: 'mil', name: '대양 함대 교리', icon: '⚓', era: 4, hours: 12, needs: ['m-carrier'], eff: { build: { dom: '해', v: 0.2 }, power: { dom: '해', v: 0.15 } }, text: '해군 모집 −20% · 해군 전투력 +15%', eureka: { key: { kind: 'train', name: '해상', stars: 3 }, text: '해상 훈련 별 3개' } }),
  // ── 11-23 더 잘게 나눈 군사 기술 20개(분야: 육군·해군·공군·정보·보급) ──
  // 도약기
  T({ id: 'm-rifle', line: 'mil', name: '개인 화기 개량', icon: '🔫', era: 1, hours: 1, needs: [], eff: { power: { dom: '육', v: 0.05 } }, text: '육군 전투력 +5%', eureka: { key: { kind: 'train', name: '사격', stars: 2 }, text: '사격 훈련 별 2개 이상' } }),
  T({ id: 'm-comms', line: 'mil', name: '야전 통신망', icon: '📻', era: 1, hours: 1.5, needs: [], eff: { mission: 0.02, build: { dom: '육', v: 0.05 } }, text: '임무 성공률 +2% · 육군 모집 −5%', eureka: { key: { kind: 'train', name: '통솔', stars: 1 }, text: '통솔 훈련 성공' } }),
  T({ id: 'm-logi', line: 'mil', name: '군수 정비', icon: '🔧', era: 1, hours: 1.5, needs: [], eff: { build: { dom: 'all', v: 0.05 } }, text: '모든 부대 모집 −5%', eureka: { key: { kind: 'train', name: '보급', stars: 2 }, text: '보급 훈련 별 2개 이상' } }),
  T({ id: 'm-coast', line: 'mil', name: '연안 경비정', icon: '🚤', era: 1, hours: 1.5, needs: [], eff: { power: { dom: '해', v: 0.05 } }, text: '해군 전투력 +5%', eureka: { key: { kind: 'train', name: '해상', stars: 1 }, text: '해상 훈련 성공' } }),
  T({ id: 'm-recon', line: 'mil', name: '공중 정찰', icon: '🔭', era: 1, hours: 1.5, needs: ['m-drone'], eff: { power: { dom: '공', v: 0.05 }, mission: 0.02 }, text: '공군 전투력 +5% · 임무 성공률 +2%', eureka: { key: { kind: 'mission', name: '정보보고' }, text: '정보 보고 임무 성공' } }),
  // 항로기
  T({ id: 'm-nightvis', line: 'mil', name: '야간 투시 장비', icon: '🌙', era: 2, hours: 3, needs: ['m-rifle'], eff: { power: { dom: '육', v: 0.08 } }, text: '밤에도 싸워요 · 육군 전투력 +8%', eureka: { key: { kind: 'train', name: '잠입', stars: 2 }, text: '잠입 훈련 별 2개 이상' } }),
  T({ id: 'm-sonar', line: 'mil', name: '대잠 소나', icon: '🔊', era: 2, hours: 3, needs: ['m-coast'], units: ['대잠 초계기'], eff: { power: { dom: '해', v: 0.08 } }, text: '숨은 잠수함을 찾아요 · 해군 전투력 +8%', eureka: { key: { kind: 'train', name: '해상', stars: 2 }, text: '해상 훈련 별 2개 이상' } }),
  T({ id: 'm-tanker', line: 'mil', name: '공중 급유', icon: '⛽', era: 2, hours: 3.5, needs: ['m-recon'], units: ['공중급유기'], eff: { build: { dom: '공', v: 0.1 } }, text: '공군 모집 −10% · 더 멀리 날아요', eureka: { key: { kind: 'train', name: '항공', stars: 2 }, text: '항공 훈련 별 2개 이상' } }),
  T({ id: 'm-ew', line: 'mil', name: '전자 방해', icon: '📶', era: 2, hours: 3, needs: ['m-cyber'], units: ['전자전기'], eff: { power: { dom: 'all', v: 0.04 }, mission: 0.02 }, text: '모든 전투력 +4% · 임무 성공률 +2%', eureka: { key: { kind: 'train', name: '해킹', stars: 2 }, text: '해킹 훈련 별 2개 이상' } }),
  T({ id: 'm-depot', line: 'mil', name: '전방 보급기지', icon: '🏕️', era: 2, hours: 3, needs: ['m-logi'], eff: { build: { dom: '육', v: 0.1 } }, text: '육군 모집 −10%', eureka: { key: { kind: 'mission', name: '군수협상' }, text: '무기 지원 협상 성공' } }),
  // 제공기
  T({ id: 'm-active', line: 'mil', name: '능동 방호', icon: '🧿', era: 3, hours: 6, needs: ['m-armor'], eff: { power: { dom: '육', v: 0.1 } }, text: '날아오는 포탄을 맞혀 떨어뜨려요 · 육군 전투력 +10%', eureka: { key: { kind: 'mission', name: '안보회의' }, text: '방어 안보회의 성공' } }),
  T({ id: 'm-vls', line: 'mil', name: '수직 발사관', icon: '🎯', era: 3, hours: 6, needs: ['m-aegis'], eff: { power: { dom: '해', v: 0.1 } }, text: '군함에서 미사일을 한꺼번에 · 해군 전투력 +10%', eureka: { key: { kind: 'district', id: 'harbor' }, text: '항만 구역 첫 완공' } }),
  T({ id: 'm-awacs', line: 'mil', name: '공중 조기경보', icon: '🛩️', era: 3, hours: 6.5, needs: ['m-jet'], units: ['조기경보기'], eff: { power: { dom: '공', v: 0.1 }, mission: 0.02 }, text: '하늘의 눈 · 공군 전투력 +10% · 임무 +2% · 조기경보기 부대', eureka: { key: { kind: 'district', id: 'airfield' }, text: '비행장 구역 첫 완공' } }),
  T({ id: 'm-ai', line: 'mil', name: '인공지능 표적', icon: '🤖', era: 3, hours: 7, needs: ['m-ew'], eff: { power: { dom: 'all', v: 0.05 }, research: 0.05 }, text: '모든 전투력 +5% · 연구 +5%', eureka: { key: { kind: 'district', id: 'lab' }, text: '연구소 구역 첫 완공' } }),
  T({ id: 'm-sealift', line: 'mil', name: '전략 수송', icon: '🚛', era: 3, hours: 6, needs: ['m-depot', 'm-supply'], cards: ['군-기동'], eff: { build: { dom: 'all', v: 0.1 } }, text: '모든 부대 모집 −10% · 카드 1장', eureka: { key: { kind: 'army', count: 12 }, text: '부대 12개 보유' } }),
  // 대양기
  T({ id: 'm-hyper', line: 'mil', name: '극초음속 미사일', icon: '☄️', era: 4, hours: 11, needs: ['m-guided'], units: ['극초음속 미사일'], eff: { power: { dom: 'all', v: 0.08 } }, text: '막기 어려운 빠른 미사일 · 모든 전투력 +8%', eureka: { key: { kind: 'train', name: '포격', stars: 3 }, text: '포격 훈련 별 3개' } }),
  T({ id: 'm-swarm', line: 'mil', name: '드론 군집', icon: '🐝', era: 4, hours: 10, needs: ['m-ai'], units: ['군집 드론'], eff: { power: { dom: '공', v: 0.1 }, build: { dom: '공', v: 0.1 } }, text: '드론 수백 대가 한 몸처럼 · 공군 전투력 +10% · 공군 모집 −10%', eureka: { key: { kind: 'train', name: '정보', stars: 3 }, text: '정보 훈련 별 3개' } }),
  T({ id: 'm-laser', line: 'mil', name: '레이저 무기', icon: '🔆', era: 4, hours: 12, needs: ['m-vls'], units: ['대드론 레이저 차량'], eff: { power: { dom: '해', v: 0.12 } }, text: '빛으로 미사일을 떨어뜨려요 · 해군 전투력 +12%', eureka: { key: { kind: 'island' }, text: '분쟁 지역 한 곳에서 영향력 1등' } }),
  T({ id: 'm-space', line: 'mil', name: '우주 작전', icon: '🌌', era: 4, hours: 12, needs: ['m-sat'], eff: { mission: 0.05, power: { dom: 'all', v: 0.05 } }, text: '위성으로 전장을 본다 · 임무 +5% · 모든 전투력 +5%', eureka: { key: { kind: 'mission', name: '대전투' }, text: '대전투 승리' } }),
  T({ id: 'm-exo', line: 'mil', name: '강화 외골격', icon: '🦾', era: 4, hours: 10, needs: ['m-active', 'm-nightvis'], eff: { power: { dom: '육', v: 0.12 }, build: { dom: '육', v: 0.1 } }, text: '로봇 옷을 입은 보병 · 육군 전투력 +12% · 육군 모집 −10%', eureka: { key: { kind: 'train', name: '체력', stars: 3 }, text: '체력 훈련 별 3개' } }),
  // ── 11-26 대장 요청: 군사 연구 100개(병과마다 더 잘게 · 새 병과 10개 여는 연구) ──
  // 육군 · 포병 · 상륙
  T({ id: 'm-armorvest', line: 'mil', name: '방탄 장구', icon: '🦺', era: 1, hours: 1, needs: ['m-rifle'], eff: { power: { dom: '육', v: 0.015 } }, text: '방탄복·방탄모 · 육군 +1.5%', eureka: { key: { kind: 'train', name: '체력', stars: 1 }, text: '체력 훈련 성공' } }),
  T({ id: 'm-sof', line: 'mil', name: '특수전 교리', icon: '🥷', era: 1, hours: 1.5, needs: ['m-rifle'], eff: { power: { dom: '육', v: 0.015 }, mission: 0.02 }, text: '특수부대 쓰는 법 · 육군 +1.5% · 임무 +2%', eureka: { key: { kind: 'train', name: '잠입', stars: 1 }, text: '잠입 훈련 성공' } }),
  T({ id: 'm-ifv', line: 'mil', name: '보병 전투차', icon: '🚐', era: 1, hours: 1.5, needs: ['m-mech'], eff: { build: { dom: '육', v: 0.05 } }, text: '포를 단 장갑차 · 육군 모집 −5%', eureka: { key: { kind: 'train', name: '전술', stars: 1 }, text: '전술 훈련 성공' } }),
  T({ id: 'm-mlrs', line: 'mil', name: '다연장 로켓', icon: '🎆', era: 2, hours: 2.5, needs: ['m-arty'], units: ['다연장로켓'], text: '로켓 수십 발을 한꺼번에 · 다연장로켓 부대', eureka: { key: { kind: 'train', name: '포격', stars: 1 }, text: '포격 훈련 성공' } }),
  T({ id: 'm-amphib', line: 'mil', name: '상륙 장갑차', icon: '🐊', era: 2, hours: 2.5, needs: ['m-ifv'], units: ['상륙장갑차'], text: '바다에서 헤엄쳐 해변으로 · 상륙장갑차 부대', eureka: { key: { kind: 'district', id: 'harbor' }, text: '항만 구역 첫 완공' } }),
  T({ id: 'm-tankgun', line: 'mil', name: '활강포 개량', icon: '🔩', era: 2, hours: 2.5, needs: ['m-armor'], eff: { power: { dom: '육', v: 0.025 } }, text: '전차 포를 더 세게 · 육군 +2.5%', eureka: { key: { kind: 'train', name: '사격', stars: 2 }, text: '사격 훈련 별 2개 이상' } }),
  T({ id: 'm-counterbat', line: 'mil', name: '대포병 레이더', icon: '📍', era: 3, hours: 2.5, needs: ['m-mlrs'], eff: { power: { dom: '육', v: 0.025 } }, text: '적 대포 자리를 바로 찾아요 · 육군 +2.5%', eureka: { key: { kind: 'train', name: '포격', stars: 2 }, text: '포격 훈련 별 2개 이상' } }),
  T({ id: 'm-marine', line: 'mil', name: '해병 상륙 교리', icon: '🏖️', era: 3, hours: 2.5, needs: ['m-amphib'], units: ['해병대'], eff: { power: { dom: '육', v: 0.025 } }, text: '바다에서 땅으로 한 번에 · 육군 +2.5%', eureka: { key: { kind: 'train', name: '해상', stars: 1 }, text: '해상 훈련 성공' } }),
  T({ id: 'm-urban', line: 'mil', name: '시가전 교리', icon: '🏙️', era: 2, hours: 2.5, needs: ['m-sof'], units: ['공병'], eff: { power: { dom: '육', v: 0.025 } }, text: '건물 사이 싸움 · 육군 +2.5%', eureka: { key: { kind: 'train', name: '전술', stars: 2 }, text: '전술 훈련 별 2개 이상' } }),
  T({ id: 'm-guidedshell', line: 'mil', name: '유도 포탄', icon: '🎯', era: 3, hours: 5, needs: ['m-counterbat'], eff: { power: { dom: '육', v: 0.035 } }, text: '포탄이 스스로 길을 찾아요 · 육군 +3.5%', eureka: { key: { kind: 'train', name: '포격', stars: 3 }, text: '포격 훈련 별 3개' } }),
  T({ id: 'm-longrocket', line: 'mil', name: '장거리 로켓탄', icon: '🧨', era: 3, hours: 5, needs: ['m-mlrs'], eff: { power: { dom: '육', v: 0.025 }, build: { dom: '육', v: 0.05 } }, text: '로켓이 더 멀리 · 육군 +2.5% · 육군 모집 −5%', eureka: { key: { kind: 'mission', name: '작전' }, text: '작전 성공' } }),
  T({ id: 'm-assault', line: 'mil', name: '강습 상륙', icon: '⚓', era: 4, hours: 5, needs: ['m-marine'], eff: { power: { dom: '육', v: 0.03 } }, text: '헬기·장갑차로 동시에 상륙 · 육군 +3%', eureka: { key: { kind: 'island' }, text: '분쟁 지역 한 곳에서 영향력 1등' } }),
  T({ id: 'm-mbt3', line: 'mil', name: '3세대 전차', icon: '🛡️', era: 3, hours: 5.5, needs: ['m-tankgun'], eff: { power: { dom: '육', v: 0.035 } }, text: '빠르고 단단한 전차 · 육군 +3.5%', eureka: { key: { kind: 'army', count: 10 }, text: '부대 10개 보유' } }),
  T({ id: 'm-ugv', line: 'mil', name: '무인 지상 차량', icon: '🦿', era: 3, hours: 5, needs: ['m-urban'], units: ['무인 전투 로봇'], eff: { build: { dom: '육', v: 0.08 } }, text: '사람 대신 로봇 차가 앞장 · 육군 모집 −8%', eureka: { key: { kind: 'district', id: 'lab' }, text: '연구소 구역 첫 완공' } }),
  T({ id: 'm-railgun', line: 'mil', name: '레일건 함포', icon: '⚡', era: 4, hours: 8, needs: ['m-vls'], eff: { power: { dom: 'all', v: 0.025 } }, text: '군함이 전기로 쏘는 포 · 모든 전투력 +2.5%', eureka: { key: { kind: 'mission', name: '대전투' }, text: '대전투 승리' } }),
  T({ id: 'm-nextmbt', line: 'mil', name: '차세대 전차', icon: '🪖', era: 4, hours: 8, needs: ['m-mbt3'], eff: { power: { dom: '육', v: 0.05 } }, text: '무인 포탑·능동 장갑 · 육군 +5%', eureka: { key: { kind: 'army', count: 25 }, text: '부대 25개 보유' } }),
  T({ id: 'm-robotsq', line: 'mil', name: '로봇 분대', icon: '🤖', era: 4, hours: 8, needs: ['m-ugv'], eff: { power: { dom: '육', v: 0.035 }, build: { dom: '육', v: 0.07 } }, text: '로봇과 함께 싸우는 보병 · 육군 +3.5% · 모집 −7%', eureka: { key: { kind: 'train', name: '전술', stars: 3 }, text: '전술 훈련 별 3개' } }),
  T({ id: 'm-amphibnext', line: 'mil', name: '수륙 기동 여단', icon: '🌊', era: 4, hours: 8, needs: ['m-assault'], eff: { power: { dom: '육', v: 0.04 } }, text: '섬 어디든 하루 만에 · 육군 +4%', eureka: { key: { kind: 'train', name: '해상', stars: 3 }, text: '해상 훈련 별 3개' } }),
  // 공군 · 무인기
  T({ id: 'm-uavrecon', line: 'mil', name: '정찰 무인기', icon: '🛰️', era: 1, hours: 1.5, needs: ['m-drone'], units: ['정찰 무인기'], text: '하늘에서 오래 지켜보는 눈 · 정찰 무인기 부대', eureka: { key: { kind: 'train', name: '정보', stars: 1 }, text: '정보 훈련 성공' } }),
  T({ id: 'm-pilot', line: 'mil', name: '조종사 양성', icon: '👨‍✈️', era: 2, hours: 1.5, needs: ['m-recon'], eff: { power: { dom: '공', v: 0.015 } }, text: '비행 학교 · 공군 +1.5%', eureka: { key: { kind: 'train', name: '항공', stars: 1 }, text: '항공 훈련 성공' } }),
  T({ id: 'm-gunship', line: 'mil', name: '지상 공격기', icon: '🛩️', era: 2, hours: 3, needs: ['m-heli'], units: ['지상 공격기'], text: '느리게 돌며 땅을 두드리는 비행기 · 지상 공격기 부대', eureka: { key: { kind: 'mission', name: '특수작전' }, text: '특수작전 승인 성공' } }),
  T({ id: 'm-datalink', line: 'mil', name: '공중 데이터링크', icon: '🔗', era: 2, hours: 2.5, needs: ['m-uavrecon'], eff: { power: { dom: '공', v: 0.02 }, mission: 0.02 }, text: '비행기끼리 화면을 나눠 봐요 · 공군 +2% · 임무 +2%', eureka: { key: { kind: 'train', name: '정보', stars: 2 }, text: '정보 훈련 별 2개 이상' } }),
  T({ id: 'm-pgm', line: 'mil', name: '정밀 유도 폭탄', icon: '💣', era: 3, hours: 2.5, needs: ['m-gunship'], eff: { power: { dom: '공', v: 0.025 } }, text: '떨어뜨리면 그 자리에 · 공군 +2.5%', eureka: { key: { kind: 'train', name: '항공', stars: 2 }, text: '항공 훈련 별 2개 이상' } }),
  T({ id: 'm-jet4', line: 'mil', name: '4.5세대 전투기', icon: '🛫', era: 3, hours: 3, needs: ['m-jet'], eff: { power: { dom: '공', v: 0.025 } }, text: '레이더·미사일 새로 · 공군 +2.5%', eureka: { key: { kind: 'district', id: 'airfield' }, text: '비행장 구역 첫 완공' } }),
  T({ id: 'm-c2', line: 'mil', name: '공중 지휘 통제', icon: '🎛️', era: 3, hours: 5, needs: ['m-awacs'], eff: { power: { dom: '공', v: 0.025 }, mission: 0.03 }, text: '하늘에서 싸움을 지휘 · 공군 +2.5% · 임무 +3%', eureka: { key: { kind: 'train', name: '통솔', stars: 2 }, text: '통솔 훈련 별 2개 이상' } }),
  T({ id: 'm-f5', line: 'mil', name: '스텔스 전투기', icon: '🦅', era: 3, hours: 6, needs: ['m-stealth'], units: ['스텔스 전투기'], text: '레이더에 안 잡히는 전투기 · 스텔스 전투기 부대', eureka: { key: { kind: 'train', name: '항공', stars: 3 }, text: '항공 훈련 별 3개' } }),
  T({ id: 'm-hale', line: 'mil', name: '고고도 무인기', icon: '🪁', era: 3, hours: 5, needs: ['m-datalink'], eff: { power: { dom: '공', v: 0.025 }, mission: 0.02 }, text: '아주 높이 하루 종일 · 공군 +2.5% · 임무 +2%', eureka: { key: { kind: 'mission', name: '정보보고' }, text: '정보 보고 임무 성공' } }),
  T({ id: 'm-cas', line: 'mil', name: '근접 항공 지원', icon: '📢', era: 4, hours: 5, needs: ['m-pgm'], eff: { power: { dom: '공', v: 0.025 } }, text: '보병이 부르면 바로 날아와요 · 공군 +2.5%', eureka: { key: { kind: 'mission', name: '작전' }, text: '작전 성공' } }),
  T({ id: 'm-ram', line: 'mil', name: '전파 흡수 소재', icon: '🧥', era: 4, hours: 5.5, needs: ['m-f5'], eff: { power: { dom: '공', v: 0.03 } }, text: '레이더 전파를 먹는 겉칠 · 공군 +3%', eureka: { key: { kind: 'train', name: '잠입', stars: 2 }, text: '잠입 훈련 별 2개 이상' } }),
  T({ id: 'm-jet6', line: 'mil', name: '6세대 전투기', icon: '🚀', era: 4, hours: 9, needs: ['m-ram'], eff: { power: { dom: '공', v: 0.05 } }, text: '무인기를 거느리는 전투기 · 공군 +5%', eureka: { key: { kind: 'mission', name: '대전투' }, text: '대전투 승리' } }),
  T({ id: 'm-loyal', line: 'mil', name: '유무인 복합 편대', icon: '🛸', era: 4, hours: 8, needs: ['m-hale'], eff: { power: { dom: '공', v: 0.035 }, build: { dom: '공', v: 0.07 } }, text: '사람 1대 + 무인기 4대 · 공군 +3.5% · 모집 −7%', eureka: { key: { kind: 'train', name: '정보', stars: 3 }, text: '정보 훈련 별 3개' } }),
  T({ id: 'm-glide', line: 'mil', name: '극초음속 활공탄', icon: '☄️', era: 4, hours: 8, needs: ['m-bomber'], eff: { power: { dom: '공', v: 0.04 } }, text: '폭격기가 쏘는 아주 빠른 탄 · 공군 +4%', eureka: { key: { kind: 'train', name: '항공', stars: 3 }, text: '항공 훈련 별 3개' } }),
  T({ id: 'm-airsup', line: 'mil', name: '제공권 교리', icon: '🌤️', era: 4, hours: 8, needs: ['m-c2'], eff: { power: { dom: '공', v: 0.04 } }, text: '하늘부터 가져가요 · 공군 +4%', eureka: { key: { kind: 'army', count: 20 }, text: '부대 20개 보유' } }),
  // 해군 · 바다 무인기
  T({ id: 'm-mine', line: 'mil', name: '기뢰전', icon: '💠', era: 1, hours: 1.5, needs: ['m-coast'], units: ['기뢰 부설함'], eff: { power: { dom: '해', v: 0.02 } }, text: '바닷길에 기뢰를 깔고 걷어요 · 해군 +2%', eureka: { key: { kind: 'train', name: '해상', stars: 1 }, text: '해상 훈련 성공' } }),
  T({ id: 'm-navbase', line: 'mil', name: '해군 기지 정비', icon: '🏗️', era: 1, hours: 1.5, needs: ['m-coast'], eff: { build: { dom: '해', v: 0.05 } }, text: '부두·수리창 · 해군 모집 −5%', eureka: { key: { kind: 'train', name: '보급', stars: 1 }, text: '보급 훈련 성공' } }),
  T({ id: 'm-coastal', line: 'mil', name: '해안 미사일', icon: '🏝️', era: 2, hours: 3, needs: ['m-mine'], units: ['해안 미사일'], text: '바닷가 트럭에서 군함을 쏴요 · 해안 미사일 부대', eureka: { key: { kind: 'district', id: 'harbor' }, text: '항만 구역 첫 완공' } }),
  T({ id: 'm-seadrone', line: 'mil', name: '바다 드론', icon: '🚤', era: 2, hours: 3, needs: ['m-sonar'], units: ['바다 드론'], text: '사람 없는 작은 배가 돌진 · 바다 드론 부대', eureka: { key: { kind: 'train', name: '해킹', stars: 1 }, text: '해킹 훈련 성공' } }),
  T({ id: 'm-asw', line: 'mil', name: '대잠 헬기', icon: '🚁', era: 2, hours: 2.5, needs: ['m-sonar'], eff: { power: { dom: '해', v: 0.025 } }, text: '하늘에서 잠수함을 찾아요 · 해군 +2.5%', eureka: { key: { kind: 'train', name: '항공', stars: 1 }, text: '항공 훈련 성공' } }),
  T({ id: 'm-frigate', line: 'mil', name: '호위함 개량', icon: '🛥️', era: 2, hours: 2.5, needs: ['m-navbase'], eff: { build: { dom: '해', v: 0.06 } }, text: '작고 싼 군함을 많이 · 해군 모집 −6%', eureka: { key: { kind: 'mission', name: '군수협상' }, text: '무기 지원 협상 성공' } }),
  T({ id: 'm-ashm', line: 'mil', name: '초음속 대함 미사일', icon: '🎇', era: 3, hours: 5, needs: ['m-coastal'], eff: { power: { dom: '해', v: 0.035 } }, text: '막기 어려운 빠른 대함탄 · 해군 +3.5%', eureka: { key: { kind: 'train', name: '포격', stars: 2 }, text: '포격 훈련 별 2개 이상' } }),
  T({ id: 'm-usv', line: 'mil', name: '무인 함정 군집', icon: '🐟', era: 3, hours: 5, needs: ['m-seadrone'], eff: { power: { dom: '해', v: 0.025 }, build: { dom: '해', v: 0.05 } }, text: '바다 드론 떼 · 해군 +2.5% · 모집 −5%', eureka: { key: { kind: 'train', name: '해킹', stars: 2 }, text: '해킹 훈련 별 2개 이상' } }),
  T({ id: 'm-aip', line: 'mil', name: '공기 없이 추진', icon: '🫧', era: 3, hours: 5.5, needs: ['m-silent'], eff: { power: { dom: '해', v: 0.03 } }, text: '잠수함이 몇 주씩 물속에 · 해군 +3%', eureka: { key: { kind: 'train', name: '잠입', stars: 2 }, text: '잠입 훈련 별 2개 이상' } }),
  T({ id: 'm-dock', line: 'mil', name: '대형 조선소', icon: '🏭', era: 3, hours: 5, needs: ['m-frigate'], eff: { build: { dom: '해', v: 0.08 } }, text: '큰 배를 빨리 · 해군 모집 −8%', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  T({ id: 'm-uuv', line: 'mil', name: '무인 잠수정', icon: '🐋', era: 4, hours: 8, needs: ['m-usv'], eff: { power: { dom: '해', v: 0.04 } }, text: '물속을 혼자 다니는 로봇 · 해군 +4%', eureka: { key: { kind: 'train', name: '해상', stars: 3 }, text: '해상 훈련 별 3개' } }),
  T({ id: 'm-coastnet', line: 'mil', name: '해안 방어망', icon: '🧱', era: 4, hours: 8, needs: ['m-ashm'], eff: { power: { dom: '해', v: 0.04 } }, text: '해안 미사일·레이더를 하나로 · 해군 +4%', eureka: { key: { kind: 'island' }, text: '분쟁 지역 한 곳에서 영향력 1등' } }),
  T({ id: 'm-slbm', line: 'mil', name: '잠수함 발사 미사일', icon: '🌋', era: 4, hours: 9, needs: ['m-aip'], eff: { power: { dom: '해', v: 0.05 } }, text: '물속에서 쏘는 미사일 · 해군 +5%', eureka: { key: { kind: 'mission', name: '대전투' }, text: '대전투 승리' } }),
  T({ id: 'm-navew', line: 'mil', name: '함정 전자전', icon: '📡', era: 4, hours: 8, needs: ['m-laser'], eff: { power: { dom: '해', v: 0.025 }, mission: 0.02 }, text: '적 미사일 눈을 가려요 · 해군 +2.5% · 임무 +2%', eureka: { key: { kind: 'train', name: '해킹', stars: 3 }, text: '해킹 훈련 별 3개' } }),
  // 미사일 · 방공
  T({ id: 'm-sam', line: 'mil', name: '장거리 방공', icon: '🎯', era: 2, hours: 3, needs: ['m-radar'], units: ['장거리 방공'], text: '수백 km 밖 비행기·미사일을 잡아요 · 장거리 방공 부대', eureka: { key: { kind: 'train', name: '항공', stars: 2 }, text: '항공 훈련 별 2개 이상' } }),
  T({ id: 'm-shorad', line: 'mil', name: '근거리 방공포', icon: '🔫', era: 2, hours: 2.5, needs: ['m-radar'], eff: { power: { dom: '육', v: 0.02 } }, text: '드론·헬기를 가까이서 · 육군 +2%', eureka: { key: { kind: 'train', name: '사격', stars: 2 }, text: '사격 훈련 별 2개 이상' } }),
  T({ id: 'm-ballistic', line: 'mil', name: '탄도미사일', icon: '🚀', era: 3, hours: 6, needs: ['m-guided'], units: ['탄도미사일'], text: '하늘 높이 올라갔다 내리꽂아요 · 탄도미사일 부대', eureka: { key: { kind: 'district', id: 'lab' }, text: '연구소 구역 첫 완공' } }),
  T({ id: 'm-bmd', line: 'mil', name: '미사일 방어', icon: '☂️', era: 3, hours: 5.5, needs: ['m-sam'], eff: { power: { dom: 'all', v: 0.02 } }, text: '날아오는 미사일을 맞혀요 · 모든 전투력 +2%', eureka: { key: { kind: 'mission', name: '안보회의' }, text: '방어 안보회의 성공' } }),
  T({ id: 'm-tel', line: 'mil', name: '이동식 발사대', icon: '🚛', era: 4, hours: 5, needs: ['m-ballistic'], eff: { build: { dom: 'all', v: 0.05 } }, text: '숨었다 쏘고 사라져요 · 모든 모집 −5%', eureka: { key: { kind: 'train', name: '보급', stars: 3 }, text: '보급 훈련 별 3개' } }),
  T({ id: 'm-mirv', line: 'mil', name: '다탄두 미사일', icon: '🎇', era: 4, hours: 9, needs: ['m-tel'], eff: { power: { dom: 'all', v: 0.03 } }, text: '한 발에 탄두 여러 개 · 모든 전투력 +3%', eureka: { key: { kind: 'rank', at: 8 }, text: '위대한 지도자 호칭 얻기' } }),
  T({ id: 'm-layered', line: 'mil', name: '다층 방공망', icon: '🛡️', era: 4, hours: 8, needs: ['m-bmd'], eff: { power: { dom: 'all', v: 0.025 } }, text: '높이마다 다른 방공 · 모든 전투력 +2.5%', eureka: { key: { kind: 'army', count: 30 }, text: '부대 30개 보유' } }),
  // 정보 · 사이버 · 보급
  T({ id: 'm-crypto', line: 'mil', name: '암호 통신', icon: '🔐', era: 1, hours: 1.5, needs: ['m-comms'], eff: { mission: 0.02 }, text: '적이 못 엿들어요 · 임무 +2%', eureka: { key: { kind: 'train', name: '해킹', stars: 1 }, text: '해킹 훈련 성공' } }),
  T({ id: 'm-sigint', line: 'mil', name: '신호 정보', icon: '👂', era: 2, hours: 2.5, needs: ['m-crypto'], eff: { mission: 0.03 }, text: '적 전파를 엿들어요 · 임무 +3%', eureka: { key: { kind: 'mission', name: '정보보고' }, text: '정보 보고 임무 성공' } }),
  T({ id: 'm-medic', line: 'mil', name: '야전 의무대', icon: '⛑️', era: 2, hours: 2.5, needs: ['m-depot'], eff: { power: { dom: '육', v: 0.02 } }, text: '다친 병사를 빨리 살려요 · 육군 +2%', eureka: { key: { kind: 'train', name: '체력', stars: 2 }, text: '체력 훈련 별 2개 이상' } }),
  T({ id: 'm-cybercmd', line: 'mil', name: '사이버 사령부', icon: '🧑‍💻', era: 3, hours: 5, needs: ['m-sigint'], eff: { power: { dom: 'all', v: 0.015 }, mission: 0.02 }, text: '해커 부대를 한곳에서 · 모든 전투력 +1.5% · 임무 +2%', eureka: { key: { kind: 'train', name: '해킹', stars: 3 }, text: '해킹 훈련 별 3개' } }),
  T({ id: 'm-quantum', line: 'mil', name: '양자 통신', icon: '⚛️', era: 4, hours: 9, needs: ['m-cybercmd'], eff: { mission: 0.04, research: 0.05 }, text: '절대 못 뚫는 통신 · 임무 +4% · 연구 +5%', eureka: { key: { kind: 'district', id: 'lab' }, text: '연구소 구역 첫 완공' } }),
  T({ id: 'm-autolog', line: 'mil', name: '자동화 보급', icon: '📦', era: 4, hours: 8, needs: ['m-sealift'], eff: { build: { dom: 'all', v: 0.08 } }, text: '로봇·드론이 보급을 날라요 · 모든 모집 −8%', eureka: { key: { kind: 'army', count: 20 }, text: '부대 20개 보유' } }),
];

/** 사회 제도 70개(11-26 대장 요청으로 30 → 70) */
export const SOC_TECHS: Tech[] = [
  // 도약기
  T({ id: 's-charter', line: 'soc', name: '국가 헌장', icon: '📜', era: 1, hours: 1, needs: [], cards: ['군-징집', '경-개척'], text: '체제 바꾸기 · 카드 2장', eureka: { key: { kind: 'rank', at: 1 }, text: '초보 지도자 호칭 얻기' } }),
  T({ id: 's-urban', line: 'soc', name: '도시 계획', icon: '🏘️', era: 1, hours: 1, needs: [], districts: ['industry', 'housing'], cards: ['경-도시'], text: '공업·주거 구역 짓기', eureka: { key: { kind: 'train', name: '보급', stars: 1 }, text: '보급 훈련 성공' } }),
  T({ id: 's-envoy', line: 'soc', name: '사절단', icon: '🕊️', era: 1, hours: 1.5, needs: [], agree: ['route'], cards: ['외-사절'], text: '항로 개방 협정 · 분쟁 지역 사절 효율 ↑', eureka: { key: { kind: 'talk', att: '화해' }, text: '대화에서 화해 성공' } }),
  T({ id: 's-guild', line: 'soc', name: '항로 상회', icon: '⚖️', era: 1, hours: 1.5, needs: [], agree: ['swap'], cards: ['경-상회'], text: '자원 교환 계약 협정', eureka: { key: { kind: 'talk', att: '거래' }, text: '대화에서 거래 성공' } }),
  // 항로기
  T({ id: 's-harbor', line: 'soc', name: '항만법', icon: '⚓', era: 2, hours: 3, needs: ['s-urban'], cards: ['군-해병'], eff: { power: { dom: '해', v: 0.05 } }, text: '해군 전투력 +5% · 카드 1장', eureka: { key: { kind: 'train', name: '해상', stars: 1 }, text: '해상 훈련 성공' } }),
  T({ id: 's-aviation', line: 'soc', name: '항공법', icon: '🛫', era: 2, hours: 3, needs: ['s-urban'], cards: ['군-조종'], eff: { power: { dom: '공', v: 0.05 } }, text: '공군 전투력 +5% · 카드 1장', eureka: { key: { kind: 'train', name: '항공', stars: 1 }, text: '항공 훈련 성공' } }),
  T({ id: 's-academy', line: 'soc', name: '학술원', icon: '🎓', era: 2, hours: 3.5, needs: ['s-urban'], districts: ['lab'], agree: ['science'], cards: ['경-학자'], text: '연구소 구역 · 연구 협력 협정', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  T({ id: 's-nonagg', line: 'soc', name: '불가침 조약법', icon: '🤝', era: 2, hours: 3, needs: ['s-envoy'], agree: ['nonagg'], cards: ['외-불가침'], text: '불가침 협정', eureka: { key: { kind: 'agree', id: 'route' }, text: '항로 개방 협정 맺기' } }),
  // 제공기
  T({ id: 's-defense', line: 'soc', name: '상호 방위법', icon: '🛡️', era: 3, hours: 6, needs: ['s-nonagg'], agree: ['defense'], cards: ['외-방위', '군-방위'], text: '방위 약속 협정', eureka: { key: { kind: 'mission', name: '작전' }, text: '작전 성공' } }),
  T({ id: 's-welfare', line: 'soc', name: '복지 제도', icon: '🏥', era: 3, hours: 5, needs: ['s-urban'], eff: { loyalty: 5 }, cards: ['경-복지'], text: '모든 도시 민심 +5', eureka: { key: { kind: 'district', id: 'housing' }, text: '주거 구역 첫 완공' } }),
  T({ id: 's-draft', line: 'soc', name: '국민 개병제', icon: '🪖', era: 3, hours: 5, needs: ['s-charter'], cards: ['군-동원', '군-정예'], text: '군사 카드 2장', eureka: { key: { kind: 'train', name: '모병', stars: 2 }, text: '모병 훈련 별 2개 이상' } }),
  T({ id: 's-council', line: 'soc', name: '국제 회의 제도', icon: '🏛️', era: 3, hours: 6, needs: ['s-envoy'], eff: { votes: 1 }, cards: ['외-회의'], text: '회의 표 +1', eureka: { key: { kind: 'talk' }, text: '성소 회담(대화) 성공' } }),
  // 대양기
  T({ id: 's-federal', line: 'soc', name: '헌법 개정', icon: '🏛️', era: 4, hours: 10, needs: ['s-charter', 's-welfare'], cards: ['경-연방', '외-연방'], eff: { growth: 0.2 }, text: '도시 성장 +20% · 카드 2장', eureka: { key: { kind: 'rank', at: 6 }, text: '존경받는 지도자 호칭 얻기' } }),
  T({ id: 's-media', line: 'soc', name: '국민 방송', icon: '📺', era: 4, hours: 9, needs: ['s-welfare'], eff: { loyalty: 5, favor: 5 }, cards: ['외-방송'], text: '민심 +5 · 모든 나라 호감 +5', eureka: { key: { kind: 'talk', att: '원칙' }, text: '대화에서 원칙 성공' } }),
  T({ id: 's-peace', line: 'soc', name: '국제 평화 헌장', icon: '☮️', era: 4, hours: 12, needs: ['s-council', 's-defense'], eff: { favor: 10, influence: 0.25 }, cards: ['외-평화'], text: '모든 나라 호감 +10 · 분쟁 지역 영향력 +25%', eureka: { key: { kind: 'agree', id: 'defense' }, text: '방위 약속 협정 맺기' } }),
  // ── 11-23 더 잘게 나눈 사회 제도 15개(분야: 경제·외교·내정·인구·국방) ──
  // 도약기
  T({ id: 's-census', line: 'soc', name: '인구 조사', icon: '📊', era: 1, hours: 1, needs: [], eff: { growth: 0.1 }, text: '도시 성장 +10%', eureka: { key: { kind: 'train', name: '통솔', stars: 1 }, text: '통솔 훈련 성공' } }),
  T({ id: 's-tax', line: 'soc', name: '조세 개혁', icon: '🧾', era: 1, hours: 1.5, needs: [], cards: ['경-조세'], eff: { budget: 0.05 }, text: '나라 예산 +5% · 카드 1장', eureka: { key: { kind: 'train', name: '보급', stars: 2 }, text: '보급 훈련 별 2개 이상' } }),
  T({ id: 's-press', line: 'soc', name: '언론 자유', icon: '📰', era: 1, hours: 1.5, needs: [], cards: ['외-문화'], eff: { loyalty: 2, favor: 2 }, text: '민심 +2 · 모든 나라 호감 +2 · 카드 1장 · 대통령제', eureka: { key: { kind: 'talk', att: '원칙' }, text: '대화에서 원칙 성공' } }),
  T({ id: 's-school', line: 'soc', name: '의무 교육', icon: '🏫', era: 1, hours: 1.5, needs: [], eff: { research: 0.05 }, text: '연구 +5% · 기술 관료제', eureka: { key: { kind: 'rank', at: 2 }, text: '믿음직한 지도자 호칭 얻기' } }),
  // 항로기
  T({ id: 's-customs', line: 'soc', name: '관세 협정', icon: '🛃', era: 2, hours: 3, needs: ['s-guild'], cards: ['경-관세'], eff: { trade: 0.05 }, text: '무역 값 5% 이득 · 카드 1장', eureka: { key: { kind: 'agree', id: 'swap' }, text: '자원 교환 계약 맺기' } }),
  T({ id: 's-mining', line: 'soc', name: '광업법', icon: '⛏️', era: 2, hours: 3, needs: ['s-urban'], cards: ['경-채굴'], eff: { res: 0.08 }, text: '자원 +8% · 카드 1장', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  T({ id: 's-intel', line: 'soc', name: '정보 기관법', icon: '🕵️', era: 2, hours: 3.5, needs: ['s-envoy'], cards: ['군-첩보'], eff: { mission: 0.03 }, text: '임무 성공률 +3% · 카드 1장', eureka: { key: { kind: 'mission', name: '정보보고' }, text: '정보 보고 임무 성공' } }),
  T({ id: 's-reserve', line: 'soc', name: '예비군 제도', icon: '🎒', era: 2, hours: 3, needs: ['s-charter'], cards: ['군-예비'], eff: { build: { dom: '육', v: 0.08 } }, text: '육군 모집 −8% · 카드 1장 · 군사 정부', eureka: { key: { kind: 'train', name: '모병', stars: 1 }, text: '모병 훈련 성공' } }),
  // 제공기
  T({ id: 's-industry', line: 'soc', name: '산업 정책', icon: '🏗️', era: 3, hours: 5, needs: ['s-mining'], cards: ['경-산업'], eff: { res: 0.08, budget: 0.05 }, text: '자원 +8% · 나라 예산 +5% · 카드 1장', eureka: { key: { kind: 'army', count: 15 }, text: '부대 15개 보유' } }),
  T({ id: 's-alliance', line: 'soc', name: '동맹 외교', icon: '🌐', era: 3, hours: 6, needs: ['s-nonagg'], cards: ['외-동맹'], eff: { favor: 4, contracts: 1 }, text: '모든 나라 호감 +4 · 정기 계약 +1칸 · 카드 1장', eureka: { key: { kind: 'agree', id: 'nonagg' }, text: '불가침 협정 맺기' } }),
  T({ id: 's-transport', line: 'soc', name: '교통망 확충', icon: '🛤️', era: 3, hours: 5, needs: ['s-urban'], eff: { district: 0.15, growth: 0.1 }, text: '구역 짓는 시간 −15% · 도시 성장 +10% · 연방제', eureka: { key: { kind: 'district', id: 'housing' }, text: '주거 구역 첫 완공' } }),
  T({ id: 's-veterans', line: 'soc', name: '보훈 제도', icon: '🎗️', era: 3, hours: 5, needs: ['s-reserve'], cards: ['군-보훈'], eff: { loyalty: 3, power: { dom: 'all', v: 0.03 } }, text: '민심 +3 · 모든 전투력 +3% · 카드 1장', eureka: { key: { kind: 'mission', name: '작전' }, text: '작전 성공' } }),
  // 대양기
  T({ id: 's-digital', line: 'soc', name: '디지털 정부', icon: '🖥️', era: 4, hours: 9, needs: ['s-school', 's-media'], eff: { research: 0.1, budget: 0.05 }, text: '연구 +10% · 나라 예산 +5%', eureka: { key: { kind: 'train', name: '해킹', stars: 3 }, text: '해킹 훈련 별 3개' } }),
  T({ id: 's-aid', line: 'soc', name: '국제 원조', icon: '🎁', era: 4, hours: 10, needs: ['s-alliance'], cards: ['외-원조'], eff: { favor: 6, influence: 0.15 }, text: '모든 나라 호감 +6 · 분쟁 지역 영향력 +15% · 카드 1장', eureka: { key: { kind: 'talk', att: '화해' }, text: '대화에서 화해 성공' } }),
  T({ id: 's-unify', line: 'soc', name: '국민 통합', icon: '🫂', era: 4, hours: 11, needs: ['s-veterans', 's-press'], cards: ['외-중재'], eff: { loyalty: 6, votes: 1 }, text: '민심 +6 · 국제 회의 표 +1 · 카드 1장', eureka: { key: { kind: 'rank', at: 8 }, text: '위대한 지도자 호칭 얻기' } }),
  // ── 11-26 대장 요청: 사회 제도 70개(경제·외교·내정·인구·과학·국방 더 잘게) ──
  // 도약기
  T({ id: 's-bank', line: 'soc', name: '중앙은행', icon: '🏦', era: 1, hours: 1, needs: ['s-tax'], eff: { budget: 0.04 }, text: '돈 흐름을 다스려요 · 나라 예산 +4%', eureka: { key: { kind: 'train', name: '보급', stars: 1 }, text: '보급 훈련 성공' } }),
  T({ id: 's-police', line: 'soc', name: '치안 제도', icon: '👮', era: 1, hours: 1, needs: ['s-charter'], eff: { loyalty: 2 }, text: '골목이 안전해요 · 민심 +2', eureka: { key: { kind: 'train', name: '통솔', stars: 1 }, text: '통솔 훈련 성공' } }),
  T({ id: 's-health', line: 'soc', name: '보건소', icon: '🩺', era: 1, hours: 1, needs: ['s-census'], eff: { growth: 0.05 }, text: '동네마다 보건소 · 도시 성장 +5%', eureka: { key: { kind: 'train', name: '체력', stars: 1 }, text: '체력 훈련 성공' } }),
  T({ id: 's-market', line: 'soc', name: '시장 개방', icon: '🛒', era: 1, hours: 1.5, needs: ['s-guild'], eff: { trade: 0.03 }, text: '외국 물건도 자유롭게 · 무역 3% 이득', eureka: { key: { kind: 'talk', att: '거래' }, text: '대화에서 거래 성공' } }),
  T({ id: 's-library', line: 'soc', name: '공공 도서관', icon: '📚', era: 1, hours: 1, needs: ['s-school'], eff: { research: 0.03 }, text: '누구나 책을 · 연구 +3%', eureka: { key: { kind: 'train', name: '정보', stars: 1 }, text: '정보 훈련 성공' } }),
  T({ id: 's-postal', line: 'soc', name: '우편·통신망', icon: '📮', era: 1, hours: 1, needs: ['s-urban'], eff: { district: 0.05 }, text: '전국을 잇는 통신 · 구역 짓기 −5%', eureka: { key: { kind: 'train', name: '통솔', stars: 2 }, text: '통솔 훈련 별 2개 이상' } }),
  // 항로기
  T({ id: 's-bond', line: 'soc', name: '국채 발행', icon: '💴', era: 2, hours: 2.5, needs: ['s-bank'], eff: { budget: 0.05 }, text: '나라가 돈을 빌려 크게 써요 · 나라 예산 +5%', eureka: { key: { kind: 'talk', att: '거래' }, text: '대화에서 거래 성공' } }),
  T({ id: 's-labor', line: 'soc', name: '노동법', icon: '👷', era: 2, hours: 2.5, needs: ['s-police'], eff: { loyalty: 3, res: 0.03 }, text: '일하는 사람을 지켜요 · 민심 +3 · 자원 +3%', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  T({ id: 's-housing', line: 'soc', name: '공공 주택', icon: '🏢', era: 2, hours: 2.5, needs: ['s-health'], eff: { growth: 0.08 }, text: '싼 집을 많이 · 도시 성장 +8%', eureka: { key: { kind: 'district', id: 'housing' }, text: '주거 구역 첫 완공' } }),
  T({ id: 's-port', line: 'soc', name: '자유 무역항', icon: '🚢', era: 2, hours: 3, needs: ['s-customs'], eff: { trade: 0.04, contracts: 1 }, text: '세금 없는 항구 · 무역 4% 이득 · 정기 계약 +1칸', eureka: { key: { kind: 'district', id: 'harbor' }, text: '항만 구역 첫 완공' } }),
  T({ id: 's-embassy', line: 'soc', name: '상주 대사관', icon: '🏛️', era: 2, hours: 2.5, needs: ['s-envoy'], eff: { favor: 3 }, text: '나라마다 대사관 · 모든 나라 호감 +3', eureka: { key: { kind: 'talk', att: '화해' }, text: '대화에서 화해 성공' } }),
  T({ id: 's-univ', line: 'soc', name: '국립 대학', icon: '🎓', era: 2, hours: 3, needs: ['s-library'], eff: { research: 0.05 }, text: '인재를 길러요 · 연구 +5%', eureka: { key: { kind: 'district', id: 'lab' }, text: '연구소 구역 첫 완공' } }),
  T({ id: 's-energy', line: 'soc', name: '에너지 정책', icon: '🔌', era: 2, hours: 2.5, needs: ['s-mining'], eff: { res: 0.05 }, text: '발전소·송전망 · 자원 +5%', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  T({ id: 's-civdef', line: 'soc', name: '민방위', icon: '🚨', era: 2, hours: 2.5, needs: ['s-reserve'], eff: { loyalty: 2, power: { dom: '육', v: 0.03 } }, text: '온 국민이 대피·대비 · 민심 +2 · 육군 +3%', eureka: { key: { kind: 'train', name: '모병', stars: 1 }, text: '모병 훈련 성공' } }),
  T({ id: 's-tourism', line: 'soc', name: '관광 진흥', icon: '🗺️', era: 2, hours: 2.5, needs: ['s-press'], eff: { favor: 2, budget: 0.02 }, text: '외국 손님을 불러요 · 호감 +2 · 나라 예산 +2%', eureka: { key: { kind: 'talk', att: '원칙' }, text: '대화에서 원칙 성공' } }),
  // 제공기
  T({ id: 's-fta', line: 'soc', name: '자유 무역 협정', icon: '🤝', era: 3, hours: 5, needs: ['s-port'], eff: { trade: 0.05 }, text: '관세를 서로 없애요 · 무역 5% 이득', eureka: { key: { kind: 'agree', id: 'swap' }, text: '자원 교환 계약 맺기' } }),
  T({ id: 's-insure', line: 'soc', name: '국민 보험', icon: '💊', era: 3, hours: 5, needs: ['s-welfare'], eff: { loyalty: 3, growth: 0.05 }, text: '병원비 걱정 덜어요 · 민심 +3 · 성장 +5%', eureka: { key: { kind: 'district', id: 'housing' }, text: '주거 구역 첫 완공' } }),
  T({ id: 's-newcity', line: 'soc', name: '신도시 개발', icon: '🏗️', era: 3, hours: 5, needs: ['s-housing'], eff: { growth: 0.08, district: 0.08 }, text: '새 도시를 통째로 · 성장 +8% · 구역 짓기 −8%', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  T({ id: 's-refugee', line: 'soc', name: '이민 제도', icon: '🧳', era: 3, hours: 4.5, needs: ['s-housing'], eff: { growth: 0.07 }, text: '사람이 들어와 살아요 · 성장 +7%', eureka: { key: { kind: 'talk', att: '화해' }, text: '대화에서 화해 성공' } }),
  T({ id: 's-rnd', line: 'soc', name: '연구 개발 투자', icon: '🔬', era: 3, hours: 5, needs: ['s-univ'], eff: { research: 0.07 }, text: '기업·대학 연구에 돈을 · 연구 +7%', eureka: { key: { kind: 'district', id: 'lab' }, text: '연구소 구역 첫 완공' } }),
  T({ id: 's-chaebol', line: 'soc', name: '대기업 육성', icon: '🏢', era: 3, hours: 5, needs: ['s-industry'], eff: { budget: 0.05, res: 0.04 }, text: '큰 회사를 키워요 · 나라 예산 +5% · 자원 +4%', eureka: { key: { kind: 'army', count: 15 }, text: '부대 15개 보유' } }),
  T({ id: 's-union', line: 'soc', name: '노사 협약', icon: '🤜', era: 3, hours: 4.5, needs: ['s-labor'], eff: { loyalty: 3, res: 0.03 }, text: '파업 대신 대화 · 민심 +3 · 자원 +3%', eureka: { key: { kind: 'talk', att: '원칙' }, text: '대화에서 원칙 성공' } }),
  T({ id: 's-softpower', line: 'soc', name: '문화 외교', icon: '🎤', era: 3, hours: 5, needs: ['s-embassy'], eff: { favor: 5 }, text: '노래·드라마로 친해져요 · 모든 나라 호감 +5', eureka: { key: { kind: 'talk' }, text: '성소 회담(대화) 성공' } }),
  T({ id: 's-defind', line: 'soc', name: '방위 산업 육성', icon: '🏭', era: 3, hours: 5, needs: ['s-civdef'], eff: { build: { dom: 'all', v: 0.06 } }, text: '무기를 직접 만들어요 · 모든 모집 −6%', eureka: { key: { kind: 'mission', name: '군수협상' }, text: '무기 지원 협상 성공' } }),
  T({ id: 's-treasury', line: 'soc', name: '재정 건전화', icon: '📈', era: 3, hours: 5, needs: ['s-bond'], eff: { budget: 0.06 }, text: '빚을 줄이고 곳간을 채워요 · 나라 예산 +6%', eureka: { key: { kind: 'rank', at: 4 }, text: '지도자 호칭 4단계 얻기' } }),
  T({ id: 's-anticorrupt', line: 'soc', name: '반부패법', icon: '⚖️', era: 3, hours: 4.5, needs: ['s-tourism'], eff: { loyalty: 4 }, text: '뇌물을 막아요 · 민심 +4', eureka: { key: { kind: 'mission', name: '정보보고' }, text: '정보 보고 임무 성공' } }),
  T({ id: 's-green', line: 'soc', name: '친환경 에너지', icon: '🌞', era: 3, hours: 5, needs: ['s-energy'], eff: { res: 0.06 }, text: '해·바람으로 전기 · 자원 +6%', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  // 대양기
  T({ id: 's-fintech', line: 'soc', name: '금융 허브', icon: '💹', era: 4, hours: 8, needs: ['s-treasury'], eff: { budget: 0.08 }, text: '세계 돈이 모여요 · 나라 예산 +8%', eureka: { key: { kind: 'train', name: '해킹', stars: 2 }, text: '해킹 훈련 별 2개 이상' } }),
  T({ id: 's-smartcity', line: 'soc', name: '스마트 시티', icon: '🌆', era: 4, hours: 8, needs: ['s-newcity'], eff: { growth: 0.12, research: 0.03 }, text: '똑똑한 도시 · 성장 +12% · 연구 +3%', eureka: { key: { kind: 'district', id: 'lab' }, text: '연구소 구역 첫 완공' } }),
  T({ id: 's-spaceagency', line: 'soc', name: '우주 개발청', icon: '🚀', era: 4, hours: 9, needs: ['s-rnd'], eff: { research: 0.08 }, text: '로켓·위성을 우리 손으로 · 연구 +8%', eureka: { key: { kind: 'mission', name: '정보보고' }, text: '정보 보고 임무 성공' } }),
  T({ id: 's-wto', line: 'soc', name: '세계 무역 기구', icon: '🌐', era: 4, hours: 8, needs: ['s-fta'], eff: { trade: 0.05, contracts: 1 }, text: '세계 무역 규칙을 만들어요 · 무역 5% 이득 · 계약 +1칸', eureka: { key: { kind: 'agree', id: 'swap' }, text: '자원 교환 계약 맺기' } }),
  T({ id: 's-pension', line: 'soc', name: '국민 연금', icon: '👵', era: 4, hours: 8, needs: ['s-insure'], eff: { loyalty: 5 }, text: '늙어도 걱정 없게 · 민심 +5', eureka: { key: { kind: 'rank', at: 6 }, text: '존경받는 지도자 호칭 얻기' } }),
  T({ id: 's-unsc', line: 'soc', name: '상임 이사국 외교', icon: '🕊️', era: 4, hours: 9, needs: ['s-softpower'], eff: { votes: 1, favor: 4 }, text: '세계 회의의 주인공 · 회의 표 +1 · 호감 +4', eureka: { key: { kind: 'agree', id: 'defense' }, text: '방위 약속 협정 맺기' } }),
  T({ id: 's-armsexport', line: 'soc', name: '방산 수출', icon: '📦', era: 4, hours: 8, needs: ['s-defind'], eff: { budget: 0.05, favor: 2 }, text: '무기를 팔아 돈과 친구를 · 나라 예산 +5% · 호감 +2', eureka: { key: { kind: 'mission', name: '군수협상' }, text: '무기 지원 협상 성공' } }),
  T({ id: 's-carbon', line: 'soc', name: '탄소 중립', icon: '🌳', era: 4, hours: 8, needs: ['s-green'], eff: { res: 0.05, favor: 3 }, text: '깨끗한 나라 · 자원 +5% · 호감 +3', eureka: { key: { kind: 'talk', att: '원칙' }, text: '대화에서 원칙 성공' } }),
  T({ id: 's-democracy', line: 'soc', name: '성숙한 민주주의', icon: '🗳️', era: 4, hours: 8, needs: ['s-anticorrupt'], eff: { loyalty: 5, favor: 2 }, text: '국민이 믿는 정부 · 민심 +5 · 호감 +2', eureka: { key: { kind: 'rank', at: 8 }, text: '위대한 지도자 호칭 얻기' } }),
  T({ id: 's-global', line: 'soc', name: '세계 기업', icon: '🏙️', era: 4, hours: 8, needs: ['s-chaebol'], eff: { budget: 0.05, trade: 0.03 }, text: '우리 회사가 세계로 · 나라 예산 +5% · 무역 3% 이득', eureka: { key: { kind: 'agree', id: 'route' }, text: '항로 개방 협정 맺기' } }),
  T({ id: 's-aigov', line: 'soc', name: '인공지능 행정', icon: '🧠', era: 4, hours: 9, needs: ['s-digital'], eff: { research: 0.06, budget: 0.03 }, text: '서류는 AI가 · 연구 +6% · 나라 예산 +3%', eureka: { key: { kind: 'train', name: '해킹', stars: 3 }, text: '해킹 훈련 별 3개' } }),
  T({ id: 's-4day', line: 'soc', name: '주 4일제', icon: '🏖️', era: 4, hours: 8, needs: ['s-union'], eff: { loyalty: 4, growth: 0.05 }, text: '쉬는 날이 늘어요 · 민심 +4 · 성장 +5%', eureka: { key: { kind: 'talk', att: '화해' }, text: '대화에서 화해 성공' } }),
  T({ id: 's-ktx', line: 'soc', name: '고속철도망', icon: '🚄', era: 4, hours: 8, needs: ['s-transport'], eff: { district: 0.1, growth: 0.05 }, text: '전국 반나절 · 구역 짓기 −10% · 성장 +5%', eureka: { key: { kind: 'district', id: 'housing' }, text: '주거 구역 첫 완공' } }),
];

export const TECHS: Tech[] = [...MIL_TECHS, ...SOC_TECHS];
export const techById = (id: string) => TECHS.find((t) => t.id === id);
/** 병과 → 여는 연구(없으면 처음부터 열림: 보병·특수부대) */
export function techForUnit(unit: string): Tech | undefined {
  return MIL_TECHS.find((t) => t.units?.includes(unit));
}

// ── 나라 체제(11-22 4가지 → 11-23 대장 요청으로 8가지) · 정책 카드 ──

export type SlotKind = '군사' | '경제' | '외교' | '자유';
export const SLOT_ICON: Record<SlotKind, string> = { 군사: '⚔️', 경제: '💰', 외교: '🕊️', 자유: '⭐' };
export type GovId = 'assembly' | 'navy' | 'merchant' | 'sanctum' | 'republic' | 'junta' | 'technocracy' | 'federation';
export interface Gov {
  id: GovId;
  name: string;
  icon: string;
  /** 처음 5칸(기획서 칸 구성) */
  slots: SlotKind[];
  eff: Eff;
  text: string;
  play: string;
  /** 이 사회 제도를 끝내야 고를 수 있음(없으면 처음부터) */
  needs?: string;
}
export const GOVS: Gov[] = [
  { id: 'assembly', name: '국민 의회', icon: '🏛️', slots: ['경제', '외교', '경제', '외교', '자유'], eff: { influence: 0.25 }, text: '분쟁 지역 영향력 +25%', play: '평화·연합 승리' },
  { id: 'navy', name: '해군 통치', icon: '⚓', slots: ['군사', '군사', '경제', '군사', '자유'], eff: { build: { dom: '해', v: 0.2 } }, text: '군함·항모 모집 +20% 빠름', play: '바다 장악, 정복' },
  { id: 'merchant', name: '상업 연합', icon: '⚖️', slots: ['경제', '경제', '외교', '경제', '자유'], eff: { trade: 0.1, contracts: 1 }, text: '무역 값 10% 이득 · 정기 계약 +1칸', play: '자원 부자' },
  { id: 'sanctum', name: '성지 회의', icon: '🔷', slots: ['외교', '군사', '외교', '자유', '자유'], eff: { votes: 1, research: 0.1 }, text: '국제 회의 표 +1 · 연구 +10% · 갈륨 레이더 연구 2배 빨리', play: '성소와 유적 중심' },
  // 11-23 새 체제 4가지(사회 제도 연구로 열림)
  { id: 'republic', name: '대통령제', icon: '🗳️', slots: ['군사', '경제', '외교', '경제', '자유'], eff: { budget: 0.08, loyalty: 3 }, text: '나라 예산 +8% · 민심 +3', play: '고르게 키우기', needs: 's-press' },
  { id: 'junta', name: '군사 정부', icon: '🎖️', slots: ['군사', '군사', '군사', '경제', '자유'], eff: { power: { dom: 'all', v: 0.1 }, loyalty: -4 }, text: '모든 전투력 +10% · 민심 −4', play: '빠른 정복', needs: 's-reserve' },
  { id: 'technocracy', name: '기술 관료제', icon: '🔬', slots: ['경제', '경제', '군사', '외교', '자유'], eff: { research: 0.2 }, text: '연구 +20%', play: '연구 앞서기', needs: 's-school' },
  { id: 'federation', name: '연방제', icon: '🗺️', slots: ['경제', '외교', '외교', '군사', '자유'], eff: { growth: 0.2, district: 0.15 }, text: '도시 성장 +20% · 구역 짓는 시간 −15%', play: '도시 키우기', needs: 's-transport' },
];
export const govById = (id: GovId | null | undefined) => GOVS.find((g) => g.id === id) ?? GOVS.find((g) => g.id === 'assembly') ?? GOVS[0];
/**
 * 11-27 AI 나라 체제 효과(다른 나라 체제가 그림만이 아니게). 국민 의회(분쟁 지역 영향력)·성지 회의(회의 표)는 원래 계산에 들어 있음.
 * power 전투력 · overseas 바다 건너 공격 · defense 지킬 때 · budget 예산
 */
export const AI_GOV_EFF: Record<GovId, { power?: number; overseas?: number; defense?: number; budget?: number; text: string }> = {
  assembly: { text: '분쟁 지역 영향력 +25%' },
  navy: { overseas: 0.15, text: '바다 건너 공격 +15%' },
  merchant: { budget: 0.06, text: '예산 +6%' },
  sanctum: { text: '국제 회의 표 +1' },
  republic: { budget: 0.08, text: '예산 +8%' },
  junta: { power: 0.1, text: '전투력 +10%' },
  technocracy: { power: 0.04, budget: 0.03, text: '전투력 +4% · 예산 +3%' },
  federation: { defense: 0.08, text: '도시 지킬 때 +8%' },
};

/** 지도자 등급(0~10)마다 쓸 수 있는 카드 칸: 2칸에서 시작해 전설의 지도자 8칸 */
export const slotCount = (rank: number) => Math.min(8, 2 + Math.floor((rank * 6) / 10));
/** 정해진 5칸 뒤에 붙는 칸(6~8번째)은 자유 칸 */
export function govSlots(g: Gov, rank: number): SlotKind[] {
  const all: SlotKind[] = [...g.slots, '자유', '자유', '자유'];
  return all.slice(0, slotCount(rank));
}

export interface Card {
  id: string;
  kind: Exclude<SlotKind, '자유'>;
  name: string;
  icon: string;
  eff: Eff;
  text: string;
}
const C = (c: Card) => c;
/** 정책 카드 36장(군사 12 · 경제 12 · 외교 12). 처음 8장은 연구 없이 씀 */
export const CARDS: Card[] = [
  C({ id: '군-훈련', kind: '군사', name: '실전 훈련', icon: '🎯', eff: { mission: 0.04 }, text: '임무 성공률 +4%' }),
  C({ id: '군-보급', kind: '군사', name: '보급 우선', icon: '📦', eff: { build: { dom: '육', v: 0.15 } }, text: '육군 모집 −15%' }),
  C({ id: '군-징집', kind: '군사', name: '징집 확대', icon: '📝', eff: { power: { dom: '육', v: 0.1 }, loyalty: -3 }, text: '육군 전투력 +10% · 민심 −3' }),
  C({ id: '군-해병', kind: '군사', name: '해병 전통', icon: '⚓', eff: { build: { dom: '해', v: 0.15 } }, text: '해군 모집 −15%' }),
  C({ id: '군-조종', kind: '군사', name: '조종사 양성', icon: '✈️', eff: { build: { dom: '공', v: 0.15 } }, text: '공군 모집 −15%' }),
  C({ id: '군-방위', kind: '군사', name: '국토 방위', icon: '🛡️', eff: { power: { dom: 'all', v: 0.08 } }, text: '모든 전투력 +8%' }),
  C({ id: '군-동원', kind: '군사', name: '총동원', icon: '📣', eff: { build: { dom: 'all', v: 0.2 }, budget: -0.1 }, text: '모든 모집 −20% · 나라 예산 −10%' }),
  C({ id: '군-정예', kind: '군사', name: '정예 부대', icon: '🎖️', eff: { power: { dom: 'all', v: 0.15 }, build: { dom: 'all', v: -0.1 } }, text: '전투력 +15% · 모집 +10% 느림' }),
  C({ id: '경-세금', kind: '경제', name: '군수 세금', icon: '💰', eff: { budget: 0.08 }, text: '나라 예산 +8%' }),
  C({ id: '경-광산', kind: '경제', name: '광산 장려', icon: '⛏️', eff: { res: 0.1 }, text: '자원 +10%' }),
  C({ id: '경-개척', kind: '경제', name: '지방 개발', icon: '🌱', eff: { growth: 0.25 }, text: '도시 성장 +25%' }),
  C({ id: '경-도시', kind: '경제', name: '도시 정비', icon: '🏗️', eff: { district: 0.25 }, text: '구역 짓는 시간 −25%' }),
  C({ id: '경-상회', kind: '경제', name: '자유 항구', icon: '🚢', eff: { trade: 0.08 }, text: '무역 값 8% 이득' }),
  C({ id: '경-학자', kind: '경제', name: '학자 초빙', icon: '🎓', eff: { research: 0.15 }, text: '연구 +15%' }),
  C({ id: '경-복지', kind: '경제', name: '배급 확대', icon: '🍞', eff: { loyalty: 8, budget: -0.05 }, text: '민심 +8 · 나라 예산 −5%' }),
  C({ id: '경-연방', kind: '경제', name: '국가 투자', icon: '🏦', eff: { budget: 0.12, res: 0.1 }, text: '나라 예산 +12% · 자원 +10%' }),
  C({ id: '외-사절', kind: '외교', name: '상주 사절', icon: '🕊️', eff: { influence: 0.2 }, text: '분쟁 지역 영향력 +20%' }),
  C({ id: '외-친선', kind: '외교', name: '친선 방문', icon: '🤝', eff: { favor: 5 }, text: '모든 나라 호감 +5' }),
  C({ id: '외-정보', kind: '외교', name: '외교 정보망', icon: '🗝️', eff: { mission: 0.03, favor: -2 }, text: '임무 성공률 +3% · 호감 −2' }),
  C({ id: '외-불가침', kind: '외교', name: '국경 안정', icon: '🧱', eff: { loyalty: 4, favor: 3 }, text: '민심 +4 · 호감 +3' }),
  C({ id: '외-방위', kind: '외교', name: '동맹 의무', icon: '🛡️', eff: { favor: 4, power: { dom: 'all', v: 0.04 } }, text: '호감 +4 · 전투력 +4%' }),
  C({ id: '외-회의', kind: '외교', name: '회의 로비', icon: '🗳️', eff: { votes: 1 }, text: '국제 회의 표 +1' }),
  C({ id: '외-방송', kind: '외교', name: '국제 방송', icon: '📻', eff: { favor: 6, influence: 0.1 }, text: '호감 +6 · 분쟁 지역 영향력 +10%' }),
  C({ id: '외-연방', kind: '외교', name: '국제 우호', icon: '🌐', eff: { favor: 8, contracts: 1 }, text: '호감 +8 · 정기 계약 +1칸' }),
  // 11-23 새 카드 12장(군사 4 · 경제 4 · 외교 4), 새 연구로 열림
  C({ id: '군-첩보', kind: '군사', name: '첩보 작전', icon: '🕶️', eff: { mission: 0.05 }, text: '임무 성공률 +5%' }),
  C({ id: '군-예비', kind: '군사', name: '예비군 동원', icon: '🎒', eff: { build: { dom: '육', v: 0.12 }, power: { dom: '육', v: 0.04 } }, text: '육군 모집 −12% · 육군 전투력 +4%' }),
  C({ id: '군-보훈', kind: '군사', name: '보훈 우대', icon: '🎗️', eff: { loyalty: 4, power: { dom: 'all', v: 0.05 } }, text: '민심 +4 · 전투력 +5%' }),
  C({ id: '군-기동', kind: '군사', name: '신속 기동군', icon: '🚛', eff: { build: { dom: 'all', v: 0.1 }, power: { dom: '공', v: 0.05 } }, text: '모든 모집 −10% · 공군 전투력 +5%' }),
  C({ id: '경-조세', kind: '경제', name: '세제 개편', icon: '🧾', eff: { budget: 0.1, loyalty: -2 }, text: '나라 예산 +10% · 민심 −2' }),
  C({ id: '경-관세', kind: '경제', name: '보호 관세', icon: '🛃', eff: { trade: 0.06, budget: 0.04 }, text: '무역 값 6% 이득 · 나라 예산 +4%' }),
  C({ id: '경-채굴', kind: '경제', name: '광산 증산', icon: '⛏️', eff: { res: 0.15, loyalty: -2 }, text: '자원 +15% · 민심 −2' }),
  C({ id: '경-산업', kind: '경제', name: '산업 단지', icon: '🏗️', eff: { res: 0.08, district: 0.15 }, text: '자원 +8% · 구역 짓는 시간 −15%' }),
  C({ id: '외-문화', kind: '외교', name: '문화 교류', icon: '🎭', eff: { favor: 4, loyalty: 3 }, text: '호감 +4 · 민심 +3' }),
  C({ id: '외-동맹', kind: '외교', name: '동맹 강화', icon: '🤝', eff: { favor: 5, power: { dom: 'all', v: 0.03 } }, text: '호감 +5 · 전투력 +3%' }),
  C({ id: '외-원조', kind: '외교', name: '원조 확대', icon: '🎁', eff: { favor: 4, influence: 0.2, budget: -0.05 }, text: '호감 +4 · 분쟁 지역 영향력 +20% · 나라 예산 −5%' }),
  C({ id: '외-중재', kind: '외교', name: '분쟁 중재', icon: '⚖️', eff: { votes: 1, influence: 0.1 }, text: '국제 회의 표 +1 · 분쟁 지역 영향력 +10%' }),
];
// 처음부터 쓸 수 있는 8장
export const START_CARDS = ['군-훈련', '군-보급', '경-세금', '경-광산', '외-친선', '외-정보', '경-학자', '경-개척'];
// 나머지 '외-평화'처럼 연구 목록에만 있는 이름은 카드가 없으면 건너뜀
export const cardById = (id: string) => CARDS.find((c) => c.id === id);

/** 카드 바꾸기: 실제 하루 1번 무료, 그 밖엔 예산 */
export const CARD_SWAP_FREE_MS = 24 * 3600e3;
export const CARD_SWAP_COST = 3000;
/** 체제 바꾸기: 예산 + 하루 혼란(생산 −20%). 처음 고르는 것은 무료 */
export const GOV_CHANGE_COST = 20000;
export const GOV_CHAOS_MS = 24 * 3600e3;
export const GOV_CHAOS = 0.2;

// ── 연구 속도 ──
/** 기본 연구 점수: 실제 1시간에 1(= 연구 'hours'만큼 걸림) */
export const RESEARCH_BASE = 1;
export const RESEARCH_PER_POP = 0.015;
export const RESEARCH_PER_LAB = 0.12;
export const RESEARCH_PER_LAB_ADJ = 0.04;
export const RESEARCH_PER_SCIENCE_PACT = 0.1;

// ── 연구 비용(11-27 대장 승인: 루비만으로 너무 빨리 끝나서) ──
/** A. 시대별 연구 시간 배율: 뒤 시대일수록 오래 걸림 */
export const TECH_ERA_MULT: Record<number, number> = { 1: 1, 2: 1.25, 3: 1.75, 4: 2.25 };
/** B. 한 단계에 드는 나라 예산 = 이 값 × 연구 시간 × 시대 */
export const TECH_MONEY_K = 200;
/** B. 한 단계에 드는 자원(2가지 각각) = 이 값 × 연구 시간 × 시대 (1시대는 자원 없음) */
export const TECH_RES_K = 0.17;
/** B. 줄마다 내는 자원: 군사 = 강철·반도체, 사회 = 구리·리튬 */
export const TECH_RES = { mil: ['강철', '반도체'], soc: ['구리', '리튬'] } as const;
/** C. ⏩·⚡ 가속권 한 장이 넣는 연구 점수(연구 속도와 상관없이 고정) */
export const TECH_PTS_PER_BOOST = 2;
/** 시대가 바뀌면 모든 맞수 사이 긴장 + */
export const ERA_TENSION = 4;

// ── 외교: 호감 · 협정 · 불만 장부 ──

export type AgreeId = 'route' | 'science' | 'swap' | 'defense' | 'nonagg' | 'prio' | 'techx' | 'visa';
export interface Agree {
  id: AgreeId;
  name: string;
  icon: string;
  /** 상대 호감이 이만큼은 돼야 받아 줌 */
  favorNeed: number;
  /** 실제 시간 */
  hours: number;
  cost: number;
  text: string;
}
export const AGREES: Agree[] = [
  { id: 'route', name: '항로 개방', icon: '🧭', favorNeed: -10, hours: 24, cost: 1500, text: '그 나라와 무역 값 10% 이득 · 호감 +5' },
  { id: 'science', name: '연구 협력', icon: '🔬', favorNeed: 10, hours: 48, cost: 4000, text: '연구 속도 +10% · 호감 +5' },
  { id: 'swap', name: '자원 교환 계약', icon: '🔁', favorNeed: 0, hours: 48, cost: 2000, text: '그 나라가 만드는 자원 1가지를 시간당 1개 받고, 우리 가장 많은 자원 1개를 줌' },
  { id: 'defense', name: '방위 약속', icon: '🛡️', favorNeed: 30, hours: 72, cost: 6000, text: '그 나라와 긴장이 오르지 않고, 내 도시 방어 +5% · 호감 +10' },
  { id: 'nonagg', name: '불가침', icon: '🤝', favorNeed: 5, hours: 72, cost: 3000, text: '그 나라와 긴장이 오르지 않음 · 호감 +5' },
  // 11-28 국정 37 강화(호감·협정): 새 협정 2가지
  { id: 'prio', name: '자원 우선 구매권', icon: '📦', favorNeed: 15, hours: 48, cost: 3500, text: '그 나라에서 살 때 6% 싸고, 하루 거래 한도 +50% · 호감 +3' },
  { id: 'visa', name: '비자 면제', icon: '🛂', favorNeed: 0, hours: 72, cost: 2500, text: '관광 수입 +6%(나라마다) · 그 나라에 우리 문화 +10% · 호감 +3' },
  { id: 'techx', name: '기술 교류', icon: '🧪', favorNeed: 20, hours: 48, cost: 4500, text: '연구 점수 +(연구 협력의 절반) · 그 나라 연구도 빨라짐 · 호감 +4' },
];
export const agreeById = (id: AgreeId) => AGREES.find((a) => a.id === id)!;
export const AGREE_FAVOR: Record<AgreeId, number> = { route: 5, science: 5, swap: 3, defense: 10, nonagg: 5, prio: 3, techx: 4, visa: 3 };
/** 협정·체제 같은 계산 이유 외에, 쌓이는 이유(대화·불만)는 시간이 지나면 줄어듦: 실제 하루에 이 비율 */
export const FAVOR_DECAY_PER_DAY = 0.2;
export const GRIEVANCE_DECAY_PER_DAY = 0.1;
/** 불만 장부 */
export const GRIEVANCE = {
  surprise: 40, // 기습 침공(호감이 좋았거나 협정·약속 중이던 나라에 선전포고)
  brokeAgree: 30, // 협정 깨기
  war: 15, // 그냥 선전포고
  capture: 15, // 도시 빼앗기
  holy: 25, // 성지 더럽히기(회의 결의를 어기고 전쟁)
  neighbor: 0.4, // 같은 지역·같은 협약 이웃은 이 비율만큼 같이 미워함
};

// ── 분쟁 지역 영향력 ──
export const ENVOY_COST = 1500;
export const ENVOY_INFLUENCE = 10;
export const ENVOY_COOLDOWN_MS = 4 * 3600e3;
/** 1등이면서 이 영향력 이상이어야 섬 혜택 */
export const ISLAND_LEAD_MIN = 30;
export const ISLAND_RES_PER_HOUR = 2;
/** 섬 부탁: 자원을 보내면 영향력 + */
export const ISLAND_REQUEST_INFLUENCE = 15;
export const ISLAND_REQUEST_MS = 12 * 3600e3;
/** AI 나라이 판단마다 섬에 쌓는 영향력(쏠리는 섬 2~3곳) */
export const AI_INFLUENCE_PER_TICK = 0.35;
export const INFLUENCE_MAX = 200;

// ── 국제 회의(고대 성지, 실제 하루마다) ──
export const COUNCIL_EVERY_MS = 24 * 3600e3;
export const COUNCIL_ANSWER_MS = 6 * 3600e3;
export const COUNCIL_EFFECT_MS = 24 * 3600e3;
export type AgendaId = 'embargo' | 'sanction' | 'truce' | 'science' | 'islands';
export interface Agenda {
  id: AgendaId;
  name: string;
  icon: string;
  /** 통과하면(모든 나라에) */
  yes: Eff;
  text: string;
  /** 대상 나라이 있는 안건 */
  target?: boolean;
}
export const AGENDAS: Agenda[] = [
  { id: 'embargo', name: '갈륨 수출 금지', icon: '⛔', yes: { trade: -0.15 }, text: '하루 동안 모든 무역 값 15% 손해' },
  { id: 'sanction', name: '항로 제재', icon: '🚫', yes: {}, text: '대상 나라의 나라 예산 −20%, 하루 동안', target: true },
  { id: 'truce', name: '성지 휴전', icon: '☮️', yes: {}, text: '모든 나라 사이 긴장 −15 · 하루 동안 전쟁 선포 시 불만 큼' },
  { id: 'science', name: '연구 공유', icon: '📚', yes: { research: 0.15 }, text: '하루 동안 연구 +15%' },
  { id: 'islands', name: '분쟁 지역 보호', icon: '🏝️', yes: { influence: 0.5 }, text: '하루 동안 분쟁 지역 영향력 +50%' },
];
export const agendaById = (id: AgendaId) => AGENDAS.find((a) => a.id === id)!;

// ── 내정: 도시 구역 · 민심 · 인구 ──

export type DistrictId = 'industry' | 'harbor' | 'airfield' | 'lab' | 'housing' | MilLabId;
/** 군사 연구시설(11/24 대장 요청 "지을 수 있는 군사 연구시설 확충") */
export type MilLabId = 'adl' | 'shipyard' | 'arms' | 'missile' | 'drone' | 'cyber' | 'aero';
export interface District {
  id: DistrictId;
  name: string;
  icon: string;
  /** 지을 수 있는 칸 */
  where: '아무 칸' | '바닷가 칸' | '평지 칸' | '평지·바닷가 칸';
  /** 연구 없이 처음부터 지을 수 있음(항만·비행장, 11-24 대장 요청) */
  free?: boolean;
  /** 이 연구를 끝내야 지음(군사 연구시설) */
  tech?: string;
  /** 바다에 닿은 도시만 */
  coastal?: boolean;
  /** 군사 연구시설: 효과(나라 전체, 도시 효과 상한 안에서) */
  mil?: { research?: number; army?: number; navy?: number; air?: number; power?: number; powerDom?: '육' | '해' | '공'; mission?: number; res?: number };
  cost: number;
  res: Partial<Record<Res, number>>;
  hours: number;
  text: string;
  adj: string;
}
export const DISTRICTS: District[] = [
  { id: 'industry', name: '공업 구역', icon: '🏭', where: '아무 칸', cost: 3000, res: { 강철: 5 }, hours: 2, text: '나라 예산 +4% · 자원 +4%', adj: '옆 공업 구역·산 칸마다 +1%씩 더' },
  { id: 'harbor', name: '항만', icon: '⚓', where: '바닷가 칸', free: true, cost: 4000, res: { 강철: 8 }, hours: 3, text: '군함을 만들 수 있음 · 해군 모집 −5%', adj: '옆 바다 칸마다 해군 모집 −2%씩 더' },
  { id: 'airfield', name: '비행장', icon: '🛫', where: '평지·바닷가 칸', free: true, cost: 4000, res: { 강철: 4, 석유: 4 }, hours: 3, text: '전투기·헬기·폭격기를 만들 수 있음 · 공군 모집 −5%', adj: '옆 공업 구역마다 공군 모집 −2%씩 더' },
  { id: 'lab', name: '연구소', icon: '🔬', where: '아무 칸', cost: 3500, res: { 반도체: 3 }, hours: 3, text: '연구 +12%', adj: '옆 산·유적 칸마다 연구 +4%씩 더' },
  { id: 'housing', name: '주거 구역', icon: '🏘️', where: '아무 칸', cost: 2500, res: { 강철: 3 }, hours: 2, text: '그 도시 민심 +10 · 인구 상한 +2 · 성장 빨라짐', adj: '옆 주거·바다 칸마다 민심 +2씩 더' },
  // ── 군사 연구시설 7종(도시마다 1개씩, 옆 칸 보너스는 연구소·공업 구역) ──
  { id: 'adl', name: '국방 연구소', icon: '🧪', where: '아무 칸', free: true, cost: 4500, res: { 반도체: 2, 강철: 3 }, hours: 3, text: '연구 +0.08/시간 · 전투력 +1%', adj: '옆 연구소·국방 연구소마다 연구 +0.03씩 더', mil: { research: 0.08, power: 0.01 } },
  { id: 'shipyard', name: '군 조선소', icon: '🛳️', where: '바닷가 칸', free: true, coastal: true, cost: 5000, res: { 강철: 10 }, hours: 4, text: '해군 모집 +8% · 해군 전투력 +2%', adj: '옆 바다·공업 구역마다 해군 모집 +2%씩 더', mil: { navy: 0.08, power: 0.02, powerDom: '해' } },
  { id: 'arms', name: '방산 공장', icon: '⚙️', where: '평지 칸', free: true, cost: 4000, res: { 강철: 8 }, hours: 3, text: '육군 모집 +8% · 자원 +2%', adj: '옆 공업 구역·방산 공장마다 육군 모집 +2%씩 더', mil: { army: 0.08, res: 0.02 } },
  { id: 'missile', name: '미사일 시험장', icon: '🚀', where: '평지·바닷가 칸', tech: 'm-guided', cost: 6000, res: { 강철: 6, 희토류: 2 }, hours: 4, text: '육군·공군 전투력 +3%', adj: '옆 국방 연구소·바다마다 전투력 +0.5%씩 더', mil: { power: 0.03 } },
  { id: 'drone', name: '무인기 연구소', icon: '🛸', where: '아무 칸', tech: 'm-drone', cost: 4500, res: { 반도체: 3 }, hours: 3, text: '육군 전투력 +3% · 육군 모집 +3% · 연구 +0.03', adj: '옆 연구소·공업 구역마다 연구 +0.02씩 더', mil: { power: 0.03, powerDom: '육', army: 0.03, research: 0.03 } },
  { id: 'cyber', name: '사이버전 센터', icon: '💻', where: '아무 칸', tech: 'm-cyber', cost: 5000, res: { 반도체: 4 }, hours: 3, text: '임무 성공 +3% · 연구 +0.03', adj: '옆 연구소·국방 연구소마다 임무 +1%씩 더', mil: { mission: 0.03, research: 0.03 } },
  { id: 'aero', name: '항공우주 연구소', icon: '🛰️', where: '평지·바닷가 칸', tech: 'm-jet', cost: 6500, res: { 알루미늄: 4, 반도체: 3 }, hours: 4, text: '공군 전투력 +4% · 공군 모집 +4% · 연구 +0.04', adj: '옆 비행장·연구소마다 공군 모집 +2%씩 더', mil: { power: 0.04, powerDom: '공', air: 0.04, research: 0.04 } },
];
/** 군사 연구시설 7종 */
export const MIL_LABS = DISTRICTS.filter((d) => d.mil);
export const districtById = (id: DistrictId) => DISTRICTS.find((d) => d.id === id)!;
/** 도시 크기(169·271·397칸, 11/24 4.5배)에 따른 구역 수 3·5·7 */
export const DISTRICT_SLOTS: Record<2 | 3 | 4, number> = { 2: 3, 3: 5, 4: 7 };
/** 연구로 칸을 더: 헌법 개정 +1 */
export const POP_MAX = 10;
/** 인구 1 → 2에 필요한 성장 점수(인구 × 이 값) */
export const GROW_NEED_PER_POP = 6;
/** 인구 1마다 나라 예산 +2%(평균) */
export const POP_BUDGET = 0.02;
/** 민심이 이보다 낮으면 생산이 줄어듦(아주 낮아도 도시는 잃지 않음, 11-22 결정) */
export const LOYALTY_OK = 50;
/** 민심이 목표로 다가가는 속도(실제 1시간에 차이의 이 비율) */
export const LOYALTY_SPEED = 0.15;
