# 3D 전투 모형

`glb/` 39개는 시험판 "철벽 작전" v5.4(대장 인계, 2026-11-26)에서 받은 모형이에요.

- Quaternius 나무·바위·풀·건물·부두·소품·전차(Tank, Tank4): CC0, 이름 표시 안 해도 됨
- Jet, Heli: jeremy (Poly Pizza), CC-BY 3.0 → 게임 안 배치 화면에 이름을 꼭 표시해야 함(battle3d.html 아래쪽 문구)

배는 모두 코드로 만든 도형이에요(src/battle3d/view.ts makeModel).

## 11-26 새 병과·실제 모형(대장이 Sketchfab에서 받아 줌, 모두 CC-BY 4.0 → battle3d.html 문구에 이름 표시)

| 파일 | 병과 | 만든 사람 |
|---|---|---|
| BM.glb | 탄도미사일(MAZ-543) | Muhamad Mirza Arrafi |
| MLRS.glb | 다연장로켓(BM-30) | SIpriv |
| SAM.glb | 장거리 방공(Patriot) | Snicks Game Development |
| CSM.glb | 해안 미사일(3K60 Bal) | 42manako |
| AAV.glb | 상륙장갑차(AAV7A1) | 42manako |
| UAV.glb | 정찰 무인기(MQ-9) | Tyler V Howell |
| F35.glb | 스텔스 전투기(F-35) | SIpriv |
| AWACS.glb | 조기경보기(E-3) | Muhamad Mirza Arrafi |
| Gunship.glb | 지상 공격기(AC-130) | SIpriv |
| KF21.glb | 전투기(KF-21, 옛 Jet 대신) | Muhamad Mirza Arrafi |
| Ford.glb | 항공모함(제럴드 포드) | Uxman |

텍스처는 빼고 평균 색만 남겨 가볍게 줄였어요(34~120KB). 바다 드론은 코드 도형이에요.
