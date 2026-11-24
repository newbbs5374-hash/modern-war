// 나라별 얼굴 520장 명령문 만들기: npm run faces → scripts/face-sheets.json(자르기 도구용) + docs/face-country-prompts.md(대장용 명령문)
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { faceSheets, faceSheetsExtra, US_ETH_NAME, type FaceSheet } from '../src/data/faces';
import { Rng } from '../src/game/rng';

const KO: Record<string, string> = {
  kr: '대한민국', kp: '북한', jp: '일본', cn: '중국', us: '미국', uk: '영국', de: '독일', ru: '러시아', ua: '우크라이나', in: '인도', ir: '이란', il: '이스라엘', tr: '튀르키예',
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
  'us-we': 'White American',
  'us-bl': 'African American (Black American)',
  'us-hi': 'Hispanic / Latino American',
  'us-as': 'Asian American (East or Southeast Asian heritage)',
};
const TAG_KO = (tag: string) => (tag.startsWith('us-') ? `미국 ${US_ETH_NAME[tag.slice(3) as keyof typeof US_ETH_NAME]}` : KO[tag]);

const HAIR_M = ['short neat black hair', 'thick hair streaked with grey', 'salt-and-pepper hair combed back', 'short-cropped white hair', 'receding hairline with grey sides', 'mostly bald with a grey fringe', 'side-parted grey hair', 'wavy dark hair going grey at the temples', 'buzz-cut grey hair', 'neatly combed silver hair'];
const HAIR_F = ['shoulder-length dark hair', 'short grey bob', 'salt-and-pepper hair tied back', 'short silver pixie cut', 'wavy dark hair with grey streaks', 'neat low bun', 'chin-length brown hair', 'elegant short white hair'];
const FACE = ['round face', 'long narrow face', 'square jaw', 'high cheekbones', 'soft full cheeks', 'sharp angular face', 'heavy brow', 'wide face with laugh lines'];
const EXTRA_M = ['no glasses, clean-shaven', 'thin metal-rimmed glasses', 'thick black-rimmed glasses', 'a short trimmed grey beard', 'a neat moustache', 'clean-shaven with a small scar on the chin', 'rimless glasses and stubble', 'no glasses, deep crow’s feet'];
const EXTRA_F = ['no glasses, small pearl earrings', 'thin gold-rimmed glasses', 'red-framed glasses', 'no glasses, a small mole on the cheek', 'simple stud earrings', 'reading glasses on a chain'];
const MOOD = ['calm and composed', 'a faint confident smile', 'stern and serious', 'tired but kind', 'sceptical, one brow raised', 'warm, friendly smile', 'determined gaze', 'thoughtful, slightly worried'];
const WEAR = ['a dark navy suit and a muted tie', 'a charcoal suit and white shirt', 'a grey suit with a small lapel pin', 'a black suit and a dark red tie', 'an open-collar shirt and blazer', 'a plain military-style dress uniform without insignia', 'a light grey suit and a blue tie', 'a dark knit sweater over a shirt'];
const WEAR_F = ['a dark navy jacket and a simple necklace', 'a grey blazer with a brooch', 'a black jacket and white blouse', 'a deep red jacket', 'a camel-coloured jacket and scarf', 'a plain dark dress-uniform style jacket without insignia'];

function desc(rng: Rng, c: FaceSheet['cells'][number]): { en: string; ko: string } {
  const age = c.band === '60' ? 60 + Math.floor(rng.next() * 13) : 45 + Math.floor(rng.next() * 15);
  const m = c.sex === 'm';
  const hair = rng.pick(m ? HAIR_M : HAIR_F);
  const face = rng.pick(FACE);
  const extra = rng.pick(m ? EXTRA_M : EXTRA_F);
  const mood = rng.pick(MOOD);
  let wear = rng.pick(m ? WEAR : WEAR_F);
  if (c.tag === 'kp' && !wear.includes('uniform')) wear = m ? 'a plain dark Mao-collar suit' : 'a plain dark jacket with a high collar';
  const en = `${age}-year-old ${ETHNIC[c.tag]} ${m ? 'man' : 'woman'}, ${hair}, ${face}, ${extra}, ${mood}, wearing ${wear}`;
  const ko = `${TAG_KO(c.tag)} ${m ? '남' : '여'} ${age}세`;
  return { en, ko };
}

