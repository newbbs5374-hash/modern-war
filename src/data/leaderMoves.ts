// 외국 지도자의 강한 행동(11-24 대장 지시): 나라마다 성격을 살린 압박 카드 + 세계 소식.
// 압박 카드는 돌발 사건 창으로 뜨고(실제 4~7시간마다), 2~3개 중 하나로 대응해요. {X} = 그 나라, {L} = 그 나라 지도자.
// 세계 소식은 플레이어와 상관없이 다른 나라끼리 벌이는 일로, 그 나라 사이 긴장을 올려요.
import type { CrisisDef } from '../game/crisis';

/** 압박 카드: actor = 행동하는 나라, onlyFor = 이 나라 지도자일 때만, notFor = 이 나라면 안 나옴 */
export type PressureDef = CrisisDef & { actor: string; onlyFor?: string[]; notFor?: string[]; needRival?: boolean };

const P = (d: Omit<PressureDef, 'target'>): PressureDef => ({ ...d, target: 'any' });

export const PRESSURES: PressureDef[] = [
  // ── 미국: 관세·방위비·줄 세우기 ──
  P({
    id: 'p-us-tariff',
    actor: 'us',
    icon: '📦',
    title: '미국의 관세 폭탄',
    text: '{L}이(가) "불공정 무역"이라며 우리 수출품에 25% 관세를 매기겠다고 발표했어요. 마감은 일주일이래요.',
    auto: 1,
    options: [
      { label: '맞관세로 맞서요', fx: [{ k: 'money', v: -1500 }, { k: 'favor', who: 'target', v: -12 }, { k: 'approval', v: 4 }, { k: 'tension', v: 8 }], say: '국민은 박수를 치지만 {X}의 표정이 굳었습니다.' },
      { label: '협상해서 미국산 무기를 사요', fx: [{ k: 'money', v: -3000 }, { k: 'favor', who: 'target', v: 10 }, { k: 'research', v: 2 }], say: '관세는 피했습니다. 대신 무기 구매 계약서에 서명했어요.' },
      { label: '그냥 받아들여요', fx: [{ k: 'money', v: -2500 }, { k: 'trust', v: -4 }], say: '수출 기업들이 울상입니다, 지도자님.' },
    ],
  }),
  P({
    id: 'p-us-share',
    actor: 'us',
    icon: '💵',
    title: '방위비 분담금 5배 요구',
    text: '{L}이(가) "공짜 안보는 없다"며 주둔 미군 방위비를 다섯 배로 올리라고 요구했어요.',
    onlyFor: ['kr', 'jp', 'de', 'uk', 'il'],
    auto: 1,
    options: [
      { label: '단호히 거절해요', fx: [{ k: 'favor', who: 'target', v: -15 }, { k: 'approval', v: 5 }], say: '자존심은 지켰지만 동맹이 삐걱거립니다.' },
      { label: '조금만 올려 줘요', fx: [{ k: 'money', v: -2000 }, { k: 'favor', who: 'target', v: 6 }], say: '서로 한 발씩 물러섰습니다.' },
      { label: '요구를 다 들어줘요', fx: [{ k: 'money', v: -5000 }, { k: 'favor', who: 'target', v: 15 }, { k: 'trust', v: -6 }], say: '동맹은 든든해졌지만 의회가 들끓습니다.' },
    ],
  }),
  P({
    id: 'p-us-chips',
    actor: 'us',
    icon: '🔌',
    title: '반도체 줄 세우기',
    text: '{L}이(가) "중국에 반도체를 팔면 우리 시장에서 빼겠다"며 편을 고르라고 압박해요.',
    notFor: ['cn'],
    auto: 0,
    options: [
      { label: '미국 편에 서요', fx: [{ k: 'favor', who: 'target', v: 10 }, { k: 'money', v: -1500 }, { k: 'res', r: '반도체', v: 10 }], say: '미국이 기술을 나눠 주기로 했습니다. 중국은 불쾌해합니다.' },
      { label: '양쪽에 다 팔아요', fx: [{ k: 'money', v: 2000 }, { k: 'favor', who: 'target', v: -10 }], say: '돈은 벌었지만 미국의 눈초리가 매섭습니다.' },
    ],
  }),
  // ── 중국: 경제 보복·희토류·바다 ──
  P({
    id: 'p-cn-rare',
    actor: 'cn',
    icon: '🧲',
    title: '희토류 수출 금지',
    text: '{L}이(가) 우리 나라에 희토류 수출을 막았어요. 미사일·전기차 공장이 멈출 수 있어요.',
    auto: 1,
    options: [
      { label: '다른 나라에서 비싸게 사요', fx: [{ k: 'money', v: -3000 }, { k: 'res', r: '희토류', v: 10 }], say: '급한 불은 껐습니다. 값이 꽤 비쌌어요.' },
      { label: '중국과 몰래 타협해요', fx: [{ k: 'favor', who: 'target', v: 8 }, { k: 'trust', v: -4 }], say: '수출이 풀렸지만 "굴복 외교"라는 비판이 나옵니다.' },
      { label: '비축분으로 버텨요', fx: [{ k: 'res', r: '희토류', v: -15 }, { k: 'approval', v: 2 }], say: '비축 창고가 빠르게 비고 있습니다.' },
    ],
  }),
  P({
    id: 'p-cn-tour',
    actor: 'cn',
    icon: '🧳',
    title: '단체 관광 금지 보복',
    text: '우리가 미국 미사일 방어 체계를 들이자 {L}이(가) 단체 관광과 우리 드라마·상품을 막았어요.',
    notFor: ['us'],
    auto: 2,
    options: [
      { label: '사과하고 배치를 늦춰요', fx: [{ k: 'favor', who: 'target', v: 12 }, { k: 'trust', v: -5 }, { k: 'approval', v: -3 }], say: '보복은 풀렸지만 국민 자존심이 상했습니다.' },
      { label: 'WTO에 제소해요', fx: [{ k: 'money', v: -800 }, { k: 'fame', v: 6 }, { k: 'favor', who: 'target', v: -6 }], say: '국제 사회가 우리 편을 들어 주고 있어요.' },
      { label: '새 시장을 찾아요', fx: [{ k: 'money', v: -2000 }, { k: 'favor', who: 'all', v: 2 }], say: '동남아·중동으로 수출 길을 넓혔습니다.' },
    ],
  }),
  P({
    id: 'p-cn-sea',
    actor: 'cn',
    icon: '🏗️',
    title: '바다 위 수상한 구조물',
    text: '{X}이(가) 우리 바다 가까이에 "양식장"이라며 거대한 철제 구조물을 세웠어요.',
    onlyFor: ['kr', 'jp', 'in'],
    auto: 1,
    options: [
      { label: '해군을 보내 맞대응해요', fx: [{ k: 'tension', v: 15 }, { k: 'approval', v: 4 }, { k: 'troops', v: -0.005 }], say: '해경과 해군이 구조물 앞에 섰습니다. 팽팽합니다.' },
      { label: '외교 항의만 해요', fx: [{ k: 'trust', v: -2 }, { k: 'favor', who: 'target', v: -3 }], say: '{X}은(는) 들은 척도 하지 않습니다.' },
      { label: '우리도 구조물을 세워요', fx: [{ k: 'money', v: -2500 }, { k: 'tension', v: 8 }, { k: 'fame', v: 5 }], say: '맞불 구조물 공사가 시작됐습니다.' },
    ],
  }),
  // ── 러시아: 가스·핵 위협·용병 ──
  P({
    id: 'p-ru-gas',
    actor: 'ru',
    icon: '🔥',
    title: '가스관 잠그기',
    text: '{L}이(가) "적대국에는 겨울을 선물하겠다"며 가스 공급을 끊었어요.',
    notFor: ['ir', 'kp', 'cn'],
    auto: 1,
    options: [
      { label: '비싼 LNG를 사요', fx: [{ k: 'money', v: -3500 }, { k: 'approval', v: 2 }], say: '난방은 지켰습니다. 대신 예산이 크게 빠졌어요.' },
      { label: '원전을 더 돌려요', fx: [{ k: 'res', r: '우라늄', v: -6 }, { k: 'research', v: 2 }], say: '원전이 쉬지 않고 돌아갑니다.' },
      { label: '국민에게 아껴 달라고 해요', fx: [{ k: 'approval', v: -5 }, { k: 'trust', v: -2 }], say: '추운 겨울, 불만이 커지고 있습니다.' },
    ],
  }),
  P({
    id: 'p-ru-nuke',
    actor: 'ru',
    icon: '☢️',
    title: '전술핵 위협 발언',
    text: '{L}이(가) TV 연설에서 "레드라인을 넘으면 어떤 무기도 쓸 수 있다"고 말했어요.',
    needRival: true,
    auto: 1,
    options: [
      { label: '동맹과 함께 강하게 경고해요', fx: [{ k: 'favor', who: 'rivals', v: -4 }, { k: 'tension', v: 10 }, { k: 'approval', v: 3 }], say: '연합 성명이 나왔습니다. 긴장이 높아졌어요.' },
      { label: '대화 채널을 열어요', fx: [{ k: 'tension', v: -10 }, { k: 'favor', who: 'target', v: 5 }, { k: 'trust', v: -2 }], say: '긴장이 조금 풀렸습니다.' },
      { label: '방공망을 비상 가동해요', fx: [{ k: 'money', v: -2000 }, { k: 'intel', v: 8 }], say: '모든 레이더가 깨어 있습니다.' },
    ],
  }),
  P({
    id: 'p-ru-merc',
    actor: 'ru',
    icon: '🪖',
    title: '용병 기업 침투',
    text: '{X}의 민간 군사 기업이 우리 주변국에서 활동을 넓히고 있다는 첩보예요.',
    auto: 0,
    options: [
      { label: '첩보 작전으로 막아요', fx: [{ k: 'intel', v: -10 }, { k: 'fame', v: 5 }, { k: 'favor', who: 'target', v: -6 }], say: '거점 두 곳을 찾아냈습니다.' },
      { label: '지켜보기만 해요', fx: [{ k: 'tension', v: 5 }], say: '아직은 큰일이 없지만 불안합니다.' },
    ],
  }),
  // ── 북한: 대남 도발 ──
  P({
    id: 'p-kp-missile',
    actor: 'kp',
    icon: '🚀',
    title: '북한 탄도미사일 발사',
    text: '{L}이(가) 동해로 탄도미사일 3발을 쏘았어요. 한 발은 우리 영해 가까이 떨어졌어요.',
    onlyFor: ['kr', 'jp', 'us'],
    auto: 1,
    options: [
      { label: '맞대응 사격 훈련을 해요', fx: [{ k: 'money', v: -1200 }, { k: 'tension', v: 10 }, { k: 'approval', v: 4 }], say: '정밀 타격 미사일로 맞대응했습니다.' },
      { label: '긴급 안보리 회의를 요청해요', fx: [{ k: 'favor', who: 'all', v: 3 }, { k: 'fame', v: 4 }], say: '국제 사회가 북한을 규탄했습니다.' },
      { label: '조용히 지켜봐요', fx: [{ k: 'approval', v: -4 }, { k: 'trust', v: -3 }], say: '"너무 약하다"는 여론이 일고 있습니다.' },
    ],
  }),
  P({
    id: 'p-kp-balloon',
    actor: 'kp',
    icon: '🎈',
    title: '오물 풍선 살포',
    text: '북한이 오물과 쓰레기를 단 풍선 수백 개를 우리 쪽으로 날려 보냈어요. 공항 운영이 멈췄어요.',
    onlyFor: ['kr'],
    auto: 1,
    options: [
      { label: '확성기 방송을 다시 틀어요', fx: [{ k: 'tension', v: 12 }, { k: 'approval', v: 3 }], say: '전방에서 확성기가 다시 울립니다. {X}이(가) 펄쩍 뜁니다.' },
      { label: '수거·방역에 집중해요', fx: [{ k: 'money', v: -800 }, { k: 'trust', v: 2 }], say: '군과 지자체가 밤새 풍선을 치웠습니다.' },
      { label: '대북 전단을 막아 달래요', fx: [{ k: 'tension', v: -8 }, { k: 'approval', v: -3 }], say: '긴장은 줄었지만 "굴종"이라는 비판이 있습니다.' },
    ],
  }),
  P({
    id: 'p-kp-nll',
    actor: 'kp',
    icon: '⚓',
    title: '서해 NLL 침범',
    text: '북한 경비정이 서해 북방한계선을 넘어와 우리 어선을 위협했어요.',
    onlyFor: ['kr'],
    auto: 0,
    options: [
      { label: '경고 사격으로 쫓아내요', fx: [{ k: 'tension', v: 8 }, { k: 'fame', v: 6 }], say: '경비정이 물러갔습니다. 해군의 대응이 칭찬받고 있어요.' },
      { label: '함정을 늘려 지켜요', fx: [{ k: 'money', v: -1500 }, { k: 'troops', v: -0.003 }, { k: 'trust', v: 2 }], say: '서해 경계가 두 배로 강화됐습니다.' },
      { label: '통신으로 돌아가라 해요', fx: [{ k: 'approval', v: -3 }], say: '경비정은 한참 버티다 돌아갔습니다.' },
    ],
  }),
  P({
    id: 'p-kp-gps',
    actor: 'kp',
    icon: '📡',
    title: 'GPS 교란 공격',
    text: '북한이 접경 지역에 GPS 교란 전파를 쏘아 비행기·선박 수백 척이 길을 잃을 뻔했어요.',
    onlyFor: ['kr'],
    auto: 1,
    options: [
      { label: '전자전으로 역교란해요', fx: [{ k: 'intel', v: 10 }, { k: 'tension', v: 6 }], say: '교란 장비 위치를 찾아냈습니다.' },
      { label: '항법 장비를 바꿔요', fx: [{ k: 'money', v: -1800 }, { k: 'res', r: '반도체', v: -4 }, { k: 'research', v: 2 }], say: '새 항법 체계를 들였습니다.' },
    ],
  }),
  P({
    id: 'p-kp-nuke',
    actor: 'kp',
    icon: '💥',
    title: '7차 핵실험 징후',
    text: '위성 사진에 북한 핵실험장 갱도가 다시 열린 모습이 찍혔어요. {L}은(는) "핵 무력 완성"을 외치고 있어요.',
    onlyFor: ['kr', 'jp', 'us', 'cn'],
    auto: 1,
    options: [
      { label: '연합 훈련을 크게 열어요', fx: [{ k: 'money', v: -2500 }, { k: 'tension', v: 12 }, { k: 'fame', v: 5 }], say: '항모와 폭격기가 한반도로 모였습니다.' },
      { label: '특사를 보내 말려요', fx: [{ k: 'tension', v: -12 }, { k: 'money', v: -500 }, { k: 'trust', v: -2 }], say: '특사가 평양으로 떠났습니다.' },
      { label: '추가 제재를 주도해요', fx: [{ k: 'favor', who: 'all', v: 2 }, { k: 'favor', who: 'target', v: -10 }], say: '유엔에서 새 제재안이 나왔습니다.' },
    ],
  }),
  // ── 일본 ──
  P({
    id: 'p-jp-dokdo',
    actor: 'jp',
    icon: '🏝️',
    title: '독도 영유권 주장',
    text: '{X} 정부가 새 교과서와 방위백서에 "다케시마는 일본 땅"이라고 넣었어요.',
    onlyFor: ['kr'],
    auto: 0,
    options: [
      { label: '대사를 불러 강하게 항의해요', fx: [{ k: 'favor', who: 'target', v: -8 }, { k: 'approval', v: 5 }], say: '국민들이 정부의 단호함을 지지합니다.' },
      { label: '독도 방어 훈련을 공개해요', fx: [{ k: 'money', v: -1000 }, { k: 'tension', v: 8 }, { k: 'fame', v: 6 }], say: '독도 상공에 전투기가 날았습니다.' },
      { label: '조용한 외교로 넘어가요', fx: [{ k: 'favor', who: 'target', v: 3 }, { k: 'approval', v: -5 }], say: '"저자세 외교"라는 비판이 쏟아집니다.' },
    ],
  }),
  P({
    id: 'p-jp-export',
    actor: 'jp',
    icon: '🧪',
    title: '반도체 소재 수출 규제',
    text: '{L}이(가) 안보를 이유로 반도체 핵심 소재 3가지의 수출을 묶었어요.',
    onlyFor: ['kr', 'cn'],
    auto: 1,
    options: [
      { label: '소재를 국산화해요', fx: [{ k: 'money', v: -3000 }, { k: 'research', v: 5 }, { k: 'approval', v: 3 }], say: '연구소와 기업이 국산화에 뛰어들었습니다.' },
      { label: '수입처를 바꿔요', fx: [{ k: 'money', v: -1500 }, { k: 'res', r: '반도체', v: -5 }], say: '공장은 계속 돌아가지만 비용이 올랐어요.' },
      { label: '협상으로 풀어요', fx: [{ k: 'favor', who: 'target', v: 8 }, { k: 'trust', v: -3 }], say: '규제가 조금 풀렸습니다.' },
    ],
  }),
  // ── 이란·이스라엘·튀르키예 ──
  P({
    id: 'p-ir-hormuz',
    actor: 'ir',
    icon: '🛳️',
    title: '호르무즈 해협 봉쇄 위협',
    text: '{L}이(가) 해협에 기뢰를 깔겠다고 위협해요. 우리 유조선이 발이 묶였어요.',
    notFor: ['ru', 'cn', 'kp'],
    auto: 1,
    options: [
      { label: '호위 함대를 보내요', fx: [{ k: 'money', v: -2000 }, { k: 'troops', v: -0.005 }, { k: 'res', r: '석유', v: 20 }, { k: 'tension', v: 8 }], say: '구축함이 유조선을 이끌고 해협을 지났습니다.' },
      { label: '몸값처럼 통행료를 내요', fx: [{ k: 'money', v: -2500 }, { k: 'trust', v: -3 }], say: '배는 풀렸지만 뒷말이 많습니다.' },
      { label: '다른 길로 돌아가요', fx: [{ k: 'res', r: '석유', v: -15 }], say: '기름이 늦게 들어오고 있습니다.' },
    ],
  }),
  P({
    id: 'p-il-strike',
    actor: 'il',
    icon: '✈️',
    title: '이스라엘의 선제 공습 통보',
    text: '{L}이(가) 적국 핵시설을 곧 폭격하겠다며 우리에게 "지지 성명"을 요구했어요.',
    notFor: ['ir'],
    auto: 1,
    options: [
      { label: '지지 성명을 내요', fx: [{ k: 'favor', who: 'target', v: 10 }, { k: 'favor', who: 'rivals', v: -5 }], say: '{X}이(가) 고마워하지만 중동 여러 나라가 불쾌해합니다.' },
      { label: '중립을 지켜요', fx: [{ k: 'favor', who: 'target', v: -4 }, { k: 'trust', v: 1 }], say: '어느 편도 들지 않았습니다.' },
    ],
  }),
  P({
    id: 'p-tr-strait',
    actor: 'tr',
    icon: '🌉',
    title: '해협 통행 조건',
    text: '{L}이(가) 보스포루스 해협을 지나는 우리 군함에 "특별 조건"을 내걸었어요.',
    auto: 1,
    options: [
      { label: '경제 협력을 약속해요', fx: [{ k: 'money', v: -1800 }, { k: 'favor', who: 'target', v: 10 }], say: '해협이 열렸습니다. 튀르키예는 이득을 챙겼어요.' },
      { label: '해협을 피해 돌아가요', fx: [{ k: 'res', r: '석유', v: -8 }, { k: 'favor', who: 'target', v: -3 }], say: '함대가 먼 길을 돌고 있습니다.' },
    ],
  }),
  // ── 유럽·인도·우크라이나 ──
  P({
    id: 'p-de-carbon',
    actor: 'de',
    icon: '🌱',
    title: '탄소 국경세',
    text: '{L}이(가) 탄소를 많이 내는 나라 상품에 "탄소 국경세"를 매기자고 유럽을 이끌고 있어요.',
    notFor: ['uk'],
    auto: 1,
    options: [
      { label: '친환경 공장으로 바꿔요', fx: [{ k: 'money', v: -2500 }, { k: 'research', v: 3 }, { k: 'favor', who: 'target', v: 6 }], say: '공장 굴뚝이 하나씩 바뀌고 있습니다.' },
      { label: '세금을 내고 수출해요', fx: [{ k: 'money', v: -1500 }], say: '이윤이 줄었습니다.' },
      { label: '보복을 예고해요', fx: [{ k: 'favor', who: 'target', v: -10 }, { k: 'approval', v: 2 }], say: '유럽과 무역 분쟁이 시작될지도 모릅니다.' },
    ],
  }),
  P({
    id: 'p-uk-sanction',
    actor: 'uk',
    icon: '🧾',
    title: '제재 동참 요구',
    text: '{L}이(가) "자유 진영이라면 함께하라"며 적국 제재에 동참하라고 요구해요.',
    auto: 0,
    options: [
      { label: '제재에 동참해요', fx: [{ k: 'favor', who: 'target', v: 8 }, { k: 'favor', who: 'rivals', v: -5 }, { k: 'money', v: -1000 }], say: '자유 진영이 우리를 믿게 됐습니다.' },
      { label: '경제를 이유로 빠져요', fx: [{ k: 'favor', who: 'target', v: -8 }, { k: 'money', v: 800 }], say: '실리는 챙겼지만 우방이 서운해합니다.' },
    ],
  }),
  P({
    id: 'p-in-market',
    actor: 'in',
    icon: '🐘',
    title: '"인도에서 만들어라"',
    text: '{L}이(가) 우리 기업에 "인도 공장을 세우지 않으면 시장을 닫겠다"고 압박해요.',
    auto: 0,
    options: [
      { label: '공장을 짓기로 해요', fx: [{ k: 'money', v: -2000 }, { k: 'favor', who: 'target', v: 12 }, { k: 'res', r: '강철', v: 10 }], say: '거대 시장의 문이 열렸습니다.' },
      { label: '거절해요', fx: [{ k: 'favor', who: 'target', v: -8 }, { k: 'approval', v: 1 }], say: '인도 시장 점유율이 줄 것 같습니다.' },
    ],
  }),
  P({
    id: 'p-ua-plea',
    actor: 'ua',
    icon: '🆘',
    title: '우크라이나의 무기 호소',
    text: '{L}이(가) 영상 연설로 우리 국회에 "포탄과 방공 무기를 보내 달라"고 호소했어요.',
    notFor: ['ru'],
    auto: 1,
    options: [
      { label: '무기를 보내요', fx: [{ k: 'troops', v: -0.01 }, { k: 'favor', who: 'target', v: 15 }, { k: 'fame', v: 6 }], say: '{X} 국민이 우리 국기를 흔들고 있습니다.' },
      { label: '인도적 지원만 해요', fx: [{ k: 'money', v: -1200 }, { k: 'favor', who: 'target', v: 6 }], say: '구호품과 의약품을 보냈습니다.' },
      { label: '거절해요', fx: [{ k: 'favor', who: 'target', v: -8 }, { k: 'trust', v: 1 }], say: '{X}이(가) 실망했습니다.' },
    ],
  }),
];
export const pressureById = (id: string) => PRESSURES.find((p) => p.id === id);

