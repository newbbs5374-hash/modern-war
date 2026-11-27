// 수행비서(11-24 대장 지시 "수행비서는 20대 여성으로 고정"): 나라마다 정해진 한 사람. 판이 바뀌어도 같은 사람.
// 얼굴 그림 secretary-<나라>.webp(없으면 기본 부관 그림 aide.webp). 국정 보고서·부관이 없을 때 보고를 맡음.
export interface Secretary {
  name: string;
  age: number;
}
export const SECRETARY: Record<string, Secretary> = {
  kr: { name: '윤서아', age: 27 },
  kp: { name: '리은별', age: 26 },
  jp: { name: '사토 미유', age: 26 },
  cn: { name: '린샤오위', age: 27 },
  us: { name: '에밀리 브룩스', age: 27 },
  uk: { name: '올리비아 헤이스', age: 26 },
  de: { name: '레나 포크트', age: 27 },
  ru: { name: '아나스타시야 소콜로바', age: 26 },
  ua: { name: '다리나 멜니크', age: 25 },
  in: { name: '아나냐 메흐라', age: 27 },
  ir: { name: '야사민 라히미', age: 26 },
  il: { name: '노아 샤피라', age: 25 },
  tr: { name: '엘리프 아이든', age: 27 },
  tw: { name: '천위팅', age: 26 },
  pl: { name: '조피아 노바크', age: 25 },
  ph: { name: '안젤리카 레예스', age: 26 },
  pk: { name: '아이만 쿠레시', age: 27 },
  sa: { name: '리마 알하르비', age: 26 },
  // 11-27 새 나라 18개
  eg: { name: '나디아 하산', age: 26 },
  ng: { name: '치오마 오코예', age: 25 },
  za: { name: '레라토 몰로이', age: 26 },
  et: { name: '하나 테스파예', age: 25 },
  dz: { name: '야스미나 브라히미', age: 27 },
  br: { name: '줄리아나 소자', age: 26 },
  ar: { name: '루시아 페르난데스', age: 25 },
  co: { name: '발렌티나 오르티스', age: 26 },
  ve: { name: '다니엘라 멘도사', age: 25 },
  cl: { name: '카밀라 무뇨스', age: 27 },
  au: { name: '에밀리 하퍼', age: 26 },
  ca: { name: '클로에 고티에', age: 25 },
  mx: { name: '사라 가르시아', age: 26 },
  fr: { name: '레아 마르탱', age: 26 },
  it: { name: '줄리아 콘티', age: 25 },
  es: { name: '마리아 로페스', age: 27 },
  gr: { name: '엘레니 파파스', age: 26 },
  fi: { name: '아이노 코르호넨', age: 25 },
};
export const secretaryOf = (country: string): Secretary => SECRETARY[country] ?? SECRETARY.kr;
/** 얼굴 그림 이름(앞에서부터 있는 것) */
export const secretaryKeys = (country: string) => [`secretary-${country}`, 'aide'];
