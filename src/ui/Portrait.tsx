// 인물 사진 칸. 대장이 만든 그림을 src/assets/portraits/ 에 정해진 이름으로 넣으면 바로 그 그림이 나옴.
// 그림이 없으면 지금 쓰는 임시 그림(이모지·국기)을 그대로 보여 줌. 목록은 src/assets/portraits/README.md
import type { ReactNode } from 'react';
import { COUNTRIES } from '../data/world';
import { LEADERS } from '../data/leaders';
import { AIDE_SPECIALTIES, NAME_POOL } from '../data/officers';

const FILES = import.meta.glob('../assets/portraits/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** 파일 이름(확장자 뺀 것) → 주소 */
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) {
  const base = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  URLS[base.normalize('NFC')] = url;
}

/** 부관 전문 분야 → 파일 이름 */
export const AIDE_FILE: Record<string, string> = { 저격: 'aide-sniper', 의무: 'aide-medic', 통신: 'aide-signal', 공병: 'aide-engineer', 정찰: 'aide-scout' };

/** 앞에서부터 처음 있는 그림 주소 */
export function portraitUrl(...keys: (string | undefined | null)[]): string | null {
  for (const k of keys) if (k && URLS[k]) return URLS[k];
  return null;
}

/** 부관(이름 그림 → 분야 그림 → 기본 부관 그림) */
export const aideKeys = (a?: { name: string; specialty: string } | null) => (a ? [`aide-${a.name}`, AIDE_FILE[a.specialty], 'aide'] : ['aide']);

/** 사진이 있으면 사진, 없으면 fallback */
export function Face({ keys, fallback, className = '' }: { keys: (string | undefined | null)[]; fallback: ReactNode; className?: string }) {
  const url = portraitUrl(...keys);
  if (!url) return <>{fallback}</>;
  return <img className={`face-img ${className}`} src={url} alt="" draggable={false} />;
}

/** 사진 칸 전체 목록(시험 화면에서 무엇이 들어왔는지 보기용) */
export function portraitSlots(): { key: string; who: string }[] {
  return [
    { key: 'player', who: '나(플레이어 지도자) · 없으면 우리 나라 지도자 그림' },
    ...COUNTRIES.map((c) => ({ key: `leader-${c.id}`, who: `${c.name} ${LEADERS[c.id].title} ${LEADERS[c.id].name}` })),
    { key: 'aide', who: '기본 부관(당직 부관)' },
    ...AIDE_SPECIALTIES.map((s) => ({ key: AIDE_FILE[s], who: `${s} 부관` })),
    ...NAME_POOL.map((n) => ({ key: `aide-${n}`, who: `부관·라이벌 ${n}(선택)` })),
    { key: 'envoy', who: '다른 나라 특사' },
    { key: 'coastguard', who: '해안 경비대장' },
    { key: 'settler', who: '섬 주민 대표' },
  ];
}

export const hasPortrait = (key: string) => !!URLS[key];

export function PortraitList() {
  const slots = portraitSlots();
  const filled = slots.filter((s) => hasPortrait(s.key)).length;
  return (
    <div className="portrait-list">
      <p className="small muted">
        넣은 사진 {filled} / {slots.length}칸 · 폴더 src/assets/portraits/
      </p>
      <div className="portrait-grid">
        {slots.map((s) => (
          <div key={s.key} className={`portrait-slot ${hasPortrait(s.key) ? 'on' : ''}`}>
            <span className="portrait-box">
              <Face keys={[s.key]} fallback="➕" />
            </span>
            <code>{s.key}</code>
            <small>{s.who}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 인물 얼굴(11-23): 이름 대신 "생김새 묶음" 그림을 나눠 씀.
 * 파일 이름 face-{생김새}-{성별}-{나이대}-{번호}. 예: face-ea-m-mid-1.webp (ea 동아시아·sa 남아시아·we 서양·ee 동유럽·me 중동·tr 튀르크 / m·f / mid 45~59·old 60+)
 * 같은 묶음 그림이 여러 장이면 인물 번호로 하나를 고정해서 골라요.
 */
export function personFaceUrl(look: string, sex: 'm' | 'f', age: number, id: number): string | null {
  const band = age >= 60 ? 'old' : 'mid';
  const tries = [`face-${look}-${sex}-${band}-`, `face-${look}-${sex}-${band === 'old' ? 'mid' : 'old'}-`];
  for (const pre of tries) {
    const list = Object.keys(URLS).filter((k) => k.startsWith(pre)).sort();
    if (list.length) return URLS[list[id % list.length]];
  }
  return null;
}
