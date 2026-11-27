// 11-27 새 나라 18개 그림 명령문: npx vitest run --config sim/vitest.config.ts sim/newNationArt2.test.ts
// → scripts/face-sheets-6.json(자르기 도구용) + docs/new-nation-art-prompts-2.md(대장용 명령문)
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { newNationSheets2, NEW_FACE_COUNTRIES2, type FaceSheet } from '../src/data/faces';
import { SECRETARY } from '../src/data/secretary';
import { LEADERS } from '../src/data/leaders';
import { NATION_GOV } from '../src/data/nations';
import { SPECIALS as SPECIAL_UNITS } from '../src/data/specials';
import { Rng } from '../src/game/rng';

const KO: Record<string, string> = { eg: '이집트', ng: '나이지리아', za: '남아프리카공화국', et: '에티오피아', dz: '알제리', br: '브라질', ar: '아르헨티나', co: '콜롬비아', ve: '베네수엘라', cl: '칠레', au: '호주', ca: '캐나다', mx: '멕시코', fr: '프랑스', it: '이탈리아', es: '스페인', gr: '그리스', fi: '핀란드' };
const FLAG: Record<string, string> = { eg: '🇪🇬', ng: '🇳🇬', za: '🇿🇦', et: '🇪🇹', dz: '🇩🇿', br: '🇧🇷', ar: '🇦🇷', co: '🇨🇴', ve: '🇻🇪', cl: '🇨🇱', au: '🇦🇺', ca: '🇨🇦', mx: '🇲🇽', fr: '🇫🇷', it: '🇮🇹', es: '🇪🇸', gr: '🇬🇷', fi: '🇫🇮' };
const EN: Record<string, string> = { eg: 'Egypt', ng: 'Nigeria', za: 'South Africa', et: 'Ethiopia', dz: 'Algeria', br: 'Brazil', ar: 'Argentina', co: 'Colombia', ve: 'Venezuela', cl: 'Chile', au: 'Australia', ca: 'Canada', mx: 'Mexico', fr: 'France', it: 'Italy', es: 'Spain', gr: 'Greece', fi: 'Finland' };
const ETHNIC: Record<string, string> = {
  eg: 'Egyptian (North African Arab, olive to light-brown skin)',
  ng: 'Nigerian (West African, dark brown skin)',
  za: 'South African',
  et: 'Ethiopian (East African, brown skin, fine features)',
  dz: 'Algerian (North African, Arab or Berber features, olive skin)',
  br: 'Brazilian',
  ar: 'Argentine (mostly European-descended Latin American)',
  co: 'Colombian (mestizo Latin American)',
  ve: 'Venezuelan (mestizo Latin American)',
  cl: 'Chilean (mestizo Latin American)',
  au: 'Australian',
  ca: 'Canadian',
  mx: 'Mexican (mestizo Latin American)',
  fr: 'French',
  it: 'Italian (Mediterranean European)',
  es: 'Spanish (Mediterranean European)',
  gr: 'Greek (Mediterranean European)',
  fi: 'Finnish (Nordic European, fair skin)',
};
/** 여러 인종이 함께 사는 나라: 사람마다 하나를 골라 붙임 */
const MIX: Record<string, string[]> = {
  za: ['Black South African (Zulu or Xhosa features, dark brown skin)', 'Black South African (Sotho or Tswana features, brown skin)', 'White Afrikaner South African', 'South African of Indian descent', 'Coloured (mixed-race) South African, light-brown skin'],
  br: ['white Brazilian of Portuguese or Italian descent', 'mixed-race (pardo) Brazilian, light-brown skin', 'Afro-Brazilian, dark brown skin', 'Brazilian of Japanese descent'],
  au: ['White Australian of British or Irish descent', 'White Australian of Greek or Italian descent', 'Australian of Chinese or Vietnamese descent', 'Aboriginal Australian'],
  ca: ['White English-Canadian', 'White French-Canadian (Québécois)', 'Canadian of South Asian (Punjabi) descent', 'Canadian of Chinese descent', 'First Nations Canadian'],
  fr: ['White French', 'White French', 'French of North African (Maghrebi) descent', 'Black French of West African or Caribbean descent'],
  ng: ['Nigerian (Yoruba, dark brown skin)', 'Nigerian (Igbo, dark brown skin)', 'Nigerian (Hausa-Fulani, slim face, brown skin)'],
};
const MIX_W: Record<string, number[]> = { za: [3, 2, 3, 1, 1], br: [4, 4, 2, 1], au: [6, 2, 2, 1], ca: [5, 3, 1, 1, 1], fr: [5, 2, 2, 1], ng: [1, 1, 1] };
function ethnicOf(rng: Rng, tag: string): string {
  const m = MIX[tag];
  if (!m) return ETHNIC[tag];
  const w = MIX_W[tag];
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < m.length; i++) if ((r -= w[i]) < 0) return m[i];
  return m[0];
}
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

