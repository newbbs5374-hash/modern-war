// 시험용 숫자를 한곳에 모아 둔다. 숫자 맞추기는 여기만 고치면 된다.

/** 실제 1시간 = 게임 하루 */
export const REAL_MS_PER_GAME_DAY = 60 * 60 * 1000;

/** 받지 않고 쌓아 둘 수 있는 봉급 한도: 실제 12시간치 */
export const PENDING_CAP_HOURS = 12;

/** 게임 달력의 첫날(가상의 근미래) */
export const GAME_START_DATE = { year: 2031, month: 3, day: 1 };

/** 나라 금고: 시작 나라 예산 지수 × 이 값 = 하루 나라 예산 */
export const BUDGET_PER_DAY_PER_POINT = 10;
/** 나라 시작 금고 = 나라 예산 지수 × 이 값 */
export const START_TREASURY_PER_POINT = 200;

/** 하루 모병 = 군사력 지수 × 이 값(명) */
export const TROOPS_PER_DAY_PER_POINT = 40;
/** 시작 병력 = 군사력 지수 × 이 값(명) */
export const START_TROOPS_PER_POINT = 5000;

// ── 2단계: 세계 움직이기 ──

/** AI가 판단하는 간격: 게임 6시간(= 실제 15분) */
export const AI_TICK_MS = 15 * 60 * 1000;

/** 긴장도가 이만큼 차면 휴전이 깨지거나 선전포고 */
export const TENSION_MAX = 100;
/** 한 번 판단할 때 오르는 긴장도(휴전 / 중립) */
export const TENSION_TRUCE = 0.7;
/** 새 세계관: 평화로 시작해 맞수끼리 자원·항로 다툼으로 긴장이 쌓임(첫 전쟁은 보통 2~4주 뒤) */
export const TENSION_NEUTRAL = 0.45;
/** 신앙이 부딪히는 사이(빛의 언약 ↔ 성검 교단)에 더 오름 */
export const TENSION_FAITH = 0.2;
/** 맞수가 아닌 사이의 긴장도: 공격적인 지도자일수록, 같은 대륙일수록 오름 */
export const TENSION_OTHER_LEADER = 0.04;
export const TENSION_OTHER_NEIGHBOR = 0.02;
/** 맞수가 아닌 휴전 사이는 긴장이 풀리고, 0이 되면 중립으로 */
export const TRUCE_COOLDOWN = 0.12;
/** 병력 자연 감소(하루에). 모병과 맞물려 평소 병력이 시작 병력 근처에서 머묾 */
export const TROOP_ATTRITION_PER_DAY = 0.008;
/** 같은 묶음끼리는 긴장도가 내려감 */
export const TENSION_DECAY = 0.15;
/** 판단마다 신앙 사건이 날 확률과 올리는 긴장도 */
export const FAITH_EVENT_CHANCE = 0.012;
export const FAITH_EVENT_TENSION = 30;

/** 전쟁 중 휴전 확률(판단마다) = 기본 × 지도자 평화 성향 × (1 + 피로도/WEARINESS_SCALE) */
export const TRUCE_BASE = 0.0015;
export const WEARINESS_SCALE = 60;
/** 휴전하면 긴장도가 여기서 다시 시작 */
export const TRUCE_START_TENSION = 20;
/** 전쟁이 나면 연합국이 끌려 들어올 확률 */
export const ALLY_JOIN_CHANCE = 0.6;
/** 11-27: 내 나라는 연합국 전쟁에 저절로 덜 끌려감(대신 연합국이 '도움 요청'을 보내 와 내가 고름, hegemony.ts) */
export const ALLY_JOIN_ME = 0.25;
/** 11-27: 내 나라가 이미 이만큼 전쟁 중이면, AI 연합국이 끌려 들어와 적으로 붙거나 자원 전쟁·패권 전쟁으로 새로 걸어오지 않음(한꺼번에 몰려와 판이 끝나지 않게) */
export const ME_MAX_FRONTS = 3;

