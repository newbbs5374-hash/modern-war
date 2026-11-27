// 11-27 종합 확장안 내정 5: 정상회담과 국빈 방문.
// 버튼 한 번이던 정상회담을 3단계 대화(인사 → 의제 → 마무리)로 바꿈.
// 단계마다 상대 정상이 한마디 하고, 그 말에 맞는 태도(따뜻하게 · 실리로 · 당당하게)를 고르면 점수가 오름.
// 점수 6 이상 = 큰 협정(호감·명성 1.5배 + 사흘 협정 효과), 4~5 = 합의(지금의 성공), 3 이하 = 결렬.
// 방식: 국빈 초청(돈이 들고 점수 +1 · 지지도 +2) / 찾아가기(무료 · 호감 +4).
import { COUNTRIES } from '../data/world';
import { LEADERS, type Personality } from '../data/leaders';
import { addPresMod } from './approval';
import { addFavorNote } from './civ';
import { canSummit, holdSummit, mediaOf, summitChance, type Agenda } from './media';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';

export type Tone = 'warm' | 'deal' | 'firm';
export type Mode = 'invite' | 'visit';
export const TONES: Tone[] = ['warm', 'deal', 'firm'];
export const TONE_INFO: Record<Tone, { icon: string; name: string }> = {
  warm: { icon: '😊', name: '따뜻하게' },
  deal: { icon: '💼', name: '실리로' },
  firm: { icon: '🦁', name: '당당하게' },
};
export const STAGES = ['인사', '의제', '마무리'] as const;
/** 국빈 초청 비용(하루 예산의 몫) */
export const INVITE_COST = 0.15;
export const INVITE_APPROVAL = 2;
export const VISIT_FAVOR = 4;
/** 큰 협정 효과가 가는 시간 */
export const PACT_H = 72;

/** 성향마다 좋아하는 태도 */
const LIKES: Record<Personality, Tone> = { 공격형: 'firm', 방어형: 'warm', 경제형: 'deal', 기회주의: 'deal' };

/** 상대 정상의 한마디: [단계][바라는 태도] */
const THEIR: Record<Tone, string>[] = [
  {
    warm: '먼 길 오느라 고생하셨소. 오늘은 일 얘기보다 서로를 먼저 알아 갑시다.',
    deal: '반갑소. 서로 바쁜 사람들이니 인사는 짧게 하고 본론으로 갑시다.',
    firm: '당신 소문은 들었소. 듣던 대로 배짱이 있는 사람인지 보고 싶군.',
  },
  {
    warm: '우리 국민들은 당신 나라를 아직 잘 모르오. 믿음이 먼저 쌓여야 하지 않겠소?',
    deal: '좋은 말은 많이 들었소. 그래서 우리가 얻는 게 정확히 뭐요?',
    firm: '우리는 약한 나라와는 손잡지 않소. 당신들이 지킬 힘이 있는지 묻고 싶소.',
  },
  {
    warm: '오늘 이야기가 종이 한 장으로 끝나지 않았으면 하오. 다음에도 만납시다.',
    deal: '좋소. 숫자와 날짜를 적어서 서명합시다. 흐릿한 건 싫소.',
    firm: '기자들이 밖에서 기다리오. 누가 양보했는지 보이면 곤란하오.',
  },
];
/** 내 대답: [단계][태도] */
export const MINE: Record<Tone, string>[] = [
  { warm: '초대해 주셔서 고맙습니다. 가족 이야기부터 들려주시죠.', deal: '시간이 금이지요. 바로 의제로 들어갑시다.', firm: '우리는 빈손으로 다니는 나라가 아닙니다. 대등하게 이야기합시다.' },
  { warm: '두 나라 사람들이 서로 오가게 하는 것부터 시작합시다.', deal: '이 조건이면 두 나라 모두 이익입니다. 숫자를 보시지요.', firm: '우리는 약속을 지킬 힘이 있습니다. 그건 걱정하지 않으셔도 됩니다.' },
  { warm: '다음에는 제가 모시겠습니다. 오래 가는 친구가 됩시다.', deal: '문서로 남깁시다. 날짜와 숫자까지 다 적어서요.', firm: '두 나라 모두 당당히 얻어 간 회담이라고 발표합시다.' },
];

