// 11-26 새 나라 5개 그림 명령문: npx vitest run --config sim/vitest.config.ts sim/newNationArt.test.ts
// → scripts/face-sheets-4.json(자르기 도구용) + docs/new-nation-art-prompts.md(대장용 명령문)
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { newNationSheets, NEW_FACE_COUNTRIES, type FaceSheet } from '../src/data/faces';
import { SECRETARY } from '../src/data/secretary';
import { LEADERS } from '../src/data/leaders';
import { NATION_GOV } from '../src/data/nations';
import { SPECIALS as SPECIAL_UNITS } from '../src/data/specials';
import { Rng } from '../src/game/rng';

const KO: Record<string, string> = { tw: '대만', pl: '폴란드', ph: '필리핀', pk: '파키스탄', sa: '사우디아라비아' };
const FLAG: Record<string, string> = { tw: '🇹🇼', pl: '🇵🇱', ph: '🇵🇭', pk: '🇵🇰', sa: '🇸🇦' };
const ETHNIC: Record<string, string> = {
  tw: 'Taiwanese (Han Chinese)',
  pl: 'White Polish (Slavic)',
  ph: 'Filipino (Southeast Asian, warm brown skin)',
  pk: 'Pakistani (South Asian, Punjabi or Pashtun features, light-brown to brown skin)',
  sa: 'Saudi Arab (Middle Eastern)',
};

// ── 얼굴 묘사(기존 faces.test.ts와 같은 낱말) ──
const HAIR_M = ['short neat black hair', 'thick hair streaked with grey', 'salt-and-pepper hair combed back', 'short-cropped white hair', 'receding hairline with grey sides', 'mostly bald with a grey fringe', 'side-parted grey hair', 'wavy dark hair going grey at the temples', 'buzz-cut grey hair', 'neatly combed silver hair'];
const HAIR_F = ['shoulder-length dark hair', 'short grey bob', 'salt-and-pepper hair tied back', 'short silver pixie cut', 'wavy dark hair with grey streaks', 'neat low bun', 'chin-length brown hair', 'elegant short white hair'];
const FACE = ['round face', 'long narrow face', 'square jaw', 'high cheekbones', 'soft full cheeks', 'sharp angular face', 'heavy brow', 'wide face with laugh lines'];
const EXTRA_M = ['no glasses, clean-shaven', 'thin metal-rimmed glasses', 'thick black-rimmed glasses', 'a short trimmed grey beard', 'a neat moustache', 'clean-shaven with a small scar on the chin', 'rimless glasses and stubble', 'no glasses, deep crow’s feet'];
const EXTRA_F = ['no glasses, small pearl earrings', 'thin gold-rimmed glasses', 'red-framed glasses', 'no glasses, a small mole on the cheek', 'simple stud earrings', 'reading glasses on a chain'];
const MOOD = ['calm and composed', 'a faint confident smile', 'stern and serious', 'tired but kind', 'sceptical, one brow raised', 'warm, friendly smile', 'determined gaze', 'thoughtful, slightly worried'];
const WEAR = ['a dark navy suit and a muted tie', 'a charcoal suit and white shirt', 'a grey suit with a small lapel pin', 'a black suit and a dark red tie', 'an open-collar shirt and blazer', 'a plain military-style dress uniform without insignia', 'a light grey suit and a blue tie', 'a dark knit sweater over a shirt'];
const WEAR_F = ['a dark navy jacket and a simple necklace', 'a grey blazer with a brooch', 'a black jacket and white blouse', 'a deep red jacket', 'a camel-coloured jacket and scarf', 'a plain dark dress-uniform style jacket without insignia'];
// 나라다운 옷(일부 사람만)
const LOCAL_M: Record<string, string[]> = {
  ph: ['a cream barong tagalog embroidered formal shirt'],
  pk: ['a dark sherwani-style long coat', 'a grey shalwar kameez with a dark waistcoat'],
  sa: ['a white thobe with a red-and-white checkered ghutra headdress and black agal', 'a white thobe with a plain white ghutra and a dark bisht cloak', 'a white thobe with a red-and-white checkered ghutra'],
};
const LOCAL_F: Record<string, string[]> = {
  pk: ['a dark jacket with a loose dupatta scarf over the hair', 'a muted green kurta with a dupatta over the shoulders'],
  sa: ['a black abaya with a loose black headscarf', 'a dark navy abaya with a loose grey headscarf'],
};
const HAIR_LOCAL: Record<string, RegExp> = { sa: /ghutra|headscarf/, pk: /dupatta scarf over the hair/ };

