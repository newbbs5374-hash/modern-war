// 정치인 발언(11-24 대장 지시: 야당 대표 등의 발언을 더 많이).
// 실제 1~2시간마다 한 명이 지금 나라 형편(전쟁·지지도·의회 신뢰·법·위기)에 맞는 말을 해요.
// 정적(야당 대표·군부 실력자·재벌)은 이름으로, 여당·시민단체·경제계·예비역·논객은 직함으로 말해요.
// 효과는 작아요: 적대 정적 발언 = 영향력 +1~2, 비판 = 의회 신뢰 −1, 칭찬·협력 = 신뢰 +1.
import { approvalOf } from './approval';
import { crisisOf } from './crisis';
import { liveLaws } from './laws';
import { note } from './officer';
import { roleOf, type RivalRole } from './rivals';
import { Rng } from './rng';
import type { GameState } from './state';
import { relationOf } from './world';
import { COUNTRIES } from '../data/world';

const H = 3600e3;
export const REMARK_MIN_MS = 1 * H;
export const REMARK_MAX_MS = 2 * H;

export type Mood = 'war' | 'peace' | 'lowAp' | 'highAp' | 'lowTrust' | 'law' | 'crisis' | 'any';
export type Voice = RivalRole | '여당 원내대표' | '시민단체' | '경제단체장' | '예비역 장성 모임' | '유명 논객';
export interface Line {
  who: Voice;
  mood: Mood;
  text: string;
  /** 의회 신뢰 변화 */
  trust?: number;
  /** 말한 정적의 영향력 변화(적대 정적만) */
  inf?: number;
}

export const VOICE_ICON: Record<Voice, string> = {
  '야당 대표': '🗳️',
  '군부 실력자': '🎖️',
  재벌: '💼',
  '여당 원내대표': '🏛️',
  시민단체: '📢',
  경제단체장: '🏭',
  '예비역 장성 모임': '🪖',
  '유명 논객': '🗞️',
};

const L = (who: Voice, mood: Mood, text: string, trust = 0, inf = 0): Line => ({ who, mood, text, trust, inf });