/** 전쟁 상대마다 판단 한 번에 침공할 확률(× 지도자 공격성) */
export const INVADE_CHANCE = 0.04;
/** 플레이어 나라를 더 노리는 배율(+50%) */
export const PLAYER_TARGET_BONUS = 1.5;
/** 침공 한 번에 보내는 병력 비율 / 지키는 병력 비율 */
export const ATTACK_COMMIT = 0.08;
export const DEFEND_COMMIT = 0.08;
/** 수비 이점(공격 힘이 수비 힘 × 이 값을 넘어야 점령) */
export const CAPTURE_MARGIN = 1.0;
export const CAPITAL_DEFENSE = 1.4;
/** 자기 땅을 지킬 때 / 마지막 도시를 지킬 때(최후 저항) */
export const HOMELAND_DEFENSE = 1.3;
export const LAST_STAND_DEFENSE = 2;
/** 내 나라 도시 방어 보정(장교가 아직 직접 지킬 수 없는 동안, 장군이 자동 방어) */
export const PLAYER_HOME_DEFENSE = 1.3;
/** 연합국이 함께 지켜 주는 비율(연합국 수비 병력의 몇 %) */
export const ALLY_DEFEND_SHARE = 0.3;
/** 도시를 반 넘게 잃은 나라는 휴전을 훨씬 원함 */
export const LOSING_PEACE_MULT = 4;
/** 바다 건너 침공 힘 배율(미국은 전력 투사로 예외) */
export const OVERSEAS_PENALTY = 0.75;
/** 침공 비용 = 보내는 병력 × 이 값(나라 예산) */
export const ATTACK_COST_PER_TROOP = 0.02;
/** 도시 방어도: 공격이 이기면 깎이고 0이 되면 점령. 판단마다 조금씩 회복 */
export const CITY_DEFENSE_MAX = 100;
export const CITY_DEFENSE_REGEN = 0.6;
/** 이긴 공격 한 번에 깎는 방어도(× 힘 차이, 최대 2배) */
export const SIEGE_DAMAGE = 14;
/** 점령 직후 방어도 */
export const CAPTURED_DEFENSE = 35;
/** 바다 건너 침공은 덜 자주 */
export const OVERSEAS_ATTACK_RATE = 0.35;
/** 점령지 반란: 판단마다 원래 주인에게 돌아갈 확률(신앙이 다르면 × 1.5). 망한 나라도 반란으로 되살아남 */
export const REBEL_CHANCE = 0.002; // 11-27 밸런스: 0.004 → 0.002(되찾기 반복 줄이기)
export const REBEL_FAITH_MULT = 1.5;
/** 반란으로 되살아난 나라의 최소 병력 */
export const REVIVE_TROOPS = 30000;
/** 미국(전력 투사)의 바다 건너 침공 힘 배율 */
export const US_OVERSEAS = 0.9;
/** 점령한 남의 도시는 민심이 낮아 수입이 절반 */
export const OCCUPIED_INCOME = 0.5;
/** 편입 '민정' 단계 도시 수입(11-25) */
export const CIVIL_INCOME = 0.75;
/** 편입 '민정' 단계 도시 반란 배율 */
export const CIVIL_REBEL = 0.5;
/** 꼭두각시 정부(11-26): 세금의 30%를 공물로 받음(자원·생산은 못 씀, 반란 없음) */
export const PUPPET_INCOME = 0.3;

/** 전령에 남기는 소식 수 */
export const EVENT_LOG_MAX = 150;

/** 11-25 대장 요청: 시험하는 동안 훈련 일정 제한 없음(훈련을 몇 번이든 바로 시작). 다시 켜려면 false */
/** 시험판 전용. skip24 = 분쟁 사다리 "⏩ 24시간 뒤로" 버튼(본 서비스에선 false) */
export const TEST_MODE = { freeTraining: true, skip24: true };

// ── 11-26 난이도 올리기(대장 요청) ──

/** AI 나라 힘 배율(예산·모병·시작 금고·병력). 미국 > 중국 > 러시아 > 나머지.
 *  11-27 대장 요청 "AI는 자원도 병력도 많아 플레이어보다 훨씬 강하게": 1.8/1.7/1.4/1.25 → 2.3/2.1/1.75/1.5, 한국도 AI면 똑같이 */
export const AI_STRENGTH: Record<string, number> = { us: 2.3, cn: 2.1, ru: 1.75 };
export const AI_STRENGTH_DEFAULT = 1.5;
/** 힘 배율 중 전투 질(병력 한 명의 힘)로 붙는 몫(1.8이면 전투 힘 +20%) */
export const AI_QUALITY_SHARE = 0.25;
/** 그 나라 힘 배율: 내 나라는 1 */
export function aiStrength(id: string, player: string): number {
  if (id === player) return 1;
  return AI_STRENGTH[id] ?? AI_STRENGTH_DEFAULT;
}
/** 시작할 때 내 나라 금고·병력(예전의 몇 배). 시험판 자원 넉넉히 지급도 새 판에선 안 함 */
export const PLAYER_START_TREASURY_MULT = 0.6; // 11-27 대장 "예산 전체 2배": 0.3 → 0.6
/** 11-27 대장 "예산을 전체적으로 2배": 내 나라 수입(나라 예산·국방비) 배율. 내정 비용 기준(priceBase)에는 안 들어감 */
export const PLAYER_BUDGET_MULT = 2;
/** 11-27 대장 "AI는 초기 예산을 엄청 많이, 어렵게": AI 나라 시작 금고 배율(힘 배율에 곱함) */
export const AI_START_TREASURY_MULT = 5;
export const PLAYER_START_TROOPS_MULT = 0.7;

