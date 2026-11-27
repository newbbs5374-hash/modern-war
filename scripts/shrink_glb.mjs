// 받은 Sketchfab 모형(gltf)을 게임용 glb로 줄이기(11-27). 따로 설치: npm i @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 @gltf-transform/extensions@4.1.1 meshoptimizer@0.22.0 sharp@0.33.5
// 쓰는 법: node shrink_glb.mjs <scene.gltf> <out.glb> <목표 삼각형 수> <avg|vcol> [x,y,z 회전(도)|-] [뺄 노드 이름 정규식]
// avg = 재질마다 평균 색(부대, 우리 팀 색으로 다시 칠함) · vcol = 텍스처 색을 점 색으로(건물·시설)
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {flatten,join,weld,simplify,dedup,prune,quantize,dequantize} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
const [inp,out,targetS,mode='avg',rotS,dropS]=process.argv.slice(2); const target=+targetS;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(inp); const root=doc.getRoot();
await MeshoptSimplifier.ready;
if(dropS){const re=new RegExp(dropS);root.listNodes().forEach(n=>{if(n.getMesh()&&re.test(n.getName()))n.dispose();});}
if(rotS&&rotS!=='-'){const [rx,ry,rz]=rotS.split(',').map(x=>+x*Math.PI/180);const sc=root.listScenes()[0];const w=doc.createNode('rot');
  const cx=Math.cos(rx/2),sx=Math.sin(rx/2),cy=Math.cos(ry/2),sy=Math.sin(ry/2),cz=Math.cos(rz/2),sz=Math.sin(rz/2);
  w.setRotation([sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz]);sc.listChildren().forEach(c=>{sc.removeChild(c);w.addChild(c);});sc.addChild(w);}
// 1. skins & animations
root.listAnimations().forEach(a=>a.dispose());
root.listNodes().forEach(n=>{if(n.getSkin())n.setSkin(null);});
root.listSkins().forEach(s=>s.dispose());
// texture decode
const texCache=new Map();
async function decode(tex){if(!tex)return null;if(texCache.has(tex))return texCache.get(tex);
  let r=null;try{const img=Buffer.from(tex.getImage());const {data,info}=await sharp(img).resize(256,256,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});r={data,w:info.width,h:info.height};}catch(e){r=null}
  texCache.set(tex,r);return r;}
function sample(T,u,v){u=u-Math.floor(u);v=v-Math.floor(v);const x=Math.min(T.w-1,Math.floor(u*T.w)),y=Math.min(T.h-1,Math.floor(v*T.h));const i=(y*T.w+x)*4;return [T.data[i]/255,T.data[i+1]/255,T.data[i+2]/255];}
const s2l=c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
function meanT(T){let r=0,g=0,b=0,n=T.w*T.h;for(let i=0;i<n;i++){r+=T.data[i*4];g+=T.data[i*4+1];b+=T.data[i*4+2];}return [r/n/255,g/n/255,b/n/255];}
const SG='KHR_materials_pbrSpecularGlossiness';
for(const mat of root.listMaterials()){
  let fac=mat.getBaseColorFactor(), tex=mat.getBaseColorTexture();
  const sg=mat.getExtension(SG); if(sg){fac=sg.getDiffuseFactor();tex=sg.getDiffuseTexture()||tex;}
  const T=await decode(tex);
  mat.setExtras({...mat.getExtras(),_T:null});
  mat.__T=T; mat.__fac=fac;
}
for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
  const mat=p.getMaterial(); if(!mat)continue; const T=mat.__T, fac=mat.__fac||[1,1,1,1];
  const uv=p.getAttribute('TEXCOORD_0');
  if(mode==='vcol'&&T&&uv){const pos=p.getAttribute('POSITION');const n=pos.getCount();const arr=new Float32Array(n*4);const t=[0,0];const old=p.getAttribute('COLOR_0');const oc=[1,1,1,1];
    for(let i=0;i<n;i++){uv.getElement(i,t);const c=sample(T,t[0],t[1]);if(old)old.getElement(i,oc);for(let k=0;k<3;k++)arr[i*4+k]=s2l(c[k])*fac[k]*(old?oc[k]:1);arr[i*4+3]=1;}
    const acc=doc.createAccessor().setType('VEC4').setArray(arr).setBuffer(root.listBuffers()[0]);p.setAttribute('COLOR_0',acc);
  }
}
for(const mat of root.listMaterials()){const T=mat.__T,fac=mat.__fac||[1,1,1,1];
  if(mode==='vcol'&&T)mat.setBaseColorFactor([1,1,1,fac[3]]);
  else if(T){const m=meanT(T);mat.setBaseColorFactor([s2l(m[0])*fac[0],s2l(m[1])*fac[1],s2l(m[2])*fac[2],fac[3]]);}
  else mat.setBaseColorFactor(fac);
  mat.setBaseColorTexture(null);mat.setNormalTexture(null);mat.setOcclusionTexture(null);mat.setEmissiveTexture(null);mat.setMetallicRoughnessTexture(null);
  mat.setEmissiveFactor([0,0,0]);mat.setMetallicFactor(0);mat.setRoughnessFactor(0.8);
  for(const e of mat.listExtensions())mat.setExtension(e.extensionName,null);
  if(mat.getAlphaMode()==='MASK')mat.setAlphaMode('OPAQUE');
}
root.listTextures().forEach(t=>t.dispose());
root.listExtensionsUsed().forEach(e=>{if(!['KHR_mesh_quantization'].includes(e.extensionName))e.dispose();});
for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){for(const s of p.listSemantics()){if(/^(TEXCOORD|TANGENT|JOINTS|WEIGHTS|NORMAL)/.test(s)||(s.startsWith('COLOR_')&&s!=='COLOR_0'))p.setAttribute(s,null);}
  if(mode!=='vcol'&&p.getAttribute('COLOR_0'))p.setAttribute('COLOR_0',null);
  for(const t of p.listTargets())t.dispose();}
await doc.transform(dequantize(),flatten(),join({keepNamed:false}),weld({tolerance:0.0001}));
let tri=0;root.listMeshes().forEach(m=>m.listPrimitives().forEach(p=>{const i=p.getIndices();tri+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3;}));
const count=()=>{let t=0;root.listMeshes().forEach(m=>m.listPrimitives().forEach(p=>{const i=p.getIndices();t+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3;}));return t;};
let err=0.005;
while(count()>target*1.25&&err<0.6){const r=Math.min(1,target/count());await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:r,error:err}));err*=2;}
// remove normals → game recomputes? keep normals but drop if simplified heavily
await doc.transform(dedup(),prune(),quantize({quantizePosition:14,quantizeColor:8}));
let tri2=0;root.listMeshes().forEach(m=>m.listPrimitives().forEach(p=>{const i=p.getIndices();tri2+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3;}));
await io.write(out,doc);
const fs=await import('fs');console.log(out.split('/').pop(),Math.round(tri),'->',Math.round(tri2),(fs.statSync(out).size/1024).toFixed(0)+'KB');
