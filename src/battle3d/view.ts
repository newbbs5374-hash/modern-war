// @ts-nocheck
// 3D 전투 화면(시험판 "철벽 작전" v5.4에서 옮김). 계산은 sim.ts가 하고, 여기는 보여 주기만 한다.
// 화면 코드는 체력이나 피해를 절대 바꾸지 않는다. 속도(1배/2배)가 달라도 계산 결과는 같다.
// three.js는 시험판과 같은 r128(three128)을 쓴다(색·빛이 시험판과 똑같이 보이도록).
import * as THREE from 'three128';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import {
  DEF, TABS, BUDGET, TICK, SC, CMD, CMD_ORDER, FIELD, TILES, WATER_Y, ST, COAST, useStage, winOf, winText, autoDeploy,
  coastX, riverZ, BRIDGES, isSea, hAt, groundY, angDiff, tileOk, dist,
  createSim, makeUnit, setupDeploy as simSetup, defaultDeploy, startBattle as simStart, step, doCmd as simCmd,
} from './sim';
import { carryFrom, fillReinf } from './siege';
import HTML from './battle3d.html?raw';

const GLB_BASE = `${import.meta.env.BASE_URL}battle3d/glb/`;

export interface Battle3DResult { win: boolean; timeout: boolean; t: number; lost: number; total: number; /** 11-26 쓰러진 우리 부대(병과 이름별, 미사일·자폭 포함) */ dead?: Record<string, number>; carry?: unknown; /** 11-26 훈련 점수 계산용 */ sim?: unknown }
export interface Battle3DOptions {
  onEnd?(r: Battle3DResult): void; onQuit?(phase?: string): void; endLabel?: string;
  /** 공성전: 이 막의 전장 · 넘어온 부대 · 예산 · 시작 지휘력 · 적 체력 배수 · 위에 보일 막 이름 */
  stage?: unknown; preset?: unknown[]; budget?: number; cp0?: number; foeHp?: number; actLabel?: string; naval?: number;
  /** 11-26 훈련 전장: 배치 고정(카드 없이 바로 개시) · 병과 숙련 배수 · 전투 중 땅을 누르면(집중 사격·정찰) · 오른쪽 막대 · 끝 글 */
  lockDeploy?: boolean; usBuff?: Record<string, number>; foeBuff?: Record<string, number>;
  onTap?(S: unknown, x: number, z: number, u: unknown): string | void;
  bar?(S: unknown): { label: string; pct: number; txt: string };
  endText?(S: unknown, win: boolean, timeout: boolean): string;
  /** 11-26 가진 부대만: 3D 병과별 낼 수 있는 수(없으면 제한 없음 · 앞 막에서 넘어온 부대는 안 셈) */
  owned?: Record<string, number>;
  /** 11-27 전투 5: 함께 나간 장군의 지휘 기술(막마다 한 번, 지휘력 안 씀 · twice면 두 번 떨어짐) */
  gen?: { name: string; k: string; label: string; twice: boolean };
  /** 개발용: window.__snapUnits로 모형 아이콘 찍기 */
  snap?: boolean;
}

/** 3D 전투를 root 안에 띄움. 돌려주는 함수를 부르면 모두 정리함 */
export function mountBattle3D(root: HTMLElement, opts: Battle3DOptions = {}): () => void {
useStage(opts.stage || COAST);
const URBAN = !!ST.urban, BUDGET_NOW = opts.budget ?? ST.budget ?? BUDGET;
// 11-26 큰 전장: 넓이 배수(시험판 해안 전장 = 1) · 가운데 · 생김새
const FW=FIELD.xMax-FIELD.xMin, FD=FIELD.zBot-FIELD.zTop, FK=Math.max(FW/20,FD/29), FCX=(FIELD.xMin+FIELD.xMax)/2, FCZ=(FIELD.zTop+FIELD.zBot)/2;
const OLD=ST.id==="coast"||!!ST.drill;
const THEMES={
  green:{bg:0x1d2a2b,a:0x5c6b3e,b:0x77744a,c:0x8b7d57,s:0xc4b07f,w:0x2f6f73,d:0x173a48,r:0x6a5f4c,sea:0x2e6f80,hemi:[0xd6ecff,0x3d3526,.66],sun:[0xffe4bc,.98],trees:["tree1","tree2","tree3","tree4","tree5","pine1","birch"],ground:["grass","bush","bush2"],rocks:["rock1","rock2","rock3","rock5","mrock"]},
  desert:{bg:0x3b3024,a:0xa3864f,b:0xb39563,c:0x8f7046,s:0xc9b383,w:0x2f7b80,d:0x1b4a57,r:0x8a6c48,sea:0x358496,hemi:[0xfff0d6,0x6b5338,.62],sun:[0xffe0a8,.92],trees:["dead"],ground:["bush2","rock1"],rocks:["rock1","rock2","rock3","rock5"]},
  snow:{bg:0x2a333d,a:0xc4ccd1,b:0xb2bcc3,c:0x96a2aa,s:0xcfd6da,w:0x3b6f84,d:0x1b3d52,r:0x9fb3c0,sea:0x3a7088,hemi:[0xe8f2ff,0x5d6670,.6],sun:[0xf2f6ff,.72],trees:["pine1","pine2","pine3"],ground:["rock1","bush2"],rocks:["rock1","rock2","rock3","rock5"]},
  jungle:{bg:0x14231a,a:0x2f5a2a,b:0x3c6b30,c:0x4d5f2d,s:0xa99a6c,w:0x2c5f55,d:0x173a3c,r:0x4f4a34,sea:0x2a6668,hemi:[0xd8f0d0,0x2c3a22,.62],sun:[0xfff0c8,.9],trees:["tree1","tree2","tree3","tree4","tree5"],ground:["bush","bush2","grass","grass"],rocks:["mrock","rock5"]},
  night:{bg:0x060a12,a:0x2c3a2c,b:0x364233,c:0x3f4132,s:0x6f6a58,w:0x163844,d:0x0b1e2a,r:0x2e2c26,sea:0x18404c,hemi:[0x8aa6d8,0x161a20,.46],sun:[0xa8c0ff,.62],trees:["pine1","pine2","pine3","tree2","tree4"],ground:["bush","grass","bush2"],rocks:["rock2","mrock"]},
  steppe:{bg:0x27302c,a:0x8a8a4c,b:0x9c9456,c:0x7c7446,s:0xc8b886,w:0x2f6f73,d:0x173a48,r:0x6d6448,sea:0x2e6f80,hemi:[0xe6efff,0x4b4430,.7],sun:[0xffe8c0,1.02],trees:["birch","tree5"],ground:["grass","grass","bush2"],rocks:["rock1","rock3","mrock"]},
  ocean:{bg:0x1f3442,a:0x5c6b3e,b:0x77744a,c:0x8b7d57,s:0xc4b07f,w:0x2c6a80,d:0x123448,r:0x6a5f4c,sea:0x2a6a84,hemi:[0xd6ecff,0x24303a,.7],sun:[0xfff0d8,1.0],trees:[],ground:[],rocks:[]},
  arctic:{bg:0x273240,a:0xc6ced3,b:0xb4bec5,c:0x9aa6ae,s:0xc0c9ce,w:0x34667c,d:0x14324a,r:0x9fb3c0,sea:0x3b6b82,hemi:[0xeaf4ff,0x55606c,.6],sun:[0xeef4ff,.7],trees:["pine2","pine3"],ground:["rock2"],rocks:["rock1","rock2","rock5"]},
  dusk:{bg:0x2b1d1c,a:0x7a6a44,b:0x8e7a4c,c:0x9a7a52,s:0xc9a878,w:0x3a5f6c,d:0x1d3346,r:0x6a5544,sea:0x3a5f72,hemi:[0xffd2b0,0x3a2a22,.6],sun:[0xff9c5a,1.0],trees:["tree3","tree5","dead"],ground:["bush2","grass"],rocks:["rock1","rock3","rock5"]},
  rock:{bg:0x2e2220,a:0x7e5036,b:0x8c5d3f,c:0x6a402c,s:0xa77e5c,w:0x2f6f73,d:0x173a48,r:0x6a4a36,sea:0x2e6f80,hemi:[0xffe6d0,0x4a3024,.58],sun:[0xffd0a0,.88],trees:["dead"],ground:["bush2","rock1"],rocks:["rock1","rock2","rock3","rock5"]},
};
const TH=THEMES[ST.theme||"green"]||THEMES.green;
root.innerHTML = HTML;
const $ = (s) => root.querySelector(s);
const app = $("#app"), cvs = $("#gl");
let disposed = false;
const timers = new Set();
const setTimeout = (fn, ms) => { const id = window.setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms); timers.add(id); return id; };
// 주변 사물 배치용 난수(계산 난수와 따로)
let vseed = 1;
function rnd() { vseed = (vseed * 1664525 + 1013904223) >>> 0; return vseed / 4294967296; }
/* ───────── three 기본 ───────── */
const renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(OLD?0x1d2a2b:TH.bg);
scene.fog=new THREE.Fog(OLD?0x1d2a2b:TH.bg,46*FK,92*FK);
const camera=new THREE.PerspectiveCamera(45,1,0.1,160*FK);
const camBase=new THREE.Vector3(0,27,23.5), camLook=new THREE.Vector3(0,0,2.6);
let shake=0;
const hemi=OLD?new THREE.HemisphereLight(0xd6ecff,0x3d3526,0.66):new THREE.HemisphereLight(TH.hemi[0],TH.hemi[1],TH.hemi[2]); scene.add(hemi);
const sun=OLD?new THREE.DirectionalLight(0xffe4bc,0.98):new THREE.DirectionalLight(TH.sun[0],TH.sun[1]);
sun.position.set(-11*FK+FCX,22*FK,8*FK+FCZ); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-19*FK,right:19*FK,top:19*FK,bottom:-19*FK,near:1,far:60*FK});
if(!OLD){sun.target.position.set(FCX,0,FCZ);scene.add(sun.target);}
sun.shadow.bias=-0.0006; scene.add(sun);

const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,flatShading:true,roughness:.85,metalness:0},o||{}));
const PAL={
  us:{hull:0x4d6684,dark:0x33465d,light:0x7590ae,cloth:0x4a5f78,ship:0x6f8296,deck:0x48586a,accent:0x3d8bff},
  foe:{hull:0x8f4a3e,dark:0x5f2f28,light:0xb26c5c,cloth:0x83493d,ship:0x93706a,deck:0x5f4744,accent:0xff3b3b}
};
const MATS={};
function tm(side,key){const k=side+key;return MATS[k]||(MATS[k]=M(PAL[side][key]));}
const MAT={
  track:M(0x26292a),metal:M(0x3b3f42,{roughness:.55,metalness:.35}),steel:M(0x7d8486,{roughness:.5,metalness:.3}),
  skin:M(0xc9a27e),pants:M(0x3b3f33),vest:M(0x2f3529),black:M(0x1c1e1f),white:M(0xe9ece6),red:M(0xb5382a),
  glass:M(0x1b2a33,{roughness:.15,metalness:.6}),glow:new THREE.MeshBasicMaterial({color:0x9ff6ff}),
  blur:new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:.28,depthWrite:false}),
  wreck:M(0x1e1c1a),rock:M(0x5e5a50),trunk:M(0x4a3626),leaf:M(0x3f5a32),
  conc:M(0x8a857a),conc2:M(0x6e6a62),roof:M(0x5b4b3f),road:M(0x4b4842),bag:M(0x9a8a62),dirt:M(0x4a3f30),sand:M(0xc9b98c),
  wood:M(0x6b4f35),stripe:M(0xd9dcd5)
};

/* ───────── 지형 ───────── */
let waterMesh=null, foam=null;
function terrain(){
  if(URBAN)return terrainUrban();
  const PW=OLD?40:FW+20, PD=OLD?44:FD+15, g=new THREE.PlaneGeometry(PW,PD,Math.min(120,Math.round(PW*2)),Math.min(140,Math.round(PD*2))); g.rotateX(-Math.PI/2); g.translate(OLD?0:FCX,0,OLD?-.5:FCZ);
  const p=g.attributes.position, col=[];
  const T=OLD?THEMES.green:TH;
  const cA=new THREE.Color(T.a),cB=new THREE.Color(T.b),cC=new THREE.Color(T.c),cS=new THREE.Color(T.s),cW=new THREE.Color(T.w),cD=new THREE.Color(T.d),cR=new THREE.Color(T.r),tmp=new THREE.Color();
  const blockRock=(x,z)=>(ST.blocks||[]).some(b=>b.rock&&x>b.x0-.2&&x<b.x1+.2&&z>b.z0-.2&&z<b.z1+.2);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),h=hAt(x,z); p.setY(i,h);
    const d=x-coastX(z), n=(Math.sin(x*3.1+z*2.3)+Math.sin(x*1.7-z*2.9))/4+.5;
    if(d<-0.2){tmp.copy(cW).lerp(cD,Math.min(1,-d/4));}
    else if(d<1.1){tmp.copy(cS).lerp(cA,Math.max(0,(d-.6)/.5));}
    else{tmp.copy(cA).lerp(cB,n*.7).lerp(cC,Math.max(0,OLD?(x-8.6)*.25:(h-.45)*.8));const riv=Math.abs(z-riverZ(x));if(riv<1.25)tmp.lerp(cR,.55);if(!OLD&&blockRock(x,z))tmp.copy(cC).lerp(cR,.4);}
    col.push(tmp.r,tmp.g,tmp.b);
  }
  g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  m.receiveShadow=true; scene.add(m);
  // 바다: 반투명 물결
  const wg=new THREE.PlaneGeometry(PW,PD,Math.round(PW),Math.round(PD)); wg.rotateX(-Math.PI/2); wg.translate(OLD?0:FCX,0,OLD?-.5:FCZ);
  waterMesh=new THREE.Mesh(wg,new THREE.MeshStandardMaterial({color:T.sea,roughness:.18,metalness:.15,transparent:true,opacity:.78}));
  waterMesh.position.y=WATER_Y; waterMesh.receiveShadow=true; scene.add(waterMesh);
  waterMesh.userData.base=Float32Array.from(wg.attributes.position.array);
  // 파도 거품 띠
  const pts=[]; for(let z=FIELD.zTop-7;z<=FIELD.zBot+8;z+=.5){const x=coastX(z);if(Math.abs(x)>60)continue;pts.push(x-.05,z,x-.42,z);}
  const fg=new THREE.BufferGeometry(); const fp=[];
  for(let i=0;i<pts.length/4-1;i++){const a=i*4,b=(i+1)*4;const P=(k)=>[pts[k],WATER_Y+.02,pts[k+1]];
    fp.push(...P(a),...P(a+2),...P(b),...P(b),...P(a+2),...P(b+2));}
  fg.setAttribute("position",new THREE.Float32BufferAttribute(fp,3));
  foam=new THREE.Mesh(fg,new THREE.MeshBasicMaterial({color:0xeaf6f2,transparent:true,opacity:.5,depthWrite:false}));
  if(fp.length)scene.add(foam);
  // 다리
  BRIDGES.forEach(x=>{const z=riverZ(x);const b=new THREE.Group();b.add(box(1.3,.14,2.6,MAT.road,0,0,0),box(.08,.18,2.6,MAT.steel,-.62,.12,0),box(.08,.18,2.6,MAT.steel,.62,.12,0));
    [-.8,0,.8].forEach(zz=>b.add(box(.18,.6,.18,MAT.conc2,-.5,-.3,zz),box(.18,.6,.18,MAT.conc2,.5,-.3,zz)));bake(b);b.position.set(x,.02,z);scene.add(b);});
  // 길
  const roads=OLD?[[[3.8,-12],[3.6,-6],[1.6,-1.5],[1.6,2.5],[2.6,7],[3,13]]]:(ST.roads||[]);
  roads.forEach(road=>{for(let i=0;i<road.length-1;i++){const [x1,z1]=road[i],[x2,z2]=road[i+1];const L=Math.hypot(x2-x1,z2-z1);const n=Math.max(1,Math.round(L/2.5));
    for(let k=0;k<n;k++){const ax=x1+(x2-x1)*k/n,az=z1+(z2-z1)*k/n,bx=x1+(x2-x1)*(k+1)/n,bz=z1+(z2-z1)*(k+1)/n,l=Math.hypot(bx-ax,bz-az);
      const r=new THREE.Mesh(new THREE.PlaneGeometry(.9,l+.3),MAT.road);r.rotation.x=-Math.PI/2;r.rotation.z=-Math.atan2(bx-ax,bz-az);r.position.set((ax+bx)/2,Math.max(hAt((ax+bx)/2,(az+bz)/2),.02)+.03,(az+bz)/2);r.receiveShadow=true;scene.add(r);}}});
  if(OLD)dressField();else dressGeneric();
}
/* ───────── 시가전 · 도심 전장 ───────── */
function blockAt(x,z,m){return (ST.blocks||[]).find(b=>x>b.x0-m&&x<b.x1+m&&z>b.z0-m&&z<b.z1+m);}
function terrainUrban(){
  const PW=OLD||FK===1?40:FW+20, PD=OLD||FK===1?44:FD+15, g=new THREE.PlaneGeometry(PW,PD,Math.min(200,Math.round(PW*4)),Math.min(220,Math.round(PD*4))); g.rotateX(-Math.PI/2); g.translate(FK===1?0:FCX,0,FK===1?-.5:FCZ);
  const p=g.attributes.position, col=[];
  const cAs=new THREE.Color(0x3e4143),cAs2=new THREE.Color(0x4a4c4c),cWalk=new THREE.Color(0x8d8a82),cPad=new THREE.Color(0x6f6c66),cPlz=new THREE.Color(0x9b9386),cDirt=new THREE.Color(0x5b5446),cLine=new THREE.Color(0xc9c4a8),tmp=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i); p.setY(i,hAt(x,z));
    const n=(Math.sin(x*3.1+z*2.3)+Math.sin(x*1.7-z*2.9))/4+.5;
    if(blockAt(x,z,0))tmp.copy(cPad);
    else if(blockAt(x,z,.35))tmp.copy(cWalk).lerp(cPad,n*.3);
    else{tmp.copy(cAs).lerp(cAs2,n);
      if((ST.points||[]).some(q=>Math.hypot(q.x-x,q.z-z)<q.r*1.05))tmp.copy(cPlz).lerp(cWalk,n*.5);
      if(z>FIELD.zBot-6.4||z<FIELD.zTop+.4||x<FIELD.xMin-.2||x>FIELD.xMax+.2)tmp.lerp(cDirt,.6);}
    col.push(tmp.r,tmp.g,tmp.b);
  }
  g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1})); m.receiveShadow=true; scene.add(m);
  dressUrban();
}
// 시가지 건물은 콘크리트 느낌으로 채도를 낮춤(같은 재질은 한 번만 바꿈)
const grayCache=new Map(), GRAY=new THREE.Color(0x8c8a84);
function grayMat(mt){if(!grayCache.has(mt)){const n=mt.clone();if(n.color){const hsl=n.color.getHSL({});n.color.lerp(GRAY,hsl.l>.6?.25:.55);}grayCache.set(mt,n);}return grayCache.get(mt);}
const BUILD_KEYS=["b2s","b3s","b2w","b4","houseA","houseB","b1g"];
function fillBlocks(core,maxH){
  (ST.blocks||[]).forEach((b,bi)=>{
    if(b.rock){rockBlock(b);return;}
    const w=b.x1-b.x0, d=b.z1-b.z0;
    if((b.h||1)<.5){sandbags((b.x0+b.x1)/2,(b.z0+b.z1)/2,w,0);return;} // 낮은 바리케이드
    const nx=Math.max(1,Math.round(w/1.75)), nz=Math.max(1,Math.round(d/1.75)), cw=w/nx, cd=d/nz;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
      // 안쪽 칸은 비워서 마당(가끔)
      if(nx>2&&nz>2&&i>0&&i<nx-1&&j>0&&j<nz-1&&rnd()<.6){put(rnd()<.5?"tree1":"bush",b.x0+(i+.5)*cw,b.z0+(j+.5)*cd,.6);continue;}
      const k=core?(rnd()<.55?"b4":rnd()<.5?"b3s":"b2w"):BUILD_KEYS[Math.floor(rnd()*BUILD_KEYS.length)];
      const o=glb(k,null); if(!o)continue;
      const ry=[0,Math.PI/2,Math.PI,Math.PI*1.5][Math.floor(rnd()*4)]; o.rotation.y=ry;
      const bb=new THREE.Box3().setFromObject(o), sz=bb.getSize(new THREE.Vector3());
      const sc=Math.min((cw*.94)/sz.x,(cd*.94)/sz.z,maxH*(.75+rnd()*.25)/sz.y);
      o.scale.multiplyScalar(sc); o.position.set(b.x0+(i+.5)*cw,hAt(b.x0+(i+.5)*cw,b.z0+(j+.5)*cd),b.z0+(j+.5)*cd);
      o.traverse(q=>{if(q.isMesh){q.castShadow=true;q.receiveShadow=true;q.material=Array.isArray(q.material)?q.material.map(grayMat):grayMat(q.material);}}); scene.add(o);
    }
  });
}
// 바위 절벽 덩어리(협곡): 낮은 바위 벽 + 큰 바위
function rockBlock(b){
  const w=b.x1-b.x0,d=b.z1-b.z0,h=(b.h||1.2)*.8, mat=M(TH.c);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d,Math.max(1,Math.round(w)),2,Math.max(1,Math.round(d))),mat);
  const pp=m.geometry.attributes.position;for(let i=0;i<pp.count;i++){const y=pp.getY(i);if(y>0){pp.setY(i,y+Math.sin(pp.getX(i)*2.3+pp.getZ(i)*1.7)*.18);}pp.setX(i,pp.getX(i)*(1+(y>0?-.04:0)));}
  m.geometry.computeVertexNormals();m.position.set((b.x0+b.x1)/2,hAt((b.x0+b.x1)/2,(b.z0+b.z1)/2)+h/2-.05,(b.z0+b.z1)/2);m.castShadow=true;m.receiveShadow=true;scene.add(m);
  const n=Math.min(10,Math.round(w*d/5));for(let i=0;i<n;i++){const x=b.x0+rnd()*w,z=b.z0+rnd()*d;const o=put(TH.rocks[Math.floor(rnd()*TH.rocks.length)]||"rock2",x,z,1.6+rnd()*1.4,null,m.position.y+h/2-.15);}
}
function dressUrban(){
  const core=ST.id==="core"||ST.win==="hqwaves", maxH=core?2.3:1.85;
  fillBlocks(core,maxH);
  // 길 위 잔해 · 바리케이드 · 구덩이
  const zb=FIELD.zBot, street=(x,z)=>!blockAt(x,z,.45)&&!(z>zb-5&&z<zb-.6);
  for(let i=0;i<Math.round(70*FK*FK);i++){const x=FCX+(rnd()*2-1)*(FW/2-.4),z=FIELD.zTop+.4+rnd()*(FD-7);if(!street(x,z))continue;const r=rnd();
    if(r<.3)put("crate",x,z,1);else if(r<.5)put("barrel",x,z,1);else if(r<.62)put("container",x,z,.9,rnd()<.5?0:1.57);else if(r<.8){const o=put(["rock1","rock2","rock3"][Math.floor(rnd()*3)],x,z,.6+rnd()*.5);if(o)o.position.y-=.05;}else crater(x,z,.25+rnd()*.2);}
  (ST.points||[]).forEach(q=>{for(let k=0;k<3;k++){const a=k*2.1+.5;const x=q.x+Math.cos(a)*q.r*.8,z=q.z+Math.sin(a)*q.r*.8;if(street(x,z))sandbags(x,z,.9,a+Math.PI/2);}});
  // 우리 집결지(남쪽 외곽): 천막 · 상자
  const zt=FIELD.zBot-.4;put("tent",FIELD.xMin+1,zt,.9,.2);put("tent",FIELD.xMax-.8,zt+.2,.9,-.3);[[FIELD.xMin+1.8,zt-.4],[FIELD.xMax-1.6,zt-.5]].forEach(([x,z])=>put("crate",x,z,1));
  const hq=ST.enemy.find(e=>e[0]==="hq");if(hq){put("antenna",hq[1]+1.6,hq[2]-1.6,1,0);put("antenna",hq[1]-1.6,hq[2]-1.6,1,0);}
}
/* 거점 표시: 바닥 원 + 깃대 + 이름표 */
const ptVis=[];
function nameSprite(text){const c=document.createElement("canvas");c.width=256;c.height=64;const g=c.getContext("2d");g.font="bold 30px sans-serif";g.textAlign="center";g.textBaseline="middle";
  g.fillStyle="rgba(10,16,20,.62)";const w=g.measureText(text).width+28;g.fillRect(128-w/2,8,w,48);g.fillStyle="#fff";g.fillText(text,128,33);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true}));sp.scale.set(2.4,.6,1);sp.renderOrder=30;return sp;}
