'use strict';
// CPU/data-structure benchmark, not browser FPS. Optional argument: baseline checkout.
const path=require('node:path'),{createHarness}=require('./harness.js');
for(const root of [process.argv[2],path.resolve(__dirname,'..')].filter(Boolean)){
  const h=createHarness(path.resolve(root));
  const result=h.run(`(()=>{
    const notes=Array.from({length:5000},(_,i)=>({startTime:i*.1,endTime:i*.1,type:0}));
    const animations=Array.from({length:4000},(_,i)=>({data:0,i1:0,key:0,fromBeat:i,toBeat:i+1,fv:i,tv:i+1}));
    const chart={bpms:[{start:0,bpm:120}],lines:[{notes}],animations,_note_create_order:notes.map((_,i)=>[0,i])};
    const start=performance.now(),rt=makeRuntime(chart),buildMs=performance.now()-start;
    let references=0;for(const layer of rt.__pluActiveBuckets||[])for(const bucket of layer.values())references+=bucket.length;
    const seekStart=performance.now();let checksum=0;for(let i=0;i<4000;i++)checksum+=rt.lineValue(0,0,(i*997)%4000);
    const seekMs=performance.now()-seekStart;
    return {buildMs,seekMs,activeBucketReferences:references,intervalTreeNodes:rt.__activeTrees?notes.length:0,checksum};
  })()`);
  console.log(root,JSON.stringify(result));
}
