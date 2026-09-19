'use strict';
// Run: node --test tests/score.test.cjs
// SCORE_REFERENCE_DIR may point to another unmodified copy of mil/index.html's assets.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const S=require('../js/09-score.js');
const reference=process.env.SCORE_REFERENCE_DIR||'/storage/emulated/0/.ck/mkzi/mkzi-nya.github.io/mil';
const app=fs.readFileSync(path.join(reference,'app.js'),'utf8');
const source=app.slice(app.indexOf('function calcCaps('),app.indexOf('function expandSequenceExpression('));
assert.ok(source.includes('function calculateScoreDetailed(input)'));
const wasmReady=WebAssembly.instantiate(fs.readFileSync(path.join(reference,'score_search_engine.wasm')),{});
let prefixChecks=0,finalChecks=0;
async function oracle(){
  const {instance}=await wasmReady,ex=instance.exports;
  function final(input){
    const bytes=Buffer.from(input);ex.temp_reset();const ptr=ex.temp_alloc(bytes.length);
    new Uint8Array(ex.memory.buffer,ptr,bytes.length).set(bytes);
    finalChecks++;return ex.calculate_score(ptr,bytes.length)|0;
  }
  const box={textContent:''};
  const context=vm.createContext({$:()=>box,engine:{calculateScore:final}});
  // Execute the original function with the full sequence. Every emitted row uses
  // its original full noteAmount, never the length of the prefix under test.
  vm.runInContext(source,context);
  const traced=vm.createContext({$:()=>({}),engine:{calculateScore:final},trace:[]});
  const marker='realtimeScores.push(`${n}\\t${finalScoreNow}`);';
  assert.equal(source.split(marker).length,2);
  // Observe locals without changing any reference calculation or source file.
  vm.runInContext(source.replace(marker,marker+'\ntrace.push({n,totalAccScore,totalComboScore,currentComboScore,currentCombo,maxCombo,prevLoss,comboMultNow,apBonusNow,counts:{...counts}});'),traced);
  return {final,run(input){
    const result=context.calculateScoreDetailed(input);
    traced.trace=[];traced.calculateScoreDetailed(input);
    const rows=input.length&&input.length<100000?box.textContent.split('\n').slice(1).map(line=>Number(line.split('\t')[1])):[];
    return {result,rows,steps:traced.trace};
  }};
}
let seed=0x739ab321;
function random(n,alphabet='epgnbm'){
  return Array.from({length:n},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return alphabet[seed%alphabet.length]}).join('');
}
function compareSequence(o,input){
  const {result,rows,steps}=o.run(input),st=S.create(input.length);
  assert.equal(S.process(st),0);
  for(let i=0;i<input.length;i++){
    S.extend(st,input[i]);const r=steps[i];
    assert.equal(S.process(st),rows[i],`process N=${input.length}, n=${i+1}`);
    for(const [local,ref] of Object.entries({len:'n',acc:'totalAccScore',procCombo:'totalComboScore',cur:'currentComboScore',combo:'currentCombo',maxCombo:'maxCombo',prevLoss:'prevLoss'})){
      assert.equal(st[local],r[ref],`${local} N=${input.length}, n=${i+1}`);
    }
    assert.equal(st.procCombo/(st.len*st.bMax),r.comboMultNow);
    assert.equal(st.allEP?5000*st.len/st.noteAmount:0,r.apBonusNow);
    assert.deepEqual(st.counts,JSON.parse(JSON.stringify(r.counts)));
    prefixChecks++;
  }
  assert.equal(S.final(st),result.finalScore,`WASM N=${input.length}`);
  const full=S.calculate(input);
  assert.equal(full.finalScore,result.finalScore);
  assert.equal(full.processScore,rows.at(-1)||0);
  assert.equal(full.totalAccScore,result.totalAccScore);
}