function desc(rng: Rng, c: FaceSheet['cells'][number]): { en: string; ko: string } {
  const age = c.band === '60' ? 60 + Math.floor(rng.next() * 13) : 45 + Math.floor(rng.next() * 15);
  const m = c.sex === 'm';
  let hair = rng.pick(m ? HAIR_M : HAIR_F);
  const face = rng.pick(FACE);
  const extra = rng.pick(m ? EXTRA_M : EXTRA_F);
  const mood = rng.pick(MOOD);
  let wear = rng.pick(m ? WEAR : WEAR_F);
  const local = (m ? LOCAL_M : LOCAL_F)[c.tag];
  if (local && rng.next() < (c.tag === 'sa' ? 0.75 : 0.35)) wear = rng.pick(local);
  if (HAIR_LOCAL[c.tag]?.test(wear)) hair = m ? 'hair hidden under the headdress' : 'hair covered';
  const en = `${age}-year-old ${ETHNIC[c.tag]} ${m ? 'man' : 'woman'}, ${hair}, ${face}, ${extra}, ${mood}, wearing ${wear}`;
  return { en, ko: `${KO[c.tag]} ${m ? '남' : '여'} ${age}세` };
}
const HAIR_YM = ['short neat black hair', 'short textured hair', 'buzz cut', 'side-parted short hair', 'slightly messy short hair', 'short hair with an undercut', 'short wavy hair', 'cropped curly hair'];
const HAIR_YF = ['hair tied in a low ponytail', 'neat short bob', 'hair in a tight bun', 'shoulder-length straight hair tucked behind the ears', 'braided hair', 'short pixie cut', 'high ponytail', 'chin-length wavy hair'];
const EXTRA_YM = ['clean-shaven', 'light stubble', 'thin-framed glasses', 'a small scar on the eyebrow', 'clean-shaven, a headset around the neck', 'clean-shaven, a tactical earpiece'];
const EXTRA_YF = ['no glasses', 'thin-framed glasses', 'small stud earrings', 'a headset around the neck', 'a small mole under the eye', 'no makeup, freckles'];
const MOOD_Y = ['alert and focused', 'a confident half smile', 'serious and disciplined', 'friendly, eager smile', 'calm, steady gaze', 'determined look', 'slightly cocky grin', 'quiet and observant'];
const WEAR_Y = ['an olive field uniform with a plain chest rig', 'a camouflage field jacket', 'a plain dark-navy service uniform without insignia', 'a grey field shirt with rolled sleeves', 'a black tactical jacket', 'an olive uniform holding a rugged tablet', 'a desert-tan field uniform', 'a plain white naval-style service uniform without insignia'];
function descYoung(rng: Rng, c: FaceSheet['cells'][number]): { en: string; ko: string } {
  const age = 24 + Math.floor(rng.next() * 13);
  const m = c.sex === 'm';
  let hair = rng.pick(m ? HAIR_YM : HAIR_YF);
  // 사우디·파키스탄 여성 부관은 머리를 가림
  if (!m && (c.tag === 'sa' || (c.tag === 'pk' && rng.next() < 0.6))) hair = 'hair covered by a plain dark military headscarf';
  const en = `${age}-year-old ${ETHNIC[c.tag]} ${m ? 'man' : 'woman'}, ${hair}, ${rng.pick(FACE)}, ${rng.pick(m ? EXTRA_YM : EXTRA_YF)}, ${rng.pick(MOOD_Y)}, wearing ${rng.pick(WEAR_Y)}`;
  return { en, ko: `${KO[c.tag]} ${m ? '남' : '여'} ${age}세` };
}

