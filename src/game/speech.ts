// 안 8 국가 기념일 연설(11/26): 실제 3.5일마다 기념일(신년·현충일·국군의 날 등). 하루 안에 낱말 8개 중 3개를 골라 연설.
// 낱말마다 이익집단 반응이 다르고, 그날 뜻과 맞는 낱말이면 지지도 덤. 서로 부딪치는 낱말(강한 국방+평화 등)은 감점.
import { addPresMod } from './approval';
import { domOf, snap, withDom } from './domestic';
import { DAY, H, polityOf, polityLog, roll, tell, withPolity } from './polity';
import type { GameState } from './state';

export const SPEECH_GAP_MS = 84 * H;
export const SPEECH_OPEN_MS = DAY;
export const SPEECH_PICK = 3;

export interface Word {
  id: string;
  label: string;
  groups: Partial<Record<string, number>>;
}
export const WORDS: Word[] = [
  { id: 'defense', label: '강한 국방', groups: { mil: 6, civic: -2 } },
  { id: 'peace', label: '평화', groups: { civic: 5, mil: -2 } },
  { id: 'growth', label: '경제 회복', groups: { biz: 5, labor: 1 } },
  { id: 'jobs', label: '일자리', groups: { labor: 5, youth: 3 } },
  { id: 'youth', label: '청년', groups: { youth: 6 } },
  { id: 'unity', label: '국민 통합', groups: { biz: 2, labor: 2, mil: 2, civic: 2, press: 2, youth: 2 } },
  { id: 'sacrifice', label: '희생과 헌신', groups: { mil: 4, press: 1 } },
  { id: 'science', label: '과학 강국', groups: { youth: 4, biz: 2 } },
  { id: 'welfare', label: '복지', groups: { labor: 4, civic: 3, biz: -3 } },
  { id: 'freedom', label: '자유', groups: { press: 5, civic: 3 } },
  { id: 'reform', label: '개혁', groups: { civic: 4, press: 3, biz: -3 } },
  { id: 'tradition', label: '전통', groups: { mil: 3, civic: -1 } },
];
export const wordById = (id: string) => WORDS.find((w) => w.id === id)!;
/** 서로 부딪치는 낱말 */
export const CLASH: Array<[string, string]> = [
  ['defense', 'peace'],
  ['growth', 'welfare'],
  ['reform', 'tradition'],
];
export interface NationalDay {
  name: string;
  icon: string;
  fit: string[];
}
export const DAYS: NationalDay[] = [
  { name: '신년', icon: '🎍', fit: ['unity', 'growth', 'youth'] },
  { name: '독립 기념일', icon: '🎌', fit: ['freedom', 'sacrifice', 'unity'] },
  { name: '현충일', icon: '🕯️', fit: ['sacrifice', 'peace', 'defense'] },
  { name: '노동절', icon: '👷', fit: ['jobs', 'welfare', 'unity'] },
  { name: '과학의 날', icon: '🔬', fit: ['science', 'youth', 'growth'] },
  { name: '국군의 날', icon: '🎖️', fit: ['defense', 'sacrifice', 'tradition'] },
  { name: '건국 기념일', icon: '🏛️', fit: ['tradition', 'unity', 'freedom'] },
  { name: '어린이날', icon: '🎈', fit: ['welfare', 'peace', 'youth'] },
];
export const dayByName = (n: string) => DAYS.find((d) => d.name === n)!;