export const LINES: Line[] = [
  // 야당 대표
  L('야당 대표', 'war', '"이 전쟁은 지도자의 오판이 부른 재앙입니다. 당장 출구 전략을 내놓으세요!"', -1, 2),
  L('야당 대표', 'war', '"젊은이들을 전선에 보내 놓고 정부는 무엇을 했습니까? 국정조사를 요구합니다."', -1, 2),
  L('야당 대표', 'war', '"전쟁 예산은 백지수표가 아닙니다. 한 푼까지 따지겠습니다."', -1, 1),
  L('야당 대표', 'peace', '"평화가 왔다고 방심하면 안 됩니다. 정부는 안보를 소홀히 하고 있어요."', 0, 1),
  L('야당 대표', 'peace', '"외교 성과요? 사진 찍기 외교일 뿐입니다."', -1, 1),
  L('야당 대표', 'lowAp', '"지지도가 바닥입니다. 국민이 등을 돌렸어요. 내각 총사퇴하십시오!"', -1, 2),
  L('야당 대표', 'lowAp', '"민심의 경고를 들으십시오. 재신임 투표에서 심판받을 겁니다."', -1, 2),
  L('야당 대표', 'highAp', '"인기 좀 있다고 독주하면 안 됩니다. 의회를 존중하세요."', 0, 1),
  L('야당 대표', 'lowTrust', '"의회가 이 정부를 믿지 못합니다. 불신임안을 준비하겠습니다."', -1, 2),
  L('야당 대표', 'law', '"졸속 법안을 밀어붙였습니다. 다음 회기에 바로 고치겠습니다."', -1, 1),
  L('야당 대표', 'crisis', '"위기 앞에서 우왕좌왕! 이게 정부입니까?"', -1, 2),
  L('야당 대표', 'any', '"장관 인사가 엉망입니다. 회전문 인사를 멈추세요."', -1, 1),
  L('야당 대표', 'any', '"물가는 오르는데 정부는 남의 나라 일만 합니다."', -1, 1),
  L('야당 대표', 'any', '"예산안, 이대로는 통과 못 시킵니다."', -1, 1),
  L('야당 대표', 'any', '"지도자는 기자회견을 피하지 말고 국민 앞에 서십시오."', 0, 1),
  // 군부 실력자
  L('군부 실력자', 'war', '"전선 장병들은 탄약이 모자라다고 아우성입니다. 정치인들은 뭘 하는 겁니까?"', -1, 2),
  L('군부 실력자', 'war', '"군의 작전에 정치가 끼어들면 집니다."', 0, 1),
  L('군부 실력자', 'peace', '"평화 무드에 군 예산을 깎는다? 위험한 발상입니다."', 0, 1),
  L('군부 실력자', 'any', '"장성 인사는 실력으로 해야지, 줄 서기로 하면 안 됩니다."', -1, 1),
  L('군부 실력자', 'any', '"요즘 군 기강이 해이해졌다는 말이 많습니다."', 0, 1),
  // 재벌
  L('재벌', 'war', '"전쟁이 길어지면 수출 길이 막힙니다. 경제를 생각하십시오."', -1, 1),
  L('재벌', 'peace', '"평화가 곧 돈입니다. 규제부터 풀어 주시죠."', 0, 1),
  L('재벌', 'lowAp', '"정부가 흔들리니 투자자들이 떠납니다."', -1, 1),
  L('재벌', 'any', '"세금이 너무 높아요. 이러면 공장을 해외로 옮길 수밖에 없습니다."', 0, 2),
  L('재벌', 'any', '"정부 사업, 우리 그룹이 맡으면 더 잘할 수 있습니다."', 0, 1),
  // 여당 원내대표(지도자 편)
  L('여당 원내대표', 'war', '"지금은 하나로 뭉칠 때입니다. 정부를 믿고 힘을 모아 주십시오."', 1),
  L('여당 원내대표', 'highAp', '"국민께서 정부의 노력을 알아주고 계십니다."', 1),
  L('여당 원내대표', 'lowAp', '"쓴소리도 약으로 삼겠습니다. 당이 먼저 바뀌겠습니다."', 0),
  L('여당 원내대표', 'law', '"이번 법은 국민 삶을 바꿀 겁니다. 야당도 협조해 주십시오."', 1),
  L('여당 원내대표', 'lowTrust', '"의원님들, 지도자에게 한 번 더 기회를 줍시다."', 1),
  L('여당 원내대표', 'any', '"예산안은 이번 주 안에 처리하겠습니다."', 1),
  // 시민단체
  L('시민단체', 'war', '"전쟁을 멈춰라! 광장에 시민 수만 명이 모였습니다."', -1),
  L('시민단체', 'war', '"피란민 지원 예산을 늘려 주십시오."', 0),
  L('시민단체', 'lowAp', '"정부는 민생을 돌보라! 촛불 집회가 열렸어요."', -1),
  L('시민단체', 'crisis', '"재난 대응이 늦습니다. 진상을 밝혀 주세요."', -1),
  L('시민단체', 'any', '"환경을 지키며 성장해야 합니다."', 0),
  // 경제단체장
  L('경제단체장', 'war', '"원자재값이 폭등했습니다. 긴급 지원이 필요합니다."', 0),
  L('경제단체장', 'peace', '"수출이 살아나고 있습니다. 무역 협정을 더 맺어 주십시오."', 1),
  L('경제단체장', 'any', '"외국 관세 압박에 정부가 더 강하게 대응해야 합니다."', 0),
  // 예비역 장성 모임
  L('예비역 장성 모임', 'war', '"국가가 위기입니다. 예비역도 다시 군복을 입겠습니다!"', 1),
  L('예비역 장성 모임', 'peace', '"적은 쉬지 않습니다. 군 복무 기간을 줄이면 안 됩니다."', 0),
  L('예비역 장성 모임', 'any', '"북방 경계가 약해졌다는 보고가 있습니다."', 0),
  // 유명 논객
  L('유명 논객', 'highAp', '"솔직히 이번 지도자, 생각보다 잘하고 있어요."', 1),
  L('유명 논객', 'lowAp', '"지도자의 말과 행동이 다릅니다. 이러면 신뢰를 잃죠."', -1),
  L('유명 논객', 'war', '"이 전쟁, 누가 이기든 우리 경제는 집니다."', 0),
  L('유명 논객', 'law', '"새 법, 좋은 취지인데 현장 준비가 덜 됐어요."', 0),
  L('유명 논객', 'any', '"야당도 대안 없이 반대만 하면 안 됩니다."', 1),
];

