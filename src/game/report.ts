// 부관 보고: 중요한 일이 끝나면 부관이 말해 주는 메시지.
// 바뀌기 전·후 상태를 비교해서 만든다(실시간·꺼 둔 동안·버튼 모두 같은 함수).
import { STAT_IDS, GRAND_RANK } from '../data/officers';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import { BUILDING_IDS } from '../data/economy';
import type { GameState } from './state';

export interface Report {
  id: string;
  text: string;
  /** 말하는 부관 이름(없으면 기본 부관) */
  who?: string;
  /** 그림(이모지) */
  icon: string;
}

/** 쌓아 두는 보고 수 */
export const REPORT_MAX = 8;

/** 받침이 있으면 a, 없으면 b (예: 이/가, 을/를) */
export function josa(word: string, a: string, b: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const has = code >= 0 && code <= 11171 ? code % 28 !== 0 : false;
  return word + (has ? a : b);
}

export const reportsOf = (s: GameState): Report[] => s.reports ?? [];

/** 맨 앞 보고 닫기 */
export function dismissReport(s: GameState): GameState {
  const r = reportsOf(s);
  return r.length ? { ...s, reports: r.slice(1) } : s;
}

/** 시험·외부에서 보고 하나 넣기 */
export function pushReport(s: GameState, rep: Omit<Report, 'id'>): GameState {
  const list = [...reportsOf(s), { ...rep, id: `${Math.floor(s.worldMs)}-${reportsOf(s).length}-${Math.random().toString(36).slice(2, 6)}` }];
  return { ...s, reports: list.slice(-REPORT_MAX) };
}

/** 앞(b) → 뒤(a) 사이에 끝난 중요한 일을 부관 보고로 만든다 */
export function addReports(b: GameState | null, a: GameState): GameState {
  if (!b || b === a || b.player.countryId !== a.player.countryId) return a;
  const out: Omit<Report, 'id'>[] = [];
  const crossed = (end: number | undefined | null) => !!end && b.worldMs < end && a.worldMs >= end;

  // 병과 모집 완료
  const me = countryById(a.player.countryId);
  for (const [name, n] of Object.entries(a.economy.army)) {
    const d = n - (b.economy.army[name] ?? 0);
    if (d > 0) out.push({ icon: name === me.specialUnit.name ? '🌟' : '🪖', text: `${name} ${d > 1 ? `${d}부대 ` : ''}모집이 완료되었습니다.` });
  }
  // 시설 공사 완료
  for (const id of BUILDING_IDS) {
    const lv = a.economy.buildings?.[id]?.level ?? 1;
    if (lv > (b.economy.buildings?.[id]?.level ?? 1)) out.push({ icon: '🏗️', text: `${josa(id, '이', '가')} ${lv}단계로 완공되었습니다.` });
  }
  // 내정 일 완료
  const ch = b.economy.chore;
  if (ch && a.economy.chore && a.economy.chore.endMs === ch.endMs && crossed(ch.endMs)) out.push({ icon: '📋', text: `내정 업무 "${ch.title}" 끝났습니다. 내정 화면에서 보상을 받아 주세요.` });
  // 임무 현장 도착
  const m = b.officer.active;
  if (m && a.officer.active?.id === m.id && crossed(m.endMs)) out.push({ icon: m.exam ? '🎓' : '🎯', text: `${m.title} — 현장에 도착했습니다. 지시를 내려 주십시오.` });
  // 부관 심부름 완료(그 부관이 말함)
  for (const x of a.officer.aides) {
    const old = b.officer.aides.find((y) => y.id === x.id);
    if (old?.errand && x.errand && x.errand.endMs === old.errand.endMs && crossed(x.errand.endMs)) {
      out.push({ who: x.name, icon: '📦', text: `맡기신 ${josa(x.errand.kind, '을', '를')} 마치고 돌아왔습니다. 보상을 받아 주세요.` });
    }
  }
  // 새 부관 합류
  for (const x of a.officer.aides) {
    if (!b.officer.aides.some((y) => y.id === x.id)) out.push({ who: x.name, icon: '🤝', text: `오늘부터 모실 ${x.specialty} 부관 ${x.name}입니다. 잘 부탁드립니다!` });
  }
  // 대전투 준비
  if (a.player.rankIndex >= GRAND_RANK && crossed(a.officer.grandReadyMs) && a.officer.grandReadyMs === b.officer.grandReadyMs) out.push({ icon: '⚔️', text: '대전투 준비가 끝났습니다. 언제든 출격할 수 있습니다.' });
  // 승급
  if (a.player.rankIndex > b.player.rankIndex) out.push({ icon: '🎖️', text: `${josa(RANKS[a.player.rankIndex].name, '으로', '로')} 승급하셨습니다. 축하드립니다!` });
  // 스탯 상승
  const ups = STAT_IDS.filter((id) => Math.floor(a.officer.stats[id]) > Math.floor(b.officer.stats[id]));
  if (ups.length) out.push({ icon: '📈', text: `${ups.map((id) => `${id} ${Math.floor(a.officer.stats[id])}`).join(', ')}! 능력이 올랐습니다.` });

  let s = a;
  for (const r of out) s = pushReport(s, r);
  return s;
}