const HAIR_YM = ['short neat black hair', 'short textured hair', 'buzz cut', 'side-parted short hair', 'slightly messy short hair', 'short hair with an undercut', 'short wavy hair', 'cropped curly hair'];
const HAIR_YF = ['hair tied in a low ponytail', 'neat short bob', 'hair in a tight bun', 'shoulder-length straight hair tucked behind the ears', 'braided hair', 'short pixie cut', 'high ponytail', 'chin-length wavy hair'];
const EXTRA_YM = ['clean-shaven', 'light stubble', 'thin-framed glasses', 'a small scar on the eyebrow', 'clean-shaven, a headset around the neck', 'clean-shaven, a tactical earpiece'];
const EXTRA_YF = ['no glasses', 'thin-framed glasses', 'small stud earrings', 'a headset around the neck', 'a small mole under the eye', 'no makeup, freckles'];
const MOOD_Y = ['alert and focused', 'a confident half smile', 'serious and disciplined', 'friendly, eager smile', 'calm, steady gaze', 'determined look', 'slightly cocky grin', 'quiet and observant'];
const WEAR_Y = ['an olive field uniform with a plain chest rig', 'a camouflage field jacket', 'a plain dark-navy service uniform without insignia', 'a grey field shirt with rolled sleeves', 'a black tactical jacket', 'an olive uniform holding a rugged tablet', 'a desert-tan field uniform', 'a plain white naval-style service uniform without insignia'];

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


// 나라다운 옷(일부 사람만)
const LOCAL_M: Record<string, string[]> = {
  ng: ['a flowing embroidered agbada robe with a matching cap', 'a patterned kaftan shirt with a fila cap'],
  et: ['a white suit with a thin traditional netela shawl over one shoulder'],
  eg: ['a dark suit'],
  za: ['a colourful patterned Madiba-style shirt'],
  dz: ['a dark suit with a light-coloured burnous cloak over the shoulders'],
};
const LOCAL_F: Record<string, string[]> = {
  eg: ['a dark jacket with a loose beige headscarf', 'a navy jacket with a loose patterned headscarf'],
  dz: ['a dark jacket with a loose light headscarf'],
  ng: ['a bright patterned ankara dress with a tall gele head wrap', 'a dark jacket with a patterned gele head wrap'],
  et: ['a white habesha dress with a woven coloured border and a netela shawl'],
  za: ['a colourful patterned jacket with a matching head wrap'],
};
const LOCAL_P: Record<string, number> = { eg: 0.4, dz: 0.3, ng: 0.45, et: 0.3, za: 0.2 };
const HAIR_LOCAL = /headscarf|gele|head wrap/;

function desc(rng: Rng, c: FaceSheet['cells'][number]): { en: string; ko: string } {
  const age = c.band === '60' ? 60 + Math.floor(rng.next() * 13) : c.band === '40' ? 40 + Math.floor(rng.next() * 10) : 50 + Math.floor(rng.next() * 10);
  const m = c.sex === 'm';
  let hair = rng.pick(m ? HAIR_M : HAIR_F);
  if (c.band === '40') hair = rng.pick(m ? ['short neat dark hair', 'thick dark hair with a few grey strands', 'short wavy hair', 'neatly combed dark hair', 'short cropped hair', 'dark hair with a side part'] : ['shoulder-length dark hair', 'neat chin-length bob', 'long hair tied back', 'wavy brown hair', 'short layered hair', 'straight hair in a low bun']);
  const face = rng.pick(FACE);
  const extra = rng.pick(m ? EXTRA_M : EXTRA_F);
  const mood = rng.pick(MOOD);
  let wear = rng.pick(m ? WEAR : WEAR_F);
  const local = (m ? LOCAL_M : LOCAL_F)[c.tag];
  if (local && rng.next() < (LOCAL_P[c.tag] ?? 0)) wear = rng.pick(local);
  if (HAIR_LOCAL.test(wear)) hair = 'hair covered';
  const en = `${age}-year-old ${ethnicOf(rng, c.tag)} ${m ? 'man' : 'woman'}, ${hair}, ${face}, ${extra}, ${mood}, wearing ${wear}`;
  return { en, ko: `${KO[c.tag]} ${m ? '남' : '여'} ${age}세` };
}
function descYoung(rng: Rng, c: FaceSheet['cells'][number]): { en: string; ko: string } {
  const age = 24 + Math.floor(rng.next() * 13);
  const m = c.sex === 'm';
  let hair = rng.pick(m ? HAIR_YM : HAIR_YF);
  if (!m && (c.tag === 'eg' || c.tag === 'dz') && rng.next() < 0.4) hair = 'hair covered by a plain dark military headscarf';
  const en = `${age}-year-old ${ethnicOf(rng, c.tag)} ${m ? 'man' : 'woman'}, ${hair}, ${rng.pick(FACE)}, ${rng.pick(m ? EXTRA_YM : EXTRA_YF)}, ${rng.pick(MOOD_Y)}, wearing ${rng.pick(WEAR_Y)}`;
  return { en, ko: `${KO[c.tag]} ${m ? '남' : '여'} ${age}세` };
}

