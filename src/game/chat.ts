// 인물과 대화(11-25 대장 요청 1번): 장관·참모·장군·부관의 인물 창 '💬 대화' 탭.
// 근황 묻기 · 건의 듣기 · 칭찬 · 사적인 이야기 · 다른 사람 평. 말은 성향·충성·자리·실제 나라 상황을 보고 고름.
import { HIDDEN, PERSON_ORIGINS, ministryById, type Trait } from '../data/cabinet';
import { cityById } from '../data/cities';
import { cabinetOf, ministryPower, minLevel, type Person } from './cabinet';
import { cityCiv } from './civ';
import { Rng } from './rng';
import type { GameState } from './state';
import { citiesOf, ga } from './world';
import { bumpLoyal, propOf, speakerOf, type Speaker } from './proposals';

const H = 3600_000;
/** 칭찬: 실제 6시간에 한 번 · 사적인 이야기: 실제 하루에 한 번 · 근황: 1시간에 한 번 충성 +1 */
export const PRAISE_GAP = 6 * H;
export const STORY_GAP = 24 * H;
export const HELLO_GAP = H;

export type ChatTopic = 'hello' | 'praise' | 'story' | 'others';
export interface ChatState {
  /** 사람 → 주제 → 마지막 시각 */
  at: Record<string, Partial<Record<ChatTopic, number>>>;
}
export const chatOf = (s: GameState): ChatState => s.chat ?? { at: {} };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const seedOf = (s: GameState, key: string, k: number) => Math.floor(s.worldMs / H) * 131 + key.length * 17 + Number(key.slice(2)) * 7 + k;

/** 성향 인사말 */
const GREET: Record<Trait, string[]> = {
  청렴: ['부르셨습니까. 숨김없이 말씀드리겠습니다.', '대통령님, 오늘도 원칙대로 일하고 있습니다.'],
  야심: ['기다리고 있었습니다. 저에게 더 큰 일을 맡겨 주십시오.', '좋은 때 부르셨습니다. 할 말이 많습니다.'],
  충직: ['네, 대통령님! 무엇이든 말씀만 하십시오.', '언제나 대통령님 곁에 있겠습니다.'],
  인기인: ['오늘 기자들이 또 저를 찾더군요. 하하, 무슨 일이십니까?', '국민들 반응이 좋습니다! 말씀하시죠.'],
  강경파: ['짧게 하시죠. 할 일이 많습니다.', '약해 보이면 안 됩니다. 무슨 일입니까?'],
  원칙주의: ['절차대로 보고드리겠습니다.', '규정에 맞게 처리하고 있습니다.'],
  실용주의: ['돈이 되는 얘기면 언제든 환영입니다.', '결과로 말씀드리겠습니다.'],
  신중파: ['조심스럽게 살펴보는 중입니다.', '서두르지 않는 게 좋겠습니다. 무슨 일이십니까?'],
  협상가: ['어떤 일이든 길은 있습니다. 말씀하시죠.', '모두가 만족할 방법을 찾고 있었습니다.'],
  혁신가: ['새로운 생각이 하나 있습니다!', '낡은 방식은 바꿔야 합니다. 들어 보시겠습니까?'],
  현장형: ['방금 현장에서 돌아왔습니다.', '현장에서 본 것을 그대로 말씀드리죠.'],
  냉철: ['숫자로 말씀드리겠습니다.', '감정은 빼고 보고드리겠습니다.'],
};
/** 충성에 따라 붙는 말 */
function moodLine(loy: number): string {
  if (loy >= 80) return '🫡 대통령님을 믿고 따르겠습니다.';
  if (loy >= 55) return '🙂 요즘 일할 맛이 납니다.';
  if (loy >= 35) return '😐 솔직히 요즘 좀 지칩니다.';
  return '😠 제 말을 들어 주시긴 하는 겁니까?';
}

