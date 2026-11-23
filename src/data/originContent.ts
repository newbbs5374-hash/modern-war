// 출신 전용 콘텐츠(11-23 기획 5-3): 출신마다 돌발 사건 2개 · 부관 대사 3줄. 전용 업적은 goals.ts(ORIGIN_ACH).
import type { CrisisDef } from '../game/crisis';
import type { OriginId } from '../game/origin';

/** 부관이 대화할 때 가끔 하는 출신 이야기 */
export const ORIGIN_LINES: Record<OriginId, string[]> = {
  econ: ['"경제관료 출신답게 숫자부터 보시네요. 예산서는 제가 정리해 뒀습니다."', '"기재부 시절 동료들이 지도자님 칭찬을 하더군요."', '"이번 분기 성장률, 지도자님 예상이 딱 맞았어요."'],
  general: ['"장군님 출신답게 작전 지도를 먼저 펴시네요."', '"옛 부하들이 아직도 지도자님을 \'사령관님\'이라 불러요."', '"전선 보고는 짧게 올리겠습니다. 장군님 스타일대로요."'],
  scientist: ['"연구소 사람들이 지도자님 논문을 아직도 돌려 본대요."', '"실험처럼 정책도 한 번 더 확인하시는 모습, 믿음이 갑니다."', '"과학자 출신 대통령이라 젊은 연구원들이 많이 지원했어요."'],
  athlete: ['"오늘 아침에도 뛰셨다면서요? 경호팀이 따라가다 지쳤대요."', '"경기장에 오시면 관중이 아직도 이름을 외쳐요."', '"체력은 지도자님이 내각에서 최고예요. 정말이에요."'],
  diplomat: ['"외교관 시절 인맥이 이번에도 도움이 됐습니다."', '"그 나라 대사가 지도자님 안부를 따로 물었어요."', '"말 한마디로 긴장을 푸시는 걸 보면 역시 외교관 출신이세요."'],
  spy: ['"지도자님은 문 쪽 자리를 고르시네요. 버릇이 남으셨군요."', '"정보 보고서에 빈틈이 있으면 지도자님이 먼저 찾으세요."', '"옛 동료들이 아직도 그림자처럼 도와주고 있어요."'],
  lawyer: ['"법안 문구 하나까지 직접 고치시는 대통령은 처음 봐요."', '"인권 단체들이 지도자님을 많이 응원하고 있어요."', '"변론하듯 국회를 설득하시는 모습, 인상 깊었습니다."'],
  chaebol: ['"회장님들이 지도자님 전화는 바로 받는대요."', '"재벌 2세라고 수군대던 사람들이 요즘 조용해요."', '"비용 계산이 정말 빠르세요. 역시 경영을 해 보셔서 그런가 봐요."'],
  broadcaster: ['"카메라 앞에 서시면 분위기가 달라지세요."', '"오늘 연설, 시청률이 꽤 나왔대요."', '"방송국 후배들이 인터뷰 요청을 줄 서서 하고 있어요."'],
  activist: ['"광장에서 함께하던 시민들이 아직 지도자님을 믿어요."', '"현장 이야기를 직접 들으시는 모습, 다들 고마워해요."', '"노조 대표가 지도자님이라면 대화하겠다고 했어요."'],
  doctor: ['"건강 검진 결과, 이번엔 지도자님이 저를 걱정하시네요."', '"병원 사람들이 복지 정책을 많이 반기고 있어요."', '"진료하듯 나라를 살피신다는 말이 돌아요."'],
  mayor: ['"시장 시절 고친 그 도로, 아직도 다들 칭찬해요."', '"도시 이름만 들어도 무엇이 부족한지 아시네요."', '"지방 시장님들이 지도자님을 롤모델이라 해요."'],
  commando: ['"훈련장에 오시면 병사들이 더 긴장해요. 진짜 실력자시니까요."', '"특수부대 동기들이 경호를 자청했대요."', '"작전 시간 계산이 초 단위시네요."'],
  admiral: ['"바다 날씨부터 챙기시는 건 제독 출신이라 그런가 봐요."', '"해군 장병들이 지도자님 방문을 기다려요."', '"함대 배치도는 지도자님 책상에 늘 펴져 있네요."'],
  commoner: ['"시장 상인들이 지도자님은 자기네 편이래요."', '"검소한 도시락, 오늘도 드셨어요? 기자들이 좋아하더라고요."', '"평범한 집 출신 대통령이라 젊은이들이 희망을 얻었대요."'],
  religious: ['"기도 모임에서 지도자님 이름이 자주 나와요."', '"다른 나라 종교 지도자들도 지도자님을 존중해요."', '"화해를 먼저 말씀하시는 모습, 많이 감동받았습니다."'],
};

