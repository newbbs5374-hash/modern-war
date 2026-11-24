// 첫 판 안내 임무: 처음 하는 사람이 덜 헤매게 부관이 순서대로 알려 주고, 할 때마다 작은 보상.
// 조건은 지금 상태로만 판단(따로 세지 않음) → 이미 해 둔 일은 바로 완료.
import { civOf } from './civ';
import { goalsOf } from './goals';
import { ordersOf, ORDER_INFO } from './orders';
import { spyOf } from './spy';
import { scheduleOf } from './schedule';
import { cabinetOf } from './cabinet';
import { assemblyOf } from './assembly';
import type { GameState } from './state';

export interface GuideStep {
  id: string;
  icon: string;
  title: string;
  /** 부관이 하는 말 */
  say: string;
  /** 갈 화면과 탭(sessionStorage tab:<key>) */
  go: { screen: string; key?: string; tab?: string };
  done: (s: GameState) => boolean;
  reward: { salary?: number; boosts?: number; ruby?: number };
}

const sum = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((a, b) => a + b, 0);
const total = (s: GameState, k: keyof ReturnType<typeof goalsOf>['total']) => goalsOf(s).total[k] ?? 0;

export const GUIDE: GuideStep[] = [
  { id: 'salary', icon: '💵', title: '봉급 받기', say: '본부의 "봉급 받기"를 눌러 쌓인 봉급을 받아 보세요.', go: { screen: 'home' }, done: (s) => total(s, 'salary') > 0, reward: { boosts: 2 } },
  { id: 'train', icon: '🎯', title: '훈련 한 번 하기', say: '국방 → 훈련에서 아무 훈련이나 하나 끝내 보세요. 스탯이 올라요.', go: { screen: 'training' }, done: (s) => sum(s.officer.mastery) > 0, reward: { ruby: 5 } },
  { id: 'recruit', icon: '🪖', title: '부대 모집하기', say: '국방 → 부대에서 보병을 모집해 보세요. 시간이 지나면 완성돼요.', go: { screen: 'forces' }, done: (s) => sum(s.economy.army) > 0 || s.economy.queue.length > 0, reward: { boosts: 2 } },
  { id: 'mission', icon: '🎖️', title: '임무 하나 끝내기', say: '국방 → 작전 → 임무에서 임무를 골라 끝내 보세요. 임무로 명성이 쌓이면 호칭이 올라요.', go: { screen: 'ops', key: 'ops', tab: 'mission' }, done: (s) => total(s, 'merit') > 0, reward: { ruby: 5 } },
  { id: 'chore', icon: '🏗️', title: '내정 일 시키기', say: '경제 → 시설 현황에서 일을 하나 시켜 보세요. 나라가 튼튼해져요.', go: { screen: 'nation', key: 'nation', tab: 'fac' }, done: (s) => !!s.economy.chore || total(s, 'chore') > 0, reward: { salary: 500 } },
  { id: 'tech', icon: '🔬', title: '연구 고르기', say: '국방 → 군사 연구(또는 사회 → 사회 연구)에서 연구를 하나 골라 두세요. 실제 시간으로 쌓여요.', go: { screen: 'nation', key: 'nation', tab: 'tech' }, done: (s) => { const c = civOf(s); return !!c.cur.mil || !!c.cur.soc || c.done.length > 0; }, reward: { ruby: 5 } },
  { id: 'trade', icon: '🚢', title: '무역 한 번 하기', say: '경제 → 무역에서 자원을 사거나 팔아 보세요. 협정은 외교 탭에서 맺어요.', go: { screen: 'diplo', key: 'diplo', tab: 'trade' }, done: (s) => s.economy.log.some((t) => /사기|팔기/.test(t)) || total(s, 'pact') > 0, reward: { salary: 500 } },
  { id: 'orders', icon: '📋', title: '미리 명령 켜기', say: '본부 오른쪽 📋 명령에서 "봉급 자동 받기"를 켜 두면 자리를 비워도 편해요.', go: { screen: 'home' }, done: (s) => ORDER_INFO.some((x) => ordersOf(s)[x.key]), reward: { boosts: 3 } },
  { id: 'spy', icon: '🕵️', title: '위성 정찰 보내기', say: '국방 → 정보전에서 맞수 나라에 위성 정찰을 보내 보세요.', go: { screen: 'ops', key: 'ops', tab: 'spy' }, done: (s) => spyOf(s).done > 0 || spyOf(s).active.length > 0, reward: { ruby: 5 } },
  { id: 'plan', icon: '🗓️', title: '대통령 일정 넣기', say: '개인 → 일정에서 오늘 할 활동을 하나 골라 보세요. 하루 3칸, 넣자마자 효과가 나요.', go: { screen: 'personal', key: 'personal', tab: 'plan' }, done: (s) => scheduleOf(s).total > 0, reward: { ruby: 5 } },
  { id: 'talent', icon: '👥', title: '인재 영입하기', say: '개인 → 인재에서 마음에 드는 사람을 영입해 보세요. 출신마다 잘하는 일이 달라요.', go: { screen: 'personal', key: 'personal', tab: 'talent' }, done: (s) => !!s.cabinet && cabinetOf(s).people.some((p) => p.group === '내각' && !p.buddy), reward: { salary: 500 } },
  { id: 'seat', icon: '🏛️', title: '장관·차관 앉히기', say: '영입한 사람을 눌러 장관 후보(청문회)나 차관으로 앉혀 보세요. 부처 힘이 나라 전체에 퍼져요.', go: { screen: 'personal', key: 'personal', tab: 'talent' }, done: (s) => !!s.cabinet && (cabinetOf(s).people.some((p) => p.seat) || !!cabinetOf(s).hearing), reward: { ruby: 5 } },
  { id: 'bill', icon: '📜', title: '법안 내기', say: '사회 → 정계의 국회에서 법안 카드 하나를 내 보세요. 2시간 뒤 표결해요.', go: { screen: 'society', key: 'society', tab: 'politics' }, done: (s) => !!assemblyOf(s).vote || (assemblyOf(s).passed ?? 0) > 0 || assemblyOf(s).log.length > 0, reward: { boosts: 2 } },
  { id: 'daily', icon: '📅', title: '매일 할 일 보상 받기', say: '본부 🛒 상점(개인 → 업적·상점) → 매일 할 일에서 다 한 일의 루비를 받아 보세요. 매일 바뀌어요.', go: { screen: 'shop', key: 'shop', tab: 'daily' }, done: (s) => goalsOf(s).daily.some((d) => d.claimed) || goalsOf(s).got.length > 0, reward: { ruby: 10, boosts: 3 } },
];

