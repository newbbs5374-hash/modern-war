// 장면 그림(11/24 B): 사진첩·뉴스·큰 사건 팝업 위쪽 그림. src/assets/scenes/scene-<이름>-day.webp / -night.webp
// 그림이 없으면 아이콘과 색 바탕으로 그림. 명령문: /mnt/project-files/guides/expand-art-prompts.md
const FILES = import.meta.glob('../assets/scenes/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [p, u] of Object.entries(FILES)) URLS[p.split('/').pop()!.replace(/\.[^.]+$/, '')] = u;

export const SCENES: Record<string, { name: string; icon: string; bg: string }> = {
  press: { name: '기자회견', icon: '🎙️', bg: 'linear-gradient(135deg,#1e3a5f,#3fb8c9)' },
  assembly: { name: '국회 본회의', icon: '🏛️', bg: 'linear-gradient(135deg,#3b2f5f,#7c6fd6)' },
  summit: { name: '정상회담', icon: '🤝', bg: 'linear-gradient(135deg,#1f4b3a,#3fc98a)' },
  disaster: { name: '재난 현장', icon: '🚒', bg: 'linear-gradient(135deg,#5f2a1e,#f97316)' },
  protest: { name: '대규모 집회', icon: '🪧', bg: 'linear-gradient(135deg,#5f1e2e,#ef4444)' },
  ceremony: { name: '기념식', icon: '🎉', bg: 'linear-gradient(135deg,#5f4a1e,#ffb020)' },
  parade: { name: '열병식', icon: '🎖️', bg: 'linear-gradient(135deg,#2f3b1e,#84cc16)' },
  signing: { name: '서명식', icon: '✍️', bg: 'linear-gradient(135deg,#2c3e50,#94a3b8)' },
  groundbreak: { name: '착공식', icon: '🏗️', bg: 'linear-gradient(135deg,#4a3b1e,#eab308)' },
  launch: { name: '발사 현장', icon: '🚀', bg: 'linear-gradient(135deg,#0f172a,#6366f1)' },
  factory: { name: '공장 시찰', icon: '🏭', bg: 'linear-gradient(135deg,#334155,#64748b)' },
  meeting: { name: '대표 면담', icon: '🤝', bg: 'linear-gradient(135deg,#334155,#3fb8c9)' },
  strike: { name: '파업 현장', icon: '👷', bg: 'linear-gradient(135deg,#5f3b1e,#f59e0b)' },
  hospital: { name: '병원 방문', icon: '🏥', bg: 'linear-gradient(135deg,#1e5f5a,#5eead4)' },
  school: { name: '학교 방문', icon: '🏫', bg: 'linear-gradient(135deg,#1e3f5f,#60a5fa)' },
  port: { name: '군항', icon: '⚓', bg: 'linear-gradient(135deg,#0c2a4a,#0ea5e9)' },
  airbase: { name: '공군 기지', icon: '🛩️', bg: 'linear-gradient(135deg,#1e293b,#38bdf8)' },
  cabinet: { name: '국무회의', icon: '🗂️', bg: 'linear-gradient(135deg,#2e2a24,#a8a29e)' },
  victory: { name: '승전 행사', icon: '🏆', bg: 'linear-gradient(135deg,#5f4a1e,#fde047)' },
  rally: { name: '유세 현장', icon: '📣', bg: 'linear-gradient(135deg,#4a1e5f,#d946ef)' },
};
export function sceneArt(scene: string, night: boolean): string | null {
  return URLS[`scene-${scene}-${night ? 'night' : 'day'}`] ?? URLS[`scene-${scene}-day`] ?? URLS[`scene-${scene}`] ?? null;
}
