// 11-27 종합 확장안 6절: 한 손가락 미니 훈련 84개(훈련 12개 × 7개).
// 조작은 다섯 가지 중 하나(꾹·톡·끌기·고르기·놓기), 한 판이 능력 1~3개를 같이 올림.
//  · 첫 능력은 별 하나에 경험치 온전히, 둘째·셋째는 절반
//  · 훈련마다 5단계: 별 2개 넘게 받으면 다음 단계(조금 더 빠르고 어려움)
//  · 3단계부터 병과 숙련도 같이 오름
// view = 화면 이름(null이면 아직 안 만든 것 → 훈련에 안 나옴). 1차 24개가 먼저 열려 있음.
import type { StatId } from '../data/officers';

export type EasyCtl = '꾹' | '톡' | '끌기' | '고르기' | '놓기';
export const CTL_TEXT: Record<EasyCtl, string> = {
  꾹: '누르고 있다 떼기',
  톡: '때맞춰 한 번 누르기',
  끌기: '손가락으로 끌어 놓기',
  고르기: '둘이나 셋 가운데 하나 누르기',
  놓기: '미리 놓아 두고 지켜보기',
};
export interface EasyDef {
  id: string;
  training: string;
  name: string;
  ctl: EasyCtl;
  how: string;
  /** 제안서에 적은 능력(국정·인품 능력 포함) */
  stats: string[];
  view: string | null;
  secs: number;
}

