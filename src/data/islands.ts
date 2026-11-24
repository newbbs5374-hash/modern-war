// 분쟁 섬 12곳 = 실제로 여러 나라가 다투는 섬(11-24 대장 결정 "분쟁섬을 실제 국가이름을 사용해서").
// 게임 속 규칙(자원·영향력)은 그대로, 이름·위치·다투는 나라만 실제를 따름. 실제 갈등이라 두 이름을 함께 씀.
// 독도는 대한민국 땅이라 분쟁 섬으로 넣지 않음.

export interface RealIsland {
  /** 섬 이름(한국에서 흔히 부르는 이름) */
  name: string;
  /** 다른 나라에서 부르는 이름 */
  alt?: string;
  /** 다투는 나라 중 게임에 나오는 나라(영향력 +20%, 남이 1등이면 긴장) */
  sides: string[];
  /** 다투는 나라 중 게임에 안 나오는 나라·지역 */
  others: string[];
  /** 실제 이야기 한 줄 */
  story: string;
}

export const REAL_ISLANDS: Record<string, RealIsland> = {
  'p-dawn': {
    name: '센카쿠 열도',
    alt: '댜오위다오(중국)',
    sides: ['jp', 'cn'],
    others: ['대만'],
    story: '일본이 다스리지만 1971년부터 중국·대만이 자기 땅이라고 주장해요. 해경선이 자주 마주쳐요.',
  },
  'p-cheongseok': {
    name: '스프래틀리 군도',
    alt: '난사군도(중국)',
    sides: ['cn'],
    others: ['베트남', '필리핀', '말레이시아', '대만', '브루나이'],
    story: '여섯 나라가 나눠 차지한 남중국해 암초 무리예요. 중국이 인공섬을 만들고 활주로를 깔았어요.',
  },
  'p-twin': {
    name: '파라셀 군도',
    alt: '시사군도(중국)',
    sides: ['cn'],
    others: ['베트남', '대만'],
    story: '1974년 해전 뒤 중국이 차지했지만 베트남이 계속 돌려 달라고 해요. 섬 무리가 둘로 나뉘어 있어요.',
  },
  'p-coral': {
    name: '스카버러 암초',
    alt: '황옌다오(중국)',
    sides: ['cn'],
    others: ['필리핀', '대만'],
    story: '2012년 중국 해경이 필리핀 배를 몰아낸 뒤 사실상 중국이 막고 있는 산호 암초예요.',
  },
  'p-whale': {
    name: '남쿠릴 열도',
    alt: '북방 영토(일본)',
    sides: ['ru', 'jp'],
    others: [],
    story: '1945년 소련이 차지한 섬 4개예요. 이 문제 때문에 러시아와 일본은 아직 평화 조약을 맺지 못했어요.',
  },
  'p-blackrock': {
    name: '브랑겔 섬',
    sides: ['ru', 'us'],
    others: [],
    story: '러시아 북극의 얼음섬이에요. 미국 일부 민간 단체가 옛 탐험을 근거로 미국 땅이라고 주장해요.',
  },
  'p-turtle': {
    name: '웨이크 섬',
    sides: ['us'],
    others: ['마셜 제도'],
    story: '미국 공군이 쓰는 태평양 산호섬이에요. 마셜 제도는 옛날부터 자기 조상의 섬이라고 해요.',
  },
  'p-flame': {
    name: '아부무사·툰브 섬',
    sides: ['ir'],
    others: ['아랍에미리트'],
    story: '호르무즈 해협 입구의 섬 셋이에요. 1971년부터 이란이 다스리고 아랍에미리트가 돌려 달라고 해요.',
  },
  'p-southwind': {
    name: '코코 제도',
    sides: ['in', 'cn'],
    others: ['미얀마(주인)'],
    story: '미얀마 섬이지만 중국 감시 기지가 있다는 의혹이 있어, 바로 옆 안다만을 지키는 인도와 중국이 다퉈요.',
  },
  'p-southcross': {
    name: '카치섬',
    alt: '카차티부(스리랑카)',
    sides: ['in'],
    others: ['스리랑카'],
    story: '1974년 인도가 스리랑카에 넘긴 작은 섬이에요. 인도 어민들은 지금도 돌려받자고 해요.',
  },
  'p-storm': {
    name: '로콜 섬',
    sides: ['uk'],
    others: ['아일랜드', '아이슬란드', '덴마크'],
    story: '북대서양 한가운데 바위섬이에요. 영국이 1972년 자기 땅으로 정했지만 주변 바다를 두고 네 나라가 다퉈요.',
  },
  'p-fog': {
    name: '스발바르 제도',
    sides: ['ru'],
    others: ['노르웨이(주인)'],
    story: '노르웨이 섬이지만 조약 덕에 러시아도 탄광 마을을 두고 있어요. 북극 바닷길·광물을 두고 긴장이 커져요.',
  },
};

/** 섬을 다투는 게임 나라인지 */
export const claimsIsland = (island: string, country: string) => REAL_ISLANDS[island]?.sides.includes(country) ?? false;
/** 다투는 나라 영향력 덤 */
export const CLAIM_INFLUENCE = 0.2;
/** 다투는 나라가 아닌 나라가 1등일 때, 그 섬을 다투는 나라와 오르는 긴장(게임 1분마다) */
export const CLAIM_TENSION = 0.03;