/** 11-26 보상 늘리기: 임무·작전·대전투에 이기면 받는 작전 수당(× 임무 종류 배율 × 난이도) */
export const MISSION_PAY_TREASURY = 120;
export const MISSION_PAY_SALARY = 60;
/** 훈련 별 하나당 봉급 */
export const TRAIN_PAY_PER_STAR = 80;
/** 도시를 차지하면 전리품: 도시 값어치 × 이 값 + 빼앗긴 나라 금고의 몇 % */
export const SPOILS_PER_VALUE = 1500;
export const SPOILS_TREASURY_SHARE = 0.06;
/** 적 침공을 막아 내면 노획: 쳐들어온 병력 × 이 값(나라 예산) */
export const DEFEND_BOUNTY = 0.012;

// ── 11-27 대장 요청 "나라가 커지고 도시를 점령하면 예산이 일시적·지속적으로 늘게" ──
/** 점령 도시 세금(나라 예산만, 병력은 그대로 OCCUPIED_INCOME): 군정 50→60%, 민정 75→85% */
export const OCCUPIED_BUDGET = 0.6;
export const CIVIL_BUDGET = 0.85;
/** 나라 규모 보너스: 가진 도시 값어치가 본토를 넘는 만큼 × 이 값(나라 예산), 상한 */
export const SIZE_BONUS_PER = 0.2;
export const SIZE_BONUS_MAX = 0.4;
/** 점령한 도시를 따라 넘어오는 내정 도시 전리품(도시 값어치 × SPOILS_PER_VALUE × 이 값) */
export const SPOILS_FOLLOWER_SHARE = 0.5;
/** 수도를 차지하면 그 나라 금고의 이만큼 접수(보통 도시는 SPOILS_TREASURY_SHARE) */
export const SPOILS_CAPITAL_SHARE = 0.25;
/** 그 나라가 마지막 도시를 잃고 망하면 남은 금고의 이만큼 접수 */
export const SPOILS_FALL_SHARE = 0.3;
/** 편입 끝(주민투표 통과·강화 조약) 정착 지원금: 도시 값어치 × 이 값 */
export const ANNEX_GRANT_PER_VALUE = 1200;
/** 국방비 → 나라 예산 옮기기(전용): 한 번에 국방비의 이만큼, 옮길 때 이만큼 사라짐(행정 비용) */
export const DEF_MOVE_SHARE = 0.25;
export const DEF_MOVE_LOSS = 0.1;

// ── 11-27 밸런스 조정(세계정복 무과금 4~5주) ──

/** 대전투 난이도에 상대 나라 힘을 얹음: (힘 배율 − 1) × 이 값. 미국 +0.16 · 중국 +0.14 · 러시아 +0.08 · 나머지 +0.05 */
export const GRAND_NATION_DIFF = 0.2;
/** 상대 나라 요새 성장(수비 힘 +%)만큼 대전투가 어려워짐: 요새 +30%면 난이도 + 0.3 × 이 값 */
export const GRAND_FORT_DIFF = 0.25;
/** 수도를 칠 때 난이도 */
export const GRAND_CAPITAL_DIFF = 0.15;
/** 만든 부대 전투력만큼 대전투가 쉬워짐: 전투력 ÷ PER, 최대 MAX (예전: 300마다 … 최대 0.3 → 전투력 90이면 끝) */
export const GRAND_ARMY_PER = 3000;
export const GRAND_ARMY_MAX = 0.4;
/** 점령했던 남의 도시를 잃을 때 신뢰도(예전 2) */
export const OCC_LOSS_TRUST = 1;
/** 패권 견제: 내 나라가 세계 점령 도시의 이 비율을 넘으면, 나와 싸우는 AI 나라의 공격 힘·횟수가 넘은 만큼 세짐 */
export const HEGEMON_FROM = 0.3;
export const HEGEMON_POWER = 0.5;
/** 정적의 발언·방해 공작으로 깎이는 의회 신뢰도 하루(실제 24시간) 상한. 예전엔 상한이 없어 정적 12명이면 하루 반 만에 0이 됨 */
export const RIVAL_TRUST_LOSS_PER_DAY = 6;

// ── 11-27 종합 확장안: 4막 구조 ──