export const EASY: EasyDef[] = [
  { id: 'e-sneak-1', training: '잠입', name: '야간 침투', ctl: '꾹', how: '누르고 있으면 달리고, 떼면 엎드려요. 탐조등 빛 안에서는 엎드려야 안 들켜요. 기지 문까지 가요.', stats: ['은밀', '체력'], view: 'e:holdrun', secs: 70 },
  { id: 'e-sneak-2', training: '잠입', name: '담장 넘기', ctl: '톡', how: '경비병이 등을 돌린 순간에 눌러 담을 넘어요. 이쪽을 볼 때 누르면 들켜요. 담 8개.', stats: ['은밀', '정보'], view: 'e:wall', secs: 60 },
  { id: 'e-sneak-3', training: '잠입', name: '그림자 따라가기', ctl: '끌기', how: '화면을 끌면 병사가 따라와요. 움직이는 트럭의 그림자 안에 머물러요.', stats: ['은밀', '전술'], view: 'e:shadow', secs: 45 },
  { id: 'e-sneak-4', training: '잠입', name: '조용한 제압', ctl: '톡', how: '순찰병 뒤에 붙었어요. 좁아지는 노란 원이 흰 원과 겹칠 때 눌러요. 7번.', stats: ['은밀', '사격'], view: 'e:takedown', secs: 55 },
  { id: 'e-sneak-5', training: '잠입', name: '드론 눈 피하기', ctl: '놓기', how: '드론이 도는 길을 잘 보고, 그 길 밖에 있는 숨을 곳 3곳을 눌러 정해요. ▶ 시작하면 드론이 지나가요. 3판.', stats: ['은밀', '전술', '정보'], view: 'e:hide', secs: 80 },
  { id: 'e-sneak-6', training: '잠입', name: '변장 통과', ctl: '고르기', how: '검문병의 질문에, 내 변장과 출입증에 맞는 대답을 골라요. 5번.', stats: ['은밀', '언변'], view: 'e:disguise', secs: 70 },
  { id: 'e-sneak-7', training: '잠입', name: '폭약 설치', ctl: '꾹', how: '손 떨림 표시가 초록 칸에 있을 때만 누르고 있어요. 벗어났는데 누르면 소리가 나요. 설치 100%면 끝.', stats: ['은밀', '포격'], view: 'e:bombset', secs: 60 },
  { id: 'e-fit-1', training: '체력', name: '유격 코스', ctl: '톡', how: '병사가 저절로 달려요. 장애물 바로 앞에서 눌러 뛰어넘어요.', stats: ['체력', '은밀'], view: 'e:runner', secs: 60 },
  { id: 'e-fit-2', training: '체력', name: '완전 군장 행군', ctl: '꾹', how: '누르고 있으면 걸음이 빨라지고 떼면 느려져요. 초록 칸 빠르기를 지켜요. 너무 빠르면 숨이 차요.', stats: ['체력', '통솔'], view: 'e:march', secs: 60 },
  { id: 'e-fit-3', training: '체력', name: '외줄 타기', ctl: '꾹', how: '누르면 오르고 떼면 쉬어요. 힘이 다 빠지면 미끄러져요. 바람이 불 때는 쉬어요.', stats: ['체력'], view: 'e:climb', secs: 60 },
  { id: 'e-fit-4', training: '체력', name: '수영 도하', ctl: '톡', how: '초록 구슬이 노란 고리에 들어올 때 눌러요. 팔 젓는 박자가 맞으면 물살을 이기고 강을 건너요.', stats: ['체력', '은밀'], view: 'e:swim', secs: 45 },
  { id: 'e-fit-5', training: '체력', name: '부상병 옮기기', ctl: '끌기', how: '화면을 끌어 들것을 좌우로 옮겨요. 검은 포탄 구덩이를 피해 구호소까지 가요.', stats: ['체력', '통솔', '매력'], view: 'e:stretcher', secs: 60 },
  { id: 'e-fit-6', training: '체력', name: '혹한기 버티기', ctl: '고르기', how: '체온·식량·잠 가운데 지금 챙길 것 하나를 골라요. 다음에 얼마나 줄지 보고 바닥나지 않게 9시간을 버텨요.', stats: ['체력', '군수'], view: 'e:cold', secs: 70 },
  { id: 'e-fit-7', training: '체력', name: '사격 뒤 달리기', ctl: '톡', how: '달리다 멈춰 서면 숨이 차서 조준이 흔들려요. 노란 고리가 가장 작아질 때 눌러 쏴요. 5번.', stats: ['체력', '사격'], view: 'e:biathlon', secs: 60 },
  { id: 'e-tac-1', training: '전술', name: '모래판 작전', ctl: '놓기', how: '부대 3개(보병·전차·포병)를 고르고 칸을 눌러 놓아요. 숲은 보병, 평지는 전차, 언덕은 포병이 세요. ▶ 시작을 누르면 싸움이 저절로 펼쳐져요.', stats: ['전술', '지휘'], view: 'e:sand', secs: 80 },
  { id: 'e-tac-2', training: '전술', name: '길목 매복', ctl: '놓기', how: '적 대열이 올 길을 보고 매복조 2개를 길가에 놓아요. 대열이 들어오면 🔥 사격 개시를 한 번 눌러요. 3판.', stats: ['전술', '은밀'], view: 'e:ambush', secs: 70 },
  { id: 'e-tac-3', training: '전술', name: '양쪽에서 조이기', ctl: '끌기', how: '화살표 2개를 그려 왼쪽·오른쪽 부대를 적 옆구리로 보내요. 정면의 빨간 원은 피해요. 3판.', stats: ['전술', '지휘', '통솔'], view: 'e:pincer', secs: 75 },
  { id: 'e-tac-4', training: '전술', name: '한 수 앞 읽기', ctl: '고르기', how: '정찰 보고를 읽고 적이 다음에 할 일을 셋 가운데 골라요. 5번.', stats: ['전술', '정보'], view: 'e:predict', secs: 75 },
  { id: 'e-tac-5', training: '전술', name: '고지 뺏기', ctl: '톡', how: '아군 포격이 멎고 연막이 퍼진 순간에 눌러 돌격시켜요. 이르면 아군 포에, 늦으면 적 총에 맞아요. 5번.', stats: ['전술', '통솔'], view: 'e:hill', secs: 65 },
  { id: 'e-tac-6', training: '전술', name: '물러나며 싸우기', ctl: '끌기', how: '방어선을 위아래로 끌어 초록 띠(알맞은 거리)에 둬요. 가까우면 피해를 입고 멀면 못 막아요. 적이 계속 밀려와요.', stats: ['전술', '군수'], view: 'e:delay', secs: 50 },
  { id: 'e-tac-7', training: '전술', name: '지난 전투 다시 보기', ctl: '고르기', how: '지난 전투의 결정 셋 가운데 잘못된 것 하나를 찾아요. 5번.', stats: ['전술', '지휘', '정보'], view: 'e:review', secs: 70 },
  { id: 'e-shoot-1', training: '사격', name: '숨 고르고 한 발', ctl: '꾹', how: '누르고 있으면 숨을 참아 조준 원이 모여요. 가장 작아졌을 때 떼면 발사. 너무 오래 참으면 다시 흔들려요. 5발.', stats: ['사격', '체력'], view: 'e:breath', secs: 70 },
  { id: 'e-shoot-2', training: '사격', name: '시가지 표적', ctl: '톡', how: '3D 마을 창문과 골목에 나온 적 병사만 눌러요. 초록 옷 민간인은 쏘면 안 돼요.', stats: ['사격', '정보'], view: 'm3-shoot-popup', secs: 45 },
  { id: 'e-shoot-3', training: '사격', name: '움직이는 차량', ctl: '톡', how: '탄이 날아가는 동안 표적이 움직여요. 달리는 차가 흰 기둥에 닿기 조금 전에 눌러요. 8발.', stats: ['사격', '전술'], view: 'e:leadshot', secs: 55 },
  { id: 'e-shoot-4', training: '사격', name: '바람 읽는 저격', ctl: '끌기', how: '조준점을 끌어 바람 반대쪽에 두고 손을 떼요. 멀면 조금 위를 겨눠요. 5발.', stats: ['사격', '정보'], view: 'e:windsnipe', secs: 70 },
  { id: 'e-shoot-5', training: '사격', name: '엄호 사격', ctl: '꾹', how: '아군이 뛰는 동안만 누르고 있어요. 숨었을 때는 손을 떼어 탄창을 채워요.', stats: ['사격', '통솔'], view: 'e:cover', secs: 45 },
  { id: 'e-shoot-6', training: '사격', name: '야간 사격', ctl: '톡', how: '어둠 속에서 총구 불빛이 번쩍인 자리를 기억했다가 그곳을 눌러요. 7발.', stats: ['사격', '은밀'], view: 'e:nightshot', secs: 60 },
  { id: 'e-shoot-7', training: '사격', name: '사격 대회', ctl: '톡', how: 'AI 선수 3명과 겨뤄요. 움직이는 조준 고리가 내 과녁(파란 과녁) 한가운데 올 때 눌러요. 8발.', stats: ['사격', '매력'], view: 'e:match', secs: 60 },
  { id: 'e-arty-1', training: '포격', name: '당겨서 쏘기', ctl: '끌기', how: '화면을 아래로 당겼다 놓으면 발사. 많이 당길수록 멀리 가요. 바람을 보고 깃발 표적을 맞혀요. 5발.', stats: ['포격', '전술'], view: 'e:sling', secs: 75 },
  { id: 'e-arty-2', training: '포격', name: '관측병과 맞추기', ctl: '고르기', how: '포탄이 떨어진 곳을 보고 "좌·우·가까이·멀리" 가운데 고칠 방향을 골라요. 3발 안에 맞혀요.', stats: ['포격', '정보'], view: 'n-arty-observe', secs: 70 },
  { id: 'e-arty-3', training: '포격', name: '한꺼번에 떨어뜨리기', ctl: '톡', how: '불빛이 노란 표시가 있는 포 위에 올 때 눌러요. 포 3문을 먼 것부터 차례로 쏴 포탄이 같이 떨어지게 해요. 3번.', stats: ['포격', '지휘'], view: 'e:tot', secs: 65 },
  { id: 'e-arty-4', training: '포격', name: '쏘고 자리 뜨기', ctl: '꾹', how: '누르고 있으면 계속 쏴요. 적 반격 원이 다 좁아지기 전에 손을 떼고 자리를 떠요. 5번.', stats: ['포격', '군수'], view: 'e:scoot', secs: 55 },
  { id: 'e-arty-5', training: '포격', name: '대열 끊기', ctl: '톡', how: '포탄은 2초 뒤 떨어져요. 다가오는 전차 대열 앞쪽 길을 눌러요. 6발.', stats: ['포격', '전술'], view: 'm3-arty-lead', secs: 50 },
  { id: 'e-arty-6', training: '포격', name: '다연장 한 방', ctl: '놓기', how: '한 번만 쏠 수 있어요. 적이 가장 많이 들어가는 자리에 표적 원을 놓고 ▶ 시작. 전차는 2점. 3판.', stats: ['포격', '전술', '정보'], view: 'e:mlrs', secs: 70 },
  { id: 'e-arty-7', training: '포격', name: '날아오는 것 막기', ctl: '톡', how: '날아오는 로켓이 노란 고리 안에 들어올 때 눌러 떨어뜨려요. 8발.', stats: ['포격', '과학'], view: 'e:intercept', secs: 55 },
  { id: 'e-intel-1', training: '정보', name: '위성 사진 판독', ctl: '톡', how: '어제(위)와 오늘(아래) 위성 사진에서 새로 생긴 것 5개를 아래 사진에서 눌러요. 실제 위성 지도예요.', stats: ['정보', '과학'], view: 'e:satdiff', secs: 70 },
  { id: 'e-intel-2', training: '정보', name: '첩보 맞춰 보기', ctl: '고르기', how: '보고 3개 가운데 앞뒤가 안 맞는 거짓 하나를 골라요. 5번.', stats: ['정보', '정치'], view: 'e:liar', secs: 80 },
  { id: 'e-intel-3', training: '정보', name: '감청 주파수 잡기', ctl: '꾹', how: '누르고 있으면 바늘이 움직여요. 물결이 가장 또렷해지는 곳에서 손을 떼요. 6번.', stats: ['정보', '과학'], view: 'e:radio', secs: 60 },
  { id: 'e-intel-4', training: '정보', name: '정찰 드론 날리기', ctl: '끌기', how: '기지에서 길을 한 번에 그어 표적 5개를 모두 지나요. 대공포(빨간 원)는 피하고, 배터리가 넉넉하지 않으니 짧게. 3판.', stats: ['정보', '전술'], view: 'e:dronepath', secs: 80 },
  { id: 'e-intel-5', training: '정보', name: '이중간첩 찾기', ctl: '고르기', how: '세 사람의 행적을 보고 수상한 한 명을 골라요. 5번.', stats: ['정보', '법률'], view: 'e:mole', secs: 75 },
  { id: 'e-intel-6', training: '정보', name: '적 속마음 읽기', ctl: '고르기', how: '적 지도자의 SNS 글을 보고 다음 행동을 맞혀요. 5번.', stats: ['정보', '외교'], view: 'e:mind', secs: 75 },
  { id: 'e-intel-7', training: '정보', name: '암호 원판', ctl: '꾹', how: '누르고 있으면 원판이 돌아요. 금색 칸이 위쪽 ▼ 아래 올 때 손을 떼요. 6번.', stats: ['정보', '과학'], view: 'e:wheel', secs: 55 },
  { id: 'e-lead-1', training: '통솔', name: '사열과 훈시', ctl: '톡', how: '대열이 사열대 앞 흰 선을 지날 때 눌러 경례를 받아요. 박자가 점점 빨라져요.', stats: ['통솔', '매력'], view: 'e:parade', secs: 60 },
  { id: 'e-lead-2', training: '통솔', name: '무너지는 전선 붙잡기', ctl: '톡', how: '사기 막대가 떨어지는 분대를 눌러 다독여요. 포탄이 떨어진 곳이 더 급해요. 한 분대도 흩어지지 않게.', stats: ['통솔', '지휘'], view: 'e:rally', secs: 50 },
  { id: 'e-lead-3', training: '통솔', name: '훈시 한마디', ctl: '고르기', how: '병사들 분위기를 보고 맞는 말 한마디를 골라요. 5번.', stats: ['통솔', '언변'], view: 'e:speech', secs: 75 },
  { id: 'e-lead-4', training: '통솔', name: '예비대 넣기', ctl: '놓기', how: '세 전선의 막대를 보다가, 무너질 것 같은 곳을 한 번 눌러 예비대를 넣어요. 한 판에 한 번뿐이에요. 3판.', stats: ['통솔', '전술', '지휘'], view: 'e:reserve', secs: 60 },
  { id: 'e-lead-5', training: '통솔', name: '다툼 풀기', ctl: '고르기', how: '부하 둘의 말을 듣고 공정한 판정을 골라요. 5번.', stats: ['통솔', '청렴', '법률'], view: 'e:judge', secs: 80 },
  { id: 'e-lead-6', training: '통솔', name: '구호 맞추기', ctl: '톡', how: '초록 구슬이 노란 고리에 들어올 때 눌러요. 구호 박자가 맞으면 부대의 걸음이 하나가 돼요.', stats: ['통솔', '체력'], view: 'e:chant', secs: 45 },
  { id: 'e-lead-7', training: '통솔', name: '앞장서기', ctl: '꾹', how: '누르고 있으면 내가 앞장서서 사기가 올라요. 포탄이 가까워지니 위험이 다 차기 전에 손을 떼요. 5번.', stats: ['통솔', '체력', '매력'], view: 'e:front', secs: 55 },
  { id: 'e-sup-1', training: '보급', name: '수송 대열 호송', ctl: '끌기', how: '기지에서 전선 깃발까지 손가락으로 길을 한 번에 그려요. 빨간 매복 원과 끊긴 다리는 피해요. 3판.', stats: ['군수', '전술'], view: 'e:convoy', secs: 75 },
  { id: 'e-sup-2', training: '보급', name: '짐 싣기', ctl: '끌기', how: '상자를 끌어 수송기 짐칸에 빈틈없이 넣어요. 다 채우면 다음 짐칸. 3판.', stats: ['군수', '행정'], view: 'e:pack', secs: 80 },
  { id: 'e-sup-3', training: '보급', name: '하늘에서 떨어뜨리기', ctl: '톡', how: '수송 헬기가 지나갈 때 눌러 상자를 떨어뜨려요. 상자는 앞으로 밀리며 떨어지니 천막에 닿기 조금 전에 눌러요. 6번.', stats: ['군수', '사격'], view: 'e:airdrop', secs: 60 },
  { id: 'e-sup-4', training: '보급', name: '창고 살림', ctl: '고르기', how: '탄약·식량·연료 가운데 이번에 보낼 것 하나를 골라요. 전선이 바닥나지 않게 9일을 버텨요.', stats: ['군수', '경제'], view: 'e:depot', secs: 70 },
  { id: 'e-sup-5', training: '보급', name: '야전 수리', ctl: '꾹', how: '고장 난 전차를 누르고 있어 고쳐요. 적 전차가 닿기 전에 손을 떼고 빠져요. 많이 고칠수록 좋아요. 5번.', stats: ['군수', '과학'], view: 'e:repair', secs: 60 },
  { id: 'e-sup-6', training: '보급', name: '급유 맞추기', ctl: '톡', how: '달리는 전차 옆에 급유차가 나란히 온 순간 눌러요. 7번.', stats: ['군수', '통솔'], view: 'e:refuel', secs: 55 },
  { id: 'e-sup-7', training: '보급', name: '항구 하역', ctl: '놓기', how: '부두는 하나예요. 배 3척의 하역 시간과 급함을 보고, 먼저 댈 배부터 차례로 눌러요. 4판.', stats: ['군수', '행정', '경제'], view: 'e:dock', secs: 75 },
  { id: 'e-hack-1', training: '해킹', name: '회로 잇기', ctl: '끌기', how: '같은 색 점에서 끌어 같은 색 점까지 선을 그어요. 선끼리 겹치면 안 돼요.', stats: ['정보', '과학'], view: 'hack-flow', secs: 80 },
  { id: 'e-hack-2', training: '해킹', name: '방화벽 틈', ctl: '톡', how: '도는 고리의 틈이 위쪽 ▼ 아래에 올 때 눌러 멈춰요. 바깥부터 3겹을 차례로 멈추면 한 번 뚫려요. 6번.', stats: ['정보', '은밀'], view: 'e:rings', secs: 60 },
  { id: 'e-hack-3', training: '해킹', name: '비밀번호 맞히기', ctl: '고르기', how: '숫자 4개(1~6, 겹침 없음)를 넣으면 ● 자리까지 맞음, ○ 숫자만 맞음을 알려 줘요. 8번 안에 풀어요.', stats: ['정보', '과학'], view: 'hack-code', secs: 90 },
  { id: 'e-hack-4', training: '해킹', name: '흔적 지우기', ctl: '꾹', how: '누르고 있으면 자료를 빼내고 추적 막대도 차올라요. 다 차기 전에 손을 떼요. 오래 버틸수록 점수가 높아요. 5번.', stats: ['정보', '은밀'], view: 'e:trace', secs: 55 },
  { id: 'e-hack-5', training: '해킹', name: '가짜 신호 심기', ctl: '놓기', how: '적 요격기 가까이에 가짜 표적 3개를 놓고 ▶ 시작. 꾀어낸 요격기가 많을수록 진짜 편대가 안전해요. 3판.', stats: ['정보', '전술'], view: 'e:decoy', secs: 75 },
  { id: 'e-hack-6', training: '해킹', name: '드론 빼앗기', ctl: '톡', how: '적 드론의 빨간 물결이 내 파란 물결과 겹칠 때 눌러요. 6번.', stats: ['정보', '과학', '사격'], view: 'e:waves', secs: 60 },
  { id: 'e-hack-7', training: '해킹', name: '전력망 지키기', ctl: '톡', how: '빨갛게 변한 변전소(침입)만 눌러 막아요. 초록은 점검 신호라 누르면 감점이에요.', stats: ['정보', '행정'], view: 'e:grid', secs: 50 },
  { id: 'e-rec-1', training: '모병', name: '지원자 면접', ctl: '고르기', how: '조건에 맞으면 오른쪽(합격), 아니면 왼쪽(불합격)으로 넘겨요.', stats: ['정치', '행정'], view: 'rec-interview', secs: 50 },
  { id: 'e-rec-2', training: '모병', name: '모병 연설', ctl: '고르기', how: '청중 분위기를 보고 맞는 연설 카드를 골라요. 8번.', stats: ['정치', '언변', '매력'], view: 'rec-speech', secs: 50 },
  { id: 'e-rec-3', training: '모병', name: '홍보 영상 찍기', ctl: '톡', how: '전차와 전투기가 함께 노란 틀 안에 들어오는 순간 눌러 장면을 찍어요. 6번.', stats: ['정치', '매력'], view: 'e:film', secs: 55 },
  { id: 'e-rec-4', training: '모병', name: '포스터 붙이기', ctl: '놓기', how: '사람이 많이 모인 곳을 눌러 포스터 4장을 놓고 ▶ 시작. 원 안에 든 사람이 많을수록 좋아요. 2판.', stats: ['정치', '경제'], view: 'e:poster', secs: 70 },
  { id: 'e-rec-5', training: '모병', name: '신병 나누기', ctl: '끌기', how: '신병의 특기를 읽고 카드를 끌어 육군·해군·공군·사이버 칸에 놓아요. 12명.', stats: ['정치', '통솔', '행정'], view: 'e:recsort', secs: 70 },
  { id: 'e-rec-6', training: '모병', name: '학교 방문', ctl: '고르기', how: '학생들의 질문에 좋은 대답을 골라요. 5번.', stats: ['정치', '언변'], view: 'e:school', secs: 80 },
  { id: 'e-rec-7', training: '모병', name: '입대하는 날', ctl: '톡', how: '초록 구슬이 노란 고리에 들어올 때 눌러요. 박자에 맞춰 신병이 한 명씩 인사하고 들어가요.', stats: ['정치', '매력'], view: 'e:enlist', secs: 45 },
  { id: 'e-air-1', training: '항공', name: '요격 출격', ctl: '끌기', how: '화면을 끌면 전투기가 따라와요. 사격은 저절로 돼요. 적 총알을 피해요.', stats: ['사격', '전술'], view: 'm3-air-intercept', secs: 45 },
  { id: 'e-air-2', training: '항공', name: '항모에 내리기', ctl: '꾹', how: '누르고 있으면 떠오르고 떼면 내려가요. 초록 길을 따라 갑판에 내려요. 3번.', stats: ['사격', '체력'], view: 'e:carrier', secs: 70 },
  { id: 'e-air-3', training: '항공', name: '미사일 따돌리기', ctl: '톡', how: '미사일이 노란 원에 닿는 순간 눌러 플레어를 터뜨려요. 이르면 헛쏘고 늦으면 맞아요. 7번.', stats: ['전술', '체력'], view: 'e:flare', secs: 55 },
  { id: 'e-air-4', training: '항공', name: '하늘에서 기름 받기', ctl: '꾹', how: '급유기 뒤에서, 누르면 다가가고 떼면 멀어져요. 초록 칸 거리를 지키면 호스가 이어져요.', stats: ['체력', '군수'], view: 'e:airfuel', secs: 45 },
  { id: 'e-air-5', training: '항공', name: '정밀 폭격', ctl: '톡', how: '표적이 노란 상자에 들어올 때 눌러 폭탄을 떨어뜨려요. 뒷바람이면 조금 늦게, 맞바람이면 조금 일찍. 6번.', stats: ['사격', '포격'], view: 'e:bomb', secs: 60 },
  { id: 'e-air-6', training: '항공', name: '편대 지키기', ctl: '끌기', how: '화면을 끌어 대장기 오른쪽 뒤 초록 자리를 지켜요. 구름이 가려도 흐트러지지 않게.', stats: ['통솔', '전술'], view: 'e:wing', secs: 45 },
  { id: 'e-air-7', training: '항공', name: '낮게 뚫고 들어가기', ctl: '꾹', how: '산 사이를 낮게 날아요. 누르면 올라가고 떼면 내려가요. 산보다 높게, 빨간 레이더 띠보다 낮게.', stats: ['은밀', '사격', '체력'], view: 'e:lowfly', secs: 45 },
  { id: 'e-sea-1', training: '해상', name: '소나 사냥', ctl: '톡', how: '바다 칸을 누르면 잠수함까지 거리가 떠요. 찾았다 싶으면 💣 폭뢰로 바꿔 눌러요.', stats: ['전술', '정보'], view: 'm3-sea-sonar', secs: 90 },
  { id: 'e-sea-2', training: '해상', name: '어뢰 피하기', ctl: '끌기', how: '구축함을 좌우로 끌어 하얀 물살(어뢰)을 피해요.', stats: ['전술', '통솔'], view: 'e:torpedo', secs: 50 },
  { id: 'e-sea-3', training: '해상', name: '함대 대형', ctl: '놓기', how: '항모를 가운데 두고, 빨간 화살(적이 올 쪽)과 항모 사이에 호위함 4척을 놓아요. ▶ 시작하면 적 미사일이 날아와요. 3판.', stats: ['통솔', '전술', '지휘'], view: 'e:fleet', secs: 80 },
  { id: 'e-sea-4', training: '해상', name: '함포 사격', ctl: '끌기', how: '화면을 아래로 당겨 거리를 맞추고, 파도에 흔들리는 노란 고리가 적함 위에 올 때 손을 떼요. 5발.', stats: ['포격', '사격'], view: 'e:naval', secs: 70 },
  { id: 'e-sea-5', training: '해상', name: '바다에서 보급받기', ctl: '꾹', how: '보급함과 나란히 가요. 누르면 빨라지고 떼면 느려져요. 초록 칸 빠르기를 지키면 줄이 이어져요.', stats: ['군수', '통솔'], view: 'e:seafuel', secs: 45 },
  { id: 'e-sea-6', training: '해상', name: '상륙 물때', ctl: '톡', how: '물이 가장 높이 찬 순간에 눌러 상륙정을 출발시켜요. 이르거나 늦으면 갯벌에 걸려요. 5번.', stats: ['전술', '지휘'], view: 'e:tide', secs: 60 },
  { id: 'e-sea-7', training: '해상', name: '기뢰밭 지나기', ctl: '끌기', how: '우리 배에서 깃발까지 길을 한 번에 그려요. 부표가 놓인 좁은 길을 따라 기뢰를 피해요. 3판.', stats: ['전술', '정보'], view: 'e:mines', secs: 80 },
];

