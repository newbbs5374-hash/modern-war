"""상징 파일 이름이 없는 도시(cityLogos.ts에서 key만 있는 줄)를 위키미디어 공용에서 찾아 채움.
공공 저작물(PD)·CC0만 고름. 이름에 도시 영어 이름이 들어 있고 Seal/Coat of arms/Emblem/Symbol/Flag/Logo 인 그림.
사용: python scripts/find_city_logos.py  (그다음 fetch_city_logos.py로 그림 받기)"""
import json, re, time, urllib.parse, urllib.request

EN = {"로스앤젤레스": "Los Angeles", "시카고": "Chicago", "시애틀": "Seattle", "보스턴": "Boston", "애틀랜타": "Atlanta",
      "충칭": "Chongqing", "청두": "Chengdu", "시안": "Xi'an", "하얼빈": "Harbin", "칭다오": "Qingdao",
      "카잔": "Kazan", "칼리닌그라드": "Kaliningrad", "이르쿠츠크": "Irkutsk",
      "하이데라바드": "Hyderabad", "아마다바드": "Ahmedabad", "푸네": "Pune", "자이푸르": "Jaipur", "러크나우": "Lucknow", "코치": "Kochi", "비샤카파트남": "Visakhapatnam", "나그푸르": "Nagpur",
      "인천": "Incheon", "울산": "Ulsan",
      "뮌헨": "Munich", "프랑크푸르트": "Frankfurt", "쾰른": "Cologne", "슈투트가르트": "Stuttgart", "드레스덴": "Dresden", "라이프치히": "Leipzig",
      "오사카": "Osaka", "나고야": "Nagoya", "삿포로": "Sapporo", "히로시마": "Hiroshima", "센다이": "Sendai", "나하": "Naha",
      "맨체스터": "Manchester", "글래스고": "Glasgow", "포츠머스": "Portsmouth", "에든버러": "Edinburgh", "카디프": "Cardiff", "벨파스트": "Belfast",
      "아다나": "Adana", "트라브존": "Trabzon", "부르사": "Bursa", "안탈리아": "Antalya", "가지안테프": "Gaziantep",
      "베르셰바": "Beersheba", "아슈도드": "Ashdod", "에일라트": "Eilat", "네타냐": "Netanya", "나사렛": "Nazareth", "티베리아": "Tiberias",
      "타브리즈": "Tabriz", "마슈하드": "Mashhad", "아흐바즈": "Ahvaz", "부셰르": "Bushehr",
      "리비우": "Lviv", "드니프로": "Dnipro", "자포리자": "Zaporizhzhia", "미콜라이우": "Mykolaiv", "빈니차": "Vinnytsia",
      "원산": "Wonsan", "신의주": "Sinuiju", "함흥": "Hamhung", "청진": "Chongjin", "개성": "Kaesong", "나선": "Rason"}
# 다른 이름(독일어·현지 표기)
ALT = {"뮌헨": ["München"], "쾰른": ["Köln"], "프랑크푸르트": ["Frankfurt am Main"], "코치": ["Kochi", "Cochin"], "베르셰바": ["Be'er Sheva", "Beer Sheva"],
       "티베리아": ["Tiberias"], "자포리자": ["Zaporizhia", "Zaporizhzhia"], "미콜라이우": ["Mykolaiv", "Nikolaev"], "드니프로": ["Dnipro"],
       "아흐바즈": ["Ahvaz", "Ahwaz"], "인천": ["Incheon"], "울산": ["Ulsan"], "시안": ["Xi'an", "Xian"]}
KIND = [("Coat of arms", "문장"), ("Seal", "인장"), ("Emblem", "휘장"), ("Symbol", "휘장"), ("Logo", "로고"), ("Flag", "시기"), ("Wappen", "문장")]
BAD = re.compile(r"(district|oblast|raion|province|prefecture|state|county|governorate|region|kreis|university|police|fire|club|fc|airport|port of|bus|metro|railway|army|navy|school|church|diocese|archdiocese|consulate|company|bank|hospital|before|old|former|\(19|\(18|\(17|\(16|variant|bw|monochrome|grey|gray)", re.I)
OK = ("Public domain", "PD", "CC0")
UA = {"User-Agent": "modern-war-asset-script/1.0"}
get = lambda u: json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read())
api = "https://commons.wikimedia.org/w/api.php?format=json&action=query&"

src_path = "src/data/cityLogos.ts"
src = open(src_path, encoding="utf-8").read()
todo = re.findall(r"^  (\S+): \{ key: '([a-z]+)' \},$", src, re.M)
report = []
for city, key in todo:
    names = [EN.get(city, "")] + ALT.get(city, [])
    names = [n for n in dict.fromkeys(names) if n]
    if not names:
        continue
    seen = {}
    for n in names:
        for pre in ("Coat of arms of", "Seal of", "Emblem of", "Symbol of", "Logo of", "Flag of", "Wappen"):
            q = f'intitle:"{pre}" intitle:"{n}"'
            try:
                j = get(api + "list=search&srnamespace=6&srlimit=20&srsearch=" + urllib.parse.quote(q))
            except Exception as e:
                print("search fail", city, e); continue
            for x in j["query"]["search"]:
                seen[x["title"][5:]] = 1
            time.sleep(0.2)
    cands = [t for t in seen if any(n.lower() in t.lower() for n in names) and not BAD.search(t) and "'" not in t and re.search(r"\.(svg|png)$", t, re.I)]
    best = None
    for i in range(0, len(cands), 40):
        part = cands[i:i + 40]
        j = get(api + "prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=LicenseShortName&titles=" + urllib.parse.quote("|".join("File:" + t for t in part)))
        norm = {x["to"]: x["from"] for x in j["query"].get("normalized", [])}
        for p in j["query"]["pages"].values():
            t = norm.get(p["title"], p["title"])[5:]
            lic = ((p.get("imageinfo") or [{}])[0].get("extmetadata", {}).get("LicenseShortName", {}).get("value", ""))
            if not lic.startswith(OK):
                continue
            kind = next((k for w, k in KIND if w.lower() in t.lower()), None)
            if not kind:
                continue
            rank = [w for w, _ in KIND].index(next(w for w, k in KIND if w.lower() in t.lower()))
            score = (rank, t.lower().endswith(".png"), len(t))
            if best is None or score < best[0]:
                best = (score, t, "CC0" if lic.startswith("CC0") else "PD", kind)
    if best:
        _, f, lic, kind = best
        src = src.replace(f"  {city}: {{ key: '{key}' }},", f"  {city}: {{ key: '{key}', file: '{f}', lic: '{lic}', kind: '{kind}' }},")
        report.append(f"{city}\t{f}\t{lic}")
    else:
        report.append(f"{city}\t(없음)\t")
    print(report[-1], flush=True)
open(src_path, "w", encoding="utf-8").write(src)
open("scripts/find_city_logos.out.txt", "w", encoding="utf-8").write("\n".join(report) + "\n")
