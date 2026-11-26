// 훈련 미니게임 36개(11-25 대장 결정: 훈련마다 3개, 나중에 훈련마다 2개씩 뺄 예정).
// 끄고 켜기: 아래 목록의 on 을 false 로 바꾸면 그 미니게임은 훈련에서 나오지 않음(한 곳만 고치면 됨).
// 계산(점수 → 별)은 여기, 화면은 src/ui/battle/mini/*.
import { Rng } from '../game/rng';
import type { FreshFrame } from './fresh';

export interface MiniDef {
  id: string;
  training: string;
  name: string;
  /** 조작법 한 줄 */
  how: string;
  /** 제한 시간(초) */
  secs: number;
  /** false = 훈련에서 안 나옴 */
  on: boolean;
  /** 11-26 안 4: 3D 전투 모형으로 만든 화면 */
  three?: boolean;
  /** 11-26 새 훈련 틀(A 1인칭 · B 계획→재생 · C 대화 · D 관리판) */
  fresh?: FreshFrame;
}

export const MINIGAMES: MiniDef[] = [
  // 잠입
  { id: 'sneak-path', training: '잠입', name: '그림자 길 찾기', how: '옆 칸을 눌러 한 칸씩 이동. 경비병의 노란 시야에 들어가지 말고 🚩까지 가요.', secs: 75, on: true },
  { id: 'sneak-light', training: '잠입', name: '탐조등 박자', how: '누르고 있으면 멈추고, 떼면 달려요. 탐조등 빛 속에서 움직이면 들켜요.', secs: 60, on: true },
  { id: 'sneak-lock', training: '잠입', name: '소리 없이 자물쇠 따기', how: '◀ ▶로 다이얼을 돌리다 떨림이 가장 클 때 "딸깍". 3번 맞히면 열려요. 틀리면 소리가 나요.', secs: 70, on: true },
  // 체력
  { id: 'fit-run', training: '체력', name: '장애물 달리기', how: '저절로 달려요. 🚧 앞에서 점프, 〰️ 철조망 앞에서 포복.', secs: 60, on: true },
  { id: 'fit-march', training: '체력', name: '리듬 행군', how: '북소리(가운데 원)에 맞춰 표시된 발(왼발·오른발)을 눌러요.', secs: 50, on: true },
  { id: 'fit-pushup', training: '체력', name: '지구력 게이지', how: '눌러서 팔굽혀펴기. 너무 빨리 누르면 숨이 차서 멈춰요. 숨 막대를 노란 칸 아래로.', secs: 40, on: true },
  // 전술
  { id: 'tac-puzzle', training: '전술', name: '몇 수 제압 퍼즐', how: '우리 분대를 눌러 고르고, 같은 줄의 칸을 누르면 막힐 때까지 곧게 가요. 정해진 수 안에 적을 모두 제압.', secs: 90, on: true },
  { id: 'tac-cover', training: '전술', name: '엄폐 자리 찾기', how: '적은 화살표 방향으로 벽에 막힐 때까지 쏴요. 초록 줄에 병사 3명을 안전하게 놓고 "배치 끝".', secs: 80, on: true },
  { id: 'tac-route', training: '전술', name: '진격로 긋기', how: '출발 칸부터 손가락으로 끌어 길을 그려요. 지뢰·적 진지 옆은 피하고 짧게.', secs: 80, on: true },
  // 사격
  { id: 'shoot-popup', training: '사격', name: '튀어나오는 표적', how: '창문에 나온 적(🪖)만 빨리 눌러요. 민간인(🧑)을 쏘면 감점.', secs: 45, on: true },
  { id: 'shoot-sniper', training: '사격', name: '바람 보는 저격', how: '숨 참기로 흔들림을 줄이고, 바람 화살표만큼 반대쪽을 겨눠 발사. 5발.', secs: 60, on: true },
  { id: 'shoot-moving', training: '사격', name: '움직이는 표적', how: '탄이 0.4초 뒤에 닿아요. 달리는 표적 앞쪽을 미리 눌러요.', secs: 50, on: true },
  // 포격
  { id: 'arty-pull', training: '포격', name: '당겨서 쏘기', how: '포 쪽에서 손가락을 뒤로 당겼다 놓으면 발사. 당긴 방향·길이 = 각도·힘. 바람을 봐요. 5발.', secs: 70, on: true },
  { id: 'arty-adjust', training: '포격', name: '관측병 수정 사격', how: '거리·방향 다이얼을 맞추고 발사. 관측병이 "왼쪽 100" 처럼 알려 주면 고쳐서 다시. 표적 3개.', secs: 90, on: true },
  { id: 'arty-lead', training: '포격', name: '움직이는 대열 끊기', how: '포탄은 2초 뒤 떨어져요. 지나가는 적 대열 앞쪽 길을 눌러요. 6발.', secs: 50, on: true },
  // 정보
  { id: 'intel-diff', training: '정보', name: '위성 사진 비교', how: '어제(위)·오늘(아래) 사진에서 달라진 곳 5개를 아래 사진에서 눌러요.', secs: 70, on: true },
  { id: 'intel-cipher', training: '정보', name: '암호 풀기', how: '원판을 돌려 숫자가 "때·방향·행동" 순서의 말이 되면 "해독". 전문 4개.', secs: 80, on: true },
  { id: 'intel-link', training: '정보', name: '단서 잇기', how: '왼쪽 감청·사진 단서를 누르고, 그 뜻을 오른쪽에서 골라 이어요.', secs: 70, on: true },
  // 통솔
  { id: 'lead-line', training: '통솔', name: '방어선 옮기기', how: '분대를 누르고 길(세로 줄)을 누르면 옮겨 가요. 적이 아래까지 오지 않게 막아요.', secs: 60, on: true },
  { id: 'lead-morale', training: '통솔', name: '사기 지키기', how: '분대 사기 막대가 떨어지면 눌러서 격려. 0이 되면 분대가 흩어져요.', secs: 45, on: true },
  { id: 'lead-order', training: '통솔', name: '명령 순서 기억', how: '부관이 내린 명령 순서를 보고 똑같이 눌러요. 점점 길어져요.', secs: 80, on: true },
  // 보급
  { id: 'sup-road', training: '보급', name: '수송로 잇기', how: '도로 칸을 눌러 돌려서 왼쪽 🏭 기지와 오른쪽 🚩 전선을 끊김 없이 이어요. 3판.', secs: 90, on: true },
  { id: 'sup-truck', training: '보급', name: '트럭 짐 싣기', how: '상자를 고르고(↻ 돌리기) 짐칸을 누르면 그 자리에 실려요. 빈틈 없이 채워요.', secs: 75, on: true },
  { id: 'sup-ration', training: '보급', name: '배급 나누기', how: '부대마다 필요한 탄약·식량·연료만큼 + − 로 나눠 주고 "보내기". 3번.', secs: 75, on: true },
  // 해킹
  { id: 'hack-flow', training: '해킹', name: '회로 잇기', how: '같은 색 점에서 끌어 같은 색 점까지 선을 그어요. 선끼리 겹치면 안 돼요.', secs: 80, on: true },
  { id: 'hack-code', training: '해킹', name: '비밀번호 맞히기', how: '숫자 4개(1~6, 겹침 없음)를 넣으면 ●자리·숫자 맞음 ○숫자만 맞음. 8번 안에.', secs: 90, on: true },
  { id: 'hack-firewall', training: '해킹', name: '방화벽 뚫기', how: '흘러가는 글자 중 목표 글자가 가운데 칸에 들어오면 눌러요. 8개.', secs: 50, on: true },
  // 모병
  { id: 'rec-interview', training: '모병', name: '지원자 면접', how: '조건에 맞으면 합격(→), 아니면 불합격(←). 서류를 밀거나 버튼을 눌러요.', secs: 50, on: true },
  { id: 'rec-speech', training: '모병', name: '연설 카드', how: '청중의 기분을 보고 맞는 연설 카드를 골라요. 8번.', secs: 50, on: true },
  { id: 'rec-poster', training: '모병', name: '홍보 포스터 붙이기', how: '포스터 4장을 붙여요. 한 장이 3×3칸 사람에게 보여요. 사람 많은 곳을 덮어요.', secs: 60, on: true },
  // 항공
  { id: 'air-intercept', training: '항공', name: '요격 비행', how: '화면을 끌면 전투기가 따라와요. 사격은 저절로. 적 총알을 피해요.', secs: 45, on: true },
  { id: 'air-landing', training: '항공', name: '항모 착륙', how: '출력 ▲▼으로 속도, 기수 ▲▼으로 내려가는 빠르기를 초록 칸에 맞춰 갑판에 내려요. 3번.', secs: 80, on: true },
  { id: 'air-flare', training: '항공', name: '미사일 따돌리기', how: '미사일이 노란 칸까지 오면 플레어! 너무 빠르면 다시 쫓아오고, 늦으면 맞아요. 10발.', secs: 55, on: true },
  // 해상
  { id: 'sea-sonar', training: '해상', name: '소나 사냥', how: '소나 칸을 누르면 잠수함까지 거리(칸 수)가 나와요. 찾았다 싶으면 💣 폭뢰로 바꿔 눌러요. 3척.', secs: 90, on: true },
  { id: 'sea-torpedo', training: '해상', name: '어뢰 피하기', how: '◀ ▶을 눌러 배를 옮겨 어뢰를 피해요.', secs: 45, on: true },
  { id: 'sea-formation', training: '해상', name: '함대 대형', how: '보여 준 대형을 기억했다가, 배를 고르고 칸을 눌러 똑같이 놓아요. 3번.', secs: 80, on: true },
  // 11-26 안 4: 2D 미니게임 8개를 3D 모형 화면으로(규칙은 같음)
  { id: 'm3-shoot-popup', training: '사격', name: '3D 마을 표적', how: '3D 마을 창문·골목에 나온 적 병사만 빨리 눌러요. 민간인을 쏘면 감점.', secs: 45, on: true, three: true },
  { id: 'm3-shoot-moving', training: '사격', name: '3D 달리는 차량', how: '탄이 조금 늦게 닿아요. 달리는 적 차량 앞쪽 땅을 미리 눌러요.', secs: 50, on: true, three: true },
  { id: 'm3-arty-lead', training: '포격', name: '3D 대열 끊기', how: '포탄은 2초 뒤 떨어져요. 다가오는 전차 대열 앞쪽 길을 눌러요. 6발.', secs: 50, on: true, three: true },
  { id: 'm3-sea-torpedo', training: '해상', name: '3D 어뢰 피하기', how: '◀ ▶을 눌러 구축함을 옮겨 하얀 물살(어뢰)을 피해요.', secs: 45, on: true, three: true },
  { id: 'm3-sea-sonar', training: '해상', name: '3D 소나 사냥', how: '바다 칸을 누르면 잠수함까지 거리가 떠요. 찾았다 싶으면 💣 폭뢰로 바꿔 눌러요. 3척.', secs: 90, on: true, three: true },
  { id: 'm3-air-intercept', training: '항공', name: '3D 요격 비행', how: '화면을 끌면 전투기가 따라와요. 사격은 저절로. 적 총알을 피해요.', secs: 45, on: true, three: true },
  { id: 'm3-air-flare', training: '항공', name: '3D 미사일 따돌리기', how: '미사일이 노란 원까지 오면 플레어! 너무 빠르면 다시 쫓아오고, 늦으면 맞아요. 10발.', secs: 55, on: true, three: true },
  { id: 'm3-sneak-light', training: '잠입', name: '3D 탐조등 박자', how: '누르고 있으면 멈추고, 떼면 달려요. 탐조등 빛 속에서 움직이면 들켜요.', secs: 60, on: true, three: true },
  // 11-26 새 훈련 틀 A "1인칭 눈높이"
  { id: 'n-shoot-scope', training: '사격', name: '1인칭 조준경 사격', how: '화면을 끌어 겨눠요. 🔭 조준하면 크게 보이고, 🫁 숨을 참는 동안 흔들림이 줄어요. 쏘면 총구가 튀어 올라요. 일어선 적 12명.', secs: 75, on: true, three: true, fresh: 'A' },
  { id: 'n-air-cockpit', training: '항공', name: '조종석 비행', how: '조종석에서 날아요. 누른 채 끌면 조종간: 옆으로 끌면 돌고, 아래로 끌면 올라가요. 산 사이 주황 고리 12개를 통과해요. 땅에 닿으면 감점.', secs: 90, on: true, three: true, fresh: 'A' },
  { id: 'n-sneak-fp', training: '잠입', name: '1인칭 그림자 잠입', how: '내 눈높이로 적 기지를 걸어요. 노란 시야 부채꼴 안에 들어가면 들킴 막대가 차요. 벽 뒤로 숨고, 웅크리면 발소리가 작아요. 초록 깃발까지.', secs: 100, on: true, three: true, fresh: 'A' },
  { id: 'n-arty-observe', training: '포격', name: '관측병 무전', how: '쌍안경으로 표적을 봐요. 포탄이 떨어진 곳을 보고 "좌·우·가까이·멀리 50"을 골라 다시 요청해요. 표적 3개, 표적마다 5발.', secs: 120, on: true, three: true, fresh: 'A' },
  { id: 'n-sea-bridge', training: '해상', name: '함교 조함', how: '함교에서 키와 속도로 배를 몰아요. 큰 배는 천천히 돌고 조류에 밀려요. 부표 사이로 들어가 초록 선석에 천천히 곧게 대고 ⚓ 계류.', secs: 150, on: true, three: true, fresh: 'A' },
  { id: 'n-fit-run3d', training: '체력', name: '3D 달리기 코스', how: '뒤에서 본 달리기. 밀어서 ◀▶ 줄 바꾸기, ⬆ 허들 넘기, ⬇ 철조망 포복. 숨 막대가 바닥나면 끝. 💧 물병으로 숨 회복.', secs: 70, on: true, three: true, fresh: 'A' },
];