test('original app.js every process row/local and original WASM settlement',async()=>{
  const o=await oracle();
  for(const n of [1,2,7,10,49,50,99,100,191,192,193,377,799,800,1000,3789]){
    for(const c of 'epgnbm')compareSequence(o,c.repeat(n));
    compareSequence(o,random(n,'ep'));compareSequence(o,random(n));
    for(const tail of ['g','n','b','m','mep','mpp','mpe','bnbnpgbmgg']){
      compareSequence(o,('e'.repeat(n)+tail).slice(-n));
    }
  }
  for(let i=0;i<80;i++)compareSequence(o,random(1+(i*73)%1300));
  const discrepancy=S.calculate('bnbnpgbmgg');
  assert.equal(discrepancy.processScore,293340);
  assert.equal(discrepancy.finalScore,284700);
  assert.equal(S.calculate('e'.repeat(377)).finalScore,1010000);
  assert.equal(S.calculate('p'.repeat(377)).finalScore,1000000);
});

test('large chart final score against WASM run compression',async()=>{
  const o=await oracle();
  for(const seq of ['e'.repeat(100000),'ep'.repeat(50000),random(100001), 'e'.repeat(99900)+'m'+'p'.repeat(99)]){
    assert.equal(S.calculate(seq).finalScore,o.final(seq));
  }
});

test('cursor batch append, restart, backward/forward seek, clear and mode changes',async()=>{
  const o=await oracle(),N=377,seq=random(N),rows=o.run(seq).rows,read=S.cursor();
  let live=[];
  for(const n of [0,1,8,91,320,377]){
    live.push(...seq.slice(live.length,n));
    assert.equal(S.process(read(live,N)),rows[n-1]||0);
  }
  live.length=0;assert.equal(S.final(read(live,N)),0);
  live.push(...seq.slice(0,30));assert.equal(S.process(read(live,N)),rows[29]);
  live=seq.slice(0,30).split('');assert.equal(S.process(read(live,N)),rows[29]);
  live=[];const autoRows=o.run('e'.repeat(N)).rows;
  for(const n of [100,220,20,0,377])assert.equal(S.process(read(live,N,n,true)),autoRows[n-1]||0);
  live.push('m');assert.equal(S.process(read(live,N)),o.run('m'+'e'.repeat(N-1)).rows[0]);
  assert.equal(S.process(read([],0)),0);
  assert.equal(S.calculate('',0).finalScore,0);
  assert.equal(S.calculate([],N).accuracy,0);
});

test('dense append reads each new judgement once; idle frames read none',()=>{
  let reads=0;const arr=[],seq=new Proxy(arr,{get(target,key){if(/^\d+$/.test(String(key)))reads++;return target[key]}}),read=S.cursor();
  for(let i=0;i<3789;i+=19){arr.push(...'epgnbm'.repeat(4).slice(0,Math.min(19,3789-i)));read(seq,3789)}
  assert.equal(reads,3789);
  for(let frame=0;frame<10000;frame++)S.snapshot(read(seq,3789));
  assert.equal(reads,3789);
});

function browser(){
  const nodes=new Map();
  function node(){
    const classes=new Set();
    return {style:{},dataset:{},textContent:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
      addEventListener(){},appendChild(){},setAttribute(){},removeAttribute(){},
      querySelector(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}};
  }
  const text=[],stage=node(),runtime={notes:[],duration:100,meta:{Title:'Score test'}};
  const c=vm.createContext({console,performance,queueMicrotask:()=>{},
    state:{appMode:'play',runtime,currentTime:0,duration:100},
    els:{stage,stageWrap:node()},document:{body:node(),getElementById:()=>null,addEventListener(){},createElement:node},
    navigator:{maxTouchPoints:1},matchMedia:()=>({matches:false}),
    ctx:new Proxy({fillText:t=>text.push(t)},{get:(obj,key)=>key in obj?obj[key]:()=>{}}),
    NOTE_HIT:0,NOTE_DRAG:1,NOTE_FRACTURE:2,
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),render(){},drawCombo(){},
    seek(t){c.state.currentTime=t},setPlaying(v){c.state.playing=v},setAppMode(m){c.state.appMode=m},
    prepare(){},updateModeUI(){},updateControls(){},precompute(){},drawNote(){},
    setStatus:null,__milTintSlice:null,noteTextureKey:null,drawStoryboardLayer:null,drawLineState:null,
    addEventListener(){}});
  c.window=c;
  for(const file of ['09-score.js','10-gameplay.js','16-targeted-perf.js','17-result-page.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),c,{filename:file});
  }
  return {c,nodes,text,runtime};
}

