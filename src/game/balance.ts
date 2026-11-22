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
