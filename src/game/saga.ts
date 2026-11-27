// 11-27 종합 확장안 내정 4: 연속 위기 이야기.
// 3일에 걸쳐 하루에 한 번씩 결정하는 큰 위기(금융 위기 · 감염병 · 큰 지진 · 에너지 대란).
// 고른 답마다 「상황 점수」가 오르내리고, 둘째 날 카드와 마지막 결과가 그 점수에 따라 달라짐.
// 카드 자체는 돌발 사건(crisis.ts) 틀을 그대로 씀. 다른 사건이 열려 있으면 그게 끝난 뒤에 나옴.
import { CRISIS_ANSWER_MS, applyFx, crisisOf, fxText, registerCrises, type CrisisDef, type CrisisOption, type Fx } from './crisis';
import { pushReport } from './report';
import type { GameState } from './state';

const H = 3600e3;
/** 첫 연속 위기까지 */
export const SAGA_FIRST_MS = 60 * H;
/** 하루에 한 번(다음 카드까지) */
export const SAGA_STEP_MS = 20 * H;
/** 끝난 뒤 다음 연속 위기까지 */
export const SAGA_GAP_MS = 5 * 24 * H;
export const SAGA_DAYS = 3;

type Opt = CrisisOption & { m: number };
interface Card { text: string; auto: number; options: Opt[] }
export interface SagaDef {
  id: string;
  icon: string;
  title: string;
  d1: Card;
  /** 둘째 날: 첫날을 잘 넘겼을 때 / 못 넘겼을 때 */
  d2: { calm: Card; bad: Card };
  d3: Card;
  /** 마지막 결과: 점수 ≤ -2 잘 끝남 · ≥ 2 크게 번짐 · 그 사이 보통 */
  end: { good: [string, Fx[]]; mid: [string, Fx[]]; bad: [string, Fx[]] };
}