export interface GuideState {
  /** 보상까지 받은 단계 수 */
  step: number;
  hidden: boolean;
}
export const guideOf = (s: GameState): GuideState => s.guide ?? { step: 0, hidden: false };
export const guideStep = (s: GameState): GuideStep | null => GUIDE[guideOf(s).step] ?? null;
export const guideFinished = (s: GameState) => guideOf(s).step >= GUIDE.length;

export function rewardText(r: GuideStep['reward']): string {
  return [r.salary && `💵 ${r.salary}`, r.boosts && `🎫 ${r.boosts}`, r.ruby && `💎 ${r.ruby}`].filter(Boolean).join(' · ');
}

/** 지금 단계 보상 받기(조건을 채웠을 때만) */
export function claimGuide(s: GameState): GameState {
  const st = guideStep(s);
  if (!st || !st.done(s)) return s;
  const g = goalsOf(s);
  const r = st.reward;
  return {
    ...s,
    player: { ...s.player, salary: s.player.salary + (r.salary ?? 0) },
    officer: { ...s.officer, boosts: (s.officer.boosts ?? 0) + (r.boosts ?? 0) },
    goals: { ...g, ruby: g.ruby + (r.ruby ?? 0) },
    guide: { ...guideOf(s), step: guideOf(s).step + 1 },
  };
}
export function hideGuide(s: GameState, hidden: boolean): GameState {
  return { ...s, guide: { ...guideOf(s), hidden } };
}
