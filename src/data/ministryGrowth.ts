// 부처 단계별 성장(11-25 대장 요청 "각 부처도 단계별로 성장할 수 있도록, 외형도 바뀌고")
// 부처마다 청사 1~5단계. 단계가 오르면 부처 힘(장관+차관)이 커지고, 3·5단계에는 덤이 붙음.
// 단계마다 건물 그림이 바뀜: icon-min-<id>.webp(1단계) → icon-min-<id>-2 … -5.webp
// 그림이 아직 없으면 바로 아래 단계 그림 + 단계 테두리로 보여 줌(ui/CabinetUI MinIcon).
// 계산은 game/cabinet.ts(ministryPower) · game/cabinetOps.ts(업무 시간·결과, 공사 끝).

export const MIN_LV_MAX = 5;

/** 단계 이름(청사 모습) */
export const MIN_LV_NAME = ['', '본청', '증축 청사', '신청사', '종합청사', '국가 상징 청사'];
/** 단계마다 바뀌는 겉모습(그림 명령문과 같은 뜻) */
export const MIN_LV_LOOK = ['', '지금 건물 한 동', '옆에 새 동을 붙이고 마당·주차장', '유리로 된 높은 새 건물', '여러 동이 모인 정부 단지', '나라를 대표하는 큰 상징 건물·광장'];

/** 부처 힘 배율(장관 힘에 곱함): 1단계 ×1 … 5단계 ×1.6 */
export const MIN_LV_POWER = [0, 1, 1.12, 1.25, 1.4, 1.6];

/** 다음 단계로 올리는 값(지금 단계가 칸 번호) */
export const MIN_UP_MONEY = [0, 4000, 9000, 18000, 32000];
/** 공사 시간(시간) */
export const MIN_UP_HOURS = [0, 2, 4, 8, 12];
/** 그 부처 업무를 몇 번 끝내야 하는지(일을 해 본 부처만 큼) */
export const MIN_UP_WORK = [0, 1, 3, 6, 10];

/** 3단계 덤: 부처 업무 시간 −15% */
export const MIN_LV3_TASK_CUT = 0.15;
/** 5단계 덤: 부처 업무 결과 +20% */
export const MIN_LV5_TASK_MULT = 1.2;

export const minLvPower = (lv: number) => MIN_LV_POWER[Math.max(1, Math.min(MIN_LV_MAX, lv))];

/** 단계별 효과 한 줄(정보창 표) */
export function minLvText(lv: number): string {
  const p = `부처 힘 ×${minLvPower(lv)}`;
  if (lv >= 5) return `${p} · 업무 시간 −15% · 업무 결과 +20%`;
  if (lv >= 3) return `${p} · 업무 시간 −15%`;
  return p;
}