/** 세계 소식: 다른 나라끼리 벌이는 일. 두 나라 사이 긴장이 오름 */
export interface WorldMove {
  actor: string;
  to: string;
  icon: string;
  text: string;
  tension: number;
}
export const WORLD_MOVES: WorldMove[] = [
  { actor: 'us', to: 'cn', icon: '📦', text: '{L}이(가) 중국산 전기차·배터리에 100% 관세를 매겼어요.', tension: 8 },
  { actor: 'us', to: 'cn', icon: '🔌', text: '{L}이(가) 첨단 반도체 장비의 중국 수출을 막았어요.', tension: 6 },
  { actor: 'us', to: 'ir', icon: '🧾', text: '{L}이(가) 이란 석유를 사는 나라까지 제재하겠다고 했어요.', tension: 6 },
  { actor: 'us', to: 'de', icon: '📦', text: '{L}이(가) 유럽산 자동차에 관세를 물리겠다고 엄포를 놨어요.', tension: 4 },
  { actor: 'cn', to: 'us', icon: '🧲', text: '{L}이(가) 갈륨·게르마늄의 미국 수출을 끊었어요.', tension: 7 },
  { actor: 'cn', to: 'jp', icon: '🛳️', text: '중국 해경선이 센카쿠 바다에 사흘째 머물고 있어요.', tension: 6 },
  { actor: 'cn', to: 'in', icon: '⛰️', text: '히말라야 국경에서 중국군과 인도군이 몸싸움을 벌였어요.', tension: 8 },
  { actor: 'ru', to: 'ua', icon: '💣', text: '{L}의 군대가 우크라이나 발전소에 미사일 수십 발을 쏘았어요.', tension: 10 },
  { actor: 'ru', to: 'uk', icon: '🛰️', text: '러시아 정찰기가 영국 영공 코앞까지 날아왔어요.', tension: 5 },
  { actor: 'ru', to: 'de', icon: '🔥', text: '{L}이(가) 독일행 가스관 밸브를 잠갔어요.', tension: 6 },
  { actor: 'kp', to: 'kr', icon: '🚀', text: '{L}이(가) 동해로 순항미사일을 쏘며 "남조선은 제1의 적"이라고 했어요.', tension: 8 },
  { actor: 'kp', to: 'jp', icon: '🚀', text: '북한 미사일이 일본 열도 위를 넘어 태평양에 떨어졌어요.', tension: 8 },
  { actor: 'kp', to: 'us', icon: '💥', text: '{L}이(가) "미국 본토를 칠 수 있다"며 신형 ICBM을 공개했어요.', tension: 6 },
  { actor: 'ir', to: 'il', icon: '🛩️', text: '이란이 드론 수백 대를 이스라엘로 날려 보냈어요.', tension: 12 },
  { actor: 'il', to: 'ir', icon: '✈️', text: '{L}의 전투기가 이란 방공 기지를 폭격했어요.', tension: 12 },
  { actor: 'tr', to: 'ru', icon: '🌉', text: '{L}이(가) 러시아 군함의 해협 통과를 막았어요.', tension: 5 },
  { actor: 'in', to: 'cn', icon: '🐘', text: '{L}이(가) 중국 앱 200개를 금지했어요.', tension: 5 },
  { actor: 'jp', to: 'cn', icon: '🛡️', text: '{L}이(가) 반격 능력을 갖춘다며 방위비를 크게 올렸어요.', tension: 5 },
  { actor: 'de', to: 'ru', icon: '🧾', text: '{L}이(가) 러시아 동결 자산으로 우크라이나를 돕자고 제안했어요.', tension: 5 },
  { actor: 'uk', to: 'ru', icon: '🚀', text: '{L}이(가) 우크라이나에 장거리 미사일을 보냈어요.', tension: 6 },
  { actor: 'ua', to: 'ru', icon: '🛩️', text: '우크라이나 드론이 러시아 정유 시설을 불태웠어요.', tension: 8 },
];
