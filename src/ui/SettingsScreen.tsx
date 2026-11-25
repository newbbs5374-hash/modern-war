// 설정 화면(11-23 정리): 한 화면에 — 내 정보 · 저장 · 게임 설정 · 시험 도구(팝업으로 접음) · 새로 시작
import { useState, type ReactNode } from 'react';
import { RANKS } from '../data/ranks';
import { TECHS } from '../data/civ';
import { countryById } from '../data/world';
import { gameClock } from '../game/state';
import { DRILL_MAX, debugAddAide } from '../game/officer';
import { debugTitleUp, nextTitle, titleOf, titleScore } from '../game/title';
import { grantTestResources } from '../game/testgrant';
import { boostsOf } from '../game/boost';
import { debugCrisis } from '../game/crisis';
import { goalsOf } from '../game/goals';
import { guideOf, hideGuide } from '../game/guide';
import { debugTalk } from '../game/talk';
import { civOf, debugAllResearch, debugCouncil, debugFinishDistricts, debugFinishResearch, setCouncilOn } from '../game/civ';
import { Card, HOUR, fmt } from './common';
import { Modal, Tabs, Tile } from './kit';
import { Flag } from './flag';
import { Face, PortraitList } from './Portrait';
import { LEADER_LOOKS, lookName, playerKeys } from '../data/looks';
import { FieldArtList, IconArtList } from './FieldArtList';
import type { ScreenProps } from './screens';
import { CloudCard } from './CloudUI';
import { ErrorLog } from './Safe';

type Pop = null | 'code' | 'time' | 'ops' | 'art' | 'reset' | 'look';
type ArtTab = 'face' | 'field' | 'icon';

/** 켜짐/꺼짐 줄 */
function SwitchRow({ icon, name, sub, on, onClick }: { icon: string; name: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button className={`set-row ${on ? 'is-on' : ''}`} role="switch" aria-checked={on} onClick={onClick}>
      <span className="set-ico">{icon}</span>
      <span className="set-txt">
        <b>{name}</b>
        <small>{sub}</small>
      </span>
      <span className="set-switch" aria-hidden>
        <i />
      </span>
    </button>
  );
}

