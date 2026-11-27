// 11-27 점령 후 더 많은 선택(대장 요청 "도시를 점령하고 난 후 다양한 선택"). 원래 있던 편입·꼭두각시·해방 옆에 4가지를 더함.
//  🪖 군사 기지: 세금 20% · 반란 30% · 방어도 높게 유지 · 편입 안 함
//  🏭 경제 특구: 나라 예산을 들여 세운 뒤 세금 100%(점령지인데도) · 반란은 그대로 · 편입 안 함
//  🤝 연합국에 넘기기: 도시를 연합국에 줌 → 그 나라 호감 크게 + · 명성 + · 사례금
//  💱 도시 맞바꾸기: 원래 나라가 가진 우리 땅 하나와 바꿈(전쟁 중이면 휴전까지)
//  군정 동안 고름(편입·꼭두각시·해방과 같은 때). 약탈 후 돌려주기는 대장 결정(11-26)으로 넣지 않음.
import { CITIES, FRONT, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { budgetPerDay, type GameState } from './state';
import { addFavorNote } from './civ';
import { canChoose, entryOrFresh, setEntry, PUPPET_FAVOR_HOME } from './annex';
import { pushReport } from './report';
import { noteCapture } from './territory';
import { eul, ga, gwa, homeOf, isAlive, pairKey, relationOf, syncFollowers, type WorldEvent } from './world';

/** 군사 기지·특구 반발(그 나라 호감) */
export const BASE_FAVOR = -8;
export const ZONE_FAVOR = -4;
/** 경제 특구 세우는 값(도시 값어치 ×) */
export const ZONE_COST_PER_VALUE = 1500;
/** 연합국에 넘기기: 호감 · 명성 · 사례금(도시 값어치 ×) */
export const GIFT_FAVOR = 35;
export const GIFT_FAME = 5;
export const GIFT_THANKS_PER_VALUE = 800;
/** 군사 기지 방어도 최소 */
export const BASE_DEFENSE = 80;

const followerValue = (cityId: string) => CITIES.filter((x) => x.id === cityId || (!x.front && x.hub === cityId)).reduce((a, x) => a + x.value, 0);
const say = (s: GameState, icon: string, ev: string, rep: string): GameState =>
  pushReport({ ...s, world: { ...s.world, events: [{ t: s.worldMs, kind: '점령', text: `${icon} ${ev}`, mine: true } as WorldEvent, ...s.world.events] } }, { icon, text: rep });

// ── 🪖 군사 기지 ──
export function makeBase(s: GameState, cityId: string): GameState {
  if (canChoose(s, cityId)) return s;
  const c = cityById(cityId);
  let out = setEntry(s, cityId, { ...entryOrFresh(s, cityId)!, mode: 'base' });
  out = { ...out, world: { ...out.world, defense: { ...out.world.defense, [cityId]: Math.max(out.world.defense[cityId] ?? 0, BASE_DEFENSE) } } };
  if (isAlive(out.world, c.home)) out = addFavorNote(out, c.home, `🪖 ${c.name} 군사 기지`, BASE_FAVOR);
  return say(out, '🪖', `${c.name}에 우리 군사 기지를 세웠어요.`, `대장님, ${c.name}에 군사 기지를 세웠습니다. 세금은 20%만 들어오지만 반란이 크게 줄고 쉽게 빼앗기지 않습니다.`);
}
/** 군사 기지는 방어도가 늘 높게(AI 판단마다) */
export function baseTick(s: GameState): GameState {
  const me = s.player.countryId;
  let def: Record<string, number> | null = null;
  for (const [id, a] of Object.entries(s.world.annex ?? {})) {
    if (a.mode !== 'base' || s.world.owner[id] !== me) continue;
    if ((s.world.defense[id] ?? 0) >= BASE_DEFENSE) continue;
    def ??= { ...s.world.defense };
    def[id] = BASE_DEFENSE;
  }
  return def ? { ...s, world: { ...s.world, defense: def } } : s;
}

// ── 🏭 경제 특구 ──
/** 특구 값: max(값어치 × 1500, 하루 나라 예산) */
export const zoneCost = (s: GameState, cityId: string) => Math.round(Math.max(followerValue(cityId) * ZONE_COST_PER_VALUE, budgetPerDay(s, s.player.countryId)));
export function canZone(s: GameState, cityId: string): string | null {
  const why = canChoose(s, cityId);
  if (why) return why;
  const cost = zoneCost(s, cityId);
  if (s.nations[s.player.countryId].treasury < cost) return `나라 예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function makeZone(s: GameState, cityId: string): GameState {
  if (canZone(s, cityId)) return s;
  const me = s.player.countryId;
  const c = cityById(cityId);
  const cost = zoneCost(s, cityId);
  let out = setEntry(s, cityId, { ...entryOrFresh(s, cityId)!, mode: 'zone' });
  out = { ...out, nations: { ...out.nations, [me]: { ...out.nations[me], treasury: out.nations[me].treasury - cost } } };
  if (isAlive(out.world, c.home)) out = addFavorNote(out, c.home, `🏭 ${c.name} 경제 특구`, ZONE_FAVOR);
  return say(out, '🏭', `${eul(c.name)} 경제 특구로 열었어요.`, `대장님, ${c.name} 경제 특구가 문을 열었습니다(나라 예산 −${cost.toLocaleString('ko-KR')}). 점령지인데도 세금이 100% 들어옵니다. 반란 위험은 그대로라 지켜봐야 합니다.`);
}

// ── 🤝 연합국에 넘기기 ──
/** 넘겨줄 수 있는 연합국(같은 대륙 먼저) */
export function giftTargets(s: GameState, cityId: string): string[] {
  const me = s.player.countryId;
  const c = cityById(cityId);
  const cont = countryById(c.home).continent;
  return COUNTRIES.filter((o) => o.id !== me && o.id !== c.home && isAlive(s.world, o.id) && relationOf(s.world, me, o.id) === '연합')
    .sort((a, b) => Number(b.continent === cont) - Number(a.continent === cont))
    .map((o) => o.id);
}
/** 사례금: max(값어치 × 800, 하루 나라 예산 × 0.3) */
export const giftThanks = (s: GameState, cityId: string) => Math.round(Math.max(followerValue(cityId) * GIFT_THANKS_PER_VALUE, budgetPerDay(s, s.player.countryId) * 0.3));
export function canGift(s: GameState, cityId: string, to: string): string | null {
  const why = canChoose(s, cityId);
  if (why) return why;
  if (!giftTargets(s, cityId).includes(to)) return '연합국이 없어요';
  return null;
}
export function giftCity(s: GameState, cityId: string, to: string): GameState {
  if (canGift(s, cityId, to)) return s;
  const me = s.player.countryId;
  const c = cityById(cityId);
  const w = { ...s.world, owner: { ...s.world.owner }, defense: { ...s.world.defense } };
  noteCapture(w, cityId, to);
  w.owner[cityId] = to;
  w.defense[cityId] = Math.max(w.defense[cityId] ?? 0, 50);
  syncFollowers(w);
  const thanks = giftThanks(s, cityId);
  let out: GameState = setEntry({ ...s, world: w }, cityId, null);
  out = { ...out, nations: { ...out.nations, [me]: { ...out.nations[me], treasury: out.nations[me].treasury + thanks } }, officer: { ...out.officer, fame: out.officer.fame + GIFT_FAME } };
  out = addFavorNote(out, to, `🤝 ${c.name} 넘겨받음`, GIFT_FAVOR);
  if (isAlive(out.world, c.home)) out = addFavorNote(out, c.home, `🤝 ${eul(c.name)} 남에게 줌`, BASE_FAVOR);
  const nm = countryById(to).name;
  return say(out, '🤝', `${eul(c.name)} 연합국 ${nm}에 넘겼어요.`, `대장님, ${eul(c.name)} 연합국 ${nm}에 넘겼습니다. ${nm} 호감 +${GIFT_FAVOR} · 명성 +${GIFT_FAME} · 사례금 나라 예산 +${thanks.toLocaleString('ko-KR')}.`);
}

// ── 💱 도시 맞바꾸기 ──
/** 원래 나라가 가진 우리 땅(맞바꿀 수 있는 곳) */
export function swapTargets(s: GameState, cityId: string): string[] {
  const me = s.player.countryId;
  const home = cityById(cityId).home;
  if (!isAlive(s.world, home)) return [];
  return FRONT.filter((x) => s.world.owner[x.id] === home && homeOf(s.world, x.id) === me).map((x) => x.id);
}
export function canSwap(s: GameState, cityId: string, mine: string): string | null {
  const why = canChoose(s, cityId);
  if (why) return why;
  if (!swapTargets(s, cityId).includes(mine)) return `${countryById(cityById(cityId).home).name}에 빼앗긴 우리 도시가 없어요`;
  return null;
}
export function swapCity(s: GameState, cityId: string, mine: string): GameState {
  if (canSwap(s, cityId, mine)) return s;
  const me = s.player.countryId;
  const c = cityById(cityId);
  const m = cityById(mine);
  const home = c.home;
  const w = { ...s.world, owner: { ...s.world.owner }, defense: { ...s.world.defense }, pairs: { ...s.world.pairs } };
  noteCapture(w, cityId, home);
  w.owner[cityId] = home;
  w.defense[cityId] = Math.max(w.defense[cityId] ?? 0, 50);
  noteCapture(w, mine, me);
  w.owner[mine] = me;
  w.defense[mine] = Math.max(w.defense[mine] ?? 0, 50);
  syncFollowers(w);
  const k = pairKey(me, home);
  const war = w.pairs[k]?.rel === '전쟁';
  if (war) w.pairs[k] = { ...w.pairs[k], rel: '휴전', tension: 20, weariness: 0 };
  let out: GameState = setEntry({ ...s, world: w }, cityId, null);
  out = addFavorNote(out, home, `💱 ${c.name}·${m.name} 맞바꿈`, -PUPPET_FAVOR_HOME / 2);
  const nm = countryById(home).name;
  return say(out, '💱', `${nm}에 ${eul(c.name)} 돌려주고 우리 ${eul(m.name)} 돌려받았어요.${war ? ' 전쟁도 멈췄어요.' : ''}`, `대장님, ${gwa(nm)} 도시를 맞바꿨습니다. ${ga(m.name)} 다시 우리 땅이 됐고, ${eul(c.name)} 돌려줬습니다.${war ? ` ${ga(nm)} 휴전에도 응했습니다.` : ''}`);
}