function buildPoints(){
  (ST.points||[]).forEach(q=>{const y=hAt(q.x,q.z)+.05;
    const ring=new THREE.Mesh(new THREE.RingGeometry(q.r-.09,q.r,48),new THREE.MeshBasicMaterial({color:0xff3b3b,transparent:true,opacity:.85,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(q.x,y,q.z);ring.renderOrder=2;scene.add(ring);
    const fill=new THREE.Mesh(new THREE.CircleGeometry(q.r,48),new THREE.MeshBasicMaterial({color:0xff3b3b,transparent:true,opacity:.12,depthWrite:false}));fill.rotation.x=-Math.PI/2;fill.position.set(q.x,y-.01,q.z);fill.renderOrder=1;scene.add(fill);
    const prog=new THREE.Mesh(new THREE.RingGeometry(q.r+.04,q.r+.2,48,1,0,.001),new THREE.MeshBasicMaterial({color:0x3d8bff,transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide}));prog.rotation.x=-Math.PI/2;prog.position.set(q.x,y+.01,q.z);prog.renderOrder=3;scene.add(prog);
    const pole=cyl(.03,.03,1.5,MAT.steel,6);pole.position.set(q.x,y+.75,q.z);scene.add(pole);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(.6,.36),new THREE.MeshStandardMaterial({color:0xff3b3b,side:THREE.DoubleSide,roughness:.8}));flag.position.set(q.x+.3,y+1.3,q.z);scene.add(flag);
    const lab=nameSprite(q.name);lab.position.set(q.x,y+2.1,q.z);scene.add(lab);
    ptVis.push({ring,fill,prog,flag,q,last:-1,own:""});});
}
function updatePoints(time){
  ptVis.forEach((v,i)=>{const p=S.pts[i];if(!p)return;
    if(p.own!==v.own){v.own=p.own;const c=p.own==="us"?0x3d8bff:0xff3b3b;v.ring.material.color.setHex(c);v.fill.material.color.setHex(c);v.flag.material.color.setHex(c);}
    const k=p.own==="us"?1:p.prog; if(Math.abs(k-v.last)>.01){v.last=k;v.prog.geometry.dispose();v.prog.geometry=new THREE.RingGeometry(v.q.r+.04,v.q.r+.2,48,1,Math.PI/2,Math.max(.001,k*Math.PI*2));}
    v.prog.visible=k>0&&p.own!=="us"; v.flag.rotation.y=Math.sin(time*3+i)*.25; v.fill.material.opacity=.1+(p.own==="foe"&&p.prog>0?Math.sin(time*6)*.05+.05:0);});
}
function updateWater(t){
  if(!waterMesh)return; const a=waterMesh.geometry.attributes.position, b=waterMesh.userData.base;
  for(let i=0;i<a.count;i++){const x=b[i*3],z=b[i*3+2];a.array[i*3+1]=Math.sin(x*1.3+t*1.4)*.035+Math.cos(z*1.1-t*1.1)*.035;}
  a.needsUpdate=true; waterMesh.geometry.computeVertexNormals();
  foam.material.opacity=.35+Math.sin(t*1.6)*.18;
}

/* ───────── 도우미: 상자 · 원통 · 정적 메시 합치기 ───────── */
function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;return m;}
function cyl(r1,r2,h,mat,seg){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg||8),mat);m.castShadow=true;m.receiveShadow=true;return m;}
function dyn(o){o.userData.dyn=true;return o;}
// 움직이지 않는 조각을 재질별로 한 덩어리로 합쳐 그리기 횟수를 줄임(모바일)
function bake(node){
  node.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(node.matrixWorld).invert();
  const buckets=new Map(), rm=[];
  (function walk(o){for(const c of o.children.slice()){
    if(c.userData.dyn){bake(c);continue;}
    if(c.isMesh&&!c.userData.keep&&c.geometry.attributes.position.array instanceof Float32Array){
      const g=c.geometry.index?c.geometry.toNonIndexed():c.geometry.clone();
      const mtx=new THREE.Matrix4().multiplyMatrices(inv,c.matrixWorld); g.applyMatrix4(mtx);
      (buckets.get(c.material)||buckets.set(c.material,[]).get(c.material)).push(g.attributes.position.array); rm.push(c);
    }
    walk(c);
  }})(node);
  rm.forEach(c=>{c.parent.remove(c);});
  for(const [mat,arrs] of buckets){
    let n=0;arrs.forEach(a=>n+=a.length);const all=new Float32Array(n);let o=0;arrs.forEach(a=>{all.set(a,o);o+=a.length;});
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(all,3));g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;node.add(m);
  }
  return node;
}
function shapeHull(len,beam,bowK,h,mat){ // 배 바닥 모양(위에서 본 모양을 위로 밀어 올림)
  const s=new THREE.Shape(), L=len/2, B=beam/2;
  s.moveTo(-B*.8,L); s.lineTo(B*.8,L); s.lineTo(B,L*.2); s.quadraticCurveTo(B*.9,-L*bowK,0,-L); s.quadraticCurveTo(-B*.9,-L*bowK,-B,L*.2); s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false}); g.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(g,mat); m.castShadow=m.receiveShadow=true; return m;
}

/* ───────── 무료 로우폴리 모형 (Quaternius CC0 · jeremy CC-BY) ───────── */
const GLB={};
const GLB_FILES={tank:"Tank",spg:"Tank4",heli:"Heli",jet:"KF21",
  // 11-26 새 병과 모형(Sketchfab CC BY, 대장이 받아 줌) · 항공모함(Gerald Ford)
  bm:"BM",mlrs:"MLRS",sam:"SAM",csm:"CSM",uav:"UAV",f35:"F35",awacs:"AWACS",gunship:"Gunship",aav:"AAV",ford:"Ford",
  tree1:"CommonTree_1",tree2:"CommonTree_2",tree3:"CommonTree_3",tree4:"CommonTree_4",tree5:"CommonTree_5",pine1:"PineTree_1",pine2:"PineTree_2",pine3:"PineTree_3",birch:"BirchTree_1",
  rock1:"Rock_1",rock2:"Rock_2",rock3:"Rock_3",rock5:"Rock_5",mrock:"Rock_Moss_1",bush:"Bush_1",bush2:"Bush_2",grass:"Grass",dead:"CommonTree_Dead_1",stump:"TreeStump",log:"WoodLog",
  crate:"Crate",barrel:"Barrel",tent:"Tent",antenna:"Antenna_1",container:"Props_ContainerFull",
  b2s:"2Story_Mat",b1g:"1Story_GableRoof_Mat",b3s:"3Story_Small_Mat",b2w:"2Story_Wide_Mat",b4:"4Story_Mat",houseA:"Building2_Small",houseB:"Building3_Small",
  dock:"Dock_Wide",dockL:"Dock_Long_NoRope",boat:"Boat"};
// 앞쪽을 +Z로 돌리는 각도 · 맞출 크기(모형 단위)
const GLB_FIT={tank:{rot:Math.PI/2,len:1.35},spg:{rot:Math.PI/2,len:1.45},heli:{rot:-Math.PI/2,len:1.7},jet:{rot:0,len:1.9},
  bm:{rot:Math.PI,len:1.95},mlrs:{rot:Math.PI,len:1.7},sam:{rot:-Math.PI/2,len:1.75},csm:{rot:0,len:1.75},aav:{rot:0,len:1.45},
  uav:{rot:Math.PI,len:2.3},f35:{rot:Math.PI,len:1.8},awacs:{rot:Math.PI/2,len:3.1},gunship:{rot:Math.PI,len:2.7},ford:{rot:0,len:3.9},
  tree1:{h:2},tree2:{h:2.2},tree3:{h:2},tree4:{h:1.9},tree5:{h:1.8},pine1:{h:2.1},pine2:{h:2.4},pine3:{h:2.3},birch:{h:2.2},
  rock1:{len:.5},rock2:{len:.55},rock3:{len:.5},rock5:{len:.7},mrock:{h:.6},bush:{h:.5},bush2:{h:.45},grass:{h:.28},dead:{h:1.7},stump:{len:.45},log:{len:.9},
  crate:{h:.24},barrel:{h:.3},tent:{len:1.1},antenna:{h:1.8},container:{len:1.15},
  b2s:{h:1.6},b1g:{h:1.15},b3s:{h:2.1},b2w:{h:1.6},b4:{h:2.7},houseA:{h:1.5},houseB:{h:1.7},dock:{len:2.6},dockL:{len:2.8},boat:{len:.9}};
// 주변 사물은 매끈한 음영: 각진 면을 이웃 면과 부드럽게 이어 줌(꺾인 각도가 큰 모서리는 그대로 살림)
const SMOOTH={};
["tree1","tree2","tree3","tree4","tree5","pine1","pine2","pine3","birch","rock1","rock2","rock3","rock5","mrock","bush","bush2","grass","dead","stump","log"].forEach(k=>SMOOTH[k]=72);
["crate","barrel","tent","antenna","container","b2s","b1g","b3s","b2w","b4","houseA","houseB","dock","dockL","boat"].forEach(k=>SMOOTH[k]=34);
function smoothNormals(mesh,crease){
  const g0=mesh.geometry, pa=g0.attributes.position, idx=g0.index, n=idx?idx.count:pa.count, g=new THREE.BufferGeometry();
  const arr=pa.isInterleavedBufferAttribute?pa.data.array:pa.array;
  const dv=!pa.normalized?1:arr instanceof Int16Array?32767:arr instanceof Uint16Array?65535:arr instanceof Int8Array?127:arr instanceof Uint8Array?255:1;
  const loc=new Float32Array(n*3);
  for(let i=0;i<n;i++){const s=idx?idx.getX(i):i;loc[i*3]=pa.getX(s)/dv;loc[i*3+1]=pa.getY(s)/dv;loc[i*3+2]=pa.getZ(s)/dv;}
  const M=mesh.matrixWorld, W=new Float32Array(n*3), v=new THREE.Vector3();
  for(let i=0;i<n;i++){v.set(loc[i*3],loc[i*3+1],loc[i*3+2]).applyMatrix4(M);W[i*3]=v.x;W[i*3+1]=v.y;W[i*3+2]=v.z;}
  const fn=new Float32Array(n*3), a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3();
  for(let t=0;t<n;t+=3){a.fromArray(W,t*3);b.fromArray(W,t*3+3);c.fromArray(W,t*3+6);c.sub(b);b.sub(a);c.cross(b).negate(); // 넓이만큼 무게
    for(let k=0;k<3;k++){fn[(t+k)*3]=c.x;fn[(t+k)*3+1]=c.y;fn[(t+k)*3+2]=c.z;}}
  const groups=new Map(), q=1e4, key=i=>Math.round(W[i*3]*q)+","+Math.round(W[i*3+1]*q)+","+Math.round(W[i*3+2]*q);
  for(let i=0;i<n;i++){const kk=key(i);(groups.get(kk)||groups.set(kk,[]).get(kk)).push(i);}
  const cosC=Math.cos(crease*Math.PI/180), out=new Float32Array(n*3), fi=new THREE.Vector3(), fj=new THREE.Vector3(), s=new THREE.Vector3();
  const N3=new THREE.Matrix3().setFromMatrix4(M).transpose();
  for(const list of groups.values()){for(const i of list){fi.fromArray(fn,i*3);const li=fi.length()||1;s.set(0,0,0);
    for(const j of list){fj.fromArray(fn,j*3);if(fj.dot(fi)/(li*(fj.length()||1))>=cosC)s.add(fj);}
    s.applyMatrix3(N3).normalize(); out[i*3]=s.x;out[i*3+1]=s.y;out[i*3+2]=s.z;}}
  for(const nm in g0.attributes){if(nm==="position"||nm==="normal")continue;const at=g0.attributes[nm],sz=at.itemSize,o=new Float32Array(n*sz),ar=at.isInterleavedBufferAttribute?at.data.array:at.array;
    const d=!at.normalized?1:ar instanceof Int16Array?32767:ar instanceof Uint16Array?65535:ar instanceof Int8Array?127:ar instanceof Uint8Array?255:1;
    for(let i=0;i<n;i++){const src=idx?idx.getX(i):i;for(let c=0;c<sz;c++)o[i*sz+c]=at.getComponent?at.getComponent(src,c)/d:[at.getX(src),at.getY(src),at.getZ(src),at.getW(src)][c]/d;}
    g.setAttribute(nm,new THREE.BufferAttribute(o,sz));}
  for(const gr of g0.groups)g.addGroup(gr.start,gr.count,gr.materialIndex);
  g.setAttribute("position",new THREE.BufferAttribute(loc,3)); g.setAttribute("normal",new THREE.BufferAttribute(out,3));
  g.computeBoundingSphere(); g.computeBoundingBox(); mesh.geometry=g;
}
function loadModels(){
  const L=new GLTFLoader();
  const getBuf=f=>fetch(GLB_BASE+f+".glb").then(r=>{if(!r.ok)throw 0;return r.arrayBuffer();});
  return Promise.all(Object.entries(GLB_FILES).map(([k,f])=>new Promise(res=>getBuf(f).then(buf=>L.parse(buf,"",g=>{
    const o=g.scene; o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;m.userData.keep=true;const mats=Array.isArray(m.material)?m.material:[m.material];
      mats.forEach(mt=>{if(mt.color){const c=mt.color;c.setRGB(Math.min(1,c.r*1.7+.03),Math.min(1,c.g*1.7+.03),Math.min(1,c.b*1.7+.03));}mt.flatShading=!SMOOTH[k];mt.metalness=0;mt.roughness=Math.max(.7,mt.roughness||0);mt.needsUpdate=true;});}});
    if(SMOOTH[k]){o.updateMatrixWorld(true);o.traverse(m=>{if(m.isMesh)smoothNormals(m,SMOOTH[k]);});}
    const fit=GLB_FIT[k]; const wrap=new THREE.Group(); o.rotation.y=fit.rot||0; wrap.add(o);
    const b=new THREE.Box3().setFromObject(wrap), sz=b.getSize(new THREE.Vector3());
    o.scale.setScalar(fit.h?fit.h/sz.y:fit.len/Math.max(sz.x,sz.z)); o.updateMatrixWorld(true);
    const b2=new THREE.Box3().setFromObject(wrap), c=b2.getCenter(new THREE.Vector3());
    o.position.set(-c.x,-b2.min.y,-c.z); GLB[k]=wrap; res();
  },()=>res())).catch(()=>res()))));
}
// 유닛 모형은 우리 팀 색표로 다시 칠해서 코드로 만든 모형과 느낌을 맞춤
const tintCache={};
function glb(k,side){
  const src=GLB[k]; if(!src)return null; const o=src.clone(true);
  if(!side)return o;
  const key=k+side; const cache=tintCache[key]||(tintCache[key]=new Map());
  const P=PAL[side], hull=new THREE.Color(P.hull), dark=new THREE.Color(P.dark), light=new THREE.Color(P.light);
  o.traverse(m=>{if(!m.isMesh)return;const one=mt=>{if(!cache.has(mt)){const n=mt.clone();if(n.color){const hsl=n.color.getHSL({});
        if(hsl.s>.45&&hsl.h>.45&&hsl.h<.6)n.color.set(0x274452);             // 유리창
        else if(hsl.l<.14)n.color.copy(MAT.track.color);                     // 바퀴 · 궤도
        else if(hsl.l<.3)n.color.copy(dark);
        else if(hsl.l<.55)n.color.copy(hull);
        else n.color.copy(light);}
        cache.set(mt,n);}return cache.get(mt);};
      m.material=Array.isArray(m.material)?m.material.map(one):one(m.material);});
  return o;
}

