'use strict';
// 手机端运行：node --test tests/milize-bridge.test.cjs
// 覆盖：
//   1) Beatmap.js/Milize JS 沙箱桥接契约（短别名/全名/全局 MilizeBeatmap/链式/解绑调用/env）；
//   2) parseText 对打包谱面的识别（含 `var L=MilizeBeatmap,ul=L.env,...` 这类任意别名）；
//   3) 有界真实谱面抽样（分层抽样 + 指定回归样本），校验解析成功率与 notes/animations/storyboard 数量。
// 不依赖浏览器：DOM/Canvas 为最小伪造，只验证 JS 契约与结构数量，不解码像素。
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness}=require('./harness.js');

const root=path.resolve(__dirname,'..');
const archive=process.env.MILPLAY_ARCHIVE_DIR||'/storage/emulated/0/.ck/milthm/milthm-archive/code/chart/js';
const extraDir=process.env.MILPLAY_EXTRA_DIR||'/storage/emulated/0/.ck/mkzi/nya/存档/音游/mil/archive/雨ep';
const h=createHarness(root,{childTimeout:60000});

function parseSource(source){
  h.context.__src=source;
  return h.run('parseText(__src,"sample.js")');
}
function countNotes(chart){let n=0;for(const l of chart.lines||[])n+=(l.notes||[]).length;return n}

test('桥接：短别名 / 全名 / 解绑调用均能写入同一实例',async()=>{
  // 短别名
  const short=await parseSource('const b=t(10,60,4);const l=m.line();const q=n(l,b,[2,0,1],[2,0,1],0,false,false);a(b,[0,0,1],[1,0,1],0,1,2,1,q,0,0,false,"");');
  assert.equal(short.chart.bpms.length,1);
  assert.equal(short.chart.lines[0].notes.length,1);
  assert.equal(short.chart.lines[0].notes[0].bpm,0,'timing 必须返回 BPM id');
  assert.equal(short.chart.animations[0].i1,0,'note 必须返回 Note id');
  // 全名
  const full=await parseSource('const b=m.timing(0,120,4);const l=m.line();const q=m.note(l,b,[0,0,1],[0,0,1],0,false,false);m.animation(b,[0,0,1],[1,0,1],0,0,1,1,q,13,2,true,"x");');
  assert.equal(full.chart.animations[0].press,13);
  assert.equal(full.chart.animations[0].ease,2);
  assert.equal(full.chart.animations[0].valueExpression,true);
  // 解绑保存后调用（Cloudburst_Threat - Metropolis 的核心形态）
  const unbound=await parseSource('var n0=MilizeBeatmap,u0=n0.timing,w=n0.line,s=n0.note,e=n0.animation,Y=n0.withProperty;Y("a","b");var b=u0(0,120,4),l=w();var q=s(l,b,[0,0,1],[0,0,1],0,false,false);e(b,[0,0,1],[1,0,1],0,0,1,1,q,0,0,false,"");');
  assert.equal(countNotes(unbound.chart),1);
  assert.equal(unbound.chart.animations.length,1);
  assert.equal(unbound.chart.meta.a,'b');
});

test('桥接：直接引用全局 MilizeBeatmap 与链式调用',async()=>{
  const r=await parseSource('MilizeBeatmap.withProperty("k","v").note(MilizeBeatmap.line(),MilizeBeatmap.timing(0,120,4),[0,0,1],[0,0,1],0,false,false);MilizeBeatmap.animation(0,[0,0,1],[1,0,1],0,0,1,0,0,0,0,false,"");');
  assert.equal(countNotes(r.chart),1);
  assert.equal(r.chart.meta.k,'v');
  assert.equal(r.chart.animations.length,1);
  // 先解构方法，再通过 MilizeBeatmap 链式继续
  const chain=await parseSource('var p=MilizeBeatmap.withProperty;p("x",1).p&&0;MilizeBeatmap.withProperty("y",2).withProperty("z",3);MilizeBeatmap.line();');
  assert.equal(chain.chart.meta.y,2);
  assert.equal(chain.chart.meta.z,3);
});

test('桥接：打包后方法别名任意命名也能识别（Sky Islands 形态）',async()=>{
  const r=await parseSource('var L=MilizeBeatmap,ul=L.env,nl=L.timing,k=L.line,Nl=L.storyboardObject,f=L.note,l=L.animation,D=L.withProperty;D("Title","x");nl(0,120,4);var ln=k();f(ln,0,[0,0,1],[0,0,1],0,false,false);Nl(1,"t",2);l(0,[0,0,1],[1,0,1],0,0,1,0,0,0,0,false,"");');
  assert.equal(countNotes(r.chart),1);
  assert.equal(r.chart.storyboardObjects.length,1);
  assert.equal(r.chart.meta.Title,'x');
});

test('桥接：env 返回实际舞台尺寸字符串，不随 DPR 改变',async()=>{
  const r=await parseSource('m.withProperty("w",m.env("stage.width"));m.withProperty("h",m.env("stage.height"));m.withProperty("nope",m.env("missing.key"));m.timing(0,120,4);m.line();');
  assert.equal(r.chart.meta.w,'1280');
  assert.equal(r.chart.meta.h,'720');
  assert.equal(r.chart.meta.nope,'');
});

test('桥接：保留 _note_create_order / __noteGlobal 等标识信息',async()=>{
  const r=await parseSource('const b=m.timing(0,120,4);const l0=m.line(),l1=m.line();m.note(l1,b,[0,0,1],[0,0,1],0,false,false);m.note(l0,b,[1,0,1],[1,0,1],0,false,false);');
  assert.equal(countNotes(r.chart),2);
  assert.equal(JSON.stringify(r.chart._note_create_order),JSON.stringify([[1,0],[0,0]]),'note 创建顺序必须是全局顺序');
  const note0=r.chart.lines[1].notes[0];
  assert.equal(note0.__line_local_idx,0);
});

