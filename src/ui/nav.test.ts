import { describe, expect, it } from 'vitest';
import { NAV, legacyRoute } from './nav';

describe('대통령식 메뉴(본부 + 5칸)', () => {
  it('아래 메뉴는 본부·개인·국방·외교·사회·경제 7칸(상점 포함)', () => {
    expect(NAV.map((n) => n.label)).toEqual(['본부', '개인', '국방', '외교', '사회', '경제', '문화', '상점']);
  });
  it('옛 화면·탭 이름은 새 자리로 옮겨 감(기능 빠짐 없음)', () => {
    expect(legacyRoute('ops', 'mission')).toEqual({ screen: 'defense', set: [['defense', 'ops'], ['ops', 'mission']] });
    expect(legacyRoute('ops', 'spy').screen).toBe('defense');
    expect(legacyRoute('officer', 'aides').set).toContainEqual(['personal', 'aides']);
    expect(legacyRoute('officer', 'generals').set).toContainEqual(['defense', 'command']);
    expect(legacyRoute('officer', 'rivals').set).toContainEqual(['society', 'politics']);
    expect(legacyRoute('training').set).toContainEqual(['defense', 'train']);
    expect(legacyRoute('culture', 'win').set).toContainEqual(['personal', 'win']);
    expect(legacyRoute('forces').set).toContainEqual(['defense', 'forces']);
    expect(legacyRoute('nation', 'home').set).toContainEqual(['economy', 'vault']);
    expect(legacyRoute('nation', 'city').set).toContainEqual(['society', 'city']);
    expect(legacyRoute('nation', 'gov').set).toContainEqual(['society', 'gov']);
    expect(legacyRoute('nation', 'fac').set).toContainEqual(['economy', 'facall']);
    expect(legacyRoute('diplo', 'trade').set).toContainEqual(['economy', 'trade']);
    expect(legacyRoute('diplo', 'council').set).toContainEqual(['diplo', 'council']);
    expect(legacyRoute('shop', 'daily')).toEqual({ screen: 'shop', set: [['shop', 'daily']] });
  });
});