/** 시험 도구 팝업 안의 버튼 묶음 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="set-group">
      <small className="muted">{title}</small>
      <div className="buttons">{children}</div>
    </div>
  );
}

export function SettingsScreen({ state, speed, actions }: ScreenProps) {
  const [pop, setPop] = useState<Pop>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [artTab, setArtTab] = useState<ArtTab>('face');
  const me = countryById(state.player.countryId);
  const clock = gameClock(state.worldMs);
  const ttl = titleOf(state);
  const civ = civOf(state);
  const guideHidden = guideOf(state).hidden;
  const say = (t: string) => setMsg(t);
  const close = () => setPop(null);

  return (
    <div className="settings">
      <section className="card set-me">
        <span className="set-flag">
          <Flag id={me.id} size={1.4} />
        </span>
        <div className="set-me-main">
          <b>
            {ttl.icon} {ttl.name} {state.player.name}
          </b>
          <small className="muted">
            {me.name} · {clock.year}.{clock.month}.{clock.day} · {clock.dayNumber}일째 · 호칭 점수 {titleScore(state)}
          </small>
        </div>
        <span className="set-auto" title="5초마다, 그리고 창을 닫을 때 이 브라우저에 자동 저장돼요.">
          ✅ 자동 저장
        </span>
      </section>

      <Card icon="💾" title="저장" help="5초마다, 그리고 창을 닫을 때 이 브라우저에 자동 저장돼요. 카카오로 로그인하면 카카오 서버에도 저장돼서 휴대폰·집 PC·회사 PC 어디서 열어도 같은 판이 이어져요(직접 한 일은 몇 초 뒤 올라가고, 창을 다시 열면 다른 기기의 더 나중 진행을 받아 와요). 로그인 없이 옮기려면 '코드 만들기'로 저장 코드를 복사해 그 기기에서 '코드로 불러오기'에 붙여 넣으세요.">
        <CloudCard onSync={actions.cloudSync} />
        <div className="tiles c4">
          <Tile icon="💾" label="지금 저장" onClick={() => (actions.save(), say('저장했어요.'))} />
          <Tile icon="📂" label="불러오기" sub="마지막 저장" onClick={() => (actions.load(), say('마지막 저장을 불러왔어요.'))} />
          <Tile icon="📤" label="코드 만들기" sub="다른 기기용" onClick={() => (setCode(actions.exportCode()), setPop('code'))} />
          <Tile icon="📥" label="코드로" sub="불러오기" onClick={() => (setCode(''), setPop('code'))} />
        </div>
      </Card>

      <Card icon="⚙️" title="게임 설정">
        <div className="set-rows">
          <SwitchRow
            icon="🏛️"
            name="국제 회의"
            sub="고대 성지에서 실제 하루마다 열리는 투표"
            on={civ.council.on}
            onClick={() => actions.apply((s) => setCouncilOn(s, !civOf(s).council.on))}
          />
          <button className="set-row" onClick={() => setPop('look')}>
            <span className="set-ico">🙂</span>
            <span className="set-txt">
              <b>내 얼굴 바꾸기</b>
              <small>{state.player.look ? lookName(state.player.look) : '기본 얼굴'} · 남·여 × 30~60대 8가지</small>
            </span>
            <span className="set-ico">▸</span>
          </button>
          <SwitchRow icon="📘" name="첫 판 안내" sub="본부에 다음 할 일 안내를 띄워요" on={!guideHidden} onClick={() => actions.apply((s) => hideGuide(s, !guideOf(s).hidden))} />
        </div>
      </Card>

      <Card icon="🧪" title="시험 도구" right={<small className="muted">정식판에서는 빠짐</small>}>
        <div className="tiles c4">
          <Tile icon="🎁" label="자원 넉넉히" sub="예산·자원·가속권" tone="gold" onClick={() => (actions.apply(grantTestResources), say('봉급·국방예산·병력·자원·가속권을 넉넉히 넣었어요.'))} />
          <Tile icon="⏩" label="시간·빠르기" sub={speed === 1 ? '보통' : `×${speed}`} onClick={() => setPop('time')} />
          <Tile icon="🛠️" label="운영 시험" sub="연구·호칭·사건" onClick={() => setPop('ops')} />
          <Tile icon="🖼️" label="그림 칸" sub="사진·아이콘" onClick={() => setPop('art')} />
        </div>
        <ErrorLog />
      </Card>

      {msg && (
        <p className="set-msg small" onClick={() => setMsg('')}>
          {msg}
        </p>
      )}

      <button className="danger set-reset" onClick={() => setPop('reset')}>
        🔄 처음부터 새로 시작
      </button>
      <p className="set-foot small muted">현대전 사령관 · 시험판</p>

      {pop === 'look' && (
        <Modal title="내 얼굴 바꾸기" icon="🙂" onClose={close}>
          <div className="look-grid">
            {LEADER_LOOKS.map((l) => (
              <button
                key={l}
                className={`look-tile ${state.player.look === l ? 'on' : ''}`}
                onClick={() => (actions.apply((s) => ({ ...s, player: { ...s.player, look: l } })), say(`얼굴을 ${lookName(l)}(으)로 바꿨어요.`), close())}
              >
                <span className="look-photo">
                  <Face keys={playerKeys({ countryId: state.player.countryId, look: l })} fallback={l[0] === 'm' ? '👨' : '👩'} />
                </span>
                <small>{lookName(l)}</small>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {pop === 'code' && (
        <Modal title="저장 코드" icon="📤" onClose={close}>
          <p className="small muted">코드를 복사해 두면 다른 기기(또는 다른 브라우저)에서 '코드로 불러오기'로 이어 할 수 있어요.</p>
          <textarea className="set-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="여기에 저장 코드를 붙여 넣으세요" />
          <div className="buttons">
            <button onClick={() => setCode(actions.exportCode())}>📤 지금 코드 만들기</button>
            <button
              disabled={!code}
              onClick={() => {
                navigator.clipboard?.writeText(code).then(
                  () => say('저장 코드를 복사했어요.'),
                  () => say('복사가 안 돼요. 글자를 길게 눌러 직접 복사해 주세요.'),
                );
              }}
            >
              📋 복사
            </button>
            <button className="gold" disabled={!code.trim()} onClick={() => (say(actions.importCode(code) ?? '저장 코드로 불러왔어요.'), close())}>
              📥 이 코드로 불러오기
            </button>
          </div>
        </Modal>
      )}

      {pop === 'time' && (
        <Modal title="시간·빠르기 (시험)" icon="⏩" onClose={close}>
          <Group title="시간 건너뛰기">
            <button onClick={() => actions.skip(HOUR)}>+1시간 (게임 1일)</button>
            <button onClick={() => actions.skip(12 * HOUR)}>+12시간</button>
            <button onClick={() => actions.skip(24 * HOUR)}>+실제 1일</button>
            <button onClick={() => actions.skip(7 * 24 * HOUR)}>+실제 1주</button>
          </Group>
          <Group title="시계 빠르기">
            {[1, 60, 3600].map((x) => (
              <button key={x} className={speed === x ? 'on' : ''} onClick={() => actions.setSpeed(x)}>
                ×{x}
                {x === 1 ? ' (보통)' : x === 60 ? ' (1분=하루)' : ' (1초=하루)'}
              </button>
            ))}
          </Group>
          <p className="small muted">지금까지 건너뛴 시간: {fmt(state.debugSkippedMs / HOUR)}시간</p>
        </Modal>
      )}

      {pop === 'ops' && (
        <Modal title="운영 시험" icon="🛠️" onClose={close}>
          {msg && <p className="set-msg small">{msg}</p>}
          <Group title="연구·도시·회의">
            <button className="gold" onClick={() => (actions.apply(debugFinishResearch), say('하던 연구(없으면 고를 수 있는 첫 연구)를 바로 끝냈어요.'))}>🔬 연구 바로 끝내기</button>
            <button onClick={() => (actions.apply(debugAllResearch), say(`연구 ${TECHS.length}개를 모두 끝냈어요.`))}>🔬 모든 연구 끝</button>
            <button onClick={() => (actions.apply(debugFinishDistricts), say('짓던 구역을 모두 완공했어요.'))}>🏗️ 구역 바로 완공</button>
            <button onClick={() => (actions.apply(debugCouncil), say(civ.council.open ? '회의를 바로 마감했어요. 외교 → 국제 회의에서 결과를 보세요.' : '회의를 바로 열었어요. 외교 → 국제 회의에서 투표하세요.'))}>
              🏛️ 회의 {civ.council.open ? '바로 마감' : '바로 열기'}
            </button>
          </Group>
          <Group title="사람·사건">
            <button className="gold" disabled={!nextTitle(state)} onClick={() => (actions.apply(debugTitleUp), say('명성(모자라면 신뢰도)을 채워 다음 호칭으로 올렸어요.'))}>
              🎖️ 다음 호칭으로
            </button>
            <button onClick={() => (actions.apply(debugTalk), say('대화가 하나 왔어요. 본부의 💬 대화를 눌러 보세요.'))}>💬 대화 바로 받기</button>
            <button onClick={() => (actions.apply(debugCrisis), say('돌발 사건을 열었어요.'))}>⚡ 돌발 사건 열기</button>
            <button onClick={() => (actions.apply((s) => debugAddAide({ ...s, player: { ...s.player, salary: s.player.salary + 5000 } })), say('부관을 데려오고 봉급 5000을 넣었어요.'))}>
              🧑‍✈️ 부관 + 봉급 5000
            </button>
          </Group>
          <Group title="채우기">
            <button
              onClick={() =>
                (actions.apply((s) => {
                  const o = structuredClone(s.officer);
                  o.drills = DRILL_MAX;
                  o.drillAnchorMs = s.worldMs;
                  return { ...s, officer: o };
                }),
                say('훈련 일정을 채웠어요.'))
              }
            >
              📅 훈련 일정
            </button>
            <button
              onClick={() =>
                (actions.apply((s) => {
                  const id = s.player.countryId;
                  const stock = { ...s.economy.stock };
                  for (const k of Object.keys(stock) as Array<keyof typeof stock>) stock[k] += 50;
                  return {
                    ...s,
                    nations: { ...s.nations, [id]: { ...s.nations[id], treasury: s.nations[id].treasury + 50000 } },
                    economy: {
                      ...s.economy,
                      stock,
                      facilities: Object.fromEntries(Object.entries(s.economy.facilities).map(([k, f]) => [k, { ...f, exp: f.exp + 500 }])) as typeof s.economy.facilities,
                    },
                  };
                }),
                say('예산·자원·시설 경험치를 채웠어요.'))
              }
            >
              🏭 내정(예산·자원·경험치)
            </button>
            <button onClick={() => (actions.apply((s) => ({ ...s, officer: { ...s.officer, boosts: boostsOf(s) + 100 } })), say('가속권 100장을 넣었어요.'))}>🎫 가속권 +100</button>
            <button onClick={() => (actions.apply((s) => ({ ...s, goals: { ...goalsOf(s), ruby: goalsOf(s).ruby + 200 } })), say('루비 200개를 넣었어요.'))}>💎 루비 +200</button>
          </Group>
          <div className="set-group">
            <small className="muted">호칭 단계 바로 바꾸기(신뢰도·명성을 맞춰 줌)</small>
            <select value={state.player.rankIndex} onChange={(e) => actions.setRank(Number(e.target.value))}>
              {RANKS.map((r, i) => (
                <option key={r.name} value={i}>
                  {r.name} · 봉급 시간당 {r.salaryPerDay}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {pop === 'art' && (
        <Modal title="그림 칸 확인" icon="🖼️" onClose={close}>
          <Tabs<ArtTab>
            value={artTab}
            onChange={setArtTab}
            tabs={[
              { id: 'face', icon: '🧑', label: '인물 사진' },
              { id: 'field', icon: '🗺️', label: '지도·전투' },
              { id: 'icon', icon: '🎖️', label: '아이콘' },
            ]}
          />
          <div className="set-art">
            {artTab === 'face' && <PortraitList />}
            {artTab === 'field' && <FieldArtList />}
            {artTab === 'icon' && <IconArtList />}
          </div>
        </Modal>
      )}

      {pop === 'reset' && (
        <Modal
          title="처음부터 새로 시작할까요?"
          icon="🔄"
          onClose={close}
          footer={
            <>
              <button onClick={close}>아니요</button>
              <button className="danger set-yes" onClick={() => (close(), actions.reset())}>
                네, 새로 시작
              </button>
            </>
          }
        >
          <p>지금 하던 판의 저장이 지워져요. 다른 기기에서 이어 하려면 먼저 '코드 만들기'로 저장 코드를 복사해 두세요.</p>
        </Modal>
      )}
    </div>
  );
}
