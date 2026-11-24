// 스탯 18개(11-24 대장 요청 3번): 예전 9개(전투·훈련에 그대로 씀) + 국정·인품 9개(장관·참모·장군 능력에 씀).
// 5갈래: 현장 전투 · 군사 지휘 · 국정 운영 · 정보·기술 · 인품
import type { PersonOrigin } from './cabinet';
import type { StatId } from './officers';

export type Stat2Id = '지휘' | '행정' | '경제' | '외교' | '법률' | '과학' | '언변' | '청렴' | '매력';
export const STAT2_IDS: Stat2Id[] = ['지휘', '행정', '경제', '외교', '법률', '과학', '언변', '청렴', '매력'];
export type AnyStat = StatId | Stat2Id;

export const STAT_GROUPS18: Array<{ name: string; icon: string; ids: AnyStat[] }> = [
  { name: '현장 전투', icon: '🎯', ids: ['체력', '사격', '은밀', '포격'] },
  { name: '군사 지휘', icon: '🎖️', ids: ['통솔', '지휘', '전술', '군수'] },
  { name: '국정 운영', icon: '🏛️', ids: ['정치', '행정', '경제', '외교', '법률'] },
  { name: '정보·기술', icon: '🛰️', ids: ['정보', '과학'] },
  { name: '인품', icon: '💎', ids: ['언변', '청렴', '매력'] },
];
export const ALL_STATS: AnyStat[] = STAT_GROUPS18.flatMap((g) => g.ids);

export const STAT18: Record<AnyStat, { icon: string; text: string }> = {
  체력: { icon: '💪', text: '현장에서 버티는 힘' },
  사격: { icon: '🎯', text: '총을 잘 쏨' },
  은밀: { icon: '🥷', text: '몰래 움직이기·공작' },
  포격: { icon: '💥', text: '포·미사일 운용' },
  통솔: { icon: '🫡', text: '사람을 따르게 하는 힘' },
  지휘: { icon: '🎖️', text: '큰 부대를 한꺼번에 움직이는 힘' },
  전술: { icon: '♟️', text: '싸움의 수 읽기' },
  군수: { icon: '📦', text: '물자·보급·살림' },
  정치: { icon: '🗳️', text: '국회·정당과 밀고 당기기' },
  행정: { icon: '🗂️', text: '조직을 굴리고 일을 끝내는 힘' },
  경제: { icon: '📈', text: '돈·산업·세금 감각' },
  외교: { icon: '🌐', text: '다른 나라와 협상' },
  법률: { icon: '⚖️', text: '법·수사·제도' },
  정보: { icon: '🛰️', text: '첩보·분석' },
  과학: { icon: '🔬', text: '기술·연구 이해' },
  언변: { icon: '🎙️', text: '말과 기자회견(청문회 유리)' },
  청렴: { icon: '🤍', text: '낮으면 스캔들이 잘 남' },
  매력: { icon: '✨', text: '지지도·충성을 끄는 힘' },
};

/** 인물 출신별 새 스탯 모양(강한 것 +, 약한 것 −). 예전 9개 모양은 PERSON_ORIGINS.shape */
export const ORIGIN_SHAPE2: Record<PersonOrigin, Partial<Record<Stat2Id, number>>> = {
  econ: { 경제: 8, 행정: 6, 지휘: -4, 매력: -2 },
  general: { 지휘: 8, 언변: -4, 외교: -4, 법률: -4 },
  scientist: { 과학: 8, 행정: 3, 매력: -4, 언변: -2 },
  athlete: { 매력: 7, 언변: 3, 법률: -4, 경제: -4, 과학: -3 },
  diplomat: { 외교: 8, 언변: 6, 지휘: -5 },
  spy: { 외교: 4, 지휘: -2, 매력: -5, 언변: -5 },
  lawyer: { 법률: 8, 언변: 6, 청렴: 5, 경제: -2 },
  chaebol: { 경제: 7, 매력: 4, 청렴: -5, 행정: -1 },
  broadcaster: { 언변: 8, 매력: 7, 청렴: -4, 과학: -3 },
  activist: { 청렴: 6, 언변: 4, 경제: -3, 지휘: -3 },
  doctor: { 과학: 6, 청렴: 3, 행정: 2, 지휘: -3 },
  mayor: { 행정: 8, 경제: 3, 매력: 2, 외교: -3 },
  commando: { 지휘: 3, 언변: -5, 법률: -5, 경제: -4 },
  admiral: { 지휘: 8, 외교: 1, 언변: -4, 법률: -4 },
  commoner: { 매력: 4, 청렴: 4, 외교: -3, 과학: -3 },
  religious: { 청렴: 6, 매력: 5, 언변: 3, 과학: -4 },
  soldier: { 지휘: 5, 경제: -4, 언변: -3, 외교: -3 },
  partisan: { 언변: 6, 매력: 3, 청렴: -4, 과학: -3 },
  professor: { 과학: 6, 경제: 3, 외교: 3, 지휘: -4, 매력: -2 },
  exec: { 경제: 7, 행정: 5, 청렴: -3, 언변: -1 },
  prosecutor: { 법률: 8, 청렴: 2, 행정: 3, 외교: -3, 매력: -2 },
  journalist: { 언변: 6, 청렴: 2, 매력: 2, 지휘: -4, 경제: -2 },
};

/** 인물 출신이 강하고 약한 스탯 3개씩(안내·표에 씀) */
export function originStrongWeak(shape: Partial<Record<AnyStat, number>>): { strong: AnyStat[]; weak: AnyStat[] } {
  const e = Object.entries(shape) as Array<[AnyStat, number]>;
  return {
    strong: e.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    weak: e.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => k),
  };
}

/** 그림 파일 이름표(icon-stat-<영문>.png, 11-24) */
export const STAT_SLUG: Record<AnyStat, string> = {
  체력: 'fitness', 사격: 'shooting', 은밀: 'stealth', 포격: 'artillery', 통솔: 'leadership', 지휘: 'command', 전술: 'tactics', 군수: 'logistics',
  정치: 'politics', 행정: 'admin', 경제: 'economy', 외교: 'diplomacy', 법률: 'law', 정보: 'intel', 과학: 'science', 언변: 'speech', 청렴: 'integrity', 매력: 'charisma',
};