// ── 지도자(가상 인물): [나이, 한국어 생김새, 영어 생김새, 배경] ──
const LEADER_LOOK: Record<string, [string, string, string]> = {
  eg: ['64세 이집트 남성 · 짧은 회색 머리, 짧은 회색 콧수염 · 넓은 얼굴, 짙은 눈썹 · 남색 정장, 하늘색 넥타이 · 배경: 흐린 궁전 금빛 기둥 · 무게 있고 엄한 표정', 'A 64-year-old Egyptian man with short grey hair, a short grey moustache, broad face, heavy dark brows, olive-brown skin, solid build, wearing a dark navy suit and light blue tie. Weighty, stern, commanding expression', 'a grand presidential palace hall with gilded columns and warm lamps'],
  ng: ['59세 나이지리아(요루바) 남성 · 짧게 깎은 검은 머리, 희끗한 짧은 수염 · 둥근 얼굴, 짙은 갈색 피부 · 수놓은 흰 아그바다 옷과 같은 무늬 모자 · 배경: 흐린 대통령궁 초록 커튼 · 넉넉하고 자신감 있는 미소', 'A 59-year-old Nigerian (Yoruba) man with close-cropped black hair, a short greying beard, round face, dark brown skin, sturdy build, wearing a white embroidered agbada robe with a matching cap. Generous, confident smile', 'a presidential villa office with deep green curtains and carved wood'],
  za: ['62세 남아공(줄루) 남성 · 짧은 회색 곱슬머리 · 넓은 이마, 짙은 갈색 피부, 깊은 웃음 주름 · 진회색 정장, 금빛 넥타이 · 배경: 흐린 정부 청사 사암 기둥과 정원 · 따뜻하지만 단단한 표정', 'A 62-year-old Black South African (Zulu) man with short grey tightly curled hair, broad forehead, dark brown skin, deep laugh lines, wearing a charcoal suit and gold tie. Warm but firm expression', 'a sandstone government building colonnade with terraced gardens'],
  et: ['55세 에티오피아 남성 · 짧은 검은 머리, 짧게 다듬은 수염 · 갸름한 얼굴, 갈색 피부, 큰 눈 · 남색 정장, 흰 셔츠 · 배경: 흐린 궁전 나무 기둥과 고원 창밖 · 침착하고 똑똑한 표정', 'A 55-year-old Ethiopian man with short black hair, a neatly trimmed short beard, slim oval face, brown skin, large calm eyes, lean build, wearing a navy suit and white shirt. Composed, intelligent expression', 'a palace room with dark wooden pillars and a window showing green highlands'],
  dz: ['67세 알제리 남성 · 숱 적은 흰 머리, 흰 콧수염 · 긴 얼굴, 올리브색 피부, 매부리코 · 검은 정장, 짙은 초록 넥타이 · 배경: 흐린 흰 궁전 무어식 아치 · 깐깐하고 의심 많은 눈빛', 'A 67-year-old Algerian man with thinning white hair, a white moustache, long face, olive skin, aquiline nose, wearing a black suit and dark green tie. Strict, wary, sceptical gaze', 'a white palace hall with Moorish arches and blue-and-white tiles'],
  br: ['60세 브라질 남성 · 희끗한 검은 곱슬머리를 뒤로, 짧은 회색 수염 · 넓은 어깨, 밝은 갈색 피부 · 짙은 남색 정장, 초록 넥타이 · 배경: 흐린 현대식 흰 기둥 궁전과 유리창 · 대중을 끄는 시원한 웃음', 'A 60-year-old mixed-race Brazilian man with greying dark curly hair swept back, a short grey beard, broad shoulders, light-brown skin, wearing a dark navy suit and green tie. Charismatic, broad crowd-pleasing smile', 'a modernist palace with thin curved white columns and tall glass windows'],
  ar: ['52세 아르헨티나 남성 · 숱 많은 갈색 머리를 흩날리듯, 구레나룻 · 각진 얼굴, 흰 피부, 날카로운 눈 · 검은 가죽 재킷 안 흰 셔츠(넥타이 없음) · 배경: 흐린 분홍빛 대통령궁 발코니 · 거침없고 열정적인 표정', 'A 52-year-old Argentine man with thick tousled brown hair, long sideburns, angular face, fair skin, sharp eyes, wearing a black leather jacket over an open white shirt, no tie. Bold, fiery, passionate expression', 'a pink-hued presidential palace balcony overlooking a crowded plaza'],
  co: ['57세 콜롬비아 남성 · 단정한 회색 머리 · 둥근 얼굴, 밝은 갈색 피부, 얇은 안경 · 회색 정장, 노란 넥타이 · 배경: 흐린 신고전 양식 궁전과 안데스 산 · 신중하고 영리한 표정', 'A 57-year-old Colombian man with neat grey hair, round face, light-brown skin, thin-rimmed glasses, wearing a grey suit and yellow tie. Careful, shrewd expression', 'a neoclassical palace courtyard with misty Andes mountains behind'],
  ve: ['61세 베네수엘라 남성 · 짙은 검은 머리를 넘김, 짙은 콧수염 · 넓은 얼굴, 갈색 피부, 두꺼운 목 · 붉은 셔츠 위 짙은 재킷 · 배경: 흐린 궁전 붉은 휘장과 초상화 · 목소리 큰 연설가 같은 표정', 'A 61-year-old Venezuelan man with thick black hair combed back, a thick dark moustache, broad face, brown skin, heavy neck, wearing a dark jacket over a red shirt. Loud, defiant orator expression', 'a palace hall with red drapes and old oil portraits'],
  cl: ['56세 칠레 여성 · 어깨까지 오는 밤색 머리 · 갸름한 얼굴, 밝은 피부, 맑은 눈 · 남색 재킷, 은 브로치 · 배경: 흐린 하얀 대통령궁 안뜰과 설산 · 단호하고 냉정한 표정', 'A 56-year-old Chilean woman with shoulder-length chestnut hair, slim face, fair skin, clear eyes, wearing a navy jacket with a silver brooch. Firm, cool-headed expression', 'a white colonial palace courtyard with snowy Andes peaks in the distance'],
  au: ['58세 호주 남성 · 짧은 모래색 머리 · 햇볕에 그을린 피부, 넓은 턱, 파란 눈 · 짙은 남색 정장, 하늘색 셔츠, 넥타이 없음 · 배경: 흐린 국회의사당 큰 창과 유칼립투스 · 털털하고 자신감 있는 웃음', 'A 58-year-old White Australian man with short sandy hair, sun-weathered skin, broad jaw, blue eyes, wearing a dark navy suit and light blue shirt, no tie. Easy-going, confident grin', 'a parliament building interior with tall windows and eucalyptus trees outside'],
  ca: ['53세 캐나다(퀘벡) 남성 · 숱 많은 짙은 갈색 머리 · 갸름한 얼굴, 흰 피부, 옅은 수염 자국 · 짙은 회색 정장, 진홍 넥타이 · 배경: 흐린 고딕 의사당 돌 복도 · 친절하지만 계산이 빠른 표정', 'A 53-year-old French-Canadian man with thick dark-brown hair, slim face, fair skin, light stubble, wearing a charcoal suit and crimson tie. Friendly but calculating expression', 'a Gothic stone parliament corridor with tall arched windows'],
  mx: ['57세 멕시코 여성 · 검은 머리를 단정히 묶음, 은빛 귀걸이 · 둥근 얼굴, 밝은 갈색 피부 · 진홍 재킷, 수놓은 깃 · 배경: 흐린 국립궁전 벽화와 돌 아치 · 강단 있는 미소', 'A 57-year-old Mexican woman with black hair neatly pulled back, silver earrings, round face, light-brown skin, wearing a deep crimson jacket with an embroidered collar. Strong-willed, confident smile', 'a national palace stone arcade with a colourful mural on the wall'],
  fr: ['49세 프랑스 남성 · 짧게 다듬은 갈색 머리 · 갸름한 얼굴, 흰 피부, 날카로운 파란 눈 · 남색 정장, 흰 셔츠, 남색 넥타이 · 배경: 흐린 금빛 장식 궁전 방과 샹들리에 · 젊고 자신만만한 표정', 'A 49-year-old French man with short neat brown hair, slim face, fair skin, sharp blue eyes, wearing a navy suit, white shirt and navy tie. Young, self-assured, slightly aloof expression', 'a gilded palace salon with ornate mirrors and a crystal chandelier'],
  it: ['63세 이탈리아 남성 · 숱 많은 은발을 뒤로 · 매부리코, 올리브색 피부, 짙은 눈 · 맞춤 짙은 회색 정장, 하늘색 넥타이 · 배경: 흐린 르네상스 궁전 프레스코 천장 · 노련하고 여유로운 미소', 'A 63-year-old Italian man with thick silver hair swept back, aquiline nose, olive skin, dark eyes, wearing a tailored charcoal suit and light blue tie. Seasoned, relaxed, charming smile', 'a Renaissance palace room with fresco ceilings and marble'],
  es: ['55세 스페인 남성 · 짙은 머리, 희끗한 짧은 수염 · 각진 얼굴, 올리브색 피부 · 검은 정장, 붉은 넥타이 · 배경: 흐린 궁전 붉은 벨벳과 태피스트리 · 침착하고 노련한 표정', 'A 55-year-old Spanish man with dark hair, a short greying beard, angular face, olive skin, wearing a black suit and red tie. Calm, experienced expression', 'a palace hall with red velvet and old tapestries'],
  gr: ['60세 그리스 남성 · 희끗한 곱슬머리, 짙은 눈썹 · 넓은 얼굴, 올리브색 피부 · 남색 정장, 흰 셔츠, 넥타이 없음 · 배경: 흐린 흰 대리석 기둥과 파란 하늘 · 말 잘하고 당찬 표정', 'A 60-year-old Greek man with greying curly hair, thick dark brows, broad face, olive skin, wearing a navy suit and white shirt, no tie. Eloquent, spirited expression', 'white marble columns with a deep blue sky and distant sea'],
  fi: ['51세 핀란드 남성 · 짧은 금발, 수염 없음 · 길쭉한 얼굴, 흰 피부, 옅은 파란 눈 · 짙은 회색 정장, 하늘색 넥타이 · 배경: 흐린 북유럽식 나무 벽과 눈 덮인 창밖 · 말수 적고 차분한 표정', 'A 51-year-old Finnish man with short blond hair, clean-shaven, long face, fair skin, pale blue eyes, tall lean build, wearing a charcoal suit and light blue tie. Reserved, calm, quietly tough expression', 'a Nordic office with pale wood walls and a snowy forest outside the window'],
};
const SEC_LOOK: Record<string, string> = {
  eg: 'dark hair under a loose cream headscarf, large dark eyes, warm professional smile, a navy blazer',
  ng: 'braided black hair tied up, dark brown skin, bright confident smile, a mustard-yellow blazer',
  za: 'short natural black hair, dark brown skin, friendly calm smile, a teal blazer',
  et: 'curly black hair pulled back, brown skin, fine features, polite gentle smile, a white blouse with a woven border',
  dz: 'wavy dark hair in a low ponytail, olive skin, composed look, a grey blazer',
  br: 'long wavy dark-brown hair, light-brown skin, cheerful smile, a light green blazer',
  ar: 'long straight light-brown hair, fair skin, quick clever smile, a black blazer',
  co: 'long dark hair with soft waves, light-brown skin, warm smile, a cream blazer',
  ve: 'long black hair tied back, tan skin, alert eyes, a navy blazer',
  cl: 'shoulder-length dark hair, light olive skin, calm efficient look, a grey blazer',
  au: 'wavy blonde hair in a ponytail, fair lightly freckled skin, easy smile, a white shirt and navy blazer',
  ca: 'straight auburn hair at shoulder length, fair skin, polite smile, a burgundy blazer',
  mx: 'long black hair in a neat braid, light-brown skin, friendly smile, a red blazer',
  fr: 'chin-length brown bob, fair skin, chic composed look, a black blazer and silk scarf',
  it: 'long dark hair, olive skin, expressive eyes, an elegant charcoal blazer',
  es: 'dark hair in a low bun, olive skin, lively smile, a navy blazer',
  gr: 'long curly dark hair, olive skin, bright eyes, a white blouse and light grey blazer',
  fi: 'straight platinum-blonde hair, very fair skin, pale blue eyes, calm polite look, a dark blue blazer',
};
const BANNER: Record<string, string> = {
  eg: 'ancient pyramids at the edge of the desert, the wide Nile river with sailboats, a modern city skyline and a big container ship passing through a canal',
  ng: 'a crowded modern coastal megacity with glass towers and bridges over a lagoon, oil platforms on the sea and green savanna in the distance',
  za: 'a flat-topped table mountain above a harbour city, gold mine headframes on dry hills and an armoured vehicle column on a highway',
  et: 'green highland plateau with deep canyons, ancient rock-cut stone churches, a huge concrete river dam and a modern city on the hills',
  dz: 'golden Sahara dunes with gas flare towers, white hillside city above a blue Mediterranean bay and a desert military convoy',
  br: 'a lush rainforest river on one side and a big coastal city with mountains and beaches on the other, a jet airliner rising above',
  ar: 'wide grassy pampas with cattle, jagged snowy Patagonian peaks and a broad city avenue with a tall white obelisk far away',
  co: 'steep green Andes mountains with coffee farms, a colonial coastal fortress city with colourful houses and a river patrol boat',
  ve: 'a towering table-top mountain with a very tall waterfall, oil derricks by a large lake and a hillside capital city',
  cl: 'a very long coast with snowy volcanoes behind, a dry red desert with a huge open-pit copper mine and a navy frigate at sea',
  au: 'red desert outback with a huge red rock, a harbour city with a modern shell-like opera house and a submarine in blue water',
  ca: 'vast pine forests and lakes under snowy mountains, a frozen arctic coast with an icebreaker, and a city skyline with a tall needle tower',
  mx: 'ancient stepped stone pyramids in a green jungle, a huge colourful modern city in a mountain valley and a cargo train heading north',
  fr: 'a riverside capital with an iron lattice tower and elegant stone buildings, lavender fields and a delta-wing jet fighter overhead',
  it: 'rolling hills with cypress trees, an ancient stone colosseum-like arena in a city, and a coastal naval port with a light aircraft carrier',
  es: 'whitewashed hill towns and a Moorish palace, sunny beaches, and a narrow sea strait with a huge rock and warships passing',
  gr: 'white houses with blue domes on rocky islands, an ancient marble temple on a hill and a fast missile boat in a deep blue sea',
  fi: 'endless snowy pine forest and frozen lakes under northern lights, a small modern harbour city and white-camouflaged soldiers on skis',
};
const TRAIT_ART: Record<string, string[]> = {
  eg: ['a large cargo ship moving through a narrow desert canal', 'a heavy desert-tan tank on sand', 'an empty cracked water jar beside a price tag going up'],
  ng: ['an oil barrel with a green drop of oil and a gold coin', 'a big crowd of tiny people forming a growing arrow', 'a hidden gunman behind a cracked wall and a bag of money'],
  za: ['a raw diamond and a gold nugget on a rock', 'a factory with tall chimneys and a gear', 'a dark light bulb with an unplugged power cord'],
  et: ['a green mountain plateau with clouds below its edge', 'a giant concrete dam with water rushing out', 'a burning village hut with smoke'],
  dz: ['a gas flare tower burning above sand dunes', 'a stack of military helmets beside a pile of money', 'a single gas pipe holding up a shaky building'],
  br: ['a basket full of soybeans, iron ore and coffee', 'a regional jet airliner on a stand', 'a police car siren with a broken window'],
  ar: ['a golden wheat sheaf beside a cow on grass', 'a battery with a white salt flat inside', 'a banknote burning with a rising red arrow'],
  co: ['two hands shaking with an eagle feather above', 'a worn military helmet with a jungle leaf', 'a white powder packet in a dark jungle crate'],
  ve: ['a huge oil barrel overflowing with black oil', 'a red cap and an old rifle', 'a stack of banknotes collapsing like paper'],
  cl: ['a copper ingot and a lithium battery side by side', 'a grey navy frigate on blue water', 'a cracked ground with a small volcano and a protest sign without text'],
  au: ['a mining truck full of red iron ore', 'three hands joined above a submarine', 'a long empty desert road to the horizon'],
  ca: ['a maple leaf over a pile of logs and ore', 'two neighbouring houses with a shared fence and a handshake', 'a tiny toy soldier standing alone'],
  mx: ['a car factory assembly line with a truck', 'a group of young students with backpacks', 'a skull-patterned cash bag in a dark alley'],
  fr: ['a nuclear missile submarine shadow under the sea', 'a rocket and a delta-wing jet together', 'a protest placard without text and a stopped train'],
  it: ['a red sports car engine and precision gears', 'a ship in the middle of a blue sea with arrows to all shores', 'a revolving door with ministers spinning around'],
  es: ['a beach umbrella and a suitcase under the sun', 'a narrow sea strait between two rocky coasts', 'a ballot box with a crack splitting it in two'],
  gr: ['a giant cargo ship with many containers', 'many small islands in a blue sea', 'a euro-like coin under a heavy stone weight, no symbols'],
  fi: ['a pair of skis and a white winter rifle', 'a mobile phone with radio waves and a microchip', 'a small cabin alone in a huge snowy forest'],
};

