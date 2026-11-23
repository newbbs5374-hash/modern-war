# 지도 위 전투 그림 만들기 (GPT 프롬프트)

지도 위 전투에 쓰는 그림 목록과, GPT(ChatGPT 이미지 만들기)에 그대로 붙여 넣을 프롬프트예요.
그림을 만들어 이 채팅에 올려 주시면 제가 이름을 맞춰 넣을게요. 직접 넣으실 때는 저장소의 `src/assets/field/` 폴더에 아래 **파일 이름** 그대로 넣으면 바로 게임에 나와요. 그림이 없는 칸은 지금처럼 임시 그림(이모지·색 육각형)이 나와요.

## 먼저 알아 두기 (쉬운 규칙)

| 종류 | 만들 때 크기 | 넣을 때 크기 | 배경 | 방향 |
| --- | --- | --- | --- | --- |
| 부대 말(유닛) | 1024×1024 정사각형 | 256×256 | **투명** | **오른쪽을 보게** 한 장만. 왼쪽으로 갈 때는 게임이 좌우로 뒤집어요(8방향 필요 없음) |
| 지형 타일 | 1024×1024 정사각형 | 512×512 | 꽉 찬 그림(투명 아님) | 바로 위에서 내려다본 모습. **이어 붙여도 이음새가 안 보이게(seamless)**. 육각형 모양은 게임이 잘라요 |
| 효과·표시 | 1024×1024 정사각형 | 256×256 | **투명** | 상관없음 |

- 파일 형식: png 또는 webp(webp가 가벼움). 한 장에 300KB 이하 권장.
- 우리 편·적 편 색은 게임이 말 아래에 파란 원·빨간 원으로 그려요. 그래서 **그림에는 나라 표시·국기·글자를 넣지 않아요.** 한 그림을 양쪽이 같이 써요.
- 말은 화면에서 손톱만 하게(약 30픽셀) 보여요. 작게 줄여도 알아볼 수 있게 **모양이 굵고 단순한** 그림이 좋아요.
- ChatGPT에서 투명 배경: 프롬프트 끝의 "transparent background"를 꼭 넣고, 결과가 흰 배경이면 "배경을 투명하게 다시 만들어 줘"라고 한 번 더 말하면 돼요.
- 같은 대화방에서 이어서 만들면 화풍이 더 잘 맞아요. 첫 그림이 마음에 들면 "이 그림과 같은 화풍으로"를 붙여 주세요.

## 화풍 통일 공통 문구 (모든 프롬프트 맨 앞에 붙이기)

**부대 말·효과용**
```
Mobile strategy game unit sprite, clean stylized military art, three-quarter top-down view (camera 45 degrees above), facing right, soft cel shading, crisp dark outline, bright readable colors, near-future military in a muted grey-green and sand palette, single object centered with empty margin, no text, no letters, no numbers, no flags, no insignia, no logos, no shadow on ground, transparent background.
```
(설명: 휴대폰 전략 게임용 말 그림, 45도 위에서 본 모습, 오른쪽을 봄, 셀 음영, 진한 테두리, 회녹색·모래색 근미래 군대, 가운데 하나만, 글자·국기·마크 없음, 바닥 그림자 없음, 투명 배경)

**지형 타일용**
```
Seamless tileable game terrain texture, straight top-down view, stylized hand-painted mobile strategy game style, soft lighting from top-left, readable at small size, no objects cut at the edges, no text, square image, edges wrap perfectly.
```
(설명: 이어 붙여도 이음새가 없는 지형 무늬, 바로 위에서 본 모습, 손그림 느낌, 작게 봐도 알아보기 쉽게, 글자 없음)

## 1. 부대 말 (11장)