export const SAGAS: SagaDef[] = [
  {
    id: 'bank',
    icon: '🏦',
    title: '금융 위기',
    d1: {
      text: '큰 은행 한 곳이 문을 닫았어요. 다른 은행 앞에도 돈을 찾으려는 줄이 늘어서고 있어요.',
      auto: 1,
      options: [
        { label: '나랏돈으로 은행을 살려요', m: -1, fx: [{ k: 'money', v: -6000 }, { k: 'trust', v: 3 }], say: '급한 불은 껐습니다. 내일 시장이 어떻게 열릴지 지켜봐야 합니다.' },
        { label: '예금만 지켜 준다고 약속해요', m: 0, fx: [{ k: 'money', v: -2500 }], say: '예금자들은 한숨 돌렸지만 시장은 아직 불안합니다.' },
        { label: '시장에 맡겨요', m: 1, fx: [{ k: 'approval', v: -4 }], say: '은행이 알아서 버텨야 합니다. 줄이 더 길어졌습니다.' },
      ],
    },
    d2: {
      calm: {
        text: '줄은 줄었지만 주가가 크게 떨어졌어요. 기업들이 돈을 못 빌려 공장을 멈추려 해요.',
        auto: 0,
        options: [
          { label: '기업에 급한 돈을 빌려줘요', m: -1, fx: [{ k: 'money', v: -4000 }, { k: 'trust', v: 3 }], say: '공장이 계속 돌아갑니다.' },
          { label: '금리를 내려요', m: 0, fx: [{ k: 'approval', v: 3 }, { k: 'fame', v: -3 }], say: '숨통은 트였지만 물가가 걱정입니다.' },
          { label: '투기 세력을 수사해요', m: 0, fx: [{ k: 'trust', v: 4 }, { k: 'money', v: -1000 }], say: '국민들은 속 시원해합니다.' },
        ],
      },
      bad: {
        text: '은행 세 곳이 더 문을 닫았어요. 환율이 치솟고 외국 돈이 빠져나가고 있어요.',
        auto: 1,
        options: [
          { label: '외환 보유고를 풀어요', m: -1, fx: [{ k: 'money', v: -7000 }], say: '환율이 겨우 멈췄습니다.' },
          { label: '며칠 은행 문을 닫아요', m: 0, fx: [{ k: 'approval', v: -6 }, { k: 'trust', v: -3 }], say: '거리는 조용하지만 불만이 큽니다.' },
          { label: '다른 나라에 돈을 빌려요', m: -1, fx: [{ k: 'money', v: 3000 }, { k: 'fame', v: -10 }, { k: 'favor', who: 'all', v: -2 }], say: '돈은 구했지만 체면이 깎였습니다.' },
        ],
      },
    },
    d3: {
      text: '사흘째, 국민과 시장이 지도자님의 마지막 한마디를 기다려요.',
      auto: 0,
      options: [
        { label: '금융 개혁안을 발표해요', m: -1, fx: [{ k: 'money', v: -3000 }, { k: 'research', v: 3 }], say: '다시는 같은 일이 없도록 틀을 고쳤습니다.' },
        { label: '직접 국민 앞에 서서 안심시켜요', m: -1, fx: [{ k: 'approval', v: 4 }, { k: 'merit', v: -100 }], say: '담화가 끝나자 시장이 조금 올랐습니다.' },
        { label: '책임자를 바꾸고 넘어가요', m: 1, fx: [{ k: 'trust', v: -3 }], say: '사람은 바꿨지만 문제는 그대로입니다.' },
      ],
    },
    end: {
      good: ['금융 위기를 깔끔하게 넘겼습니다. 외국 돈이 다시 들어옵니다.', [{ k: 'money', v: 9000 }, { k: 'fame', v: 15 }, { k: 'approval', v: 6 }]],
      mid: ['금융 위기가 가라앉았습니다. 상처는 남았지만 버텼습니다.', [{ k: 'money', v: 2000 }, { k: 'trust', v: 2 }]],
      bad: ['금융 위기가 불황으로 번졌습니다. 한동안 살림이 빠듯하겠습니다.', [{ k: 'money', v: -6000 }, { k: 'approval', v: -8 }, { k: 'trust', v: -5 }]],
    },
  },
  {
    id: 'plague',
    icon: '🦠',
    title: '감염병',
    d1: {
      text: '항구 도시에서 처음 보는 병이 돌아요. 하루 만에 환자가 수백 명으로 늘었어요.',
      auto: 1,
      options: [
        { label: '그 도시를 바로 막아요', m: -1, fx: [{ k: 'money', v: -3000 }, { k: 'approval', v: -3 }], say: '도시를 막았습니다. 불편하지만 번지는 건 늦췄습니다.' },
        { label: '검사소를 늘리고 지켜봐요', m: 0, fx: [{ k: 'money', v: -2000 }], say: '검사를 늘렸습니다. 숫자를 지켜보겠습니다.' },
        { label: '별일 아니라고 발표해요', m: 2, fx: [{ k: 'approval', v: 2 }], say: '당장은 조용하지만… 걱정입니다, 지도자님.' },
      ],
    },
    d2: {
      calm: {
        text: '환자가 느는 속도가 줄었어요. 그런데 병원에 약과 침대가 모자라요.',
        auto: 0,
        options: [
          { label: '군 병원과 군의관을 내줘요', m: -1, fx: [{ k: 'troops', v: -0.01 }, { k: 'trust', v: 5 }], say: '장병들이 환자를 돌봅니다.' },
          { label: '약을 비싸게라도 사 와요', m: -1, fx: [{ k: 'money', v: -4500 }], say: '약이 도착했습니다.' },
          { label: '병원이 알아서 버티게 해요', m: 1, fx: [{ k: 'trust', v: -4 }], say: '의료진이 지쳐 갑니다.' },
        ],
      },
      bad: {
        text: '병이 수도까지 번졌어요. 학교와 시장이 문을 닫고 사람들이 사재기를 해요.',
        auto: 0,
        options: [
          { label: '온 나라에 이동 제한을 걸어요', m: -2, fx: [{ k: 'money', v: -6000 }, { k: 'approval', v: -5 }], say: '거리가 텅 비었습니다. 병은 느려졌습니다.' },
          { label: '생필품을 나눠 주고 달래요', m: -1, fx: [{ k: 'money', v: -3500 }, { k: 'trust', v: 3 }], say: '사재기가 멈췄습니다.' },
          { label: '경제가 먼저라고 문을 열어 둬요', m: 1, fx: [{ k: 'money', v: 1500 }, { k: 'approval', v: -4 }], say: '가게는 열었지만 환자가 계속 늡니다.' },
        ],
      },
    },
    d3: {
      text: '연구소에서 백신 후보가 나왔어요. 어떻게 쓸지 정해야 해요.',
      auto: 0,
      options: [
        { label: '서둘러 온 국민에게 맞혀요', m: -1, fx: [{ k: 'money', v: -4000 }, { k: 'research', v: 4 }], say: '접종이 시작됐습니다.' },
        { label: '이웃 나라와 나눠 써요', m: 0, fx: [{ k: 'favor', who: 'all', v: 6 }, { k: 'fame', v: 8 }], say: '여러 나라가 고마워합니다.' },
        { label: '다른 나라에 비싸게 팔아요', m: 1, fx: [{ k: 'money', v: 5000 }, { k: 'favor', who: 'all', v: -4 }], say: '돈은 벌었지만 눈총을 받습니다.' },
      ],
    },
    end: {
      good: ['감염병을 가장 먼저 잡은 나라가 됐습니다. 세계가 우리 방역을 배우러 옵니다.', [{ k: 'fame', v: 20 }, { k: 'approval', v: 8 }, { k: 'research', v: 5 }]],
      mid: ['감염병이 잦아들었습니다. 일상이 천천히 돌아옵니다.', [{ k: 'trust', v: 3 }, { k: 'fame', v: 4 }]],
      bad: ['감염병이 온 나라를 휩쓸고 지나갔습니다. 잃은 것이 많습니다.', [{ k: 'troops', v: -0.04 }, { k: 'money', v: -5000 }, { k: 'approval', v: -8 }]],
    },
  },
  {
    id: 'bigquake',
    icon: '🌋',
    title: '큰 지진',
    d1: {
      text: '새벽에 아주 큰 지진이 났어요. 건물이 무너지고 길이 끊겼어요. 첫 72시간이 가장 중요해요.',
      auto: 0,
      options: [
        { label: '군을 모두 구조에 보내요', m: -1, fx: [{ k: 'troops', v: -0.02 }, { k: 'trust', v: 5 }], say: '장병들이 맨손으로 잔해를 치웁니다.' },
        { label: '소방과 경찰로 버텨요', m: 0, fx: [{ k: 'money', v: -2000 }], say: '사람 손이 모자랍니다.' },
        { label: '먼저 피해 조사부터 해요', m: 1, fx: [{ k: 'approval', v: -4 }], say: '구조가 늦어지고 있습니다.' },
      ],
    },
    d2: {
      calm: {
        text: '많은 사람을 구했어요. 이제 집을 잃은 수만 명이 추운 밤을 보내야 해요.',
        auto: 0,
        options: [
          { label: '임시 집과 먹을 것을 보내요', m: -1, fx: [{ k: 'money', v: -4000 }, { k: 'approval', v: 4 }], say: '천막 마을이 섰습니다.' },
          { label: '다른 나라 구호를 받아요', m: -1, fx: [{ k: 'favor', who: 'all', v: 3 }, { k: 'fame', v: -3 }], say: '구호품 비행기가 줄지어 내립니다.' },
          { label: '체육관에 모이게만 해요', m: 1, fx: [{ k: 'trust', v: -3 }], say: '불편하다는 목소리가 큽니다.' },
        ],
      },
      bad: {
        text: '여진이 또 왔어요. 댐에 금이 가고 발전소가 멈췄어요. 구조도 아직 끝나지 않았어요.',
        auto: 0,
        options: [
          { label: '댐 아래 마을을 모두 대피시켜요', m: -1, fx: [{ k: 'money', v: -3500 }, { k: 'troops', v: -0.01 }], say: '대피가 끝났습니다. 댐은 버티고 있습니다.' },
          { label: '발전소부터 살려요', m: 0, fx: [{ k: 'money', v: -3000 }, { k: 'res', r: '석유', v: -40 }], say: '불은 다시 들어왔습니다.' },
          { label: '구조에만 힘을 모아요', m: 1, fx: [{ k: 'trust', v: 2 }], say: '댐이 걱정입니다, 지도자님.' },
        ],
      },
    },
    d3: {
      text: '구조가 끝나 가요. 무너진 도시를 어떻게 다시 세울지 정해야 해요.',
      auto: 1,
      options: [
        { label: '더 튼튼하게 새로 지어요', m: -1, fx: [{ k: 'money', v: -6000 }, { k: 'res', r: '강철', v: -60 }], say: '지진에 견디는 도시로 다시 짓습니다.' },
        { label: '빨리 예전처럼 고쳐요', m: 0, fx: [{ k: 'money', v: -3000 }], say: '복구가 시작됐습니다.' },
        { label: '성금을 모아 천천히 해요', m: 1, fx: [{ k: 'money', v: 1000 }, { k: 'approval', v: -3 }], say: '복구가 더딥니다.' },
      ],
    },
    end: {
      good: ['지진을 이겨냈습니다. 새 도시는 전보다 튼튼하고, 국민은 하나가 됐습니다.', [{ k: 'trust', v: 8 }, { k: 'fame', v: 15 }, { k: 'approval', v: 8 }]],
      mid: ['지진 복구가 자리를 잡았습니다.', [{ k: 'trust', v: 3 }, { k: 'fame', v: 3 }]],
      bad: ['늦은 대응으로 피해가 커졌습니다. 국민의 원망이 큽니다.', [{ k: 'money', v: -5000 }, { k: 'trust', v: -6 }, { k: 'approval', v: -8 }]],
    },
  },
  {
    id: 'energy',
    icon: '⚡',
    title: '에너지 대란',
    d1: {
      text: '기름과 가스를 실은 배가 끊겼어요. 한겨울인데 비축분은 2주 치뿐이에요.',
      auto: 1,
      options: [
        { label: '비축유를 풀어요', m: -1, fx: [{ k: 'res', r: '석유', v: -80 }, { k: 'trust', v: 3 }], say: '당장은 따뜻하게 지낼 수 있습니다.' },
        { label: '온 나라가 아껴 쓰게 해요', m: 0, fx: [{ k: 'approval', v: -3 }], say: '거리의 불빛이 줄었습니다.' },
        { label: '값이 오르게 그냥 둬요', m: 1, fx: [{ k: 'money', v: 2000 }, { k: 'approval', v: -5 }], say: '난방비에 불만이 터져 나옵니다.' },
      ],
    },
    d2: {
      calm: {
        text: '며칠은 버텼어요. 하지만 공장들이 전기를 더 달라고 아우성이에요.',
        auto: 1,
        options: [
          { label: '집보다 공장에 먼저 줘요', m: 0, fx: [{ k: 'money', v: 2500 }, { k: 'approval', v: -4 }], say: '공장은 돌지만 집은 춥습니다.' },
          { label: '웃돈을 주고 급히 사 와요', m: -1, fx: [{ k: 'money', v: -5000 }, { k: 'res', r: '석유', v: 60 }], say: '유조선이 들어왔습니다.' },
          { label: '쉬던 발전소를 다시 돌려요', m: -1, fx: [{ k: 'money', v: -2500 }, { k: 'fame', v: -4 }], say: '낡은 발전소가 다시 연기를 뿜습니다.' },
        ],
      },
      bad: {
        text: '큰 도시들이 돌아가며 정전이에요. 병원이 비상 발전기로 버티고 지하철이 섰어요.',
        auto: 0,
        options: [
          { label: '군 비축 연료를 민간에 내줘요', m: -1, fx: [{ k: 'troops', v: -0.02 }, { k: 'trust', v: 4 }], say: '병원과 지하철에 불이 들어왔습니다.' },
          { label: '어디서든 사 와요, 값은 묻지 말고', m: -2, fx: [{ k: 'money', v: -8000 }, { k: 'res', r: '석유', v: 80 }], say: '비쌌지만 급한 불을 껐습니다.' },
          { label: '정전 시간표를 짜서 버텨요', m: 1, fx: [{ k: 'approval', v: -6 }], say: '촛불로 밤을 보내는 집이 늘었습니다.' },
        ],
      },
    },
    d3: {
      text: '배가 다시 들어오기 시작했어요. 다음 겨울을 어떻게 대비할지 정해야 해요.',
      auto: 0,
      options: [
        { label: '비축 기지를 크게 지어요', m: -1, fx: [{ k: 'money', v: -4500 }, { k: 'res', r: '강철', v: -40 }], say: '다음에는 석 달도 버팁니다.' },
        { label: '새 에너지 연구에 걸어요', m: -1, fx: [{ k: 'money', v: -3000 }, { k: 'research', v: 6 }], say: '연구소에 불이 꺼지지 않습니다.' },
        { label: '지나갔으니 잊어요', m: 1, fx: [{ k: 'money', v: 1000 }], say: '돈은 아꼈습니다만…' },
      ],
    },
    end: {
      good: ['에너지 대란을 넘기고 더 든든한 나라가 됐습니다.', [{ k: 'res', r: '석유', v: 120 }, { k: 'fame', v: 12 }, { k: 'approval', v: 6 }]],
      mid: ['에너지 대란이 끝났습니다. 겨울이 지나갑니다.', [{ k: 'res', r: '석유', v: 40 }, { k: 'trust', v: 2 }]],
      bad: ['에너지 대란으로 공장이 멈추고 살림이 크게 상했습니다.', [{ k: 'money', v: -6000 }, { k: 'approval', v: -8 }, { k: 'trust', v: -4 }]],
    },
  },
];