// ── 지도자(가상 인물) ──
const LEADER_LOOK: Record<string, { ko: string; en: string; bg: string }> = {
  tw: {
    ko: '61세 대만(한족) 남성 · 희끗한 검은 머리를 옆 가르마로 · 갸름한 얼굴, 얇은 은테 안경 · 남색 정장, 흰 셔츠, 하늘색 넥타이 · 배경: 흐린 총통부 붉은 벽돌 복도 · 차분하고 단단한 표정',
    en: 'A 61-year-old Taiwanese (Han Chinese) man, the President of Taiwan in this game world. Black hair greying at the temples, neatly side-parted, slim oval face, thin silver-rimmed glasses, calm intelligent eyes, lean build. Dark navy suit, white shirt, light blue tie. Calm, steady, quietly resolute expression; upright posture, hands not visible',
    bg: 'a red-brick colonial-era government building corridor with arched windows and warm lamps',
  },
  pl: {
    ko: '54세 폴란드 남성 · 짧은 금갈색 머리, 짧게 다듬은 수염 · 각진 턱, 옅은 파란 눈 · 짙은 회색 정장, 흰 셔츠, 진홍 넥타이 · 배경: 흐린 대통령궁 흰 기둥과 샹들리에 · 결연하고 믿음직한 표정',
    en: 'A 54-year-old White Polish man, the President of Poland in this game world. Short dark-blond hair, a neatly trimmed short beard, square jaw, pale blue eyes, broad shoulders. Dark charcoal suit, white shirt, crimson tie. Determined, trustworthy, serious expression; shoulders squared',
    bg: 'a classical palace hall with white columns, cream walls and a crystal chandelier',
  },
  ph: {
    ko: '58세 필리핀 여성 · 어깨까지 오는 검은 머리를 단정히 · 둥근 얼굴, 따뜻한 갈색 피부 · 크림색 바롱 장식 재킷, 진주 귀걸이 · 배경: 흐린 말라카냥 궁 나무 장식 방 · 따뜻하지만 빈틈없는 미소',
    en: 'A 58-year-old Filipina woman, the President of the Philippines in this game world. Shoulder-length black hair neatly styled, round face, warm brown skin, dark expressive eyes, small pearl earrings. A cream embroidered barong-style formal jacket. Warm but shrewd confident smile; poised posture',
    bg: 'an elegant palace room with dark carved wooden panels, capiz-shell windows and warm light',
  },
  pk: {
    ko: '63세 파키스탄(펀자브) 남성 · 희끗한 짧은 머리, 짙은 회색 콧수염 · 긴 얼굴, 짙은 눈썹 · 검은 셰르와니 긴 코트 · 배경: 흐린 총리 공관 초록 커튼과 깃대 · 엄하고 자신감 있는 눈빛',
    en: 'A 63-year-old Pakistani (Punjabi) man, the Prime Minister of Pakistan in this game world. Short grey hair, a thick dark-grey moustache, long face, heavy dark brows, deep-set brown eyes, light-brown skin, solid build. A black sherwani-style long coat with a high collar. Stern, confident, commanding gaze; chin slightly raised',
    bg: 'a formal office with dark green curtains, white marble and a flagpole',
  },
  sa: {
    ko: '68세 사우디 남성 · 흰 토브, 붉은 체크 구트라와 검은 아갈, 금테 두른 검은 비슈트 망토 · 짧게 다듬은 회색 수염 · 매부리코, 짙은 눈 · 배경: 흐린 왕궁 금빛 아치와 대리석 · 위엄 있고 여유로운 표정',
    en: 'A 68-year-old Saudi Arab man, the King of Saudi Arabia in this game world. A white thobe, a red-and-white checkered ghutra headdress held by a black agal, and a black bisht cloak with gold trim. A neatly trimmed short grey beard and moustache, aquiline nose, dark calm eyes, olive skin. Dignified, relaxed, quietly powerful expression; very still posture',
    bg: 'a royal palace hall with golden arches, white marble and soft warm light',
  },
};
const SEC_LOOK: Record<string, string> = {
  tw: 'straight black shoulder-length hair with soft bangs, delicate oval face, polite calm smile, a light grey business suit',
  pl: 'light-brown hair in a neat low ponytail, fair skin, grey-blue eyes, composed friendly smile, a navy blazer and white blouse',
  ph: 'long black hair tied back, warm brown skin, bright cheerful smile, a cream blazer',
  pk: 'long dark hair partly covered by a loose light dupatta scarf, warm brown eyes, kind confident smile, a maroon kurta-style jacket',
  sa: 'dark hair fully covered by a loose black headscarf, large dark eyes, calm professional look, a black abaya',
};
const BANNER: Record<string, string> = {
  tw: 'a modern city skyline at the foot of green mountains, one very tall segmented skyscraper shaped like stacked boxes, a busy harbour and a coastal missile battery on a rocky cape',
  pl: 'an old market square with Gothic red-brick church towers and colourful merchant houses, a wide river, and modern tanks on a snowy plain far behind',
  ph: 'bright turquoise sea with many green islands, terraced rice fields on the hills, a modern bay skyline at sunset and a white coast guard ship',
  pk: 'towering snow-capped mountain peaks above a green valley, a grand white mosque with four tall minarets and a busy modern city at the foot',
  sa: 'golden desert dunes, a futuristic glass skyscraper skyline, oil derricks and pipelines, and a camel caravan in the foreground',
};
const TRAIT_ART: Record<string, string[]> = {
  tw: ['a shining silicon wafer with a few computer chips on a clean-room tray', 'a porcupine with raised quills standing on a rocky coast', 'a small island inside a broken diplomatic seal, a lonely empty conference chair'],
  pl: ['a big steel shield standing in front of a snowy forest border fence', 'an open heavy gate with a bridge leading through it, an alliance handshake above', 'a stack of coins being pulled down by a heavy tank shell'],
  ph: ['a paper airplane carrying a money envelope over the sea', 'a group of young students with backpacks under a palm tree, small and simple', 'a small wooden fishing boat beside a huge grey warship shadow'],
  pk: ['a nuclear missile in a silo with a shield in front of it', 'snowy mountain peak with a rope and an ice axe planted at the top', 'a cracked piggy bank with an unpaid bill stamped red'],
  sa: ['an oil derrick with a golden barrel and a gold coin', 'a futuristic glass city model on a desert pedestal with a construction crane', 'a single oil barrel balanced on a shaky sand dune, the rest of the scale empty'],
};

