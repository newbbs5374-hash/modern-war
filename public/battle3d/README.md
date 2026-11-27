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

## 11-27 상자 모양 부대·시가지·방어 시설 실제 모형(대장이 Sketchfab에서 받아 줌, 모두 CC-BY 4.0)

| 파일 | 쓰는 곳 | 만든 사람 |
|---|---|---|
| Inf.glb | 보병·특수부대(팔 내린 자세로 고침) | Kolos Studios |
| K2.glb | 전차(K2, 옛 Tank 대신) | jjj0605 |
| K9.glb | 포병(K9, 옛 Tank4 대신) | Muhamad Mirza Arrafi |
| IFV.glb | 기갑병 | Tom Zimmermann |
| Biho.glb | 방공부대(비호) | 신스의타 |
| EW.glb | 해킹부대(ZIL-131 통신차) | Muhamad Mirza Arrafi |
| Apache.glb | 공격 헬기(AH-64D, 옛 Heli 대신) | Muhamad Mirza Arrafi |
| Sejong.glb | 구축함(세종대왕함, 바다 판 뺌) | snrnsrk5 |
| SonWonil.glb | 잠수함(손원일함) | Artech |
| SSN.glb | 원자력 잠수함(버지니아급) | Muhamad Mirza Arrafi |
| LHA.glb | 강습상륙함(USS America) | SB-129 |
| Zumwalt.glb | 레이저 방공함(줌왈트) | Yakudami |
| B2.glb | 폭격기(B-2) | Caelin |
| Tomahawk.glb | 미사일(토마호크) | rickslash |
| Shahed.glb | 자폭 드론(샤헤드-136) | Chenzoss |
| F18.glb | 함재기(F/A-18) | SIpriv |
| RuinHouse.glb · RuinBig.glb · RuinPack.glb | 시가지 무너진 건물 | ribot02 · local.yany · RayznGames |
| Barrier.glb | 길 위 바리케이드 | Kolos Studios |
| DefBunker.glb · DefSandbag.glb · DefHedgehog.glb · DefRadar.glb | 벙커·모래주머니·대전차 장애물·지휘소 레이더 | Golden · 00amza · Gerhald · Muhamad Mirza Arrafi |

줄이는 법: 텍스처를 빼고 부대는 재질마다 평균 색, 건물·시설은 텍스처 색을 점 색(정점 색)으로 옮김 → 면 줄이기(meshoptimizer) → 위치 양자화. 8~470KB.
