(function(root){
'use strict';
const map=Object.freeze({e:1000000,p:990000,g:600000,n:300000,b:150000,m:0});
function create(noteAmount){
  if(!Number.isSafeInteger(noteAmount)||noteAmount<0)throw new RangeError('Invalid chart judgement count');
  const bMax=Math.min(192,Math.max((noteAmount*12/50)|0,1));
  return {noteAmount,len:0,acc:0,combo:0,maxCombo:0,allEP:true,cur:bMax,bMax,
    gCap:Math.min(128,Math.max((noteAmount*8/50)|0,1)),
    nCap:Math.min(96,Math.max((noteAmount*6/50)|0,1)),
    bCap:Math.min(64,Math.max((noteAmount*5/50)|0,1)),
    mCap:Math.min(64,Math.max((noteAmount*4/50)|0,1)),
    finCombo:0,procCombo:0,prevLoss:0,counts:{e:0,p:0,g:0,n:0,b:0,m:0}};
}
function extend(st,judge){
  if(!Object.hasOwn(map,judge))throw new RangeError('Invalid judgement');
  if(st.len>=st.noteAmount)throw new RangeError('Judgements exceed chart total');
  const bMax=st.bMax,n=++st.len;
  st.counts[judge]++;st.acc+=map[judge];
  if(judge==='e'||judge==='p'){
    st.combo++;st.cur=Math.min(st.cur+(judge==='e'?2:1),bMax);
  }else{
    st.allEP=false;
    st.combo=judge==='g'||judge==='n'?st.combo+1:0;
    st.cur=Math.min(st.cur,st[judge+'Cap']);
  }
  st.maxCombo=Math.max(st.maxCombo,st.combo);
  st.finCombo+=st.cur;
  st.procCombo+=st.cur;
  // app.js calculateScoreDetailed: N stays the full chart size at every step.
  if(judge!=='e'&&(st.noteAmount-n)*2<bMax-st.cur){
    const tillFull=Math.ceil((bMax-st.cur)/2);
    st.procCombo+=st.prevLoss;
    st.prevLoss=(2*(bMax-st.cur)-2*(st.noteAmount+1-n+tillFull))*(n+tillFull-st.noteAmount)/2;
    st.procCombo-=st.prevLoss;
    if(st.procCombo<0)st.procCombo=0;
  }
  return st;
}
function process(st){
  const N=st.noteAmount,n=st.len;if(!N||!n)return 0;
  return Math.floor(st.acc/N*(0.4+0.6*(st.procCombo/(n*st.bMax))))+
    Math.floor(5000*st.maxCombo/N)+Math.floor(st.allEP?5000*n/N:0);
}
function finalCombo(st){
  // score_search_engine.c calc_final_from_totals: raw sum plus tail correction.
  return st.cur<st.bMax?Math.max(st.finCombo+(1-(st.bMax-st.cur-1)**2)/4,0):st.finCombo;
}
function final(st){
  const N=st.noteAmount;if(!N||!st.len)return 0;
  return Math.floor(st.acc/N*(0.4+0.6*(finalCombo(st)/(N*st.bMax))))+
    Math.floor(5000*st.maxCombo/N)+(st.allEP?5000:0);
}
function snapshot(st,complete=st.len===st.noteAmount){
  const totalComboScore=finalCombo(st);
  return {noteAmount:st.noteAmount,judged:st.len,complete,maxCombo:st.maxCombo,
    counts:{...st.counts},totalAccScore:st.acc,totalComboScore,
    comboMult:st.noteAmount?totalComboScore/(st.noteAmount*st.bMax):0,
    bMax:st.bMax,currentCombo:st.combo,currentComboScore:st.cur,
    processScore:process(st),finalScore:final(st),accuracy:st.len?st.acc/(st.len*1000000):0};
}
function calculate(input,total=null,complete=null){
  const seq=Array.isArray(input)?input.join('').toLowerCase():String(input||'').toLowerCase();
  const st=create(total==null?seq.length:total);
  for(let i=0;i<Math.min(seq.length,st.noteAmount);i++)extend(st,seq[i]);
  return snapshot(st,complete==null?st.len===st.noteAmount:!!complete);
}
// Append-only source between resets. Restart/seek replaces the source; shortening
// also invalidates it. Idle HUD reads neither copy nor scan the judged prefix.
function cursor(){
  let st=null,source=null,auto=false;
  return function(seq,total,judged=seq.length,autoplay=false){
    const limit=Math.max(0,Math.min(total,judged));
    if(!st||source!==seq||auto!==autoplay||st.noteAmount!==total||st.len>limit){
      st=create(total);source=seq;auto=autoplay;
    }
    while(st.len<limit)extend(st,autoplay?'e':seq[st.len]);
    return st;
  };
}
function label(st,autoplay=false){
  if(autoplay)return 'AUTOPLAY';
  if(st.counts.b||st.counts.m)return 'COMBO';
  return st.allEP?'ALL PERFECT':'FULL COMBO';
}
const api=Object.freeze({create,extend,process,final,snapshot,calculate,cursor,label,map});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.MilScore=api;
})(globalThis);
