// 본부 오른쪽 아이콘·아래 메뉴 아이콘 그림 칸(11-24). 그림 src/assets/icons/icon-ui-<key>.webp 가 있으면 그림, 없으면 이모지.
// 명령문: /mnt/project-files/guides/ui-icon-prompts.md (= src/assets/icons/UI-ICONS.md)
import { iconArt } from './iconArt';

/** 화면 이름·버튼 이름 → 그림 이름표 */
export const UI_ICON_KEY: Record<string, string> = {
  본부: 'home', 개인: 'personal', 국방: 'defense', 외교: 'diplo', 사회: 'society', 경제: 'economy', 문화: 'culture', 상점: 'shop',
  대화: 'talk', 부관: 'aide', 명령: 'orders', 대전투: 'grand', 전령: 'herald', 도감: 'codex', '국정 보고': 'briefing', 시험: 'test',
};

export function UiIcon({ label, emoji }: { label: string; emoji: string }) {
  const k = UI_ICON_KEY[label];
  const url = k ? iconArt(`icon-ui-${k}`) : null;
  return url ? <img className="ui-ico" src={url} alt="" draggable={false} /> : <span className="ui-emo">{emoji}</span>;
}

/** 큰 수를 k로 짧게(대장 요청: k 단위). 12,345 → 12.3k · 200,521 → 200k · 2,004,859 → 2,004k */
export function fmtK(n: number): string {
  const v = Math.floor(n);
  if (Math.abs(v) < 1000) return String(v);
  if (Math.abs(v) < 100_000) return `${(Math.trunc(v / 100) / 10).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.trunc(v / 1000).toLocaleString('en-US')}k`;
}
