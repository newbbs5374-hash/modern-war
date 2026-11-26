// 대통령실 참모진 · 국무총리 · 기관장(11-24 대장 요청 "청와대 참모진 직급 세분화, 대통령이 임명할 수 있는 직책 반영").
// 실제 대한민국 대통령실 구성(비서실·정책실·국가안보실 3실장 + 수석비서관 + 안보실 차장 + 경호처)과
// 대통령이 임명하는 국무총리·권력기관장·독립기관장을 참고했어요. 계산은 src/game/cabinet.ts(postPower·postEff)
// 대통령실 참모는 실제로도 국회 인사청문회를 거치지 않아요 → 바로 임명.
import type { MinistryId, SpecId } from './cabinet';
import type { AnyStat } from './stats2';

export type OfficeId = 'sec' | 'pol' | 'nsc' | 'pss' | 'gov' | 'agency';
export interface Office {
  id: OfficeId;
  icon: string;
  name: string;
  /** 실장(이 실의 우두머리). 실장 힘이 밑의 참모 힘을 올려 줌 */
  head: PostId | null;
  text: string;
}
export const OFFICES: Office[] = [
  { id: 'sec', icon: '🏢', name: '비서실', head: 'chief', text: '대통령의 하루와 정치·여론·인사를 챙기는 곳이에요. 비서실장이 유능하면 밑의 수석들이 모두 힘을 더 내요.' },
  { id: 'pol', icon: '📑', name: '정책실', head: 'policy', text: '경제·사회·과학 정책을 짜고 부처를 조율해요. 정책실장이 부처 업무를 빠르게 만들어요.' },
  { id: 'nsc', icon: '🛡️', name: '국가안보실', head: 'nsa', text: '외교·국방·안보 위기를 맡아요. 1차장은 외교, 2차장은 국방을 챙겨요.' },
  { id: 'pss', icon: '🕶️', name: '대통령경호처', head: null, text: '대통령과 가족의 안전을 지켜요. 경호가 단단하면 정적의 방해 공작이 통하지 않아요.' },
  { id: 'agency', icon: '🏢', name: '청장(부 소속)', head: null, text: '부 아래에 달린 청 18곳의 청장이에요. 실제처럼 국방부 → 병무청·방위사업청, 행정안전부 → 경찰청·소방청처럼 부마다 딸려 있어요. 부 장관이 유능하면 그 부의 청장도 힘을 더 내요.' },
  { id: 'gov', icon: '🏛️', name: '국무총리·기관장', head: null, text: '대통령이 임명하는 국무총리와 권력기관장·독립기관장이에요. 실제로는 국회 동의나 청문회가 필요하지만 시험판에서는 바로 임명해요.' },
];

/** 효과 종류(p = 그 자리의 힘, 보통 사람 ≈ 1, 특화 맞는 유능한 사람 ≈ 2) */
export type PostEff =
  | 'trust' // 의회 신뢰도 목표 +
  | 'approval' // 지지도 목표 +
  | 'sec' // 안보 점수 +
  | 'diplo' // 외교 점수 +
  | 'soc' // 사회 점수 +
  | 'econ' // 경제 점수 +
  | 'favor' // 모든 나라 호감 +
  | 'troop' // 병력 보충 배율 +
  | 'build' // 모집 속도 배율 +
  | 'budget' // 나라 예산 배율 +
  | 'growth' // 인구 성장 +
  | 'research' // 연구 속도 +
  | 'loyalty' // 도시 민심 +
  | 'speech' // 연설 효과 +
  | 'taxSoft' // 세금 불만 줄이기
  | 'recruit' // 영입비 할인
  | 'taskTime' // 부처 업무 시간 줄이기
  | 'minPower' // 모든 장관 힘 +
  | 'cabLoyal' // 내 사람 충성 목표 +
  | 'scandal' // 스캔들 줄이기
  | 'mission'; // 임무 성공 +

