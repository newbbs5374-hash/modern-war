// 돌발 사건 카드: 가끔(실제 8~14시간마다) 사건이 터지고 2~3개 중 하나를 고름.
// 고른 대로 국방예산·자원·병력·신뢰도·명성·호감·긴장·연구가 바뀜.
// 정해진 시간(8시간) 안에 안 고르면 부관이 무난한 쪽(auto)을 고름.
import { COUNTRIES, countryById } from '../data/world';
import type { Res } from '../data/economy';
import { addFavorNote, civOf } from './civ';
import { Rng } from './rng';
import { pushReport } from './report';
import type { GameState } from './state';
import { isAlive, isRival, pairKey, type WorldEvent } from './world';

const H = 3600e3;
export const CRISIS_FIRST_MS = 6 * H;
export const CRISIS_MIN_MS = 8 * H;
export const CRISIS_MAX_MS = 14 * H;
export const CRISIS_ANSWER_MS = 8 * H;

/** 효과 한 가지 */
export type Fx =
  | { k: 'money'; v: number }
  | { k: 'res'; r: Res; v: number }
  | { k: 'troops'; v: number } // 비율(-0.03 = 3% 잃음)
  | { k: 'trust'; v: number }
  | { k: 'fame'; v: number }
  | { k: 'merit'; v: number }
  | { k: 'intel'; v: number }
  | { k: 'boost'; v: number }
  | { k: 'research'; v: number } // 연구 점수(군사·사회 두 줄에 각각)
  | { k: 'favor'; who: 'target' | 'rivals' | 'all'; v: number }
  | { k: 'tension'; v: number }; // 대상국과 긴장

export interface CrisisOption {
  label: string;
  fx: Fx[];
  /** 고른 뒤 부관 한마디 */
  say: string;
}
export interface CrisisDef {
  id: string;
  icon: string;
  title: string;
  /** {X} = 대상 나라 이름 */
  text: string;
  /** 대상 나라가 필요한지(맞수 우선) */
  target?: 'rival' | 'any';
  options: CrisisOption[];
  /** 안 고르면 부관이 고르는 번호 */
  auto: number;
}