function guide(sheets: FaceSheet[], seed: number, jsonOut: string, mdOut: string, extra: boolean) {
  const rng = new Rng(seed);
  writeFileSync(jsonOut, JSON.stringify(sheets.map((s) => ({ sheet: s.sheet, grid: s.grid, cells: s.cells.map((c) => c.file) })), null, 1) + '\n');
  const per = sheets.filter((s) => s.country === 'kr').length;
  const L: string[] = [];
  if (extra) {
    L.push('# 나라별 인물 얼굴 추가 286장 (11/24, 나라별 22장 더)', '');
    L.push('지금 나라마다 얼굴이 40장인데 한 판에 그 나라 사람이 약 55명 나와서 다른 탭끼리 얼굴이 겹쳐요. 나라마다 **22장(남 13 · 여 9)** 을 더 넣으면 62장이 되어 겹치지 않아요. 지난번 얼굴과 **다른 사람**이어야 해요.', '');
    L.push('## 어떻게 만드나요', '');
    L.push(`- 나라마다 **${per}장**(3×3 = 9명 두 장 + 2×2 = 4명 한 장), 모두 **${sheets.length}장**이에요.`);
    L.push('- **채팅창 13개**: 나라마다 창 하나. 지난번 그 나라 창이 남아 있으면 거기서 이어서 장 명령문만 보내도 돼요(화풍이 더 잘 맞아요).');
    L.push('- 새 창이면 **첫 그림에만** 아래 "틀 명령문"을 먼저 붙이고 참고 그림 2장(`guides/face-country-ref.zip` 안의 `ref-face-spot.png` + `leader-<나라>.webp`)을 첨부하세요.');
    L.push('- 저장 이름은 장마다 적힌 `sheet-<나라>-<번호>.png`(번호 6~8) 그대로. 다 만들면 zip 하나로 묶어 프로젝트 파일에 올려 주세요. 제가 잘라서 게임에 넣어요.');
    L.push('- 얼굴이 뭉개지거나 칸이 안 맞는 장만 다시 만들어 주세요.', '');
  } else {
    L.push('# 나라별 인물 얼굴 520장 (11/24, 나라별 40장)', '');
    L.push('게임 속 장관 후보·정계·재계·언론·시민·외국 장관이 이 얼굴을 **겹치지 않게 나눠** 써요. 게임이 얼굴을 먼저 정하고, 그 얼굴의 나라·인종에 맞는 이름표에서 이름을 뽑아서 이름과 인종이 어긋나지 않아요.', '');
    L.push('## 어떻게 만드나요', '');
    L.push('- 그림 한 장에 **3×3 = 9명**(나라마다 마지막 5번째 장만 **2×2 = 4명**). 나라마다 5장, 모두 **65장**이에요.');
    L.push('- **채팅창 13개**: 나라마다 창 하나(미국은 백인·흑인·히스패닉·아시아계를 한 창에서). 창마다 5장을 차례로 만들어요.');
    L.push('- 창마다 **첫 그림만** 아래 "틀 명령문"을 먼저 붙이고, 참고 그림 2장(`guides/face-country-ref.zip` 안의 `ref-face-spot.png` + `leader-<나라>.webp`)을 첨부하세요. 두 번째부터는 장 명령문만 보내면 돼요.');
    L.push('- 저장 이름은 장마다 적힌 `sheet-<나라>-<번호>.png` 그대로. 다 만들면 65장을 zip 하나로 묶어 프로젝트 파일에 올려 주세요. 제가 9명씩 잘라서(`scripts/cut_faces.py`) 비슷한 얼굴을 거른 뒤 게임에 넣어요.');
    L.push('- 그림 품질이 떨어지면(얼굴이 뭉개지거나 9칸이 안 맞으면) 그 장만 다시 만들어 주세요. 잘 안 되면 말씀해 주시면 2×2(4명) 명령문으로 바꿔 드릴게요.', '');
  }
  L.push('## 틀 명령문 (창마다 첫 그림에 한 번)', '');
  L.push('```');
  L.push(
    'I am making character portraits for a near-future modern military and politics strategy game. The attached images show where a face appears in my game (a small square on a dark console UI) and a leader portrait I already made; match that leader portrait\'s art style and painting quality exactly. Every image in this chat follows these fixed rules: ONE square 1:1 image (1024x1024 or larger) that is a contact sheet of separate portraits in an exact equal grid (3x3 unless I say 2x2), every cell the same size, separated by a thin straight dark gap, no frames, no text, no numbers, no letters, no logos, no flags, no real insignia anywhere. Each cell: semi-realistic digital painting (realistic proportions, skin and fabric texture, like a high-quality modern mobile strategy game; not anime, not cartoon, not a photograph); an ORIGINAL FICTIONAL person who must NOT resemble any real person, politician or celebrity; every person in the sheet clearly different from the others (different face shape, nose, eyes, hair, build); head and upper chest, body turned about 15 degrees, face centred with eyes at about 40 percent from the top of the cell; soft cinematic key light from the top-left with a gentle warm rim light; background of every cell heavily blurred and darkened toward the edges. Cells are numbered left-to-right, top-to-bottom. I will send one sheet description at a time; make exactly ONE sheet image per message.',
  );
  L.push('```', '');
  let win = 0;
  let last = '';
  for (const s of sheets) {
    if (s.country !== last) {
      win++;
      last = s.country;
      L.push(`---`, '', `## 창 ${win} · ${KO[s.country]} · ${per}장 (${extra ? '새 창이면 ' : ''}첨부: ref-face-spot.png + leader-${s.country}.webp)`, '');
    }
    const ds = s.cells.map((c) => desc(rng, c));
    L.push(`### ${s.sheet}.png · 창 ${win} · ${s.grid}×${s.grid} = ${s.cells.length}명`);
    L.push(`- ${ds.map((d, i) => `${i + 1}) ${d.ko}`).join(' · ')}`);
    L.push('```');
    const first = s.sheet.endsWith(extra ? '-6' : '-1');
    L.push(
      `${first ? (extra ? 'New sheet (if this is a new chat, this is the first sheet). These must be NEW people, clearly different from any face in my earlier sheets.' : 'First sheet.') : 'Next sheet, same fixed rules and same style as the previous sheets in this chat.'} A ${s.grid}x${s.grid} grid of ${s.cells.length} different people.${s.grid === 2 ? ' (This one is 2x2, four cells.)' : ''}`,
    );
    ds.forEach((d, i) => L.push(`${i + 1}) ${d.en}.`));
    L.push(`Backgrounds vary: blurred cabinet room, press room, parliament corridor, office bookshelves. File name: save this image as ${s.sheet}.png`);
    L.push('```', '');
  }
  writeFileSync(mdOut, L.join('\n'));
}

it('faces guide', () => {
  guide(faceSheets(), 20261124, 'scripts/face-sheets.json', 'docs/face-country-prompts.md', false);
});
it('faces guide extra', () => {
  guide(faceSheetsExtra(), 20261125, 'scripts/face-sheets-2.json', 'docs/face-country-prompts-2.md', true);
});