export const EFF_INFO: Record<PostEff, { name: string; pct: boolean }> = {
  trust: { name: '신뢰도', pct: false },
  approval: { name: '지지도', pct: false },
  sec: { name: '안보 점수', pct: false },
  diplo: { name: '외교 점수', pct: false },
  soc: { name: '사회 점수', pct: false },
  econ: { name: '경제 점수', pct: false },
  favor: { name: '모든 나라 호감', pct: false },
  troop: { name: '병력 보충', pct: true },
  build: { name: '부대 모집 속도', pct: true },
  budget: { name: '나라 예산', pct: true },
  growth: { name: '인구 성장', pct: true },
  research: { name: '연구 속도', pct: true },
  loyalty: { name: '도시 민심', pct: false },
  speech: { name: '연설 효과', pct: true },
  taxSoft: { name: '세금 불만 줄임', pct: true },
  recruit: { name: '영입비 할인', pct: true },
  taskTime: { name: '부처 업무 시간 단축', pct: true },
  minPower: { name: '모든 장관 힘', pct: true },
  cabLoyal: { name: '내 사람 충성', pct: false },
  scandal: { name: '스캔들 줄임', pct: true },
  mission: { name: '임무 성공', pct: true },
};
/** 효과마다 최대치(자리 여럿이 겹쳐도) */
export const EFF_CAP: Partial<Record<PostEff, number>> = { recruit: 0.4, taskTime: 0.35, scandal: 0.8, taxSoft: 0.4, minPower: 0.3 };

export type PostId =
  | 'chief' | 'polit' | 'civil' | 'press' | 'society' | 'hr' | 'spokes'
  | 'policy' | 'econ' | 'social' | 'sci'
  | 'nsa' | 'nsa1' | 'nsa2'
  | 'guard'
  | 'pm' | 'pros' | 'police' | 'tax' | 'audit' | 'bok' | 'dapa'
  // 11-24 대장 요청 5번: 청 18곳(경찰·국세·방위사업 3곳은 원래 있던 자리)
  | 'mma' | 'nfa' | 'kcs' | 'pps' | 'kcg' | 'kasa' | 'kfs' | 'rda' | 'kma' | 'kipo' | 'kdca' | 'oka' | 'sma' | 'macc' | 'kh';

export interface Post {
  id: PostId;
  office: OfficeId;
  icon: string;
  name: string;
  /** 급(장관급·차관급 등, 보여 주기용) */
  level: string;
  role: string;
  stats: AnyStat[];
  spec: SpecId[];
  eff: Partial<Record<PostEff, number>>;
  /** 청이면 위의 부 */
  parent?: MinistryId;
}

