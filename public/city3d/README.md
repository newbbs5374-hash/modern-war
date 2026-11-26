# 도시 3D 자료 (11/26 서울 시험)

- `seoul.json`: OpenStreetMap 건물·큰길·물·공원, 서울시청(126.978, 37.5665) 기준 미터.
  범위 경도 126.90~127.08, 위도 37.49~37.60. 건물은 부피 큰 순 1만 6천 채.
- 출처·조건: © OpenStreetMap 기여자, ODbL 1.0 (https://www.openstreetmap.org/copyright). 3D 화면 오른쪽 아래에 표시함.
  요청이 오면 이 파일(가공한 자료)을 나눠 주면 됨.
- 다시 만들기: GitHub Actions의 `city3d-data`를 손으로 실행(Geofabrik 한국 파일 → osmium으로 자르기 → scripts/gen_city3d.py).
- 화면: src/ui/City3D.tsx (도시 창 '🏙️ 3D' 버튼, 자료가 있는 도시만).
