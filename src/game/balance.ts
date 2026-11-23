// 시험용 숫자를 한곳에 모아 둔다. 숫자 맞추기는 여기만 고치면 된다.

/** 실제 1시간 = 게임 하루 */
export const REAL_MS_PER_GAME_DAY = 60 * 60 * 1000;

/** 받지 않고 쌓아 둘 수 있는 봉급 한도: 실제 12시간치 */
export const PENDING_CAP_HOURS = 12;

/** 게임 달력의 첫날(가상의 근미래) */
export const GAME_START_DATE = { year: 2031, month: 3, day: 1 };

/** 나라 금고: 시작 국방예산 지수 × 이 값 = 하루 국방예산 */
export const BUDGET_PER_DAY_PER_POINT = 10;
/** 나라 시작 금고 = 국방예산 지수 × 이 값 */
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
/** 침공 비용 = 보내는 병력 × 이 값(국방예산) */
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
export const REBEL_CHANCE = 0.004;
export const REBEL_FAITH_MULT = 1.5;
/** 반란으로 되살아난 나라의 최소 병력 */
export const REVIVE_TROOPS = 30000;
/** 미국(전력 투사)의 바다 건너 침공 힘 배율 */
export const US_OVERSEAS = 0.9;
/** 점령한 남의 도시는 민심이 낮아 수입이 절반 */
export const OCCUPIED_INCOME = 0.5;

/** 전령에 남기는 소식 수 */
export const EVENT_LOG_MAX = 150;
