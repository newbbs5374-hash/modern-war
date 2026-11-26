// 3D 메인 전투 화면의 글자·버튼 틀(시험판 v5.4 그대로). 게임 화면 CSS와 섞이지 않게 그림자 DOM 안에 넣음.
export const FONT_HREF = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap';

export const CSS = `/* 레이아웃: 화면 전체 3D 전장 + 위 작전실 띠 + 아래 명령 패널(세로 모바일 기준) */
:host{display:block;position:relative;width:100%;height:100%;
  --ink:#0b1112;        /* 작전실 바닥 */
  --panel:rgba(10,18,20,.82);
  --line:rgba(140,220,200,.28);
  --fg:#e6f1ee;
  --dim:#8fa7a2;
  --us:#3d8bff;         /* 우리 편 */
  --foe:#ff3b3b;        /* 적 */
  --amber:#ffc35a;      /* 명령 · 경고 */
  --sans:"IBM Plex Sans KR",system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
  color-scheme:dark;
}
[hidden]{display:none!important}
#app{color:var(--fg);font-family:var(--sans);overflow:hidden;-webkit-tap-highlight-color:transparent;touch-action:none;user-select:none;-webkit-user-select:none}
#app{position:relative;height:100%;max-width:480px;margin:0 auto;overflow:hidden;background:var(--ink)}
#loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:13px;background:var(--ink)}
*{box-sizing:border-box}
#gl{position:absolute;inset:0;width:100%;height:100%;display:block;transition:filter .35s}
#app.flir #gl{filter:grayscale(1) contrast(1.75) brightness(1.08)}
#scan{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s;
  background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%)}
#app.flir #scan{opacity:1}
#bang{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(255,214,150,.55),rgba(255,140,60,.18) 60%,transparent 85%);opacity:0;mix-blend-mode:screen}
#reticle{position:absolute;left:50%;top:46%;width:120px;height:120px;margin:-60px 0 0 -60px;pointer-events:none;opacity:0;transition:opacity .35s}
#app.flir #reticle{opacity:.7}
.hud{position:absolute;left:0;right:0;pointer-events:none;padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}
#top{top:0;padding-top:calc(env(safe-area-inset-top,0px) + 10px);display:flex;flex-direction:column;gap:6px;background:linear-gradient(var(--ink),rgba(11,17,18,.0))}
.row{display:flex;align-items:center;gap:8px}
.op{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:var(--dim)}
.op b{color:var(--us);font-weight:600}
.title{font-weight:700;font-size:15px;letter-spacing:.02em}
.clock{margin-left:auto;font-family:var(--mono);font-size:13px;color:var(--amber);font-variant-numeric:tabular-nums}
.bars{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bar{font-family:var(--mono);font-size:10px;color:var(--dim);display:flex;flex-direction:column;gap:3px}
.bar i{display:block;height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
.bar i u{display:block;height:100%;width:100%;transition:width .3s}
.bar.us u{background:var(--us)} .bar.foe u{background:var(--foe)}
#fxbtn{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 260px);width:84px;height:30px;border:1px solid var(--line);background:rgba(6,12,13,.7);color:var(--fg);border-radius:8px;font-family:var(--sans);font-size:12px;cursor:pointer}
#fxbtn[aria-pressed="false"]{color:var(--dim)}
#camreset{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 224px);width:84px;height:30px;border:1px solid var(--line);background:rgba(6,12,13,.7);color:var(--fg);border-radius:8px;font-family:var(--sans);font-size:12px;cursor:pointer}
#mini{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 92px);width:84px;height:126px;border:1px solid var(--line);background:rgba(6,12,13,.7);pointer-events:none}
#log{position:absolute;left:max(12px,env(safe-area-inset-left,0px));top:calc(env(safe-area-inset-top,0px) + 96px);width:58%;font-family:var(--mono);font-size:10.5px;line-height:1.5;color:var(--dim);pointer-events:none;display:flex;flex-direction:column;gap:1px}
#log div{animation:fadein .3s}
#log .k{color:var(--us)} #log .x{color:var(--foe)} #log .c{color:var(--amber)}
@keyframes fadein{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
#bottom{bottom:0;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px);padding-top:28px;background:linear-gradient(rgba(11,17,18,0),var(--ink) 30%);pointer-events:auto;display:flex;flex-direction:column;gap:8px}
.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
.tabs{display:flex;gap:6px}
.tab{appearance:none;flex:1;border:1px solid var(--line);background:transparent;color:var(--dim);border-radius:999px;height:30px;font-family:var(--sans);font-size:12.5px;font-weight:600;cursor:pointer}
.tab[aria-selected="true"]{background:rgba(61,139,255,.16);color:var(--fg);border-color:var(--us)}
.tab b{font-family:var(--mono);font-weight:500;color:var(--amber);margin-left:4px;font-size:11px}
.card{appearance:none;border:1px solid var(--line);background:var(--panel);color:var(--fg);border-radius:10px;padding:6px 2px 5px;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--sans);font-size:11px;min-height:64px;cursor:pointer}
.card canvas{width:32px;height:22px}
.card span{white-space:nowrap;font-size:10.5px;letter-spacing:-.02em}
.card .c{font-family:var(--mono);font-size:10px;color:var(--amber)}
.card[aria-pressed="true"]{border-color:var(--us);box-shadow:0 0 0 1px var(--us) inset,0 0 14px rgba(61,139,255,.25)}
.card:disabled{opacity:.35}
.card:focus-visible,.btn:focus-visible,.cmd:focus-visible,.tog:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.actions{display:flex;gap:8px;align-items:center}
.budget{font-family:var(--mono);font-size:12px;color:var(--dim)}
.budget b{color:var(--fg);font-variant-numeric:tabular-nums}
.btn{appearance:none;margin-left:auto;border:0;border-radius:999px;background:var(--us);color:#fff;font-family:var(--sans);font-weight:700;font-size:15px;padding:0 22px;height:44px;cursor:pointer;box-shadow:0 0 18px rgba(61,139,255,.35)}
.btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--line);box-shadow:none;margin-left:0;font-weight:600;font-size:13px;padding:0 14px;height:36px}
.cmds{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cmd{appearance:none;position:relative;overflow:hidden;border:1px solid rgba(255,195,90,.35);background:var(--panel);color:var(--fg);border-radius:12px;height:50px;font-family:var(--sans);font-size:12px;font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer}
.cmd small{font-family:var(--mono);font-size:10px;color:var(--amber);font-weight:500}
.cmd .fill{position:absolute;left:0;bottom:0;height:3px;background:var(--amber);width:0}
.cmd:disabled{opacity:.4}
.cmd.on{border-color:var(--amber);box-shadow:0 0 16px rgba(255,195,90,.35)}
.cp{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;color:var(--dim)}
.cp .pips{display:flex;gap:3px;flex:1}
.cp .pips i{flex:1;height:6px;border-radius:2px;background:rgba(255,255,255,.08)}
.cp .pips i.on{background:var(--amber)}
.tog{appearance:none;border:1px solid var(--line);background:var(--panel);color:var(--fg);border-radius:999px;height:32px;padding:0 12px;font-family:var(--mono);font-size:11px;cursor:pointer}
.tog[aria-pressed="true"]{color:#111;background:#e8e8e8}
#aim{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:calc(env(safe-area-inset-top,0px) + 150px);background:rgba(20,14,2,.28);box-shadow:inset 0 0 0 2px rgba(255,195,90,.5)}
#aim p{margin:0;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.6);font-size:13px;color:var(--amber);font-weight:600}
#end{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,9,10,.72);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
#end .box{width:100%;max-width:340px;border:1px solid var(--line);background:var(--panel);border-radius:16px;padding:22px 20px;display:flex;flex-direction:column;gap:10px;text-align:center}
#end h2{margin:0;font-size:24px;letter-spacing:.04em}
#end p{margin:0;color:var(--dim);font-size:13px;line-height:1.6}
#end .btn{margin:6px auto 0}
.hint{font-size:11.5px;color:var(--dim);text-align:center}
@media (prefers-reduced-motion:reduce){#log div{animation:none}}`;

