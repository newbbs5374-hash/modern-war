// 나라마다 정해진 라이벌(숙적). 11-26 대장 지시: "각각 라이벌 국가도 설정해주고, 서로 교역도 잘 안 하고,
// 관세도 높고 서로 헐뜯는 발언은 자주 하게".
// - 교역: 숙적끼리는 사고팔 때 값이 나쁘고(economy.ts), 정기 무역 계약은 거절해요.
// - 관세: AI 숙적은 거의 늘 서로 높은 관세를 걸어 두어요(pressure.ts).
// - 발언: 정상 SNS에서 숙적을 가장 자주 헐뜯어요(game/leaderSns.ts).
// 새 나라(대만·폴란드·필리핀·파키스탄·사우디)는 게임에 들어오면 저절로 함께 쓰여요(없는 나라는 건너뜀).
import { COUNTRIES } from './world';

/** 짝 하나: 두 나라 + 왜 앙숙인지(짧게) */
const PAIRS: Array<[string, string, string]> = [
  ['us', 'cn', '패권·무역 전쟁'],
  ['us', 'ru', '옛 냉전의 앙숙'],
  ['us', 'ir', '핵·제재 다툼'],
  ['us', 'kp', '핵·미사일 대치'],
  ['cn', 'jp', '역사·바다 다툼'],
  ['cn', 'in', '국경 산맥 다툼'],
  ['ru', 'ua', '땅을 두고 맞선 전쟁'],
  ['ru', 'uk', '첩보·제재 다툼'],
  ['ru', 'de', '가스·안보 갈등'],
  ['kr', 'kp', '갈라진 한반도'],
  ['kr', 'jp', '역사·수출 규제 다툼'],
  ['jp', 'kp', '미사일·납치 문제'],
  ['il', 'ir', '중동 최대의 앙숙'],
  ['il', 'tr', '성지·가자 다툼'],
  ['tr', 'ir', '중동 주도권 경쟁'],
  // 새 나라(들어오면 쓰임)
  ['cn', 'tw', '해협 위기'],
  ['ru', 'pl', '동유럽 최전선'],
  ['cn', 'ph', '남중국해 섬 다툼'],
  ['in', 'pk', '카슈미르 분쟁'],
  ['ir', 'sa', '중동 패권·석유'],
  // 11-27 새 나라 18개
  ['eg', 'et', '나일강 댐 물 다툼'],
  ['ng', 'za', '아프리카 맏형 다툼'],
  ['dz', 'fr', '식민지 역사 갈등'],
  ['br', 'ar', '남미 1등 경쟁'],
  ['co', 've', '국경·정권 대립'],
  ['us', 've', '석유·제재 다툼'],
  ['ar', 'uk', '포클랜드 섬 분쟁'],
  ['au', 'cn', '태평양 무역·안보 갈등'],
  ['mx', 'us', '국경·관세 다툼'],
  ['gr', 'tr', '에게해 섬 다툼'],
  ['fi', 'ru', '북쪽 국경 대치'],
  ['ca', 'ru', '북극 바다 경쟁'],
  ['fr', 'it', '지중해 주도권'],
  ['ar', 'cl', '안데스 국경 경쟁'],
  ['es', 'uk', '지브롤터 다툼'],
  ['ng', 'et', '아프리카 인구 대국 경쟁'],
];

const has = (id: string) => COUNTRIES.some((c) => c.id === id);
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const WHY: Record<string, string> = Object.fromEntries(PAIRS.map(([a, b, why]) => [key(a, b), why]));

/** 두 나라가 정해진 숙적인가 */
export function isArchRival(a: string, b: string): boolean {
  return a !== b && key(a, b) in WHY && has(a) && has(b);
}
/** 그 나라의 숙적들(게임에 있는 나라만) */
export function archRivalsOf(id: string): string[] {
  return PAIRS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])).filter(has);
}
/** 왜 앙숙인지 */
export function archWhy(a: string, b: string): string {
  return WHY[key(a, b)] ?? '';
}