/** 출신 전용 돌발 사건(그 출신 지도자일 때만 나옴) */
export const ORIGIN_CRISES: Array<CrisisDef & { origin: OriginId }> = [
  { id: 'o-econ-1', origin: 'econ', icon: '📉', title: '옛 부처 후배의 SOS', text: '기재부 후배가 "금리 발표 전에 꼭 조언해 달라"고 연락했어요.', auto: 0, options: [
    { label: '공식 회의로 조언해요', fx: [{ k: 'trust', v: 4 }, { k: 'money', v: 800 }], say: '시장이 차분히 받아들였습니다.' },
    { label: '조용히 귀띔해요', fx: [{ k: 'money', v: 2000 }, { k: 'trust', v: -6 }], say: '돈은 벌었지만 말이 새어 나갈까 걱정입니다.' } ] },
  { id: 'o-econ-2', origin: 'econ', icon: '🏦', title: '은행 연쇄 부도 위기', text: '중견 은행 두 곳이 흔들려요. 경제관료 출신 대통령의 판단을 모두가 기다려요.', auto: 0, options: [
    { label: '공적 자금을 넣어요', fx: [{ k: 'money', v: -2500 }, { k: 'approval', v: 4 }, { k: 'fame', v: 10 }], say: '시장이 안정됐습니다.' },
    { label: '시장에 맡겨요', fx: [{ k: 'approval', v: -5 }, { k: 'money', v: 500 }], say: '몇몇 은행이 문을 닫았습니다.' } ] },
  { id: 'o-general-1', origin: 'general', icon: '🎖️', title: '옛 부대의 초대', text: '지도자님이 지휘하던 사단이 창설 기념식에 초대했어요.', auto: 0, options: [
    { label: '직접 가서 격려해요', fx: [{ k: 'troops', v: 0.02 }, { k: 'merit', v: 20 }], say: '장병들 사기가 하늘을 찌릅니다.' },
    { label: '영상 축사만 보내요', fx: [{ k: 'boost', v: 1 }], say: '짧지만 반가운 축사였어요.' } ] },
  { id: 'o-general-2', origin: 'general', icon: '🪖', title: '군 출신 대통령 비판', text: '야당이 "군인이 나라를 병영처럼 다룬다"고 비판해요.', auto: 1, options: [
    { label: '군복을 벗은 지 오래라고 웃어넘겨요', fx: [{ k: 'approval', v: 3 }, { k: 'trust', v: -2 }], say: '분위기가 누그러졌습니다.' },
    { label: '안보가 먼저라고 맞서요', fx: [{ k: 'trust', v: 3 }, { k: 'approval', v: -3 }], say: '지지층은 결집했지만 중도층이 멀어졌습니다.' } ] },
  { id: 'o-scientist-1', origin: 'scientist', icon: '🧪', title: '옛 연구실의 발견', text: '지도자님이 이끌던 연구실이 큰 발견을 했대요.', auto: 0, options: [
    { label: '국가 과제로 키워요', fx: [{ k: 'research', v: 4 }, { k: 'money', v: -1000 }], say: '연구가 빨라졌습니다.' },
    { label: '기업에 기술을 팔아요', fx: [{ k: 'money', v: 2000 }, { k: 'research', v: 1 }], say: '돈이 들어왔어요.' } ] },
  { id: 'o-scientist-2', origin: 'scientist', icon: '🤖', title: 'AI 규제 논쟁', text: '과학자 출신 대통령에게 AI 규제를 정해 달라는 요구가 빗발쳐요.', auto: 0, options: [
    { label: '안전 규칙을 만들어요', fx: [{ k: 'trust', v: 4 }, { k: 'research', v: -1 }], say: '국민이 안심했습니다.' },
    { label: '혁신을 밀어줘요', fx: [{ k: 'research', v: 3 }, { k: 'approval', v: -2 }], say: '연구자들이 환호합니다.' } ] },
  { id: 'o-athlete-1', origin: 'athlete', icon: '🏟️', title: '국가대표 결승전', text: '국가대표가 결승에 올랐어요. 경기장에 가 달라는 요청이 왔어요.', auto: 0, options: [
    { label: '응원하러 가요', fx: [{ k: 'approval', v: 6 }, { k: 'fame', v: 15 }], say: '관중이 지도자님 이름을 외쳤습니다!' },
    { label: '집무실에서 일해요', fx: [{ k: 'trust', v: 2 }], say: '성실하다는 평이에요.' } ] },
  { id: 'o-athlete-2', origin: 'athlete', icon: '💉', title: '옛 동료 약물 의혹', text: '선수 시절 동료가 약물 의혹에 휘말렸어요. 기자들이 지도자님께 묻고 있어요.', auto: 1, options: [
    { label: '감싸 줘요', fx: [{ k: 'approval', v: -4 }, { k: 'fame', v: -10 }], say: '의리는 지켰지만 여론이 나빠요.' },
    { label: '원칙대로 조사하라고 해요', fx: [{ k: 'trust', v: 4 }], say: '공정하다는 평가를 받았습니다.' } ] },
  { id: 'o-diplomat-1', origin: 'diplomat', icon: '📨', title: '옛 동료 대사의 비밀 편지', text: '{X} 대사로 있는 옛 동료가 비공식 대화를 제안했어요.', target: 'rival', auto: 0, options: [
    { label: '비공식 채널을 열어요', fx: [{ k: 'favor', who: 'target', v: 8 }, { k: 'tension', v: -10 }], say: '긴장이 풀리기 시작했습니다.' },
    { label: '공식 경로로만 해요', fx: [{ k: 'trust', v: 3 }], say: '원칙을 지켰습니다.' } ] },
  { id: 'o-diplomat-2', origin: 'diplomat', icon: '🌍', title: '국제기구 의장 제안', text: '국제기구가 외교관 출신 지도자님께 회의 의장을 맡아 달래요.', auto: 0, options: [
    { label: '맡아요', fx: [{ k: 'favor', who: 'all', v: 3 }, { k: 'fame', v: 15 }, { k: 'money', v: -800 }], say: '세계가 지도자님을 주목합니다.' },
    { label: '나랏일이 먼저예요', fx: [{ k: 'approval', v: 2 }], say: '국민이 좋아합니다.' } ] },
  { id: 'o-spy-1', origin: 'spy', icon: '🗝️', title: '옛 정보원의 귀환', text: '은퇴했던 옛 정보원이 {X}의 비밀을 들고 찾아왔어요.', target: 'rival', auto: 0, options: [
    { label: '정보를 받아요', fx: [{ k: 'intel', v: 25 }, { k: 'money', v: -600 }], say: '귀한 정보입니다.' },
    { label: '돌려보내요', fx: [{ k: 'trust', v: 2 }], say: '깨끗하게 처리했습니다.' } ] },
  { id: 'o-spy-2', origin: 'spy', icon: '📁', title: '과거 작전 기록 유출', text: '지도자님이 요원 시절 했던 작전 기록이 언론에 나왔어요.', auto: 0, options: [
    { label: '나라를 위한 일이었다고 밝혀요', fx: [{ k: 'approval', v: -2 }, { k: 'trust', v: 3 }], say: '솔직함이 통했습니다.' },
    { label: '사실이 아니라고 해요', fx: [{ k: 'approval', v: 2 }, { k: 'trust', v: -5 }], say: '당장은 넘어갔지만 의심이 남았어요.' } ] },
  { id: 'o-lawyer-1', origin: 'lawyer', icon: '⚖️', title: '옛 의뢰인의 호소', text: '변호사 시절 의뢰인이 억울한 재판을 받고 있다며 도움을 청해요.', auto: 1, options: [
    { label: '사면을 검토해요', fx: [{ k: 'approval', v: 3 }, { k: 'trust', v: -4 }], say: '마음은 따뜻했지만 특혜 논란이 생겼어요.' },
    { label: '법원 판단을 존중해요', fx: [{ k: 'trust', v: 4 }], say: '법치주의를 지켰습니다.' } ] },
  { id: 'o-lawyer-2', origin: 'lawyer', icon: '📜', title: '헌법 개정 논의', text: '법률가 출신 대통령에게 헌법 개정을 이끌어 달라는 목소리가 커요.', auto: 1, options: [
    { label: '국민 토론을 열어요', fx: [{ k: 'approval', v: 4 }, { k: 'money', v: -800 }], say: '토론회가 활발합니다.' },
    { label: '지금은 때가 아니라고 해요', fx: [{ k: 'trust', v: 2 }], say: '신중하다는 평입니다.' } ] },
  { id: 'o-chaebol-1', origin: 'chaebol', icon: '🏢', title: '가문 회사 특혜 의혹', text: '지도자님 집안 회사가 정부 사업을 따냈다는 보도가 났어요.', auto: 0, options: [
    { label: '사업을 취소해요', fx: [{ k: 'approval', v: 5 }, { k: 'money', v: -1500 }], say: '공정하다는 평가를 받았습니다.' },
    { label: '정당한 입찰이었다고 해요', fx: [{ k: 'approval', v: -6 }, { k: 'money', v: 1000 }], say: '여론이 싸늘합니다.' } ] },
  { id: 'o-chaebol-2', origin: 'chaebol', icon: '💸', title: '사재 기부 제안', text: '참모가 사재를 털어 복지 기금에 기부하자고 해요.', auto: 0, options: [
    { label: '크게 기부해요', fx: [{ k: 'approval', v: 7 }, { k: 'fame', v: 20 }], say: '국민이 감동했습니다.' },
    { label: '조용히 조금만 해요', fx: [{ k: 'approval', v: 2 }], say: '좋은 일 했습니다.' } ] },
  { id: 'o-broadcaster-1', origin: 'broadcaster', icon: '📺', title: '옛 방송 출연 요청', text: '지도자님이 진행하던 방송이 특별편 출연을 부탁했어요.', auto: 0, options: [
    { label: '출연해요', fx: [{ k: 'approval', v: 6 }, { k: 'trust', v: -2 }], say: '시청률 대박입니다!' },
    { label: '정중히 거절해요', fx: [{ k: 'trust', v: 2 }], say: '품위를 지켰습니다.' } ] },
  { id: 'o-broadcaster-2', origin: 'broadcaster', icon: '🎬', title: '말실수 영상 확산', text: '방송인 시절 했던 말실수 영상이 다시 퍼지고 있어요.', auto: 0, options: [
    { label: '웃으며 사과해요', fx: [{ k: 'approval', v: 3 }], say: '쿨한 사과에 반응이 좋아요.' },
    { label: '편집된 영상이라고 해요', fx: [{ k: 'approval', v: -4 }, { k: 'trust', v: -2 }], say: '역풍이 불었습니다.' } ] },
  { id: 'o-activist-1', origin: 'activist', icon: '✊', title: '옛 동지들의 시위', text: '함께 운동하던 동지들이 정부 정책에 반대하며 광장에 모였어요.', auto: 0, options: [
    { label: '직접 만나 들어요', fx: [{ k: 'approval', v: 5 }, { k: 'money', v: -800 }], say: '대화가 잘 풀렸습니다.' },
    { label: '정책을 밀고 가요', fx: [{ k: 'trust', v: 3 }, { k: 'approval', v: -4 }], say: '옛 동지들이 실망했어요.' } ] },
  { id: 'o-activist-2', origin: 'activist', icon: '🏭', title: '대기업 노사 갈등', text: '대기업 파업에 시민운동가 출신 대통령의 중재를 요청해요.', auto: 0, options: [
    { label: '중재에 나서요', fx: [{ k: 'approval', v: 4 }, { k: 'res', r: '강철', v: 20 }], say: '파업이 끝나고 공장이 다시 돌아갑니다.' },
    { label: '노사에 맡겨요', fx: [{ k: 'res', r: '강철', v: -20 }], say: '파업이 길어지고 있어요.' } ] },
  { id: 'o-doctor-1', origin: 'doctor', icon: '🦠', title: '새 감염병 소식', text: '의사 출신 대통령에게 감염병 대응을 직접 지휘해 달라는 요청이 와요.', auto: 0, options: [
    { label: '직접 지휘해요', fx: [{ k: 'approval', v: 6 }, { k: 'money', v: -1200 }], say: '빠른 대응에 국민이 안심했습니다.' },
    { label: '보건부에 맡겨요', fx: [{ k: 'approval', v: -2 }], say: '대응이 조금 늦었어요.' } ] },
  { id: 'o-doctor-2', origin: 'doctor', icon: '🩺', title: '의료 봉사 요청', text: '예전 병원 동료들이 하루 의료 봉사를 함께하자고 해요.', auto: 0, options: [
    { label: '가운을 입어요', fx: [{ k: 'approval', v: 4 }, { k: 'fame', v: 10 }], say: '환자들이 눈물을 흘렸어요.' },
    { label: '격려 편지만 보내요', fx: [{ k: 'trust', v: 1 }], say: '따뜻한 편지였어요.' } ] },
  { id: 'o-mayor-1', origin: 'mayor', icon: '🏙️', title: '옛 도시의 민원', text: '시장 시절 도시 주민들이 "우리 도시를 잊지 말아 달라"고 해요.', auto: 1, options: [
    { label: '예산을 더 보내요', fx: [{ k: 'approval', v: 2 }, { k: 'money', v: -1000 }, { k: 'trust', v: -2 }], say: '고향 챙기기란 말이 나와요.' },
    { label: '모든 도시를 똑같이 대해요', fx: [{ k: 'trust', v: 3 }], say: '공정하다는 평입니다.' } ] },
  { id: 'o-mayor-2', origin: 'mayor', icon: '🚇', title: '지하철 공사 사고', text: '시장 시절 시작한 지하철 공사 현장에서 사고가 났어요.', auto: 0, options: [
    { label: '현장에 가서 사과해요', fx: [{ k: 'approval', v: 3 }, { k: 'money', v: -800 }], say: '진심이 전해졌습니다.' },
    { label: '시공사 책임이라고 해요', fx: [{ k: 'approval', v: -4 }], say: '책임 회피라는 비판을 받아요.' } ] },
  { id: 'o-commando-1', origin: 'commando', icon: '🪂', title: '인질 구출 작전', text: '특수부대 출신 대통령에게 직접 작전을 승인해 달라는 보고가 올라왔어요.', auto: 0, options: [
    { label: '정예 작전을 승인해요', fx: [{ k: 'merit', v: 30 }, { k: 'approval', v: 5 }, { k: 'troops', v: -0.005 }], say: '인질을 모두 구했습니다!' },
    { label: '협상을 먼저 해요', fx: [{ k: 'money', v: -1200 }, { k: 'approval', v: 2 }], say: '시간은 걸렸지만 무사히 해결했어요.' } ] },
  { id: 'o-commando-2', origin: 'commando', icon: '🏋️', title: '특수부대 시범 행사', text: '옛 부대가 시범 행사에 지도자님 참가를 부탁했어요.', auto: 0, options: [
    { label: '직접 시범에 나서요', fx: [{ k: 'fame', v: 20 }, { k: 'approval', v: 3 }], say: '영상이 화제가 됐어요!' },
    { label: '관람만 해요', fx: [{ k: 'merit', v: 10 }], say: '장병들이 힘을 얻었어요.' } ] },
  { id: 'o-admiral-1', origin: 'admiral', icon: '⚓', title: '옛 함대의 귀항', text: '지도자님이 지휘하던 함대가 긴 작전을 마치고 돌아와요.', auto: 0, options: [
    { label: '항구에서 맞이해요', fx: [{ k: 'troops', v: 0.015 }, { k: 'approval', v: 3 }], say: '수병들이 감격했습니다.' },
    { label: '포상금을 보내요', fx: [{ k: 'money', v: -800 }, { k: 'merit', v: 15 }], say: '사기가 올랐습니다.' } ] },
  { id: 'o-admiral-2', origin: 'admiral', icon: '🌊', title: '공해 위 대치', text: '{X} 함정과 우리 함정이 공해에서 마주쳤어요. 제독 출신 대통령의 판단을 기다려요.', target: 'rival', auto: 1, options: [
    { label: '물러서지 말라고 해요', fx: [{ k: 'tension', v: 12 }, { k: 'approval', v: 3 }], say: '상대가 먼저 물러났지만 긴장이 높아졌어요.' },
    { label: '무전으로 길을 터 줘요', fx: [{ k: 'tension', v: -8 }, { k: 'favor', who: 'target', v: 3 }], say: '침착한 대응이었습니다.' } ] },
  { id: 'o-commoner-1', origin: 'commoner', icon: '🍜', title: '단골 식당 방문', text: '서민 출신 대통령이 옛 단골 국숫집에 간다는 소문이 났어요.', auto: 0, options: [
    { label: '경호 줄이고 들러요', fx: [{ k: 'approval', v: 5 }], say: '사진 한 장이 온 나라에 퍼졌어요.' },
    { label: '경호 문제로 취소해요', fx: [{ k: 'approval', v: -1 }], say: '아쉬워하는 사람이 많아요.' } ] },
  { id: 'o-commoner-2', origin: 'commoner', icon: '🏠', title: '청년 주거 대란', text: '집값이 올라 청년들이 서민 출신 대통령에게 기대를 걸어요.', auto: 0, options: [
    { label: '공공주택을 크게 지어요', fx: [{ k: 'approval', v: 6 }, { k: 'money', v: -2000 }], say: '청년들이 환호합니다.' },
    { label: '시장 안정을 기다려요', fx: [{ k: 'approval', v: -3 }], say: '실망한 목소리가 커요.' } ] },
  { id: 'o-religious-1', origin: 'religious', icon: '🕊️', title: '평화 기도회 초청', text: '{X} 종교 지도자가 함께 평화 기도회를 열자고 해요.', target: 'any', auto: 0, options: [
    { label: '함께 기도해요', fx: [{ k: 'favor', who: 'target', v: 8 }, { k: 'tension', v: -10 }], say: '두 나라 사이가 부드러워졌어요.' },
    { label: '정치와 종교는 나눠요', fx: [{ k: 'trust', v: 2 }], say: '원칙을 지켰습니다.' } ] },
  { id: 'o-religious-2', origin: 'religious', icon: '⛪', title: '종교 편향 논란', text: '종교인 출신 대통령이 한쪽 종교만 챙긴다는 비판이 나와요.', auto: 0, options: [
    { label: '모든 종교 지도자를 초대해요', fx: [{ k: 'approval', v: 4 }, { k: 'money', v: -500 }], say: '화합의 자리가 됐습니다.' },
    { label: '오해라고만 해요', fx: [{ k: 'approval', v: -3 }], say: '논란이 이어지고 있어요.' } ] },
];