/** 사적인 이야기(출신마다) */
const STORY: Record<string, string[]> = {
  econ: ['처음 예산서를 짜던 밤, 숫자 하나 틀려서 밤을 새웠던 이야기를 해 줬어요.', '어머니가 시장에서 장사하셨대요. 그래서 물가에 예민하대요.'],
  general: ['첫 부대에서 겨울 행군하던 이야기를 들려줬어요.', '전역한 부하들과 아직도 연락한대요.'],
  scientist: ['실험이 300번 실패하고 301번째에 성공했던 날을 이야기했어요.', '어릴 때 라디오를 뜯어 보다 혼났대요.'],
  athlete: ['올림픽 결승에서 넘어졌다가 다시 일어난 이야기를 해 줬어요.', '지금도 새벽마다 달리기를 한대요.'],
  diplomat: ['외국에서 30년 살며 겪은 일을 웃으며 꺼냈어요.', '세 나라 말로 꿈을 꾼대요.'],
  spy: ['…자세한 건 말할 수 없다며 웃기만 했어요.', '가짜 이름으로 산 세월이 더 길대요.'],
  lawyer: ['억울한 사람을 처음 변호한 날을 이야기했어요.', '법은 약한 사람 편이어야 한다고 믿는대요.'],
  chaebol: ['아버지 회사가 아닌 자기 힘으로 무언가 하고 싶었대요.', '어릴 때 친구가 없었다는 이야기를 조용히 꺼냈어요.'],
  broadcaster: ['생방송 중에 대본이 날아간 날 이야기를 해 줬어요.', '카메라 앞보다 뒤가 더 편하대요.'],
  activist: ['광장에서 밤새 촛불을 들던 이야기를 들려줬어요.', '아직도 그때 동료들과 김밥을 나눠 먹는대요.'],
  doctor: ['응급실에서 사흘 동안 집에 못 간 이야기를 했어요.', '환자의 손을 잡아 주는 게 가장 큰 약이래요.'],
  mayor: ['시장 시절 시장 골목을 매일 걸었던 이야기를 해 줬어요.', '자기 도시 사람들 이름을 다 외운대요.'],
  commando: ['…낙하산이 안 펴졌던 날을 담담하게 말했어요.', '지금도 잠을 네 시간만 잔대요.'],
  admiral: ['태풍 속에서 배를 지켜 낸 밤 이야기를 들려줬어요.', '바다 냄새가 나야 잠이 온대요.'],
  commoner: ['새벽 시장에서 일하던 시절 이야기를 해 줬어요.', '어머니 된장찌개가 세상에서 제일 맛있대요.'],
  religious: ['어려운 사람들과 밥을 나누던 이야기를 했어요.', '매일 아침 나라를 위해 기도한대요.'],
  soldier: ['훈련소 첫날 울었던 이야기를 웃으며 꺼냈어요.', '군화 끈은 지금도 직접 맨대요.'],
  partisan: ['첫 선거에서 떨어지고 다시 일어선 이야기를 했어요.', '사람 만나는 게 제일 좋대요.'],
  professor: ['제자 한 명이 노벨상 후보가 됐다며 자랑했어요.', '강의실 맨 뒷자리 학생이 가장 기억에 남는대요.'],
  exec: ['회사가 망할 뻔했던 해 이야기를 들려줬어요.', '직원들 월급날이 가장 무서웠대요.'],
  prosecutor: ['큰 사건을 맡고 협박 편지를 받았던 이야기를 했어요.', '진실은 결국 드러난다고 믿는대요.'],
  journalist: ['특종 하나를 위해 석 달을 쫓아다닌 이야기를 해 줬어요.', '아직도 수첩을 들고 다닌대요.'],
};
const STORY_GEN = ['첫 지휘를 맡던 날 손이 떨렸던 이야기를 들려줬어요.', '전우를 잃은 날을 조용히 꺼냈어요. 그래서 더 신중하대요.', '고향 바다를 지키고 싶어 군에 들어왔대요.'];
const STORY_AIDE = ['대통령님을 처음 만난 날을 기억한대요.', '쉬는 날엔 부모님께 전화를 드린대요.', '언젠가 장군이 되는 게 꿈이래요.'];

