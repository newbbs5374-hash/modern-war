# 3D 메인 전투 (battle3d)

시험판 "철벽 작전" v5.4(three.js 단일 HTML)를 현대전으로 옮긴 것. 배치 → 자동 전투(1초 20번 계산) → 명령 스킬(고를 때 시간 정지).

| 파일 | 하는 일 |
| --- | --- |
| `units.ts` | 병과 20종·명령 7종 수치, 계산 간격(0.05초) |
| `field.ts` | 전장 설정의 모양(`FieldConfig`)과 배치 칸 계산 |
| `fields/coast.ts` | 전장 1: 해안 상륙(육+해+공). 지형 함수·적 배치·기본 배치·예산·제한 시간 |
| `fields/index.ts` | 전장 목록. 새 전장은 파일 하나 만들어 여기에 더함 |
| `sim.ts` | 전투 계산기. three.js 안 씀. 같은 전장·배치·명령이면 같은 결과 |
| `outcome.ts` | 계산 결과 → 게임 결과(승패·별·한 줄) |
| `view.ts` | 화면(three.js). 계산 결과를 읽어서 그리기만 함. 시험판 코드를 거의 그대로 옮겨 아직 타입 검사 끔(`@ts-nocheck`) |
| `view-ui.ts` | 화면 위 글자·버튼 틀과 CSS(그림자 DOM이라 게임 CSS와 안 섞임) |
| `fixtures/` | 시험판 원본 코드를 그림 없이 돌린 기준 결과 |
| `sim.test.ts` | 기준 결과와 유닛 하나하나까지 같은지 시험 |

모형은 `public/battle3d/glb/`, 출처는 `public/battle3d/CREDITS.md`. Jet·Heli(jeremy, CC-BY 3.0)는 이름 표시 필수.

## 규칙

- 화면 코드는 체력·피해·위치를 바꾸지 않음. 계산기는 `sim.fx`(그림 신호)와 `visFire` 같은 표시용 값만 남기고, 화면이 그걸 읽음.
- 난수는 시험판과 같음: 유닛 만들 때 씨앗 7, 전투 시작 때 씨앗 11.
- 기본 배치로 명령 없이 두면 171.6초에 승리(시험 `sim.test.ts`). 수치를 바꾸면 이 시험의 기준값도 다시 뽑아야 함.

## 새 전장 만들기

1. `fields/coast.ts`를 복사해 지형 함수(`coastX`·`hAt`·`riverZ`)와 적·기본 배치를 바꿈. 바다 없는 전장은 `coastX`가 `-Infinity`, 바다만 있는 전장은 `Infinity`.
2. `fields/index.ts`에 등록.
3. 나무·마을 같은 꾸미기는 `view.ts`의 `SCENERY`에 함수 하나 더함(없으면 맨땅).
4. 연습장 목록(`src/battle/spec.ts`의 `PRACTICE`)에 `{ frame: 'b3d', variant: '<전장 id>' }`로 추가.
