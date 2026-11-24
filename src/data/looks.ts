// 내 지도자 얼굴 고르기(11-24 대장 지시: 남·여 × 30·40·50·60대 = 8가지).
// 그림 파일: src/assets/portraits/player-<성별><나이대>.webp  예) player-m40.webp · player-f30.webp
// 그림이 아직 없으면 TEMP의 임시 그림을 보여 줘요(넣는 순간 자동으로 바뀜).

export const LEADER_LOOKS = ['m30', 'm40', 'm50', 'm60', 'f30', 'f40', 'f50', 'f60'] as const;
export type LeaderLook = (typeof LEADER_LOOKS)[number];

export const lookSex = (l: LeaderLook) => (l[0] === 'm' ? '남' : '여');
export const lookAge = (l: LeaderLook) => `${l.slice(1)}대`;
export const lookName = (l: LeaderLook) => `${lookSex(l)} ${lookAge(l)}`;
export const isLook = (v: unknown): v is LeaderLook => typeof v === 'string' && (LEADER_LOOKS as readonly string[]).includes(v);

/** 진짜 그림이 오기 전 임시 그림(이미 있는 얼굴 중 나이·성별이 비슷한 것) */
export const LOOK_TEMP: Record<LeaderLook, string> = {
  m30: 'aide-류지후',
  m40: 'player',
  m50: 'face-kr-m-50-14',
  m60: 'face-kr-m-60-12',
  f30: 'aide-권나래',
  f40: 'aide-박서진',
  f50: 'face-kr-f-50-09',
  f60: 'face-kr-f-60-05',
};

/** 내 사진 그림 키(앞에서부터 있는 것). 얼굴을 안 고른 옛 판은 예전처럼 player → 우리 나라 지도자 */
export function playerKeys(p: { countryId: string; look?: LeaderLook }): string[] {
  return p.look ? [`player-${p.look}`, LOOK_TEMP[p.look], 'player', `leader-${p.countryId}`] : ['player', `leader-${p.countryId}`];
}
