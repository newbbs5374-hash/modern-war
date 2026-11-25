# 세계지도 바탕 그림(11/25 새로 만듦)

`python3 scripts/gen_worldsat.py <s2tiles.json> <earth-night.jpg> <clouds.png>` 로 만듦. 직접 고치지 마세요.
- `world-map.webp`: 바다 깊이 색(Mapzen Terrarium) + 위성 땅(ESA WorldCover 2021 Sentinel-2, CC BY 4.0) + 산 그림자. 경도 -15~300, 위도 5~80, 정거원통, 1도 = 12px(3780×900)
- `world-night.webp`: 밤 불빛(NASA Black Marble), `world-clouds.webp`: 구름(NASA)
- 확대용 고해상 조각은 `public/world-sat/`(1도 = 60px), 정밀 국경선 `public/world-sat/borders.json`(scripts/gen_worldborders.py, Natural Earth 10m)