export interface ChatLine {
  me?: boolean;
  text: string;
}

/** 대화 상대(장관·참모·장군·부관)가 지금 할 수 있는 말인지 */
export function chatWhy(s: GameState, key: string, topic: ChatTopic): string | null {
  const at = chatOf(s).at[key]?.[topic] ?? -Infinity;
  const gap = topic === 'praise' ? PRAISE_GAP : topic === 'story' ? STORY_GAP : topic === 'hello' ? 0 : 0;
  if (s.worldMs - at < gap) {
    const m = Math.ceil((gap - (s.worldMs - at)) / 60000);
    return m >= 60 ? `${Math.ceil(m / 60)}시간 뒤에` : `${m}분 뒤에`;
  }
  return null;
}

function stamp(s: GameState, key: string, topic: ChatTopic): GameState {
  const c = chatOf(s);
  return {
    ...s,
    chat: {
      at: { ...c.at, [key]: { ...(c.at[key] ?? {}), [topic]: s.worldMs } },
    },
  };
}

/** 근황 보고(자리마다 실제 상황) */
function report(s: GameState, sp: Speaker): string {
  const me = s.player.countryId;
  if (sp.own) {
    const c = cabinetOf(s);
    const m = ministryById(sp.own);
    const t = c.tasks[sp.own];
    const task = t ? `지금 '${m.tasks.find((x) => x.id === t.task)?.name}' 업무를 하고 있습니다.` : '지금은 맡은 업무가 없습니다. 일을 주십시오.';
    return `${m.name} 힘은 ${pct(ministryPower(s, sp.own))}, 청사는 ${minLevel(c, sp.own)}단계입니다. ${task}`;
  }
  if (sp.kind === 'g') {
    const g = s.officer.generals.find((x) => `g:${x.id}` === sp.key);
    return `${sp.role}으로서 능력 ${g?.skill ?? '?'}/10입니다. 우리 도시 ${citiesOf(s.world, me).length}곳을 지키고 있습니다.`;
  }
  if (sp.kind === 'a') return '언제든 출동할 준비가 되어 있습니다. 작전이나 임무를 맡겨 주십시오.';
  const low = [...citiesOf(s.world, me)].sort((a, b) => cityCiv(s, a).loyalty - cityCiv(s, b).loyalty)[0];
  return low ? `${sp.role} 자리에서 보니, ${ga(cityById(low).name)} 민심 ${Math.round(cityCiv(s, low).loyalty)}로 가장 낮습니다.` : `${sp.role} 일은 순조롭습니다.`;
}

