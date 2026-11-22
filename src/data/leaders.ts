// 가상 AI 지도자(실제 정치인 이름·얼굴은 쓰지 않음). 성향은 기본값이고, 새 게임에서 "무작위"를 고를 수 있다.

export type Personality = '공격형' | '방어형' | '경제형' | '기회주의';

export interface PersonalityInfo {
  /** 침공을 거는 빈도 배율 */
  aggression: number;
  /** 긴장도가 오르는 빠르기 배율 */
  tension: number;
  /** 전쟁을 끝내고 휴전하려는 마음 배율 */
  peace: number;
  /** 국방예산 배율 */
  budget: number;
  text: string;
}

export const PERSONALITIES: Record<Personality, PersonalityInfo> = {
  공격형: { aggression: 1.5, tension: 1.4, peace: 0.6, budget: 1.0, text: '먼저 치고 오래 싸움' },
  방어형: { aggression: 0.6, tension: 0.8, peace: 1.2, budget: 1.0, text: '지키는 데 강하고 먼저 치지 않음' },
  경제형: { aggression: 0.8, tension: 0.8, peace: 1.5, budget: 1.2, text: '돈을 모으고 손해 보는 전쟁은 빨리 끝냄' },
  기회주의: { aggression: 1.1, tension: 1.1, peace: 1.0, budget: 1.0, text: '약한 상대를 노리고 편을 잘 바꿈' },
};

export const LEADERS: Record<string, { name: string; title: string; personality: Personality }> = {
  us: { name: '엘리엇 브랜트', title: '대통령', personality: '공격형' },
  cn: { name: '량원쉬', title: '주석', personality: '경제형' },
  ru: { name: '볼코프 아르템', title: '대통령', personality: '공격형' },
  de: { name: '마렌 크뤼거', title: '총리', personality: '방어형' },
  jp: { name: '시노하라 레이지', title: '총리', personality: '방어형' },
  uk: { name: '헨리 애슈크로프트', title: '총리', personality: '기회주의' },
  in: { name: '아르준 메라', title: '총리', personality: '경제형' },
  kr: { name: '서지환', title: '대통령', personality: '방어형' },
  tr: { name: '케렘 아스란', title: '대통령', personality: '기회주의' },
  il: { name: '다니엘 오르벡', title: '총리', personality: '공격형' },
  ir: { name: '대신관 파르자드', title: '최고 지도자', personality: '공격형' },
  ua: { name: '올레나 코브추크', title: '대통령', personality: '방어형' },
  kp: { name: '림철웅', title: '위원장', personality: '공격형' },
};

export const PERSONALITY_LIST = Object.keys(PERSONALITIES) as Personality[];
