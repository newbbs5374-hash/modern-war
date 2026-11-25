# 위성 지도 전투 바탕(11/25, 자동 생성)

도시마다 `<도시 id>.webp`(가운데 = 도시 실제 위치, 약 41km × 41km)와 `src/data/fieldReal.json`(전투 육각 169칸의 실제 땅 모양).
만드는 법: `OUT=/tmp/fieldcities.json npx vitest run --config sim/vitest.config.ts sim/fieldcities.test.ts` → `python3 scripts/gen_fieldsat.py /tmp/fieldcities.json [도시 id ...]`
자료: ESA WorldCover 2021 땅 덮개·Sentinel-2 합성(CC BY 4.0), Mapzen Terrarium 높이·수심(AWS Open Data).
