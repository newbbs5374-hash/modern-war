// 11-27 대장 요청: 대륙마다 '깡패 강대국'. 자국 우선주의로 이웃을 억누르고, 외교·전쟁 깡패짓을 일삼음.
// 실제 나라 이름은 쓰지만 지도자는 모두 가상 인물이고, 정책은 게임 속 풍자예요.
// 깡패 나라가 망하거나 내가 그 나라로 하면, 그 대륙의 AI 패권국이 '자국 우선' 깡패로 바뀜.

/** 깡패짓 종류
 * - tariff 관세 폭탄·가스 끊기·통행료: 상대 나라 예산을 며칠 깎음(동맹도 안 봐줌)
 * - tribute 방위비·보호비 청구: 상대 금고에서 돈을 뜯어 감
 * - land 역사적 영토 주장: 긴장을 크게 올리고, 차면 전쟁
 * - culture 문화 우기기: 상대 문화를 '원래 우리 것'이라 우겨 문화를 빼앗음
 * - proxy 대리 세력: 상대 나라에 무장 세력을 풀어 병력을 깎음
 * - deal 불공정 거래: 자원을 헐값에 가져가는 계약을 강요 */
export type BullyAct = 'tariff' | 'tribute' | 'land' | 'culture' | 'proxy' | 'deal';

export interface BullyDoctrine {
  /** 깡패 나라 id(없으면 대륙 패권국이 쓰는 기본 교리) */
  id: string;
  region: string;
  name: string;
  icon: string;
  slogan: string;
  /** 한 줄 설명(화면) */
  desc: string;
  /** 깡패짓 가중치 */
  acts: Partial<Record<BullyAct, number>>;
  /** 깡패짓 이름(교리마다 다른 말) */
  label: Partial<Record<BullyAct, string>>;
  /** 패권 전쟁 공격성 배율 */
  agg: number;
  /** 이웃 대륙까지 노림(미국: 세계 어디든) */
  global?: boolean;
  /** 동맹에게도 깡패짓(미국) */
  hitsAllies?: boolean;
  /** 더 센 나라에도 깡패짓(이란 대리 세력) */
  anyTarget?: boolean;
}

export const BULLIES: BullyDoctrine[] = [
  {
    id: 'us',
    region: 'americas',
    name: '아메리카 퍼스트',
    icon: '🦅',
    slogan: '"무조건 미국이 먼저다. 손해 보는 거래는 없다."',
    desc: '동맹이든 적이든 관세 폭탄을 던지고, 방위비를 청구하고, 마음에 안 들면 바로 전쟁. 세계 어디든 끼어들어요.',
    acts: { tariff: 4, tribute: 3, deal: 2, land: 1 },
    label: { tariff: '관세 폭탄', tribute: '방위비 청구', deal: '불공정 무역 협정', land: '"그 땅, 우리가 사겠다"' },
    agg: 1.7,
    global: true,
    hitsAllies: true,
  },
  {
    id: 'cn',
    region: 'asia',
    name: '동북공정',
    icon: '🐉',
    slogan: '"아시아의 모든 문화와 역사는 원래 우리 것이다."',
    desc: '이웃 나라 음식·옷·역사를 자기 것이라 우기고, 옛 왕조 땅을 내놓으라 하고, 빚으로 약한 나라를 묶어요.',
    acts: { culture: 5, land: 3, deal: 2, tariff: 1 },
    label: { culture: '문화 우기기', land: '역사 왜곡·영토 주장', deal: '빚 덫 계약', tariff: '수입 금지 보복' },
    agg: 1.6,
  },
  {
    id: 'ru',
    region: 'europe',
    name: '옛 제국 되찾기',
    icon: '🐻',
    slogan: '"옛 제국의 땅은 모두 우리 땅이다."',
    desc: '가스관을 잠가 이웃을 겁주고, 옛 제국 땅을 되찾겠다며 전쟁을 걸고, 무장 세력을 풀어요.',
    acts: { tariff: 3, land: 4, proxy: 2 },
    label: { tariff: '가스관 잠그기', land: '옛 영토 되찾기', proxy: '정체불명 무장 세력' },
    agg: 1.6,
  },
  {
    id: 'ir',
    region: 'mideast',
    name: '혁명 수출',
    icon: '🔥',
    slogan: '"우리 혁명은 국경을 모른다."',
    desc: '이웃 나라에 대리 세력을 풀고, 해협을 막아 석유 길을 끊고, 보호비를 뜯어요.',
    acts: { proxy: 5, tariff: 3, tribute: 1 },
    label: { proxy: '대리 세력 공격', tariff: '해협 봉쇄', tribute: '"안전 보장" 보호비' },
    agg: 1.5,
    anyTarget: true,
  },
  {
    id: 'eg',
    region: 'africa',
    name: '나일·운하의 주인',
    icon: '🐊',
    slogan: '"운하와 나일강을 지나는 건 모두 우리 허락을 받아라."',
    desc: '운하 통행료를 마음대로 올리고, 강물을 쥐고 자원을 헐값에 가져가고, 이웃 땅을 탐내요.',
    acts: { tariff: 4, deal: 3, land: 2 },
    label: { tariff: '운하 통행료 폭탄', deal: '나일강 물값 계약', land: '"옛 파라오 땅" 주장' },
    agg: 1.5,
    global: true,
  },
];