export const CRISES: CrisisDef[] = [
  {
    id: 'oil',
    icon: '🛢️',
    title: '국제 유가 폭등',
    text: '중동 항로가 막혀 기름값이 하룻밤에 두 배가 됐어요. 주유소마다 줄이 길어요.',
    auto: 1,
    options: [
      { label: '비축 석유를 풀어요', fx: [{ k: 'res', r: '석유', v: -80 }, { k: 'trust', v: 5 }], say: '비축유를 풀자 국민들이 한숨 돌렸습니다.' },
      { label: '비싸도 더 수입해요', fx: [{ k: 'money', v: -3000 }, { k: 'res', r: '석유', v: 40 }], say: '값은 비쌌지만 석유를 확보했습니다.' },
      { label: '그냥 버텨요', fx: [{ k: 'trust', v: -6 }], say: '불만의 목소리가 높습니다, 지도자님.' },
    ],
  },
  {
    id: 'quake',
    icon: '🌋',
    title: '대지진',
    text: '우리 나라 도시에 강한 지진이 났어요. 무너진 건물 아래 사람들이 갇혀 있어요.',
    auto: 2,
    options: [
      { label: '군을 투입해 구조해요', fx: [{ k: 'troops', v: -0.02 }, { k: 'fame', v: 8 }, { k: 'trust', v: 5 }], say: '장병들이 밤새 구조에 나섰습니다. 국민들이 감동했어요.' },
      { label: '국제 사회에 도움을 청해요', fx: [{ k: 'money', v: 2500 }, { k: 'favor', who: 'all', v: 4 }, { k: 'fame', v: -3 }], say: '여러 나라가 구호품을 보냈습니다.' },
      { label: '예산으로 빨리 복구해요', fx: [{ k: 'money', v: -4000 }, { k: 'trust', v: 6 }], say: '복구 공사가 시작됐습니다.' },
    ],
  },
  {
    id: 'cyber',
    icon: '💻',
    title: '사이버 공격',
    text: '{X} 쪽으로 보이는 해커들이 우리 전력망과 은행을 공격했어요.',
    target: 'rival',
    auto: 1,
    options: [
      { label: '똑같이 반격해요', fx: [{ k: 'intel', v: 15 }, { k: 'favor', who: 'target', v: -15 }, { k: 'tension', v: 10 }], say: '반격에 성공했습니다. {X}이(가) 화가 났어요.' },
      { label: '방어벽을 강화해요', fx: [{ k: 'money', v: -2000 }, { k: 'res', r: '반도체', v: -10 }, { k: 'research', v: 3 }], say: '보안 체계를 새로 짰습니다.' },
      { label: '조용히 넘어가요', fx: [{ k: 'money', v: -2500 }, { k: 'trust', v: -4 }], say: '피해 복구에 돈이 꽤 들었습니다.' },
    ],
  },
  {
    id: 'defector',
    icon: '🧑‍🔬',
    title: '망명 과학자',
    text: '{X}의 무기 과학자가 우리 대사관에 망명을 신청했어요.',
    target: 'any',
    auto: 1,
    options: [
      { label: '받아들여요', fx: [{ k: 'research', v: 8 }, { k: 'intel', v: 10 }, { k: 'favor', who: 'target', v: -15 }], say: '새 연구가 빨라질 겁니다. {X}은(는) 몹시 불쾌해해요.' },
      { label: '돌려보내요', fx: [{ k: 'favor', who: 'target', v: 15 }], say: '{X}이(가) 고마워합니다.' },
    ],
  },
  {
    id: 'boom',
    icon: '📈',
    title: '경기 호황',
    text: '수출이 잘돼 세금이 예상보다 많이 걷혔어요.',
    auto: 0,
    options: [
      { label: '국방예산에 넣어요', fx: [{ k: 'money', v: 4000 }], say: '국방예산이 넉넉해졌습니다.' },
      { label: '국민에게 나눠요', fx: [{ k: 'trust', v: 8 }, { k: 'fame', v: 6 }], say: '국민들이 지도자님을 칭찬합니다.' },
      { label: '연구에 투자해요', fx: [{ k: 'research', v: 6 }, { k: 'money', v: 1000 }], say: '연구소마다 활기가 돕니다.' },
    ],
  },
  {
    id: 'border',
    icon: '🚧',
    title: '국경 총격전',
    text: '{X}와(과) 맞닿은 곳에서 초병끼리 총을 쐈어요. 다친 사람은 없어요.',
    target: 'rival',
    auto: 1,
    options: [
      { label: '강하게 경고해요', fx: [{ k: 'fame', v: 5 }, { k: 'tension', v: 12 }, { k: 'merit', v: 15 }], say: '국민들은 든든해하지만 {X}와 긴장이 올랐습니다.' },
      { label: '대화로 풀어요', fx: [{ k: 'tension', v: -12 }, { k: 'favor', who: 'target', v: 5 }, { k: 'trust', v: -2 }], say: '양쪽이 한발씩 물러났습니다.' },
    ],
  },
  {
    id: 'arms',
    icon: '📦',
    title: '무기 수출 제안',
    text: '{X}이(가) 우리 무기를 사고 싶다고 해요. 값은 넉넉히 쳐 준대요.',
    target: 'any',
    auto: 1,
    options: [
      { label: '팔아요', fx: [{ k: 'money', v: 3500 }, { k: 'res', r: '강철', v: -50 }, { k: 'favor', who: 'target', v: 10 }, { k: 'favor', who: 'rivals', v: -6 }], say: '계약이 끝났습니다. 맞수들은 곱지 않게 봐요.' },
      { label: '거절해요', fx: [{ k: 'favor', who: 'target', v: -4 }], say: '정중히 거절했습니다.' },
    ],
  },
  {
    id: 'strike',
    icon: '✊',
    title: '군수공장 파업',
    text: '군수공장 노동자들이 임금을 올려 달라며 일손을 놓았어요.',
    auto: 0,
    options: [
      { label: '임금을 올려 줘요', fx: [{ k: 'money', v: -2500 }, { k: 'trust', v: 5 }], say: '공장이 다시 돌아갑니다.' },
      { label: '버티며 협상해요', fx: [{ k: 'res', r: '강철', v: -40 }, { k: 'res', r: '알루미늄', v: -30 }], say: '협상은 됐지만 생산이 며칠 멈췄습니다.' },
      { label: '강제로 해산해요', fx: [{ k: 'trust', v: -8 }, { k: 'fame', v: -4 }], say: '공장은 돌지만 민심이 나빠졌습니다.' },
    ],
  },
  {
    id: 'typhoon',
    icon: '🌀',
    title: '초대형 태풍',
    text: '해군 기지 쪽으로 초대형 태풍이 다가와요. 예정된 해상 훈련이 있어요.',
    auto: 0,
    options: [
      { label: '함대를 대피시켜요', fx: [{ k: 'res', r: '석유', v: -30 }], say: '함대가 무사히 피했습니다.' },
      { label: '훈련을 강행해요', fx: [{ k: 'troops', v: -0.01 }, { k: 'merit', v: 30 }, { k: 'fame', v: 3 }], say: '거친 바다에서 큰 경험을 쌓았지만 다친 장병이 있습니다.' },
    ],
  },
  {
    id: 'rescue',
    icon: '🚁',
    title: '교민 구출',
    text: '{X}에서 폭동이 나 우리 교민 300명이 갇혔어요.',
    target: 'any',
    auto: 1,
    options: [
      { label: '특수부대를 보내요', fx: [{ k: 'troops', v: -0.005 }, { k: 'fame', v: 10 }, { k: 'merit', v: 25 }, { k: 'favor', who: 'target', v: -8 }], say: '작전 성공! 교민 모두 무사히 돌아왔습니다.' },
      { label: '외교로 협상해요', fx: [{ k: 'money', v: -1500 }, { k: 'favor', who: 'target', v: 5 }, { k: 'fame', v: 2 }], say: '시간은 걸렸지만 모두 풀려났습니다.' },
    ],
  },
  {
    id: 'vein',
    icon: '⛏️',
    title: '희귀 광맥 발견',
    text: '산속에서 희토류 광맥이 발견됐어요. 환경 단체가 걱정해요.',
    auto: 1,
    options: [
      { label: '바로 캐요', fx: [{ k: 'res', r: '희토류', v: 60 }, { k: 'trust', v: -3 }], say: '희토류가 쏟아져 나옵니다.' },
      { label: '조사하며 천천히 캐요', fx: [{ k: 'res', r: '희토류', v: 25 }, { k: 'research', v: 3 }], say: '환경도 지키고 자원도 얻었습니다.' },
    ],
  },
  {
    id: 'summit',
    icon: '🤝',
    title: '깜짝 정상회담 제안',
    text: '{X} 지도자가 비밀리에 만나자고 해요.',
    target: 'rival',
    auto: 1,
    options: [
      { label: '만나요', fx: [{ k: 'tension', v: -15 }, { k: 'favor', who: 'target', v: 10 }, { k: 'favor', who: 'rivals', v: -3 }], say: '회담 뒤 두 나라 사이 공기가 한결 부드러워졌습니다.' },
      { label: '거절해요', fx: [{ k: 'fame', v: 3 }, { k: 'tension', v: 5 }], say: '강경파는 박수를 칩니다.' },
    ],
  },
  {
    id: 'scandal',
    icon: '📰',
    title: '국방부 비리 보도',
    text: '신문에 국방부 장비 구매 비리가 크게 났어요.',
    auto: 0,
    options: [
      { label: '철저히 조사해요', fx: [{ k: 'money', v: -1000 }, { k: 'trust', v: 6 }], say: '관련자를 모두 찾아냈습니다.' },
      { label: '덮어요', fx: [{ k: 'trust', v: -10 }, { k: 'money', v: 1500 }], say: '조용히 넘어갔지만 소문이 돕니다.' },
    ],
  },
  {
    id: 'volunteer',
    icon: '🙋',
    title: '입대 지원 열풍',
    text: '애국심이 높아져 젊은이들이 앞다퉈 군에 지원해요.',
    auto: 0,
    options: [
      { label: '모두 받아요', fx: [{ k: 'troops', v: 0.04 }], say: '병력이 크게 늘었습니다.' },
      { label: '뽑아서 정예로 키워요', fx: [{ k: 'troops', v: 0.015 }, { k: 'merit', v: 20 }, { k: 'boost', v: 2 }], say: '정예 훈련을 시작했습니다.' },
    ],
  },
];
export const crisisById = (id: string) => CRISES.find((c) => c.id === id)!;