/** 대화 한 마디 주고받기. 충성 변화와 말 몇 줄을 돌려줌 */
export function talk(s: GameState, key: string, topic: ChatTopic): { state: GameState; lines: ChatLine[] } {
  const sp = speakerOf(s, key);
  if (!sp) return { state: s, lines: [] };
  const why = chatWhy(s, key, topic);
  const rng = new Rng(seedOf(s, key, topic.length));
  const p = sp.person;
  const lines: ChatLine[] = [];
  let ns = s;
  switch (topic) {
    case 'hello': {
      lines.push({ me: true, text: '요즘 어때요?' });
      lines.push({ text: rng.pick(GREET[sp.trait] ?? GREET.충직) });
      lines.push({ text: report(s, sp) });
      lines.push({ text: moodLine(sp.loyalty) });
      const last = chatOf(s).at[key]?.hello ?? -Infinity;
      if (s.worldMs - last >= HELLO_GAP) ns = bumpLoyal(ns, key, 1);
      ns = stamp(ns, key, 'hello');
      break;
    }
    case 'praise': {
      lines.push({ me: true, text: '요즘 정말 잘하고 있어요. 고마워요.' });
      if (why) {
        lines.push({
          text: '하하, 아까도 칭찬해 주셨습니다. 일로 보답하겠습니다.',
        });
        break;
      }
      const v = sp.trait === '인기인' || sp.trait === '야심' ? 3 : sp.trait === '냉철' ? 1 : 2;
      lines.push({
        text: sp.trait === '냉철' ? '…감사합니다. 결과로 보여 드리죠.' : sp.trait === '야심' ? '알아봐 주시는군요! 더 큰 자리도 자신 있습니다.' : '과찬이십니다. 더 열심히 하겠습니다!',
      });
      lines.push({ text: `💗 충성 +${v}` });
      ns = stamp(bumpLoyal(ns, key, v), key, 'praise');
      break;
    }
    case 'story': {
      lines.push({
        me: true,
        text: '오늘은 일 얘기 말고, 당신 얘기를 듣고 싶어요.',
      });
      if (why) {
        lines.push({
          text: '오늘은 이미 많이 이야기했네요. 다음에 또 들려드리죠.',
        });
        break;
      }
      const pool = p ? (STORY[p.origin] ?? STORY.commoner) : sp.kind === 'g' ? STORY_GEN : STORY_AIDE;
      lines.push({ text: `☕ ${rng.pick(pool)}` });
      if (p)
        lines.push({
          text: `${PERSON_ORIGINS[p.origin].icon} ${p.age}세 · ${PERSON_ORIGINS[p.origin].name} 출신`,
        });
      let v = 2;
      // 충성이 높으면 숨겨 둔 이야기까지
      if (p && !p.known && p.loyalty >= 70) {
        lines.push({
          text: p.hidden ? `🔓 그리고… 털어놓을 게 있다며 '${HIDDEN[p.hidden].icon} ${p.hidden}' 이야기를 했어요.` : '🔓 숨기는 것 없이 다 털어놓았어요. 숨은 특성이 없대요.',
        });
        ns = {
          ...ns,
          cabinet: {
            ...cabinetOf(ns),
            people: cabinetOf(ns).people.map((x) => (x.id === p.id ? { ...x, known: true } : x)),
          },
        };
        v = 3;
      }
      lines.push({ text: `💗 충성 +${v}` });
      ns = stamp(bumpLoyal(ns, key, v), key, 'story');
      break;
    }
    case 'others': {
      lines.push({ me: true, text: '함께 일하는 사람들은 어때요?' });
      const c = cabinetOf(s);
      const name = (id: number) => c.people.find((x) => x.id === id && (x.seat || x.post));
      const pal = p?.pals.map(name).find(Boolean) as Person | undefined;
      const foe = p?.foes.map(name).find(Boolean) as Person | undefined;
      if (pal)
        lines.push({
          text: `🤝 ${pal.name}와는 손발이 잘 맞습니다. 같이 일하면 힘이 납니다.`,
        });
      if (foe)
        lines.push({
          text: `💢 ${foe.name}… 솔직히 같이 일하기 힘듭니다. 국무회의 때마다 부딪힙니다.`,
        });
      if (!pal && !foe)
        lines.push({
          text: sp.kind === 'p' ? '다들 각자 자리에서 잘하고 있습니다. 특별히 부딪히는 사람은 없습니다.' : '장병들 사기는 괜찮습니다. 걱정 마십시오.',
        });
      const pr = propOf(s)
        .list.filter((x) => x.who !== key)
        .slice(0, 1)[0];
      if (pr)
        lines.push({
          text: `💬 ${pr.whoName} ${pr.role}의 건의는 ${rng.chance(0.6) ? '저도 좋다고 봅니다.' : '조금 더 따져 봐야 할 것 같습니다.'}`,
        });
      break;
    }
  }
  return { state: ns, lines };
}