it('새 나라 18개 그림 명령문', () => {
  const rng = new Rng(20261128);
  const sheets = newNationSheets2();
  writeFileSync('scripts/face-sheets-6.json', JSON.stringify(sheets.map((s) => ({ sheet: s.sheet, grid: s.grid, cells: s.cells.map((c) => c.file) })), null, 1) + '\n');
  const N = NEW_FACE_COUNTRIES2;
  const sp = SPECIAL_UNITS.filter((u) => N.includes(u.country)).sort((a, b) => N.indexOf(a.country) - N.indexOf(b.country) || a.slot - b.slot);
  const faceSheets = sheets.filter((s) => s.grid === 4);
  const per = faceSheets.length / N.length;
  const nTrait = N.reduce((a, c) => a + NATION_GOV[c].traits.length, 0);
  const total = N.length * 2 + nTrait + sp.length + N.length + faceSheets.length;
  const W = { leader: 1, sec: 2, people: 3, trait: 3 + N.length, unit: 5 + N.length, banner: 6 + N.length };
  const L: string[] = [];
  L.push(`# 새 나라 18개 그림 · 모두 ${total}장 (11/27)`, '');
  L.push(`${N.map((c) => KO[c]).join('·')} 그림이에요. 지금은 국기·기본 그림·비슷한 나라 얼굴로 대신 나오고, 그림을 넣으면 그 자리가 바로 바뀌어요.`, '');
  L.push('**인물은 한 장에 4×4 = 16명씩** 받아요(지도자·수행비서만 한 장에 한 사람). 처음부터 **40대 얼굴도 함께** 넣었어요(나라마다 40대 남 21·여 13명).', '');
  L.push('## 한눈 표', '');
  L.push('| 채팅창 | 무엇 | 장수 | 첫 그림에 첨부 | 저장 이름 |');
  L.push('|---|---|---|---|---|');
  L.push(`| 창 ${W.leader} | 나라 지도자 | ${N.length}장(1명씩) | \`ref-portrait-spot.png\` · \`leader-us.webp\` | \`leader-eg.png\` 등 |`);
  L.push(`| 창 ${W.sec} | 수행비서(20대 여성) | ${N.length}장(1명씩) | \`ref-face-spot.png\` · \`secretary-kr.webp\` | \`secretary-eg.png\` 등 |`);
  N.forEach((c, i) => L.push(`| 창 ${W.people + i} | ${FLAG[c]} ${KO[c]} 인물(40~70대 192 + 젊은 부관 32) | ${per}장(16명씩) | \`ref-face-spot.png\` · 창 1의 \`leader-${c}.png\` · (부관 장) \`ref-young-1.webp\` | \`sheet-${c}-1\` ~ \`-12\`, \`sheet-${c}-y1\` · \`-y2\` |`));
  L.push(`| 창 ${W.trait} · ${W.trait + 1} | 나라 특징 아이콘 | ${nTrait}장(창마다 절반) | \`ref-trait-spot.png\` · \`ref-done-small-icon.webp\` | \`trait-eg-1.png\` 등 |`);
  L.push(`| 창 ${W.unit} | 특별 병과 | ${sp.length}장 | \`ref-battle-screen.png\` · \`unit-sp-kp-1.webp\` | \`unit-sp-eg-1.png\` 등 |`);
  L.push(`| 창 ${W.banner} | 나라 배너(외교 창 맨 위 띠) | ${N.length}장 | \`banner-us.webp\` | \`banner-eg.png\` 등 |`);
  L.push('');
  L.push('참고 그림은 모두 첨부한 `new-nation-art-ref-2.zip` 하나에 있어요.', '');
  L.push('## 순서', '');
  L.push('1. 채팅창을 열고 **그 창의 첫 그림 때만** 표에 적힌 참고 그림을 첨부해요.');
  L.push(`2. 인물 창(${W.people}~${W.people + N.length - 1})은 첫 그림 전에 **틀 명령문**을 한 번 붙여요.`);
  L.push('3. 회색 상자 문장을 **한 장씩** 붙여 넣어요(같은 창에서 차례로).');
  L.push('4. 문장 끝에 적힌 **저장 이름 그대로** 저장해요.');
  L.push('5. 다 만들면(몇 장만이어도) 창별로 zip으로 올려 주세요. 제가 16명씩 잘라서 비슷한 얼굴을 거르고 게임에 넣어요.', '');
  L.push('**먼저 창 1(지도자)·창 2(수행비서)부터** 하면 좋아요. 게임에서 가장 자주 보이고, 인물 창에서 그 나라 지도자 그림을 화풍 기준으로 써요.', '');
  L.push('**급하지 않은 것**: 인물 장(창 3~20)은 양이 많아요. 한 나라에 몇 장만 와도 그만큼 넣고, 나머지는 비슷한 나라 얼굴을 계속 빌려 써요.', '');
  L.push('요령: 흰 배경이 나오면 "배경을 투명하게 다시". 만화처럼 나오면 "더 실사처럼, 만화풍 말고". 4×4가 뭉개지면 그 장만 다시 만들어 주세요.', '');
  L.push('**도시 상징**(165곳)은 그리지 않아요. 위키미디어 공용의 실제 상징을 제가 받아 넣을게요(지금은 코드로 그린 방패). **3D 모형**은 따로 없어요(새 나라 특별 병과는 기존 모형을 함께 씀).', '');

  L.push('---', '', `## 창 ${W.leader} · 나라 지도자 ${N.length}장`, '');
  N.forEach((c, i) => {
    const ld = LEADERS[c];
    const [ko, en, bg] = LEADER_LOOK[c];
    L.push(`### ${FLAG[c]} ${KO[c]} ${ld.title} ${ld.name} · 저장 이름 \`leader-${c}.png\`${i === 0 ? ' · **참고 그림 첨부**' : ''}`);
    L.push(`- 생김새: ${ko}`);
    L.push('```');
    const head = i === 0 ? 'The attached images show where this face appears in my game (a small circle) and a leader portrait I already made; match that art style and painting quality.' : 'Use exactly the same art style, painting quality, lighting and framing as the previous portraits in this chat.';
    L.push(`${head} ${en}. This is the fictional ${ld.title === '총리' ? 'Prime Minister' : 'President'} of ${EN[c]} in this game world.${TAIL_PORTRAIT} Background: ${bg}${TAIL_PORTRAIT2}${save(`leader-${c}`)}`);
    L.push('```', '');
  });
  L.push('---', '', `## 창 ${W.sec} · 수행비서 ${N.length}장`, '');
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
  N.forEach((c, i) => {
    const mine = sheets.filter((s) => s.country === c && s.grid === 4);
    const w = W.people + i;
    L.push('---', '', `## 창 ${w} · ${FLAG[c]} ${KO[c]} 인물 ${mine.length}장 (첨부: ref-face-spot.png + leader-${c}.png)`, '');
    L.push('틀 명령문(첫 그림 전에 한 번):', '```', FACE_FRAME, '```', '');
    for (const s of mine) {
      const young = s.sheet.includes('-y');
      const ds = s.cells.map((x) => (young ? descYoung(rng, x) : desc(rng, x)));
      L.push(`### ${s.sheet}.png · 창 ${w} · 4×4 = 16명${young ? ' · 젊은 부관(이 장은 `ref-young-1.webp`도 첨부)' : ''}`);
      L.push(`- ${ds.map((d, k) => `${k + 1}) ${d.ko}`).join(' · ')}`);
      L.push('```');
      L.push(
        young
          ? 'New sheet, same fixed rules and style. These are young military aides (adjutants) in their twenties and thirties; the attached young aide portrait shows the style. A 4x4 grid of 16 different young people, all NEW faces, clearly different from earlier sheets.'
          : 'New sheet, same fixed rules and style. A 4x4 grid of 16 different people. These must be NEW people, clearly different from any face in my earlier sheets. Each person must clearly look the age written for them (40s look like their 40s, 60s look like their 60s).',
      );
      ds.forEach((d, k) => L.push(`${k + 1}) ${d.en}.`));
      L.push(`Backgrounds vary: ${young ? 'blurred command post, briefing room, airfield, barracks corridor' : 'blurred cabinet room, press room, parliament corridor, office bookshelves'}.${save(s.sheet)}`);
      L.push('```', '');
    }
  });
  const traits = N.flatMap((c) => NATION_GOV[c].traits.map((t, k) => ({ c, t, k })));
  const half = Math.ceil(traits.length / 2);
  [traits.slice(0, half), traits.slice(half)].forEach((part, pi) => {
    L.push('---', '', `## 창 ${W.trait + pi} · 나라 특징 아이콘 ${part.length}장`, '');
    part.forEach(({ c, t, k }, j) => {
      const f = `trait-${c}-${k + 1}`;
      L.push(`### ${FLAG[c]} ${KO[c]} ${t.icon} ${t.name}${t.weak ? '(약점)' : ''} · 저장 이름 \`${f}.png\`${j === 0 ? ' · **참고 그림 첨부**' : ''}`);
      L.push('```');
      const head = j === 0
        ? 'The attached images show where this icon appears in my game (small trait chips in a steel-blue console UI) and a small icon I already made; match its art style, lighting and quality exactly. This is the first of a matching set of small trait icons.'
        : 'Next icon in the same set: use exactly the same art style, lighting, angle, outline and size as the previous icons.';
      L.push(`${head} A small game icon showing ${TRAIT_ART[c][k]}.${ICON_TAIL}${save(f)}`);
      L.push('```', '');
    });
  });
  L.push('---', '', `## 창 ${W.unit} · 특별 병과 ${sp.length}장`, '');
  sp.forEach((u, k) => {
    const f = `unit-sp-${u.id}`;
    L.push(`### ${FLAG[u.country]} ${KO[u.country]} ${u.slot}번 ${u.name}(바탕 ${u.base}) · 저장 이름 \`${f}.png\`${k === 0 ? ' · **참고 그림 첨부**' : ''}`);
    L.push('```');
    const head =
      k === 0
        ? "The attached screenshot shows the game map where this sprite will appear as a small piece on a hex tile, and a special unit sprite I already made; match that sprite's exact art style. This is an elite special version of a standard unit: keep it clearly recognizable as that type of unit, with one or two distinctive upgraded features."
        : 'Next sprite in the same set: use exactly the same art style, angle, lighting and size as the previous one. This is an elite special version of a standard unit.';
    L.push(`${head} ${u.art}${UNIT_TAIL}${save(f)}`);
    L.push('```', '');
  });
  L.push('---', '', `## 창 ${W.banner} · 나라 배너 ${N.length}장`, '');
  N.forEach((c, k) => {
    L.push(`### ${FLAG[c]} ${KO[c]} · 저장 이름 \`banner-${c}.png\`${k === 0 ? ' · **참고 그림 첨부**' : ''}`);
    L.push('```');
    const head = k === 0 ? 'The attached image is a country banner I already made for my game; match its art style, framing and size exactly.' : 'Next picture in this chat: use exactly the same art style, camera angle, lighting and size as the previous one.';
    L.push(`${head} A wide country banner for a near-future modern strategy game, showing ${BANNER[c]}.${BANNER_TAIL}${save(`banner-${c}`)}`);
    L.push('```', '');
  });
  L.push('---', '', '## 다 만든 뒤', '');
  L.push('창별로 zip 하나씩 올려 주시면 돼요(몇 장만이어도 괜찮아요). 제가 인물 장은 16명씩 잘라 넣고(`scripts/cut_faces.py`), 나머지는 크기를 줄여 바로 넣어요.');
  writeFileSync('docs/new-nation-art-prompts-2.md', L.join('\n') + '\n');
});
