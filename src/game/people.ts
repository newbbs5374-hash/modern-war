// 인물 창: 누구를 보고 있는지(PersonRef) · 인물과의 교류(대화·선물·연설·친서). 하루 한 번씩.
// 부관 선물·특별 훈련·부관 임무는 officer.ts 것을 그대로 씀. 여기에는 새 교류만.
import { LEADERS } from '../data/leaders';
import { countryById } from '../data/world';
import { REAL_MS_PER_GAME_DAY } from './balance';
import { addFavorNote, favorOf } from './civ';
import { giftCost } from './officer';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, relationOf } from './world';

export type NpcRole = 'envoy' | 'coastguard' | 'settler';
export type PersonRef =
  | { kind: 'player' }
  | { kind: 'aide'; id: number }
  | { kind: 'general'; id: number }
  | { kind: 'rival'; name: string }
  | { kind: 'leader'; country: string }
  | { kind: 'npc'; role: NpcRole; country?: string };

export type ActId = 'chat' | 'gift' | 'speech' | 'letter' | 'probe';

export const NPC_INFO: Record<NpcRole, { name: string; icon: string; text: string }> = {
  envoy: { name: '특사', icon: '🕴️', text: '다른 나라가 보낸 특사예요. 지도자의 뜻을 전하고 우리 답을 가져가요. 대화 창에서 답하면 그 나라 호감이 바뀌어요.' },
  coastguard: { name: '해안 경비대장', icon: '⚓', text: '우리 바다를 지키는 해안 경비대장이에요. 수상한 배·밀수·표류민 소식을 가져와요.' },
  settler: { name: '개척민 대표', icon: '🧑‍🌾', text: '새 섬을 일구는 개척민들의 대표예요. 땅·물자·안전을 부탁하러 찾아와요.' },
};

/** 인물 이름표(목록·저장 칸 이름) */
export function personKey(p: PersonRef): string {
  switch (p.kind) {
    case 'player':
      return 'player';
    case 'aide':
      return `aide:${p.id}`;
    case 'general':
      return `general:${p.id}`;
    case 'rival':
      return `rival:${p.name}`;
    case 'leader':
      return `leader:${p.country}`;
    case 'npc':
      return `npc:${p.role}`;
  }
}

/** 아직 게임 안에 있는 인물인지(떠난 부관·장군이면 창을 닫음) */
export function personExists(s: GameState, p: PersonRef): boolean {
  if (p.kind === 'aide') return s.officer.aides.some((a) => a.id === p.id);
  if (p.kind === 'general') return s.officer.generals.some((g) => g.id === p.id);
  if (p.kind === 'rival') return s.officer.rivals.some((r) => r.name === p.name);
  if (p.kind === 'leader') return !!LEADERS[p.country];
  return true;
}

const gameDay = (ms: number) => Math.floor(ms / REAL_MS_PER_GAME_DAY);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** 교류를 오늘 이미 했는지 */
function usedToday(s: GameState, p: PersonRef, act: ActId): boolean {
  return s.officer.people?.[`${personKey(p)}:${act}`] === gameDay(s.worldMs);
}

/** 교류 값(봉급) */
export function actCost(s: GameState, p: PersonRef, act: ActId): number {
  const r = s.player.rankIndex;
  if (act === 'gift' && p.kind === 'general') return giftCost(r);
  if (act === 'gift' && p.kind === 'leader') return giftCost(r) * 3;
  if (act === 'speech') return 200 + r * 80;
  return 0;
}

/** 할 수 없으면 까닭, 할 수 있으면 null */
export function canAct(s: GameState, p: PersonRef, act: ActId): string | null {
  if (!personExists(s, p)) return '이제 없는 사람이에요';
  if (p.kind === 'leader') {
    if (p.country === s.player.countryId) return '우리 나라예요';
    if (!isAlive(s.world, p.country)) return '나라가 사라졌어요';
    if (act === 'gift' && relationOf(s.world, s.player.countryId, p.country) === '전쟁') return '전쟁 중엔 선물을 받지 않아요';
  }
  if (usedToday(s, p, act)) return '오늘은 이미 했어요(내일 다시)';
  const cost = actCost(s, p, act);
  if (cost > s.player.salary) return `봉급 ${cost} 필요`;
  return null;
}

/** 친서 성공 확률: 정치 스탯 + 지금 호감 */
export function letterChance(s: GameState, country: string): number {
  const pol = s.officer.stats['정치'] ?? 0;
  return clamp(0.45 + pol * 0.01 + favorOf(s, country) / 400, 0.15, 0.95);
}