test('检测：__milLooksLikeBeatmapJs 识别打包与经典形态且不误判普通 JSON',()=>{
  const looks=h.run('__milLooksLikeBeatmapJs');
  assert.equal(looks('(()=>{var n0=MilizeBeatmap,u0=n0.timing;u0(0,120);})();'),true,'解绑别名形态');
  assert.equal(looks('var L=MilizeBeatmap,ul=L.env;ul("time");'),true,'逗号别名形态');
  assert.equal(looks('!function(){"use strict";MilizeBeatmap.withProperty("a",1)}();'),true,'全局直调形态');
  assert.equal(looks('import m from "beatmap-js";m.timing(0,120);'),true,'经典未打包形态');
  assert.equal(looks('{"FormatVersionCode":9,"BPMList":[]}'),false,'普通 JSON 不应被当作 JS 谱面');
  assert.equal(looks('function add(a,b){return a+b}'),false,'普通 JS 不应被当作谱面');
});

test('检测：仅 timing/line 的最小谱面仍被接受',async()=>{
  const r=await parseSource('m.timing(0,120,4);m.line();');
  assert.equal(r.chart.bpms.length,1);
  assert.equal(r.chart.lines.length,1);
});

// —— 真实谱面有界抽样 ——
function exists(p){try{fs.accessSync(p);return true}catch{return false}}
function stratified(dir,limit){
  const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js')).map(f=>({f,p:path.join(dir,f),size:fs.statSync(path.join(dir,f)).size})).sort((a,b)=>a.size-b.size);
  if(files.length<=limit)return files;
  const out=[];
  for(let i=0;i<limit;i++)out.push(files[Math.min(Math.floor((i+.5)*files.length/limit),files.length-1)]);
  return out;
}

test('真实谱面：两个失败样本与 Sky Islands 必须解析成功且字段合理',{timeout:120000},async()=>{
  let total=0;
  for(const name of ['Sprinkle_Regnaissance.js','Cloudburst_Threat - Metropolis.js','Cloudburst_Threat - Sky Islands.js']){
    const file=path.join(archive,name);
    if(!exists(file)){h.context.__skip=name;continue}
    const source=fs.readFileSync(file,'utf8');
    const {chart,report}=await parseSource(source);
    const notes=countNotes(chart);
    assert.ok(notes>0,`${name} 未解析出 note`);
    assert.ok(report.includes('Beatmap.js'),`${name} 未走沙箱桥接：${report}`);
    assert.equal(chart._note_create_order.length,notes,`${name} 创建顺序与 note 数不一致`);
    // 重新跑一遍 makeRuntime，确认标识信息可用
    h.context.chart=chart;
    const rt=h.run('makeRuntime(chart)');
    assert.equal(rt.notes.length,notes,`${name} makeRuntime note 数不一致`);
    assert.equal(rt.storyboards.length,chart.storyboardObjects.length,`${name} storyboard 数不一致`);
    total++;
  }
  if(!total)console.log('（跳过：归档目录不存在）');
});

test('真实谱面：分层抽样（有界，默认 10 个）解析成功率与数量一致',{timeout:180000},async()=>{
  if(!exists(archive)){console.log('（跳过：归档目录不存在）');return}
  const limit=Number(process.env.MILPLAY_SAMPLE||10);
  const picks=stratified(archive,limit);
  let ok=0,fail=0;const failures=[];
  for(const {f,p,size} of picks){
    const source=fs.readFileSync(p,'utf8');
    try{
      const {chart,report}=await parseSource(source);
      const notes=countNotes(chart);
      assert.ok(report.includes('Beatmap.js'),`${f} 未走沙箱桥接：${report}`);
      assert.ok(notes>0,`${f} 没有 note`);
      assert.equal(chart._note_create_order.length,notes,`${f} order 与 note 数不一致`);
      h.context.chart=chart;
      const rt=h.run('makeRuntime(chart)');
      assert.equal(rt.notes.length,notes,`${f} makeRuntime note 数不一致`);
      assert.equal(rt.storyboards.length,chart.storyboardObjects.length,`${f} storyboard 数不一致`);
      ok++;
    }catch(e){fail++;failures.push(`${f}(${size}): ${e.message}`)}
  }
  console.log(`真实谱面抽样：${ok}/${ok+fail} 成功${fail?'\n'+failures.join('\n'):''}`);
  assert.equal(fail,0,`抽样解析失败：\n${failures.join('\n')}`);
});

test('真实谱面：指定回归样本（雨ep 目录）解析正常',{timeout:120000},async()=>{
  const names=['Drizzle_泫.js','Drizzle_雫.js','Cloudburst_雲絡漫遊.js'];
  if(!exists(extraDir)){console.log('（跳过：雨ep 目录不存在）');return}
  for(const name of names){
    const file=path.join(extraDir,name);
    if(!exists(file)){console.log(`（跳过缺失：${name}）`);continue}
    const {chart}=await parseSource(fs.readFileSync(file,'utf8'));
    assert.ok(countNotes(chart)>0,`${name} 解析无 note`);
    h.context.chart=chart;
    const rt=h.run('makeRuntime(chart)');
    assert.equal(rt.notes.length,countNotes(chart),`${name} makeRuntime note 数不一致`);
  }
});

test('超时与隔离：语法错误谱面不会污染主上下文',async()=>{
  await assert.rejects(()=>parseSource('m.timing(0,120,4);m.line();throw new Error("boom");'),/boom/);
  // 主上下文仍可继续解析
  const r=await parseSource('m.timing(0,120,4);m.line();');
  assert.equal(r.chart.bpms.length,1);
});
