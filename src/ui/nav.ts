// 화면 이름과 아래 메뉴(용흔의 "아래 메뉴 6칸 · 가운데 강조 1칸" 방식을 참고).

export type Screen =
  | 'home'
  | 'personal'
  | 'defense'
  | 'diplo'
  | 'society'
  | 'economy'
  | 'culture'
  | 'tree'
  // 옛 화면 이름(주소·안내에서 들어오면 새 탭으로 옮겨 줌)
  | 'ops'
  | 'officer'
  | 'forces'
  | 'training'
  | 'nation'
  | 'shop'
  | 'settings'
  | 'herald'
  | 'report'
  | 'codex'
  | 'battle';

export const SCREEN_TITLES: Record<Screen, string> = {
  home: '본부',
  personal: '개인',
  defense: '국방',
  diplo: '외교',
  society: '사회',
  economy: '경제',
  culture: '문화',
  tree: '국정',
  ops: '작전',
  officer: '장교',
  forces: '부대',
  training: '훈련',
  nation: '내정',
  shop: '상점',
  settings: '설정',
  herald: '전령',
  report: '보고',
  codex: '도감',
  battle: '전투',
};

/** 아래 메뉴 8칸: 본부(강조) + 개인·국방·외교·사회·경제·문화(11-23 추가) + 상점 */
export const NAV: Array<{ screen: Screen; icon: string; label: string; main?: boolean; locked?: string }> = [
  { screen: 'home', icon: '🏠', label: '본부', main: true },
  { screen: 'personal', icon: '👤', label: '개인' },
  { screen: 'defense', icon: '🛡️', label: '국방' },
  { screen: 'diplo', icon: '🌐', label: '외교' },
  { screen: 'society', icon: '👥', label: '사회' },
  { screen: 'economy', icon: '💰', label: '경제' },
  { screen: 'culture', icon: '🎭', label: '문화' },
  { screen: 'shop', icon: '🛒', label: '상점' },
];

/** 11-27 화면 개편: 아래 메뉴 5칸(본부·작전·국정 나무·사람·상점). art = 아이콘 그림을 빌려 올 옛 이름 */
export const NAV5: Array<{ screen: Screen; icon: string; label: string; art: string; main?: boolean; locked?: string; also?: Screen[] }> = [
  { screen: 'home', icon: '🏠', label: '본부', art: '본부', main: true },
  { screen: 'defense', icon: '⚔️', label: '작전', art: '국방' },
  { screen: 'tree', icon: '🌳', label: '국정', art: '사회', also: ['diplo', 'society', 'economy', 'culture'] },
  { screen: 'personal', icon: '👥', label: '사람', art: '개인' },
  { screen: 'shop', icon: '🛒', label: '상점', art: '상점' },
];
const MENU_KEY = 'modern-war-menu';
/** 옛 메뉴(8칸)로 쓰는 중인가. 기본은 새 메뉴(5칸) */
export function oldMenuOn(): boolean {
  try {
    return localStorage.getItem(MENU_KEY) === 'old';
  } catch {
    return false;
  }
}
export function setOldMenu(on: boolean) {
  try {
    if (on) localStorage.setItem(MENU_KEY, 'old');
    else localStorage.removeItem(MENU_KEY);
  } catch {
    /* 무시 */
  }
}

/** 새 큰 탭 안의 작은 탭 이름 */
export type PersonalTab = 'profile' | 'win' | 'aides' | 'talent' | 'meet' | 'plan' | 'agenda' | 'album';
export type DefenseTab = 'ops' | 'train' | 'forces' | 'command' | 'spy' | 'tech' | 'fac';
export type DiploTab = 'mofa' | 'nations' | 'rel' | 'agree' | 'isle' | 'council';
export type SocietyTab = 'mins' | 'city' | 'gov' | 'tech' | 'politics' | 'nation' | 'press' | 'opinion';
export type EconomyTab = 'vault' | 'macro' | 'res' | 'ind' | 'trade' | 'tax' | 'facall' | 'proj';

function remember(key: string, tab: string) {
  try {
    sessionStorage.setItem(`tab:${key}`, tab);
  } catch {
    /* 무시 */
  }
}

/** 옛 화면·탭 이름 → 새 큰 탭 + 작은 탭 */
export function legacyRoute(screen: string, tab?: string): { screen: Screen; set: Array<[string, string]> } {
  const t = tab ?? '';
  switch (screen) {
    case 'ops':
      if (t === 'spy') return { screen: 'defense', set: [['defense', 'spy']] };
      return { screen: 'defense', set: [['defense', 'ops'], ...(t ? ([['ops', t]] as Array<[string, string]>) : [])] };
    case 'officer':
      if (t === 'aides') return { screen: 'personal', set: [['personal', 'aides'], ['staff-view', 'aide']] };
      if (t === 'generals') return { screen: 'defense', set: [['defense', 'command']] };
      if (t === 'rivals') return { screen: 'society', set: [['society', 'politics']] };
      return { screen: 'personal', set: [['personal', 'profile']] };
    case 'forces':
      return { screen: 'defense', set: [['defense', 'forces']] };
    case 'training':
      return { screen: 'defense', set: [['defense', 'train']] };
    case 'nation':
      if (t === 'res') return { screen: 'economy', set: [['economy', 'res']] };
      if (t === 'fac') return { screen: 'economy', set: [['economy', 'facall']] };
      if (t === 'city') return { screen: 'society', set: [['society', 'city']] };
      if (t === 'gov') return { screen: 'society', set: [['society', 'gov']] };
      if (t === 'tech') return { screen: 'defense', set: [['defense', 'tech']] };
      return { screen: 'economy', set: [['economy', 'vault']] };
    case 'diplo':
      if (t === 'trade') return { screen: 'economy', set: [['economy', 'trade']] };
      return { screen: 'diplo', set: t ? [['diplo', t]] : [] };
    case 'culture':
      // 승리 조건은 개인 → 승리로 옮김(11-24)
      if (t === 'win') return { screen: 'personal', set: [['personal', 'win']] };
      return { screen: 'culture', set: t ? [['culture', t]] : [] };
    case 'shop':
      return { screen: 'shop', set: t ? [['shop', t]] : [] };
    default:
      return { screen: (screen in SCREEN_TITLES ? screen : 'home') as Screen, set: t ? [[screen, t]] : [] };
  }
}

/** 화면 이름(옛 이름도) + 작은 탭 → 작은 탭을 기억해 두고 갈 화면을 돌려줌 */
export function routeTo(screen: string, key?: string, tab?: string): Screen {
  const r = legacyRoute(screen, tab);
  // key가 화면 이름과 다르면(예: 'shop' 안의 탭) 그대로 기억
  if (key && tab && key !== screen && !r.set.some(([k]) => k === key)) r.set.push([key, tab]);
  for (const [k, v] of r.set) remember(k, v);
  return r.screen;
}

export function parseScreen(hash: string): Screen {
  const h = hash.replace(/^#/, '');
  return h in SCREEN_TITLES ? routeTo(h) : 'home';
}