export const miniById = (id: string): MiniDef | undefined => MINIGAMES.find((m) => m.id === id);

/** 이 훈련에서 나오는 미니게임(켜진 것).
 *  11-26 대장 지시: 훈련에서 2D 미니게임은 모두 뺌 → 훈련에는 3D 미니게임(three)만 나옴.
 *  2D 미니게임 목록은 점령지 관리 임무가 아직 쓰므로 남겨 둠. */
export function minisFor(training: string): MiniDef[] {
  return MINIGAMES.filter((m) => m.training === training && m.on && m.three);
}

/** 고른 미니게임(3D만). 없으면 undefined → 훈련은 3D 실전으로 */
export function pickMini(training: string, seed: number, want?: string): MiniDef | undefined {
  const list = minisFor(training);
  if (!list.length) return undefined;
  return list.find((m) => m.id === want) ?? list[Math.abs(seed) % list.length];
}

/** 계급이 오르면 조금씩 어려워짐(1 ~ 2) */
export const miniLevel = (rank: number) => 1 + Math.min(10, Math.max(0, rank)) * 0.1;

/** 점수(0~1) → 결과. 0.4 넘으면 성공, 0.65 별 2, 0.85 별 3 */
export const STAR_AT = [0.4, 0.65, 0.85];
export function miniOutcome(score: number, name: string): { win: boolean; stars: number; text: string } {
  const s = Math.max(0, Math.min(1, score));
  const stars = s >= STAR_AT[2] ? 3 : s >= STAR_AT[1] ? 2 : s >= STAR_AT[0] ? 1 : 0;
  const pct = Math.round(s * 100);
  return { win: stars > 0, stars, text: `${name} ${pct}점${stars === 0 ? ` · ${Math.round(STAR_AT[0] * 100)}점부터 성공` : ''}` };
}

/** 자동·즉시완료·부관: 스탯으로 점수를 냄(별은 최대 2개로 따로 묶임) */
export function autoMini(id: string, stats: Record<string, number>, rank: number, seed: number) {
  const m = miniById(id) ?? MINIGAMES[0];
  const key = { 잠입: '은밀', 체력: '체력', 전술: '전술', 사격: '사격', 포격: '포격', 정보: '정보', 통솔: '통솔', 보급: '군수', 해킹: '정보', 모병: '정치', 항공: '전술', 해상: '전술' }[m.training] ?? '전술';
  const f = Math.min(1, (stats[key] ?? 8) / (20 + rank * 10));
  const r = new Rng(seed >>> 0);
  return miniOutcome(0.45 + 0.35 * f + r.range(-0.05, 0.05), m.name);
}