const TAIL_PORTRAIT =
  ' Character portrait for a near-future modern military strategy game. An original fictional character: do NOT copy or resemble the face of any real person, real politician or real head of state. Semi-realistic digital painting (realistic facial proportions, skin pores, fabric texture, like a high-quality modern mobile strategy game character portrait; not anime, not cartoon, not chibi, not a photograph). Framing: head and upper chest, body turned about 15 degrees, looking toward the viewer, eyes at about 40 percent from the top, face centred. Lighting: soft cinematic key light from the top-left with a gentle warm rim light on the shoulder.';
const TAIL_PORTRAIT2 =
  ', heavily out of focus (strong bokeh) and darkened with a deep vignette toward the edges, so the face stands out clearly when the picture is cropped into a circle; nothing important near the corners. The image will be cropped into a circle, so keep the whole head and shoulders inside the central circle. No text, no letters, no numbers, no logos, no readable signs; flags only as blurred abstract colour shapes, no real military insignia. Square 1:1 image, 1024x1024.';
const ICON_TAIL =
  ' One single object or small scene, centered, filling about 85% of the frame, slight three-quarter view. Semi-realistic digital painting (realistic materials and soft shading, like a high-quality modern mobile strategy game icon; not cartoon, not anime, not a photograph). Soft light from the top-left, a subtle dark outline. Simple readable shape that still reads at 26 pixels. Transparent background (PNG with alpha), no frame, no box, no circle behind it. No text, no letters, no numbers, no logos, no real national flags, no real people\'s faces. Square 1:1 image, 1024x1024.';
const UNIT_TAIL =
  ' Mobile strategy game unit sprite for a near-future military game. Semi-realistic military art (realistic proportions, materials and details like a high-quality modern mobile strategy game render, not anime, not cartoon, not chibi), three-quarter top-down view with the camera about 45 degrees above, the object faces RIGHT (nose/front pointing to the right side of the image). Realistic soft shading with subtle painterly finish, believable metal, fabric and paint textures, slightly boosted contrast so it reads at small size, thin subtle dark edge, muted military palette. Exactly one object or one tight group, centered, filling about 70 percent of the image with empty margin on all sides. Bold simple silhouette that stays readable when shrunk to 32 pixels. Lighting from the top-left. No text, no letters, no numbers, no flags, no national insignia, no emblems, no logos, no ground, no cast shadow, no background scenery. Transparent background (PNG with alpha). Square 1:1 image, 1024x1024.';
const BANNER_TAIL =
  ' Wide cinematic landscape banner. Semi-realistic digital painting (realistic light and materials, like a high-quality modern strategy game loading banner; not cartoon, not anime, not a photograph). Golden-hour light. No text, no letters, no numbers, no logos, no national flags, no real recognisable people. Wide 3:1 image, 1536x512.';
