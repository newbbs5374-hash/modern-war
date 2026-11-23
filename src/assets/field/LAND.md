# 본부 지도 꾸밈 그림 13장 · GPT 명령문 (복사용)

본부 지도(수도 화면)의 건물·나무·산을 그림으로 바꾸는 명령문이에요. 각 그림의 **회색 상자 안 영어 문장 전체**를 그대로 복사해서 ChatGPT(이미지 만들기)에 붙여 넣으면 돼요. 화풍 문구와 **저장할 파일 이름**이 문장 안에 다 들어 있어요.

- 그림을 넣은 칸만 바뀌고, 없는 칸은 지금처럼 도형으로 그려요. 몇 장만 먼저 넣어도 돼요.
- **도로·강은 그림이 필요 없어요.** 도시마다 길 모양이 다르고, 차가 다니고 물이 흐르는 움직임이 있어서 게임이 계속 그려요.
- 빌딩·주택·나무는 한 장을 여러 번 반복해서 써요. 그래서 1번·2번 두 가지 모양을 만들면 덜 똑같아 보여요.

## 채팅창은 2개로 나눠요

| 채팅창 | 만들 그림 | 장수 | 처음에 같이 올릴 참고 그림 |
| --- | --- | --- | --- |
| **창 1 · 건물** | 1번~10번 | 10장 | `ref-home-map.png`(지금 본부 지도) |
| **창 2 · 자연** | 11번~13번 | 3장 | `ref-home-map.png` + 창 1에서 만든 `land-house-1.png` |

- 참고 그림은 `field-art-ref` 폴더에 있어요(이 메시지에도 첨부). 지금 임시 도형으로 된 본부 지도라, 그림이 들어갈 자리와 크기를 GPT가 알 수 있어요.
- 각 창의 **첫 그림을 만들 때만** 참고 그림을 같이 올리면 돼요. 다음 그림부터는 같은 창이 앞 그림을 기억해요.
- 창 1에서는 1번 랜드마크가 마음에 들 때까지 고친 다음 넘어가세요. 1번 그림이 화풍의 기준이 돼요.

## 화풍: 반실사

애니메이션·만화풍이 아니라 **반실사**(실제 같은 비율·재질, 고급 모바일 전략 게임 그림 느낌)예요. 만화처럼 나오면 "더 실사처럼, 만화풍 말고"라고 고쳐 달라고 하세요.

## 만들 때 요령

1. 결과가 흰 배경으로 나오면: **"배경을 투명하게 다시 만들어 줘"** 라고 한 번 더 말하세요.
2. 건물 **바닥이 그림 아래쪽 끝 가까이** 오게 해 주세요. 게임이 그림 아랫부분을 땅에 맞춰 세워요. 위에 떠 있으면 "건물을 그림 아래쪽에 붙여 줘"라고 하세요.
3. 그림을 내려받을 때 **명령문에 적힌 파일 이름 그대로** 저장해 주세요(예: `land-tower-1.png`).
4. 다 만든 그림(몇 장만이어도)을 이 채팅에 올려 주시면 제가 게임에 넣어요.

## 창 1 · 건물 (10장)

### 1. 수도 랜드마크 · 파일 이름 `land-landmark.png` · 창 1 · 건물

- 어디에: 수도 한가운데 한 채. 가장 크고 특별한 건물
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 이 창의 첫 그림: `ref-home-map.png`를 같이 첨부하세요.

```
The attached screenshot shows the home city map where this sprite will stand on the land, drawn many times at small size; match that scale, but draw in the semi-realistic style described here, not the flat placeholder shapes of the screenshot. The capital's iconic landmark: a tall elegant modern tower with a slender spire, a glass observation ring near the top and a wide white stone base with steps, faintly glowing light-blue crystal accents (the nation's mythic blue crystal) in the spire. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-landmark.png
```

### 2. 고층 빌딩 1 · 파일 이름 `land-tower-1.png` · 창 1 · 건물

- 어디에: 도심 가운데 고층 빌딩(여러 번 반복해서 씀)
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A tall modern glass skyscraper, narrow and rectangular, blue-grey reflective glass with thin vertical steel lines, flat roof with a small rooftop structure. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-tower-1.png
```

### 3. 고층 빌딩 2 · 파일 이름 `land-tower-2.png` · 창 1 · 건물

- 어디에: 도심 가운데 고층 빌딩, 1번과 다른 모양
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A tall modern office tower with stepped setbacks near the top, warm beige stone and dark glass bands, a small antenna on the roof. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-tower-2.png
```

### 4. 중간 빌딩 1 · 파일 이름 `land-office-1.png` · 창 1 · 건물

