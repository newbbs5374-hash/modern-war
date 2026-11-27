// 내정 확장 화면(11/24): 국정 과제 나무(개인)·여론(사회)·기본법(사회 정계)·국가 사업과 특구(경제)·예산 국회(경제 예산·세금)·사진첩과 오늘의 뉴스(개인)
import { MEGAS, MEGA_DAYS, MEGA_STAGES, canMega, megaCost, megaLv, megaOf, megaTotal, startMega } from '../game/megaPlan';
import { COUNTRIES, countryById } from "../data/world";
import { isAlive } from "../game/world";
import { DEAL_BUDGET, FIRMS, FIRM_MAX, canDeal as canArmsDeal, canGrowFirm, dealPreview, dealSlots, firmById, firmCost, firmLv, growFirm, liveDeals, signDeal, type FirmId } from "../game/arms";
import { SPECS, SPEC_BELT_AT, SPEC_BELT_MUL, SPEC_NEED_STAGE, beltOn, canSpec, liveSpecs, specById, specCost, specMap, upSpec } from "../game/citySpec";
import { useState } from "react";
import type { ScreenProps } from "./screens";
import { Card, fmt } from "./common";
import { Help, Meter, Modal } from "./kit";
import { timeLeft } from "./officerScreens";
import { domOf, type AlbumShot } from "../game/domestic";
import {
  AGENDA,
  PLEDGE_DAYS,
  branchById,
  branchDone,
  canFinish,
  canPledge,
  finishTask,
  fmtN,
  pledge,
  pledgeLeft,
  pledgeSlots,
  taskNow,
  taskTarget,
  tierOpen,
} from "../game/agenda";
import { METRICS } from "../game/metrics";
import {
  DEAL_GAIN,
  DEAL_HOURS,
  GROUPS,
  MEET_GAIN,
  canDeal,
  canMeet,
  dealCost,
  dealGroup,
  groupApproval,
  groupPower,
  groupSat,
  groupTargetRows,
  meetGroup,
} from "../game/groups";
import {
  CODES,
  canChangeCode,
  changeCode,
  codeChance,
  codePick,
} from "../game/codes";
import {
  ZONES,
  canZone,
  clearZone,
  liveZones,
  myCityIds,
  setZone,
  zoneCost,
  zoneSlots,
} from "../game/zones";
import {
  PROJECTS,
  PROJECT_MAX,
  STAGES,
  STAGE_HOURS,
  advanceProject,
  busyProjects,
  canAdvanceProject,
  canStartProject,
  projectById,
  projectCities,
  stageCost,
  startProject,
  projectLost,
  moveCost,
  canMoveProject,
  moveProject,
} from "../game/projects";
import {
  PLANS,
  VOTE_MS,
  canSubmitBudget,
  planById,
  planChance,
  submitBudget,
} from "../game/budgetSeason";
import { cityById } from "../data/cities";
import { chainState } from "../game/chains";
import { SCENES, domArt, sceneArt } from "./scenes";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const longLeft = (ms: number) =>
  ms >= 48 * 3600e3
    ? `${Math.floor(ms / 86400e3)}일 ${Math.floor((ms % 86400e3) / 3600e3)}시간`
    : timeLeft(ms);

/* ───────── A2 국정 과제 ───────── */
export function AgendaPanel({ state, actions }: ScreenProps) {
  const a = domOf(state).agenda;
  const [pick, setPick] = useState<string | null>(null);
  const [open, setOpen] = useState<string>(a.pledges[0] ?? "");
  const slots = pledgeSlots(state);
  const cur = a.pledges.includes(open) ? open : a.pledges[0];
  return (
    <>
      <Card
        title={`취임 공약 ${a.pledges.length}/${slots}`}
        icon="🏁"
        right={
          <Help title="국정 과제">
            <p>
              공약 5갈래 중 {slots}개를 골라요. 갈래마다 4단계 × 3과제이고, 한
              단계에서 2개를 끝내면 다음 단계가 열려요.
            </p>
            <p>
              과제는 연구가 아니라 조건 달성이에요. 조건이 차면 '완수'를 눌러 판
              끝까지 남는 효과를 받아요(지지도 +1·명성 +5).
            </p>
            <p>
              공약을 고른 뒤 {PLEDGE_DAYS}일 안에 첫 단계 2개를 못 끝내면 '공약
              파기' 논란(지지도 −6·신뢰도 −3). 한 갈래를 다 끝내면 공약 완수
              효과와 함께 공약을 하나 더 고를 수 있어요.
            </p>
          </Help>
        }
      >
        <div className="dom-branches">
          {AGENDA.map((b) => {
            const mine = a.pledges.includes(b.id);
            const doneN = b.tasks
              .flat()
              .filter((x) => a.done.includes(x.id)).length;
            return (
              <button
                key={b.id}
                className={`dom-branch ${mine ? "on" : ""} ${cur === b.id ? "sel" : ""}`}
                onClick={() => (mine ? setOpen(b.id) : setPick(b.id))}
              >
                <DomIco k={`agenda-${b.id}`} icon={b.icon} />
                <b>{b.name}</b>
                <small>
                  {mine
                    ? `${doneN}/12${branchDone(state, b) ? " 🏆" : ""}`
                    : "고르기"}
                </small>
              </button>
            );
          })}
        </div>
      </Card>
      {cur && <AgendaTree state={state} actions={actions} id={cur} />}
      {pick && (
        <Modal
          title={`공약: ${branchById(pick).name}`}
          icon={branchById(pick).icon}
          onClose={() => setPick(null)}
        >
          <p className="center">
            <b>“{branchById(pick).slogan}”</b>
          </p>
          <ul className="dom-list">
            {branchById(pick).tasks.map((row, i) => (
              <li key={i}>
                <small className="muted">{i + 1}단계</small>{" "}
                {row.map((x) => `${x.icon} ${x.name}`).join(" · ")}
              </li>
            ))}
          </ul>
          <p className="small">다 지키면: {branchById(pick).finale}</p>
          <button
            className="gold wide"
            disabled={!!canPledge(state, pick)}
            onClick={() => {
              actions.apply((s) => pledge(s, pick));
              setOpen(pick);
              setPick(null);
            }}
          >
            📣 공약 발표{" "}
            {canPledge(state, pick) ? `(${canPledge(state, pick)})` : ""}
          </button>
        </Modal>
      )}
    </>
  );
}