export const easyById = (id: string): EasyDef | undefined => EASY.find((e) => e.id === id);
export const easyFor = (training: string): EasyDef[] => EASY.filter((e) => e.training === training && e.view);

/** 내 능력은 9개라, 국정·인품 능력은 가장 가까운 것으로 바꿔 올림 */
const NEAR: Record<string, StatId> = { 지휘: '통솔', 과학: '정보', 언변: '정치', 매력: '정치', 법률: '정치', 외교: '정치', 청렴: '정치', 행정: '군수', 경제: '군수' };
const CORE = new Set<string>(['체력', '사격', '은밀', '통솔', '전술', '포격', '군수', '정치', '정보']);
/** 이 훈련이 올리는 내 능력(첫째가 주 능력, 겹치면 하나로) */
export function easyStats(e: EasyDef): StatId[] {
  const out: StatId[] = [];
  for (const s of e.stats) {
    const id = (CORE.has(s) ? s : NEAR[s]) as StatId | undefined;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
/** 둘째·셋째 능력이 받는 몫 */
export const EASY_SUB_SHARE = 0.5;

export const EASY_MAX_LV = 5;
/** 지금 단계(1~5) */
export const easyLv = (lv: Record<string, number> | undefined, id: string) => Math.max(1, Math.min(EASY_MAX_LV, lv?.[id] ?? 1));
/** 단계 → 빠르기·어려움(1 ~ 2) */
export const easyLevel = (lv: number) => 1 + (Math.max(1, Math.min(EASY_MAX_LV, lv)) - 1) * 0.25;
/** 별 2개 넘게 받으면 다음 단계 */
export const easyNextLv = (lv: number, stars: number) => (stars >= 2 ? Math.min(EASY_MAX_LV, lv + 1) : lv);
/** 3단계부터 병과 숙련도 같이 오름: 훈련 → 병과 */
export const EASY_UNIT_LV = 3;
export const EASY_UNITS: Record<string, string[]> = {
  잠입: ['sf'], 체력: ['inf'], 전술: ['tank'], 사격: ['inf'], 포격: ['spg'], 정보: ['drone'],
  통솔: ['inf'], 보급: ['ifv'], 해킹: ['hack'], 모병: ['inf'], 항공: ['jet'], 해상: ['dd'],
};