const josa = (w: string, a: string, b: string) => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return b;
  return (c - 0xac00) % 28 ? a : b;
};
export function speechText(ids: string[]): string {
  const [a, b, c] = ids.map((id) => wordById(id).label);
  return `"${a} 위에 ${b}${josa(b, '이', '가')} 있고, 우리는 ${c}${josa(c, '을', '를')} 향해 함께 나아갑니다."`;
}
export function speechRows(dayName: string, ids: string[]): Array<[string, number]> {
  const d = dayByName(dayName);
  const rows: Array<[string, number]> = [['기본', 1]];
  const fits = ids.filter((id) => d.fit.includes(id)).length;
  if (fits) rows.push([`${d.icon} ${d.name}에 맞는 낱말 ${fits}개`, fits * 1.5]);
  for (const [x, y] of CLASH) if (ids.includes(x) && ids.includes(y)) rows.push([`😵 '${wordById(x).label}'와 '${wordById(y).label}'가 부딪침`, -2]);
  return rows;
}
export const speechOf = (s: GameState) => polityOf(s).speech;

export function canSpeak(s: GameState, ids: string[]): string | null {
  const o = speechOf(s).open;
  if (!o) return '지금은 기념일이 아니에요';
  if (ids.length !== SPEECH_PICK) return `낱말을 ${SPEECH_PICK}개 골라 주세요`;
  if (new Set(ids).size !== ids.length || ids.some((id) => !o.words.includes(id))) return '고를 수 없는 낱말이에요';
  return null;
}
export function speak(s: GameState, ids: string[]): GameState {
  if (canSpeak(s, ids)) return s;
  const sp = speechOf(s);
  const day = sp.open!.day;
  const appr = Math.round(speechRows(day, ids).reduce((a, [, v]) => a + v, 0) * 10) / 10;
  let ns = addPresMod(s, `🎤 ${day} 연설`, appr, 48);
  const d = domOf(ns);
  const mods = [...d.groups.mods.filter((m) => m.untilMs > ns.worldMs)];
  const sum: Record<string, number> = {};
  for (const id of ids) for (const [g, v] of Object.entries(wordById(id).groups)) sum[g] = (sum[g] ?? 0) + (v ?? 0);
  for (const [g, v] of Object.entries(sum)) if (v) mods.push({ g, v, untilMs: ns.worldMs + 48 * H, why: `🎤 ${day} 연설` });
  ns = withDom(ns, { groups: { ...d.groups, mods } });
  const text = speechText(ids);
  ns = withPolity(ns, { speech: { ...sp, open: null, last: { day, text, t: ns.worldMs } } });
  ns = polityLog(ns, `🎤 ${day} 연설: ${text} (지지도 ${appr >= 0 ? '+' : ''}${appr})`);
  return snap(ns, 'ceremony', `${day} 기념 연설`, text);
}

export function speechTick(s: GameState): GameState {
  if (!s.polity) return s;
  let ns = s;
  const sp = speechOf(ns);
  if (sp.open && sp.open.untilMs <= ns.worldMs) {
    ns = addPresMod(ns, `🎤 ${sp.open.day} 기념사 불참`, -1, 24);
    ns = polityLog(ns, `🎤 ${sp.open.day} 기념식에 연설하지 않았어요`);
    return withPolity(ns, { speech: { ...sp, open: null } });
  }
  if (sp.open || ns.worldMs < sp.nextMs) return ns;
  const day = DAYS[sp.n % DAYS.length];
  let r: number;
  [r, ns] = roll(ns);
  const others = WORDS.map((w) => w.id).filter((id) => !day.fit.includes(id));
  const off = Math.floor(r * others.length);
  const pick = [...others.slice(off), ...others.slice(0, off)].slice(0, 8 - day.fit.length);
  const words = [...day.fit, ...pick].sort((a, b) => WORDS.findIndex((w) => w.id === a) - WORDS.findIndex((w) => w.id === b));
  ns = withPolity(ns, { speech: { ...sp, n: sp.n + 1, nextMs: ns.worldMs + SPEECH_GAP_MS, open: { day: day.name, untilMs: ns.worldMs + SPEECH_OPEN_MS, words } } });
  return tell(ns, `${day.icon} 오늘은 ${day.name}이에요. 기념 연설 낱말 3개를 골라 주세요(개인 → 일정, 하루 안에).`);
}