export interface CrisisOpen {
  id: number;
  def: string;
  target: string | null;
  untilMs: number;
}
export interface CrisisState {
  nextMs: number;
  open: CrisisOpen | null;
  /** 해결한 사건 수(직접 고른 것) */
  solved: number;
  /** 최근 결과 */
  log: string[];
  nextId: number;
  /** 최근에 나온 사건(같은 것이 바로 또 나오지 않게) */
  recent: string[];
}

export const newCrisis = (worldMs: number): CrisisState => ({ nextMs: worldMs + CRISIS_FIRST_MS, open: null, solved: 0, log: [], nextId: 1, recent: [] });
export const crisisOf = (s: GameState): CrisisState => s.crisis ?? newCrisis(0);

const nm = (id: string | null) => (id ? countryById(id).name : '');
export const fill = (t: string, target: string | null) => t.replace(/\{X\}/g, nm(target));

/** 효과를 글로(예: "국방예산 -15,000 · 신뢰 +5") */
export function fxText(fx: Fx[], target: string | null): string {
  const sg = (v: number) => (v > 0 ? `+${v.toLocaleString('ko-KR')}` : v.toLocaleString('ko-KR'));
  return fx
    .map((f) => {
      switch (f.k) {
        case 'money':
          return `💰 국방예산 ${sg(f.v)}`;
        case 'res':
          return `${f.r} ${sg(f.v)}`;
        case 'troops':
          return `🪖 병력 ${sg(Math.round(f.v * 1000) / 10)}%`;
        case 'trust':
          return `🏛️ 신뢰 ${sg(f.v)}`;
        case 'fame':
          return `⭐ 명성 ${sg(f.v)}`;
        case 'merit':
          return `🏅 공훈 ${sg(f.v)}`;
        case 'intel':
          return `🕵️ 정보 ${sg(f.v)}`;
        case 'boost':
          return `🎫 가속권 ${sg(f.v)}`;
        case 'research':
          return `🔬 연구 ${sg(f.v)}시간치`;
        case 'favor':
          return `${f.who === 'target' ? nm(target) : f.who === 'rivals' ? '맞수들' : '모든 나라'} 호감 ${sg(f.v)}`;
        case 'tension':
          return `${nm(target)}와 긴장 ${sg(f.v)}`;
      }
    })
    .join(' · ');
}