test('actual 10 + 16 + result wiring, HUD labels, million-unit accuracy and settlement isolation',async()=>{
  const o=await oracle(),{c,nodes,text,runtime}=browser(),gp=c.state.realGameplay;
  gp.allCombo=10;gp.comboTimes=Array.from({length:10},(_,i)=>i+1);
  for(const [input,label] of [['','ALL PERFECT'],['e','ALL PERFECT'],['ep','ALL PERFECT'],['epg','FULL COMBO'],['epgn','FULL COMBO'],['epgnb','COMBO'],['epgnm','COMBO']]){
    gp.judgeSequence=input.split('');text.length=0;c.drawCombo(runtime,0,1920,1080);
    assert.equal(text[0],label);
    assert.equal(c.__gpProcessScore(),o.run(input+'e'.repeat(10-input.length)).rows[input.length-1]||0);
  }
  gp.judgeSequence=['p'];c.drawCombo(runtime,0,1920,1080);assert.equal(text.at(-1),'99.00%');
  const before=c.__gpHudMetrics(0),settled=c.__gpScoreBreakdown(true);
  assert.equal(settled.finalScore,o.final('p'+'m'.repeat(9)));
  assert.equal(settled.totalAccScore,990000);assert.equal(settled.counts.m,9);
  assert.deepEqual(c.__gpHudMetrics(0),before);assert.equal(gp.judgeSequence.length,1);
  c.__gpShowResult();assert.equal(nodes.get('#gameResultAcc').textContent,'9.90%');
  assert.equal(nodes.get('#gameResultScore').textContent,String(settled.finalScore).padStart(7,'0'));
  c.__gpHideResult();gp.judgeSequence=Array(10).fill('e');c.__gpShowResult();
  assert.equal(nodes.get('#gameResultAcc').textContent,'100.00%');
  gp.autoplay=true;assert.equal(c.__gpHudMetrics(5).label,'AUTOPLAY');
  assert.equal(c.__gpHudMetrics(5).score,o.run('e'.repeat(10)).rows[4]);
  assert.equal(c.__gpHudMetrics(2).score,o.run('e'.repeat(10)).rows[1]);
});

test('actual gameplay seek/restart and runtime replacement invalidate score',async()=>{
  const o=await oracle(),{c}=browser();
  const rt={duration:100,notes:Array.from({length:50},(_,i)=>({key:String(i),type:0,startSec:i+1,endSec:i+1,isHold:false,globalIdx:i}))};
  c.state.runtime=rt;c.__gpTest.fresh(rt);
  const gp=c.state.realGameplay,rows=o.run('e'.repeat(50)).rows;
  for(const t of [20.5,40.5,10.5,0]){
    c.seek(t);assert.equal(c.__gpProcessScore(),rows[Math.floor(t)-1]||0);
  }
  gp.judgeSequence.push('m');assert.equal(c.__gpHudComboLabel(),'COMBO');
  c.seek(0);assert.equal(c.__gpProcessScore(),0);assert.equal(c.__gpHudComboLabel(),'ALL PERFECT');
  c.state.runtime={duration:0,notes:[]};assert.equal(c.__gpProcessScore(),0);
  assert.equal(c.__gpScoreBreakdown(true).totalAccScore,0);
});

test.after(()=>console.log(`Independent oracle checks: ${prefixChecks} process prefixes, ${finalChecks} WASM calls`));
