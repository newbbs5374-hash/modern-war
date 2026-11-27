// 11-27 화면 6: 즐겨찾기(자주 쓰는 화면 4개를 본부에 꽂음) + 화면 5: 본부 간단히 스위치. 기기에만 저장.
const FAV_KEY = 'modern-war-favs';
const HOME_KEY = 'modern-war-home';
export const FAV_MAX = 4;

export function favsOf(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, FAV_MAX) : [];
  } catch {
    return [];
  }
}
/** 꽂거나 뺌. 4개가 찼으면 가장 오래된 것을 밀어냄 */
export function toggleFav(list: string[], key: string): string[] {
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key].slice(-FAV_MAX);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* 무시 */
  }
  return next;
}
/** 본부를 옛 모양(아이콘 12개 · 긴 임무 줄)으로 쓰는 중인가. 기본은 간단히 */
export function fullHomeOn(): boolean {
  try {
    return localStorage.getItem(HOME_KEY) === 'full';
  } catch {
    return false;
  }
}
export function setFullHome(on: boolean) {
  try {
    if (on) localStorage.setItem(HOME_KEY, 'full');
    else localStorage.removeItem(HOME_KEY);
  } catch {
    /* 무시 */
  }
}
/** 찾기: 띄어쓰기를 빼고 견줌 */
export const matches = (label: string, q: string) => label.replace(/\s/g, '').toLowerCase().includes(q.replace(/\s/g, '').toLowerCase());