/** 고를 수 있는지(돈·자원이 모자라면 못 고름) */
export function canChoose(s: GameState, opt: CrisisOption): string | null {
  const me = s.player.countryId;
  for (const f of opt.fx) {
    if (f.k === 'money' && f.v < 0 && s.nations[me].treasury < -f.v) return '국방예산이 모자라요';
    if (f.k === 'res' && f.v < 0 && (s.economy.stock[f.r] ?? 0) < -f.v) return `${f.r}이(가) 모자라요`;
  }
  return null;
}

function applyFx(s: GameState, fx: Fx[], target: string | null): GameState {
  const me = s.player.countryId;
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me] } }, officer: { ...s.officer }, economy: { ...s.economy, stock: { ...s.economy.stock } } };
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  for (const f of fx) {
    switch (f.k) {
      case 'money':
        ns.nations[me].treasury = Math.max(0, ns.nations[me].treasury + f.v);
        break;
      case 'res':
        ns.economy.stock[f.r] = Math.max(0, (ns.economy.stock[f.r] ?? 0) + f.v);
        break;
      case 'troops':
        ns.nations[me].troops = Math.max(0, ns.nations[me].troops * (1 + f.v));
        break;
      case 'trust':
        ns.officer.trust = clamp(ns.officer.trust + f.v);
        break;
      case 'fame':
        ns.officer.fame = Math.max(0, ns.officer.fame + f.v);
        break;
      case 'merit':
        ns.officer.merit += f.v;
        ns.officer.totalMerit += f.v;
        break;
      case 'intel':
        ns.officer.intel = Math.max(0, ns.officer.intel + f.v);
        break;
      case 'boost':
        ns.officer.boosts = (ns.officer.boosts ?? 0) + f.v;
        break;
      case 'research': {
        const c = structuredClone(civOf(ns));
        c.bank.mil += f.v;
        c.bank.soc += f.v;
        ns = { ...ns, civ: c };
        break;
      }
      case 'favor': {
        const who =
          f.who === 'target' ? (target ? [target] : []) : COUNTRIES.map((c) => c.id).filter((id) => id !== me && isAlive(ns.world, id) && (f.who === 'all' || isRival(me, id)));
        for (const id of who) ns = addFavorNote(ns, id, f.v > 0 ? '돌발 사건 때 도움' : '돌발 사건 때 갈등', f.v);
        break;
      }
      case 'tension': {
        if (!target) break;
        const k = pairKey(me, target);
        const p = ns.world.pairs[k];
        if (p) ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [k]: { ...p, tension: Math.max(0, Math.min(100, p.tension + f.v)) } } } };
        break;
      }
    }
  }
  return ns;
}