export const leaderLikes = (id: string): Tone => LIKES[LEADERS[id]?.personality ?? '방어형'];

/** 이번 회담에서 상대가 단계마다 바라는 태도(회담 전에 정해짐: 60%는 성향대로) */
export function talkWants(s: GameState, to: string): Tone[] {
  const rng = new Rng((mediaOf(s).seed ^ (to.charCodeAt(0) * 7919 + to.charCodeAt(1) * 104729)) >>> 0);
  const like = leaderLikes(to);
  return STAGES.map(() => (rng.chance(0.6) ? like : rng.pick(TONES.filter((t) => t !== like))!));
}
export const theirLine = (want: Tone, step: number) => THEIR[step]?.[want] ?? '';

/** 한 단계 점수: 딱 맞으면 2, 따뜻하게는 틀려도 1(무난), 그 밖은 0 */
export const stepScore = (want: Tone, pick: Tone) => (want === pick ? 2 : pick === 'warm' ? 1 : 0);

export function inviteCost(s: GameState): number {
  return Math.round(priceBase(s) * INVITE_COST);
}
export function canTalk(s: GameState, to: string, mode: Mode): string | null {
  const why = canSummit(s, to);
  if (why) return why;
  if (mode === 'invite' && s.nations[s.player.countryId].treasury < inviteCost(s)) return '국빈 초청에 쓸 나라 예산이 모자라요';
  return null;
}

export type Grade = 'big' | 'ok' | 'fail';
export function talkScore(s: GameState, to: string, mode: Mode, picks: Tone[], w: Tone[] = talkWants(s, to)): number {
  let v = picks.reduce((a, p, i) => a + stepScore(w[i], p), 0);
  if (mode === 'invite') v += 1;
  if (summitChance(s, to) >= 0.7) v += 1; // 평소 사이가 좋으면 덤
  return v;
}
export const gradeOfTalk = (score: number): Grade => (score >= 6 ? 'big' : score >= 4 ? 'ok' : 'fail');

/** 3단계 대화를 마치고 결과 내기 */
/** wants = 회담을 시작할 때 본 「바라는 태도」(대화 도중 시간이 흘러도 바뀌지 않게 화면이 들고 있음) */
export function finishTalk(s: GameState, to: string, ag: Agenda, mode: Mode, picks: Tone[], wants?: Tone[]): { state: GameState; text: string; grade: Grade } {
  if (canTalk(s, to, mode) || picks.length < STAGES.length) return { state: s, text: '', grade: 'fail' };
  const me = s.player.countryId;
  const grade = gradeOfTalk(talkScore(s, to, mode, picks, wants));
  let ns = s;
  if (mode === 'invite') ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury - inviteCost(s) } } };
  const r = holdSummit(ns, to, ag, { ok: grade !== 'fail', big: grade === 'big' });
  ns = r.state;
  let text = r.text;
  const name = COUNTRIES.find((c) => c.id === to)?.name ?? '';
  if (grade !== 'fail') {
    if (mode === 'invite') {
      ns = addPresMod(ns, `🎌 ${name} 국빈 방문`, INVITE_APPROVAL, 24);
      text += ` · 국빈 방문 지지도 +${INVITE_APPROVAL}`;
    } else {
      ns = addFavorNote(ns, to, '✈️ 직접 찾아옴', VISIT_FAVOR);
      text += ` · 찾아간 덤 호감 +${VISIT_FAVOR}`;
    }
    if (grade === 'big') {
      ns = addPresMod(ns, `📜 ${name}와(과) 큰 협정`, 3, PACT_H);
      text += ` · 큰 협정 지지도 +3(${PACT_H / 24}일)`;
    }
  }
  return { state: ns, text, grade };
}