/** 깡패 나라가 없어진 대륙의 패권국이 쓰는 기본 교리 */
export const BULLY_GENERIC: BullyDoctrine = {
  id: '',
  region: '',
  name: '자국 우선',
  icon: '😈',
  slogan: '"이 대륙에서 우리 말이 곧 법이다."',
  desc: '대륙 1등이 된 나라가 관세·영토 주장·보호비로 이웃을 쥐어짜요.',
  acts: { tariff: 3, land: 2, tribute: 2, deal: 1 },
  label: { tariff: '관세 보복', land: '영토 주장', tribute: '보호비 청구', deal: '불공정 계약' },
  agg: 1.4,
};

export const ACT_ICON: Record<BullyAct, string> = { tariff: '💣', tribute: '💸', land: '🗺️', culture: '🏺', proxy: '🔫', deal: '⛓️' };

/** 동북공정: 나라마다 '원래 우리 것'이라 우기는 문화·역사 */
export const CULTURE_CLAIMS: Record<string, string[]> = {
  kr: ['김치', '한복', '아리랑', '고구려 역사', '단오', '태권도', '삼계탕', '갓'],
  kp: ['고구려 역사', '평양냉면', '발해 역사'],
  jp: ['다도', '기모노', '한자 서예', '분재'],
  tw: ['우롱차', '야시장 음식', '고궁 보물'],
  ph: ['남쪽 바다 섬들', '판싯 국수'],
  in: ['요가', '차(茶) 문화', '불교 성지'],
  pk: ['실크로드 유산', '간다라 불상'],
  au: ['남쪽 바다 지도', '광산 유산'],
};
export const CULTURE_CLAIM_DEFAULT = ['전통 음식', '전통 옷', '옛 왕조 역사', '전통 음악'];

/** 교리마다 SNS 글. {A} 깡패 나라, {B} 상대, {X} 우기는 것 */
export const BULLY_SNS: Record<BullyAct, string[]> = {
  tariff: [
    '"{B}산 물건에 관세 폭탄! 우리 노동자가 먼저입니다. 동맹? 계산은 따로입니다."',
    '"{B}, 공짜 점심은 끝났습니다. 오늘부터 문을 잠급니다."',
    '"{B:은} 우리 덕에 먹고살면서 감사할 줄 모르네요. 대가를 치르세요."',
  ],
  tribute: [
    '"{B}, 우리가 지켜 주는 값을 내세요. 안 내면 알아서 하시고요."',
    '"안전은 공짜가 아닙니다. {B}에 청구서를 보냈습니다."',
  ],
  land: [
    '"{B}의 그 땅은 역사적으로 우리 땅입니다. 지도를 다시 보세요."',
    '"{B:은} 우리 옛 땅을 잠시 빌려 쓰고 있을 뿐입니다."',
    '"{B}, 돌려받을 날이 머지않았습니다."',
  ],
  culture: [
    '"{X:은} 원래 우리 문화입니다. {B:은} 그걸 배워 갔을 뿐이죠."',
    '"{B}의 {X}? 우리 옛 책에 다 나옵니다. 원조는 우리예요."',
    '"세계 여러분, {X:은} 우리 것입니다. {B:은} 억지 부리지 마세요."',
  ],
  proxy: [
    '"{B}에서 일어난 일은 우리와 상관없습니다. 정말이에요."',
    '"{B}의 억압받는 사람들이 들고일어났을 뿐입니다."',
  ],
  deal: [
    '"{B:과} 아주 공정한 계약을 맺었습니다. 물론 우리에게 공정하죠."',
    '"{B}, 빌려 간 돈은 자원으로 갚으셔야죠."',
  ],
};
/** 당한 나라가 SNS로 맞서는 말 */
export const BULLY_DEFY: Record<BullyAct, string[]> = {
  tariff: ['"@{A} 친구에게 관세 폭탄이라니, 이게 동맹입니까?"'],
  tribute: ['"@{A} 돈 뜯는 걸 보호라고 부르지 마세요."'],
  land: ['"@{A} 우리 땅은 한 뼘도 못 내줍니다."'],
  culture: ['"@{A} {X:은} 우리 문화입니다. 역사를 바꿀 수는 없어요."', '"@{A} 남의 문화를 훔치는 게 대국입니까?"'],
  proxy: ['"@{A} 무장 세력 뒤에 숨지 마세요. 다 알고 있습니다."'],
  deal: ['"@{A} 이건 계약이 아니라 약탈입니다."'],
};
