'use strict';
// Phone-only: node tests/bridge-assets.test.cjs [archive/chart/js] [sample.js ...]
// DOM/Canvas are fakes: this verifies JS contracts, not decoded pixels or media.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])),nodes=new Map(),messages=new Set(),images=[],revoked=[];
const noop=()=>{},raf=[],canvasContext=()=>new Proxy({measureText:s=>({width:String(s).length*20}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),globalAlpha:1},{get:(o,k)=>k in o?o[k]:noop});
let context,serial=0;
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={setProperty:(k,v)=>{this.style[k]=v},removeProperty:k=>{delete this.style[k]}};this.dataset={};this.children=[];this.listeners=new Map();this.width=1280;this.height=720;this.value='';this.options=[];this.paused=true;this.currentTime=0;this.duration=300;this.classes=new Set();this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle:(x,on)=>{on=on??!this.classes.has(x);on?this.classes.add(x):this.classes.delete(x);return on}}}
 getContext(){return this.ctx||(this.ctx=canvasContext())}
 getBoundingClientRect(){return {left:0,top:0,right:1280,bottom:720,width:1280,height:720}}
 get clientWidth(){return this.width} get clientHeight(){return this.height}
 addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f)}
 removeEventListener(t,f){this.listeners.get(t)?.delete(f)}
 emit(t){for(const f of [...this.listeners.get(t)||[]])f({target:this,preventDefault:noop})}
 setAttribute(k,v){this[k]=v} removeAttribute(k){this[k]=''}
 appendChild(e){this.children.push(e);e.parentElement=this;if(e.id)nodes.set(e.id,e);if(e.tagName==='IFRAME'){
   const sandbox={parent:{postMessage:data=>{for(const f of [...messages])f({data,source:e.contentWindow})}},console};
   e.contentWindow={};vm.runInNewContext(e.srcdoc.match(/<script>([\s\S]*)<\/script>/)[1],sandbox,{timeout:8000});
 }return e}
 append(...a){a.forEach(e=>this.appendChild(e))} remove(){} matches(){return false}
 querySelector(sel){if(sel.startsWith('#'))return get(sel.slice(1));return null} querySelectorAll(){return []}
 set innerHTML(s){for(const m of s.matchAll(/\bid="([^"]+)"/g)){ids.add(m[1]);this.appendChild(get(m[1]))}}
 pause(){this.paused=true} play(){this.paused=false;return Promise.resolve()}
 load(){if(this.src)queueMicrotask(()=>this.emit('loadedmetadata'))}
 setPointerCapture(){} releasePointerCapture(){} click(){} close(){} showModal(){this.querySelector('button')?.click()}
}
function get(id){if(!ids.has(id))return null;if(!nodes.has(id)){const e=new Element(id==='stage'?'canvas':'div');e.id=id;nodes.set(id,e)}return nodes.get(id)}
class ImageFake{constructor(){images.push(this);this.complete=false;this.naturalWidth=0;this.naturalHeight=0}set src(s){this._src=s}get src(){return this._src}ready(w=64,h=64){this.complete=true;this.naturalWidth=w;this.naturalHeight=h;this.onload?.()}}
const document={body:new Element(),head:new Element(),documentElement:new Element(),getElementById:get,createElement:t=>new Element(t),addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],activeElement:{tagName:'BODY'},scripts:[]};
context=vm.createContext({console,document,Image:ImageFake,HTMLCanvasElement:Element,Blob,File,TextDecoder,TextEncoder,Response,DecompressionStream,performance,URL:{createObjectURL:()=>`blob:test-${++serial}`,revokeObjectURL:u=>revoked.push(u)},navigator:{language:'en-US',maxTouchPoints:1},matchMedia:()=>({matches:false,addEventListener:noop}),screen:{orientation:{}},devicePixelRatio:1,innerWidth:1280,innerHeight:720,requestAnimationFrame:f=>(raf.push(f),raf.length),cancelAnimationFrame:noop,setTimeout,clearTimeout,queueMicrotask,ResizeObserver:class{observe(){}},localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},addEventListener:(t,f)=>{if(t==='message')messages.add(f)},removeEventListener:(t,f)=>{if(t==='message')messages.delete(f)}});
context.window=context;context.globalThis=context;
const run=s=>vm.runInContext(s,context,{timeout:10000});
for(const m of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(path.join(root,m[1]),'utf8'),context,{filename:m[1],timeout:10000});
async function main(){
 assert.equal(run('typeof ensureDiffModel'), 'undefined');assert.equal(run('typeof normHand'), 'undefined');assert.equal(run('typeof assign_hands'), 'undefined');
 const archive=process.argv[2]||path.resolve(root,'../milthm-archive/code/chart/js');
 const samples=process.argv.slice(3);if(!samples.length)samples.push('Drizzle_Autumn Rain.js','Cloudburst_Algebra.js');
 assert(samples.length<=3,'Run at most three real charts per batch');
 for(const name of samples){
   const source=fs.readFileSync(path.join(archive,name),'utf8');assert(source.length<4000000);
   context.source=source;const chart=await run('milizeJsToJson(source)');
   context.chart=chart;const rt=run('makeRuntime(chart)');
   const count=chart.lines.reduce((n,l)=>n+l.notes.length,0);assert(count>0);assert.equal(rt.notes.length,count);assert.equal(rt.storyboards.length,chart.storyboardObjects.length);
   assert.equal(new Set(rt.notes.map(n=>n.animIdx)).size,count);
   for(const n of rt.notes){assert.deepEqual(Array.from(chart._note_create_order[n.animIdx]),[n.lineIdx,n.localIdx]);assert(Number.isFinite(n.startSec));if(n.type===1){assert.equal(n.isHold,false);assert.equal(n.fallbackKind,'drag')}}
   for(const a of chart.animations){const limit=[chart.lines.length,count,chart.storyboardObjects.length][a.data];assert(a.i1===-1||(a.i1>=0&&a.i1<limit),`bad target ${a.data}/${a.i1}`)}
   const eligible=run('chart.animations.filter(a=>a.i1>=0&&__MIL_VALID_ANIMATION_KEYS.get(a.data)?.has(a.key)).length');
   let compiled=0;for(const byTarget of rt.events.values())for(const byKey of byTarget.values())for(const tr of byKey.values())compiled+=tr.events.length;assert.equal(compiled,eligible,'valid animations dropped');
   // Re-execute the same real source using full method names (including chained p).
   context.source=source.replace(/\bvar [mtsnapX]=[^;]+;/g,'').replace(/m\.p=p;/g,'').replace(/\bm\./g,'MilizeBeatmap.').replace(/\bp\(/g,'withProperty(').replace(/\b([tnasX])\(/g,(_,x)=>({t:'timing',n:'note',a:'animation',s:'storyboardObject',X:'note'}[x])+'(');
   const full=await run('milizeJsToJson(source)');assert.equal(JSON.stringify(full),JSON.stringify(chart));
   context.chart=chart;run("prepare(chart,'test.js');setPlaying(false);seek(20);render()");
   console.log(`${name}: ${count} notes, ${chart.animations.length} animations, ${rt.storyboards.length} storyboards; alias/fullname identical`);
 }
 const bridge=await run(`milizeJsToJson('const b=timing(0,120),l=line(),q=note(l,b,2,5,1,false,false),r=storyboardObject(1,"text",2);animation(b,0,1,0,0,10,1,q,0,0,false,"");animation(b,0,1,2,0,1,2,r,0,0,false,"");')`);
 context.chart=bridge;assert.equal(run('makeRuntime(chart).notes[0].isHold'),false);assert.equal(bridge.animations[1].i1,0);
 for(const bad of ['null','undefined','false','""','" "'])assert.throws(()=>run(`__milScopedTimeToSeconds(${bad},null,[],0,false)`));
 context.raw={FormatVersionCode:9,BPMList:[{Start:0,BPM:120}],LineCount:1,NoteList:[{Line:0,BPM:0,From:null,FromTime:null,To:null,ToTime:1,Type:1,Fake:false}],AnimationList:[],StoryBoardObjects:[]};
 assert.throws(()=>run('normalizeMilthm(raw)'));context.raw.NoteList[0].FromTime=0;assert.equal(run('makeRuntime(normalizeMilthm(raw)).notes[0].isHold'),false);
 context.jsonFile=new File([JSON.stringify(bridge)],'chart.json');context.jsFile=new File(['timing(0,120);line();'],'chart.js');
 const candidates=await run('__milFindParseableCharts([jsonFile,jsFile])');assert.equal(candidates.matches.length,2);assert.equal(candidates.matches[0].file.name,'chart.js');
 context.file1=new File(['a'],'img.png',{type:'image/png',lastModified:1});context.file2=new File(['b'],'img.png',{type:'image/png',lastModified:1});
 run('__milIndexPackageAssets([],"");__milRegisterUploadedAssetBatch([file1])');const first=run('__milAssetUrl("img.png")');run('__milRegisterUploadedAssetBatch([file2])');const second=run('__milAssetUrl("img.png")');assert.notEqual(first,second);assert(revoked.includes(first));
 context.sf=new File(['a'],'storyboard/img.png');run('__milIndexPackageAssets([sf],"chart.js");storyImage("img.png")');const pending=images.at(-1),oldUrl=pending.src;run('__milRegisterUploadedAssetBatch([file2])');assert(revoked.includes(oldUrl));pending.ready();assert.equal(run('storyCache.has("img.png")'),false);
 run('storyImage("img.png")');images.at(-1).ready(4096,2048);assert.equal(run('storyCache.get("img.png").sourceWidth'),4096);run('__milRevokePackageAssets()');assert.equal(run('state.assetObjectUrls.size'),0);
 context.dup=new File(['b'],'other/storyboard/img.png');run('__milIndexPackageAssets([sf,dup],"chart.js")');assert.equal(run('window.__milResolveStoryboardFile("img.png")'),null);assert.equal(run('window.__milResolveStoryboardFile("storyboard/img.png")'),context.sf);
 const bg1=run('setBackgroundFile(file1)'),image1=images.at(-1),bg2=run('setBackgroundFile(file2)'),image2=images.at(-1);image2.ready();await bg2;image1.ready();await bg1;assert.equal(run('state.backgroundImage'),image2);
 const failed=run('setBackgroundFile(file1)'),image3=images.at(-1);image3.onerror();await assert.rejects(failed);assert(revoked.includes(image3.src));
 const audio=get('audioPlayer'),load=audio.load;audio.load=noop;const mediaFailure=run('setMediaFile(file1)'),mediaUrl=run('state.mediaUrl');audio.emit('error');await assert.rejects(mediaFailure);assert(revoked.includes(mediaUrl));assert.equal(run('state.mediaReady'),false);audio.load=load;
 // Selecting cancel must preserve resources and must not register the upload batch.
 const savedFind=run('__milFindParseableChart');context.savedFind=savedFind;
 run('__milFindParseableChart=async()=>({file:null,parsed:null,matches:[{},{}]});state.bgUrl="blob:keep"');const before=run('__milEnsureUploadedAssetBatches().length');await run('loadFiles([file1])');assert.equal(run('state.bgUrl'),'blob:keep');assert.equal(run('__milEnsureUploadedAssetBatches().length'),before);run('__milFindParseableChart=savedFind');
 let release,active=0,maxActive=0,calls=0;context.queuedFind=async()=>{active++;maxActive=Math.max(maxActive,active);if(++calls===1)await new Promise(r=>release=r);active--;return {matches:[{},{}]}};run('__milFindParseableChart=queuedFind');const q1=run('loadFiles([file1])'),q2=run('loadFiles([file2])');for(let i=0;i<10&&!release;i++)await Promise.resolve();assert(release);release();await Promise.all([q1,q2]);assert.equal(maxActive,1);run('__milFindParseableChart=savedFind');
 // Ring tint cache must distinguish manual Good from normal judgement colors.
 run('__plu100DrawRingMask(0,0,20,0,[1,2,3],10);__plu100DrawRingMask(0,0,20,0,[4,5,6],10)');assert(run('__plu100TintedRings.has("10:1,2,3")&&__plu100TintedRings.has("10:4,5,6")'));
 console.log('PASS: full script chain, prepare/seek/render, identifiers, drag type, endpoints, URL identity/revoke, stale callback, intrinsic size, cancelled load, ring tint');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
