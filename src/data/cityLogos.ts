// 도시 상징(로고·문장·휘장). 그림은 src/assets/logos/logo-<key>.webp (96px) 이름으로 넣으면 도시 카드에 바로 나옴.
// 아래 file 은 위키미디어 공용(commons.wikimedia.org)의 파일 이름. 11/24 라이선스 확인: CC BY-SA 3.0 2개(런던·버밍엄, 출처 표기 필요) 말고는 모두 공공 저작물(Public domain)·CC0.
// 그림이 없는 도시(중국·인도 일부·이란 일부·튀르키예 일부·북한)는 코드로 그린 방패 표지가 나옴.

export interface CityLogoSrc {
  key: string;
  /** 위키미디어 공용 파일 이름 (없으면 공개된 상징을 못 찾은 도시) */
  file?: string;
  lic?: 'PD' | 'CC0' | 'CC BY-SA 3.0';
  /** 어떤 표지인지 */
  kind?: '로고' | '휘장' | '문장' | '인장' | '시기';
}

export const CITY_LOGO: Record<string, CityLogoSrc> = {
  서울: { key: 'seoul', file: 'Seal of Seoul, South Korea.svg', lic: 'PD', kind: '휘장' },
  부산: { key: 'busan', file: 'Symbol of Busan (2023–).svg', lic: 'PD', kind: '휘장' },
  대구: { key: 'daegu', file: 'Symbol of Daegu.svg', lic: 'PD', kind: '휘장' },
  광주: { key: 'gwangju', file: 'Emblem of Gwangju.svg', lic: 'PD', kind: '휘장' },
  대전: { key: 'daejeon', file: 'Emblem of Daejeon.svg', lic: 'PD', kind: '휘장' },
  전주: { key: 'jeonju', file: 'Flag of Jeonju.svg', lic: 'PD', kind: '시기' },
  강릉: { key: 'gangneung', file: 'Gangneung City Logo.svg', lic: 'PD', kind: '로고' },
  제주: { key: 'jeju', file: 'Flag of Jeju City (2000-2006).svg', lic: 'PD', kind: '시기' },
  여수: { key: 'yeosu', file: 'Flag of Yeosu.svg', lic: 'PD', kind: '시기' },
  순천: { key: 'suncheon', file: 'Flag of Suncheon (2001-2024).svg', lic: 'PD', kind: '시기' },
  익산: { key: 'iksan', file: 'Flag of Iksan.svg', lic: 'PD', kind: '시기' },
  워싱턴: { key: 'washington', file: 'Seal of the District of Columbia.svg', lic: 'PD', kind: '인장' },
  뉴욕: { key: 'newyork', file: 'Seal of New York City.svg', lic: 'PD', kind: '인장' },
  샌프란시스코: { key: 'sanfrancisco', file: 'Seal of San Francisco.svg', lic: 'PD', kind: '인장' },
  호놀룰루: { key: 'honolulu', file: 'Seal of Honolulu, Hawaii.svg', lic: 'PD', kind: '인장' },
  덴버: { key: 'denver', file: 'Seal of Denver, Colorado.svg', lic: 'PD', kind: '인장' },
  피닉스: { key: 'phoenix', file: 'Flag of Phoenix, Arizona.svg', lic: 'PD', kind: '시기' },
  피츠버그: { key: 'pittsburgh', file: 'Coat of arms of Pittsburgh, Pennsylvania.svg', lic: 'PD', kind: '문장' },
  휴스턴: { key: 'houston', file: 'Seal of Houston, Texas.svg', lic: 'PD', kind: '인장' },
  베이징: { key: 'beijing' },
  톈진: { key: 'tianjin' },
  광저우: { key: 'guangzhou' },
  선전: { key: 'shenzhen' },
  바오터우: { key: 'baotou' },
  우한: { key: 'wuhan' },
  란저우: { key: 'lanzhou' },
  상하이: { key: 'shanghai' },
  모스크바: { key: 'moscow', file: 'Coat of arms of Moscow.svg', lic: 'PD', kind: '문장' },
  상트페테르부르크: { key: 'stpetersburg', file: 'Coat of arms of Saint Petersburg (2003).svg', lic: 'PD', kind: '문장' },
  튜멘: { key: 'tyumen', file: 'Coat of Arms of Tyumen.svg', lic: 'PD', kind: '문장' },
  무르만스크: { key: 'murmansk', file: 'RUS Murmansk COA.svg', lic: 'PD', kind: '문장' },
  예카테린부르크: { key: 'yekaterinburg', file: 'Coat of Arms of Yekaterinburg (Sverdlovsk oblast).svg', lic: 'PD', kind: '문장' },
  아르한겔스크: { key: 'arkhangelsk', file: 'Coat of Arms of Arkhangelsk.svg', lic: 'PD', kind: '문장' },
  노릴스크: { key: 'norilsk', file: 'Coat of arms of Norilsk, Krasnoyarsk Krai.svg', lic: 'PD', kind: '문장' },
  야쿠츠크: { key: 'yakutsk', file: 'Coat of Arms of Yakutsk (Yakutia) 2012.jpg', lic: 'PD', kind: '문장' },
  블라디보스토크: { key: 'vladivostok', file: 'Coat of Arms of Vladivostok.svg', lic: 'PD', kind: '문장' },
  노보시비르스크: { key: 'novosibirsk', file: 'Coat of Arms of Novosibirsk.svg', lic: 'PD', kind: '문장' },
  베를린: { key: 'berlin', file: 'DEU Berlin COA.svg', lic: 'PD', kind: '문장' },
  함부르크: { key: 'hamburg', file: 'DEU Hamburg COA.svg', lic: 'PD', kind: '문장' },
  도쿄: { key: 'tokyo', file: 'Emblem of Tokyo Metropolis.svg', lic: 'PD', kind: '휘장' },
  후쿠오카: { key: 'fukuoka', file: 'Emblem of Fukuoka, Fukuoka.svg', lic: 'PD', kind: '휘장' },
  런던: { key: 'london', file: 'Coat of Arms of The City of London.svg', lic: 'CC BY-SA 3.0', kind: '문장' },
  버밍엄: { key: 'birmingham', file: 'Coat of arms of Birmingham.svg', lic: 'CC BY-SA 3.0', kind: '문장' },
  뉴델리: { key: 'newdelhi' },
  콜카타: { key: 'kolkata' },
  벵갈루루: { key: 'bengaluru' },
  첸나이: { key: 'chennai', file: 'Chennai Corporation Emblem.png', lic: 'PD', kind: '휘장' },
  뭄바이: { key: 'mumbai', file: 'Emblem of Mumbai.png', lic: 'PD', kind: '휘장' },
  앙카라: { key: 'ankara' },
  이스탄불: { key: 'istanbul', file: 'Coat of arms İstanbul.svg', lic: 'PD', kind: '휘장' },
  이즈미르: { key: 'izmir' },
  텔아비브: { key: 'telaviv', file: 'Emblem of Tel Aviv.svg', lic: 'PD', kind: '휘장' },
  하이파: { key: 'haifa', file: 'Coat of arms of Haifa.svg', lic: 'CC0', kind: '문장' },
  테헤란: { key: 'tehran', file: 'لوگو شهرداری تهران.svg', lic: 'PD', kind: '로고' },
  이스파한: { key: 'isfahan' },
  반다르아바스: { key: 'bandarabbas' },
  시라즈: { key: 'shiraz' },
  키이우: { key: 'kyiv', file: 'COA of Kyiv Kurovskyi.svg', lic: 'PD', kind: '문장' },
  하르키우: { key: 'kharkiv', file: 'Coat of arms of Kharkiv.svg', lic: 'PD', kind: '문장' },
  오데사: { key: 'odesa', file: 'Coat of Arms of Odesa.svg', lic: 'PD', kind: '문장' },
  평양: { key: 'pyongyang' },
  남포: { key: 'nampo' },
};
