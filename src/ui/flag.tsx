// 국기(11-23 대장 결정: 실제 국기 모양). 그림 파일 없이 30×20 SVG로 단순하게 그림.
// FLAG_DEF.bands 는 본부 지도 깃발·우리 나라 색으로도 씀.
import type { ReactNode } from 'react';

interface FlagDef {
  /** 대표 색(본부 지도의 작은 깃발 띠) */
  bands: string[];
  /** 우리 나라 대표 색(본부 지도) */
  color: string;
}

export const FLAG_DEF: Record<string, FlagDef> = {
  us: { bands: ['#b22234', '#f8fafc', '#3c3b6e'], color: '#3c3b6e' },
  cn: { bands: ['#de2910', '#de2910'], color: '#de2910' },
  ru: { bands: ['#f8fafc', '#0039a6', '#d52b1e'], color: '#0039a6' },
  de: { bands: ['#111111', '#dd0000', '#ffce00'], color: '#dd0000' },
  jp: { bands: ['#f8fafc', '#bc002d', '#f8fafc'], color: '#bc002d' },
  uk: { bands: ['#012169', '#f8fafc', '#c8102e'], color: '#012169' },
  in: { bands: ['#ff9933', '#f8fafc', '#138808'], color: '#ff9933' },
  kr: { bands: ['#f8fafc', '#cd2e3a', '#0047a0'], color: '#0047a0' },
  tr: { bands: ['#e30a17', '#e30a17'], color: '#e30a17' },
  il: { bands: ['#f8fafc', '#0038b8', '#f8fafc'], color: '#0038b8' },
  ir: { bands: ['#239f40', '#f8fafc', '#da0000'], color: '#239f40' },
  ua: { bands: ['#0057b7', '#ffd700'], color: '#0057b7' },
  kp: { bands: ['#024fa2', '#ed1c27', '#024fa2'], color: '#ed1c27' },
};

const star = (cx: number, cy: number, r: number, rot = 0) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = ((i * 36 + rot - 90) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.4 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

const H3 = (cs: string[]) => cs.map((c, i) => <rect key={i} x="0" y={(20 / cs.length) * i} width="30" height={20 / cs.length + 0.1} fill={c} />);

/** 나라별 국기 그림(viewBox 0 0 30 20) */
const DRAW: Record<string, () => ReactNode> = {
  us: () => (
    <>
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x="0" y={(20 / 13) * i} width="30" height={20 / 13 + 0.05} fill={i % 2 ? '#f8fafc' : '#b22234'} />
      ))}
      <rect x="0" y="0" width="12" height={(20 / 13) * 7} fill="#3c3b6e" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={1.6 + (i % 4) * 2.9} cy={1.6 + Math.floor(i / 4) * 2.9} r="0.55" fill="#f8fafc" />
      ))}
    </>
  ),
  cn: () => (
    <>
      <rect width="30" height="20" fill="#de2910" />
      <polygon points={star(5, 5, 3)} fill="#ffde00" />
      {[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y], i) => (
        <polygon key={i} points={star(x, y, 1, 20 * i)} fill="#ffde00" />
      ))}
    </>
  ),
  ru: () => H3(['#f8fafc', '#0039a6', '#d52b1e']),
  de: () => H3(['#111111', '#dd0000', '#ffce00']),
  jp: () => (
    <>
      <rect width="30" height="20" fill="#f8fafc" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
    </>
  ),
  uk: () => (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#f8fafc" strokeWidth="4" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#c8102e" strokeWidth="1.3" />
      <path d="M15,0 V20 M0,10 H30" stroke="#f8fafc" strokeWidth="6" />
      <path d="M15,0 V20 M0,10 H30" stroke="#c8102e" strokeWidth="3.4" />
    </>
  ),
  in: () => (
    <>
      {H3(['#ff9933', '#f8fafc', '#138808'])}
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.6" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </>
  ),
  kr: () => (
    <>
      <rect width="30" height="20" fill="#f8fafc" />
      <g transform="rotate(33.7 15 10)">
        <path d="M10,10 A5,5 0 0 1 20,10 Z" fill="#cd2e3a" />
        <path d="M10,10 A5,5 0 0 0 20,10 Z" fill="#0047a0" />
        <circle cx="12.5" cy="10" r="2.5" fill="#cd2e3a" />
        <circle cx="17.5" cy="10" r="2.5" fill="#0047a0" />
      </g>
      {[[5, 4, -33.7], [25, 16, -33.7], [25, 4, 33.7], [5, 16, 33.7]].map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y})`}>
          {[-1.4, 0, 1.4].map((d) => (
            <rect key={d} x={x + d - 0.45} y={y - 2.2} width="0.9" height="4.4" fill="#111" />
          ))}
        </g>
      ))}
    </>
  ),
  tr: () => (
    <>
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="11" cy="10" r="5" fill="#f8fafc" />
      <circle cx="12.3" cy="10" r="4" fill="#e30a17" />
      <polygon points={star(18, 10, 2.2, -18)} fill="#f8fafc" />
    </>
  ),
  il: () => (
    <>
      <rect width="30" height="20" fill="#f8fafc" />
      <rect x="0" y="2" width="30" height="2.6" fill="#0038b8" />
      <rect x="0" y="15.4" width="30" height="2.6" fill="#0038b8" />
      <polygon points="15,6.2 18.3,12 11.7,12" fill="none" stroke="#0038b8" strokeWidth="0.8" />
      <polygon points="15,13.8 18.3,8 11.7,8" fill="none" stroke="#0038b8" strokeWidth="0.8" />
    </>
  ),
  ir: () => (
    <>
      {H3(['#239f40', '#f8fafc', '#da0000'])}
      <circle cx="15" cy="10" r="2" fill="none" stroke="#da0000" strokeWidth="0.8" />
      <rect x="14.6" y="7.6" width="0.8" height="4.8" fill="#da0000" />
    </>
  ),
  ua: () => H3(['#0057b7', '#ffd700']),
  kp: () => (
    <>
      <rect width="30" height="20" fill="#024fa2" />
      <rect x="0" y="3.3" width="30" height="13.4" fill="#f8fafc" />
      <rect x="0" y="4" width="30" height="12" fill="#ed1c27" />
      <circle cx="10" cy="10" r="4" fill="#f8fafc" />
      <polygon points={star(10, 10, 3.8)} fill="#ed1c27" />
    </>
  ),
};

export function Flag({ id, size = 1 }: { id: string; size?: number }) {
  const draw = DRAW[id];
  if (!draw) return <span>🏳️</span>;
  return (
    <svg className="flag" width={30 * size} height={20 * size} viewBox="0 0 30 20" role="img" aria-label="국기">
      {draw()}
      <rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="0.8" />
    </svg>
  );
}

/** 나라 id → 국기 그림(아이콘 자리에 그대로 씀) */
export const FLAG: Record<string, ReactNode> = Object.fromEntries(Object.keys(FLAG_DEF).map((id) => [id, <Flag key={id} id={id} />]));