/* ───────── 유닛 모형 (모형 단위, 나중에 SC배로 줄임) ───────── */
function soldier(side,spec){
  const P=PAL[side], cloth=tm(side,"cloth");
  const g=new THREE.Group();
  const legs=[-.035,.035].map(x=>{const pv=dyn(new THREE.Group());pv.position.set(x,.14,0);pv.add(box(.05,.14,.06,spec?MAT.black:MAT.pants,0,-.07,0),box(.055,.035,.08,MAT.track,0,-.13,.01));g.add(pv);return pv;});
  g.add(box(.13,.15,.08,spec?MAT.black:cloth,0,.215,0),box(.14,.1,.09,MAT.vest,0,.225,.003),box(.1,.11,.05,MAT.vest,0,.23,-.065));
  const h=new THREE.Mesh(new THREE.IcosahedronGeometry(.055,0),spec?MAT.black:MAT.skin); h.position.y=.34; g.add(h);
  const helm=new THREE.Mesh(new THREE.SphereGeometry(.068,7,4,0,Math.PI*2,0,Math.PI/2),spec?MAT.vest:cloth); helm.position.y=.35; helm.scale.set(1,.85,1.08); g.add(helm);
  if(spec)g.add(box(.09,.025,.03,MAT.glass,0,.345,.05));
  const aL=box(.035,.12,.04,spec?MAT.black:cloth,-.08,.21,.04); aL.rotation.x=-.9; const aR=box(.035,.12,.04,spec?MAT.black:cloth,.08,.21,.04); aR.rotation.x=-1.1; g.add(aL,aR);
  g.add(box(.025,.035,.26,MAT.metal,.03,.23,.1),box(.02,.05,.03,MAT.metal,.03,.195,.08),box(.014,.014,spec?.14:.08,MAT.metal,.03,.235,spec?.28:.26));
  g.userData.legs=legs; g.scale.setScalar(1.25); return dyn(g);
}
const NEW_GLB=new Set(["bm","mlrs","sam","csm","uav","f35","awacs","gunship","aav","cv"]);
function makeModel(kind,side){
  if(DEF[kind].look){const m=makeModel(DEF[kind].look,side);if(DEF[kind].lookScale)m.root.scale.multiplyScalar(DEF[kind].lookScale);if(DEF[kind].ally){m.parts.ring.material.color.setHex(0x5dffb0);m.parts.hpf.material.color.setHex(0x5dffb0);}return m;}
  const P=PAL[side], hull=tm(side,"hull"), dark=tm(side,"dark"), light=tm(side,"light"), ship=tm(side,"ship"), deck=tm(side,"deck");
  const root=new THREE.Group(), body=new THREE.Group(); root.add(body);
  const parts={body}; const d=DEF[kind];
  const gk=d.model||kind;
  const gm=(gk==="tank"||gk==="spg"||gk==="jet"||gk==="heli")?glb(gk,side):null;
  // 11-26 새 병과·항공모함: 받은 모형이 있으면 그것, 없으면 아래 코드 모형
  const NG=NEW_GLB.has(kind)?glb(kind==="cv"?"ford":kind,side):null;
  if(NG&&d.dom!=="air"){
    body.add(NG); parts.model=true;
    if(kind==="cv"){parts.ship=true;parts.muzzle=new THREE.Vector3(.4,.8,0);}
    else parts.muzzle=new THREE.Vector3(0,kind==="aav"?.6:.9,.7);
  }else if(NG){
    const pl=dyn(new THREE.Group()); pl.position.set(kind==="uav"?.8:kind==="gunship"?1.3:0,d.y,0); pl.add(NG); body.add(pl);
    if(d.jet){const glow=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),fireMat);glow.position.set(0,.05,-.9);if(kind!=="awacs")pl.add(glow);}
    parts.plane=pl; parts.loiter=kind==="uav"||kind==="gunship"; parts.muzzle=new THREE.Vector3(pl.position.x,d.y,.8);
  }else if(gm&&(kind==="tank"||kind==="spg")){
    body.add(gm); parts.model=true; parts.muzzle=kind==="tank"?new THREE.Vector3(0,.42,1.05):new THREE.Vector3(0,.7,1.15);
  }else if(kind==="tank"||kind==="spg"){
    body.add(box(.34,.26,1.25,MAT.track,-.36,.13,0),box(.34,.26,1.25,MAT.track,.36,.13,0),box(.78,.24,1.15,hull,0,.32,0));
    const tur=dyn(new THREE.Group()); tur.position.y=.46; tur.add(box(.52,.2,.6,hull,0,.1,-.05));
    const bar=cyl(.035,.04,.9,MAT.metal,6); bar.rotation.x=Math.PI/2; bar.position.set(0,.1,.62); tur.add(bar);
    body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,.56,1.08);
  }else if(kind==="jet"||kind==="cvjet"){
    const pl=dyn(new THREE.Group()); pl.position.y=d.y; body.add(pl);
    if(gm){gm.position.y=-.2;pl.add(gm);}else{const f=cyl(.09,.13,1.5,hull,6);f.rotation.x=Math.PI/2;pl.add(f,box(1.8,.04,.5,hull,0,0,-.1));}
    const glow=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),fireMat); glow.position.set(0,0,-.95); pl.add(glow);
    if(kind==="cvjet")pl.scale.setScalar(.8);
    parts.plane=pl; parts.muzzle=new THREE.Vector3(0,d.y,1);
  }else if(kind==="heli"){
    const h=dyn(new THREE.Group()); h.position.y=d.y; body.add(h);
    if(gm){h.add(gm);gm.position.y-=.35;}else h.add(box(.3,.3,.8,hull,0,0,0));
    [-.32,.32].forEach(x=>{const pod=cyl(.05,.05,.32,dark,6);pod.rotation.x=Math.PI/2;pod.position.set(x,-.22,.15);h.add(pod);});
    const rot=dyn(new THREE.Group()); rot.position.y=gm?.22:.2; rot.add(box(1.9,.015,.06,MAT.metal,0,0,0),box(.06,.015,1.9,MAT.metal,0,0,0)); h.add(rot);
    parts.heli=h; parts.rot=[rot]; parts.muzzle=new THREE.Vector3(0,d.y,.6);
  }else if(kind==="inf"||kind==="sf"){
    parts.men=[];
    const off=kind==="sf"?[[0,.2],[-.24,-.1],[.24,-.1]]:[[0,.24],[-.26,0],[.26,0],[0,-.26]];
    off.forEach(([x,z])=>{const s=soldier(side,kind==="sf");s.position.set(x,0,z);s.userData.base=new THREE.Vector3(x,0,z);body.add(s);parts.men.push(s);});
    parts.muzzle=new THREE.Vector3(0,.3,.4);
  }else if(kind==="ifv"){
    body.add(box(.74,.3,1.3,hull,0,.32,0),box(.6,.16,.36,hull,0,.4,.62),box(.76,.05,1.32,dark,0,.48,-.02),box(.5,.18,.04,dark,0,.3,-.66));
    const fr=box(.66,.2,.2,hull,0,.24,.74); fr.rotation.x=.6; body.add(fr);
    [-.48,-.16,.16,.48].forEach(z=>[-.4,.4].forEach(x=>{const w=cyl(.14,.14,.1,MAT.track,10);w.rotation.z=Math.PI/2;w.position.set(x,.14,z);body.add(w);}));
    const tur=dyn(new THREE.Group()); tur.position.set(0,.5,.05); tur.add(box(.36,.14,.4,dark,0,.07,0),box(.12,.1,.1,MAT.metal,.12,.12,-.12));
    const bar=cyl(.022,.022,.55,MAT.metal,6); bar.rotation.x=Math.PI/2; bar.position.set(0,.08,.42); tur.add(bar);
    body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,.58,.75);
  }else if(kind==="hack"){
    body.add(box(.6,.26,.38,dark,0,.33,.48),box(.5,.12,.04,MAT.glass,0,.42,.67),box(.66,.5,.86,hull,0,.47,-.2),box(.68,.05,.88,dark,0,.73,-.2));
    [.45,-.05,-.4].forEach(z=>[-.3,.3].forEach(x=>{const w=cyl(.12,.12,.1,MAT.track,10);w.rotation.z=Math.PI/2;w.position.set(x,.12,z);body.add(w);}));
    [-.22,.22].forEach(x=>{const a=cyl(.01,.01,.9,MAT.steel,4);a.position.set(x,1.15,-.5);body.add(a);});
    const dish=dyn(new THREE.Group()); dish.position.set(0,.85,-.05);
    const dd=new THREE.Mesh(new THREE.SphereGeometry(.2,10,5,0,Math.PI*2,0,Math.PI/2.3),MAT.white); dd.rotation.x=-1.2; dd.position.y=.12; dish.add(dd,cyl(.03,.03,.14,MAT.metal,5));
    body.add(dish); parts.dish=dish;
    const led=new THREE.Mesh(new THREE.SphereGeometry(.04,5,4),new THREE.MeshBasicMaterial({color:0x6bf2ff})); led.position.set(0,.8,.2); dyn(led); body.add(led); parts.led=led;
    parts.muzzle=new THREE.Vector3(0,.95,-.05);
  }else if(kind==="aa"){
    body.add(box(.74,.26,1.25,hull,0,.3,0),box(.6,.12,.3,dark,0,.36,.58),box(.76,.05,1.27,dark,0,.44,0));
    [-.42,-.14,.14,.42].forEach(z=>[-.4,.4].forEach(x=>{const w=cyl(.13,.13,.1,MAT.track,10);w.rotation.z=Math.PI/2;w.position.set(x,.13,z);body.add(w);}));
    const tur=dyn(new THREE.Group()); tur.position.set(0,.46,-.1);
    tur.add(box(.56,.24,.52,hull,0,.12,0),box(.2,.16,.2,dark,0,.3,-.08));
    const dish=dyn(new THREE.Group()); dish.position.set(0,.5,-.12); const dd=box(.42,.16,.025,MAT.metal,0,0,0); dd.rotation.x=-.3; dish.add(dd,box(.03,.14,.03,MAT.metal,0,-.08,0)); tur.add(dish); parts.dish=dish;
    const pv=dyn(new THREE.Group()); pv.position.set(0,.15,.2);
    [-.2,.2].forEach(x=>{pv.add(box(.1,.12,.18,dark,x,0,.02));const b=cyl(.022,.026,.85,MAT.metal,6);b.rotation.x=Math.PI/2;b.position.set(x,.01,.48);pv.add(b);});
    pv.rotation.x=-.45; tur.add(pv);
    body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,.75,1.0);
  }else if(kind==="drone"){ // 자폭 드론(삼각 날개)
    const pl=dyn(new THREE.Group()); pl.position.y=d.y; body.add(pl);
    const s=new THREE.Shape(); s.moveTo(0,-.42); s.lineTo(.42,.3); s.lineTo(.1,.24); s.lineTo(0,.3); s.lineTo(-.1,.24); s.lineTo(-.42,.3); s.closePath();
    const w=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.04,bevelEnabled:false}),hull); w.rotation.x=-Math.PI/2; pl.add(w);
    const f=cyl(.05,.06,.6,dark,6); f.rotation.x=Math.PI/2; f.position.y=.04; pl.add(f);
    [-.36,.36].forEach(x=>pl.add(box(.02,.12,.1,dark,x,.06,-.26)));
    const prop=dyn(new THREE.Group()); prop.position.set(0,.04,-.33); prop.add(box(.24,.02,.015,MAT.metal,0,0,0)); pl.add(prop);
    const led=new THREE.Mesh(new THREE.SphereGeometry(.03,5,4),new THREE.MeshBasicMaterial({color:P.accent})); dyn(led); led.position.set(0,.08,.1); pl.add(led);
    parts.plane=pl; parts.rot=[prop]; parts.led=led; parts.muzzle=new THREE.Vector3(0,d.y,.3);
  }else if(kind==="bomber"){ // 날개 하나로 된 폭격기
    const pl=dyn(new THREE.Group()); pl.position.y=d.y; body.add(pl);
    const s=new THREE.Shape(); s.moveTo(0,-.9); s.lineTo(1.6,.35); s.lineTo(1.35,.5); s.lineTo(.95,.32); s.lineTo(.6,.52); s.lineTo(.3,.34); s.lineTo(0,.52); s.lineTo(-.3,.34); s.lineTo(-.6,.52); s.lineTo(-.95,.32); s.lineTo(-1.35,.5); s.lineTo(-1.6,.35); s.closePath();
    const w=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false}),dark); w.rotation.x=-Math.PI/2; pl.add(w);
    const hump=new THREE.Mesh(new THREE.SphereGeometry(.32,8,5,0,Math.PI*2,0,Math.PI/2),dark); hump.scale.set(1,.45,2.2); hump.position.set(0,.08,-.05); pl.add(hump);
    pl.add(box(.3,.04,.12,MAT.glass,0,.2,-.42));
    [-.45,.45].forEach(x=>{const g2=new THREE.Mesh(new THREE.SphereGeometry(.06,6,4),fireMat);g2.position.set(x,.05,.45);pl.add(g2);});
    parts.plane=pl; parts.muzzle=new THREE.Vector3(0,d.y-.1,0);
  }else if(kind==="missile"){
    body.add(box(.5,.12,1.1,dark,0,.06,0),box(.08,.4,.08,MAT.metal,0,.28,-.2));
    const ms=dyn(new THREE.Group()); ms.position.set(0,.55,0); ms.rotation.x=-.25;
    const b=cyl(.07,.07,1.1,MAT.white,8); b.rotation.x=Math.PI/2; ms.add(b);
    const n=new THREE.Mesh(new THREE.ConeGeometry(.07,.22,8),MAT.red); n.rotation.x=Math.PI/2; n.position.z=.66; ms.add(n);
    [0,1,2,3].forEach(i=>{const f=box(.015,.16,.14,dark,0,0,-.5);const pv=new THREE.Group();pv.rotation.z=i*Math.PI/2;f.position.y=.1;pv.add(f);ms.add(pv);});
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.06,.3,6),fireMat); flame.rotation.x=-Math.PI/2; flame.position.z=-.72; flame.visible=false; dyn(flame); ms.add(flame);
    body.add(ms); parts.ms=ms; parts.flame=flame; parts.muzzle=new THREE.Vector3(0,.55,.6);
  }else if(kind==="dd"){
    body.add(shapeHull(2.5,.56,.2,.26,ship),box(.5,.04,2.2,deck,0,.27,.05));
    body.add(box(.36,.3,.6,ship,0,.42,-.15),box(.28,.22,.32,ship,0,.66,-.05),box(.24,.08,.06,MAT.glass,0,.72,.1),box(.2,.26,.2,ship,0,.47,-.65));
    const mast=cyl(.025,.035,.7,MAT.steel,5); mast.position.set(0,1.1,-.1); body.add(mast,box(.3,.02,.02,MAT.steel,0,1.25,-.1));
    [-.19,.19].forEach(x=>{const p=box(.02,.18,.18,MAT.metal,x,.58,-.05);body.add(p);});
    body.add(box(.3,.03,.24,MAT.black,0,.29,.55));
    const tur=dyn(new THREE.Group()); tur.position.set(0,.3,.85); tur.add(box(.2,.12,.22,ship,0,.06,0)); const b=cyl(.02,.025,.4,MAT.metal,6); b.rotation.x=Math.PI/2; b.position.set(0,.08,.28); tur.add(b);
    body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,.38,1.2);
    const ciws=dyn(new THREE.Group()); ciws.position.set(0,.6,-.8); ciws.add(cyl(.06,.07,.12,MAT.white,8)); body.add(ciws);
    parts.ship=true;
  }else if(kind==="cv"){
    body.add(shapeHull(3.9,.9,.35,.36,ship),box(1.15,.06,3.7,deck,.08,.39,.05));
    const ang=box(.5,.061,1.6,deck,-.32,.39,-.6); ang.rotation.y=.16; body.add(ang);
    for(let i=0;i<7;i++)body.add(box(.03,.005,.24,MAT.stripe,.08,.425,1.6-i*.5));
    body.add(box(.22,.42,.7,ship,.5,.62,-.2),box(.18,.18,.36,ship,.5,.92,-.25),box(.2,.06,.04,MAT.glass,.5,.96,-.05));
    const mast=cyl(.02,.03,.5,MAT.steel,5); mast.position.set(.5,1.25,-.25); body.add(mast);
    const rad=dyn(new THREE.Group()); rad.position.set(.5,1.4,-.25); rad.add(box(.3,.08,.02,MAT.steel,0,0,0)); body.add(rad); parts.dish=rad;
    [[-.2,.4],[.15,-1.1],[-.25,-1.4]].forEach(([x,z])=>{const j=glb("jet",side);if(j){j.scale.multiplyScalar(.38);j.position.set(x,.43,z);j.rotation.y=Math.PI*.9;body.add(j);}else body.add(box(.3,.04,.35,dark,x,.44,z));});
    parts.muzzle=new THREE.Vector3(.4,.8,0); parts.ship=true;
  }else if(kind==="lha"){
    body.add(shapeHull(3.4,.82,.25,.42,ship),box(.84,.06,2.9,deck,0,.45,.15),box(.6,.24,.3,ship,0,.3,-1.6));
    body.add(box(.2,.46,.8,ship,.32,.7,-.25),box(.16,.16,.4,ship,.32,1.0,-.3),box(.18,.06,.04,MAT.glass,.32,1.02,-.1));
    for(let i=0;i<5;i++){const c=new THREE.Mesh(new THREE.CircleGeometry(.12,10),MAT.stripe);c.rotation.x=-Math.PI/2;c.position.set(-.18,.485,1.2-i*.55);body.add(c);}
    [[-.18,.65],[-.18,-.45]].forEach(([x,z])=>{const h=glb("heli",side);if(h){h.scale.multiplyScalar(.36);h.position.set(x,.48,z);h.rotation.y=.3;body.add(h);}});
    const mast=cyl(.02,.03,.5,MAT.steel,5); mast.position.set(.32,1.3,-.3); body.add(mast);
    parts.muzzle=new THREE.Vector3(.3,.9,0); parts.ship=true;
  }else if(kind==="laser"){
    body.add(shapeHull(2.6,.62,.2,.28,ship),box(.54,.04,2.3,deck,0,.29,.05));
    body.add(box(.42,.36,.8,ship,0,.47,-.15),box(.32,.26,.4,ship,0,.78,-.12));
    [[-.17,0],[.17,0]].forEach(([x])=>{const pn=box(.02,.26,.3,MAT.metal,x,.8,-.12);body.add(pn);});
    const tur=dyn(new THREE.Group()); tur.position.set(0,.34,.75);
    tur.add(cyl(.14,.16,.12,ship,10));
    const dome=new THREE.Mesh(new THREE.SphereGeometry(.13,10,6,0,Math.PI*2,0,Math.PI/2),MAT.steel); dome.position.y=.06; tur.add(dome);
    const lens=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),MAT.glow); lens.position.set(0,.13,.09); tur.add(lens);
    body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,.48,.84);
    const t2=dyn(new THREE.Group()); t2.position.set(0,.95,-.12); t2.add(cyl(.08,.09,.1,ship,8)); const l2=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),MAT.glow); l2.position.y=.07; t2.add(l2); body.add(t2);
    parts.ship=true;
  }else if(kind==="sub"||kind==="ssn"){
    const big=kind==="ssn", L=big?2.5:2.0, R=big?.2:.16;
    const hullM=MAT.black;
    const hb=cyl(R,R,L,hullM,10); hb.rotation.x=Math.PI/2; body.add(hb);
    const bow=new THREE.Mesh(new THREE.SphereGeometry(R,10,6),hullM); bow.scale.z=1.6; bow.position.z=L/2; body.add(bow);
    const st=new THREE.Mesh(new THREE.ConeGeometry(R,L*.35,10),hullM); st.rotation.x=-Math.PI/2; st.position.z=-L/2-L*.17; body.add(st);
    body.add(box(.12,big?.34:.3,big?.46:.4,hullM,0,R+.12,L*.18),box(.4,.02,.08,hullM,0,R+.2,L*.18));
    if(big)body.add(box(.24,.08,.7,hullM,0,R+.02,-L*.12));
    body.add(box(.5,.02,.1,hullM,0,0,-L/2-.1),box(.02,.34,.1,hullM,0,0,-L/2-.1));
    body.position.y=-R*.6; parts.muzzle=new THREE.Vector3(0,0,L/2+.2); parts.sub=true;
  }else if(kind==="bm"){ // 탄도미사일 발사차: 바퀴 8개 · 운전석 · 눕혀 둔 미사일(쏠 때 세움)
    body.add(box(.7,.22,1.9,dark,0,.3,0),box(.66,.36,.42,hull,0,.5,.78),box(.5,.1,.04,MAT.glass,0,.62,1.0));
    [-.7,-.3,.1,.5].forEach(z=>[-.36,.36].forEach(x=>{const w=cyl(.15,.15,.12,MAT.track,10);w.rotation.z=Math.PI/2;w.position.set(x,.15,z);body.add(w);}));
    const er=dyn(new THREE.Group()); er.position.set(0,.5,-.85);
    const mb=cyl(.12,.12,1.55,MAT.white,10); mb.rotation.x=Math.PI/2; mb.position.z=.8; er.add(mb);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.12,.35,10),hull); nose.rotation.x=Math.PI/2; nose.position.z=1.75; er.add(nose);
    [0,1,2,3].forEach(i=>{const f=box(.015,.16,.16,dark,0,0,.12);const pv=new THREE.Group();pv.rotation.z=i*Math.PI/2+.78;f.position.y=.15;pv.add(f);er.add(pv);});
    er.add(box(.3,.05,1.5,MAT.metal,0,-.14,.8));
    body.add(er); parts.erect=er; parts.muzzle=new THREE.Vector3(0,1.6,-.85);
  }else if(kind==="mlrs"){ // 다연장로켓: 트럭 + 로켓 상자(구멍 12개)
    body.add(box(.7,.22,1.6,dark,0,.3,0),box(.66,.36,.42,hull,0,.5,.62),box(.5,.1,.04,MAT.glass,0,.62,.84));
    [-.55,-.15,.4].forEach(z=>[-.36,.36].forEach(x=>{const w=cyl(.15,.15,.12,MAT.track,10);w.rotation.z=Math.PI/2;w.position.set(x,.15,z);body.add(w);}));
    const tur=dyn(new THREE.Group()); tur.position.set(0,.5,-.35);
    const pod=new THREE.Group(); pod.rotation.x=-.45; pod.add(box(.6,.38,.95,hull,0,.19,.05),box(.62,.05,.97,dark,0,.4,.05));
    for(let r=0;r<3;r++)for(let c=0;c<4;c++)pod.add(box(.1,.08,.02,MAT.black,-.2+c*.135,.08+r*.11,.53));
    tur.add(pod); body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,.95,.2);
  }else if(kind==="sam"){ // 장거리 방공: 발사관 4개를 비스듬히 세운 발사대 + 레이더 판
    body.add(box(.66,.2,1.55,dark,0,.28,0),box(.62,.34,.38,hull,0,.47,.62),box(.48,.1,.04,MAT.glass,0,.58,.82));
    [-.55,-.15,.45].forEach(z=>[-.36,.36].forEach(x=>{const w=cyl(.15,.15,.12,MAT.track,10);w.rotation.z=Math.PI/2;w.position.set(x,.15,z);body.add(w);}));
    const tur=dyn(new THREE.Group()); tur.position.set(0,.42,-.25);
    const pod=new THREE.Group(); pod.rotation.x=-.8; pod.add(box(.6,.44,1.05,light,0,.22,.35));
    [[-.15,.11],[.15,.11],[-.15,.33],[.15,.33]].forEach(([x,y])=>pod.add(box(.22,.18,.02,MAT.black,x,y,.88)));
    tur.add(pod); body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,1.2,.3);
    const dish=dyn(new THREE.Group()); dish.position.set(0,.85,.62); const pn=box(.44,.3,.04,MAT.steel,0,0,0); pn.rotation.x=-.35; dish.add(pn,box(.04,.2,.04,MAT.metal,0,-.15,0)); body.add(dish); parts.dish=dish;
  }else if(kind==="csm"){ // 해안 지대함 미사일: 트럭 + 긴 통 2개
    body.add(box(.7,.22,1.7,dark,0,.3,0),box(.66,.36,.42,hull,0,.5,.68),box(.5,.1,.04,MAT.glass,0,.62,.9));
    [-.6,-.2,.45].forEach(z=>[-.36,.36].forEach(x=>{const w=cyl(.15,.15,.12,MAT.track,10);w.rotation.z=Math.PI/2;w.position.set(x,.15,z);body.add(w);}));
    const tur=dyn(new THREE.Group()); tur.position.set(0,.5,-.6);
    const pod=new THREE.Group(); pod.rotation.x=-.32;
    [-.15,.15].forEach(x=>{const c=cyl(.12,.12,1.3,light,8);c.rotation.x=Math.PI/2;c.position.set(x,.14,.55);pod.add(c);pod.add(box(.22,.22,.03,MAT.black,x,.14,1.2));});
    tur.add(pod); body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(0,.95,.75);
  }else if(kind==="uav"){ // 정찰 무인기: 긴 날개 · V꼬리 · 뒤 프로펠러(빙빙 돌며 내려다봄)
    const pl=dyn(new THREE.Group()); pl.position.set(.8,d.y,0); body.add(pl);
    const f=cyl(.07,.05,1.15,light,8); f.rotation.x=Math.PI/2; pl.add(f);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),light); nose.scale.z=1.5; nose.position.z=.58; pl.add(nose);
    pl.add(box(2.3,.025,.16,hull,0,.03,.05));
    [-1,1].forEach(sx=>{const t=box(.4,.02,.12,hull,sx*.14,.08,-.5);t.rotation.z=sx*.6;pl.add(t);});
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.05,6,5),MAT.glass); ball.position.set(0,-.08,.45); pl.add(ball);
    const prop=dyn(new THREE.Group()); prop.position.set(0,0,-.6); prop.add(box(.34,.02,.02,MAT.metal,0,0,0)); pl.add(prop);
    parts.plane=pl; parts.rot=[prop]; parts.loiter=true; parts.muzzle=new THREE.Vector3(.8,d.y,.5);
  }else if(kind==="f35"){ // 스텔스 전투기: 각진 마름모 날개 · 기울어진 꼬리 둘
    const pl=dyn(new THREE.Group()); pl.position.y=d.y; body.add(pl);
    const s=new THREE.Shape(); s.moveTo(0,-1); s.lineTo(.16,-.45); s.lineTo(.82,.18); s.lineTo(.82,.34); s.lineTo(.28,.3); s.lineTo(.4,.6); s.lineTo(.12,.58); s.lineTo(0,.5); s.lineTo(-.12,.58); s.lineTo(-.4,.6); s.lineTo(-.28,.3); s.lineTo(-.82,.34); s.lineTo(-.82,.18); s.lineTo(-.16,-.45); s.closePath();
    const w=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false}),dark); w.rotation.x=-Math.PI/2; pl.add(w);
    const hump=new THREE.Mesh(new THREE.SphereGeometry(.16,8,5,0,Math.PI*2,0,Math.PI/2),dark); hump.scale.set(1,.6,3.2); hump.position.set(0,.08,0); pl.add(hump);
    const can=new THREE.Mesh(new THREE.SphereGeometry(.07,8,5),MAT.glass); can.scale.set(1,.7,2); can.position.set(0,.18,.45); pl.add(can);
    [-1,1].forEach(sx=>{const t=box(.02,.26,.26,dark,sx*.2,.2,-.38);t.rotation.z=sx*.4;pl.add(t);});
    const glow=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),fireMat); glow.position.set(0,.08,-.55); pl.add(glow);
    parts.plane=pl; parts.muzzle=new THREE.Vector3(0,d.y,1);
  }else if(kind==="awacs"){ // 조기경보기: 큰 여객기 몸통 + 등 위 둥근 레이더
    const pl=dyn(new THREE.Group()); pl.position.y=d.y; body.add(pl);
    const f=cyl(.15,.13,2.4,light,10); f.rotation.x=Math.PI/2; pl.add(f);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),light); nose.scale.z=1.6; nose.position.z=1.2; pl.add(nose);
    const wg=new THREE.Shape(); wg.moveTo(0,-.35); wg.lineTo(1.5,.25); wg.lineTo(1.5,.42); wg.lineTo(0,.2); wg.lineTo(-1.5,.42); wg.lineTo(-1.5,.25); wg.closePath();
    const wm=new THREE.Mesh(new THREE.ExtrudeGeometry(wg,{depth:.05,bevelEnabled:false}),hull); wm.rotation.x=-Math.PI/2; wm.position.y=-.06; pl.add(wm);
    pl.add(box(.9,.03,.24,hull,0,0,-1.05),box(.03,.4,.3,hull,0,.22,-1.08));
    [-.75,-.4,.4,.75].forEach(x=>{const e=cyl(.06,.06,.3,dark,6);e.rotation.x=Math.PI/2;e.position.set(x,-.13,.15+Math.abs(x)*.15);pl.add(e);});
    [-.1,.1].forEach(z=>pl.add(box(.04,.22,.04,MAT.metal,0,.24,-.25+z)));
    const dish=dyn(new THREE.Group()); dish.position.set(0,.38,-.25); const dm=cyl(.5,.5,.09,MAT.white,16); dish.add(dm,box(.9,.1,.04,dark,0,0,0)); pl.add(dish); parts.dish=dish;
    parts.plane=pl; parts.muzzle=new THREE.Vector3(0,d.y,1);
  }else if(kind==="gunship"){ // 지상 공격기(건쉽): 프로펠러 넷 수송기 · 왼쪽 옆구리 포(표적 둘레를 돌며 쏨)
    const pl=dyn(new THREE.Group()); pl.position.set(1.3,d.y,0); body.add(pl);
    const f=cyl(.17,.15,1.9,light,10); f.rotation.x=Math.PI/2; pl.add(f);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.17,8,6),light); nose.scale.z=1.3; nose.position.z=.95; pl.add(nose);
    pl.add(box(2.6,.05,.34,hull,0,.16,.15),box(.9,.03,.24,hull,0,.1,-.85),box(.03,.42,.34,hull,0,.32,-.85));
    const rot=[];[-.95,-.5,.5,.95].forEach(x=>{const e=cyl(.06,.06,.32,dark,6);e.rotation.x=Math.PI/2;e.position.set(x,.12,.32);pl.add(e);const pr=dyn(new THREE.Group());pr.position.set(x,.12,.5);pr.add(box(.36,.02,.03,MAT.metal,0,0,0));pr.rotation.z=x;pl.add(pr);rot.push(pr);});
    [.1,-.25].forEach(z=>{const g=cyl(.025,.025,.3,MAT.black,6);g.rotation.z=Math.PI/2;g.position.set(-.26,-.04,z);pl.add(g);});
    parts.plane=pl; parts.spin=rot; parts.loiter=true; parts.muzzle=new THREE.Vector3(1,d.y,0);
  }else if(kind==="aav"){ // 상륙장갑차: 배 모양 장갑차 · 궤도 · 작은 포탑(물에서는 떠서 감)
    body.add(box(.34,.22,1.3,MAT.track,-.3,.13,-.05),box(.34,.22,1.3,MAT.track,.3,.13,-.05),box(.76,.36,1.35,hull,0,.38,-.05));
    const fr=box(.74,.3,.3,hull,0,.36,.7); fr.rotation.x=-.75; body.add(fr);
    body.add(box(.78,.04,1.37,dark,0,.57,-.05),box(.5,.2,.04,dark,0,.35,-.74));
    const tur=dyn(new THREE.Group()); tur.position.set(.18,.6,.25); tur.add(box(.26,.14,.28,dark,0,.07,0)); const b=cyl(.02,.02,.4,MAT.metal,6); b.rotation.x=Math.PI/2; b.position.set(0,.09,.3); tur.add(b);
    body.add(tur); parts.tur=tur; parts.muzzle=new THREE.Vector3(.18,.7,.6);
  }else if(kind==="usv"){ // 바다 드론: 폭약을 실은 작은 무인 보트
    body.add(shapeHull(1.1,.34,.35,.14,dark),box(.22,.03,.7,MAT.black,0,.15,-.05),box(.16,.12,.2,hull,0,.22,-.25));
    const ant=cyl(.008,.008,.3,MAT.steel,4); ant.position.set(0,.4,-.3); body.add(ant);
    const led=new THREE.Mesh(new THREE.SphereGeometry(.035,5,4),new THREE.MeshBasicMaterial({color:P.accent})); dyn(led); led.position.set(0,.55,-.3); body.add(led); parts.led=led;
    parts.muzzle=new THREE.Vector3(0,.2,.5); parts.ship=true; parts.small=true;
  }else if(kind==="hq"){
    body.add(box(2.2,.9,1.6,MAT.conc,0,.45,0),box(1.2,.5,1,MAT.conc2,-.3,1.15,-.1),box(2.3,.08,1.7,MAT.roof,0,.92,0));
    [-.9,.9].forEach(x=>body.add(box(.5,.35,.3,dark,x,.17,.95)));
    for(let i=0;i<9;i++){const b=box(.26,.12,.14,MAT.bag,-1.1+i*.27,.06,1.15);body.add(b);}
    const mast=cyl(.03,.03,1.4,MAT.metal,4); mast.position.set(.7,1.6,.1); body.add(mast);
    const dish=dyn(new THREE.Group()); dish.position.set(.25,1.5,.3);
    const dd=new THREE.Mesh(new THREE.SphereGeometry(.28,8,4,0,Math.PI*2,0,Math.PI/2.2),MAT.conc); dd.rotation.x=-1.1; dish.add(dd); body.add(dish); parts.dish=dish;
    parts.muzzle=new THREE.Vector3(0,1,0);
  }
  bake(body);
  // 바닥 팀 표시 고리
  const ringR=kind==="hq"?1.7:d.r/SC*.95;
  const ring=new THREE.Mesh(new THREE.RingGeometry(ringR-.07,ringR,32),new THREE.MeshBasicMaterial({color:P.accent,transparent:true,opacity:d.dom==="sub"?.45:.8,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.05; root.add(ring); parts.ring=ring;
  if(d.dom==="land"||d.dom==="air"){const b=new THREE.Mesh(blobGeo,d.dom==="air"?blobMatAir:blobMat);const s=(kind==="hq"?3.6:d.r/SC*2.2)*(d.dom==="air"?.75:1);b.scale.set(s,1,s*(kind==="hq"?.8:1.2));b.position.y=.035;b.renderOrder=1;root.add(b);parts.blob=b;}
  // 체력 막대
  const hp=new THREE.Group(); hp.position.y=kind==="hq"?2.8:d.dom==="air"?d.y+.8:parts.small?.9:parts.ship?1.8:d.dom==="sub"?.85:1.35;
  const bw=kind==="hq"?2.4:Math.max(1,d.r/SC*1.35), bh=kind==="hq"?.34:.26;
  const bg=new THREE.Mesh(new THREE.PlaneGeometry(bw+.08,bh+.08),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.7,depthTest:false}));
  const fg=new THREE.Mesh(new THREE.PlaneGeometry(bw,bh),new THREE.MeshBasicMaterial({color:P.accent,depthTest:false,transparent:true}));
  fg.geometry.translate(bw/2,0,0); fg.position.x=-bw/2; fg.position.z=.001; bg.renderOrder=10; fg.renderOrder=11;
  hp.add(bg,fg); root.add(hp); parts.hp=hp; parts.hpf=fg;
  root.scale.setScalar(SC);
  return {root,parts};
}