const FACE_FRAME =
  'I am making character portraits for a near-future modern military and politics strategy game. The attached images show where a face appears in my game (a small square on a dark console UI) and a leader portrait I already made; match its art style and painting quality exactly. Every image in this chat follows these fixed rules: ONE square 1:1 image (1024x1024 or larger) that is a contact sheet of separate portraits in an exact equal 4x4 grid (16 cells), every cell the same size, separated by a thin straight dark gap. Cells are numbered left-to-right, top-to-bottom; no frames, no text, no numbers, no letters, no logos, no flags, no real insignia anywhere. Each portrait: semi-realistic digital painting (realistic proportions, skin and fabric texture, like a high-quality modern mobile strategy game; not anime, not cartoon, not a photograph); an ORIGINAL FICTIONAL person who must NOT resemble any real person, politician or celebrity; every person clearly different from the others (different face shape, nose, eyes, hair, build); head and upper chest, body turned about 15 degrees, face centred with eyes at about 40 percent from the top; soft cinematic key light from the top-left with a gentle warm rim light; background heavily blurred and darkened toward the edges. I will send one sheet description at a time; make exactly ONE image per message.';

const save = (f: string) => ` File name: save this image as ${f}.png`;

it('새 나라 그림 명령문', () => {
  const rng = new Rng(20261127);
  const sheets = newNationSheets();
  writeFileSync('scripts/face-sheets-4.json', JSON.stringify(sheets.map((s) => ({ sheet: s.sheet, grid: s.grid, cells: s.cells.map((c) => c.file) })), null, 1) + '\n');
  const N = NEW_FACE_COUNTRIES;
  const sp = SPECIAL_UNITS.filter((u) => N.includes(u.country)).sort((a, b) => N.indexOf(a.country) - N.indexOf(b.country) || a.slot - b.slot);
  const faceSheets = sheets.filter((s) => s.grid === 4);
  const total = N.length * 2 + N.length + 15 + sp.length + faceSheets.length;
  const L: string[] = [];
  L.push(`# 새 나라 5개 그림 · 모두 ${total}장 (11/26)`, '');
  L.push('대만·폴란드·필리핀·파키스탄·사우디아라비아 그림이에요. 지금은 국기·기본 그림·이웃 나라 얼굴로 대신 나오고, 그림을 넣으면 그 자리가 바로 바뀌어요.', '');
  L.push('**인물은 한 장에 4×4 = 16명씩** 받아요(지도자·수행비서만 한 장에 한 사람).', '');
  L.push('## 한눈 표', '');
  L.push('| 순서 | 채팅창 | 무엇 | 장수 | 첫 그림에 첨부 | 저장 이름 |');
  L.push('|---|---|---|---|---|---|');
  L.push(`| 1 | 창 1 | 나라 지도자 | 5장(1명씩) | \`ref-portrait-spot.png\` · \`leader-us.webp\` | \`leader-tw.png\` 등 |`);
  L.push(`| 2 | 창 2 | 수행비서(20대 여성) | 5장(1명씩) | \`ref-face-spot.png\` · \`secretary-kr.webp\` | \`secretary-tw.png\` 등 |`);
  N.forEach((c, i) =>
    L.push(`| ${3 + i} | 창 ${3 + i} | ${KO[c]} 인물(장관·참모 144 + 젊은 부관 32) | 11장(16명씩) | \`ref-face-spot.png\` · 창 1에서 만든 \`leader-${c}.png\` · (부관 장) \`ref-young-1.webp\` | \`sheet-${c}-1.png\` ~ \`-9\`, \`sheet-${c}-y1\` · \`-y2\` |`),
  );
  L.push(`| 8 | 창 8 | 나라 특징 아이콘 | 15장 | \`ref-trait-spot.png\` · \`ref-done-small-icon.webp\` | \`trait-tw-1.png\` 등 |`);
  L.push(`| 9 | 창 9 | 특별 병과 | ${sp.length}장 | \`ref-battle-screen.png\` · \`unit-sp-kp-1.webp\` | \`unit-sp-tw-1.png\` 등 |`);
  L.push(`| 10 | 창 10 | 나라 배너(외교 창 맨 위 띠) | 5장 | \`banner-us.webp\` | \`banner-tw.png\` 등 |`);
  L.push('');
  L.push('참고 그림은 모두 `guides/new-nation-art-ref.zip` 하나에 있어요(폴더 `guides/new-nation-art-ref`).', '');
  L.push('## 순서', '');
  L.push('1. 채팅창을 열고 **그 창의 첫 그림 때만** 표에 적힌 참고 그림을 첨부해요.');
  L.push('2. 인물 창(3~7)은 첫 그림 전에 **틀 명령문**을 한 번 붙여요.');
  L.push('3. 회색 상자 문장을 **한 장씩** 붙여 넣어요(같은 창에서 차례로).');
  L.push('4. 문장 끝에 적힌 **저장 이름 그대로** 저장해요.');
  L.push('5. 다 만들면(몇 장만이어도) zip으로 올려 주세요. 제가 16명씩 잘라서 비슷한 얼굴을 거르고 게임에 넣어요.', '');
  L.push('**먼저 창 1(지도자)부터** 하면 좋아요. 인물 창에서 그 나라 지도자 그림을 화풍 기준으로 써요.', '');
  L.push('요령: 흰 배경이 나오면 "배경을 투명하게 다시". 만화처럼 나오면 "더 실사처럼, 만화풍 말고". 4×4가 뭉개지면 그 장만 다시 만들어 주세요.', '');
  L.push('**도시 상징**(45곳)은 그리지 않아요. 지금처럼 위키미디어 공용의 실제 상징을 제가 받아 넣을게요(지금은 코드로 그린 방패가 나와요). **본부 지도 위성 바탕**도 제가 위성 자료로 만들어요.', '');

  // 창 1 지도자
  L.push('---', '', '## 창 1 · 나라 지도자 5장', '');
  N.forEach((c, i) => {
    const ld = LEADERS[c];
    const lk = LEADER_LOOK[c];
    L.push(`### ${FLAG[c]} ${KO[c]} ${ld.title} ${ld.name} · 저장 이름 \`leader-${c}.png\`${i === 0 ? ' · **참고 그림 첨부**' : ''}`);
    L.push(`- 생김새: ${lk.ko}`);
    L.push('```');
    const head = i === 0 ? 'The attached images show where this face appears in my game (a small circle) and a leader portrait I already made; match that art style and painting quality.' : 'Use exactly the same art style, painting quality, lighting and framing as the previous portraits in this chat.';
    L.push(`${head} ${lk.en}.${TAIL_PORTRAIT} Background: ${lk.bg}${TAIL_PORTRAIT2}${save(`leader-${c}`)}`);
    L.push('```', '');
  });
  // 창 2 수행비서
  L.push('---', '', '## 창 2 · 수행비서 5장', '');
  N.forEach((c, i) => {
    const x = SECRETARY[c];
    L.push(`### ${FLAG[c]} ${KO[c]} 수행비서 ${x.name} (여 ${x.age}세) · 저장 이름 \`secretary-${c}.png\`${i === 0 ? ' · **참고 그림 첨부**' : ''}`);
    L.push('```');
    const head =
      i === 0
        ? 'The attached images show where a face appears in my game (a small square on a dark console UI) and a secretary portrait I already made; match its art style and painting quality exactly. ONE single person (not a grid).'
        : 'Next portrait, same art style, lighting and framing as the previous one in this chat. ONE single person (not a grid).';
    L.push(
      `${head} A ${x.age}-year-old ${ETHNIC[c]} woman, the national leader's personal secretary, smart and trustworthy, ${SEC_LOOK[c]}, a slim ID lanyard, holding a dark tablet at chest height. Semi-realistic digital painting (not anime, not cartoon, not a photograph); an ORIGINAL FICTIONAL person who must NOT resemble any real person; head and upper chest, body turned about 15 degrees, eyes at about 40 percent from the top; soft cinematic key light from the top-left. Background: blurred government office corridor at night, darkened toward the edges. No text, no logos, no flags. Square 1:1 image, 1024x1024.${save(`secretary-${c}`)}`,
    );
    L.push('```', '');
  });
  // 창 3~7 인물
  N.forEach((c, i) => {
    const mine = sheets.filter((s) => s.country === c && s.grid === 4);
    L.push('---', '', `## 창 ${3 + i} · ${FLAG[c]} ${KO[c]} 인물 ${mine.length}장 (첨부: ref-face-spot.png + leader-${c}.png)`, '');
    L.push('틀 명령문(첫 그림 전에 한 번):', '```', FACE_FRAME, '```', '');
    for (const s of mine) {
      const young = s.sheet.includes('-y');
      const ds = s.cells.map((x) => (young ? descYoung(rng, x) : desc(rng, x)));
      L.push(`### ${s.sheet}.png · 창 ${3 + i} · 4×4 = 16명${young ? ' · 젊은 부관(이 장은 `ref-young-1.webp`도 첨부)' : ''}`);
      L.push(`- ${ds.map((d, k) => `${k + 1}) ${d.ko}`).join(' · ')}`);
      L.push('```');
      L.push(
        young
          ? `New sheet, same fixed rules and style. These are young military aides (adjutants) in their twenties and thirties; the attached young aide portrait shows the style. A 4x4 grid of 16 different young people, all NEW faces, clearly different from earlier sheets.`
          : `New sheet, same fixed rules and style. A 4x4 grid of 16 different people. These must be NEW people, clearly different from any face in my earlier sheets.`,
      );
      ds.forEach((d, k) => L.push(`${k + 1}) ${d.en}.`));
      L.push(`Backgrounds vary: ${young ? 'blurred command post, briefing room, airfield, barracks corridor' : 'blurred cabinet room, press room, parliament corridor, office bookshelves'}.${save(s.sheet)}`);
      L.push('```', '');
    }
  });
  // 창 8 특징
  L.push('---', '', '## 창 8 · 나라 특징 아이콘 15장', '');
  let first = true;
  for (const c of N)
    NATION_GOV[c].traits.forEach((t, k) => {
      const f = `trait-${c}-${k + 1}`;
      L.push(`### ${FLAG[c]} ${KO[c]} ${t.icon} ${t.name}${t.weak ? '(약점)' : ''} · 저장 이름 \`${f}.png\`${first ? ' · **참고 그림 첨부**' : ''}`);
      L.push('```');
      const head = first
        ? 'The attached images show where this icon appears in my game (small trait chips in a steel-blue console UI) and a small icon I already made; match its art style, lighting and quality exactly. This is the first of a matching set of small trait icons.'
        : 'Next icon in the same set: use exactly the same art style, lighting, angle, outline and size as the previous icons.';
      L.push(`${head} A small game icon showing ${TRAIT_ART[c][k]}.${ICON_TAIL}${save(f)}`);
      L.push('```', '');
      first = false;
    });
  // 창 9 특별 병과
  L.push('---', '', `## 창 9 · 특별 병과 ${sp.length}장`, '');
  sp.forEach((u, k) => {
    const f = `unit-sp-${u.id}`;
    const art = u.art.replace(/ with a white eagle emblem on the turret side/, ' with an extra-thick angular turret armour and a remote weapon station');
    L.push(`### ${FLAG[u.country]} ${KO[u.country]} ${u.slot}번 ${u.name}(바탕 ${u.base}) · 저장 이름 \`${f}.png\`${k === 0 ? ' · **참고 그림 첨부**' : ''}`);
    L.push('```');
    const head =
      k === 0
        ? 'The attached screenshot shows the game map where this sprite will appear as a small piece on a hex tile, and a special unit sprite I already made; match that sprite\'s exact art style. This is an elite special version of a standard unit: keep it clearly recognizable as that type of unit, with one or two distinctive upgraded features.'
        : 'Next sprite in the same set: use exactly the same art style, angle, lighting and size as the previous one. This is an elite special version of a standard unit.';
    L.push(`${head} ${art}${UNIT_TAIL}${save(f)}`);
    L.push('```', '');
  });
  // 창 10 배너
  L.push('---', '', '## 창 10 · 나라 배너 5장', '');
  N.forEach((c, k) => {
    L.push(`### ${FLAG[c]} ${KO[c]} · 저장 이름 \`banner-${c}.png\`${k === 0 ? ' · **참고 그림 첨부**' : ''}`);
    L.push('```');
    const head = k === 0 ? 'The attached image is a country banner I already made for my game; match its art style, framing and size exactly.' : 'Next picture in this chat: use exactly the same art style, camera angle, lighting and size as the previous one.';
    L.push(`${head} A wide country banner for a near-future modern strategy game, showing ${BANNER[c]}.${BANNER_TAIL}${save(`banner-${c}`)}`);
    L.push('```', '');
  });
  L.push('---', '', '## 다 만든 뒤', '');
  L.push('창별로 zip 하나씩 올려 주시면 돼요(몇 장만이어도 괜찮아요). 제가 인물 장은 16명씩 잘라 넣고(`scripts/cut_faces.py`), 나머지는 크기를 줄여 바로 넣어요.');
  writeFileSync('docs/new-nation-art-prompts.md', L.join('\n') + '\n');
});