- 어디에: 도심 바깥쪽 중간 높이 빌딩
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A mid-rise apartment building of about eight floors, light concrete with rows of balconies, a few green plants on balconies, flat roof. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-office-1.png
```

### 5. 중간 빌딩 2 · 파일 이름 `land-office-2.png` · 창 1 · 건물

- 어디에: 도심 바깥쪽 중간 높이 빌딩, 1번과 다른 모양
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A mid-rise office building of about six floors, white panels and blue windows in a grid, a small rooftop garden. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-office-2.png
```

### 6. 주택 1 · 파일 이름 `land-house-1.png` · 창 1 · 건물

- 어디에: 도시 가장자리 낮은 집
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A small two-story suburban house with a red-brown tiled pitched roof, cream walls, a small front porch and one tree-less tiny yard edge. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-house-1.png
```

### 7. 주택 2 · 파일 이름 `land-house-2.png` · 창 1 · 건물

- 어디에: 도시 가장자리 낮은 집, 1번과 다른 모양
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A small modern single-story house with a flat dark roof, white walls and large windows, a few small solar panels on the roof. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-house-2.png
```

### 8. 공장 · 파일 이름 `land-factory.png` · 창 1 · 건물

- 어디에: 수도 왼쪽 공장 지대
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A compact industrial factory with a saw-tooth roof, two tall chimneys with thin white steam, a small storage tank beside it. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-factory.png
```

### 9. 항구 · 파일 이름 `land-port.png` · 창 1 · 건물

- 어디에: 수도 오른쪽 바닷가 항구
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A small harbor quay with a large orange container gantry crane, a few stacked shipping containers in muted colors, concrete pier edge. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-port.png
```

### 10. 군 기지 · 파일 이름 `land-base.png` · 창 1 · 건물

- 어디에: 수도 아래쪽 군 기지
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A compact military base: a low command building with a radar dome, a helipad circle without letters, a small hangar and a perimeter fence, grey-green paint. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-base.png
```

## 창 2 · 자연 (3장)

### 11. 나무(활엽수) · 파일 이름 `land-tree-1.png` · 창 2 · 자연

- 어디에: 숲 자리에 여러 번 반복해서 씀
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 이 창의 첫 그림: `ref-home-map.png` + 창 1의 `land-house-1.png`를 같이 첨부하세요.

```
The attached screenshot shows the home city map where this sprite will stand on the land, drawn many times at small size; match that scale, but draw in the semi-realistic style described here, not the flat placeholder shapes of the screenshot. If a building sprite is also attached, match its exact art style. A single lush broadleaf tree with a round full green canopy and a short brown trunk. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-tree-1.png
```

### 12. 나무(침엽수) · 파일 이름 `land-tree-2.png` · 창 2 · 자연

- 어디에: 숲 자리에 여러 번 반복해서 씀, 1번과 섞여 나옴
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A single tall conifer pine tree, dark green layered branches in a cone shape, short trunk. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-tree-2.png
```

### 13. 산 · 파일 이름 `land-mountain.png` · 창 2 · 자연

- 어디에: 지도 위 산 자리
- 크기·배경: 1024×1024 정사각형 · 투명 배경 · 바닥이 그림 아래쪽
- 참고 그림: 없음(같은 창의 앞 그림과 같은 화풍)

```
Use exactly the same art style as the previous images in this chat. A single rocky mountain peak, grey-brown rock with green slopes at the bottom and a small snow cap on top, wide base. Mobile strategy game map decoration sprite for a near-future island nation. Semi-realistic art (realistic proportions, materials and details like a high-quality modern mobile city-builder or strategy game render, not anime, not cartoon, not chibi), three-quarter view from about 45 degrees above, front side facing the viewer and slightly to the right. Realistic soft shading with subtle painterly finish, believable concrete, glass, metal and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge. Exactly one object, horizontally centered, its base/ground contact sitting near the BOTTOM edge of the image (small margin), filling about 70 percent of the width. Bold simple silhouette that stays readable when shrunk to 24 pixels. Lighting from the top-left. No text, no letters, no numbers, no signs with writing, no flags, no logos, no people, no cars, no ground plane, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024. File name: save this image as land-mountain.png
```

## 넣는 곳 정리

- 저장소 폴더: `src/assets/field/` (지도 전투 그림과 같은 폴더, 채팅에 올려 주시면 제가 넣어요)
- 게임 안 ⚙️ 설정 → 🖼️ 그림 칸에서 "본부 지도 ·"로 시작하는 칸이 채워졌는지 볼 수 있어요.