/* ───────── 효과(화면만, 계산에는 안 씀) ───────── */
const fx=[];
const flashMat=new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
const fireMat=new THREE.MeshBasicMaterial({color:0xff8a3a,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
const smokeGeo=new THREE.IcosahedronGeometry(.3,0), sphGeo=new THREE.IcosahedronGeometry(.3,1), debGeo=new THREE.DodecahedronGeometry(.05,0);
const sparkMat=new THREE.MeshBasicMaterial({color:0xffd080,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
const waveGeo=new THREE.RingGeometry(.7,1,32); waveGeo.rotateX(-Math.PI/2);
function addFx(o,life,upd){scene.add(o);fx.push({o,t:0,life,upd});}
function flash(pos,s){const m=new THREE.Mesh(sphGeo,flashMat.clone());m.position.copy(pos);m.scale.setScalar(s||.5);addFx(m,.09,(f,k)=>{m.material.opacity=1-k;});}
function tracer(a,b,col,spd){
  const geo=new THREE.BufferGeometry().setFromPoints([a.clone(),a.clone()]);
  const ln=new THREE.Line(geo,new THREE.LineBasicMaterial({color:col||0xffe08a,transparent:true,blending:THREE.AdditiveBlending}));
  const dir=b.clone().sub(a);
  addFx(ln,Math.max(.08,dir.length()/(spd||40)),(f,k)=>{const p=geo.attributes.position;const head=a.clone().addScaledVector(dir,Math.min(1,k*1.15));const tail=a.clone().addScaledVector(dir,Math.max(0,k*1.15-.3));p.setXYZ(0,tail.x,tail.y,tail.z);p.setXYZ(1,head.x,head.y,head.z);p.needsUpdate=true;ln.material.opacity=1-k*.5;});
}
function smoke(pos,s,dark,life,col){
  if(fx.length>700)return;
  const m=new THREE.Mesh(smokeGeo,new THREE.MeshStandardMaterial({color:col||(dark?0x2a2724:0x8b8780),flatShading:true,transparent:true,opacity:.8,depthWrite:false,roughness:1}));
  m.position.copy(pos); const sc=s||.6; m.scale.setScalar(sc*.5); m.rotation.set(Math.random()*3,Math.random()*3,0);
  const vx=(Math.random()-.5)*.4, vz=(Math.random()-.5)*.4-.15;
  addFx(m,life||1.6,(f,k,dt)=>{m.position.y+=dt*(.7-k*.4);m.position.x+=dt*vx;m.position.z+=dt*vz;m.scale.setScalar(sc*(.5+k*1.3));m.material.opacity=.8*(1-k);});
}
function trail(pos,col,s){if(fx.length>700)return;const m=new THREE.Mesh(smokeGeo,new THREE.MeshBasicMaterial({color:col||0xf2f2ee,transparent:true,opacity:.45,depthWrite:false}));m.position.copy(pos);const b=s||.12;m.scale.setScalar(b);addFx(m,.9,(o,k)=>{m.scale.setScalar(b+k*b*2);m.material.opacity=.45*(1-k);});}
const lights=[0,1,2,3].map(()=>{const l=new THREE.PointLight(0xffa050,0,8,2);scene.add(l);return {l,t:9};});let li=0;
const bangEl=$("#bang"); let bangV=0;
function splashWater(pos,s){ // 물 위 폭발: 하얀 물기둥
  const y=WATER_Y;
  for(let i=0;i<5+s*6;i++){const m=new THREE.Mesh(smokeGeo,new THREE.MeshStandardMaterial({color:0xe8f2f2,flatShading:true,transparent:true,opacity:.9,depthWrite:false}));
    m.position.set(pos.x+(Math.random()-.5)*.4*s,y,pos.z+(Math.random()-.5)*.4*s);const v=new THREE.Vector3((Math.random()-.5)*1.6,3+Math.random()*3.2*s,(Math.random()-.5)*1.6);const sz=.25+Math.random()*.35*s;
    addFx(m,1.1,(o,k,dt)=>{v.y-=7*dt;m.position.addScaledVector(v,dt);if(m.position.y<y)m.position.y=y;m.scale.setScalar(sz*(1+k*2));m.material.opacity=.9*(1-k);});}
  const w=new THREE.Mesh(waveGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthWrite:false}));
  w.position.set(pos.x,y+.03,pos.z); addFx(w,1,(o,k)=>{w.scale.setScalar(.3+k*2.2*s);w.material.opacity=.75*(1-k);});
}
function boom(pos,size){
  const s=size||1, wet=isSea(pos.x,pos.z,.1)&&pos.y<.6, gy=groundY(pos.x,pos.z), base=pos.clone();
  const lobes=2+Math.round(s*2);
  for(let i=0;i<lobes;i++){const f=new THREE.Mesh(sphGeo,fireMat.clone());const o=new THREE.Vector3((Math.random()-.5)*.6*s,.1+Math.random()*.35*s,(Math.random()-.5)*.6*s);f.position.copy(base).add(o);const rise=.6+Math.random()*.8,life=.45+Math.random()*.35,sz=s*(.7+Math.random()*.6);
    addFx(f,life,(q,k,dt)=>{f.position.y+=dt*rise*s;f.scale.setScalar(sz*(.5+Math.pow(k,.5)*2.1));f.material.opacity=1-k*k;f.material.color.setHSL(.1-k*.08,1,.62-k*.35);});}
  const fl=new THREE.Mesh(sphGeo,flashMat.clone()); fl.position.copy(base); fl.position.y+=.2; fl.scale.setScalar(s*2); addFx(fl,.14,(o,k)=>{fl.material.opacity=1-k;fl.scale.setScalar(s*(2+k*1.5));});
  const L=lights[li++%lights.length]; L.l.position.set(base.x,base.y+.8,base.z); L.l.intensity=2.2*s; L.t=0;
  if(wet){splashWater(base,s);}
  else{
    const w=new THREE.Mesh(waveGeo,new THREE.MeshBasicMaterial({color:0xffe2b0,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));
    w.position.set(base.x,gy+.08,base.z); addFx(w,.45,(o,k)=>{w.scale.setScalar(.2+k*2.6*s);w.material.opacity=.7*(1-k);});
    for(let i=0;i<3+s*3;i++){const a=Math.random()*6.28,q=new THREE.Vector3(base.x+Math.cos(a)*.5*s,gy+.1,base.z+Math.sin(a)*.5*s);smoke(q,.5+s*.35,false,1.4,0x8a7458);}
    const sc=new THREE.Mesh(new THREE.CircleGeometry(.55*s,12),new THREE.MeshBasicMaterial({color:0x14110e,transparent:true,opacity:.6,depthWrite:false}));
    sc.rotation.x=-Math.PI/2; sc.position.set(base.x,gy+.05,base.z); addFx(sc,22,(o,k)=>{sc.material.opacity=.6*(1-k*k);});
  }
  for(let i=0;i<4+s*5;i++){const q=base.clone();q.x+=(Math.random()-.5)*.7*s;q.z+=(Math.random()-.5)*.7*s;q.y+=.1+Math.random()*.4*s;smoke(q,.55+s*.5,true,1.6+Math.random()*1.2);}
  for(let i=0;i<6+s*6;i++){
    const d=new THREE.Mesh(debGeo,i%3?MAT.wreck:MAT.dirt); d.position.copy(base); d.position.y+=.15; d.scale.setScalar(.6+Math.random()*1.4);
    const v=new THREE.Vector3((Math.random()-.5)*5*s,2.5+Math.random()*4*s,(Math.random()-.5)*5*s), big=i<2&&s>=1;
    addFx(d,1.2,(o,k,dt)=>{v.y-=9.8*dt;d.position.addScaledVector(v,dt);const g2=groundY(d.position.x,d.position.z);if(d.position.y<g2){d.position.y=g2;v.multiplyScalar(.3);v.y=Math.abs(v.y);}d.rotation.x+=dt*9;d.rotation.z+=dt*6;if(big&&Math.random()<.5)smoke(d.position.clone(),.16,true,.7);});
  }
  for(let i=0;i<8+s*6;i++){const sp=new THREE.Mesh(debGeo,sparkMat);sp.position.copy(base);sp.position.y+=.2;sp.scale.set(.5,.5,2.2);const v=new THREE.Vector3((Math.random()-.5)*7,1+Math.random()*5,(Math.random()-.5)*7);
    addFx(sp,.35+Math.random()*.3,(o,k,dt)=>{v.y-=6*dt;sp.position.addScaledVector(v,dt);sp.lookAt(sp.position.clone().add(v));});}
  shake=Math.min(.55,shake+.1*s);
  if(s>=1.3)bangV=Math.min(.9,bangV+.16*s);
}
function fireDust(pos,s){for(let i=0;i<3;i++){const a=Math.random()*6.28,q=new THREE.Vector3(pos.x+Math.cos(a)*.25,pos.y+.06,pos.z+Math.sin(a)*.25);smoke(q,.3*s,false,.9,0x9a8466);}}
function muzzleBlast(mz,s){flash(mz,.55*s);const w=new THREE.Mesh(waveGeo,new THREE.MeshBasicMaterial({color:0xffe6b0,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));w.position.copy(mz);addFx(w,.2,(o,k)=>{w.scale.setScalar(.1+k*.5*s);w.material.opacity=.6*(1-k);});}
function shell(a,b,t){const m=new THREE.Mesh(new THREE.SphereGeometry(.05,5,4),flashMat);m.position.copy(a);const h=Math.max(2,a.distanceTo(b)*.35);
  addFx(m,t,(o,k)=>{m.position.lerpVectors(a,b,k);m.position.y+=Math.sin(k*Math.PI)*h;if(Math.random()<.7)smoke(m.position.clone(),.18,false,.7);});}
function rocket(a,b,t,onHit,big){const m=new THREE.Mesh(sphGeo,fireMat);m.scale.setScalar(big?.32:.18);let done=false;
  addFx(m,t,(o,k)=>{m.position.lerpVectors(a,b,k);if(big)m.position.y+=Math.sin(k*Math.PI)*1.5;if(Math.random()<.9)trail(m.position.clone(),0xd8d2c6,big?.2:.1);if(k>=1&&!done){done=true;onHit&&onHit();}});}
function arc(a,b,t,h,onHit){const m=new THREE.Mesh(sphGeo,fireMat);m.scale.setScalar(.12);let done=false;
  addFx(m,t,(o,k)=>{m.position.lerpVectors(a,b,k);m.position.y+=Math.sin(k*Math.PI)*h;if(Math.random()<.8)trail(m.position.clone(),0xd8d2c6,.08);if(k>=1&&!done){done=true;onHit&&onHit();}});}
const bmShots=[];
function ballistic(a,b,t){ // 탄도탄: 높이 솟았다 떨어짐. 요격되면 intercept()가 지움
  const m=new THREE.Group();const c=cyl(.06,.06,.5,MAT.white,8);c.rotation.x=Math.PI/2;m.add(c);const fl=new THREE.Mesh(sphGeo,fireMat);fl.scale.setScalar(.16);fl.position.z=-.3;m.add(fl);
  const shot={m,tx:b.x,tz:b.z,dead:false};bmShots.push(shot);const prev=new THREE.Vector3();
  addFx(m,t,(o,k)=>{if(shot.dead){m.visible=false;return;}prev.copy(m.position);m.position.lerpVectors(a,b,k);m.position.y+=Math.sin(k*Math.PI)*9;if(k>.01)m.lookAt(m.position.clone().add(m.position.clone().sub(prev)));if(Math.random()<.95)trail(m.position.clone(),0xe8e2d6,.22);if(k>=1){m.visible=false;const i=bmShots.indexOf(shot);if(i>=0)bmShots.splice(i,1);}});}
function interceptFx(x,z){const sh=bmShots.find(q=>!q.dead&&Math.hypot(q.tx-x,q.tz-z)<.6);let p=new THREE.Vector3(x,groundY(x,z)+4,z);if(sh){sh.dead=true;p=sh.m.position.clone();}
  flash(p,1.4);for(let i=0;i<8;i++)smoke(jitter(p,.8),.6,true,1.6);boom(p,1.3);}
function warnFx(x,z,t,foe){const y=groundY(x,z)+.08;const ring=new THREE.Mesh(new THREE.RingGeometry(1.35,1.8,32),new THREE.MeshBasicMaterial({color:foe?0xff3b3b:0xffb040,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));ring.rotation.x=-Math.PI/2;ring.position.set(x,y,z);
  addFx(ring,t,(o,k)=>{ring.material.opacity=.35+.4*Math.abs(Math.sin(k*t*6));ring.scale.setScalar(1-.25*k);});}
function torpedo(a,b,t,onHit){ // 물속 거품 줄
  const m=new THREE.Mesh(sphGeo,new THREE.MeshBasicMaterial({color:0xcfeff0,transparent:true,opacity:.6}));m.scale.setScalar(.12);let done=false;
  addFx(m,t,(o,k)=>{m.position.set(a.x+(b.x-a.x)*k,WATER_Y+.02,a.z+(b.z-a.z)*k);if(Math.random()<.8)trail(m.position.clone(),0xeaf6f6,.08);if(k>=1&&!done){done=true;onHit&&onHit();}});}
function beam(a,b,col){ // 레이저
  const dir=b.clone().sub(a), L=dir.length();
  const g=new THREE.CylinderGeometry(.035,.035,L,6,1,true); g.translate(0,L/2,0); g.rotateX(Math.PI/2);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:col||0x8ff6ff,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
  m.position.copy(a); m.lookAt(b); addFx(m,.18,(o,k)=>{m.material.opacity=.95*(1-k);m.scale.x=m.scale.y=1+k*2;});
  flash(b,.35);
}
function pulse(pos,r,col,life){const w=new THREE.Mesh(waveGeo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));w.position.set(pos.x,groundY(pos.x,pos.z)+.15,pos.z);addFx(w,life||.8,(o,k)=>{w.scale.setScalar(.2+k*r);w.material.opacity=.8*(1-k);});}
function wake(u){ // 배 뒤 물살
  const back=new THREE.Vector3(u.root.position.x-Math.sin(u.root.rotation.y)*u.d.r*.9,WATER_Y+.03,u.root.position.z-Math.cos(u.root.rotation.y)*u.d.r*.9);
  const m=new THREE.Mesh(waveGeo,new THREE.MeshBasicMaterial({color:0xf4fbfb,transparent:true,opacity:.5,depthWrite:false}));m.position.copy(back);addFx(m,1.4,(o,k)=>{m.scale.setScalar(.1+k*.7);m.material.opacity=.5*(1-k);});
}

/* ───────── 전장 소품 · 숲 · 마을 · 항구 ───────── */
function put(k,x,z,s,ry,y){const o=glb(k,null);if(!o)return null;o.scale.multiplyScalar(s||1);o.position.set(x,y==null?Math.max(hAt(x,z),0):y,z);o.rotation.y=ry==null?rnd()*6.28:ry;o.traverse(m=>{if(m.isMesh){m.castShadow=k!=="grass";m.receiveShadow=true;}});scene.add(o);return o;}
const bagGeo=(()=>{const g=new THREE.CylinderGeometry(.12,.12,.25,6,1);g.rotateZ(Math.PI/2);g.scale(1,.55,.85);return g;})();
function sandbags(x,z,len,ry){const g=new THREE.Group();const n=Math.round(len/.26);
  for(let row=0;row<2;row++)for(let i=0;i<n-row;i++){const b=new THREE.Mesh(bagGeo,MAT.bag);b.position.set(-len/2+.13+i*.26+row*.13,.06+row*.1,0);b.rotation.y=(rnd()-.5)*.2;g.add(b);}
  bake(g);g.position.set(x,hAt(x,z),z);g.rotation.y=ry||0;scene.add(g);}
function crater(x,z,r){const y=hAt(x,z);
  const d=new THREE.Mesh(new THREE.CircleGeometry(r,12),new THREE.MeshBasicMaterial({color:0x2a241c,transparent:true,opacity:.6,depthWrite:false}));d.rotation.x=-Math.PI/2;d.position.set(x,y+.03,z);scene.add(d);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(r,.07*r+.03,4,12),MAT.dirt);rim.rotation.x=-Math.PI/2;rim.scale.z=.5;rim.position.set(x,y+.02,z);rim.receiveShadow=true;scene.add(rim);}
function freeSpot(x,z,r){ // 전투 길목 · 배치 칸 · 길은 비워 둠
  if(isSea(x,z,-.6))return false;
  if(Math.abs(z-riverZ(x))<1.1)return false;
  if(z>8.6&&z<13.6&&x>-1&&x<9.6&&r<2)return false;
  if(z<-6.8&&z>-14&&x>.4&&x<9&&r<2)return false;
  return true;
}
function crane(x,z,ry){const g=new THREE.Group();
  [-.3,.3].forEach(a=>[-.3,.3].forEach(b=>g.add(box(.06,1.6,.06,MAT.red,a,.8,b))));
  for(let i=0;i<4;i++)g.add(box(.66,.04,.04,MAT.red,0,.3+i*.4,.3),box(.66,.04,.04,MAT.red,0,.3+i*.4,-.3));
  g.add(box(.7,.25,.7,MAT.stripe,0,1.72,0),box(.12,.12,2.4,MAT.red,0,1.9,-.6),box(.1,.5,.1,MAT.steel,0,1.6,-1.6));
  bake(g);g.position.set(x,.05,z);g.rotation.y=ry;scene.add(g);}
function lighthouse(x,z){const g=new THREE.Group();
  for(let i=0;i<5;i++){const c=cyl(.32-i*.035,.35-i*.035,.36,i%2?MAT.red:MAT.white,10);c.position.y=.18+i*.36;g.add(c);}
  g.add(cyl(.2,.2,.24,MAT.glass,8));g.children[g.children.length-1].position.y=1.94;
  const top=new THREE.Mesh(new THREE.ConeGeometry(.24,.3,8),MAT.red);top.position.y=2.2;g.add(top);
  bake(g);g.position.set(x,Math.max(hAt(x,z),0),z);scene.add(g);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xfff2b0}));lamp.position.set(x,Math.max(hAt(x,z),0)+1.94,z);scene.add(lamp);}
