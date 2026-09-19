import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assets from './storyboard-assets.cjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reference=process.env.MILPLAY_LUNE_DIR||path.resolve(root,'../MilLunePlayer-main');
const archive=process.env.MILPLAY_ARCHIVE_DIR||path.resolve(root,'../milthm-archive/code/chart/js');

test('supplied MilLune WASM keeps HUD opaque after beats1 (evidence, not desired behavior)',async()=>{
  const {default:Module}=await import(pathToFileURL(path.join(reference,'build/millune_h5bind_wasm.js')));
  const m=await Module(),context=m._h5bind_create_context();
  const string=s=>{const n=m.lengthBytesUTF8(s)+1,p=m._malloc(n);m.stringToUTF8(s,p,n);return p};
  const f64=(p,v)=>new DataView(m.HEAPU8.buffer).setFloat64(p,v,true);
  const u64=(p,v)=>new DataView(m.HEAPU8.buffer).setBigUint64(p,BigInt(v),true);
  let calls=[],nextId=1n;
  const textures=new Map();
  // Same callback signatures as src/h5bind.js:298-322. Target picture sizes
  // come from the real ZIP PNG headers; builtin placeholders are unrelated to them.
  const sizes=new Map(['black.png','beats1.png'].map(name=>{
    const b=assets.entry('storyboard/'+name);return [name,[b.readUInt32BE(16),b.readUInt32BE(20)]];
  }));
  const callbacks={
    drawBackground:['v'],drawMilLineHead:['vdddi'],drawLine:['vdddddi'],
    drawPointNote:['vidddddi'],drawHold:['vidddddddi'],playClicksound:['vi'],
    getTextureSize:['viii',(_,w,h)=>{f64(w,100);f64(h,100)}],
    getScreenSize:['vii',(w,h)=>{f64(w,1920);f64(h,1080)}],
    getDuration:['vi',p=>f64(p,240)],
    drawPauseBtn:['vddddd',(...args)=>calls.push({kind:'pause',alpha:args[4]})],
    drawProgressBar:['vdd',(_,alpha)=>calls.push({kind:'progress',alpha})],
    drawText:['vijdddiiii',(p,n,x,y,size,bold,align,baseline,color)=>calls.push({kind:'text',text:m.UTF8ToString(p,Number(n)),alpha:color&255})],
    loadStoryboardTexture:['vijiii',(p,n,id,w,h)=>{const key=nextId++,name=m.UTF8ToString(p,Number(n)),size=sizes.get(name)||[1920,1080];textures.set(key,name);u64(id,key);u64(w,size[0]);u64(h,size[1])}],
    drawStoryboardText:['vijddddddi'],
    drawStoryboardPicture:['vjdddddddi',(id,x,y,w,h,sx,sy,rotation,color)=>calls.push({kind:'picture',name:textures.get(id),x,y,w,h,sx,sy,rotation,color:color>>>0,alpha:color&255})],
    releaseStoryboardTexture:['vj'],
    createClickEffectTexture:['vjdiii',(_,p,perfect,good,id)=>u64(id,nextId++)],
    drawClickEffectTexture:['vjidddd'],releaseClickEffectTexture:['vj'],drawEllipse:['vdddddi'],
    getResourcePackNoteScale:['vii',(_,p)=>f64(p,1)],
    getResourcePackLineHeadScale:['vi',p=>f64(p,1)],
    getResourcePackLineHeadConnectPoint:['vi',p=>f64(p,1)],
    drawRect:['vddddi'],drawCompletionStatus:['vijiiiijd']
  };
  for(const [name,[signature,fn]]of Object.entries(callbacks)){
    const p=string(name);m._h5bind_context_set_rendering_func(context,p,m.addFunction(fn||(()=>{}),signature));m._free(p);
  }
  m._h5bind_init_context(context);
  // The reference's embedded cvtTime(time,bpmId) mistakenly reads free variable
  // `bpm`. This source uses one BPM, index 0; supplying that variable avoids the
  // loader bug without modifying the WASM, reference JS, or chart on disk.
  const packageSource=assets.entry('Special_Algebra.js').toString('utf8');
  assert.equal(packageSource.trim(),fs.readFileSync(path.join(archive,'Special_Algebra.js'),'utf8').trim());
  const source='var bpm=0;'+packageSource;
  const p=string(source);m._h5bind_load_chart(context,p,BigInt(Buffer.byteLength(source)));m._free(p);
  for(const sec of [40,45,49,51]){
    calls=[];m._h5bind_render(context,sec);
    const blacks=calls.filter(c=>c.name==='black.png'),beats=calls.find(c=>c.name==='beats1.png');
    assert.equal(blacks.length,2);
    assert.deepEqual(blacks.map(c=>c.alpha),[sec===40?0:127,0]);
    for(const c of blacks)assert.deepEqual([c.x,c.y,c.w,c.h,c.sx,c.sy,c.rotation],[960,540,2328.75,1309.921875,3,3,0]);
    assert.deepEqual([beats.x,beats.y,beats.w,beats.h,beats.sx,beats.sy,beats.rotation],[960,460,1552.5,873.28125,1,1,0]);
    const picture=calls.findIndex(c=>c.kind==='picture'&&c.name==='beats1.png');
    assert.ok(picture>=0,'chart must actually load');
    assert.equal(calls[picture].alpha,sec===45||sec===49?255:0);
    const pause=calls.findIndex(c=>c.kind==='pause');
    assert.ok(pause>picture,'reference HUD is drawn after storyboard');
    assert.equal(calls[pause].alpha,.4);
    assert.equal(calls.find(c=>c.kind==='progress').alpha,1);
    assert.equal(calls.find(c=>c.kind==='text'&&c.text==='AUTOPLAY').alpha,255);
    assert.equal(calls.find(c=>c.kind==='text'&&/^\d{7}$/.test(c.text)).alpha,255);
  }
});