/** 지금 몇 막인가. 막 기록이 없는 옛 저장은 3막(막힘 없음)으로 대접 */
export const actOf = (w: { act?: number }): 1 | 2 | 3 | 4 => Math.max(1, Math.min(4, w.act ?? 3)) as 1 | 2 | 3 | 4;
/** 막마다 AI 나라 힘 배율(예산·모병). 막 기록이 없는 옛 저장은 1 */
export const ACT_AI = [1, 1, 1.2, 1.5, 1.8];
export const actAi = (w: { act?: number }) => (w.act == null ? 1 : ACT_AI[actOf(w)]);
/** 막 배율 가운데 전투 질(병사 한 명의 힘)로 붙는 몫: 3막 +25% · 4막 +40% */
export const ACT_QUALITY_SHARE = 0.5;
/** 막 배율만큼 대전투가 어려워짐: (배율 − 1) × 이 값. 3막 +0.125 · 4막 +0.2 */
export const GRAND_ACT_DIFF = 0.25;
/** 1막 → 2막: 취임 뒤 게임 100일(실제 100시간) · 군사 연구 · 부대 전투력(나라 군사력 점수 × 이 값) */
export const ACT1_MIN_HOURS = 100;
export const ACT1_TECHS = 6;
/** 조건을 못 채워도 이만큼 지나면 2장(약한 나라가 1장에 갇히지 않게) */
export const ACT1_MAX_HOURS = 14 * 24;
export const ACT1_POWER_PER_MIL = 6;
/** 2막: 이웃 나라 수 · 굴복시킬 나라 수 · 못 해도 이만큼 지나면 세계 대전(실제 시간) */
export const ACT2_NEIGHBORS = 5;
export const ACT2_SUBDUE = 2;
export const ACT2_MAX_HOURS = 25 * 24;
/** 막이 오를 때 보상(올라간 막 번호 − 1 로 찾음) */
export const ACT_REWARD: Record<number, { ruby: number; boosts: number }> = { 1: { ruby: 50, boosts: 5 }, 2: { ruby: 80, boosts: 8 }, 3: { ruby: 120, boosts: 10 } };
/** 하루(실제 24시간) 대전투 상한. 빼앗긴 우리 도시 되찾기는 세지 않음.
 * 11-28 중과금 밸런스: 무료 4번 + 루비로 1번 더(💎60, 2·4장에는 살 수 없음). 예전 3번 + 💎40×2 */
export const GRAND_PER_DAY = 4;
export const GRAND_EXTRA_MAX = 1;
export const GRAND_EXTRA_RUBY = 60;
/** 루비로 대전투를 더 살 수 없는 장(2장 이웃 다툼·4장 마지막 전쟁) */
export const GRAND_NOBUY_ACTS: number[] = [2, 4];
/** 대전투 준비(진행 중 대전투)·다음 대전투까지 간격에 쓰는 가속권 하루 상한(시험판도 같음) */
export const GRAND_BOOST_PER_DAY = 24;
/** 대전투 난이도 바닥(예전 0.7): 부대를 아무리 많이 만들어도 이 밑으로는 안 내려감. 수도·요새는 더 높음 */
export const GRAND_DIFF_FLOOR = 0.85;
export const GRAND_DIFF_FLOOR_CAPITAL = 1.0;
/** AI가 내 나라를 칠 때 약한 곳을 노림: 내가 점령한 남의 도시는 이 배, 방어도가 낮을수록 더(방어도 100 → 1배, 0 → 1+이 값) */
export const AI_WEAK_OCC = 2.5;
export const AI_WEAK_DEF = 1.5;

// ── 11-27 종합 확장안 개편 3: AI 반격(도시를 빼앗긴 나라가 되찾으러 옴) ──
/** 장마다 반격이 오는 확률(1장은 전쟁 없음) */
export const COUNTER_CHANCE = [0, 0, 0.35, 0.5, 0.65];
/** 반격이 닿기까지(시간) */
export const COUNTER_MIN_H = 6;
export const COUNTER_MAX_H = 12;
/** 한꺼번에 걸리는 반격 수 */
export const COUNTER_MAX = 2;
/** 맡기면 막아 낼 확률: 바탕 + 부대 전투력 몫 − 장이 오를수록 */
export const COUNTER_AUTO_BASE = 0.45;
export const COUNTER_AUTO_ARMY = 0.3;
export const COUNTER_AUTO_ACT = 0.4;
/** 막아 내면 받는 것: 도시 값어치당 나라 예산 · 신뢰도 · 별 3개면 가속권 */
export const COUNTER_BOUNTY_PER_VALUE = 40;
export const COUNTER_TRUST = 2;

// ── 11-27 종합 확장안 전투 2: 전역(나라 하나를 국경에서 수도까지 차례로) ──
/** 연승 기세: 한 번 이길 때마다 다음 전투가 쉬워짐(최대 3번) */
export const CAMPAIGN_STREAK_DIFF = 0.04;
export const CAMPAIGN_STREAK_MAX = 3;
/** 보급선이 끊기면(반격에 도시를 잃으면) 다음 전투가 어려워짐 */
export const CAMPAIGN_CUT_DIFF = 0.15;
/** 수도를 차지해 전역을 끝내면 받는 것 */
export const CAMPAIGN_REWARD = { ruby: 30, boosts: 3 };
