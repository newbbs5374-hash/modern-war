// 국정 보고서(11-23 기획 ⑩): 본부에서 여는 하루 요약. 지지도·신뢰도 변화, 가장 든든한/약한 분야, 무엇 때문인지 3줄, 오늘 할 일.
import { FIELDS, approvalRows, fieldScores, presOf, type FieldId } from './approval';
import { assemblyOf } from './assembly';
import { cabinetOf, ministerCount } from './cabinet';
import { ministerSlots } from '../data/cabinet';
import { liveLaws } from './laws';
import { mediaOf } from './media';
import { scheduleOf } from './schedule';
import type { GameState } from './state';

const H = 3600e3;
const r0 = (v: number) => Math.round(v);
const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);

export interface Todo {
  icon: string;
  text: string;
  /** 갈 화면·탭 */
  go: { screen: string; key: string; tab: string };
}
export interface Briefing {
  approval: number;
  trust: number;
  dA: number | null;
  dT: number | null;
  best: { id: FieldId; name: string; icon: string; v: number };
  worst: { id: FieldId; name: string; icon: string; v: number };
  lines: string[];
  todos: Todo[];
}

const ADVICE: Record<FieldId, string> = {
  personal: '대통령 일정(휴식·언론 인터뷰)이나 훈련으로 평판을 올려 보세요.',
  defense: '국방 예산을 늘리거나 군부대 시찰·국방부 업무를 해 보세요.',
  diplo: '정상회담이나 외교부 특사 파견으로 관계를 풀어 보세요.',
  society: '국민 청원을 들어주거나 현장 방문·복지 법안을 써 보세요.',
  economy: '경제인 간담회나 기재부 경기 부양, 무역 법안이 도움이 돼요.',
};

export function briefing(s: GameState): Briefing {
  const p = presOf(s);
  const day = p.hist.filter((h) => h.t <= s.worldMs - 24 * H + H).pop() ?? p.hist[0] ?? null;
  const sc = fieldScores(s);
  const list = FIELDS.map((f) => ({ id: f.id, name: f.name, icon: f.icon, v: sc[f.id] }));
  const best = [...list].sort((a, b) => b.v - a.v)[0];
  const worst = [...list].sort((a, b) => a.v - b.v)[0];
  const lines: string[] = [];
  const dA = day ? r0(p.approval - day.a) : null;
  lines.push(
    dA === null
      ? `지도자님, 지지도는 ${r0(p.approval)}, 신뢰도는 ${r0(s.officer.trust)}입니다.`
      : `지도자님, 지지도는 ${r0(p.approval)}(어제보다 ${sign(dA)}), 신뢰도는 ${r0(s.officer.trust)}입니다.`,
  );
  lines.push(`가장 든든한 곳은 ${best.icon} ${best.name}(${best.v}), 가장 약한 곳은 ${worst.icon} ${worst.name}(${worst.v})입니다. ${ADVICE[worst.id]}`);
  const extra = approvalRows(s)
    .filter(([k]) => !FIELDS.some((f) => k.startsWith(`${f.icon} ${f.name}`)))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2);
  if (extra.length) lines.push(`지지도를 움직이는 것: ${extra.map(([k, v]) => `${k} ${sign(r0(v))}`).join(', ')}.`);
  else lines.push('지금은 지지도를 크게 흔드는 일이 없어요. 차분하게 나라를 돌볼 때입니다.');
  return { approval: r0(p.approval), trust: r0(s.officer.trust), dA, dT: day ? r0(s.officer.trust - day.tr) : null, best, worst, lines, todos: todos(s) };
}

export function todos(s: GameState): Todo[] {
  const out: Todo[] = [];
  const sch = scheduleOf(s);
  const left = sch.slots.filter((x) => !x).length;
  if (left) out.push({ icon: '📅', text: `대통령 일정 ${left}칸이 비었어요`, go: { screen: 'personal', key: 'personal', tab: 'plan' } });
  const m = mediaOf(s);
  if (m.petitions.length) out.push({ icon: '📝', text: `국민 청원 ${m.petitions.length}개가 기다려요`, go: { screen: 'society', key: 'society', tab: 'press' } });
  if (!m.press && s.worldMs >= m.pressMs) out.push({ icon: '🎙️', text: '기자회견을 열 수 있어요', go: { screen: 'society', key: 'society', tab: 'press' } });
  if (s.worldMs >= m.summitMs) out.push({ icon: '🤝', text: '오늘 정상회담을 할 수 있어요', go: { screen: 'diplo', key: 'diplo', tab: 'mofa' } });
  const a = assemblyOf(s);
  if (!a.vote && liveLaws(s).length < 4) out.push({ icon: '📜', text: '국회에 낼 법안이 있어요', go: { screen: 'society', key: 'society', tab: 'politics' } });
  if (a.confMs - s.worldMs <= 48 * H) out.push({ icon: '🗳️', text: `재신임 투표가 ${Math.max(1, Math.ceil((a.confMs - s.worldMs) / H))}시간 남았어요`, go: { screen: 'society', key: 'society', tab: 'politics' } });
  if (s.cabinet) {
    const c = cabinetOf(s);
    const empty = ministerSlots(s.player.rankIndex) - ministerCount(c) - (c.hearing ? 1 : 0);
    if (empty > 0) out.push({ icon: '🏛️', text: `장관 자리 ${empty}석이 비었어요`, go: { screen: 'personal', key: 'personal', tab: 'talent' } });
    const doneT = Object.values(c.tasks).filter((t) => t && s.worldMs >= t.endMs).length;
    if (doneT) out.push({ icon: '✅', text: `부처 업무 ${doneT}개가 곧 끝나요`, go: { screen: 'society', key: 'society', tab: 'mins' } });
  }
  if (presOf(s).impeachMs) out.push({ icon: '⚠️', text: '탄핵 위기! 지지도를 30 넘게 올려야 해요', go: { screen: 'society', key: 'society', tab: 'press' } });
  return out;
}