function bunker(x,z,ry){const g=new THREE.Group();g.add(box(1,.4,.8,MAT.conc,0,.2,0),box(1.1,.1,.9,MAT.conc2,0,.45,0),box(.6,.08,.04,MAT.black,0,.3,.41));bake(g);g.position.set(x,hAt(x,z),z);g.rotation.y=ry||0;scene.add(g);}
function dressField(){
  // 숲: 무리 지어 심기
  const forests=[[9.2,-4,2.2],[9,4.5,2],[-1.2,-12.5,1.8],[9.4,-13,1.6],[0,5.6,1.2],[8.4,13.4,1.4],[-.6,-4.6,1.1],[6.2,-3.6,1]];
  const trees=["tree1","tree2","tree3","tree4","tree5","pine1","pine2","pine3","birch"];
  forests.forEach(([cx,cz,r])=>{const n=Math.round(r*r*3.2);for(let i=0;i<n;i++){const a=rnd()*6.28,d=Math.sqrt(rnd())*r,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(!freeSpot(x,z,2))continue;put(trees[Math.floor(rnd()*trees.length)],x,z,.55+rnd()*.35);
    if(rnd()<.5)put(rnd()<.5?"bush":"bush2",x+(rnd()-.5)*.8,z+(rnd()-.5)*.8,.9+rnd()*.5);}});
  for(let i=0;i<26;i++){const x=-2+rnd()*12,z=(rnd()*2-1)*14.5;if(!freeSpot(x,z,0))continue;put(trees[Math.floor(rnd()*trees.length)],x,z,.55+rnd()*.35);}
  for(let i=0;i<70;i++){const x=-2+rnd()*12,z=(rnd()*2-1)*14.5;if(!freeSpot(x,z,1))continue;put("grass",x,z,.8+rnd()*.7);}
  for(let i=0;i<30;i++){const x=-2+rnd()*12,z=(rnd()*2-1)*14.5;if(!freeSpot(x,z,1))continue;put(rnd()<.5?"bush":"bush2",x,z,.8+rnd()*.6);}
  for(let i=0;i<26;i++){const x=-2+rnd()*12,z=(rnd()*2-1)*14.5;if(!freeSpot(x,z,1))continue;const rk=["rock1","rock2","rock3","rock5","mrock"][Math.floor(rnd()*5)];const o=put(rk,x,z,.7+rnd()*.7);if(o)o.position.y-=.05;}
  // 해안 바위 · 갈대
  for(let i=0;i<22;i++){const z=(rnd()*2-1)*15,x=coastX(z)+(rnd()-.5)*.9;put(["rock2","rock5","mrock"][Math.floor(rnd()*3)],x,z,.8+rnd()*.8,null,Math.max(hAt(x,z),-.3)-.05);}
  // 강가
  for(let i=0;i<12;i++){const x=coastX(0)+1+rnd()*9;const z=riverZ(x)+(rnd()<.5?-1:1)*(1.2+rnd()*.4);if(BRIDGES.some(b=>Math.abs(x-b)<1))continue;put(rnd()<.6?"bush":"mrock",x,z,.8+rnd()*.5);}
  [[5,-2.4],[8,2.2],[-.4,2.8],[7.6,-6]].forEach(([x,z])=>put("dead",x,z,.8+rnd()*.4));
  [[3.4,-2.6],[7.2,-1.6],[-.2,-2.2],[4.4,3.6]].forEach(([x,z])=>put(rnd()<.5?"stump":"log",x,z,1));
  [[2.6,-3.4,.42],[5.4,-1.4,.36],[.4,-3.2,.3],[4,2.6,.34],[6.8,3.4,.28],[1.4,3.8,.3],[7.6,-4.8,.32]].forEach(([x,z,r])=>crater(x,z,r));
  sandbags(2.4,-6.2,1.4,.1);sandbags(5,-6.4,1.2,0);sandbags(7.4,-6.2,1.4,-.1);sandbags(1.6,8.2,1.3,0);sandbags(5.2,8.2,1.3,0);
  // 마을(가운데 오른쪽)
  [["b2s",7.6,-.9,Math.PI/2],["b1g",8.9,1.9,-Math.PI/2],["b3s",8.8,-2.4,-Math.PI/2],["b2w",7.4,5.8,Math.PI/2],["houseA",9.2,6.9,-Math.PI/2],["b1g",6.2,6.9,Math.PI]].forEach(([k,x,z,r])=>put(k,x,z,1,r));
  // 적 기지
  [["b4",8.6,-13.6,0],["houseB",1.8,-13.8,0],["b2w",7.8,-10.2,-Math.PI/2]].forEach(([k,x,z,r])=>put(k,x,z,1,r));
  put("tent",3,-14.4,1,.3);put("tent",6.6,-14.6,1,-.4);put("antenna",6.4,-12.9,1,0);put("container",2.2,-12.4,1,0);put("container",9.4,-11.4,1,1.57);
  [[4.1,-11.9],[4.4,-12],[4.25,-11.65],[7.9,-12.2],[8.2,-12.1]].forEach(([x,z])=>put("crate",x,z,1));
  [[5.8,-11.9],[6,-12.05],[1.5,-11]].forEach(([x,z])=>put("barrel",x,z,1));
  // 우리 보급
  [[-1.6,13.4],[-1.3,13.2],[9.4,13.5]].forEach(([x,z])=>put("crate",x,z,1));put("container",8.6,14.2,1,.2);put("tent",.6,14.2,.9,0);
  // 항구 · 등대 · 해안 벙커
  [[-11,1],[-12.6,-12.4]].forEach(([z,d],i)=>{});
  [[11.6,1],[-11.8,-1]].forEach(([z,dir])=>{const x=coastX(z);const d=put("dock",x-.9,z,1,Math.PI/2,WATER_Y-.05);crane(x+.4,z+.9*dir,dir>0?.4:2.6);put("container",x+.9,z-.6,1,.1);put("container",x+.9,z-.6,1,.1,Math.max(hAt(x+.9,z-.6),0)+.33);put("boat",x-1.6,z+1.2,1,.8,WATER_Y);});
  lighthouse(coastX(-5)+.5,-5); lighthouse(coastX(6.5)+.6,6.5);
  bunker(coastX(-8)+.9,-8,Math.PI/2); bunker(coastX(-2.6)+.9,-2.6,Math.PI/2); bunker(coastX(3.4)+.9,3.4,Math.PI/2);
}


/* 11-26 큰 전장 꾸미기: 생김새(theme)별 나무·바위, 숲 무리, 건물·절벽, 적 기지, 거점, 항구 */
function dressGeneric(){
  const zb=FIELD.zBot, spots=[...ST.enemy,...(ST.allies||[])].filter(e=>DEF[e[0]].dom==="land");
  const free=(x,z,wide)=>{
    if(isSea(x,z,-.6))return false;
    if(Math.abs(z-riverZ(x))<1.1)return false;
    if(z>zb-5.2&&z<zb-.4)return false;
    if(blockAt(x,z,.4))return false;
    if(!wide&&spots.some(e=>Math.hypot(e[1]-x,e[2]-z)<1.1))return false;
    if((ST.points||[]).some(q=>Math.hypot(q.x-x,q.z-z)<q.r+.3))return false;
    return true;};
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const A=FK*FK;
  (ST.woods||[]).forEach(([cx,cz,r])=>{const n=Math.min(26,Math.round(r*r*2.6));for(let i=0;i<n;i++){const a=rnd()*6.28,d=Math.sqrt(rnd())*r,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(!free(x,z)||!TH.trees.length)continue;put(pick(TH.trees),x,z,.6+rnd()*.4);if(rnd()<.4&&TH.ground.length)put(pick(TH.ground),x+(rnd()-.5)*.8,z+(rnd()-.5)*.8,.9+rnd()*.4);}});
  const rx=()=>FCX+(rnd()*2-1)*(FW/2-.6), rz=()=>FIELD.zTop+.6+rnd()*(FD-1.2);
  if(TH.trees.length)for(let i=0;i<Math.round(14*A);i++){const x=rx(),z=rz();if(free(x,z))put(pick(TH.trees),x,z,.55+rnd()*.35);}
  if(TH.ground.length)for(let i=0;i<Math.round(50*A);i++){const x=rx(),z=rz();if(free(x,z))put(pick(TH.ground),x,z,.8+rnd()*.6);}
  if(TH.rocks.length)for(let i=0;i<Math.round(20*A);i++){const x=rx(),z=rz();if(!free(x,z))continue;const o=put(pick(TH.rocks),x,z,.7+rnd()*.8);if(o)o.position.y-=.05;}
  for(let i=0;i<Math.round(8*A);i++){const x=rx(),z=FIELD.zTop+2+rnd()*(FD-8);if(free(x,z))crater(x,z,.25+rnd()*.2);}
  // 해안 바위 · 부두 · 등대
  if(ST.coastX(0)>-60&&ST.coastX(0)<60){
    for(let i=0;i<Math.round(16*FK);i++){const z=FIELD.zTop+rnd()*FD,x=coastX(z)+(rnd()-.5)*.9;if(x<FIELD.xMin||x>FIELD.xMax)continue;put(pick(["rock2","rock5","mrock"]),x,z,.8+rnd()*.8,null,Math.max(hAt(x,z),-.3)-.05);}
    [FIELD.zTop+6,FCZ+3].forEach(z=>{const x=coastX(z);if(x<FIELD.xMin+2||x>FIELD.xMax-2)return;put("dock",x-.9,z,1,Math.PI/2,WATER_Y-.05);put("container",x+.9,z-.6,1,.1);put("boat",x-1.6,z+1.2,1,.8,WATER_Y);});
    const lz=FIELD.zTop+FD*.35,lx=coastX(lz);if(lx>FIELD.xMin+1&&lx<FIELD.xMax-1)lighthouse(lx+.6,lz);
  }
  // 건물·절벽 덩어리
  fillBlocks(false,1.6);
  // 적 지휘소 둘레: 천막·안테나·상자·모래주머니·벙커
  const hq=ST.enemy.find(e=>e[0]==="hq");
  if(hq){const [,x,z]=hq;put("antenna",x+1.8,z-.8,1,0);put("tent",x-2.2,z-.6,1,.3);put("tent",x+2.4,z+.8,1,-.4);put("container",x-1.6,z+1.6,1,0);
    [[x+1.2,z+1.8],[x+1.5,z+1.9],[x-2.6,z+1.2]].forEach(([a,b])=>put("crate",a,b,1));[[x-.4,z-1.8],[x+.2,z-1.9]].forEach(([a,b])=>put("barrel",a,b,1));
    sandbags(x,z+2.4,2.2,0);bunker(x-3.4,z+1.8,0);bunker(x+3.6,z+2,0);}
  // 적 진지(무리마다 모래주머니)
  const seen=[];ST.enemy.forEach(([k,x,z])=>{if(DEF[k].dom!=="land"||k==="hq"||seen.some(([a,b])=>Math.hypot(a-x,b-z)<4))return;seen.push([x,z]);if(!blockAt(x,z+1.2,.3)&&!isSea(x,z+1.2,-.3))sandbags(x,z+1.3,1.3,0);});
  (ST.points||[]).forEach(q=>{for(let k=0;k<3;k++){const a=k*2.1+.5;const x=q.x+Math.cos(a)*q.r*.85,z=q.z+Math.sin(a)*q.r*.85;if(!blockAt(x,z,.3)&&!isSea(x,z,-.3))sandbags(x,z,.9,a+Math.PI/2);}});
  // 지켜야 할 대상 둘레(기지·마을)
  (ST.allies||[]).forEach(([k,x,z])=>{if(DEF[k].dom!=="land")return;put("tent",x-1.6,z+.6,.9,.2);put("crate",x+1.4,z+.4,1);sandbags(x,z-1.4,1.8,0);});
  // 우리 집결지(아래쪽)
  if(!isSea(FIELD.xMax-1.2,zb-.6,-.3)){put("tent",FIELD.xMax-1.2,zb-.5,.9,-.3);put("crate",FIELD.xMax-2.2,zb-.6,1);}
  if(!isSea(FIELD.xMin+1.2,zb-.6,-.3)){put("tent",FIELD.xMin+1.2,zb-.5,.9,.2);put("container",FIELD.xMin+2.4,zb-.4,1,.2);}
}

/* ───────── 배치 칸 (땅 칸 · 바다 칸) ───────── */
const depTiles=[];
function buildTiles(){
  const g=new THREE.PlaneGeometry(1.34,1.24); g.rotateX(-Math.PI/2);
  TILES.forEach(({x,z,dom})=>{
    const col=dom==="sea"?0x8fd0ff:0x3d8bff;
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.13,depthWrite:false}));
    m.position.set(x,(dom==="sea"?WATER_Y+.06:hAt(x,z)+.06),z); m.userData={i:depTiles.length}; scene.add(m);
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.55}));
    e.position.copy(m.position); scene.add(e); depTiles.push({m,e,x,z,dom});
  });
}


/* ───────── 전투 상태(계산은 sim.ts) ───────── */
let acc=0, speed=1, deploy=[], selKind="tank", selTab="land", aiming=null, genUsed=false, genAim=false;
const vq=[];
const at=(fn,dly)=>vq.push({at:S.simT+(dly||0),fn});
function baseY(u){if(u.d.amph&&isSea(u.x,u.z))return WATER_Y-.16;return u.d.dom==="sea"?WATER_Y-.07:u.d.dom==="sub"?WATER_Y:u.d.dom==="air"?Math.max(hAt(u.x,u.z),WATER_Y):hAt(u.x,u.z);}
function unitY(u){return baseY(u)+(u.d.y||(u.parts.ship?.35:u.d.dom==="sub"?0:.3))*SC;}
const S=createSim({
  spawn(u){const {root:r,parts}=makeModel(u.kind,u.side);u.root=r;u.parts=parts;r.position.set(u.x,baseY(u),u.z);r.rotation.y=u.hd;scene.add(r);},
  death(t){
    const p=new THREE.Vector3(t.x,unitY(t),t.z);
    const big=t.kind==="hq"?2.6:t.d.missile?2.2:t.d.kamikaze?1.3:t.parts.ship?2:t.d.dom==="sub"?1.4:t.kind==="inf"||t.kind==="sf"?.6:1.2;
    at(()=>boom(p,big));
    if(t.parts.men)t.parts.men.forEach(m=>{m.rotation.x=-1.4;m.position.y=.04;});
    else if(t.d.dom==="land"){t.root.traverse(o=>{if(o.isMesh&&o.material!==t.parts.ring.material&&o!==t.parts.blob&&o.parent!==t.parts.hp)o.material=MAT.wreck;});}
    t.parts.ring.visible=false; t.parts.hp.visible=false;
  },
  log(msg,cls){log(msg,cls);},
  event(e){
    const {x,z}=e;
    if(e.type==="boom")at(()=>boom(new THREE.Vector3(x,groundY(x,z),z),e.size));
    else if(e.type==="landing")at(()=>landingCraft(e.ship,e.unit));
    else if(e.type==="arty")at(()=>{const to=new THREE.Vector3(x,groundY(x,z),z);shell(new THREE.Vector3(x-1+Math.random()*2,15,z+13),to,1.1);setTimeout(()=>boom(to,1.5),1100/speed);},e.delay);
    else if(e.type==="smoke"){for(let i=0;i<34;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*e.r;const p=new THREE.Vector3(x+Math.cos(a)*r,groundY(x,z)+.2,z+Math.sin(a)*r);setTimeout(()=>smoke(p,1.6,false,8.5,0xc9c6be),i*35);}}
    else if(e.type==="airstrike")at(()=>jetRun(x,z));
    else if(e.type==="cruise")at(()=>{const to=new THREE.Vector3(x,groundY(x,z),z);rocket(new THREE.Vector3(-6,7,17),to,2.2/speed,()=>boom(to,2.6),true);});
    else if(e.type==="emp")at(()=>{pulse(new THREE.Vector3(x,0,z),e.r*1.1,0x6bd6ff,.9);setTimeout(()=>pulse(new THREE.Vector3(x,0,z),e.r*1.1,0x9ff0ff,.9),180);});
    else if(e.type==="repair")at(()=>pulse(new THREE.Vector3(x,0,z),e.r*1.1,0x7dff9a,1));
    else if(e.type==="para")at(()=>paraRun(x,z));
    else if(e.type==="warn")at(()=>warnFx(x,z,e.t/speed,e.side==="foe"));
    else if(e.type==="intercept")at(()=>interceptFx(x,z));
  },
  end(win,timeout){
    setTimeout(()=>{
      $("#endt").textContent=(opts.actLabel?opts.actLabel+" ":"")+(win?"작전 성공":"작전 실패");
      $("#endt").style.color=win?"var(--us)":"var(--foe)";
      const mine=S.units.filter(u=>u.side==="us"&&!u.d.missile&&u.kind!=="cvjet"&&!u.d.ally), lost=mine.filter(u=>!u.alive).length;
      if(opts.endText)$("#endp").textContent=opts.endText(S,win,timeout);else $("#endp").textContent=winText(win,timeout)+` 걸린 시간 ${fmt(S.simT)} · 아군 손실 ${lost}/${mine.length}`;
      $("#end").hidden=false;
      const dead={};for(const u of S.units)if(u.side==="us"&&!u.alive&&u.kind!=="cvjet"&&u.kind!=="hq"&&!u.d.ally)dead[u.d.name]=(dead[u.d.name]||0)+1;
      lastResult={win,timeout,t:S.simT,lost,total:mine.length,dead,carried:mine.filter(u=>u.carried).length,carry:carryFrom(S,opts.naval||0),sim:S};
    },win?1600:900);
  },
});
let lastResult=null;
function clearUnits(){S.units.forEach(u=>{scene.remove(u.root);if(u.pad)scene.remove(u.pad);});S.units=[];}
function doCmd(k,x,z){simCmd(S,k,x,z,gridRef(x,z));}

