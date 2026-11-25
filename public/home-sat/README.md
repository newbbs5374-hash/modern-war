# 본부 지도 실사 자료(11/25, 자동 생성)

- `<나라>-0.webp`·`<나라>/1-x-y.webp`·`<나라>.json`: `python3 scripts/gen_homesat.py <homeviews.json> <s2tiles.json> [나라]`
  (ESA WorldCover 2021 Sentinel-2 합성, CC BY 4.0. 바다는 투명, json에 정밀 해안선)
- `<나라>-depth.webp`·`-sh-am|noon|pm.webp`·`-relief.json`: `python3 scripts/gen_homerelief.py <homeviews.json> [나라]`
  (Mapzen Terrarium 높이·수심, AWS Open Data)
- homeviews.json: `OUT=... npx vitest run --config sim/vitest.config.ts sim/homeview.test.ts`
- s2tiles.json: esa-worldcover-s2 버킷 rgbnir/2021/ 목록에서 타일 이름(N37E126 …)만 뽑은 것