export interface Remark {
  t: number;
  who: Voice;
  name?: string;
  text: string;
}
export interface RemarkState {
  nextMs: number;
  log: Remark[];
}
export const remarksOf = (s: GameState): RemarkState => s.remarks ?? { nextMs: s.worldMs + REMARK_MIN_MS, log: [] };

/** 지금 나라 형편 */
export function moodsOf(s: GameState): Mood[] {
  const me = s.player.countryId;
  const war = COUNTRIES.some((c) => c.id !== me && relationOf(s.world, me, c.id) === '전쟁');
  const ap = approvalOf(s);
  const out: Mood[] = ['any', war ? 'war' : 'peace'];
  if (ap < 45) out.push('lowAp');
  if (ap > 65) out.push('highAp');
  if (s.officer.trust < 40) out.push('lowTrust');
  if (liveLaws(s).length) out.push('law');
  if (crisisOf(s).open) out.push('crisis');
  return out;
}

/** 한 마디 고르기(정적은 이름이 있는 사람으로, 내 편이 된 정적은 비판 대신 협력 발언) */
export function pickRemark(s: GameState, rng: Rng): { line: Line; name?: string; ally: boolean } | null {
  const moods = moodsOf(s);
  const pool = LINES.filter((l) => moods.includes(l.mood));
  // 상황 발언(any가 아닌 것)을 더 자주
  const weighted = pool.flatMap((l) => (l.mood === 'any' ? [l] : [l, l]));
  if (!weighted.length) return null;
  const line = rng.pick(weighted);
  const rv = s.officer.rivals.map((r, i) => ({ r, role: roleOf(r, i) })).find((x) => x.role === line.who);
  if (rv?.r.ally) return { line: { ...line, text: ALLY_LINE[rv.role], trust: 1, inf: 0 }, name: rv.r.name, ally: true };
  return { line, name: rv?.r.name, ally: false };
}
const ALLY_LINE: Record<RivalRole, string> = {
  '야당 대표': '"이번만큼은 정부 안에 찬성합니다. 나라가 먼저입니다."',
  '군부 실력자': '"군은 지도자를 믿고 따릅니다."',
  재벌: '"우리 그룹도 정부 정책에 힘을 보태겠습니다."',
};

/** 시간이 흐를 때: 때가 되면 한 마디 */
export function remarksTick(s: GameState): GameState {
  if (s.ending) return s;
  const st = remarksOf(s);
  if (s.worldMs < st.nextMs) return s.remarks ? s : { ...s, remarks: st };
  const rng = new Rng((Math.floor(st.nextMs / 60000) * 2654435761 + s.world.seed) >>> 0);
  const nextMs = s.worldMs + rng.range(REMARK_MIN_MS, REMARK_MAX_MS);
  const got = pickRemark(s, rng);
  if (!got) return { ...s, remarks: { ...st, nextMs } };
  const { line, name } = got;
  const o = structuredClone(s.officer);
  if (line.trust) o.trust = Math.max(0, Math.min(100, o.trust + line.trust));
  if (line.inf && name) {
    const rv = o.rivals.find((r) => r.name === name);
    if (rv && !rv.ally) rv.influence = Math.max(0, Math.min(100, (rv.influence ?? 0) + line.inf));
  }
  const who = name ? `${line.who} ${name}` : line.who;
  const eff = [line.trust ? `의회 신뢰 ${line.trust > 0 ? '+' : ''}${line.trust}` : '', line.inf && name && !got.ally ? `영향력 +${line.inf}` : ''].filter(Boolean).join(' · ');
  const ns: GameState = { ...s, officer: o, world: { ...s.world, events: [...s.world.events] }, remarks: { nextMs, log: [{ t: s.worldMs, who: line.who, name, text: line.text }, ...st.log].slice(0, 20) } };
  note(ns, `${VOICE_ICON[line.who]} ${who}: ${line.text}${eff ? ` (${eff})` : ''}`);
  return ns;
}
