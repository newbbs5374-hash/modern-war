# 본부 지도 실사 자료(자동 생성, 11/24 C2)

`python3 scripts/gen_homegeo.py <내려받은 폴더>` 로 만듦. 직접 고치지 마세요.
- `night-<나라>.webp`: NASA 야간 위성 사진(Black Marble)에서 불빛만 남긴 그림
- `relief-<나라>.webp`: 실제 지형 높이로 만든 산 그림자(북서쪽 빛)
- `geo-<나라>.json`: 실제 고속도로·국도·철도·강(Natural Earth) + 가까이 보는 나라의 밤 불빛 점
- `bounds.json`: 그림 범위(경도·위도). 범위는 `sim/homeview.test.ts`가 본부 지도 화면에 맞춰 냄
