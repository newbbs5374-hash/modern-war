// 가상 국기: 나라마다 색 띠 + 문양(실제 국기를 쓰지 않음). 그림 파일 없이 SVG로 그림.
import type { ReactNode } from 'react';

interface FlagDef {
  /** 띠 색(위→아래, 또는 왼→오른) */
  bands: string[];
  dir: 'h' | 'v' | 'd';
  emblem: string;
  ec: string;
}

export const FLAG_DEF: Record<string, FlagDef> = {
  us: { bands: ['#1e3a8a', '#f8fafc', '#1e3a8a'], dir: 'h', emblem: '★', ec: '#dc2626' }, // 리버티아: 자유의 별
  cn: { bands: ['#b91c1c', '#b91c1c'], dir: 'h', emblem: '◈', ec: '#facc15' }, // 화련: 붉은 바탕 금빛 인장
  ru: { bands: ['#e5e7eb', '#334155', '#7f1d1d'], dir: 'h', emblem: '✠', ec: '#fbbf24' }, // 볼가르: 눈·강철·피
  de: { bands: ['#111827', '#6b7280', '#111827'], dir: 'v', emblem: '⚙', ec: '#f59e0b' }, // 아이젠마르크: 철의 톱니
  jp: { bands: ['#f8fafc', '#f8fafc'], dir: 'h', emblem: '✿', ec: '#be123c' }, // 히노모리: 흰 바탕 붉은 꽃
  uk: { bands: ['#14532d', '#1e3a8a'], dir: 'd', emblem: '♛', ec: '#fde68a' }, // 애셔랜드: 왕관
  in: { bands: ['#ea580c', '#f8fafc', '#15803d'], dir: 'v', emblem: '☀', ec: '#1d4ed8' }, // 수리야: 태양
  kr: { bands: ['#f8fafc', '#0ea5e9', '#f8fafc'], dir: 'h', emblem: '≋', ec: '#1e40af' }, // 가람: 흐르는 강
  tr: { bands: ['#991b1b', '#0f766e'], dir: 'v', emblem: '⚔', ec: '#f8fafc' }, // 카라한: 교차한 칼
  il: { bands: ['#f8fafc', '#1d4ed8', '#f8fafc'], dir: 'v', emblem: '✦', ec: '#1d4ed8' }, // 하리온: 빛나는 별
  ir: { bands: ['#166534', '#f8fafc', '#166534'], dir: 'h', emblem: '⚜', ec: '#b45309' }, // 샤르반: 신전 문양
  ua: { bands: ['#facc15', '#2563eb'], dir: 'd', emblem: '❖', ec: '#f8fafc' }, // 스테포바: 들판과 하늘
  kp: { bands: ['#7f1d1d', '#1f2937', '#7f1d1d'], dir: 'h', emblem: '✪', ec: '#fbbf24' }, // 철령: 강철 별
};

export function Flag({ id, size = 1 }: { id: string; size?: number }) {
  const f = FLAG_DEF[id];
  if (!f) return <span>🏳️</span>;
  const w = 30 * size;
  const h = 20 * size;
  const n = f.bands.length;
  return (
    <svg className="flag" width={w} height={h} viewBox="0 0 30 20" role="img" aria-label="국기">
      {f.dir === 'd' ? (
        <>
          <rect width="30" height="20" fill={f.bands[0]} />
          <polygon points="30,0 30,20 0,20" fill={f.bands[1]} />
        </>
      ) : (
        f.bands.map((c, i) =>
          f.dir === 'h' ? <rect key={i} x="0" y={(20 / n) * i} width="30" height={20 / n + 0.1} fill={c} /> : <rect key={i} x={(30 / n) * i} y="0" width={30 / n + 0.1} height="20" fill={c} />,
        )
      )}
      <text x="15" y="14.6" textAnchor="middle" fontSize="12" fill={f.ec} fontFamily="sans-serif">
        {f.emblem}
      </text>
      <rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="0.8" />
    </svg>
  );
}

/** 나라 id → 국기 그림(아이콘 자리에 그대로 씀) */
export const FLAG: Record<string, ReactNode> = Object.fromEntries(Object.keys(FLAG_DEF).map((id) => [id, <Flag key={id} id={id} />]));