function AgendaTree({
  state,
  actions,
  id,
}: Pick<ScreenProps, "state" | "actions"> & { id: string }) {
  const br = branchById(id);
  const a = domOf(state).agenda;
  const left = pledgeLeft(state, id);
  return (
    <Card title={`${br.name} · ${br.slogan}`} icon={br.icon}>
      {left !== null && (
        <p className={`small ${left < 12 * 3600e3 ? "dom-warn" : "muted"}`}>
          ⏳ 첫 단계 2개 마감까지 {longLeft(left)}
        </p>
      )}
      {a.broken.includes(id) && (
        <p className="small dom-warn">
          💢 공약 파기 논란이 있었어요(계속 이어서 할 수 있어요)
        </p>
      )}
      <div className="dom-tree">
        {br.tasks.map((row, tier) => {
          const opened = tierOpen(state, br, tier);
          return (
            <div key={tier} className={`dom-tier ${opened ? "" : "locked"}`}>
              <div className="dom-tier-head">
                {tier + 1}단계 {opened ? "" : "🔒 앞 단계 2개 끝내면 열림"}
              </div>
              <div className="dom-tasks">
                {row.map((t) => {
                  const done = a.done.includes(t.id);
                  const goal = taskTarget(state, id, t);
                  const now = taskNow(state, t);
                  const no = canFinish(state, t.id);
                  const effText = Object.entries(t.eff)
                    .map(([k, v]) => effLabel(k, v!))
                    .join(" · ");
                  return (
                    <div
                      key={t.id}
                      className={`dom-task ${done ? "done" : ""}`}
                    >
                      <span className="dom-ico">{done ? "✅" : t.icon}</span>
                      <b>{t.name}</b>
                      <small>
                        {METRICS[t.metric].icon} {fmtN(Math.min(now, goal))}/
                        {fmtN(goal)}
                      </small>
                      {!done && opened && (
                        <Meter
                          value={Math.min(now, goal)}
                          max={Math.max(1, goal)}
                          tone={no ? "blue" : "green"}
                        />
                      )}
                      <small className="dom-eff">{effText}</small>
                      {!done && opened && (
                        <button
                          className="gold"
                          disabled={!!no}
                          onClick={() =>
                            actions.apply((s) => finishTask(s, t.id))
                          }
                        >
                          완수
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="small muted">다 지키면 🏆 {br.finale}</p>
    </Card>
  );
}

const EFF_NAME: Record<string, [string, boolean]> = {
  build: ["모집", true],
  troop: ["징병", true],
  budget: ["예산", true],
  res: ["자원", true],
  research: ["연구", true],
  spy: ["첩보", true],
  favor: ["호감", false],
  loyalty: ["민심", false],
  approval: ["지지도", false],
  trust: ["신뢰도", false],
  defense: ["안보", false],
  diplo: ["외교", false],
  society: ["사회", false],
  economy: ["경제", false],
};
export function effLabel(k: string, v: number): string {
  const [n, p] = EFF_NAME[k] ?? [k, false];
  const sign = v > 0 ? "+" : "−";
  return p
    ? `${n} ${sign}${Math.round(Math.abs(v) * 100)}%`
    : `${n} ${sign}${Math.round(Math.abs(v) * 10) / 10}`;
}

/* ───────── A3 이익집단 ───────── */
export function GroupsPanel({ state, actions }: ScreenProps) {
  const [why, setWhy] = useState<string | null>(null);
  const pw = groupPower(state);
  const ga = groupAppr(state);
  return (
    <>
      <Card
        title={`이익집단 여론 · 지지도 ${ga >= 0 ? "+" : ""}${ga}`}
        icon="👥"
        right={
          <Help title="이익집단">
            <p>
              6개 집단마다 힘(%)과 만족도(0~100)가 있어요. 만족도를 힘만큼 섞은
              값이 지지도에 더해져요(최대 ±10).
            </p>
            <p>
              세금·예산 나누기·법안·기본법·전쟁·특구·대형 사업·예산안이 집단마다
              다르게 작용해요. 만족도는 15분마다 목표 쪽으로 움직여요.
            </p>
            <p>
              만족도 70↑이면 덤, 25↓이면 파업·집회 같은 불만 사건과 벌칙이
              생겨요. 면담(+{MEET_GAIN}, 6시간마다)과 요구 수용(+{DEAL_GAIN},{" "}
              {DEAL_HOURS}시간·나라 예산, 맞서는 집단 −8)으로 달랠 수 있어요.
            </p>
          </Help>
        }
      >
        <div className="dom-groups">
          {GROUPS.map((g) => {
            const v = groupSat(state, g.id);
            const tone =
              v >= 70 ? "green" : v <= 25 ? "red" : v <= 40 ? "gold" : "blue";
            return (
              <button
                key={g.id}
                className={`dom-group t-${tone}`}
                onClick={() => setWhy(g.id)}
              >
                <DomIco k={`group-${g.id}`} icon={g.icon} />
                <b>{g.name}</b>
                <small>힘 {Math.round(pw[g.id])}%</small>
                <Meter value={v} max={100} tone={tone} />
                <small>
                  만족 {Math.round(v)}{" "}
                  {v >= 70 ? "😊" : v <= 25 ? "😡" : v <= 40 ? "😒" : "🙂"}
                </small>
              </button>
            );
          })}
        </div>
      </Card>
      {why && (
        <Modal
          title={`${GROUPS.find((x) => x.id === why)!.name} 여론`}
          icon={GROUPS.find((x) => x.id === why)!.icon}
          onClose={() => setWhy(null)}
        >
          {(() => {
            const g = GROUPS.find((x) => x.id === why)!;
            const rows = groupTargetRows(state, g.id);
            const tgt = Math.max(
              0,
              Math.min(
                100,
                rows.reduce((a, r) => a + r[1], 0),
              ),
            );
            return (
              <>
                <p className="small">원하는 것: {g.wants}</p>
                <p className="small">
                  만족 70↑: <b>{g.goodText}</b> · 25↓:{" "}
                  <b className="dom-warn">
                    {g.riot}({g.badText})
                  </b>
                </p>
                <div className="dom-rows">
                  {rows.map(([n, v], i) => (
                    <div key={i}>
                      <span>{n}</span>
                      <b className={v < 0 ? "dom-warn" : ""}>
                        {i === 0
                          ? v
                          : `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`}
                      </b>
                    </div>
                  ))}
                  <div className="dom-sum">
                    <span>목표 만족도</span>
                    <b>{Math.round(tgt)}</b>
                  </div>
                </div>
                <div className="dom-acts">
                  <button
                    disabled={!!canMeet(state, g.id)}
                    onClick={() => actions.apply((s) => meetGroup(s, g.id))}
                  >
                    🤝 대표 면담(+{MEET_GAIN}){" "}
                    {canMeet(state, g.id)
                      ? `· ${timeLeft((domOf(state).groups.meetMs[g.id] ?? 0) - state.worldMs)}`
                      : ""}
                  </button>
                  <button
                    className="gold"
                    disabled={!!canDeal(state, g.id)}
                    onClick={() => actions.apply((s) => dealGroup(s, g.id))}
                  >
                    💼 요구 수용(+{DEAL_GAIN}) · 💵{fmt(dealCost(state))}
                  </button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
    </>
  );
}
const groupAppr = (s: ScreenProps["state"]) => groupApproval(s);

/* ───────── A5 기본법 ───────── */
export function CodesPanel({ state, actions }: ScreenProps) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Card
        title="기본법 8칸"
        icon="⚖️"
        right={
          <Help title="기본법">
            <p>
              병역·노동·조세·언론·이민·교육·환경·치안 8칸마다 하나를 골라요.
              바꾸려면 국회 개정 표결(바로 결과)을 거쳐요.
            </p>
            <p>
              통과 확률은 신뢰도로 정해져요(지금 {pct(codeChance(state))}).
              통과하면 하루, 부결이면 반나절 동안 다시 못 바꾸고 신뢰도 −2.
            </p>
            <p>
              집단마다 찬반이 달라 여론이 움직여요. 전시 동원은 전쟁 중에만,
              전쟁이 끝나면 혼합제로 돌아가요.
            </p>
          </Help>
        }
      >
        <div className="dom-codes">
          {CODES.map((c) => {
            const o = c.opts[codePick(state, c.id)];
            return (
              <button
                key={c.id}
                className={`dom-code ${codePick(state, c.id) !== 1 ? "on" : ""}`}
                onClick={() => setOpen(c.id)}
              >
                <DomIco k={`code-${c.id}`} icon={c.icon} />
                <b>{c.name}</b>
                <small>{o.name}</small>
              </button>
            );
          })}
        </div>
      </Card>
      {open && (
        <Modal
          title={`${CODES.find((c) => c.id === open)!.name}법`}
          icon={CODES.find((c) => c.id === open)!.icon}
          onClose={() => setOpen(null)}
        >
          <p className="small muted">개정 통과 확률 {pct(codeChance(state))}</p>
          <div className="dom-opts">
            {CODES.find((c) => c.id === open)!.opts.map((o, i) => {
              const no = canChangeCode(state, open, i);
              const cur = codePick(state, open) === i;
              const gs = Object.entries(o.groups)
                .map(
                  ([g, v]) =>
                    `${GROUPS.find((x) => x.id === g)?.icon}${v! > 0 ? "+" : ""}${v}`,
                )
                .join(" ");
              return (
                <div key={i} className={`dom-opt ${cur ? "on" : ""}`}>
                  <b>
                    {o.name}
                    {cur ? " (지금)" : ""}
                  </b>
                  <small>{o.text}</small>
                  {gs && <small className="muted">여론 {gs}</small>}
                  {!cur && (
                    <button
                      className="gold"
                      disabled={!!no}
                      onClick={() =>
                        actions.apply((s) => changeCode(s, open, i))
                      }
                    >
                      🗳️ 개정 {no && no !== "지금 이 법이에요" ? `(${no})` : ""}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ───────── A4·A6 국가 사업·특구 ───────── */
export function ProjectsPanel({ state, actions }: ScreenProps) {
  const d = domOf(state);
  const [pick, setPick] = useState<string | null>(null);
  const [city, setCity] = useState<string>("");
  const busy = busyProjects(state);
  return (
    <>
      <Card
        title={`국가 대형 사업 ${busy.length}/${PROJECT_MAX}`}
        icon="🏗️"
        right={
          <Help title="국가 대형 사업">
            <p>
              설계 → 공사 → 마무리 3단계, 단계마다 나라 예산을 내고 실제 시간(
              {STAGE_HOURS.join("·")}시간 × 사업 크기)이 지나야 해요.
            </p>
            <p>
              한꺼번에 {PROJECT_MAX}개까지. 완공하면 판 끝까지 효과가 남고
              지지도·명성이 올라요. 공사 중인 도시는 본부 지도에 크레인이
              보여요. 사업을 지은 도시를 빼앗기면 공사·효과가 멈춰요. 되찾거나 다른 도시로 옮겨 다시 지을 수 있어요.
            </p>
          </Help>
        }
      >
        <div className="dom-projects">
          {PROJECTS.map((p) => {
            const pr = d.projects[p.id];
            const st = pr ? pr.stage : -1;
            const ready = pr && st < 3 && pr.endMs <= state.worldMs;
            return (
              <button
                key={p.id}
                className={`dom-proj ${st >= 3 ? "done" : st >= 0 ? "on" : ""}`}
                onClick={() => {
                  setPick(p.id);
                  setCity(pr?.cityId ?? projectCities(state, p.id)[0] ?? "");
                }}
              >
                {ready && <i className="badge">!</i>}
                <DomIco k={`proj-${p.id}`} icon={p.icon} />
                <b>{p.name}</b>
                <small>
                  {pr && projectLost(state, p.id)
                    ? "⚠️ 도시 잃음"
                    : st >= 3
                    ? "✅ 완공"
                    : st >= 0
                      ? `${STAGES[st]} ${ready ? "끝" : timeLeft(pr!.endMs - state.worldMs)}`
                      : "시작 전"}
                </small>
                {st >= 0 && st < 3 && (
                  <Meter value={st + (ready ? 1 : 0.5)} max={3} tone="gold" />
                )}
              </button>
            );
          })}
        </div>
      </Card>
      <ZonesCard state={state} actions={actions} />
      <SpecCard state={state} actions={actions} />
      <ArmsCard state={state} actions={actions} />
      <MegaCard state={state} actions={actions} />
      <ChainsCard state={state} />
      {pick && (
        <Modal
          title={projectById(pick).name}
          icon={projectById(pick).icon}
          onClose={() => setPick(null)}
        >
          {(() => {
            const p = projectById(pick);
            const pr = d.projects[pick];
            const gs = Object.entries(p.groups)
              .map(
                ([g, v]) =>
                  `${GROUPS.find((x) => x.id === g)?.icon}${v! > 0 ? "+" : ""}${v}`,
              )
              .join(" ");
            return (
              <>
                <p className="center">
                  <b>완공 효과: {p.text}</b>
                </p>
                <p className="small muted">여론 {gs}</p>
                <div className="dom-stages">
                  {STAGES.map((n, i) => (
                    <div
                      key={n}
                      className={`dom-stage ${pr && pr.stage > i ? "done" : pr && pr.stage === i ? "on" : ""}`}
                    >
                      <b>
                        {["📐", "🏗️", "🎀"][i]} {n}
                      </b>
                      <small>
                        💵{fmt(stageCost(state, pick, i))} ·{" "}
                        {Math.round(STAGE_HOURS[i] * p.scale)}시간
                      </small>
                    </div>
                  ))}
                </div>
                {!pr && (
                  <>
                    <label className="small">어느 도시에 지을까요?</label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="wide"
                    >
                      {projectCities(state, pick).map((c) => (
                        <option key={c} value={c}>
                          {cityById(c)?.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="gold wide"
                      disabled={!!canStartProject(state, pick, city)}
                      onClick={() =>
                        actions.apply((s) => startProject(s, pick, city))
                      }
                    >
                      📐 설계 시작{" "}
                      {canStartProject(state, pick, city)
                        ? `(${canStartProject(state, pick, city)})`
                        : ""}
                    </button>
                  </>
                )}
                {pr && projectLost(state, pick) && (
                  <>
                    <p className="small warn">
                      ⚠️ {cityById(pr.cityId)?.name}을(를) 잃어 {pr.stage >= 3 ? "완공 효과가 멈췄어요" : "공사가 멈췄어요"}. 도시를 되찾으면 그대로 이어지고, 다른 도시로 옮기면{" "}
                      {STAGES[Math.min(2, pr.stage)]}부터 다시 해요(💵{fmt(moveCost(state, pick))}).
                    </p>
                    <select value={projectCities(state, pick).includes(city) ? city : projectCities(state, pick)[0] ?? ""} onChange={(e) => setCity(e.target.value)} className="wide">
                      {projectCities(state, pick).map((c) => (
                        <option key={c} value={c}>
                          {cityById(c)?.name}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const to = projectCities(state, pick).includes(city) ? city : projectCities(state, pick)[0] ?? "";
                      const why = canMoveProject(state, pick, to);
                      return (
                        <button className="gold wide" disabled={!!why} onClick={() => actions.apply((s) => moveProject(s, pick, to))}>
                          🚚 옮겨 다시 짓기 {why ? `(${why})` : ""}
                        </button>
                      );
                    })()}
                  </>
                )}
                {pr && pr.stage < 3 && !projectLost(state, pick) && (
                  <>
                    <p className="small">
                      📍 {cityById(pr.cityId)?.name} · 지금 {STAGES[pr.stage]}{" "}
                      {pr.endMs > state.worldMs
                        ? `· ${timeLeft(pr.endMs - state.worldMs)} 남음`
                        : "끝"}
                    </p>
                    <button
                      className="gold wide"
                      disabled={!!canAdvanceProject(state, pick)}
                      onClick={() =>
                        actions.apply((s) => advanceProject(s, pick))
                      }
                    >
                      {pr.stage === 2
                        ? "🎉 완공식"
                        : `▶ ${STAGES[pr.stage + 1]} 시작`}{" "}
                      {canAdvanceProject(state, pick)
                        ? `(${canAdvanceProject(state, pick)})`
                        : ""}
                    </button>
                  </>
                )}
                {pr && pr.stage >= 3 && !projectLost(state, pick) && (
                  <p className="center">
                    ✅ {cityById(pr.cityId)?.name}에 완공
                  </p>
                )}
              </>
            );
          })()}
        </Modal>
      )}
    </>
  );
}

/** 생산 줄 6가지(11/24 A1): 고리 4개를 이으면 나라 전체 효과 */
function ChainsCard({ state }: Pick<ScreenProps, "state">) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = chainState(state);
  const full = rows.filter((r) => r.done >= 4).length;
  const cur = rows.find((r) => r.def.id === open);
  return (
    <>
      <Card
        title={`생산 줄 ${full}/${rows.length} 완성`}
        icon="🔗"
        right={
          <Help title="생산 줄">
            <p>
              자원 → 공장(도시 구역) → 실제 시설 단계 → 대형 사업·특구가 한 줄로
              이어지면 나라 전체에 효과가 붙어요.
            </p>
            <p>
              고리 하나마다 효과 1/4씩, 4개를 모두 이으면 1.5배(완성 보너스).
              자원이 모자라거나 도시를 빼앗기면 고리가 끊겨요.
            </p>
          </Help>
        }
      >
        <div className="dom-chains">
          {rows.map(({ def, links, done }) => (
            <button
              key={def.id}
              className={`dom-chain ${done >= 4 ? "done" : done ? "on" : ""}`}
              onClick={() => setOpen(def.id)}
            >
              <DomIco k={`chain-${def.id}`} icon={def.icon} />
              <b>{def.name}</b>
              <span className="dom-chain-links">
                {def.links.map((l, i) => (
                  <i key={i} className={links[i] ? "ok" : ""} title={l.name}>
                    {l.icon}
                  </i>
                ))}
              </span>
              <small>{done >= 4 ? "✅ 완성 ×1.5" : `${done}/4 이음`}</small>
            </button>
          ))}
        </div>
      </Card>
      {cur && (
        <Modal
          title={`${cur.def.name} 생산 줄`}
          icon={cur.def.icon}
          onClose={() => setOpen(null)}
        >
          <p className="small muted center">{cur.def.text}</p>
          <ol className="dom-chain-steps">
            {cur.def.links.map((l, i) => (
              <li key={i} className={cur.links[i] ? "ok" : ""}>
                <span className="dom-ico">{l.icon}</span>
                <div>
                  <b>
                    {cur.links[i] ? "✅" : "⬜"} {l.name}
                  </b>
                  {!cur.links[i] && <small>{l.how}</small>}
                </div>
              </li>
            ))}
          </ol>
          <p className="center">
            <b>
              지금 효과(×{cur.mult}):{" "}
              {cur.done
                ? Object.entries(cur.def.eff)
                    .map(([k, v]) => effLabel(k, v! * cur.mult))
                    .join(" · ")
                : "아직 없음"}
            </b>
          </p>
          <p className="small muted center">
            완성하면:{" "}
            {Object.entries(cur.def.eff)
              .map(([k, v]) => effLabel(k, v! * 1.5))
              .join(" · ")}
          </p>
        </Modal>
      )}
    </>
  );
}

function ZonesCard({ state, actions }: Pick<ScreenProps, "state" | "actions">) {
  const [cityPick, setCityPick] = useState<string | null>(null);
  const live = liveZones(state);
  const cities = myCityIds(state);
  return (
    <Card
      title={`특구 ${live.length}/${zoneSlots(state)}`}
      icon="🏙️"
      right={
        <Help title="특구 지정">
          <p>
            내 도시를 특구로 지정하면 나라 전체에 효과가 나요(한 종류는 한
            도시만). 도시 3곳마다 1곳 더, 최대 4곳.
          </p>
          <p>
            지정할 때 나라 예산 💵{fmt(zoneCost(state))}. 특구가 2곳 넘으면 '균형
            발전 논란'으로 사회 안정이 조금 내려가요. 해제는 공짜(그 도시는 하루
            뒤 다시 지정).
          </p>
        </Help>
      }
    >
      <div className="dom-zones">
        {cities.map((c) => {
          const z = live.find(([id]) => id === c)?.[1];
          return (
            <button
              key={c}
              className={`dom-zone ${z ? "on" : ""}`}
              onClick={() => setCityPick(c)}
            >
              {z ? <DomIco k={`zone-${z.id}`} icon={z.icon} /> : <span className="dom-ico">🏘️</span>}
              <b>{cityById(c)?.name}</b>
              <small>{z ? z.name : "일반"}</small>
            </button>
          );
        })}
      </div>
      {cityPick && (
        <Modal
          title={`${cityById(cityPick)?.name} 특구`}
          icon="🏙️"
          onClose={() => setCityPick(null)}
        >
          {live.some(([id]) => id === cityPick) ? (
            <button
              className="wide"
              onClick={() => {
                actions.apply((s) => clearZone(s, cityPick));
                setCityPick(null);
              }}
            >
              특구 해제
            </button>
          ) : (
            <div className="dom-opts">
              {ZONES.map((z) => {
                const no = canZone(state, cityPick, z.id);
                return (
                  <div key={z.id} className="dom-opt">
                    <b>
                      {z.icon} {z.name}
                    </b>
                    <small>{z.text}</small>
                    <button
                      className="gold"
                      disabled={!!no}
                      onClick={() => {
                        actions.apply((s) => setZone(s, cityPick, z.id));
                        setCityPick(null);
                      }}
                    >
                      지정 💵{fmt(zoneCost(state))} {no ? `(${no})` : ""}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </Card>
  );
}

/* ───────── 내정 1 도시 특화 나무(11-27) ───────── */
function SpecCard({ state, actions }: Pick<ScreenProps, "state" | "actions">) {
  const [pick, setPick] = useState<string | null>(null);
  const map = specMap(state);
  const cities = myCityIds(state);
  const live = liveSpecs(state);
  const cur = pick ? map[pick] : undefined;
  return (
    <Card
      title={`도시 특화 ${live.length}/${cities.length}`}
      icon="🌳"
      right={
        <Help title="도시 특화 나무">
          <p>내 도시마다 길 하나(산업·과학·관광·군사·금융)를 골라 3단계까지 키워요. 단계마다 나라 전체에 효과가 더해져요.</p>
          <p>같은 길을 {SPEC_BELT_AT}곳 넘게 키우면 '벨트'가 되어 그 길 효과가 ×{SPEC_BELT_MUL}. 2단계는 도시 {SPEC_NEED_STAGE[1]}단계, 3단계는 도시 {SPEC_NEED_STAGE[2]}단계부터. 길을 바꾸면 1단계부터 다시 키워요.</p>
        </Help>
      }
    >
      {SPECS.some((d) => beltOn(state, d.id)) && (
        <div className="ichips">
          {SPECS.filter((d) => beltOn(state, d.id)).map((d) => (
            <span key={d.id} className="ichip">
              ✨ {d.icon} {d.belt}
            </span>
          ))}
        </div>
      )}
      <div className="dom-zones">
        {cities.map((c) => {
          const v = map[c];
          const d = v ? specById(v.path) : undefined;
          return (
            <button key={c} className={`dom-zone ${d ? "on" : ""}`} onClick={() => setPick(c)}>
              <span className="dom-ico">{d ? d.icon : "🌱"}</span>
              <b>{cityById(c)?.name}</b>
              <small>{d ? `${d.name} ${"●".repeat(v!.lv)}${"○".repeat(3 - v!.lv)}` : "길 고르기"}</small>
            </button>
          );
        })}
      </div>
      {pick && (
        <Modal title={`${cityById(pick)?.name} 특화`} icon="🌳" onClose={() => setPick(null)}>
          <div className="dom-opts">
            {SPECS.map((d) => {
              const mine = cur?.path === d.id;
              const next = mine ? cur!.lv + 1 : 1;
              const no = canSpec(state, pick, d.id);
              return (
                <div key={d.id} className={`dom-opt ${mine ? "on" : ""}`}>
                  <b>
                    {d.icon} {d.name} {mine ? `${cur!.lv}/3단계` : ""}
                  </b>
                  <small>
                    단계마다 {d.text}
                    <br />
                    {d.steps.map((n, i) => (
                      <span key={n} className={mine && cur!.lv > i ? "spec-done" : "muted"}>
                        {i ? " → " : ""}
                        {n}
                      </span>
                    ))}
                  </small>
                  {next <= 3 ? (
                    <button className="gold" disabled={!!no} onClick={() => actions.apply((s) => upSpec(s, pick, d.id))}>
                      {mine ? `${next}단계 ${d.steps[next - 1]}` : cur ? "이 길로 바꾸기(1단계부터)" : `1단계 ${d.steps[0]}`} 💵{fmt(specCost(state, pick, next))} {no ? `(${no})` : ""}
                    </button>
                  ) : (
                    <small className="spec-done">✅ 끝까지 키웠어요</small>
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </Card>
  );
}

/* ───────── 내정 3 방산 기업과 수출(11-27) ───────── */
function MegaCard({ state, actions }: Pick<ScreenProps, "state" | "actions">) {
  const m = megaOf(state);
  return (
    <Card
      title={`국가 대계획 ${megaTotal(state)}/${MEGAS.length * MEGA_STAGES}단계`}
      icon="🚀"
      right={
        <Help title="국가 대계획">
          <p>여러 주에 걸쳐 4단계를 밟는 초대형 사업이에요. 한 번에 한 단계만 진행하고, 가속할 수 없어요.</p>
          <p>단계를 끝낼 때마다 명성과 영구 효과가 붙고 사진첩에 장면이 남아요. 세 가지를 모두 완성하면 「과학 승리」예요.</p>
        </Help>
      }
    >
      {MEGAS.map((d) => {
        const lv = megaLv(state, d.id);
        const run = m.run?.id === d.id ? m.run : null;
        const st = d.stages[Math.min(lv, MEGA_STAGES - 1)];
        const no = canMega(state, d.id);
        const art = sceneArt(st.scene, false);
        return (
          <div key={d.id} className={`mega ${lv >= MEGA_STAGES ? "done" : ""}`}>
            <div className="mega-art" style={art ? { backgroundImage: `url(${art})` } : undefined}>
              <span>{d.icon}</span>
            </div>
            <div className="mega-body">
              <b>
                {d.name} <small className="muted">{d.effText}</small>
              </b>
              <div className="mega-steps">
                {d.stages.map((x, i) => (
                  <span key={i} className={i < lv ? "on" : i === lv && run ? "run" : ""} title={x.text}>
                    {i < lv ? "✅" : i + 1}. {x.name}
                  </span>
                ))}
              </div>
              {lv >= MEGA_STAGES ? (
                <small className="good">완성! 영구 효과가 붙었어요.</small>
              ) : run ? (
                <small>
                  ⏳ 「{st.name}」 진행 중 · {longTime(run.endMs - state.worldMs)} 남음
                </small>
              ) : (
                <button className="gold" disabled={!!no} title={no ?? ""} onClick={() => actions.apply((s) => startMega(s, d.id))}>
                  {lv + 1}단계 「{st.name}」 시작 · 💵{fmt(megaCost(state, d.id))} · {MEGA_DAYS[lv]}일
                </button>
              )}
              {!run && lv < MEGA_STAGES && no && <small className="muted"> {no}</small>}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
const longTime = (ms: number) => (ms >= 86400e3 ? `${Math.floor(ms / 86400e3)}일 ${Math.floor((ms % 86400e3) / 3600e3)}시간` : `${Math.max(0, Math.floor(ms / 3600e3))}시간 ${Math.max(0, Math.floor((ms % 3600e3) / 60e3))}분`);

function ArmsCard({ state, actions }: Pick<ScreenProps, "state" | "actions">) {
  const [sell, setSell] = useState<FirmId | null>(null);
  const me = state.player.countryId;
  const live = liveDeals(state);
  const buyers = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id));
  return (
    <Card
      title={`방산 수출 ${live.length}/${dealSlots(state)}`}
      icon="🏭"
      right={
        <Help title="방산 기업과 수출">
          <p>방산 기업 4곳을 키우고 다른 나라에 무기를 팔아요. 계약 하나는 3일 동안 나라 예산을 기업 단계마다 +{(DEAL_BUDGET * 100).toFixed(1)}% 올리고, 그 나라 호감이 올라요.</p>
          <p>판 무기는 그 나라 병력에 실제로 더해져요. 전쟁 중인 나라에는 못 팔고, 내 연합국과 싸우는 나라에 팔면 연합국이 싫어해요. 계약 수는 기업 단계 합의 절반까지(많아야 6건).</p>
        </Help>
      }
    >
      <div className="dom-zones">
        {FIRMS.map((f) => {
          const lv = firmLv(state, f.id);
          const no = canGrowFirm(state, f.id);
          return (
            <div key={f.id} className={`dom-zone ${lv ? "on" : ""}`}>
              <span className="dom-ico">{f.icon}</span>
              <b>{f.name}</b>
              <small>
                {"●".repeat(lv)}
                {"○".repeat(FIRM_MAX - lv)}
              </small>
              {lv < FIRM_MAX && (
                <button className="gold" disabled={!!no} title={no ?? ""} onClick={() => actions.apply((s) => growFirm(s, f.id))}>
                  키우기 💵{fmt(firmCost(state, f.id))}
                </button>
              )}
              <button disabled={lv < 1} onClick={() => setSell(f.id)}>
                팔기
              </button>
            </div>
          );
        })}
      </div>
      {live.length > 0 && (
        <div className="ichips">
          {live.map((d) => (
            <span key={d.to} className="ichip">
              {firmById(d.firm)?.icon} {countryById(d.to).name} · {timeLeft(d.untilMs - state.worldMs)}
            </span>
          ))}
        </div>
      )}
      {sell && (
        <Modal title={`${firmById(sell)!.name} 수출(${firmById(sell)!.goods})`} icon={firmById(sell)!.icon} onClose={() => setSell(null)}>
          <div className="dom-opts">
            {buyers.map((c) => {
              const no = canArmsDeal(state, c.id, sell);
              const pv = dealPreview(state, c.id);
              return (
                <div key={c.id} className="dom-opt">
                  <b>{c.name}</b>
                  <small>
                    호감 +{pv.favor}
                    {pv.angry.length ? ` · ${pv.angry.map((id) => countryById(id).name).join("·")}이(가) 싫어해요` : ""}
                  </small>
                  <button
                    className="gold"
                    disabled={!!no}
                    onClick={() => {
                      actions.apply((s) => signDeal(s, c.id, sell));
                      setSell(null);
                    }}
                  >
                    계약 {no ? `(${no})` : `· 3일 예산 +${(DEAL_BUDGET * firmLv(state, sell) * 100).toFixed(1)}%`}
                  </button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </Card>
  );
}

/* ───────── A7 예산 국회 ───────── */
export function BudgetSeasonCard({ state, actions }: ScreenProps) {
  const b = domOf(state).budget;
  const active = b.active && b.active.untilMs > state.worldMs ? b.active : null;
  return (
    <Card
      title="예산안 국회"
      icon="🏛️"
      right={
        <Help title="예산안 철">
          <p>
            실제 7일마다 예산안 철이 와요. 하루 안에 예산안 4가지 중 하나를 내면{" "}
            {Math.round(VOTE_MS / 3600e3)}시간 뒤 국회가 표결해요.
          </p>
          <p>
            통과하면 다음 철까지 효과, 부결되거나 안 내면 준예산(나라 예산
            −5%·신뢰도 −3). 통과 확률은 신뢰도와 예산안 종류로 정해져요.
          </p>
        </Help>
      }
    >
      {b.open ? (
        b.open.plan ? (
          <p className="small">
            🗳️ {planById(b.open.plan)?.icon} {planById(b.open.plan)?.name} 표결
            중 · {timeLeft((b.open.voteMs ?? 0) - state.worldMs)} 남음 · 통과{" "}
            {pct(b.open.chance)}
          </p>
        ) : (
          <>
            <p className="small dom-warn">
              📅 예산안 철! {timeLeft(b.open.untilMs - state.worldMs)} 안에
              내세요
            </p>
            <div className="dom-plans">
              {PLANS.map((p) => (
                <div key={p.id} className="dom-opt">
                  <b>
                    {p.icon} {p.name}
                  </b>
                  <small>{p.text}</small>
                  <button
                    className="gold"
                    disabled={!!canSubmitBudget(state, p.id)}
                    onClick={() => actions.apply((s) => submitBudget(s, p.id))}
                  >
                    📨 제출 · 통과 {pct(planChance(state, p.id))}
                  </button>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <p className="small muted">
          다음 예산안 철까지 {longLeft(Math.max(0, b.nextMs - state.worldMs))}
        </p>
      )}
      {active && (
        <p className="small">
          지금 예산:{" "}
          {active.cut
            ? "⚠️ 준예산(나라 예산 −5%)"
            : `${planById(active.plan)?.icon} ${planById(active.plan)?.name} · ${planById(active.plan)?.text}`}
        </p>
      )}
      <p className="small muted">
        통과 {b.passed}번 · 준예산 {b.cut}번
      </p>
    </Card>
  );
}

/* ───────── B 사진첩·오늘의 뉴스 ───────── */
export function AlbumPanel({ state }: ScreenProps) {
  const d = domOf(state);
  const [view, setView] = useState<AlbumShot | null>(null);
  const news = d.log.slice(0, 4);
  return (
    <>
      <Card title="오늘의 뉴스" icon="🗞️">
        <div className="dom-paper">
          <div className="dom-paper-head">
            국정 일보 · {new Date().toLocaleDateString("ko-KR")}
          </div>
          {news.length ? (
            <>
              <h3>{news[0].replace(/^[^\s]+\s/, "")}</h3>
              {news.slice(1).map((n, i) => (
                <p key={i} className="small">
                  · {n}
                </p>
              ))}
            </>
          ) : (
            <p className="small muted">
              아직 큰 소식이 없어요. 공약을 발표해 보세요.
            </p>
          )}
        </div>
      </Card>
      <Card
        title={`국정 사진첩 ${d.album.length}장`}
        icon="📸"
        right={
          <Help title="사진첩">
            <p>
              공약 발표·법 개정·대형 사업 착공·완공·면담·집회 같은 순간이
              사진으로 남아요. 판이 끝나면 내 임기 기록이에요.
            </p>
          </Help>
        }
      >
        {d.album.length ? (
          <div className="dom-album">
            {d.album.map((a, i) => (
              <button key={i} className="dom-shot" onClick={() => setView(a)}>
                <SceneImg scene={a.scene} />
                <small>{a.title}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="small muted">아직 사진이 없어요</p>
        )}
      </Card>
      {view && (
        <Modal title={view.title} icon="📸" onClose={() => setView(null)}>
          <SceneImg scene={view.scene} big />
          <p className="small">{view.text}</p>
          <p className="small muted">{SCENES[view.scene]?.name ?? ""}</p>
        </Modal>
      )}
    </>
  );
}

export function SceneImg({ scene, big }: { scene: string; big?: boolean }) {
  const night = new Date().getHours() >= 19 || new Date().getHours() < 6;
  const url = sceneArt(scene, night);
  const sc = SCENES[scene];
  if (url)
    return (
      <img
        className={`dom-scene ${big ? "big" : ""}`}
        src={url}
        alt={sc?.name ?? scene}
      />
    );
  return (
    <div
      className={`dom-scene ph ${big ? "big" : ""}`}
      style={{ background: sc?.bg ?? "#45525f" }}
    >
      <span>{sc?.icon ?? "📸"}</span>
    </div>
  );
}

/** 사진첩 쓰기 전에 dom 없으면 빈 화면(첫 틱 전) */
export const hasDom = (s: ScreenProps["state"]) => !!s.dom;
export { branchById };

/** 내정 카드 아이콘: src/assets/dom/<이름>.webp 그림이 있으면 그림, 없으면 이모지 */
function DomIco({ k, icon }: { k: string; icon: string }) {
  const u = domArt(k);
  return <span className="dom-ico">{u ? <img src={u} alt="" /> : icon}</span>;
}