const CARD_KEYS = ['1', '2a', '2b', '3'] as const;
type CardKey = (typeof CARD_KEYS)[number];
const cardOf = (d: SagaDef, k: CardKey): Card => (k === '1' ? d.d1 : k === '2a' ? d.d2.calm : k === '2b' ? d.d2.bad : d.d3);
const DAY_OF: Record<CardKey, number> = { '1': 1, '2a': 2, '2b': 2, '3': 3 };
export const sagaCardId = (id: string, k: CardKey) => `saga-${id}-${k}`;

const CARDS: CrisisDef[] = SAGAS.flatMap((d) =>
  CARD_KEYS.map((k) => {
    const c = cardOf(d, k);
    return { id: sagaCardId(d.id, k), icon: d.icon, title: `${d.title} · ${DAY_OF[k]}일째`, text: c.text, auto: c.auto, options: c.options };
  }),
);
registerCrises(CARDS);

export interface SagaState {
  /** 진행 중인 이야기 */
  id: string | null;
  /** 1~3 = 다음에 낼(또는 열려 있는) 날 */
  day: number;
  /** 상황 점수(낮을수록 좋음) */
  meter: number;
  /** 열어 두고 답을 기다리는 카드 */
  wait: string | null;
  /** 다음 카드(또는 다음 이야기) 때 */
  nextMs: number;
  /** 끝낸 이야기 수 */
  done: number;
  /** 최근 끝난 이야기(되풀이 막기) */
  recent: string[];
  /** 마지막 결과 */
  last?: { id: string; grade: 'good' | 'mid' | 'bad'; t: number };
}