export const POSTS: Post[] = [
  // ── 비서실 ──
  { id: 'chief', office: 'sec', icon: '🗝️', name: '비서실장', level: '장관급', role: '대통령실 살림·일정·참모 조율', stats: ['정치', '행정'], spec: ['행정통'], eff: { cabLoyal: 3, trust: 0.5 } },
  { id: 'polit', office: 'sec', icon: '🗳️', name: '정무수석', level: '차관급', role: '국회·정당과 소통', stats: ['정치', '언변'], spec: ['행정통', '홍보통'], eff: { trust: 2 } },
  { id: 'civil', office: 'sec', icon: '⚖️', name: '민정수석', level: '차관급', role: '공직 감찰·민심 동향', stats: ['법률', '정보'], spec: ['행정통', '정보통'], eff: { scandal: 0.3, trust: 0.5 } },
  { id: 'press', office: 'sec', icon: '📣', name: '홍보소통수석', level: '차관급', role: '언론·국민 소통', stats: ['언변', '매력'], spec: ['홍보통'], eff: { approval: 1.5, speech: 0.08 } },
  { id: 'society', office: 'sec', icon: '🤲', name: '시민사회수석', level: '차관급', role: '시민단체·종교계·노동계', stats: ['매력', '청렴'], spec: ['복지통', '행정통'], eff: { loyalty: 1, approval: 0.5 } },
  { id: 'hr', office: 'sec', icon: '🗂️', name: '인사수석', level: '차관급', role: '고위 공직자 인사 검증', stats: ['행정', '정보'], spec: ['행정통', '정보통'], eff: { recruit: 0.08 } },
  { id: 'spokes', office: 'sec', icon: '🎙️', name: '대변인', level: '1급', role: '대통령의 말 전하기·브리핑', stats: ['언변', '매력'], spec: ['홍보통'], eff: { approval: 1 } },
  // ── 정책실 ──
  { id: 'policy', office: 'pol', icon: '📑', name: '정책실장', level: '장관급', role: '국정 과제·부처 조율', stats: ['행정', '경제'], spec: ['경제통', '행정통'], eff: { taskTime: 0.06, econ: 1, soc: 1 } },
  { id: 'econ', office: 'pol', icon: '📈', name: '경제수석', level: '차관급', role: '경제·재정·산업 정책', stats: ['경제', '행정'], spec: ['경제통'], eff: { budget: 0.02, econ: 1.5 } },
  { id: 'social', office: 'pol', icon: '🏥', name: '사회수석', level: '차관급', role: '복지·교육·고용', stats: ['행정', '매력'], spec: ['복지통'], eff: { growth: 0.04, soc: 1.5 } },
  { id: 'sci', office: 'pol', icon: '🤖', name: '과학기술수석', level: '차관급', role: 'AI·과학기술·국방과학', stats: ['과학', '정보'], spec: ['과학자'], eff: { research: 0.05 } },
  // ── 국가안보실 ──
  { id: 'nsa', office: 'nsc', icon: '🛡️', name: '국가안보실장', level: '장관급', role: '외교·안보 총괄·위기 대응', stats: ['전술', '외교'], spec: ['외교통', '정보통', '육군통'], eff: { sec: 2, diplo: 1 } },
  { id: 'nsa1', office: 'nsc', icon: '🌐', name: '안보실 1차장', level: '차관급', role: '외교·통일·정상외교', stats: ['외교', '언변'], spec: ['외교통'], eff: { favor: 2, diplo: 1 } },
  { id: 'nsa2', office: 'nsc', icon: '🎖️', name: '안보실 2차장', level: '차관급', role: '국방·군사 대비', stats: ['지휘', '전술'], spec: ['육군통', '해군통', '공군통'], eff: { troop: 0.02, sec: 1 } },
  // ── 경호처 ──
  { id: 'guard', office: 'pss', icon: '🕶️', name: '경호처장', level: '차관급', role: '대통령 경호·정적 공작 막기', stats: ['은밀', '체력'], spec: ['정보통', '육군통'], eff: { sec: 1, mission: 0.02 } },
  // ── 국무총리·기관장 ──
  { id: 'pm', office: 'gov', icon: '🏛️', name: '국무총리', level: '총리', role: '내각 총괄(국회 동의 필요)', stats: ['행정', '정치'], spec: ['행정통', '경제통'], eff: { minPower: 0.06, trust: 0.5 } },
  { id: 'pros', office: 'gov', icon: '🔍', name: '검찰총장', level: '장관급', role: '수사·기소(청문회)', stats: ['법률', '정보'], spec: ['행정통', '정보통'], eff: { scandal: 0.15, soc: 1 } },
  { id: 'police', office: 'agency', parent: 'mois', icon: '🚓', name: '경찰청장', level: '차관급', role: '치안 유지(청문회)', stats: ['통솔', '행정'], spec: ['행정통'], eff: { loyalty: 1.5 } },
  { id: 'tax', office: 'agency', parent: 'mof', icon: '🧾', name: '국세청장', level: '차관급', role: '세금 걷기(청문회)', stats: ['경제', '법률'], spec: ['경제통'], eff: { budget: 0.02, taxSoft: 0.06 } },
  { id: 'audit', office: 'gov', icon: '📋', name: '감사원장', level: '장관급', role: '나랏돈·공무원 감사(국회 동의)', stats: ['법률', '청렴'], spec: ['행정통', '경제통'], eff: { trust: 1, scandal: 0.1 } },
  { id: 'bok', office: 'gov', icon: '🏦', name: '한국은행 총재', level: '장관급', role: '돈의 가치·금리(청문회)', stats: ['경제', '과학'], spec: ['경제통'], eff: { econ: 2, taxSoft: 0.05 } },
  { id: 'dapa', office: 'agency', parent: 'mnd', icon: '🏗️', name: '방위사업청장', level: '차관급', role: '무기 사 오기·만들기', stats: ['군수', '과학'], spec: ['군수통', '과학자'], eff: { build: 0.03 } },
  // ── 청(부 소속) ──
  { id: 'mma', office: 'agency', parent: 'mnd', icon: '🪪', name: '병무청장', level: '차관급', role: '징병 검사·입영', stats: ['행정', '통솔'], spec: ['행정통', '육군통'], eff: { troop: 0.02 } },
  { id: 'nfa', office: 'agency', parent: 'mois', icon: '🚒', name: '소방청장', level: '차관급', role: '불·재난 구조', stats: ['통솔', '체력'], spec: ['행정통'], eff: { soc: 1, loyalty: 0.5 } },
  { id: 'kcs', office: 'agency', parent: 'mof', icon: '🛃', name: '관세청장', level: '차관급', role: '세관·밀수 단속', stats: ['법률', '경제'], spec: ['경제통'], eff: { budget: 0.01, econ: 0.5 } },
  { id: 'pps', office: 'agency', parent: 'mof', icon: '📦', name: '조달청장', level: '차관급', role: '나라 물건 사기·비축', stats: ['군수', '행정'], spec: ['군수통', '경제통'], eff: { build: 0.02 } },
  { id: 'kcg', office: 'agency', parent: 'mofs', icon: '🚤', name: '해양경찰청장', level: '차관급', role: '바다 치안·구조', stats: ['통솔', '지휘'], spec: ['해군통'], eff: { sec: 1 } },
  { id: 'kasa', office: 'agency', parent: 'msit', icon: '🛰️', name: '우주항공청장', level: '차관급', role: '로켓·위성·항공', stats: ['과학', '행정'], spec: ['과학자', '공군통'], eff: { research: 0.03 } },
  { id: 'kfs', office: 'agency', parent: 'mafra', icon: '🌲', name: '산림청장', level: '차관급', role: '숲·산불·정원', stats: ['행정', '청렴'], spec: ['행정통', '복지통'], eff: { loyalty: 0.8 } },
  { id: 'rda', office: 'agency', parent: 'mafra', icon: '🧑‍🌾', name: '농촌진흥청장', level: '차관급', role: '농업 기술 연구', stats: ['과학', '경제'], spec: ['과학자'], eff: { growth: 0.03 } },
  { id: 'kma', office: 'agency', parent: 'mcee', icon: '🌦️', name: '기상청장', level: '차관급', role: '날씨 예보·작전 기상', stats: ['과학', '정보'], spec: ['과학자', '공군통'], eff: { mission: 0.015 } },
  { id: 'kipo', office: 'agency', parent: 'moti', icon: '📑', name: '특허청장', level: '차관급', role: '특허·기술 보호', stats: ['과학', '법률'], spec: ['과학자', '경제통'], eff: { research: 0.02, econ: 0.5 } },
  { id: 'kdca', office: 'agency', parent: 'mohw', icon: '🦠', name: '질병관리청장', level: '차관급', role: '감염병 막기', stats: ['과학', '행정'], spec: ['복지통', '과학자'], eff: { growth: 0.03, approval: 0.5 } },
  { id: 'oka', office: 'agency', parent: 'mofa', icon: '🧳', name: '재외동포청장', level: '차관급', role: '해외 동포 지원', stats: ['외교', '매력'], spec: ['외교통'], eff: { favor: 1.5 } },
  { id: 'sma', office: 'agency', parent: 'molit', icon: '🏗️', name: '새만금개발청장', level: '차관급', role: '새만금 간척지 개발', stats: ['경제', '행정'], spec: ['경제통', '행정통'], eff: { econ: 1 } },
  { id: 'macc', office: 'agency', parent: 'molit', icon: '🏙️', name: '행정중심복합도시건설청장', level: '차관급', role: '세종 행정도시 짓기', stats: ['행정', '경제'], spec: ['행정통'], eff: { taskTime: 0.03 } },
  { id: 'kh', office: 'agency', parent: 'mcst', icon: '🏯', name: '국가유산청장', level: '차관급', role: '문화유산 지키기', stats: ['과학', '매력'], spec: ['홍보통', '과학자'], eff: { approval: 0.5, speech: 0.03 } },
];
export const postById = (id: PostId) => POSTS.find((p) => p.id === id)!;
export const postsOf = (office: OfficeId) => POSTS.filter((p) => p.office === office);
/** 부 아래의 청장 자리 */
export const agenciesOf = (min: MinistryId) => POSTS.filter((p) => p.parent === min);
/** 실장이 밑의 참모 힘에 보태는 비율(실장 힘 1당) */
export const HEAD_BOOST = 0.12;
/** 경호처장 힘이 이만큼이면 정적 방해 공작을 막음 */
export const GUARD_COUNTER_AT = 1.3;

/** 효과 한 줄 글(p = 힘) */
export function effLine(eff: Partial<Record<PostEff, number>>, p = 1): string {
  return (Object.entries(eff) as Array<[PostEff, number]>)
    .map(([k, v]) => {
      const x = v * p;
      const info = EFF_INFO[k];
      return `${info.name} +${info.pct ? `${Math.round(x * 1000) / 10}%` : Math.round(x * 10) / 10}`;
    })
    .join(' · ');
}