function addEvent(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 200) } };
}

/** 사건 고르기(직접). byAide = 시간이 지나 부관이 고름 */
export function chooseCrisis(s: GameState, i: number, byAide = false): GameState {
  const c = crisisOf(s);
  const o = c.open;
  if (!o) return s;
  const d = crisisById(o.def);
  const opt = d.options[i];
  if (!opt) return s;
  if (!byAide && canChoose(s, opt)) return s;
  let ns = applyFx(s, opt.fx, o.target);
  const line = `${d.icon} ${d.title}: ${opt.label}${byAide ? ' (부관이 대신 고름)' : ''} → ${fxText(opt.fx, o.target)}`;
  const log = [line, ...c.log].slice(0, 8);
  ns = { ...ns, crisis: { ...c, open: null, solved: c.solved + (byAide ? 0 : 1), log } };
  ns = addEvent(ns, `${d.icon} ${d.title} — ${opt.label}`);
  return pushReport(ns, { icon: d.icon, text: fill(opt.say, o.target) });
}

/** 시간이 흐를 때: 새 사건 열기 / 시간 넘으면 부관이 고르기 */
export function crisisTick(s: GameState): GameState {
  if (s.ending) return s;
  let c = s.crisis ?? newCrisis(s.worldMs);
  let ns: GameState = s.crisis ? s : { ...s, crisis: c };
  if (c.open && s.worldMs >= c.open.untilMs) {
    const d = crisisById(c.open.def);
    const opt = d.options[d.auto];
    const pick = canChoose(ns, opt) ? d.options.findIndex((x) => !canChoose(ns, x)) : d.auto;
    ns = chooseCrisis(ns, pick < 0 ? d.options.length - 1 : pick, true);
    c = crisisOf(ns);
  }
  if (!c.open && s.worldMs >= c.nextMs) {
    const rng = new Rng((c.nextId * 2246822519 + s.world.seed + Math.floor(c.nextMs / H)) >>> 0);
    const pool = CRISES.filter((d) => !c.recent.includes(d.id));
    const d = rng.pick(pool.length ? pool : CRISES);
    const me = s.player.countryId;
    let target: string | null = null;
    if (d.target) {
      const alive = COUNTRIES.map((x) => x.id).filter((id) => id !== me && isAlive(s.world, id));
      const rivals = alive.filter((id) => isRival(me, id));
      target = rng.pick(d.target === 'rival' && rivals.length ? rivals : alive) ?? null;
    }
    const open: CrisisOpen = { id: c.nextId, def: d.id, target, untilMs: s.worldMs + CRISIS_ANSWER_MS };
    const nextMs = s.worldMs + rng.range(CRISIS_MIN_MS, CRISIS_MAX_MS);
    ns = { ...ns, crisis: { ...c, open, nextMs, nextId: c.nextId + 1, recent: [d.id, ...c.recent].slice(0, 5) } };
    ns = pushReport(ns, { icon: '⚡', text: `급한 일이 생겼습니다! ${d.title} — 본부에서 결정해 주세요.` });
  }
  return ns;
}

/** 시험: 바로 사건 하나 열기 */
export function debugCrisis(s: GameState): GameState {
  const c = crisisOf(s);
  if (c.open) return s;
  return crisisTick({ ...s, crisis: { ...c, nextMs: s.worldMs } });
}
