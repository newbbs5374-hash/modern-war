#!/usr/bin/env python3
"""11/28 그림자실 일반 요원(뽑기 후보) 사진 명령문: 나라마다 4×4 시트 4장 = 64명(30~40대).
출력: guides/shadow-room/agent-crew-art.md (+ scripts/face-sheets-8.json 자르기 배치)
"""
import json, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_MD = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/mnt/project-files/guides/shadow-room/agent-crew-art.md')

# (id, 한글, 영어 사람 설명, 머리색 묶음, 특별 옷차림)
C = [
 ('kr','대한민국','South Korean (ethnic Korean)','east',None),('kp','북한','North Korean (ethnic Korean)','east',None),
 ('jp','일본','Japanese','east',None),('cn','중국','Han Chinese','east',None),('tw','대만','Taiwanese (Han Chinese)','east',None),
 ('us','미국','American of varied backgrounds (White, Black, Hispanic and Asian American mixed across the sheet)','mix',None),
 ('ca','캐나다','Canadian of varied backgrounds (mostly White, some Asian and Black Canadian)','mix',None),
 ('mx','멕시코','Mexican (mestizo, varied skin tones)','latin',None),
 ('uk','영국','British (mostly White British, some of South Asian or Black British heritage)','mix',None),
 ('de','독일','White German','euro',None),('fr','프랑스','French (mostly White French, some of North African heritage)','euro',None),
 ('it','이탈리아','Italian','south',None),('es','스페인','Spanish','south',None),('gr','그리스','Greek','south',None),
 ('fi','핀란드','Finnish (Nordic)','nordic',None),('pl','폴란드','Polish (Slavic)','euro',None),
 ('ru','러시아','ethnic Russian (Slavic)','euro',None),('ua','우크라이나','ethnic Ukrainian (Slavic)','euro',None),
 ('tr','튀르키예','Turkish','mid',None),('il','이스라엘','Israeli Jewish (mix of Ashkenazi and Mizrahi features)','mid',None),
 ('ir','이란','Iranian (Persian)','mid','ir'),('sa','사우디아라비아','Saudi Arabian (Arab)','mid','sa'),
 ('eg','이집트','Egyptian (Arab, North African)','mid','eg'),('pk','파키스탄','Pakistani (South Asian)','mid','pk'),
 ('in','인도','Indian (South Asian, varied skin tones from light brown to dark brown)','mid',None),
 ('ph','필리핀','Filipino (Southeast Asian)','east',None),
 ('au','호주','Australian (mostly White Australian, some of Asian heritage)','mix',None),
 ('ng','나이지리아','Nigerian (Black West African, dark brown skin)','africa',None),
 ('za','남아프리카공화국','South African of varied backgrounds (Black, White Afrikaner and Coloured)','mix',None),
 ('et','에티오피아','Ethiopian (East African, brown skin)','africa',None),('dz','알제리','Algerian (Arab-Berber, North African)','mid','dz'),
 ('br','브라질','Brazilian of varied backgrounds (light to dark skin)','latin',None),
 ('ar','아르헨티나','Argentine (mostly European descent)','south',None),('co','콜롬비아','Colombian (mestizo)','latin',None),
 ('ve','베네수엘라','Venezuelan (mestizo)','latin',None),('cl','칠레','Chilean (mestizo)','latin',None),
]
HAIR_COL = {
 'east': ['black','jet-black','very dark brown','black with a few grey strands'],
 'mix': ['dark brown','black','light brown','dirty blond','auburn','black tight curls'],
 'latin': ['black','dark brown','black wavy','dark brown curly'],
 'euro': ['ash-blond','light brown','dark brown','dark blond','chestnut brown'],
 'south': ['black','dark brown','chestnut brown','black wavy'],
 'nordic': ['pale blond','ash-blond','light brown','strawberry blond'],
 'mid': ['black','very dark brown','black wavy','dark brown'],
 'africa': ['black tight curls','black'],
}
M_CUT = ['short neat side-part','buzz cut','short crew cut','slicked-back','medium-length swept back','short textured crop','close-cropped, receding hairline','short curly','tidy undercut','short, greying at the temples','shaved head']
F_CUT = ['sleek low bun','shoulder-length straight','short pixie cut','chin-length bob','long hair in a tight ponytail','wavy shoulder-length','braided and pinned up','short asymmetric bob','long straight hair tucked behind one ear','loose low ponytail','cropped curly']
FACE = ['square jaw','narrow face with high cheekbones','round face','long oval face','broad face with a heavy brow','sharp angular features','soft features','hooked nose','slightly crooked nose','wide-set eyes','deep-set eyes','strong chin with a cleft','thin lips and a firm mouth','freckles across the nose','weathered skin with fine lines']
M_EXTRA = ['clean-shaven','short stubble','neat short beard','heavy five-o\'clock shadow','trimmed moustache','salt-and-pepper stubble','a thin scar across the chin','thin-rimmed glasses','a small scar on the eyebrow','clean-shaven with a faint scar on the cheek']
F_EXTRA = ['no makeup','minimal makeup','small stud earrings','thin-rimmed glasses','a faint scar on the jaw','a beauty mark near the lip','tired eyes with faint dark circles','sharp winged eyeliner','a thin silver necklace','no jewellery']
LOOK = ['calm, unreadable stare','faint knowing half-smile','cold and focused','tired but alert','slightly amused','stern and serious','watchful, eyes narrowed','relaxed, almost friendly — the dangerous kind','quietly confident','guarded and suspicious']
CLOTH = ['dark charcoal suit, no tie','black turtleneck','navy field jacket','olive-drab tactical jacket','dark leather jacket','grey hooded sweatshirt under a dark coat','rumpled white shirt with sleeves rolled','black fitted shirt with a thin earpiece wire','long dark trench coat, collar up','dark knit sweater with a shoulder holster strap (no gun visible)','plain grey parka','dark utility vest over a black shirt','airport-staff style dark uniform shirt (disguise)','smart business blazer (disguise)','worn denim jacket (civilian disguise)']
LIGHT = ['cold blue monitor light','single hard side light, half the face in shadow','warm desk-lamp glow from below','neon reflections from a rainy window','moonlight through blinds','dim red emergency light','flickering fluorescent light in a corridor','backlit by a blurred night city','grey overcast daylight through a dirty window','amber streetlight at night']
SPECIAL_M = {'sa': 'a white ghutra headscarf with a dark thobe', 'pk': 'a dark shalwar kameez under a jacket'}
SPECIAL_F = {'ir': 'a dark loose headscarf showing some hair', 'sa': 'a black hijab', 'eg': 'a dark hijab', 'pk': 'a dark dupatta over the hair', 'dz': 'a dark hijab'}

