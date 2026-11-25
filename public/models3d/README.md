# 3D 전장(시험) 모델 — 11/25 1번안 시험

연습장 "3D 전장(시험)"(src/ui/battle/Field3D.tsx)에서만 씀.

| 파일 | 무엇 | 출처 · 조건 |
| --- | --- | --- |
| tank.glb | 전차(알타이 주력 전차) | "Altay main battle tank (FBX)" by Jeyhun1985, https://sketchfab.com/3d-models/altay-main-battle-tank-fbx-84e0469f7d114099a00ff5696b883652 , CC BY 4.0 (이름 표시 필수 — 게임 화면 아래에 표시함). 46MB → 약 3만 면으로 줄이고 meshopt 압축(바꾼 것 있음). |
| soldier.glb | 병사(서기·걷기·달리기 동작) | three.js 예제 Soldier.glb (https://github.com/mrdoob/three.js/tree/master/examples/models/gltf), Mixamo 캐릭터·동작. 텍스처 webp 1024로 줄이고 meshopt 압축. |

다시 만들기: `npx gltf-transform weld` → Python fast-simplification(90% 줄임) → `npx gltf-transform meshopt`.
