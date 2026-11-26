// 지도·본부 그림에 쓰는 병과·땅 이름(11-26 2.5D 전투를 없애며 battle/field.ts에서 옮김)
export type FTerrain = '평지' | '숲' | '산' | '시가지' | '도심' | '바다' | '해협' | '해안';
export type Layer = 'land' | 'sea' | 'air';
export type FKind = 'infantry' | 'tank' | 'artillery' | 'aa' | 'drone' | 'fighter' | 'destroyer' | 'submarine' | 'carrier' | 'cruiser' | 'hq';
