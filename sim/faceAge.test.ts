// 11-27 얼굴·나이 맞추기: 40대 얼굴 + 50·60대 더(나라마다 48명, 4×4 세 장) 명령문
// npx vitest run --config sim/vitest.config.ts sim/faceAge.test.ts
// → scripts/face-sheets-5.json(자르기 도구용) + docs/face-age-prompts.md(대장용 명령문)
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { faceSheetsExtra3, US_ETH_NAME, type FaceSheet } from '../src/data/faces';
import { Rng } from '../src/game/rng';

const KO: Record<string, string> = {
  kr: '대한민국', kp: '북한', jp: '일본', cn: '중국', us: '미국', uk: '영국', de: '독일', ru: '러시아', ua: '우크라이나', in: '인도', ir: '이란', il: '이스라엘', tr: '튀르키예',
  tw: '대만', pl: '폴란드', ph: '필리핀', pk: '파키스탄', sa: '사우디아라비아',
};
const ETHNIC: Record<string, string> = {
  kr: 'South Korean (ethnic Korean)',
  kp: 'North Korean (ethnic Korean), austere official look',
  jp: 'Japanese',
  cn: 'Han Chinese',
  uk: 'White British',
  de: 'White German',
  ru: 'ethnic Russian (Slavic)',
  ua: 'ethnic Ukrainian (Slavic)',
  in: 'Indian (South Asian), varied skin tones from light brown to dark brown',
  ir: 'Iranian (Persian)',
  il: 'Israeli Jewish (mix of Ashkenazi and Mizrahi features)',
  tr: 'Turkish',
  tw: 'Taiwanese (Han Chinese)',
  pl: 'White Polish (Slavic)',
  ph: 'Filipino (Southeast Asian, warm brown skin)',
  pk: 'Pakistani (South Asian, Punjabi or Pashtun features, light-brown to brown skin)',
  sa: 'Saudi Arab (Middle Eastern)',
  'us-we': 'White American',
  'us-bl': 'African American (Black American)',
  'us-hi': 'Hispanic / Latino American',
  'us-as': 'Asian American (East or Southeast Asian heritage)',
};
const TAG_KO = (tag: string) => (tag.startsWith('us-') ? `미국 ${US_ETH_NAME[tag.slice(3) as keyof typeof US_ETH_NAME]}` : KO[tag]);

// 나이대마다 눈에 보이는 나이 표시(머리색·주름)를 따로 둬서 40대가 50대처럼 보이지 않게
const AGE_LOOK: Record<string, { m: string[]; f: string[]; skin: string }> = {
  '40': {
    m: ['thick short dark hair with no grey', 'dark hair with only a few grey strands at the temples', 'neatly side-parted dark hair', 'short dark hair, slightly receding', 'dark wavy hair', 'cropped dark hair'],
    f: ['shoulder-length dark hair with no grey', 'a sleek dark bob', 'dark hair in a neat low ponytail', 'wavy dark-brown hair', 'chin-length dark hair', 'dark hair tied back neatly'],
    skin: 'firm skin with only faint lines around the eyes, clearly younger than 50',
  },
  '50': {
    m: ['salt-and-pepper hair combed back', 'dark hair greying at the temples', 'side-parted greying hair', 'receding hairline with grey sides', 'short greying hair'],
    f: ['shoulder-length dark hair with grey streaks', 'a short greying bob', 'salt-and-pepper hair tied back', 'chin-length hair with grey roots'],
    skin: 'visible crow’s feet and forehead lines, clearly in their fifties',
  },
  '60': {
    m: ['short-cropped white hair', 'mostly bald with a grey fringe', 'neatly combed silver hair', 'thin grey hair combed back'],
    f: ['elegant short white hair', 'a short silver pixie cut', 'grey hair in a neat low bun', 'soft silver waves'],
    skin: 'deep wrinkles, age spots and sagging jawline, clearly in their sixties',
  },
};
const AGE_RANGE: Record<string, [number, number]> = { '40': [42, 49], '50': [51, 58], '60': [61, 69] };
const FACE = ['round face', 'long narrow face', 'square jaw', 'high cheekbones', 'soft full cheeks', 'sharp angular face', 'heavy brow', 'wide face with laugh lines'];
const EXTRA_M = ['no glasses, clean-shaven', 'thin metal-rimmed glasses', 'thick black-rimmed glasses', 'a short trimmed beard', 'a neat moustache', 'rimless glasses and stubble', 'no glasses, clean-shaven, a small scar on the chin'];
const EXTRA_F = ['no glasses, small pearl earrings', 'thin gold-rimmed glasses', 'red-framed glasses', 'no glasses, a small mole on the cheek', 'simple stud earrings'];
const MOOD = ['calm and composed', 'a faint confident smile', 'stern and serious', 'sharp ambitious look', 'sceptical, one brow raised', 'warm, friendly smile', 'determined gaze', 'thoughtful, slightly worried'];
const WEAR = ['a dark navy suit and a muted tie', 'a charcoal suit and white shirt', 'a grey suit with a small lapel pin', 'a black suit and a dark red tie', 'an open-collar shirt and blazer', 'a light grey suit and a blue tie'];
const WEAR_F = ['a dark navy jacket and a simple necklace', 'a grey blazer with a brooch', 'a black jacket and white blouse', 'a deep red jacket', 'a camel-coloured jacket and scarf'];
const LOCAL_M: Record<string, string[]> = {
  kp: ['a plain dark Mao-collar suit'],
  ph: ['a cream barong tagalog embroidered formal shirt'],
  pk: ['a dark sherwani-style long coat', 'a grey shalwar kameez with a dark waistcoat'],
  sa: ['a white thobe with a red-and-white checkered ghutra headdress and black agal', 'a white thobe with a plain white ghutra and a dark bisht cloak'],
  ir: ['a dark suit with a collarless white shirt'],
};
const LOCAL_F: Record<string, string[]> = {
  kp: ['a plain dark jacket with a high collar'],
  pk: ['a dark jacket with a loose dupatta scarf over the hair'],
  sa: ['a black abaya with a loose black headscarf', 'a dark navy abaya with a loose grey headscarf'],
  ir: ['a dark long jacket with a loose navy headscarf', 'a grey long jacket with a loose black headscarf'],
};
// 이 나라는 옷을 늘 나라 옷으로
const ALWAYS_LOCAL = new Set(['kp', 'sa', 'ir']);
const ROLE: Record<string, string> = { '40': '젊은 의원·차관보·대통령실 행정관급', '50': '장관·차관·시도지사급', '60': '원로·정당 대표·총리급' };

