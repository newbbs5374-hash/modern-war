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
  tw: { bands: ['#000095', '#fe0000', '#fe0000'], color: '#fe0000' },
  pl: { bands: ['#f8fafc', '#dc143c'], color: '#dc143c' },
  ph: { bands: ['#0038a8', '#f8fafc', '#ce1126'], color: '#0038a8' },
  pk: { bands: ['#f8fafc', '#01411c', '#01411c'], color: '#01411c' },
  sa: { bands: ['#006c35', '#006c35'], color: '#006c35' },
  // 11-27 새 나라 18개
  eg: { bands: ['#ce1126', '#f8fafc', '#111111'], color: '#ce1126' },
  ng: { bands: ['#008751', '#f8fafc', '#008751'], color: '#008751' },
  za: { bands: ['#e03c31', '#007749', '#001489'], color: '#007749' },
  et: { bands: ['#078930', '#fcdd09', '#da121a'], color: '#078930' },
  dz: { bands: ['#006233', '#f8fafc', '#d21034'], color: '#006233' },
  br: { bands: ['#009c3b', '#ffdf00', '#002776'], color: '#009c3b' },
  ar: { bands: ['#74acdf', '#f8fafc', '#74acdf'], color: '#74acdf' },
  co: { bands: ['#fcd116', '#003893', '#ce1126'], color: '#fcd116' },
  ve: { bands: ['#ffcc00', '#00247d', '#cf142b'], color: '#cf142b' },
  cl: { bands: ['#0039a6', '#f8fafc', '#d52b1e'], color: '#d52b1e' },
  au: { bands: ['#00008b', '#f8fafc', '#e4002b'], color: '#00008b' },
  ca: { bands: ['#d80621', '#f8fafc', '#d80621'], color: '#d80621' },
  mx: { bands: ['#006847', '#f8fafc', '#ce1126'], color: '#006847' },
  fr: { bands: ['#0055a4', '#f8fafc', '#ef4135'], color: '#0055a4' },
  it: { bands: ['#009246', '#f8fafc', '#ce2b37'], color: '#009246' },
  es: { bands: ['#aa151b', '#f1bf00', '#aa151b'], color: '#aa151b' },
  gr: { bands: ['#0d5eaf', '#f8fafc', '#0d5eaf'], color: '#0d5eaf' },
  fi: { bands: ['#f8fafc', '#002f6c', '#f8fafc'], color: '#002f6c' },
};

