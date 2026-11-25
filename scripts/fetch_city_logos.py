"""도시 상징 그림(로고·문장·휘장)을 위키미디어 공용에서 받아 96px webp로 저장.
목록·라이선스는 src/data/cityLogos.ts. 공공 저작물·CC0·CC BY-SA만 받음. 출처는 src/assets/logos/CREDITS.md."""
import io, json, os, re, sys, urllib.parse, urllib.request
from PIL import Image

src = open("src/data/cityLogos.ts", encoding="utf-8").read()
PICK = [(m[0], m[1], m[2]) for m in re.findall(r"(\S+): \{ key: '([a-z]+)', file: '([^']+)'", src)]
# 이미 받은 그림은 그대로 둠(11-25: 여백 잘라 둔 그림을 덮어쓰지 않게)
PICK = [p for p in PICK if not os.path.exists(f"{sys.argv[1]}/logo-{p[1]}.webp")]
OK = ("Public domain", "CC0", "CC BY-SA", "CC BY")
UA = {"User-Agent": "modern-war-asset-script/1.0"}
def get(u):
    # 너무 빨리 받으면 429 → 기다렸다 다시(11-25)
    import time, urllib.error
    for i in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
            time.sleep(1.0)
            return r
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(10 * (i + 1))
    raise RuntimeError("429 계속")
out = sys.argv[1]
credits = []
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
        # 흰·투명 여백 잘라 칸을 꽉 채움(11-25)
        px = img.load()
        for yy in range(img.height):
            for xx in range(img.width):
                r, g, b, a = px[xx, yy]
                if a > 0 and r > 245 and g > 245 and b > 245 and (xx in (0, img.width - 1) or yy in (0, img.height - 1)):
                    pass
        bg = Image.new("RGBA", img.size, (255, 255, 255, 0))
        mask = Image.eval(img.getchannel("A"), lambda v: 255 if v > 8 else 0)
        box = mask.getbbox()
        if box:
            img = img.crop(box)
        img.thumbnail((96, 96), Image.LANCZOS)
        img.save(f"{out}/logo-{key}.webp", "WEBP", quality=82, method=6)
        artist = re.sub("<[^>]+>", "", ii["extmetadata"].get("Artist", {}).get("value", "")).strip().replace("|", "/").replace("\n", " ")[:80]
        credits.append(f"| {city} | [{f}]({ii['descriptionurl']}) | {lic} | {artist} |")
        print("ok", city, lic)
open(f"{out}/CREDITS.md", "a", encoding="utf-8").write("".join(c + "\n" for c in credits))
print("받음", len(PICK) - len(fail), "실패", fail)