function jetRun(x,z){
  const g=new THREE.Group(); const jm=glb("jet","us");
  if(jm){jm.scale.multiplyScalar(1.1);g.add(jm);}else g.add(box(.3,.15,1.8,MAT.metal));
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.1,6,4),fireMat); glow.position.set(0,.15,-1); g.add(glow);
  const y=4.2, sx=-16, ex=16; g.rotation.y=Math.PI/2; let dropped=0;
  addFx(g,2.8,(o,k)=>{const xx=sx+(ex-sx)*k;g.position.set(xx,y,z);g.rotation.z=Math.sin(k*3)*.08;
    while(dropped<5&&xx>x-2+dropped-1.6){const bx=x-2+dropped;dropped++;const b=new THREE.Mesh(new THREE.SphereGeometry(.08,5,4),MAT.wreck);b.position.set(xx,y-.2,z);const st=b.position.clone(),en=new THREE.Vector3(bx,groundY(bx,z),z);addFx(b,.45,(o2,k2)=>{b.position.lerpVectors(st,en,k2);if(k2>.98)b.visible=false;});setTimeout(()=>boom(en,2),450/speed);}
    if(Math.random()<.8){trail(new THREE.Vector3(xx-1,y+.1,z-.7));trail(new THREE.Vector3(xx-1,y+.1,z+.7));}});
  shake+=.1;
}
function paraRun(x,z){
  const g=new THREE.Group(); g.add(box(.5,.4,2.6,MAT.metal),box(3.2,.06,.6,MAT.metal,0,.12,0),box(1.2,.05,.4,MAT.metal,0,.1,-1.15),box(.05,.5,.4,MAT.metal,0,.35,-1.15)); bake(g);
  const y=5, sz=-18; g.position.set(x,y,sz); let dropped=0;
  addFx(g,3.6,(o,k)=>{const zz=sz+k*36;g.position.z=zz;
    if(dropped<6&&zz>z-1.2+dropped*.3){dropped++;const c=new THREE.Group();const can=new THREE.Mesh(new THREE.SphereGeometry(.22,8,4,0,Math.PI*2,0,Math.PI/2),MAT.white);can.position.y=.35;const man=box(.06,.14,.06,MAT.pants,0,0,0);c.add(can,man);
      const st=new THREE.Vector3(x+(Math.random()-.5)*.9,y-.3,zz),gy=groundY(x,z);c.position.copy(st);addFx(c,2.2,(o2,k2)=>{c.position.y=st.y+(gy-st.y)*k2;c.position.x=st.x+Math.sin(k2*6)*.1;c.position.z=st.z+(z-st.z)*k2;if(k2>.97)c.visible=false;});}});
}
function landingCraft(ship,s){ // 상륙정: 배에서 해안까지
  const g=new THREE.Group(); g.add(box(.4,.12,.7,MAT.metal,0,.06,0),box(.38,.16,.05,MAT.metal,0,.12,.34)); bake(g);
  const a=new THREE.Vector3(ship.x,WATER_Y,ship.z), b=new THREE.Vector3(s.x-.3,WATER_Y,s.z); g.lookAt(b);
  addFx(g,1.2/speed,(o,k)=>{g.position.lerpVectors(a,b,k);if(Math.random()<.6)trail(g.position.clone(),0xf2fbfb,.08);});
}

/* ───────── 화면 후처리: 외곽선 · 구석 그늘 · 빛 번짐 · 색 보정 ─────────
   장면을 한 번 그림판(렌더 타깃)에 그린 다음, 깊이 정보를 읽어서 다듬어 화면에 냄 */