export const sagaById = (id: string): SagaDef => SAGAS.find((d) => d.id === id) ?? SAGAS[0];
export const sagaOf = (s: GameState): SagaState => s.saga ?? { id: null, day: 0, meter: 0, wait: null, nextMs: s.worldMs + SAGA_FIRST_MS, done: 0, recent: [] };
export const gradeOf = (meter: number): 'good' | 'mid' | 'bad' => (meter <= -2 ? 'good' : meter >= 2 ? 'bad' : 'mid');
export const METER_TEXT = { good: '잘 잡히는 중', mid: '아슬아슬', bad: '번지는 중' } as const;

/** 카드 창에 보여 줄 정보(연속 위기 카드가 아니면 null) */
export function sagaInfo(s: GameState, defId: string): { def: SagaDef; day: number; meter: number; grade: 'good' | 'mid' | 'bad' } | null {
  const m = /^saga-([a-z]+)-(\d)/.exec(defId);
  if (!m) return null;
  const g = sagaOf(s);
  return { def: sagaById(m[1]), day: Number(m[2]), meter: g.meter, grade: gradeOf(g.meter) };
}

/** 결과 미리 보기(도움말) */
export const sagaEndText = (d: SagaDef, g: 'good' | 'mid' | 'bad') => fxText(d.end[g][1], null);