/** 인물마다 할 수 있는 교류 목록 */
export function actsOf(p: PersonRef): Array<{ id: ActId; icon: string; name: string; text: string }> {
  switch (p.kind) {
    case 'player':
      return [{ id: 'speech', icon: '🎤', name: '대국민 연설', text: '명성 + · 의회 신뢰 +2' }];
    case 'aide':
      return [{ id: 'chat', icon: '💬', name: '대화', text: '인연 +3 · 경험 +10' }];
    case 'general':
      return [
        { id: 'chat', icon: '💬', name: '작전 회의', text: '충성 +3' },
        { id: 'gift', icon: '🎁', name: '격려금', text: '충성 +8' },
      ];
    case 'rival':
      return [{ id: 'probe', icon: '🕵️', name: '동향 살피기', text: '정보 + · 라이벌 속도 알기' }];
    case 'leader':
      return [
        { id: 'letter', icon: '✉️', name: '친서 보내기', text: '성공하면 호감 +5(정치 스탯)' },
        { id: 'gift', icon: '🎁', name: '선물 보내기', text: '호감 +8(반드시)' },
      ];
    case 'npc':
      return [];
  }
}

const AIDE_CHAT: Record<string, string[]> = {
  low: ['"네, 지도자님. 맡은 일은 해내겠습니다."', '"아직은 어색하네요. 그래도 잘 부탁드립니다."', '"보고서는 오늘 밤까지 올리겠습니다."'],
  mid: ['"오늘 훈련, 지도자님 덕분에 버텼어요."', '"커피 한잔 하실래요? 제가 타 드릴게요."', '"요즘 병사들 사이에서 지도자님 칭찬이 많아요."'],
  high: ['"어디든 따라가겠습니다. 정말이에요."', '"지도자님이 계셔서 이 전쟁이 덜 무서워요."', '"전쟁이 끝나면… 같이 바다 보러 가요."'],
};
const GENERAL_CHAT = ['"전선은 버티고 있습니다. 보급만 조금 더 주십시오."', '"적 움직임이 수상합니다. 대비해 두겠습니다."', '"명령만 내리십시오. 장병들은 준비됐습니다."'];
const LEADER_REPLY = { ok: ['정중한 답장이 왔어요.', '"좋은 이웃이 되길 바랍니다." 답장이 왔어요.', '지도자가 친서를 회의에서 읽었대요.'], bad: ['답장이 오지 않았어요.', '"말보다 행동을 보이시오." 차가운 답이 왔어요.'] };

/** 교류 하기: 바뀐 상태와 결과 글 */
export function doAct(s: GameState, p: PersonRef, act: ActId): { state: GameState; out: string } {
  const why = canAct(s, p, act);
  if (why) return { state: s, out: why };
  const o = structuredClone(s.officer);
  const rng = new Rng(o.seed);
  o.people = { ...(o.people ?? {}), [`${personKey(p)}:${act}`]: gameDay(s.worldMs) };
  const cost = actCost(s, p, act);
  let ns: GameState = { ...s, officer: o, player: { ...s.player, salary: s.player.salary - cost } };
  let out = '';
  const r = s.player.rankIndex;

  if (p.kind === 'player' && act === 'speech') {
    const fame = Math.round(10 + r * 6 + (o.stats['정치'] ?? 0) * 0.5);
    o.fame += fame;
    o.trust = Math.min(100, o.trust + 2);
    out = `🎤 연설을 마쳤어요. 명성 +${fame} · 의회 신뢰 +2`;
  } else if (p.kind === 'aide' && act === 'chat') {
    const a = o.aides.find((x) => x.id === p.id)!;
    const line = rng.pick(AIDE_CHAT[a.bond >= 60 ? 'high' : a.bond >= 30 ? 'mid' : 'low']);
    a.bond = Math.min(100, a.bond + 3);
    a.exp += 10;
    while (a.exp >= a.level * 100 && a.level < 10) {
      a.exp -= a.level * 100;
      a.level += 1;
    }
    out = `💬 ${a.name}: ${line} (인연 +3 · 경험 +10)`;
  } else if (p.kind === 'general') {
    const g = o.generals.find((x) => x.id === p.id)!;
    const v = act === 'gift' ? 8 : 3;
    g.loyalty = Math.min(100, g.loyalty + v);
    out = act === 'gift' ? `🎁 ${g.name} 장군이 격려금을 받았어요. 충성 +${v}` : `💬 ${g.name}: ${rng.pick(GENERAL_CHAT)} (충성 +${v})`;
  } else if (p.kind === 'rival' && act === 'probe') {
    const rv = o.rivals.find((x) => x.name === p.name)!;
    const intel = 3 + Math.floor(r / 2);
    o.intel += intel;
    out = `🕵️ ${rv.name}의 동향: 하루에 공훈 약 ${Math.round(rv.rate)}씩 쌓는 중이에요. 정보 +${intel}`;
  } else if (p.kind === 'leader') {
    const L = LEADERS[p.country];
    const nm = `${countryById(p.country).name} ${L.title} ${L.name}`;
    if (act === 'gift') {
      ns = addFavorNote(ns, p.country, '🎁 보낸 선물', 8);
      out = `🎁 ${nm}에게 선물을 보냈어요. 호감 +8`;
    } else {
      const ok = rng.next() < letterChance(s, p.country);
      if (ok) ns = addFavorNote(ns, p.country, '✉️ 주고받은 친서', 5);
      out = `✉️ ${nm}: ${rng.pick(ok ? LEADER_REPLY.ok : LEADER_REPLY.bad)}${ok ? ' 호감 +5' : ''}`;
    }
  }
  o.seed = rng.seed;
  return { state: ns, out };
}