const post={on:true,ok:true,auto:true,fpsT:0,fpsN:0,fpsSum:0};
let rtScene=null, rtA=null, rtB=null;
const fsScene=new THREE.Scene(), fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const fsQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null); fsQuad.frustumCulled=false; fsScene.add(fsQuad);
const VS="varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}";
const brightMat=new THREE.ShaderMaterial({uniforms:{tColor:{value:null}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tColor; varying vec2 vUv;
  void main(){ vec3 c=texture2D(tColor,vUv).rgb; float b=max(c.r,max(c.g,c.b));
    float mn=min(c.r,min(c.g,c.b)); float k=smoothstep(.9,1.,b)*smoothstep(.36,.55,(b-mn)/max(b,.001)); // 모래 · 물거품처럼 흰 곳은 빼고 불꽃 색만 // 아주 밝은 곳(불꽃 · 레이저 · 섬광)만
    float warm=step(c.b+.08,c.r)*.35+.65; gl_FragColor=vec4(c*k*warm,1.); }`});
const blurMat=new THREE.ShaderMaterial({uniforms:{tColor:{value:null},dir:{value:new THREE.Vector2(1,0)}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tColor; uniform vec2 dir; varying vec2 vUv;
  void main(){ vec3 s=texture2D(tColor,vUv).rgb*.2270;
    s+=texture2D(tColor,vUv+dir*1.3846).rgb*.3162; s+=texture2D(tColor,vUv-dir*1.3846).rgb*.3162;
    s+=texture2D(tColor,vUv+dir*3.2308).rgb*.0703; s+=texture2D(tColor,vUv-dir*3.2308).rgb*.0703;
    gl_FragColor=vec4(s,1.); }`});
const compMat=new THREE.ShaderMaterial({
  uniforms:{tColor:{value:null},tDepth:{value:null},tBloom:{value:null},px:{value:new THREE.Vector2()},near:{value:.1},far:{value:160},
    outline:{value:1},ao:{value:1},bloom:{value:1},flir:{value:0},time:{value:0}},
  vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tColor,tDepth,tBloom; uniform vec2 px; uniform float near,far,outline,ao,bloom,flir,time; varying vec2 vUv;
  float lin(vec2 uv){ float d=texture2D(tDepth,uv).x; float z=d*2.-1.; return 2.*near*far/(far+near-z*(far-near)); }
  float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
  void main(){
    vec3 col=texture2D(tColor,vUv).rgb;
    float dc=texture2D(tDepth,vUv).x;
    if(dc<1.){
      float c=lin(vUv);
      // 1) 외곽선: 깊이가 갑자기 꺾이는 곳(물체 둘레)을 찾음. 평평한 땅은 꺾임이 없어서 선이 안 생김
      if(outline>.5){
        vec2 o=px*1.15;
        float l=lin(vUv-vec2(o.x,0.)), r=lin(vUv+vec2(o.x,0.)), u=lin(vUv+vec2(0.,o.y)), d=lin(vUv-vec2(0.,o.y));
        float lap=(abs(l+r-2.*c)+abs(u+d-2.*c))/c;
        float near1=max(max(c-l,c-r),max(c-u,c-d))/c; // 앞에 있는 물체 쪽만 선을 그음(두께 1겹)
        float e=smoothstep(.006,.022,lap)*smoothstep(.004,.014,near1);
        float fade=1.-smoothstep(30.,70.,c);
        col*=1.-e*.85*fade;
      }
      // 2) 구석 그늘: 주변 픽셀이 나보다 앞에 있으면(틈 · 바닥과 닿는 곳) 어둡게
      if(ao>.5){
        float occ=0., rad=clamp(26./c,.25,2.2), n=ign(gl_FragCoord.xy)*6.2832;
        for(int i=0;i<8;i++){
          float a=n+float(i)*2.3999, rr=(float(i)+.5)/8.;
          vec2 off=vec2(cos(a),sin(a))*rr*rad*14.*px;
          float s=lin(vUv+off), diff=c-s;
          occ+=smoothstep(.03,.35,diff)*(1.-smoothstep(.9,2.2,diff));
        }
        col*=1.-clamp(occ/8.,0.,1.)*.62;
      }
    }
    // 3) 빛 번짐
    if(bloom>.5) col+=texture2D(tBloom,vUv).rgb*1.15;
    // 4) 색 보정: 노출 · 부드러운 S자 대비 · 채도 · 그늘은 살짝 푸르게, 밝은 곳은 살짝 따뜻하게
    col*=1.08;
    col=col/(1.+col*.18);
    col=mix(col,col*col*(3.-2.*col),.32);
    float L=dot(col,vec3(.299,.587,.114));
    col=mix(vec3(L),col,1.16);
    col+=vec3(-.012,.0,.022)*(1.-L)+vec3(.022,.01,-.018)*L;
    // 가장자리 어둡게
    vec2 v=vUv-.5; col*=1.-dot(v*vec2(.9,.6),v*vec2(.9,.6))*.55;
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }`});
function postSize(){
  const v=renderer.getDrawingBufferSize(new THREE.Vector2()); const w=Math.max(2,v.x|0),h=Math.max(2,v.y|0);
  if(!rtScene){
    try{
      rtScene=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat});
      rtScene.depthTexture=new THREE.DepthTexture(w,h); rtScene.depthTexture.type=THREE.UnsignedIntType;
      rtA=new THREE.WebGLRenderTarget(w>>2,h>>2,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
      rtB=rtA.clone();
    }catch(e){post.ok=false;post.on=false;return;}
  }
  rtScene.setSize(w,h); rtA.setSize(Math.max(2,w>>2),Math.max(2,h>>2)); rtB.setSize(Math.max(2,w>>2),Math.max(2,h>>2));
  compMat.uniforms.px.value.set(1/w,1/h);
}
function pass(mat,target){fsQuad.material=mat;renderer.setRenderTarget(target);renderer.render(fsScene,fsCam);}
function renderFrame(dt){
  if(!post.on||!post.ok||!rtScene){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
  renderer.setRenderTarget(rtScene); renderer.render(scene,camera);
  brightMat.uniforms.tColor.value=rtScene.texture; pass(brightMat,rtA);
  const bw=1/rtA.width, bh=1/rtA.height;
  for(let i=0;i<2;i++){
    blurMat.uniforms.tColor.value=rtA.texture; blurMat.uniforms.dir.value.set(bw*(1+i),0); pass(blurMat,rtB);
    blurMat.uniforms.tColor.value=rtB.texture; blurMat.uniforms.dir.value.set(0,bh*(1+i)); pass(blurMat,rtA);
  }
  const U=compMat.uniforms; U.tColor.value=rtScene.texture; U.tDepth.value=rtScene.depthTexture; U.tBloom.value=rtA.texture;
  U.near.value=camera.near; U.far.value=camera.far;
  pass(compMat,null);
}
// 느린 휴대폰이면 효과를 저절로 낮춤(전투 첫 4초를 재서)
function watchSpeed(dt){
  if(!post.auto||!post.on||S.phase!=="battle")return;
  post.fpsSum+=dt; post.fpsN++;
  if(post.fpsSum>4){const ms=post.fpsSum/post.fpsN*1000; post.auto=false;
    if(ms>38){setFx(false);log("휴대폰이 느려서 화면 효과를 낮췄어요","c");}}
}
function setFx(on){post.on=on&&post.ok;const b=$("#fxbtn");if(b){b.textContent=post.on?"효과 높음":"효과 낮음";b.setAttribute("aria-pressed",String(post.on));}}
/* 유닛 발밑 그림자(바닥에 붙는 느낌) */
const blobTex=(()=>{const c=document.createElement("canvas");c.width=c.height=64;const g=c.getContext("2d");const gr=g.createRadialGradient(32,32,2,32,32,31);gr.addColorStop(0,"rgba(0,0,0,.62)");gr.addColorStop(.55,"rgba(0,0,0,.3)");gr.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);return t;})();
const blobMat=new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false});
const blobMatAir=new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.45});
const blobGeo=(()=>{const g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);return g;})();

/* ───────── 화면 동기화(계산 결과를 보기만 함) ───────── */
const tmpV=new THREE.Vector3();
function lerpAng(a,b,t){return a+angDiff(b,a)*t;}
function muzzlePos(u){
  const p=u.parts; u.root.updateMatrixWorld(true);
  if(p.tur){const local=p.muzzle.clone();local.y-=p.tur.position.y;local.z-=p.tur.position.z;local.x-=p.tur.position.x;return p.tur.localToWorld(local);}
  if(p.plane)return p.plane.localToWorld(new THREE.Vector3(0,0,.8));
  if(p.heli)return p.heli.localToWorld(new THREE.Vector3(0,-.2,.5));
  return u.root.localToWorld(p.muzzle.clone());
}
function renderUnits(dt,time){
  for(const u of S.units){
    const r=u.root, p=u.parts, by=baseY(u);
    if(u.hidden){r.visible=false;continue;}else if(r.visible===false&&u.alive)r.visible=true;
    const k=Math.min(1,dt*12);
    r.position.x+=(u.x-r.position.x)*k; r.position.z+=(u.z-r.position.z)*k;
    if(!u.alive){
      u.deadT+=dt;
      if(u.d.missile||u.d.kamikaze){r.visible=false;continue;}
      if(p.plane||p.heli){const pl=p.plane||p.heli;if(pl.visible&&pl.position.y>.15){pl.position.y=Math.max(.1,pl.position.y-dt*2.6);r.position.x+=Math.sin(r.rotation.y)*dt*1.5;r.position.z+=Math.cos(r.rotation.y)*dt*1.5;pl.rotation.z+=dt*5;pl.rotation.x=.4;if(Math.random()<dt*25)smoke(pl.getWorldPosition(tmpV).clone(),.35,true,1.4);if(pl.position.y<=.15){boom(pl.getWorldPosition(tmpV).clone(),1.1);pl.visible=false;}}continue;}
      if(p.ship||p.sub){r.position.y=Math.max(by-1.2,r.position.y-dt*.09);r.rotation.z=Math.min(.35,r.rotation.z+dt*.04);if(u.deadT<14&&Math.random()<dt*8)smoke(new THREE.Vector3(r.position.x+(Math.random()-.5)*.6,WATER_Y+.4,r.position.z+(Math.random()-.5)*.8),.6,true,2.4);
        if(u.deadT<8&&Math.random()<dt*10)burn(r.position.x,WATER_Y+.3,r.position.z,.5);continue;}
      if(!p.men&&u.deadT<16){if(Math.random()<dt*7)smoke(new THREE.Vector3(r.position.x+(Math.random()-.5)*.3,by+.4,r.position.z+(Math.random()-.5)*.3),.45,true,2.4);if(u.deadT<9&&Math.random()<dt*9)burn(r.position.x,by+.3,r.position.z,.35);}
      continue;
    }
    // 높이
    if(p.ship)r.position.y=by+Math.sin(time*1.3+u.id)*.025, r.rotation.z=Math.sin(time*1.1+u.id)*.025;
    else if(p.sub)r.position.y=by;
    else r.position.y=by;
    // 방향
    const air=u.d.dom==="air";
    let faceT;
    if(u.d.jet||u.d.missile)faceT=u.hd;
    else if(u.moving)faceT=u.moveFace;
    else if(p.tur&&!p.model)faceT=r.rotation.y;
    else faceT=u.aim??r.rotation.y;
    if(p.loiter&&!u.moving){faceT=null;r.rotation.y+=dt*(u.kind==="gunship"?.55:.7);} // 정찰기·건쉽: 제자리에서 크게 돎
    if(faceT!=null)r.rotation.y=lerpAng(r.rotation.y,faceT,Math.min(1,dt*(u.d.jet?10:p.ship?1.6:4)));
    if(p.loiter&&p.plane)p.plane.rotation.z=lerpAng(p.plane.rotation.z,u.moving?0:-.32,Math.min(1,dt*2));
    if(p.spin)p.spin.forEach(q=>q.rotation.z+=dt*30);
    if(p.erect){const up=u.tgt&&u.tgt.alive&&u.cd<2.2;p.erect.rotation.x=lerpAng(p.erect.rotation.x,up?-1.3:0,Math.min(1,dt*1.6));}
    if(p.tur&&u.aim!=null)p.tur.rotation.y=lerpAng(p.tur.rotation.y,u.aim-r.rotation.y,Math.min(1,dt*6));
    if(p.dish)p.dish.rotation.y=time*2;
    if(p.rot)p.rot.forEach(q=>q.rotation.y+=dt*34);
    if(p.led)p.led.visible=(time*3+u.id)%1<.5;
    if(p.plane&&u.d.jet){p.plane.rotation.z=lerpAng(p.plane.rotation.z,-(u.bank||0)*.8,Math.min(1,dt*6));p.plane.position.y=u.d.y+Math.sin(time*1.7+u.id)*.06;
      if(Math.random()<dt*24){const s=u.d.bomber?1.4:.9;trail(p.plane.localToWorld(new THREE.Vector3(-s,0,-.3)));trail(p.plane.localToWorld(new THREE.Vector3(s,0,-.3)));}}
    if(u.kind==="drone"){p.plane.position.y=u.d.y+Math.sin(time*3+u.id)*.06;p.plane.rotation.x=u.moving?.12:0;}
    if(p.heli){p.heli.position.y=u.d.y+Math.sin(time*2.3+u.id)*.07;p.heli.rotation.x=lerpAng(p.heli.rotation.x,u.moving?.14:0,Math.min(1,dt*3));}
    if(p.ms){ // 미사일
      if(u.flying&&!u.pad){const pad=new THREE.Group();scene.add(pad);pad.position.copy(r.position);pad.rotation.copy(r.rotation);pad.scale.copy(r.scale);
        p.body.children.filter(c=>c!==p.ms).forEach(c=>pad.add(c));u.pad=pad;p.flame.visible=true;p.ring.visible=false;
        for(let i=0;i<10;i++)smoke(new THREE.Vector3(r.position.x+(Math.random()-.5)*.6,by+.2,r.position.z+(Math.random()-.5)*.6),.6,false,1.8,0xcfc8bb);flash(r.position.clone(),.8);}
      if(u.flying){p.ms.position.y=Math.min(u.d.y,p.ms.position.y+dt*5);p.ms.rotation.x=lerpAng(p.ms.rotation.x,0,dt*3);if(Math.random()<dt*40)trail(p.ms.localToWorld(new THREE.Vector3(0,0,-.75)),0xe4ded2,.16);}
    }
    if(p.men){const alive=Math.ceil(u.hp/u.max*p.men.length);
      p.men.forEach((m,i)=>{const on=i<alive;if(!on&&!m.userData.down){m.userData.down=true;m.rotation.x=-1.45;m.position.y=.04;}
        if(on){const b=m.userData.base;m.position.x=b.x;m.position.z=b.z;const ph=time*11+i*1.7;m.position.y=u.moving?Math.abs(Math.sin(ph))*.03:0;const sw=u.moving?Math.sin(ph)*.6:0;m.userData.legs[0].rotation.x=sw;m.userData.legs[1].rotation.x=-sw;m.rotation.x=u.moving?.12:0;}});}
    // 흙먼지 · 물살
    if(u.d.dom==="land"&&!p.men&&u.moving&&!(u.d.amph&&isSea(u.x,u.z))&&Math.random()<dt*6)smoke(new THREE.Vector3(r.position.x-Math.sin(r.rotation.y)*.45,by+.08,r.position.z-Math.cos(r.rotation.y)*.45),.32,false,1,0x9a8466);
    if((p.ship||p.sub||(u.d.amph&&isSea(u.x,u.z)))&&u.moving&&Math.random()<dt*(p.sub?3:6))wake(u);
    if(u.jam>S.simT&&Math.random()<dt*8){const q=r.position.clone();q.y=unitY(u)+.2;flash(q.add(new THREE.Vector3((Math.random()-.5)*.5,0,(Math.random()-.5)*.5)),.15);}
    if(u.healT&&S.simT-u.healT<.05&&!u.healShown){u.healShown=true;for(let i=0;i<5;i++){const q=new THREE.Vector3(r.position.x+(Math.random()-.5)*.6,unitY(u),r.position.z+(Math.random()-.5)*.6);const m=new THREE.Mesh(sphGeo,new THREE.MeshBasicMaterial({color:0x7dff9a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));m.scale.setScalar(.12);m.position.copy(q);addFx(m,.9,(o,kk,d2)=>{m.position.y+=d2*.8;m.material.opacity=1-kk;});}}
    if(u.healT&&S.simT-u.healT>.2)u.healShown=false;
    // 반동
    u.recoil=Math.max(0,(u.recoil||0)-dt*3); // 11-26 처음엔 값이 없어 NaN → 땅 부대가 쏘기 전까지 안 보이던 문제 고침
    if(!air&&!p.ship&&!p.sub)p.body.position.z=-u.recoil*.06;
    // 사격 연출
    if(u.visFire){const v=u.visFire;u.visFire=null;u.recoil=1;const to=new THREE.Vector3(v.tx,v.tgt&&v.tgt.parts?unitY(v.tgt):groundY(v.tx,v.tz),v.tz);shoot(u,{...v,to});}
    if(u.visCruise){const c=u.visCruise;u.visCruise=null;const a=new THREE.Vector3(r.position.x,WATER_Y+.1,r.position.z),to=new THREE.Vector3(c.x,groundY(c.x,c.z),c.z);splashWater(a,.4);rocket(a,to,1.6/speed,()=>boom(to,1.4),true);}
    // 체력 막대
    p.hp.quaternion.copy(r.quaternion).invert().multiply(camera.quaternion);
    const hk=u.hp/u.max; p.hpf.scale.x=Math.max(.001,hk); p.hp.visible=(S.phase!=="deploy"||u.kind==="hq")&&!(u.d.missile&&!u.flying);
  }
}
function burn(x,y,z,s){const f=new THREE.Mesh(sphGeo,fireMat.clone());f.position.set(x+(Math.random()-.5)*.5,y,z+(Math.random()-.5)*.5);const sz=s*(1+Math.random()*.8);addFx(f,.5,(o,k,dt2)=>{f.position.y+=dt2*.8;f.scale.setScalar(sz*(1-k*.6));f.material.opacity=1-k;f.material.color.setHSL(.08-k*.05,1,.55-k*.2);});}
function jitter(v,s){return v.clone().add(new THREE.Vector3((Math.random()-.5)*s,(Math.random()-.5)*s*.4,(Math.random()-.5)*s));}
function shoot(u,vf){
  const p=u.parts, r=u.root, mz=muzzlePos(u), K=vf.kind, sp=Math.max(1,speed);
  if(K==="tank"){muzzleBlast(mz,1.1);smoke(mz,.45,false,1.1);fireDust(r.position,1.1);tracer(mz,vf.to,0xffd27a,60);setTimeout(()=>boom(vf.to,.5),110/sp);shake+=.03;}
  else if(K==="spg"){muzzleBlast(mz,1.6);smoke(mz,.7,false,1.6);fireDust(r.position,1.6);shell(mz,vf.to,vf.fly/sp);shake+=.04;}
  else if(K==="ifv"){[0,1,2].forEach(i=>setTimeout(()=>{tracer(mz,jitter(vf.to,.3),0xffcf7a,45);flash(mz,.18);},i*70/sp));setTimeout(()=>flash(vf.to,.3),180/sp);}
  else if(K==="inf"||K==="sf"){p.men.forEach(m=>{if(m.userData.down||Math.random()<.35)return;const a=m.getWorldPosition(tmpV).clone();a.y+=.2;tracer(a,jitter(vf.to,.4),K==="sf"?0xbfe8ff:0xfff1b0,30);});}
  else if(K==="hack"){const a=mz.clone(),b=vf.to.clone();const pts=[a];for(let i=1;i<6;i++){pts.push(a.clone().lerp(b,i/6).add(new THREE.Vector3((Math.random()-.5)*.4,(Math.random()-.5)*.3+.3,(Math.random()-.5)*.4)));}pts.push(b);
    const g=new THREE.BufferGeometry().setFromPoints(pts);const ln=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x6bf2ff,transparent:true,blending:THREE.AdditiveBlending}));addFx(ln,.35,(o,k)=>{ln.material.opacity=1-k;});pulse(vf.to,1.2,0x6bf2ff,.5);}
  else if(K==="aa"){[0,1,2].forEach(i=>setTimeout(()=>{tracer(mz,jitter(vf.to,.6),0xffb070,45);flash(mz,.25);},i*60/sp));setTimeout(()=>{for(let i=0;i<3;i++){const q=jitter(vf.to,.8);flash(q,.25);smoke(q,.22,true,.8);}},300/sp);}
  else if(K==="heli"){[-.32,.32].forEach((x,i)=>{const a=p.heli.localToWorld(new THREE.Vector3(x,-.22,.35));setTimeout(()=>{const to=jitter(vf.to,.5);flash(a,.25);rocket(a,to,.3/sp,()=>boom(to,.55));},i*120/sp);});}
  else if(K==="bm"){ // 탄도탄: 하늘 높이 솟았다가 떨어짐(요격되면 공중에서 터짐)
    const a=p.erect?p.erect.localToWorld(new THREE.Vector3(0,0,1.8)):mz.clone();for(let i=0;i<14;i++)smoke(new THREE.Vector3(r.position.x+(Math.random()-.5)*.9,groundY(r.position.x,r.position.z)+.2,r.position.z+(Math.random()-.5)*.9),.7,false,2.2,0xd8d0c2);flash(a,1);shake+=.05;
    ballistic(a,vf.to,vf.fly/sp);}
  else if(K==="mlrs"){for(let i=0;i<12;i++)setTimeout(()=>{const a=muzzlePos(u);const ang=Math.random()*6.28,rr=Math.sqrt(Math.random())*1.6;const to=new THREE.Vector3(vf.tx+Math.cos(ang)*rr,0,vf.tz+Math.sin(ang)*rr);to.y=groundY(to.x,to.z);flash(a,.3);smoke(a,.3,false,1);arc(a,to,vf.fly/sp,2.5,()=>boom(to,.55));},i*80/sp);}
  else if(K==="csm"){muzzleBlast(mz,1.2);smoke(mz,.6,false,1.6);rocket(mz,vf.to,(vf.fly||1.4)/sp,()=>{splashWater(vf.to,1.1);boom(vf.to,.9);},true);}
  else if(K==="sam"){flash(mz,.5);smoke(mz,.5,false,1.4,0xe0dad0);rocket(mz,vf.to,(vf.fly||.5)/sp,()=>{flash(vf.to,.7);smoke(vf.to,.35,true,1);});}
  else if(K==="uav"){const a=muzzlePos(u);rocket(a,vf.to,.35/sp,()=>boom(vf.to,.45));}
  else if(K==="gunship"){const a=muzzlePos(u);[0,1,2,3].forEach(i=>setTimeout(()=>{tracer(a,jitter(vf.to,.45),0xffe0a0,40);flash(a,.18);},i*60/sp));setTimeout(()=>{flash(vf.to,.35);smoke(vf.to,.25,true,.7);},260/sp);}
  else if(K==="aav"){[0,1].forEach(i=>setTimeout(()=>{tracer(mz,jitter(vf.to,.3),0xffcf7a,45);flash(mz,.16);},i*80/sp));}
  else if(K==="jet"||K==="cvjet"||K==="f35"){[-.4,.4].forEach(x=>{const a=p.plane.localToWorld(new THREE.Vector3(x,-.05,.3));tracer(a,jitter(vf.to,.5),0xffe9a0,40);flash(a,.15);});setTimeout(()=>{flash(vf.to,.3);smoke(vf.to,.25,true,.7);},90/sp);}
  else if(K==="bomber"){for(let i=0;i<4;i++){const a=p.plane.localToWorld(new THREE.Vector3((i-1.5)*.3,-.1,0));const to=new THREE.Vector3(vf.to.x+(i-1.5)*.32*Math.cos(r.rotation.y),vf.to.y,vf.to.z-(i-1.5)*.32*Math.sin(r.rotation.y));
    const b=new THREE.Mesh(new THREE.SphereGeometry(.06,5,4),MAT.black);b.position.copy(a);const st=a.clone();addFx(b,.7/sp,(o,k)=>{b.position.lerpVectors(st,to,k*k);if(k>.97)b.visible=false;});setTimeout(()=>boom(to,1.3),(700+i*120)/sp);}}
  else if(K==="dd"||K==="cv"||K==="lha"){
    if(vf.air){const c=r.localToWorld(new THREE.Vector3(0,.7,-.6));for(let i=0;i<4;i++)setTimeout(()=>{tracer(c,jitter(vf.to,.5),0xffc070,50);flash(c,.15);},i*50/sp);setTimeout(()=>flash(jitter(vf.to,.3),.3),250/sp);}
    else if(K==="dd"){muzzleBlast(mz,1);smoke(mz,.4,false,1);tracer(mz,vf.to,0xffd27a,50);setTimeout(()=>boom(vf.to,.7),130/sp);}
    else{const c=r.localToWorld(new THREE.Vector3(.3,.8,.6));tracer(c,jitter(vf.to,.4),0xffc070,45);flash(c,.2);setTimeout(()=>flash(vf.to,.3),150/sp);}}
  else if(K==="laser"){beam(mz,vf.to);if(Math.random()<.5)smoke(vf.to,.2,true,.6);}
  else if(K==="sub"||K==="ssn"){const a=new THREE.Vector3(r.position.x+Math.sin(r.rotation.y)*.8,WATER_Y,r.position.z+Math.cos(r.rotation.y)*.8);const to=vf.to.clone();torpedo(a,to,vf.fly/sp,()=>{splashWater(to,1.1);flash(to,.6);shake+=.08;});}
}

/* ───────── 작은 지도 ───────── */
const mini=$("#mini").getContext("2d");
function drawMini(){
  const W=168,H=252; mini.clearRect(0,0,W,H);
  const X=x=>(x-FIELD.xMin)/(FIELD.xMax-FIELD.xMin)*W, Y=z=>(z-FIELD.zTop)/(FIELD.zBot-FIELD.zTop)*H;
  if(!URBAN){mini.fillStyle="rgba(60,130,170,.28)";mini.beginPath();mini.moveTo(0,0);for(let z=FIELD.zTop;z<=FIELD.zBot;z+=.5)mini.lineTo(Math.max(-2,Math.min(W+2,X(coastX(z)))),Y(z));mini.lineTo(0,H);mini.closePath();mini.fill();}
  mini.fillStyle="rgba(150,150,140,.28)";(ST.blocks||[]).forEach(b=>mini.fillRect(X(b.x0),Y(b.z0),X(b.x1)-X(b.x0),Y(b.z1)-Y(b.z0)));
  S.pts.forEach(p=>{mini.strokeStyle=p.own==="us"?"#3d8bff":"#ff3b3b";mini.lineWidth=2;mini.beginPath();mini.arc(X(p.x),Y(p.z),p.r/FW*W,0,7);mini.stroke();});
  mini.strokeStyle="rgba(140,220,200,.1)";mini.lineWidth=1;
  for(let i=1;i<8;i++){mini.beginPath();mini.moveTo(i*W/8,0);mini.lineTo(i*W/8,H);mini.stroke();}
  for(let i=1;i<12;i++){mini.beginPath();mini.moveTo(0,i*H/12);mini.lineTo(W,i*H/12);mini.stroke();}
  mini.strokeStyle="rgba(80,150,170,.55)";mini.lineWidth=4;mini.beginPath();
  if(!URBAN&&riverZ(0)<60){let st=true;for(let x=Math.max(FIELD.xMin,coastX(.6));x<=FIELD.xMax;x+=.5){const xx=X(x),yy=Y(riverZ(x));st?mini.moveTo(xx,yy):mini.lineTo(xx,yy);st=false;}mini.stroke();}
  S.smokes.forEach(s=>{mini.fillStyle="rgba(200,200,200,.25)";mini.beginPath();mini.arc(X(s.x),Y(s.z),s.r/FW*W,0,7);mini.fill();});
  S.units.forEach(u=>{
    if(!u.alive||(u.d.missile&&!u.flying&&u.side==="foe"))return;
    const x=X(u.x),y=Y(u.z), c=u.side==="us"?"#3d8bff":"#ff3b3b";
    mini.strokeStyle=c;mini.fillStyle=u.side==="us"?"rgba(61,139,255,.25)":"rgba(255,59,59,.25)";mini.lineWidth=1.4;
    const w=u.kind==="hq"?18:u.d.r>1?12:8,h=u.kind==="hq"?11:u.d.r>1?7:5;
    if(u.d.dom==="air"){mini.beginPath();mini.moveTo(x,y-h*.8);mini.lineTo(x+w*.45,y+h*.5);mini.lineTo(x-w*.45,y+h*.5);mini.closePath();mini.fill();mini.stroke();}
    else if(u.d.dom==="sea"||u.d.dom==="sub"){mini.beginPath();mini.ellipse(x,y,w*.5,h*.55,0,0,7);mini.fill();if(u.d.dom==="sub")mini.setLineDash([2,2]);mini.stroke();mini.setLineDash([]);}
    else if(u.side==="us"){mini.fillRect(x-w/2,y-h/2,w,h);mini.strokeRect(x-w/2,y-h/2,w,h);}
    else{mini.beginPath();mini.moveTo(x,y-h*.8);mini.lineTo(x+w*.55,y);mini.lineTo(x,y+h*.8);mini.lineTo(x-w*.55,y);mini.closePath();mini.fill();mini.stroke();}
  });
  mini.strokeStyle="rgba(255,195,90,.6)";mini.lineWidth=1;mini.strokeRect(2,2,W-4,H-4);
}

/* ───────── 화면 글자 ───────── */
function fmt(t){const s=Math.floor(t);return "T+"+String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function gridRef(x,z){return String.fromCharCode(65+Math.max(0,Math.min(7,Math.floor((x-FIELD.xMin)/(FW/8)))))+String(Math.max(1,Math.floor((z-FIELD.zTop)/2.4)+1)).padStart(2,"0");}
function log(msg,cls){const el=document.createElement("div");el.className=cls?"b3-"+cls:"";el.textContent=`[${fmt(S.simT).slice(2)}] ${msg}`;const L=$("#log");L.prepend(el);while(L.children.length>5)L.lastChild.remove();}
function hud(){
  $("#clock").textContent=fmt(S.simT);
  const us=S.units.filter(u=>u.side==="us"&&!u.d.missile&&u.kind!=="cvjet"), hq=S.units.find(u=>u.kind==="hq");
  const usHp=us.reduce((s,u)=>s+u.hp,0), usMax=us.reduce((s,u)=>s+u.max,0)||1;
  $("#usb").style.width=(usHp/usMax*100)+"%"; $("#usn").textContent=Math.round(usHp/usMax*100)+"%";
  if(opts.bar){const b=opts.bar(S);$("#foeLabel").textContent=b.label;$("#hqb").style.width=Math.max(0,Math.min(100,b.pct))+"%";$("#hqn").textContent=b.txt;}
  else if(winOf(ST)==="survive"){const left=Math.max(0,ST.timeLimit-S.simT);$("#foeLabel").textContent="버틸 시간";$("#hqb").style.width=(left/ST.timeLimit*100)+"%";$("#hqn").textContent=`${Math.ceil(left)}초`;}
  else if(winOf(ST)==="escort"){const al=S.units.filter(u=>u.d.ally),g=ST.allyGoal||ST.usGoal,hp=al.reduce((a,u)=>a+u.hp/u.max,0)/(al.length||1),dd=al.reduce((a,u)=>Math.max(a,Math.hypot(u.x-g.x,u.z-g.z)),0);$("#foeLabel").textContent="지킬 대상";$("#hqb").style.width=(hp*100)+"%";$("#hqn").textContent=al.some(u=>u.waitT)?"구출 대기":`남은 거리 ${Math.round(dd)}`;}
  else if(winOf(ST)==="all"){const left=S.units.filter(u=>u.alive&&u.side==="foe").length;hud.max=Math.max(hud.max||0,left);$("#foeLabel").textContent="남은 적";$("#hqb").style.width=(left/(hud.max||1)*100)+"%";$("#hqn").textContent=`${left}`;}
  else if(winOf(ST)==="points"){const n=S.pts.filter(p=>p.own==="us").length;$("#foeLabel").textContent="차지한 거점";$("#hqb").style.width=(100-n/S.pts.length*100)+"%";$("#hqn").textContent=`${n}/${S.pts.length}`;}
  else if(hq&&hq.alive||!ST.waves?.length){if(hq){$("#hqb").style.width=(hq.hp/hq.max*100)+"%";$("#hqn").textContent=Math.round(hq.hp/hq.max*100)+"%";}}
  else{const left=S.units.filter(u=>u.alive&&u.side==="foe").length;$("#foeLabel").textContent=`최후 저항 ${S.wave}/${ST.waves.length}차`;$("#hqb").style.width=Math.min(100,left*8)+"%";$("#hqn").textContent=`남은 적 ${left}`;}
  if(S.phase==="battle"||S.phase==="aim"){
    const n=Math.floor(S.cp); $("#cpn").textContent=n;
    [...$("#pips").children].forEach((p,i)=>p.classList.toggle("b3-on",i<n));
    root.querySelectorAll(".b3-cmd").forEach(b=>{const c=CMD[b.dataset.k];b.disabled=S.cp<c.cost&&aiming!==b.dataset.k;b.querySelector(".b3-fill").style.width=Math.min(100,S.cp/c.cost*100)+"%";b.classList.toggle("b3-on",aiming===b.dataset.k);});
  }
}
function unitIcon(kind){
  const c=document.createElement("canvas");c.width=68;c.height=48;const g=c.getContext("2d");const dm=DEF[kind].dom;
  g.strokeStyle="#3d8bff";g.fillStyle="rgba(61,139,255,.15)";g.lineWidth=3;g.beginPath();
  if(dm==="air"){g.moveTo(34,6);g.lineTo(62,42);g.lineTo(6,42);g.closePath();}else if(dm==="sea"||dm==="sub"){g.ellipse(34,24,28,17,0,0,7);}else g.rect(6,6,56,36);
  g.fill();if(dm==="sub")g.setLineDash([5,4]);g.stroke();g.setLineDash([]);g.beginPath();
  const K={inf:()=>{g.moveTo(14,10);g.lineTo(54,38);g.moveTo(54,10);g.lineTo(14,38);},sf:()=>{g.moveTo(14,10);g.lineTo(54,38);g.moveTo(54,10);g.lineTo(14,38);g.moveTo(20,24);g.lineTo(48,24);},
    ifv:()=>{g.moveTo(14,10);g.lineTo(54,38);g.moveTo(54,10);g.lineTo(14,38);g.moveTo(22,24);g.ellipse(34,24,12,7,0,0,7);},hack:()=>{g.moveTo(16,32);g.lineTo(26,16);g.lineTo(34,30);g.lineTo(42,16);g.lineTo(52,32);},
    tank:()=>g.ellipse(34,24,17,10,0,0,7),spg:()=>{g.ellipse(34,24,17,10,0,0,7);g.moveTo(37,24);g.arc(34,24,3,0,7);},aa:()=>{g.moveTo(18,38);g.quadraticCurveTo(34,6,50,38);},
    drone:()=>{g.moveTo(22,34);g.lineTo(34,20);g.lineTo(46,34);},heli:()=>{g.moveTo(20,22);g.lineTo(48,22);g.moveTo(34,22);g.lineTo(34,36);},jet:()=>{g.moveTo(34,16);g.lineTo(34,38);g.moveTo(22,30);g.lineTo(46,30);},
    bomber:()=>{g.moveTo(18,34);g.lineTo(34,22);g.lineTo(50,34);g.moveTo(26,38);g.lineTo(42,38);},missile:()=>{g.moveTo(34,14);g.lineTo(34,38);g.moveTo(28,20);g.lineTo(34,14);g.lineTo(40,20);},
    dd:()=>{g.moveTo(16,26);g.lineTo(52,26);g.moveTo(30,26);g.lineTo(30,18);g.lineTo(38,18);g.lineTo(38,26);},cv:()=>{g.moveTo(14,22);g.lineTo(54,22);g.moveTo(14,28);g.lineTo(54,28);g.moveTo(44,22);g.lineTo(44,14);},
    sub:()=>{g.moveTo(18,26);g.lineTo(50,26);g.moveTo(32,26);g.lineTo(32,18);},lha:()=>{g.moveTo(16,24);g.lineTo(52,24);g.moveTo(26,30);g.lineTo(42,30);g.moveTo(34,24);g.lineTo(34,16);},
    ssn:()=>{g.moveTo(16,26);g.lineTo(52,26);g.moveTo(30,26);g.lineTo(30,17);g.moveTo(24,31);g.lineTo(44,31);},laser:()=>{g.moveTo(16,28);g.lineTo(52,28);g.moveTo(34,28);g.lineTo(34,16);g.moveTo(26,12);g.lineTo(42,20);},
    bm:()=>{g.moveTo(22,38);g.lineTo(46,12);g.moveTo(38,12);g.lineTo(46,12);g.lineTo(46,20);g.moveTo(16,38);g.lineTo(52,38);},
    mlrs:()=>{[22,30,38,46].forEach(x=>{g.moveTo(x-4,36);g.lineTo(x+2,16);});g.moveTo(14,38);g.lineTo(54,38);},
    sam:()=>{g.moveTo(18,38);g.quadraticCurveTo(34,6,50,38);g.moveTo(34,30);g.lineTo(34,12);g.moveTo(29,17);g.lineTo(34,12);g.lineTo(39,17);},
    csm:()=>{g.moveTo(14,34);g.lineTo(54,34);g.moveTo(22,28);g.lineTo(46,14);g.moveTo(40,14);g.lineTo(46,14);g.lineTo(44,20);},
    uav:()=>{g.moveTo(14,24);g.lineTo(54,24);g.moveTo(34,18);g.lineTo(34,36);g.moveTo(28,34);g.lineTo(40,34);},
    f35:()=>{g.moveTo(34,12);g.lineTo(46,34);g.lineTo(34,30);g.lineTo(22,34);g.closePath();},
    awacs:()=>{g.moveTo(34,14);g.lineTo(34,40);g.moveTo(18,28);g.lineTo(50,28);g.moveTo(42,20);g.ellipse(34,20,8,3,0,0,7);},
    gunship:()=>{g.moveTo(34,14);g.lineTo(34,40);g.moveTo(16,24);g.lineTo(52,24);g.moveTo(24,34);g.lineTo(44,34);g.moveTo(20,30);g.lineTo(14,36);},
    aav:()=>{g.ellipse(34,24,17,10,0,0,7);g.moveTo(18,34);g.quadraticCurveTo(26,40,34,34);g.quadraticCurveTo(42,40,50,34);},
    usv:()=>{g.moveTo(18,24);g.lineTo(46,24);g.lineTo(52,30);g.lineTo(22,30);g.closePath();g.moveTo(34,24);g.lineTo(34,16);}};
  (K[kind]||(()=>{}))();g.stroke();return c;
}
function buildTabs(){
  const t=$("#tabs");t.innerHTML="";
  TABS.filter(tab=>(tab.id==="air"||TILES.some(t=>t.dom===tab.id))&&(!ST.kinds||tab.kinds.some(k=>ST.kinds.includes(k)))).forEach(tab=>{const b=document.createElement("button");b.type="button";b.className="b3-tab";b.setAttribute("role","tab");b.setAttribute("aria-selected",String(tab.id===selTab));b.dataset.t=tab.id;
    b.textContent=tab.name;const n=document.createElement("b");n.id="cnt-"+tab.id;b.append(n);b.onclick=()=>{selTab=tab.id;selKind=tab.kinds.find(k=>!ST.kinds||ST.kinds.includes(k));buildTabs();buildCards();refreshDeploy();};t.append(b);});
}
function buildCards(){
  const wrap=$("#cards");wrap.innerHTML="";
  const kinds=TABS.find(t=>t.id===selTab).kinds.filter(k=>!ST.kinds||ST.kinds.includes(k));
  // 11-26 병과가 7개를 넘으면 한 줄로 두고 옆으로 밀어서 봄
  wrap.classList.toggle("b3-scroll",kinds.length>6);wrap.style.gridTemplateColumns=kinds.length>6?"":`repeat(${Math.max(6,kinds.length)},1fr)`;
  kinds.forEach(k=>{const b=document.createElement("button");b.type="button";b.className="b3-card";b.id="card-"+k;b.setAttribute("aria-pressed",String(k===selKind));
    b.append(unitIcon(k));const n=document.createElement("span");n.textContent=DEF[k].name.replace("원자력 잠수함","핵잠수함").replace("레이저 방공함","레이저함").replace("강습상륙함","상륙함").replace("장거리 방공","장거리방공").replace("해안 미사일","해안미사일").replace("정찰 무인기","정찰기").replace("스텔스 전투기","스텔스기").replace("지상 공격기","공격기").replace("다연장로켓","다연장").replace("바다 드론","바다드론");const c=document.createElement("span");c.className="b3-c";c.textContent=DEF[k].cost;b.append(n,c);if(CAP){const o=document.createElement("span");o.className="b3-own";b.append(o);}
    b.onclick=()=>{selKind=k;root.querySelectorAll(".b3-card").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));highlightTiles();};
    wrap.append(b);});
  highlightTiles();
}
function buildCmds(){
  const w=$("#cmds");w.innerHTML="";
  CMD_ORDER.filter(k=>!ST.cmds||ST.cmds.includes(k)).forEach(k=>{const b=document.createElement("button");b.type="button";b.className="b3-cmd";b.dataset.k=k;b.innerHTML=`${CMD[k].name}<small>지휘력 ${CMD[k].cost}</small><span class="b3-fill"></span>`;
    b.onclick=()=>{if(aiming===k){cancelAim();return;}if(aiming)cancelAim();startAim(k);};w.append(b);});
  if(opts.gen&&CMD[opts.gen.k]){const g=opts.gen;genUsed=false;const b=document.createElement("button");b.type="button";b.className="b3-gcmd";b.id="gencmd";b.innerHTML=`🎖️ ${g.label}<small>${g.name} 장군 · 한 번${g.twice?" · 강화":""}</small>`;
    b.onclick=()=>{if(genUsed)return;if(genAim){cancelAim();return;}if(S.phase!=="battle")return;if(aiming)cancelAim();genAim=true;aiming=g.k;S.phase="aim";$("#aim").hidden=false;$("#aimtxt").textContent=`${g.name} 장군 · ${g.label} · 목표 지점을 누르세요 · 시간 정지`;hud();};w.append(b);}
  const pp=$("#pips");pp.innerHTML="";for(let i=0;i<10;i++)pp.append(document.createElement("i"));
}
function highlightTiles(){depTiles.forEach(t=>{const ok=tileOk(t,selKind);t.m.material.opacity=ok?.16:.04;t.e.material.opacity=ok?.6:.12;});}
function spent(){return deploy.reduce((s,d)=>s+(d.carried?0:DEF[d.kind].cost),0);}
const CAP=opts.owned||null;
function usedOf(k){return deploy.filter(d=>d.kind===k&&!d.carried).length;}
function leftOf(k){return CAP?(CAP[k]||0)-usedOf(k):99;}
/** 가진 수를 넘는 기본 배치는 뺌 */
function capPicks(list){if(!CAP)return list;const n={};return list.filter(d=>{if(d.carried)return true;n[d.kind]=(n[d.kind]||0)+1;return n[d.kind]<=(CAP[d.kind]||0);});}
function refreshDeploy(){
  $("#budget").textContent=spent();
  root.querySelectorAll(".b3-card").forEach(b=>{const k=b.id.slice(5);b.disabled=spent()+DEF[k].cost>BUDGET_NOW||leftOf(k)<=0;const o=b.querySelector(".b3-own");if(o)o.textContent=leftOf(k)>0?`×${leftOf(k)}`:"없음";});
  TABS.forEach(t=>{const n=deploy.filter(d=>t.kinds.includes(d.kind)).length;const el=$("#cnt-"+t.id);if(el)el.textContent=n||"";});
  $("#go").disabled=deploy.length===0;
}

function placeAt(i){
  if(opts.lockDeploy){$("#dhint").textContent="이 훈련은 부대가 정해져 있어요";return;}
  const t=depTiles[i]; const j=deploy.findIndex(d=>d.tile===i);
  if(j>=0&&deploy[j].carried){$("#dhint").textContent="앞 막에서 살아남은 부대예요(체력 그대로 이어서 싸워요)";return;}
  if(j>=0){scene.remove(deploy[j].u.root);S.units=S.units.filter(u=>u!==deploy[j].u);deploy.splice(j,1);refreshDeploy();return;}
  if(!tileOk(t,selKind)){$("#dhint").textContent=DEF[selKind].dom==="land"?"육군은 땅 칸에만 놓을 수 있어요":"해군은 바다 칸에만 놓을 수 있어요";return;}
  if(leftOf(selKind)<=0){$("#dhint").textContent=`가진 ${DEF[selKind].name} 부대를 다 냈어요(국방 › 부대에서 모집)`;return;}
  if(spent()+DEF[selKind].cost>BUDGET_NOW){$("#dhint").textContent="예산이 모자라요";return;}
  const u=makeUnit(S,selKind,"us",t.x,t.z); deploy.push({kind:selKind,tile:i,u}); refreshDeploy();
}
function setupDeploy(useDefault){
  clearUnits(); fx.splice(0).forEach(f=>scene.remove(f.o)); vq.length=0; lastResult=null;
  const prev=useDefault?capPicks(opts.preset?(URBAN&&!opts.lockDeploy&&!ST.drill?fillReinf(opts.preset,BUDGET_NOW):opts.preset):autoDeploy(BUDGET_NOW)):deploy.map(d=>({kind:d.kind,tile:d.tile,hp:d.hp,carried:d.carried}));
  const us=simSetup(S,prev,{cp0:opts.cp0,foeHp:opts.foeHp,usBuff:opts.usBuff,foeBuff:opts.foeBuff}); deploy=prev.map((d,i)=>({...d,u:us[i]}));
  depTiles.forEach(t=>{t.m.visible=t.e.visible=true;});
  $("#deployUI").hidden=false;$("#battleUI").hidden=true;$("#end").hidden=true;$("#aim").hidden=true;
  if(opts.lockDeploy){$("#tabs").hidden=true;$("#cards").hidden=true;$("#clear").hidden=true;$("#dhint").textContent="부대가 정해진 훈련이에요 · 시점을 보고 '작전 개시'";}
  $("#goal").textContent=ST.drill?ST.goal:opts.preset?"살아남은 부대가 이어서 싸워요 · 보충 부대를 더하세요":"부대를 배치하세요";$("#log").innerHTML="";
  if(CAP&&!Object.values(CAP).some(v=>v>0)&&!deploy.length)$("#dhint").textContent="가진 부대가 없어요 · 국방 › 부대에서 모집하거나 '맡기기'로 넘겨요";
  refreshDeploy(); hud();
}
function startBattle(){
  if(!deploy.length)return;
  acc=0;
  depTiles.forEach(t=>{t.m.visible=t.e.visible=false;});
  $("#deployUI").hidden=true;$("#battleUI").hidden=false;
  $("#goal").textContent=opts.actLabel?ST.goal:ST.goal.replace("외곽 지휘소","적 지휘소");
  simStart(S);
}

/* ───────── 입력 ───────── */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let aimMark=null;
function pick(ev){const r=cvs.getBoundingClientRect();ndc.set((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);}
function groundPoint(ev){pick(ev);const p=new THREE.Vector3();return ray.ray.intersectPlane(ground,p)?p:null;}
/* 시점: 한 손가락 끌기 = 이동 · 두 손가락 = 확대/축소 + 회전 + 기울이기 · 마우스 휠 = 확대 · 오른쪽 끌기 = 회전 */
const CAM0=Object.assign({tx:FCX,tz:FCZ+3.1*FK,dist:34.1*FK,yaw:0,pitch:.912},ST.cam||{});
const cam=Object.assign({},CAM0);
function clampCam(){cam.dist=Math.max(11,Math.min(46*FK,cam.dist));cam.pitch=Math.max(.45,Math.min(1.4,cam.pitch));cam.tx=Math.max(FIELD.xMin-1,Math.min(FIELD.xMax+1,cam.tx));cam.tz=Math.max(FIELD.zTop,Math.min(FIELD.zBot+1,cam.tz));}
function panBy(dx,dy){ // 손가락을 따라 땅이 움직이게
  const s=cam.dist/cvs.clientHeight*1.15, c=Math.cos(cam.yaw), n=Math.sin(cam.yaw);
  // 화면 오른쪽 = (c,0,-n), 화면 위(앞) = (-n,0,-c)
  cam.tx-=c*dx*s; cam.tz-=-n*dx*s;
  const f=s*1.25; cam.tx+=-n*dy*f; cam.tz+=-c*dy*f;
  clampCam();}
const ptrs=new Map(); let gest=null, drag=null, multi=false;
function twoInfo(){const [a,b]=[...ptrs.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y),ang:Math.atan2(b.y-a.y,b.x-a.x),my:(a.y+b.y)/2,mx:(a.x+b.x)/2};}
cvs.addEventListener("pointerdown",ev=>{
  cvs.setPointerCapture&&cvs.setPointerCapture(ev.pointerId);
  ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(ptrs.size===2){multi=true;drag=null;gest=Object.assign(twoInfo(),{dist:cam.dist,yaw:cam.yaw,pitch:cam.pitch});return;}
  if(ptrs.size>2)return;
  multi=false;
  drag={x:ev.clientX,y:ev.clientY,lx:ev.clientX,ly:ev.clientY,moved:false,btn:ev.button,shift:ev.shiftKey};
  if(S.phase==="aim"&&ev.button===0){const p=groundPoint(ev);if(p)moveAim(p);}
});
cvs.addEventListener("pointermove",ev=>{
  if(!ptrs.has(ev.pointerId))return; ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(ptrs.size===2&&gest){const g=twoInfo();cam.dist=gest.dist*gest.d/Math.max(20,g.d);cam.yaw=gest.yaw-angDiff(g.ang,gest.ang);cam.pitch=gest.pitch+(g.my-gest.my)*.004;clampCam();return;}
  if(!drag)return;
  const dx=ev.clientX-drag.lx, dy=ev.clientY-drag.ly; drag.lx=ev.clientX; drag.ly=ev.clientY;
  if(Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)>8)drag.moved=true;
  if(drag.btn===2||drag.shift){cam.yaw-=dx*.006;cam.pitch+=dy*.004;clampCam();return;}
  if(S.phase==="aim"){const p=groundPoint(ev);if(p)moveAim(p);return;}
  if(drag.moved)panBy(dx,dy);
});
function endPtr(ev){
  if(!ptrs.has(ev.pointerId))return; ptrs.delete(ev.pointerId);
  if(ptrs.size>0){gest=null;drag=null;return;}
  const d=drag; drag=null; gest=null;
  if(!d||multi||d.btn===2||d.shift){multi=false;return;}
  if(S.phase==="battle"&&!d.moved&&opts.onTap){const p=groundPoint(ev);if(p){let best=null,bd=1.3;for(const u of S.units){if(!u.alive||u.side!=="foe"||u.hidden)continue;const q=Math.hypot(u.x-p.x,u.z-p.z);if(q<bd){bd=q;best=u;}}const msg=opts.onTap(S,p.x,p.z,best);if(msg)log(msg,"c");if(best&&S.focus===best.id)flash(new THREE.Vector3(best.x,unitY(best)+.4,best.z),.5);}return;}
  if(S.phase==="deploy"&&!d.moved){pick(ev);const hit=ray.intersectObjects(depTiles.map(t=>t.m))[0];if(hit)placeAt(hit.object.userData.i);return;}
  if(S.phase==="aim"&&aimMark&&aimMark.visible){const p=aimMark.position.clone();const k=aiming;
    if(k==="para"&&isSea(p.x,p.z,-.3)){$("#aimtxt").textContent="공수 투입은 땅에만 할 수 있어요";return;}
    const gk=genAim;cancelAim();
    if(gk&&opts.gen){S.cp+=CMD[k].cost;doCmd(k,p.x,p.z);if(opts.gen.twice){S.cp+=CMD[k].cost;doCmd(k,p.x+.9,p.z+.6);}genUsed=true;const gb=$("#gencmd");if(gb){gb.disabled=true;gb.classList.add("b3-used");}log(`${opts.gen.name} 장군의 ${opts.gen.label}!`,"k");}
    else doCmd(k,p.x,p.z);}
}
cvs.addEventListener("pointerup",endPtr);
cvs.addEventListener("pointercancel",ev=>{ptrs.delete(ev.pointerId);drag=null;gest=null;multi=false;});
cvs.addEventListener("contextmenu",ev=>ev.preventDefault());
cvs.addEventListener("wheel",ev=>{ev.preventDefault();cam.dist*=Math.pow(1.0015,ev.deltaY);clampCam();},{passive:false});
$("#camreset").onclick=()=>Object.assign(cam,CAM0);
$("#fxbtn").onclick=()=>{post.auto=false;setFx(!post.on);};
function moveAim(p){
  p.x=Math.max(FIELD.xMin,Math.min(FIELD.xMax,p.x));p.z=Math.max(FIELD.zTop,Math.min(FIELD.zBot,p.z));
  if(!aimMark){aimMark=new THREE.Group();const ring=new THREE.Mesh(new THREE.RingGeometry(.94,1,48),new THREE.MeshBasicMaterial({color:0xffc35a,transparent:true,opacity:.9,depthTest:false}));ring.rotation.x=-Math.PI/2;const disc=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:0xffc35a,transparent:true,opacity:.14,depthTest:false}));disc.rotation.x=-Math.PI/2;const cr=new THREE.Mesh(new THREE.PlaneGeometry(.06,2.4),ring.material);cr.rotation.x=-Math.PI/2;const cr2=cr.clone();cr2.rotation.z=Math.PI/2;aimMark.add(ring,disc,cr,cr2);aimMark.traverse(o=>o.renderOrder=20);scene.add(aimMark);}
  const r=CMD[aiming].r; aimMark.scale.set(aiming==="air"?2.6:r,1,r);
  const col=aiming==="emp"?0x6bd6ff:aiming==="repair"?0x7dff9a:0xffc35a; aimMark.children.forEach(c=>c.material.color.setHex(col));
  aimMark.position.set(p.x,groundY(p.x,p.z)+.12,p.z); aimMark.visible=true;
  $("#aimtxt").textContent=`${CMD[aiming].name} · 좌표 ${gridRef(p.x,p.z)} · 손을 떼면 실행`;
}
function startAim(k){if(S.phase!=="battle"||S.cp<CMD[k].cost)return;aiming=k;S.phase="aim";$("#aim").hidden=false;$("#aimtxt").textContent=`${CMD[k].name} · 목표 지점을 누르세요 · 시간 정지`;hud();}
function cancelAim(){aiming=null;genAim=false;S.phase="battle";$("#aim").hidden=true;if(aimMark)aimMark.visible=false;hud();}
$("#go").onclick=startBattle;
$("#clear").onclick=()=>{deploy.filter(d=>!d.carried).forEach(d=>{scene.remove(d.u.root);S.units=S.units.filter(u=>u!==d.u);});deploy=deploy.filter(d=>d.carried);refreshDeploy();};
$("#speed").onclick=e=>{speed=speed===1?2:1;e.target.textContent="×"+speed;};
$("#flir").onclick=e=>{const on=!app.classList.contains("flir");app.classList.toggle("flir",on);e.target.setAttribute("aria-pressed",String(on));};

/* ───────── 크기 · 카메라 ───────── */
function resize(){
  const w=app.clientWidth,h=app.clientHeight; renderer.setSize(w,h,false); postSize();
  camera.aspect=w/h;
  const halfW=10.4*FK, d=CAM0.dist;
  const vf=2*Math.atan(Math.tan(Math.atan(halfW/d))/camera.aspect);
  camera.fov=Math.min(66,Math.max(38,vf*180/Math.PI)); camera.updateProjectionMatrix();
}


window.addEventListener("resize",resize);
$("#again").textContent=opts.endLabel||"다시 배치";
$("#opname").textContent=ST.op; $("#optag").textContent=opts.actLabel||(ST.id==="coast"?"육해공 시험판":ST.name);
$("#budmax").textContent=BUDGET_NOW; if(opts.preset&&!ST.drill)$("#budname").textContent="보충 예산"; if(opts.lockDeploy)$(".b3-budget").hidden=true;
if(URBAN)$("#dhint").textContent="카드를 고르고 칸을 누르면 배치 · 시가지라 해군은 못 들어와요(살아남은 배는 지휘력으로 도와요)";
else if(!OLD&&!TILES.some(t=>t.dom==="land"))$("#dhint").textContent="카드를 고르고 칸을 누르면 배치 · 바다 한가운데라 해군·공군만 싸워요";
else if(!OLD&&!TILES.some(t=>t.dom==="sea"))$("#dhint").textContent="카드를 고르고 칸을 누르면 배치 · 바다가 없는 전장이라 육군·공군만 싸워요";
if(!TILES.some(t=>t.dom===selTab)&&selTab!=="air"){selTab=TILES.some(t=>t.dom==="land")?"land":"sea";}
{const tb=TABS.find(t=>t.id===selTab);if(!tb.kinds.includes(selKind)||(ST.kinds&&!ST.kinds.includes(selKind)))selKind=tb.kinds.find(k=>!ST.kinds||ST.kinds.includes(k))||selKind;}
if(opts.onQuit){$("#quit").hidden=false;$("#quit").onclick=()=>opts.onQuit(S.phase);}
$("#again").onclick=()=>{if(opts.onEnd&&lastResult)opts.onEnd(lastResult);else setupDeploy(false);};

/* ───────── 돌리기 ───────── */
let last=performance.now(), time=0, raf=0;
function loop(now){
  if(disposed)return;
  const dt=Math.min(.05,(now-last)/1000); last=now; time+=dt;
  const sdt=dt*speed;
  if(S.phase==="battle"){acc+=sdt;while(acc>=TICK){acc-=TICK;step(S);if(S.phase!=="battle")break;}}
  if(S.phase==="battle"||S.phase==="end"){for(let i=vq.length-1;i>=0;i--){if(S.simT>=vq[i].at){const f=vq[i].fn;vq.splice(i,1);f();}}}
  const fdt=S.phase==="aim"?0:(S.phase==="battle"?sdt:dt);
  for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.t+=fdt;const k=Math.min(1,f.t/f.life);f.upd(f,k,fdt);if(f.t>=f.life){scene.remove(f.o);if(f.o.material&&f.o.material!==flashMat&&f.o.material!==fireMat&&f.o.material!==sparkMat&&!Object.values(MAT).includes(f.o.material)&&f.o.material.dispose)f.o.material.dispose();fx.splice(i,1);}}
  for(const L of lights){L.t+=fdt;L.l.intensity=L.t<.5?L.l.intensity*Math.pow(.004,fdt):0;}
  bangV*=Math.pow(.01,dt); bangEl.style.opacity=bangV.toFixed(3);
  if(S.phase!=="aim")updateWater(time);
  if(ptVis.length)updatePoints(time);
  renderUnits(S.phase==="aim"?0:(S.phase==="deploy"?dt:sdt),time);
  shake*=Math.pow(.02,dt);
  const hd=cam.dist*Math.cos(cam.pitch);
  camera.position.set(cam.tx+Math.sin(cam.yaw)*hd,cam.dist*Math.sin(cam.pitch),cam.tz+Math.cos(cam.yaw)*hd);
  camera.position.x+=(Math.random()-.5)*shake; camera.position.y+=(Math.random()-.5)*shake;
  camera.lookAt(cam.tx,0,cam.tz);
  if(aimMark&&aimMark.visible)aimMark.children[0].material.opacity=.6+Math.sin(time*8)*.3;
  compMat.uniforms.time.value=time; renderFrame(dt); watchSpeed(dt);
  if((time*20|0)%3===0)drawMini();
  hud();
  raf=requestAnimationFrame(loop);
}
buildTabs(); buildCards(); buildCmds(); resize();
loadModels().then(()=>{if(disposed)return;terrain(); buildPoints(); buildTiles(); highlightTiles(); setupDeploy(true); raf=requestAnimationFrame(loop);});
// 시험용 손잡이
window.__b3d={S,start:()=>startBattle(),sim:n=>{for(let i=0;i<n&&S.phase==="battle";i++)step(S);return S.phase+" "+S.simT.toFixed(1);},cmd:(k,x,z)=>doCmd(k,x,z)};

// 11-26 개발용: 병과 모형을 투명 바탕 그림으로 찍기(부대 화면 아이콘 만들 때만 씀)
if(opts.snap){window.__snapUnits=(kinds,px=256,vd)=>{
  const cv=document.createElement("canvas");cv.width=cv.height=px;const rr=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});rr.setClearColor(0x000000,0);
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xe8f2ff,0x3d3526,.9));const dl=new THREE.DirectionalLight(0xfff0d8,1.1);dl.position.set(-3,6,5);sc.add(dl);
  const cam=new THREE.PerspectiveCamera(30,1,.01,100);const out={};
  for(const k of kinds){const {root:o,parts}=makeModel(k,"us");[parts.ring,parts.hp,parts.blob].forEach(q=>{if(q&&q.parent)q.parent.remove(q);});if(parts.plane)parts.plane.position.x=0;
    sc.add(o);o.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(o);const c=bb.getCenter(new THREE.Vector3()),sz=bb.getSize(new THREE.Vector3()),R=Math.max(sz.x,sz.y,sz.z);
    const dir=(vd?new THREE.Vector3(...vd):new THREE.Vector3(.9,.75,1.25)).normalize();if(vd){const mk=new THREE.Mesh(new THREE.SphereGeometry(R*.06,8,6),new THREE.MeshBasicMaterial({color:0xff2020}));mk.position.set(c.x,c.y,c.z+R*.55);o.add(mk);o.updateMatrixWorld(true);}cam.position.copy(c).add(dir.multiplyScalar(R*2.2));cam.near=R*.05;cam.far=R*10;cam.updateProjectionMatrix();cam.lookAt(c);rr.render(sc,cam);out[k]=cv.toDataURL("image/png");sc.remove(o);}
  rr.dispose();return out;};}
return () => {
  disposed = true;
  cancelAnimationFrame(raf);
  timers.forEach((id) => clearTimeout(id)); timers.clear();
  window.removeEventListener("resize", resize);
  if (window.__b3d && window.__b3d.S === S) delete window.__b3d;
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  [rtScene, rtA, rtB].forEach((t) => t && t.dispose && t.dispose());
  renderer.dispose();
  root.innerHTML = "";
};
}