SHEETS = [(1,'m',30,39,'MEN in their thirties (30 to 39)'),(2,'m',40,49,'MEN in their forties (40 to 49)'),(3,'f',30,39,'WOMEN in their thirties (30 to 39)'),(4,'f',40,49,'WOMEN in their forties (40 to 49)')]

FRAME = ("I am making portraits of secret intelligence agents for a near-future modern military and politics strategy game. "
"The attached images show where a face appears in my game (a small square on a dark console UI) and a face I already made in this game; match that art style and painting quality exactly. "
"Every image in this chat follows these fixed rules: ONE square 1:1 image (2048x2048 if possible, at least 1024x1024) that is a contact sheet of 16 separate portraits in an exact equal 4x4 grid, every cell the same size, separated by a thin straight dark gap, no frames, no text, no numbers, no letters, no logos, no flags, no real insignia, no weapons in hand. "
"Each cell: semi-realistic digital painting (realistic proportions, skin and fabric texture, like a high-quality modern mobile strategy game; not anime, not cartoon, not a photograph); an ORIGINAL FICTIONAL person who must NOT resemble any real person or celebrity; "
"all sixteen clearly different from each other (different face shape, nose, eyes, hair, build, clothes); experienced field agents aged 30 to 49 who look their real age (some grey hair, lines around the eyes for the older ones); "
"head and upper chest, body turned about 15 degrees, face centred with eyes at about 40 percent from the top of the cell; DARK, moody, cinematic spy-thriller mood (deep shadows, desaturated colours, low-key lighting); background of every cell nearly black and heavily blurred. "
"Cells are numbered left-to-right, top-to-bottom. I will send one sheet description at a time; make exactly ONE sheet image per message.")

def person(rng, cid, grp, sex, age, used):
    for _ in range(80):
        col = rng.choice([c for c in HAIR_COL[grp] if age >= 40 or 'grey' not in c])
        cut = rng.choice(M_CUT if sex=='m' else F_CUT)
        face = rng.choice(FACE)
        if used.get(cut, 0) >= 2 or (cut, face) in used: continue
        break
    used[cut] = used.get(cut, 0) + 1
    used[(cut, face)] = 1
    extra = rng.choice(M_EXTRA if sex=='m' else F_EXTRA)
    look = rng.choice(LOOK); cloth = rng.choice(CLOTH); light = rng.choice(LIGHT)
    hair = 'shaved head, ' if cut == 'shaved head' else f"{col} hair, {cut}, "
    sp = (SPECIAL_M if sex=='m' else SPECIAL_F).get(cid)
    if sp and rng.random() < (0.35 if sex=='m' else 0.5):
        cloth = sp
        hair = ''
    who = 'man' if sex=='m' else 'woman'
    return f"{age}-year-old {who}, {hair}{face}, {extra}, {look}, wearing {cloth}, {light}."