function desc(rng: Rng, c: FaceSheet['cells'][number]): { en: string; ko: string } {
  const band = c.band as '40' | '50' | '60';
  const [lo, hi] = AGE_RANGE[band];
  const age = lo + Math.floor(rng.next() * (hi - lo + 1));
  const m = c.sex === 'm';
  const look = AGE_LOOK[band];
  const country = c.tag.startsWith('us-') ? 'us' : c.tag;
  const local = (m ? LOCAL_M : LOCAL_F)[country];
  const wear = local && (ALWAYS_LOCAL.has(country) || rng.chance(0.3)) ? rng.pick(local) : rng.pick(m ? WEAR : WEAR_F);
  const en = `${age}-year-old ${ETHNIC[c.tag]} ${m ? 'man' : 'woman'}, ${rng.pick(m ? look.m : look.f)}, ${look.skin}, ${rng.pick(FACE)}, ${rng.pick(m ? EXTRA_M : EXTRA_F)}, ${rng.pick(MOOD)}, wearing ${wear}`;
  return { en, ko: `${TAG_KO(c.tag)} ${m ? '남' : '여'} ${age}세` };
}

it('face age guide (40대 + 50·60대 더)', () => {
  const rng = new Rng(20261127);
  const sheets = faceSheetsExtra3();
  writeFileSync('scripts/face-sheets-5.json', JSON.stringify(sheets.map((s) => ({ sheet: s.sheet, grid: s.grid, cells: s.cells.map((c) => c.file) })), null, 1) + '\n');
  const per = sheets.filter((s) => s.country === 'kr').length;
  const cells = sheets.reduce((a, s) => a + s.cells.length, 0);
  const n40 = sheets.reduce((a, s) => a + s.cells.filter((c) => c.band === '40').length, 0);
  const countries = [...new Set(sheets.map((s) => s.country))];
  const L: string[] = [];
  L.push(`# 인물 얼굴 나이 맞추기 (11/27) · 그림 ${sheets.length}장 · ${cells}명`, '');
  L.push('게임 속 인물 나이를 **얼굴 나이대에 맞췄어요**(50대 얼굴이면 50~59세, 60대 얼굴이면 60~69세). 장관·정당·시도지사는 거의 50~60대가 돼요.');
  L.push(`그런데 지금 얼굴은 50대·60대뿐이라 40대 인물이 없어요. 아래 그림이 들어오면 **40대 얼굴 ${n40}명**이 생겨서 젊은 의원·인재·행정관급은 40대로 나오고, 50·60대 얼굴도 조금 더 늘어 겹침이 줄어요.`, '');
  L.push('## 한눈 표', '');
  L.push('| 순서 | 채팅창 | 그림 | 첨부(첫 그림만) | 저장 이름 |');
  L.push('|---|---|---|---|---|');
  countries.forEach((c, i) => L.push(`| ${i + 1} | 창 ${i + 1} · ${KO[c]} | ${per}장(4×4 = 16명) | ref-face-spot.png · leader-${c}.webp · ref-age-${c}-50.webp · ref-age-${c}-60.webp | \`sheet-${c}-a1.png\` ~ \`-a${per}.png\` |`));
  L.push('', '- 참고 그림은 `guides/face-age-ref.zip` 하나에 모두 있어요. `ref-age-<나라>-50/60`은 지금 게임에 있는 그 나라 50대·60대 얼굴이에요. **40대는 이 사람들보다 확실히 젊어 보여야** 해요.');
  L.push('- 순서: **채팅창 열기 → 첨부 4장 → 틀 명령문 → 장 명령문 하나씩 → 적힌 이름으로 저장 → zip으로 올리기**.');
  L.push('- 지난번 그 나라 얼굴 창이 남아 있으면 거기서 이어서 장 명령문만 보내도 돼요(화풍이 더 잘 맞아요).');
  L.push('- **한국 것부터** 하면 좋아요(3장). 나라별로 따로 올려도 돼요. 들어온 나라부터 게임에 켜요.');
  L.push('- 한 장에 40대(머리 검고 주름 적음)와 50·60대(흰머리·주름)가 섞여 있어요. 나이가 비슷해 보이면 그 장만 다시 만들어 주세요.', '');
  L.push('## 틀 명령문 (창마다 첫 그림 전에 한 번)', '');
  L.push('```');
  L.push(
    'I am making character portraits for a near-future modern military and politics strategy game. The attached images show where a face appears in my game (a small square on a dark console UI), a leader portrait, and two existing portraits of a man/woman in their fifties and sixties from the same country; match their semi-realistic painted art style, lighting and framing exactly (not anime, not cartoon, not photo). Fixed rules for every image in this chat: one square image that is a contact sheet of separate portraits in an exact equal 4x4 grid (16 cells), every cell the same size, separated by a thin straight dark gap. Cells are numbered left-to-right, top-to-bottom. Each cell: one person, head and shoulders, facing the viewer or slightly turned, face centred and large, soft blurred background. No text, no names, no numbers, no logos, no flags, no national emblems, no real politicians. AGE MUST BE OBVIOUS: people in their forties have dark hair with little or no grey and smooth skin, people in their fifties are greying with visible lines, people in their sixties have white or silver hair and deep wrinkles. Every person must look clearly different from every other person.',
  );
  L.push('```', '');
  let win = 0;
  let last = '';
  for (const s of sheets) {
    if (s.country !== last) {
      win++;
      last = s.country;
      L.push('---', '', `## 창 ${win} · ${KO[s.country]} · ${per}장 (첨부: ref-face-spot.png + leader-${s.country}.webp + ref-age-${s.country}-50.webp + ref-age-${s.country}-60.webp)`, '');
    }
    const ds = s.cells.map((c) => desc(rng, c));
    const bands = s.cells.reduce<Record<string, number>>((a, c) => ((a[c.band] = (a[c.band] ?? 0) + 1), a), {});
    L.push(`### ${s.sheet}.png · 창 ${win} · 4×4 = ${s.cells.length}명 (${Object.entries(bands).map(([b, n]) => `${b}대 ${n}`).join(' · ')})`);
    L.push(`- 쓰는 자리: ${Object.keys(bands).map((b) => `${b}대 = ${ROLE[b]}`).join(' / ')}`);
    L.push(`- ${ds.map((d, i) => `${i + 1}) ${d.ko}`).join(' · ')}`);
    L.push('```');
    L.push(`New sheet, same fixed rules and style. A 4x4 grid of ${s.cells.length} different people. These must be NEW people, clearly different from the attached portraits and from earlier sheets. Make each person's age clearly readable.`);
    ds.forEach((d, i) => L.push(`${i + 1}) ${d.en}.`));
    L.push(`Backgrounds vary: blurred cabinet room, press room, parliament corridor, office bookshelves. File name: save this image as ${s.sheet}.png`);
    L.push('```', '');
  }
  writeFileSync('docs/face-age-prompts.md', L.join('\n'));
});