| 파일 이름 | 무엇 | 프롬프트(공통 문구 뒤에 붙이기) |
| --- | --- | --- |
| `unit-infantry` | 보병 | `A squad of three modern infantry soldiers with rifles and helmets advancing together, compact group.` |
| `unit-tank` | 전차 | `A modern main battle tank with a long cannon, angular armor plates, tracks visible.` |
| `unit-artillery` | 포병(자주포) | `A self-propelled howitzer on tracks with its long barrel raised high at 40 degrees.` |
| `unit-aa` | 방공부대 | `A mobile air-defense missile launcher truck with a rotating radar dish and four missile tubes pointed up.` |
| `unit-drone` | 정찰 드론 | `A small military reconnaissance drone with a V-tail and a camera pod under the nose, flying.` |
| `unit-fighter` | 전투기 비행단 | `A formation of two sleek stealth fighter jets flying side by side, one slightly behind the other.` |
| `unit-destroyer` | 구축함 | `A modern guided-missile destroyer warship with a sharp bow, gun turret on the front and radar mast, on a small patch of white wake.` |
| `unit-submarine` | 잠수함 | `A modern attack submarine half surfaced, conning tower visible, dark hull, small wake.` |
| `unit-carrier` | 항공모함 | `A large modern aircraft carrier with a flat flight deck, island tower on the right side, three tiny jets parked on deck, white wake.` |
| `unit-cruiser` | 적 기함(순양함) | `A heavy missile cruiser flagship, bigger than a destroyer, two gun turrets, many vertical missile hatches, tall command mast.` |
| `unit-hq` | 적 사령부(도심) | `A fortified military command bunker building with sandbags, a radio antenna tower and camouflage netting.` |

## 2. 지형 타일 (8장)

| 파일 이름 | 무엇 | 프롬프트(타일 공통 문구 뒤에 붙이기) |
| --- | --- | --- |
| `tile-plain` | 평지 | `Green grassland with small patches of lighter grass and a few tiny flowers.` |
| `tile-forest` | 숲 | `Dense forest canopy of round dark-green tree tops seen from above.` |
| `tile-mountain` | 산 | `Rocky grey-brown mountain ridges with small snow patches, seen from above.` |
| `tile-city` | 시가지 | `Dense small city blocks seen from above, grey and beige rooftops, narrow streets in a grid.` |
| `tile-downtown` | 도심 | `Downtown high-rise rooftops seen from above, darker blue-grey roofs, helipad markings without letters, wide avenues.` |
| `tile-sea` | 바다 | `Deep blue ocean water with gentle small waves and soft highlights.` |
| `tile-strait` | 해협(얕은 바다) | `Shallow turquoise coastal water with visible sandy sea floor and small ripples.` |
| `tile-beach` | 상륙 거점(해안) | `Sandy beach with a few footprints and small dunes, light yellow sand.` |

## 3. 효과·표시 (3장)

| 파일 이름 | 무엇 | 프롬프트(말 공통 문구 뒤에 붙이기) |
| --- | --- | --- |
| `fx-explosion` | 맞았을 때 폭발 | `A bright cartoon explosion burst with orange fire, yellow core and grey smoke puffs, round shape.` |
| `fx-wreck` | 부서진 자리 | `A burning wreck pile of twisted dark metal with a thin smoke column, small.` |
| `mark-landing` | 상륙 거점 깃발 | `A simple tall pole with a plain blue pennant flag and a small pile of supply crates at its base.` |

## 넣는 곳 정리

- 저장소 폴더: `src/assets/field/`
- 파일 이름: 위 표의 이름 + `.png` 또는 `.webp` (예: `unit-tank.webp`)
- 게임 안 ⚙️ 설정 → 🖼️ 그림 칸에서 어떤 칸이 채워졌는지 볼 수 있어요.

## 특화 유닛·독점 병과 그림 (29장)

연방마다 2개인 🌟특화 유닛과 👑독점 병과 그림 칸(`unit-sp-us-2`, `unit-ex-lhd` …)의 반실사 명령문은 같은 폴더의 `SPECIALS.md`에 있어요. 그림이 없으면 바탕 병과 그림이 대신 나와요.
