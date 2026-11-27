// 11-27 한 손가락 미니 훈련 "고르기": 문제 만들기(화면 없이 시험 가능).
// 한 문제 = 상황 글 + 보기 3개 + 정답 하나 + 까닭.
import type { Rng } from '../game/rng';

export interface Quiz { head?: string; q: string; opts: string[]; ok: number; why: string }
export type QuizKind = 'disguise' | 'predict' | 'review' | 'mole' | 'mind' | 'speech' | 'judge' | 'school';
export const QUIZ_INFO: Record<QuizKind, { scene: string; night?: boolean; ask: string }> = {
  disguise: { scene: 'port', night: true, ask: '변장에 맞는 대답을 골라요' },
  predict: { scene: 'cabinet', ask: '적이 다음에 할 일을 골라요' },
  review: { scene: 'meeting', ask: '잘못된 결정 하나를 골라요' },
  mole: { scene: 'cabinet', night: true, ask: '수상한 한 사람을 골라요' },
  mind: { scene: 'press', ask: '이 글 다음에 할 행동을 골라요' },
  speech: { scene: 'parade', ask: '지금 병사들에게 맞는 말을 골라요' },
  judge: { scene: 'meeting', ask: '공정한 판정을 골라요' },
  school: { scene: 'school', ask: '좋은 대답을 골라요' },
};

const pickN = <T>(rng: Rng, list: T[], n: number): T[] => {
  const a = [...list];
  const out: T[] = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rng.next() * a.length), 1)[0]);
  return out;
};
/** 정답(첫째)과 오답 둘을 섞어 문제로 */
function mix(rng: Rng, q: string, right: string, wrong: string[], why: string, head?: string): Quiz {
  const opts = [right, ...wrong.slice(0, 2)];
  const order = pickN(rng, [0, 1, 2], 3);
  return { head, q, opts: order.map((i) => opts[i]), ok: order.indexOf(0), why };
}

// ── 변장 통과 ──
const ROLES = [
  { name: '수리 기사', pass: '시설과 출입증', why: '"3번 발전기가 멈췄다고 해서 고치러 왔습니다."', boss: '"시설과장님 호출입니다."' },
  { name: '식당 납품 기사', pass: '급식 납품 확인서', why: '"오늘 저녁 식재료를 내리러 왔습니다."', boss: '"급양대 보급관님이 부르셨습니다."' },
  { name: '통신병', pass: '통신대 근무증', why: '"안테나 선이 끊겨 점검하러 왔습니다."', boss: '"통신대장님 지시입니다."' },
  { name: '위생병', pass: '의무대 근무증', why: '"의무실 약품을 채우러 왔습니다."', boss: '"군의관님이 보내셨습니다."' },
  { name: '청소 용역', pass: '용역 업체 출입증', why: '"본관 2층 청소 시간입니다."', boss: '"관리실 반장님이 보내셨습니다."' },
];
function disguise(rng: Rng): Quiz {
  const [me, a, b] = pickN(rng, ROLES, 3);
  const head = `내 변장: ${me.name} · 가진 것: ${me.pass}`;
  return rng.chance(0.5)
    ? mix(rng, '검문병: "무슨 일로 왔나?"', me.why, [a.why, b.why], `${me.name}에 맞는 대답`, head)
    : mix(rng, '검문병: "누구 지시로 왔나?"', me.boss, [a.boss, b.boss], `${me.name}의 윗사람`, head);
}

