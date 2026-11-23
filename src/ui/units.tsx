// 움직이는 군 장비 그림(임시 도형, 위에서 본 모습). 모두 +x 방향(오른쪽)을 보고 있어 animateMotion rotate="auto"로 진행 방향을 봄.
// s = 크기 배율. 나중에 제작 이미지로 바꿀 자리.

/** 항공모함: 긴 비행갑판 + 각진 착륙 갑판 + 오른쪽 함교 */
export function Carrier({ s = 1, color = '#9ca3af' }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`}>
      {/* 물보라 */}
      <path d="M-13,-2.5 L-24,-5 M-13,2.5 L-24,5" stroke="#e0f2fe" strokeWidth="0.9" opacity="0.7" />
      <path d="M-12,-3 L9,-3 L13,0 L9,3 L-12,3 Z" fill="#4b5563" stroke="#1f2937" strokeWidth="0.4" />
      <path d="M-11,-3.6 L6,-3.6 L10,-1 L6,2.2 L-11,2.2 Z" fill="#6b7280" />
      {/* 갑판 선 */}
      <path d="M-10,-1.2 L7,-1.2" stroke="#e5e7eb" strokeWidth="0.35" strokeDasharray="1 0.8" />
      <path d="M-10,0.8 L-2,-2.8" stroke="#fde047" strokeWidth="0.3" />
      {/* 함교 */}
      <rect x="1" y="2" width="3" height="1.6" fill={color} stroke="#111827" strokeWidth="0.3" />
      {/* 갑판 위 비행기 */}
      <path d="M-8,-2.4 l1.4,0 M-6,-2.4 l1.4,0 M-4,-2.4 l1.4,0" stroke="#d1d5db" strokeWidth="0.6" />
    </g>
  );
}

/** 호위함·구축함 */
export function Escort({ s = 1, color = '#9ca3af' }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M-7,-1.4 L-13,-3 M-7,1.4 L-13,3" stroke="#e0f2fe" strokeWidth="0.6" opacity="0.6" />
      <path d="M-6,-1.4 L4,-1.4 L7,0 L4,1.4 L-6,1.4 Z" fill="#64748b" stroke="#1e293b" strokeWidth="0.3" />
      <rect x="-2" y="-0.8" width="3" height="1.6" fill={color} />
    </g>
  );
}

/** 최신 전투기(델타익 + 꼬리날개) + 비행운 */
export function Jet({ s = 1, color = '#cbd5e1', trail = true }: { s?: number; color?: string; trail?: boolean }) {
  return (
    <g transform={`scale(${s})`}>
      {trail && <path d="M-4,-0.7 L-26,-0.7 M-4,0.7 L-26,0.7" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.6" />}
      <path d="M5,0 L-1,-3.6 L-3,-3.6 L-2,-0.8 L-4,-0.8 L-5,-2.2 L-5.6,-2.2 L-5,0 L-5.6,2.2 L-5,2.2 L-4,0.8 L-2,0.8 L-3,3.6 L-1,3.6 Z" fill={color} stroke="#0f172a" strokeWidth="0.3" />
      <circle cx="-5.4" cy="0" r="0.7" fill="#fb923c" className="afterburner" />
    </g>
  );
}

/** 잠수함: 길쭉한 선체 + 함교탑(반쯤 잠김) */
export function Sub({ s = 1, color = '#9ca3af' }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`} opacity="0.85">
      <path d="M-7,0 L-12,-1.5 M-7,0 L-12,1.5" stroke="#e0f2fe" strokeWidth="0.5" opacity="0.5" />
      <ellipse cx="0" cy="0" rx="7" ry="1.3" fill="#1f2937" stroke="#0f172a" strokeWidth="0.3" />
      <rect x="0" y="-0.7" width="2" height="1.4" rx="0.4" fill={color} />
    </g>
  );
}

/** 폭격기: 넓은 후퇴익 */
export function Bomber({ s = 1, color = '#cbd5e1' }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M-5,-0.6 L-22,-0.6 M-5,0.6 L-22,0.6" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.6" />
      <path d="M6,0 L1,-1 L-2,-7 L-4,-7 L-3,-1 L-6,-1 L-7,-3 L-8,-3 L-7.4,0 L-8,3 L-7,3 L-6,1 L-3,1 L-4,7 L-2,7 L1,1 Z" fill={color} stroke="#0f172a" strokeWidth="0.3" />
    </g>
  );
}

/** 무인 드론: 긴 날개 + 가는 몸통 */
export function Drone({ s = 1, color = '#cbd5e1' }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M3,0 L-4,0" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M0,-5 L-1,0 L0,5" fill="none" stroke={color} strokeWidth="0.9" />
      <path d="M-4,-1.6 L-3.4,0 L-4,1.6" fill="none" stroke={color} strokeWidth="0.6" />
    </g>
  );
}

/** 공격헬기: 몸통 + 도는 회전날개 */
export function Heli({ s = 1, color = '#cbd5e1' }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx="0.5" cy="0" rx="2.6" ry="1.1" fill={color} stroke="#0f172a" strokeWidth="0.3" />
      <path d="M-2,0 L-6,0" stroke={color} strokeWidth="0.6" />
      <g className="rotor">
        <path d="M-4,-0.3 L5,0.3 M0.5,-4.5 L0.5,4.5" stroke="#e5e7eb" strokeOpacity="0.8" strokeWidth="0.4" />
      </g>
    </g>
  );
}

/** 전차: 차체 + 포탑 + 긴 포신 */
export function Tank({ s = 1, color = '#9ca3af' }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x="-3.5" y="-2.2" width="7" height="4.4" rx="0.6" fill="#374151" stroke="#111827" strokeWidth="0.3" />
      <circle cx="0" cy="0" r="1.5" fill={color} stroke="#111827" strokeWidth="0.3" />
      <path d="M1.2,0 L6,0" stroke="#111827" strokeWidth="0.7" />
    </g>
  );
}

/** 군용 트럭·미사일 발사차 */
export function Truck({ s = 1, color = '#9ca3af', missile = false }: { s?: number; color?: string; missile?: boolean }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x="-4" y="-1.6" width="6" height="3.2" fill="#4b5563" stroke="#111827" strokeWidth="0.3" />
      <rect x="2.2" y="-1.4" width="2" height="2.8" fill={color} stroke="#111827" strokeWidth="0.3" />
      {missile && <path d="M-3.6,0 L1.6,0" stroke="#e5e7eb" strokeWidth="1" strokeLinecap="round" />}
    </g>
  );
}
