"""도시 상징 그림(로고·문장·휘장)을 위키미디어 공용에서 받아 96px webp로 저장.
목록·라이선스는 src/data/cityLogos.ts. 공공 저작물·CC0·CC BY-SA만 받음. 출처는 src/assets/logos/CREDITS.md."""
import io, json, re, sys, urllib.parse, urllib.request
from PIL import Image

src = open("src/data/cityLogos.ts", encoding="utf-8").read()
PICK = [(m[0], m[1], m[2]) for m in re.findall(r"(\S+): \{ key: '([a-z]+)', file: '([^']+)'", src)]
OK = ("Public domain", "CC0", "CC BY-SA", "CC BY")
UA = {"User-Agent": "modern-war-asset-script/1.0"}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
out = sys.argv[1]
credits = ["# 도시 상징 그림 출처", "", "위키미디어 공용(commons.wikimedia.org)에서 받아 96px로 줄임. 목록: src/data/cityLogos.ts", "", "| 도시 | 파일 | 라이선스 | 만든 이 |", "|---|---|---|---|"]
fail = []
for i in range(0, len(PICK), 20):
    part = PICK[i:i + 20]
    q = "|".join("File:" + f for _, _, f in part)
    j = json.loads(get("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=200&iiextmetadatafilter=LicenseShortName|Artist&titles=" + urllib.parse.quote(q)))
    norm = {n["to"]: n["from"] for n in j["query"].get("normalized", [])}
    by = {norm.get(p["title"], p["title"])[5:]: (p.get("imageinfo") or [None])[0] for p in j["query"]["pages"].values()}
    for city, key, f in part:
        ii = by.get(f)
        lic = ii and ii["extmetadata"].get("LicenseShortName", {}).get("value", "")
        if not ii or not lic.startswith(OK):
            fail.append(f"{city} {f} {lic}"); continue
        img = Image.open(io.BytesIO(get(ii["thumburl"]))).convert("RGBA")
        img.thumbnail((96, 96), Image.LANCZOS)
        img.save(f"{out}/logo-{key}.webp", "WEBP", quality=82, method=6)
        artist = re.sub("<[^>]+>", "", ii["extmetadata"].get("Artist", {}).get("value", "")).strip().replace("|", "/").replace("\n", " ")[:80]
        credits.append(f"| {city} | [{f}]({ii['descriptionurl']}) | {lic} | {artist} |")
        print("ok", city, lic)
open(f"{out}/CREDITS.md", "w", encoding="utf-8").write("\n".join(credits) + "\n")
print("받음", len(PICK) - len(fail), "실패", fail)