export const html = (opCode: string, subtitle: string) => `<div id="app">
  <canvas id="gl"></canvas>
  <div id="scan"></div>
  <div id="bang"></div>
  <svg id="reticle" viewBox="0 0 120 120" fill="none" stroke="#fff" stroke-width="1.5"><path d="M10 30V10h20M90 10h20v20M110 90v20H90M30 110H10V90"/><path d="M60 48v-14M60 72v14M48 60H34M72 60h14"/><circle cx="60" cy="60" r="2" fill="#fff"/></svg>

  <div class="hud" id="top">
    <div class="row"><span class="op">OP <b>${opCode}</b> · ${subtitle}</span><span class="clock" id="clock">T+00:00</span></div>
    <div class="row"><span class="title" id="goal">부대를 배치하세요</span></div>
    <div class="bars">
      <div class="bar us"><span>아군 전력 <span id="usn"></span></span><i><u id="usb"></u></i></div>
      <div class="bar foe"><span>적 지휘소 <span id="hqn"></span></span><i><u id="hqb"></u></i></div>
    </div>
  </div>
  <div id="log"></div>
  <canvas id="mini" width="168" height="252"></canvas>
  <button id="camreset" type="button" aria-label="시점 처음으로">↺ 시점</button>
  <button id="fxbtn" type="button" aria-pressed="true">효과 높음</button>

  <div class="hud" id="bottom">
    <div id="deployUI">
      <div class="tabs" role="tablist" id="tabs"></div>
      <div class="cards" id="cards" style="margin-top:6px"></div>
      <div class="actions" style="margin-top:8px">
        <span class="budget">예산 <b id="budget">0</b> / <span id="budgetMax">0</span></span>
        <button class="btn ghost" id="clear" type="button">비우기</button>
        <button class="btn" id="go" type="button">작전 개시</button>
      </div>
      <div class="hint" style="margin-top:6px" id="dhint">카드를 고르고 칸을 누르면 배치 · 육군은 땅, 해군은 바다, 공군은 어디든</div>
      <div class="hint" style="margin-top:3px;opacity:.7;font-size:10px">모형: Quaternius (CC0) · 전투기·헬기 “Jet”, “Helicopter” by jeremy, Poly Pizza (CC-BY 3.0)</div>
    </div>
    <div id="battleUI" hidden>
      <div class="cp"><span>지휘력</span><div class="pips" id="pips"></div><span id="cpn">0</span>
        <button class="tog" id="speed" type="button">×1</button>
        <button class="tog" id="flir" type="button" aria-pressed="false">열상</button></div>
      <div class="cmds" id="cmds" style="margin-top:8px"></div>
    </div>
  </div>

  <div id="aim" hidden><p id="aimtxt">목표 지점을 누르세요 · 시간 정지</p></div>
  <div id="loading">3D 전장 불러오는 중…</div>
  <div id="end" hidden><div class="box"><h2 id="endt">승리</h2><p id="endp"></p><button class="btn" id="again" type="button">다시 배치</button></div></div>
</div>`;
