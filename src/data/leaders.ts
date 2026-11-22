// 가상 AI 지도자(나라 이름·도시처럼 모두 가상). 성향은 기본값이고, 새 게임에서 "무작위"를 고를 수 있다.

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
  us: { name: '오리온 스타크', title: '집정관', personality: '공격형' },
  cn: { name: '룽샤오란', title: '국가원수', personality: '경제형' },
  ru: { name: '볼코라 세베린', title: '대공', personality: '공격형' },
  de: { name: '하겐 아이젠라트', title: '공작', personality: '방어형' },
  jp: { name: '아마기 소우겐', title: '국왕', personality: '방어형' },
  uk: { name: '에드윈 그레이번', title: '국왕', personality: '기회주의' },
  in: { name: '비크람 라자단', title: '연방 의장', personality: '경제형' },
  kr: { name: '한도윤', title: '대통령', personality: '방어형' },
  tr: { name: '볼칸 카라테페', title: '칸', personality: '기회주의' },
  il: { name: '아브넬 하리시', title: '수호관', personality: '공격형' },
  ir: { name: '다리우센', title: '최고 신관', personality: '공격형' },
  ua: { name: '야리나 졸로타', title: '대통령', personality: '방어형' },
  kp: { name: '강철명', title: '요새 사령관', personality: '공격형' },
};

export const PERSONALITY_LIST = Object.keys(PERSONALITIES) as Personality[];
