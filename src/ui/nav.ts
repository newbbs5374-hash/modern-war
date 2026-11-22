// 화면 이름과 아래 메뉴(용흔의 "아래 메뉴 6칸 · 가운데 강조 1칸" 방식을 참고).

export type Screen =
  | 'home'
  | 'ops'
  | 'officer'
  | 'forces'
  | 'training'
  | 'nation'
  | 'shop'
  | 'settings'
  | 'herald'
  | 'codex';

export const SCREEN_TITLES: Record<Screen, string> = {
  home: '본부',
  ops: '작전',
  officer: '장교',
  forces: '부대',
  training: '훈련',
  nation: '나라',
  shop: '상점',
  settings: '설정',
  herald: '전령',
  codex: '도감',
};

/** 아래 메뉴 6칸. 작전이 주 메뉴(강조색). locked = 아직 못 쓰는 까닭 */
export const NAV: Array<{ screen: Screen; icon: string; label: string; main?: boolean; locked?: string }> = [
  { screen: 'ops', icon: '🗺️', label: '작전', main: true },
  { screen: 'officer', icon: '🎖️', label: '장교' },
  { screen: 'forces', icon: '🪖', label: '부대' },
  { screen: 'training', icon: '🎯', label: '훈련' },
  { screen: 'nation', icon: '🏛️', label: '나라' },
  { screen: 'shop', icon: '🛒', label: '상점', locked: '준비 중' },
];

export function parseScreen(hash: string): Screen {
  const h = hash.replace(/^#/, '') as Screen;
  return h in SCREEN_TITLES ? h : 'home';
}