// ── 한 수 앞 읽기 ──
const PREDICT: Array<[string, string, string[], string]> = [
  ['적 보급로가 이틀째 끊겼습니다. 앞쪽 진지에는 탄약이 얼마 없습니다.', '밤에 조용히 물러난다', ['정면으로 총공격한다', '그 자리에서 열병식을 한다'], '탄이 없으면 싸움을 피해요'],
  ['우리 왼쪽이 비어 있고, 적 전차가 그쪽 숲에 모이고 있습니다.', '왼쪽으로 돌아 들어온다', ['가운데로 곧장 온다', '전차를 뒤로 뺀다'], '빈 곳에 힘을 모으면 그리로 와요'],
  ['적 포병이 갑자기 조용해졌고, 보병이 참호에서 나오고 있습니다.', '곧 보병이 돌격한다', ['포격을 다시 시작한다', '휴전을 청한다'], '포를 멈추는 것은 아군 보병이 나가기 때문'],
  ['적 수송기가 우리 뒤쪽 비행장 위를 낮게 돌고 있습니다.', '공수부대를 떨어뜨린다', ['전단을 뿌리고 돌아간다', '비행장에 착륙해 항복한다'], '뒤쪽 비행장을 노린 강하'],
  ['강 건너 적이 밤새 고무보트와 다리 자재를 날랐습니다.', '새벽에 강을 건넌다', ['강을 따라 물러난다', '다리를 스스로 폭파한다'], '도하 장비가 모이면 곧 건너와요'],
  ['적 지휘소 무전이 평소의 세 배로 늘었습니다. 전선은 조용합니다.', '큰 작전을 준비하고 있다', ['부대를 해산하고 있다', '아무 일도 없다'], '무전이 늘면 움직임이 임박'],
  ['적 정찰 드론이 우리 탄약고 위만 세 번 지나갔습니다.', '탄약고를 포격한다', ['드론을 팔려고 한다', '탄약고를 지켜 주려 한다'], '같은 곳을 거듭 보면 표적'],
  ['적이 고지를 빼앗긴 뒤 그 뒤쪽 숲에 예비대를 모았습니다.', '고지를 되찾으러 반격한다', ['숲에서 겨울을 난다', '예비대를 집에 보낸다'], '뺏긴 고지는 곧바로 되찾으려 해요'],
  ['적 함대가 연료를 가득 싣고 항구를 떠났습니다. 상륙함이 섞여 있습니다.', '어딘가에 상륙한다', ['먼바다에서 낚시한다', '항구로 곧 돌아온다'], '상륙함이 나오면 상륙'],
];
// ── 적 속마음 읽기 ──
const MIND: Array<[string, string, string[], string]> = [
  ['"우리의 인내심에도 끝이 있다. 국경의 도발을 더는 두고 보지 않겠다."', '국경에 부대를 늘린다', ['관세를 내린다', '정상회담을 청한다'], '경고 뒤에는 무력 시위'],
  ['"이웃과 함께 번영하는 길을 찾고 싶다. 문은 열려 있다."', '교역 협정을 제안한다', ['선전포고한다', '대사를 쫓아낸다'], '손을 내미는 글'],
  ['"배신자에게는 값을 치르게 할 것이다. 어제의 친구는 오늘의 적."', '연합을 깨고 관세를 올린다', ['군사 원조를 보낸다', '사과문을 낸다'], '배신을 말하면 관계를 끊어요'],
  ['"우리 과학자들이 역사를 새로 썼다. 곧 세계가 보게 될 것이다."', '새 무기 시험을 한다', ['군대를 줄인다', '올림픽을 연다'], '기술 자랑 뒤에는 시험'],
  ['"국민 여러분, 허리띠를 조금만 더 졸라매 주십시오."', '국방비를 줄이고 휴전을 찾는다', ['새 전쟁을 건다', '세금을 없앤다'], '살림이 어려우면 싸움을 줄여요'],
  ['"바다는 누구의 것도 아니지만, 지키는 자의 것이다."', '분쟁 섬에 함대를 보낸다', ['어선을 판다', '해군을 해산한다'], '바다 이야기는 섬·함대'],
  ['"그 나라 지도자는 광대다. 국민이 불쌍하다."', '헐뜯기를 이어 가며 관계가 나빠진다', ['동맹을 맺는다', '원조를 보낸다'], '비난은 관계 악화의 신호'],
  ['"형제의 나라가 공격받으면 우리도 가만있지 않겠다."', '연합국 전쟁에 끼어든다', ['중립을 선언한다', '국경을 닫는다'], '동맹 지원을 예고'],
];
// ── 훈시 한마디 ──
const MOODS = [
  { mood: '사흘 밤을 새워 모두 눈이 풀려 있습니다.', say: '"오늘 밤은 교대로 잔다. 쉬는 것도 임무다."', why: '지쳤을 때는 쉬게' },
  { mood: '첫 전투를 앞두고 신병들이 떨고 있습니다.', say: '"나도 처음엔 떨었다. 옆 사람만 믿고 배운 대로만 해라."', why: '겁날 때는 믿음을' },
  { mood: '큰 승리 뒤에 다들 들떠 경계가 풀렸습니다.', say: '"잘 싸웠다. 하지만 전쟁은 안 끝났다. 초소부터 다시 세운다."', why: '들떴을 때는 다잡기' },
  { mood: '전우를 잃고 분노로 무작정 돌격하려 합니다.', say: '"그 마음 안다. 그래서 더 차갑게, 계획대로 간다."', why: '분노는 가라앉히기' },
  { mood: '보급이 늦어 불만이 터져 나옵니다.', say: '"보급은 내가 책임지고 내일까지 끌어온다. 숨기지 않겠다."', why: '불만에는 책임 있는 약속' },
  { mood: '패배 뒤에 고개를 떨구고 말이 없습니다.', say: '"진 것은 내 책임이다. 살아남은 너희가 다음을 이긴다."', why: '졌을 때는 책임을 지고 세워 주기' },
];
function speech(rng: Rng): Quiz {
  const [m, a, b] = pickN(rng, MOODS, 3);
  return mix(rng, m.mood, m.say, [a.say, b.say], m.why);
}
// ── 다툼 풀기 ──
const JUDGE: Array<[string, string, string[], string]> = [
  ['김 중사: "제가 세운 작전인데 박 대위가 자기 이름으로 올렸습니다." 박 대위: "보고는 제 일입니다."', '작전 기록을 확인하고 공을 세운 사람 이름을 밝힌다', ['계급 높은 박 대위 말만 듣는다', '둘 다 벌준다'], '사실을 확인하고 공을 돌려요'],
  ['이 하사: "야간 근무가 저한테만 몰립니다." 최 상사: "잘하니까 맡기는 겁니다."', '근무표를 보고 고르게 다시 짠다', ['잘하니 계속 시킨다', '불평했으니 근무를 더 준다'], '짐은 고르게'],
  ['보급관: "탄약을 2중대가 더 가져갔습니다." 2중대장: "우리가 전방입니다."', '쓴 양과 필요를 따져 다시 나눈다', ['목소리 큰 쪽에 준다', '둘 다 탄약을 뺏는다'], '필요에 따라 나눠요'],
  ['정 병장: "신병이 명령을 안 따릅니다." 신병: "욕을 하고 때리려 했습니다."', '둘을 따로 불러 듣고, 폭언은 처벌하고 명령 체계는 세운다', ['신병 말은 듣지 않는다', '병장을 바로 내쫓는다'], '양쪽을 듣고 잘못만 벌해요'],
  ['참모 A: "제 정보가 맞았습니다." 참모 B: "운이 좋았을 뿐입니다."', '근거를 다시 살펴 좋은 판단 방법을 함께 정한다', ['A만 승진시킨다', '둘의 말다툼을 구경한다'], '결과보다 근거'],
  ['운전병: "차가 낡아 사고가 났습니다." 정비관: "운전 미숙입니다."', '차량 정비 기록과 사고 경위를 함께 조사한다', ['운전병에게 물어내게 한다', '정비관을 바꾼다'], '기록으로 따져요'],
];
// ── 학교 방문 ──
const SCHOOL: Array<[string, string, string[], string]> = [
  ['학생: "군대는 왜 가야 해요?"', '"가족과 이웃을 지킬 사람이 필요해서예요. 그 대신 나라가 여러분을 책임져야 하고요."', ['"법이 그러니까요. 다음 질문."', '"안 가면 큰일 나요."'], '까닭과 책임을 함께'],
  ['학생: "전쟁 나면 우리도 죽어요?"', '"그런 일이 없게 하려고 대비하는 거예요. 대피하는 법은 오늘 같이 배워요."', ['"걱정 마요, 절대 안 나요."', '"그건 비밀이에요."'], '솔직하게, 할 수 있는 일을 알려 줘요'],
  ['학생: "군인 월급은 얼마예요?"', '"계급마다 달라요. 병사 봉급도 올리고 있고, 표를 보여 줄게요."', ['"돈 얘기는 어른들 일이에요."', '"엄청 많아요!"'], '숨기지 않고 사실대로'],
  ['학생: "훈련하다 다치면 어떡해요?"', '"군 병원에서 끝까지 치료하고 보상해요. 모자란 점은 고치고 있어요."', ['"다치는 사람은 없어요."', '"조심하면 돼요."'], '사실과 고칠 점을 함께'],
  ['학생: "여자도 장군이 될 수 있어요?"', '"그럼요. 실력으로 뽑아요. 지금도 여러 분이 있어요."', ['"글쎄, 어려울걸요."', '"그건 나중에 생각해요."'], '기회는 같다고 분명히'],
  ['학생: "대통령은 무서운 거 없어요?"', '"있어요. 잘못된 결정을 할까 봐 무서워요. 그래서 많이 듣고 물어봐요."', ['"없어요. 나는 다 알아요."', '"그런 건 묻는 게 아니에요."'], '솔직함이 믿음을 줘요'],
  ['학생: "옆 나라는 나쁜 나라예요?"', '"나라와 사람은 달라요. 정부끼리 다퉈도 그 나라 친구들을 미워하지는 않아요."', ['"네, 아주 나빠요."', '"모르는 게 좋아요."'], '미움을 가르치지 않기'],
  ['학생: "드론 조종사가 되려면요?"', '"수학과 영어를 열심히 하고, 군 기술 학교에 지원하면 돼요. 안내 책자를 줄게요."', ['"게임만 많이 하면 돼요."', '"아무나 못 해요."'], '구체적인 길을 알려 줘요'],
];
// ── 지난 전투 다시 보기 ──
const GOOD = ['정찰을 먼저 보내 적 위치를 확인했다', '포격이 끝난 뒤에 보병을 움직였다', '예비대를 뒤에 남겨 두었다', '측면에 대전차 조를 세웠다', '보급로에 경계 부대를 두었다', '고지를 먼저 잡고 관측소를 세웠다', '연막을 깔고 다리를 건넜다', '공군 지원 시간을 맞춰 돌격했다'];
const BAD = ['정찰 없이 숲으로 전차를 밀어 넣었다', '예비대까지 처음부터 다 넣었다', '보급 차량을 호위 없이 보냈다', '포병을 최전선 바로 뒤에 모아 두었다', '지친 부대를 쉬게 하지 않고 다시 돌격시켰다', '측면을 비워 두고 가운데만 밀었다', '무전을 암호 없이 썼다', '밤에 불을 켜고 행군했다'];
function review(rng: Rng): Quiz {
  const g = pickN(rng, GOOD, 2), b = rng.pick(BAD);
  return mix(rng, '지난 전투 기록입니다. 셋 가운데 잘못된 결정은?', b, g, '이 결정 때문에 피해가 커졌어요');
}
// ── 이중간첩 찾기 ──
const NAMES = ['강 서기관', '윤 소령', '한 주무관', '서 대위', '문 분석관', '오 통신관'];
const CLEAN = ['매일 같은 시각에 퇴근', '주말에 가족과 등산', '보고서를 제때 냄', '휴가 때 고향 방문', '동료와 점심', '야근 뒤 숙소로 바로 감', '운동 동호회 참석'];
const DIRTY = ['기밀 열람 뒤 밤에 혼자 외출', '봉급의 다섯 배짜리 차를 삼', '담당이 아닌 서류를 복사', '외국 번호와 새벽 통화', '보안 카메라 사각에서 자주 머묾', '갑자기 큰 빚을 다 갚음'];
function mole(rng: Rng): Quiz {
  const who = pickN(rng, NAMES, 3), clean = pickN(rng, CLEAN, 5), dirty = rng.pick(DIRTY);
  const lines = [`${who[0]}: ${clean[0]} · ${dirty}`, `${who[1]}: ${clean[1]} · ${clean[2]}`, `${who[2]}: ${clean[3]} · ${clean[4]}`];
  return mix(rng, '세 사람의 지난 한 달 행적입니다.', lines[0], [lines[1], lines[2]], dirty);
}