function openCard(s: GameState, g: SagaState, d: SagaDef): GameState {
  const key: CardKey = g.day === 1 ? '1' : g.day === 2 ? (g.meter <= 0 ? '2a' : '2b') : '3';
  const c = crisisOf(s);
  const def = sagaCardId(d.id, key);
  const ns: GameState = {
    ...s,
    crisis: { ...c, open: { id: c.nextId, def, target: null, untilMs: s.worldMs + CRISIS_ANSWER_MS }, nextId: c.nextId + 1, nextMs: Math.max(c.nextMs, s.worldMs + CRISIS_ANSWER_MS + 2 * H) },
    saga: { ...g, wait: def },
  };
  return pushReport(ns, { icon: d.icon, text: g.day === 1 ? `큰일입니다! ${d.title}이(가) 시작됐습니다. 사흘 동안 하루에 한 번 결정해 주세요.` : `${d.title} ${g.day}일째입니다. 본부에서 결정해 주세요.` });
}

/** 세계 판단마다 */
export function sagaTick(s: GameState): GameState {
  if (s.ending) return s;
  let g = sagaOf(s);
  let ns: GameState = s.saga ? s : { ...s, saga: g };
  const c = crisisOf(ns);
  // ① 열어 둔 카드에 답이 나왔는지
  if (g.wait) {
    if (c.open?.def === g.wait) return ns;
    const d = sagaById(g.id!);
    const key = g.wait.split('-')[2] as CardKey;
    const i = c.last?.def === g.wait ? c.last.i : cardOf(d, key).auto;
    const meter = g.meter + (cardOf(d, key).options[i]?.m ?? 0);
    if (g.day < SAGA_DAYS) {
      g = { ...g, wait: null, meter, day: g.day + 1, nextMs: ns.worldMs + SAGA_STEP_MS };
      return { ...ns, saga: g };
    }
    const grade = gradeOf(meter);
    const [say, fx] = d.end[grade];
    ns = applyFx(ns, fx, null);
    ns = pushReport(ns, { icon: d.icon, text: `${say} (${fxText(fx, null)})` });
    g = { id: null, day: 0, meter: 0, wait: null, nextMs: ns.worldMs + SAGA_GAP_MS, done: g.done + 1, recent: [d.id, ...g.recent].slice(0, 2), last: { id: d.id, grade, t: ns.worldMs } };
    return { ...ns, saga: g };
  }
  if (ns.worldMs < g.nextMs || c.open) return ns;
  // ② 새 이야기 고르기
  if (!g.id) {
    const pool = SAGAS.filter((d) => !g.recent.includes(d.id));
    const d = pool[Math.abs(Math.floor(ns.world.seed + g.done * 7 + g.nextMs / H)) % pool.length];
    g = { ...g, id: d.id, day: 1, meter: 0 };
  }
  // ③ 오늘 카드 열기
  return openCard(ns, g, sagaById(g.id!));
}
