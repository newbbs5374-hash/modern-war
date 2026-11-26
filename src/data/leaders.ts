// AI 지도자(이름은 실제 같은 가상 인물). 성향은 기본값이고, 새 게임에서 "무작위"를 고를 수 있다.

export type Personality = '공격형' | '방어형' | '경제형' | '기회주의';

export interface PersonalityInfo {
  /** 침공을 거는 빈도 배율 */
  aggression: number;
  /** 긴장도가 오르는 빠르기 배율 */
  tension: number;
  /** 전쟁을 끝내고 휴전하려는 마음 배율 */
  peace: number;
  /** 나라 예산 배율 */
  budget: number;
  text: string;
}

export const PERSONALITIES: Record<Personality, PersonalityInfo> = {
  공격형: { aggression: 1.5, tension: 1.4, peace: 0.6, budget: 1.0, text: '먼저 치고 오래 싸움' },
  방어형: { aggression: 0.6, tension: 0.8, peace: 1.2, budget: 1.0, text: '지키는 데 강하고 먼저 치지 않음' },
  경제형: { aggression: 0.8, tension: 0.8, peace: 1.5, budget: 1.2, text: '돈을 모으고 손해 보는 전쟁은 빨리 끝냄' },
  기회주의: { aggression: 1.1, tension: 1.1, peace: 1.0, budget: 1.0, text: '약한 상대를 노리고 편을 잘 바꿈' },
};

/**
 * 나라 지도자(11-23 대장 결정: 실제 정치인이 아니라 그 나라에 흔한 "실제 같은 가상 이름").
 * 지도자 이름·직함은 여기 한 곳에서만 바꾸면 게임 전체(시작 화면·외교·대화·도감)에 반영된다.
 * 그림 파일 이름은 이름과 상관없이 leader-<나라 id>.png 그대로.
 */
export const LEADERS: Record<string, { name: string; title: string; personality: Personality }> = {
  us: { name: '제임스 하트웰', title: '대통령', personality: '공격형' },
  cn: { name: '천웨이밍', title: '국가주석', personality: '경제형' },
  ru: { name: '알렉세이 볼코프', title: '대통령', personality: '공격형' },
  de: { name: '클라우스 베르크만', title: '총리', personality: '방어형' },
  jp: { name: '다카하시 겐이치', title: '총리', personality: '방어형' },
  uk: { name: '에드워드 그레이엄', title: '총리', personality: '기회주의' },
  in: { name: '비크람 라오', title: '총리', personality: '경제형' },
  kr: { name: '한도윤', title: '대통령', personality: '방어형' },
  tr: { name: '메흐메트 카야', title: '대통령', personality: '기회주의' },
  il: { name: '다비드 레빈', title: '총리', personality: '공격형' },
  ir: { name: '하산 모라디', title: '최고지도자', personality: '공격형' },
  ua: { name: '올레나 코발렌코', title: '대통령', personality: '방어형' },
  kp: { name: '리철준', title: '국무위원장', personality: '공격형' },
  // 11-26 새 나라
  tw: { name: '린쥔훙', title: '총통', personality: '방어형' },
  pl: { name: '토마시 코발치크', title: '대통령', personality: '방어형' },
  ph: { name: '마리셀 산토스', title: '대통령', personality: '기회주의' },
  pk: { name: '타리크 잔주아', title: '총리', personality: '공격형' },
  sa: { name: '파이살 알라시드', title: '국왕', personality: '경제형' },
};

export const PERSONALITY_LIST = Object.keys(PERSONALITIES) as Personality[];