const fromBank = (rng: Rng, bank: Array<[string, string, string[], string]>): Quiz => {
  const [q, r, w, why] = rng.pick(bank);
  return mix(rng, q, r, w, why);
};
export function quizRound(kind: QuizKind, rng: Rng): Quiz {
  switch (kind) {
    case 'disguise': return disguise(rng);
    case 'predict': return fromBank(rng, PREDICT);
    case 'review': return review(rng);
    case 'mole': return mole(rng);
    case 'mind': return fromBank(rng, MIND);
    case 'speech': return speech(rng);
    case 'judge': return fromBank(rng, JUDGE);
    case 'school': return fromBank(rng, SCHOOL);
  }
}
/** 한 판 문제 n개(같은 문제가 되풀이되지 않게) */
export function quizSet(kind: QuizKind, rng: Rng, n: number): Quiz[] {
  const out: Quiz[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const q = quizRound(kind, rng);
    if (!out.some((x) => x.q === q.q && x.opts.slice().sort().join() === q.opts.slice().sort().join())) out.push(q);
  }
  return out;
}

// ── 셋 가운데 하나 챙기기(혹한기 버티기 · 창고 살림) ──
export interface Juggle { v: number[]; next: number[]; turn: number; fails: number }
export const JUGGLE_ADD = 38;
export function juggleDrain(rng: Rng, level: number): number[] {
  const base = 9 + level * 3;
  const hot = Math.floor(rng.next() * 3);
  return [0, 1, 2].map((i) => Math.round(base * (i === hot ? 2.1 : rng.range(0.6, 1.2))));
}
export const juggleStart = (rng: Rng, level: number): Juggle => ({ v: [60, 60, 60], next: juggleDrain(rng, level), turn: 0, fails: 0 });
/** i 를 챙기고 하룻밤(하루)을 넘김. 바닥난 것은 실패 1번, 20으로 겨우 메움 */
export function juggleStep(j: Juggle, i: number, rng: Rng, level: number): Juggle {
  const v = j.v.map((x, k) => Math.min(100, x + (k === i ? JUGGLE_ADD : 0)) - j.next[k]);
  let fails = j.fails;
  const out = v.map((x) => {
    if (x > 0) return x;
    fails++;
    return 20;
  });
  return { v: out, next: juggleDrain(rng, level), turn: j.turn + 1, fails };
}
export const juggleScore = (j: Juggle, turns: number) => Math.max(0, Math.min(1, (j.turn / turns) * (1 - j.fails * 0.22)));
