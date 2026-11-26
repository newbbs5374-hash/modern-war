// 지금 세계 정세(11-24 대장 지시 "러시아-우크라이나 같이 현재 전쟁 상황도 적용").
// 새 판을 "지금 세계 정세로 시작"하면 아래 관계로 출발해요(끄면 예전처럼 모두 평화로 출발).
// 전투 콘텐츠는 손대지 않고 외교 관계·긴장·제재·전선 도시 방어도만 정해요.
import type { Relation } from './world';

export interface NowConflict {
  a: string;
  b: string;
  rel: Relation;
  /** 휴전·중립일 때 시작 긴장(0~100, 100이면 전쟁) */
  tension: number;
  /** 전쟁 피로도(높을수록 휴전하기 쉬움) */
  weariness: number;
  icon: string;
  name: string;
  /** 짧은 설명(시작 화면·소식) */
  text: string;
}

export const NOW_CONFLICTS: NowConflict[] = [
  {
    a: 'ru', b: 'ua', rel: '전쟁', tension: 0, weariness: 0, icon: '⚔️', name: '러시아-우크라이나 전쟁',
    text: '2022년 2월부터 이어진 전쟁이 아직 끝나지 않았어요. 하르키우가 전선이에요.',
  },
  {
    a: 'il', b: 'ir', rel: '휴전', tension: 60, weariness: 0, icon: '🔥', name: '이스라엘-이란 대치',
    text: '서로 공습을 주고받은 뒤 불안한 휴전 중이에요. 언제든 다시 터질 수 있어요.',
  },
  {
    a: 'kp', b: 'kr', rel: '휴전', tension: 30, weariness: 0, icon: '🪖', name: '한반도 정전',
    text: '1953년 정전 협정 뒤 전쟁이 법적으로 끝나지 않은 상태예요.',
  },
  {
    a: 'cn', b: 'in', rel: '중립', tension: 40, weariness: 0, icon: '🏔️', name: '중국-인도 국경 대치',
    text: '히말라야 국경을 두고 군대가 마주 서 있어요.',
  },
  {
    a: 'cn', b: 'us', rel: '중립', tension: 35, weariness: 0, icon: '🌊', name: '미·중 패권 경쟁',
    text: '무역·반도체·바닷길을 두고 다투고 있어요.',
  },
  // 11-26 새 나라 5개
  {
    a: 'cn', b: 'tw', rel: '중립', tension: 70, weariness: 0, icon: '🌊', name: '대만 해협 위기',
    text: '중국이 대만을 둘러싸고 해상 훈련을 거듭해요. 해협에 군함이 가득해요.',
  },
  {
    a: 'ru', b: 'pl', rel: '중립', tension: 45, weariness: 0, icon: '🛡️', name: '폴란드 동쪽 국경 긴장',
    text: '폴란드가 국경에 장벽과 군대를 세웠어요. 러시아 칼리닌그라드와 마주 보고 있어요.',
  },
  {
    a: 'cn', b: 'ph', rel: '중립', tension: 50, weariness: 0, icon: '🪸', name: '남중국해 암초 충돌',
    text: '중국 해경이 필리핀 보급선에 물대포를 쏘는 일이 이어지고 있어요.',
  },
  {
    a: 'in', b: 'pk', rel: '휴전', tension: 50, weariness: 0, icon: '🏔️', name: '카슈미르 대치',
    text: '두 핵 보유국이 카슈미르 통제선을 사이에 두고 포격을 주고받은 뒤 휴전 중이에요.',
  },
  {
    a: 'ir', b: 'sa', rel: '중립', tension: 50, weariness: 0, icon: '🛢️', name: '걸프만 맞수',
    text: '걸프만을 사이에 두고 이란과 사우디가 오래 맞서 왔어요. 석유 시설이 공격받은 적도 있어요.',
  },
];

/** 전쟁 중인 전선 도시 → 시작 방어도(최대 100) */
export const FRONT_CITIES: Record<string, number> = { 하르키우: 55, 오데사: 85 };

/** 국제 제재를 받고 시작하는 나라 → 제재 기간(게임 날) */
export const START_SANCTIONS: Record<string, number> = { ru: 7 };

/** 나라 하나가 지금 겪는 분쟁들 */
export const conflictsOf = (id: string) => NOW_CONFLICTS.filter((c) => c.a === id || c.b === id);
/** 분쟁의 상대 나라 */
export const otherSide = (c: NowConflict, id: string) => (c.a === id ? c.b : c.a);