def main():
    rng = random.Random(1128)
    md = []
    md.append('# 그림자실 요원 사진 2,304장 (나라 36개 × 64명, 30~40대)\n')
    md.append('그림자실에서 **요원 뽑기·후보 새로 받기**를 할 때 나오는 일반 요원 사진이에요. 지금은 얼굴 수가 적어서 같은 얼굴이 자주 나와요. 나라마다 64명(남 32 · 여 32, 30대·40대 반씩)이 들어가면 판마다 거의 다른 얼굴이 나와요. 그림이 오기 전에는 지금 얼굴을 그대로 써요(게임은 지금도 돌아가요). 전설 요원(SS) 사진은 따로예요(`agent-legend-art.md`).\n')
    md.append('## 한눈에 보기\n')
    md.append('| 무엇 | 장수 | 채팅창 | 저장 이름 |\n|---|---|---|---|')
    md.append('| 나라마다 4×4 시트 4장(① 30대 남 16 · ② 40대 남 16 · ③ 30대 여 16 · ④ 40대 여 16) | 144장(36나라 × 4) | **나라마다 창 1개 = 36개**(한 창에서 그 나라 4장을 이어서) | `agentx-sheet-<나라>-1.png` ~ `-4.png` |\n')
    md.append('- 참고 그림: `guides/shadow-room/agent-ref.zip`(폴더 `guides/shadow-room/ref`, 전설 요원과 같은 것). 창마다 **첫 그림에만** `ref-face-spot.png` + `ref-<나라>.webp` 2장 첨부.')
    md.append('- 새 창이면 먼저 아래 **틀 명령문**을 붙이고, 이어서 그 나라 ① 명령문 → 그림 받으면 ② → ③ → ④ 순서로 같은 창에 붙여요.')
    md.append('- 다 만들면 zip(예: `agentx-sheets-1.zip`)으로 프로젝트 파일에 올려 주세요. 여러 번 나눠 올려도 돼요. 제가 칸마다 잘라 `agentx-<나라>-01~64`로 넣어요.')
    md.append('- 급하면 많이 뽑는 나라부터: 대한민국·미국·중국·러시아·일본·북한.')
    md.append('- 요령: 너무 젊어 보이면 "모두 실제 나이대로, 40대는 흰머리·주름 조금". 너무 밝으면 "더 어둡고 그림자 짙게". 칸이 안 맞으면 "정확한 4×4 같은 크기 칸으로 다시".\n')
    md.append('## 틀 명령문 (창마다 첫 그림에 한 번)\n')
    md.append('```\n' + FRAME + '\n```\n')
    sheets_json = []
    for i, (cid, ko, en, grp, _) in enumerate(C, 1):
        md.append('---\n')
        md.append(f'## {i}. {ko} · `agentx-sheet-{cid}-1~4.png` (새 창이면 첨부: ref-face-spot.png + ref-{cid}.webp)\n')
        for n, sex, a0, a1, label in SHEETS:
            md.append(f'**{ko} {n}/4 · {label[:-12] if False else ("30대 남자" if n==1 else "40대 남자" if n==2 else "30대 여자" if n==3 else "40대 여자")} · 저장 이름 `agentx-sheet-{cid}-{n}.png`**\n')
            used = {}
            lines = [f'New sheet {n} of 4 for {en}. Sixteen {en} intelligence agents, all {label}, 4x4 grid. Same fixed rules and dark style.']
            for k in range(16):
                age = a0 + (k * (a1 - a0 + 1)) // 16
                lines.append(f'{k+1}) {person(rng, cid, grp, sex, age, used)}')
            md.append('```\n' + '\n'.join(lines) + '\n```\n')
            base = (n - 1) * 16
            sheets_json.append({'sheet': f'agentx-sheet-{cid}-{n}', 'grid': 4, 'cells': [f'agentx-{cid}-{base + k + 1:02d}' for k in range(16)]})
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text('\n'.join(md), encoding='utf-8')
    (ROOT / 'scripts/face-sheets-8.json').write_text(json.dumps(sheets_json, ensure_ascii=False, indent=1), encoding='utf-8')
    print(OUT_MD, len(sheets_json))

main()