const star = (cx: number, cy: number, r: number, rot = 0) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = ((i * 36 + rot - 90) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.4 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

/** 해 모양(뾰족한 빛 n개) */
const sun = (cx: number, cy: number, r: number, r2: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = ((i * 180) / n - 90) * (Math.PI / 180);
    const rr = i % 2 ? r2 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

const V3 = (cs: string[]) => cs.map((c, i) => <rect key={i} x={(30 / cs.length) * i} y="0" width={30 / cs.length + 0.1} height="20" fill={c} />);
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
  // 11-26 새 나라
  tw: () => (
    <>
      <rect width="30" height="20" fill="#fe0000" />
      <rect width="15" height="10" fill="#000095" />
      <polygon points={sun(7.5, 5, 3.6, 1.9, 12)} fill="#f8fafc" />
      <circle cx="7.5" cy="5" r="1.9" fill="#000095" />
      <circle cx="7.5" cy="5" r="1.55" fill="#f8fafc" />
    </>
  ),
  pl: () => H3(['#f8fafc', '#dc143c']),
  ph: () => (
    <>
      {H3(['#0038a8', '#ce1126'])}
      <polygon points="0,0 17.3,10 0,20" fill="#f8fafc" />
      <polygon points={sun(5.8, 10, 2.6, 1.3, 8)} fill="#fcd116" />
      <circle cx="5.8" cy="10" r="1.3" fill="#fcd116" />
      {[[1.6, 2.6], [1.6, 17.4], [14.6, 10]].map(([x, y], i) => (
        <polygon key={i} points={star(x, y, 1)} fill="#fcd116" />
      ))}
    </>
  ),
  pk: () => (
    <>
      <rect width="30" height="20" fill="#01411c" />
      <rect width="7.5" height="20" fill="#f8fafc" />
      <circle cx="19" cy="10" r="5.2" fill="#f8fafc" />
      <circle cx="20.6" cy="8.8" r="4.5" fill="#01411c" />
      <polygon points={star(22.6, 7.6, 1.6, 12)} fill="#f8fafc" />
    </>
  ),
  sa: () => (
    <>
      <rect width="30" height="20" fill="#006c35" />
      <path d="M7,6.5 Q9,4.5 11,6.5 T15,6.5 T19,6.5 T23,6.5 M8,9.5 Q10.5,7.8 13,9.5 T18,9.5 T22,9.5" stroke="#f8fafc" strokeWidth="0.8" fill="none" />
      <path d="M7.5,14 H22 M20.5,13 L22.8,14 L20.5,15" stroke="#f8fafc" strokeWidth="0.9" fill="none" />
    </>
  ),
  // 11-27 새 나라 18개
  eg: () => (
    <>
      {H3(['#ce1126', '#f8fafc', '#111111'])}
      <path d="M15,7.6 L16.4,9 L16,11.6 L15,12.4 L14,11.6 L13.6,9 Z" fill="#c09300" />
    </>
  ),
  ng: () => V3(['#008751', '#f8fafc', '#008751']),
  za: () => (
    <>
      <rect width="30" height="10" fill="#e03c31" />
      <rect y="10" width="30" height="10" fill="#001489" />
      <path d="M0,0 L11,10 L0,20 Z M11,10 H30" stroke="#f8fafc" strokeWidth="6.6" fill="none" />
      <path d="M0,0 L11,10 L0,20 M11,10 H30" stroke="#007749" strokeWidth="4" fill="none" />
      <path d="M0,2.6 L8.2,10 L0,17.4 Z" fill="#ffb612" />
      <path d="M0,4.2 L6.4,10 L0,15.8 Z" fill="#111111" />
    </>
  ),
  et: () => (
    <>
      {H3(['#078930', '#fcdd09', '#da121a'])}
      <circle cx="15" cy="10" r="4" fill="#0f47af" />
      <polygon points={star(15, 10, 2.8)} fill="none" stroke="#fcdd09" strokeWidth="0.5" />
    </>
  ),
  dz: () => (
    <>
      <rect width="15" height="20" fill="#006233" />
      <rect x="15" width="15" height="20" fill="#f8fafc" />
      <path d="M19.11,7.15 A5,5 0 1,0 19.11,12.85 A4,4 0 1,1 19.11,7.15 Z" fill="#d21034" />
      <polygon points={star(18.4, 10, 1.6, -18)} fill="#d21034" />
    </>
  ),
  br: () => (
    <>
      <rect width="30" height="20" fill="#009c3b" />
      <polygon points="15,2 28,10 15,18 2,10" fill="#ffdf00" />
      <circle cx="15" cy="10" r="4.4" fill="#002776" />
      <path d="M10.8,9 Q15,8 19.2,10.6" stroke="#f8fafc" strokeWidth="0.7" fill="none" />
    </>
  ),
  ar: () => (
    <>
      {H3(['#74acdf', '#f8fafc', '#74acdf'])}
      <polygon points={sun(15, 10, 2.6, 1.6, 16)} fill="#f6b40e" />
      <circle cx="15" cy="10" r="1.5" fill="#f6b40e" />
    </>
  ),
  co: () => (
    <>
      <rect width="30" height="10" fill="#fcd116" />
      <rect y="10" width="30" height="5" fill="#003893" />
      <rect y="15" width="30" height="5" fill="#ce1126" />
    </>
  ),
  ve: () => (
    <>
      {H3(['#ffcc00', '#00247d', '#cf142b'])}
      {Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI * (0.86 - (0.72 * i) / 7);
        return <polygon key={i} points={star(15 + 5.2 * Math.cos(a), 12.2 - 5.2 * Math.sin(a), 0.7)} fill="#f8fafc" />;
      })}
    </>
  ),
  cl: () => (
    <>
      <rect width="30" height="10" fill="#f8fafc" />
      <rect y="10" width="30" height="10" fill="#d52b1e" />
      <rect width="10" height="10" fill="#0039a6" />
      <polygon points={star(5, 5, 2.4)} fill="#f8fafc" />
    </>
  ),
  au: () => (
    <>
      <rect width="30" height="20" fill="#00008b" />
      <path d="M0,0 L15,10 M15,0 L0,10" stroke="#f8fafc" strokeWidth="2" />
      <path d="M0,0 L15,10 M15,0 L0,10" stroke="#e4002b" strokeWidth="0.8" />
      <path d="M7.5,0 V10 M0,5 H15" stroke="#f8fafc" strokeWidth="3" />
      <path d="M7.5,0 V10 M0,5 H15" stroke="#e4002b" strokeWidth="1.6" />
      <polygon points={star(7.5, 15, 2.2)} fill="#f8fafc" />
      {[[22.5, 4], [19.5, 9], [25.5, 8.5], [22.5, 16.5]].map(([x, y], i) => (
        <polygon key={i} points={star(x, y, 1.1)} fill="#f8fafc" />
      ))}
    </>
  ),
  ca: () => (
    <>
      <rect width="30" height="20" fill="#f8fafc" />
      <rect width="7.5" height="20" fill="#d80621" />
      <rect x="22.5" width="7.5" height="20" fill="#d80621" />
      <polygon points={star(15, 9.4, 4.4, 0)} fill="#d80621" />
      <rect x="14.6" y="12" width="0.8" height="3.6" fill="#d80621" />
    </>
  ),
  mx: () => (
    <>
      {V3(['#006847', '#f8fafc', '#ce1126'])}
      <circle cx="15" cy="10" r="2.6" fill="#8c5a2b" />
      <path d="M12.6,11.4 Q15,13.6 17.4,11.4" stroke="#006847" strokeWidth="0.7" fill="none" />
    </>
  ),
  fr: () => V3(['#0055a4', '#f8fafc', '#ef4135']),
  it: () => V3(['#009246', '#f8fafc', '#ce2b37']),
  es: () => (
    <>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
      <rect x="7" y="7.6" width="3" height="4.6" rx="0.6" fill="#aa151b" />
    </>
  ),
  gr: () => (
    <>
      {H3(['#0d5eaf', '#f8fafc', '#0d5eaf', '#f8fafc', '#0d5eaf', '#f8fafc', '#0d5eaf', '#f8fafc', '#0d5eaf'])}
      <rect width="11.1" height="11.1" fill="#0d5eaf" />
      <rect x="4.45" width="2.2" height="11.1" fill="#f8fafc" />
      <rect y="4.45" width="11.1" height="2.2" fill="#f8fafc" />
    </>
  ),
  fi: () => (
    <>
      <rect width="30" height="20" fill="#f8fafc" />
      <rect x="8" width="5" height="20" fill="#002f6c" />
      <rect y="7.5" width="30" height="5" fill="#002f6c" />
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
