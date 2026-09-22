
'use strict';
/* BUILTIN_SOURCES -> js/builtin-sources.js */
const MIL_WIDTH=1920, MIL_HEIGHT=1080, SPEED_UNIT=120, FLOW_SPEED=1.66, NOTE_SIZE=.0223, NOTE_SCALE=335/185, HOLD_DISAPPEAR_TIME=.20, NOTE_DISAPPEAR_TIME=.16;
const LINE_W=8, LINE_HEAD_SIZE=96, LINE_HEAD_CONNECT_POINT=334, HOLD_CUT_PADDING=668, MIN_HOLD_BODY_PX=2, HOLD_VISIBLE_AREA_MULT=4, LOOKAHEAD=10, LOOKBACK=1;
// 画质预算集中于此：游玩 DPR 不超过设备值且最高为 2，主画布约 4.15MP；编辑保留原性能档位。
// tint 仅按目标栅格取样；单个复用缓冲最多 4MiB RGBA，并限制极长边。
const RENDER_QUALITY=Object.freeze({maxDpr:2,maxStagePixels:1920*1080*2,lowMemoryDpr:1,lowMemoryStagePixels:960*540,mobileEditDpr:1.25,heavyMobileEditDpr:1,heavyDesktopEditDpr:1.5,maxTintPixels:1024*1024,maxTintSide:4096,lowMemoryTintPixels:512*512,lowMemoryTintSide:2048});
const POS_X=0,POS_Y=1,TRANSPARENCY=2,SIZE=3,ROTATION=4,FLOW=5,REL_X=6,REL_Y=7,LINE_BODY_ALPHA=8,LINE_HEAD_ALPHA=9,SB_WIDTH=10,SB_HEIGHT=11,SPEED=12,WHOLE_ALPHA=13,SB_LB_X=14,SB_LB_Y=15,SB_RB_X=16,SB_RB_Y=17,SB_LT_X=18,SB_LT_Y=19,SB_RT_X=20,SB_RT_Y=21,COLOR=22,VISIBLE_AREA=23;
const BEARER_LINE=0,BEARER_NOTE=1,BEARER_SB=2, NOTE_HIT=0, NOTE_DRAG=1, NOTE_FRACTURE=2;
const LINE_DEFAULTS={0:0,1:-350,2:1,3:1,4:90,5:9,6:0,7:0,8:1,9:1,12:1,13:1,22:0xffffffff,23:Math.hypot(1920,1080)*1.5};
const NOTE_DEFAULTS={0:0,1:0,2:1,3:1,4:0,5:1,6:0,7:0,12:0,22:0xffffffff};
const SB_DEFAULTS={0:0,1:0,2:1,3:1,4:0,6:0,7:0,10:1,11:1,14:-.5,15:-.5,16:.5,17:-.5,18:-.5,19:.5,20:.5,21:.5,22:0xffffffff};
const VIS_KEYS=new Set([TRANSPARENCY,LINE_BODY_ALPHA,LINE_HEAD_ALPHA,WHOLE_ALPHA]); const SB_DISTORT_KEYS=new Set([SB_LB_X,SB_LB_Y,SB_RB_X,SB_RB_Y,SB_LT_X,SB_LT_Y,SB_RT_X,SB_RT_Y]); const BACKGROUND_DIM_ALPHA=155/255; const RENDER_LAYER_ORDER='illustration -> storyboard layer 0 -> black mask -> storyboard layer 1 -> line -> hold -> tap -> drag/fracture -> storyboard layer 2 -> combo -> distorted storyboard';
const DB='milthm-hand-editor-full-render-v2', STORE='store', SAVE_KEY='last-edit';
const els={playModeTab:id('playModeTab'),editModeTab:id('editModeTab'),modeBadge:id('modeBadge'),playModeBar:id('playModeBar'),lowMemoryToggle:id('lowMemoryToggle'),showHandsLabel:id('showHandsLabel'),showHandsToggle:id('showHandsToggle'),fileInput:id('fileInput'),dropZone:id('dropZone'),status:id('status'),restoreBar:id('restoreBar'),restoreYes:id('restoreYes'),restoreNo:id('restoreNo'),loadSavedBtn:id('loadSavedBtn'),clearSavedBtn:id('clearSavedBtn'),playerCard:id('playerCard'),songTitle:id('songTitle'),songSub:id('songSub'),statNotes:id('statNotes'),stageWrap:id('stageWrap'),stageInner:id('stageInner'),stage:id('stage'),fsPlayBtn:id('fsPlayBtn'),fsBack1Btn:id('fsBack1Btn'),fullscreenBtn:id('fullscreenBtn'),resetViewBtn:id('resetViewBtn'),playBtn:id('playBtn'),pauseEditBtn:id('pauseEditBtn'),back1Btn:id('back1Btn'),forward1Btn:id('forward1Btn'),timeSlider:id('timeSlider'),timeInput:id('timeInput'),durationLabel:id('durationLabel'),rateSelect:id('rateSelect'),rateInput:id('rateInput'),audioDelayInput:id('audioDelayInput'),audioVolumeInput:id('audioVolumeInput'),bgBrightnessInput:id('bgBrightnessInput'),mediaName:id('mediaName'),audioPlayer:id('audioPlayer'),infoTime:id('infoTime'),infoCombo:id('infoCombo'),infoRender:id('infoRender'),infoAutosave:id('infoAutosave'),};
const ctx=els.stage.getContext('2d',{alpha:false});
function __milDefaultLowMemory(){const nav=navigator||{},ua=String(nav.userAgent||'');let saved='';try{saved=localStorage.getItem('mil-low-memory')||''}catch{}if(saved==='1'||saved==='0')return saved==='1';return Number(nav.deviceMemory)<=1||(Number(nav.hardwareConcurrency)>0&&Number(nav.hardwareConcurrency)<=2)||/OS 12_[0-9_]+.*like Mac OS X/i.test(ua)}
const state={appMode:'play',lowMemory:__milDefaultLowMemory(),showHandTextures:false,editRate:1,editAudioDelay:.11,chart:null,runtime:null,fileName:'chart.json',currentTime:0,duration:0,rate:1,playing:false,lastTick:performance.now(),viewScale:1,panX:0,panY:0,visibleHit:[],inspectHit:[],showHidden:false,hiddenObjects:new Set(),pointerMap:new Map(),pinch:null,saveTimer:0,images:{},imagesReady:false,parseReport:'',hover:null,backgroundImage:null,bgUrl:'',bgName:'',bgBrightness:.6,mediaUrl:'',mediaName:'',audioDelay:.11,audioVolume:1,mediaReady:false,mediaSyncing:false,};

const CHART_RE=/\.(json|js|txt)$/i;
const JSONL_RE=/\.jsonl$/i;
const MILCHT_RE=/\.milcht$/i;
const IMG_RE=/\.(png|jpg|jpeg|avif|webp)$/i;
const MEDIA_RE=/\.(ogg|opus|mp3|wav|flac|m4a|aac|mp4|webm|mov)$/i;
function pickAsset(files,re){return (files||[]).find(f=>f&&f.name&&re.test(f.name))||null}
function mimeForName(name){
  const n=String(name||'').toLowerCase();
  if(/\.jsonl$/.test(n))return 'application/x-ndjson;charset=utf-8';
  if(/\.json$/.test(n))return 'application/json;charset=utf-8';
  if(/\.(txt|js)$/.test(n))return 'text/plain;charset=utf-8';
  if(/\.png$/.test(n))return 'image/png';
  if(/\.(jpg|jpeg)$/.test(n))return 'image/jpeg';
  if(/\.avif$/.test(n))return 'image/avif';
  if(/\.webp$/.test(n))return 'image/webp';
  if(/\.ogg$/.test(n))return 'audio/ogg';
  if(/\.opus$/.test(n))return 'audio/opus';
  if(/\.mp3$/.test(n))return 'audio/mpeg';
  if(/\.wav$/.test(n))return 'audio/wav';
  if(/\.flac$/.test(n))return 'audio/flac';
  if(/\.m4a$/.test(n))return 'audio/mp4';
  if(/\.aac$/.test(n))return 'audio/aac';
  if(/\.mp4$/.test(n))return 'video/mp4';
  if(/\.webm$/.test(n))return 'video/webm';
  if(/\.mov$/.test(n))return 'video/quicktime';
  if(/\.zip$/.test(n))return 'application/zip';
  if(/\.7z$/.test(n))return 'application/x-7z-compressed';
  if(/\.milcht$/.test(n))return 'application/octet-stream';
  return 'application/octet-stream';
}

function id(x){return document.getElementById(x)} function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))} function fmt(v){return (Number.isFinite(v)?v:0).toFixed(3)} function safeName(s){return String(s||'chart').replace(/[\\/:*?"<>|]+/g,'_').slice(0,120)} function deepClone(o){return JSON.parse(JSON.stringify(o))} function setStatus(m,t=''){if(!els.status)return;els.status.className='status'+(t?' '+t:'');els.status.textContent=m}
function toNum(v,def=0){if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v==='boolean')return v?1:0;if(typeof v==='string'){const n=Number(v.trim());if(Number.isFinite(n))return n;const e=evalExpr(v);if(Number.isFinite(e))return e}return def} function int(v,d=0){const n=toNum(v,d);return Number.isFinite(n)?Math.trunc(n):d}
function rgbaFromUint(x){let u=(Math.trunc(Number(x)||0)>>>0);return [(u>>>24)&255,(u>>>16)&255,(u>>>8)&255,u&255]} function cssRgba(c,a=1){return `rgba(${c[0]},${c[1]},${c[2]},${clamp((c[3]/255)*a,0,1)})`}
function beatArrayToFloat(v){if(Array.isArray(v)&&v.length>=3){const a=toNum(v[0],0),b=toNum(v[1],0),c=toNum(v[2],1)||1;return a+b/c}return toNum(v,0)} function isBeatArray(v){return Array.isArray(v)&&v.length>=3&&v.slice(0,3).every(x=>Number.isFinite(toNum(x,NaN)))}
function detectNoteMode(chart){for(const line of chart.lines||[])for(const n of line.notes||[])if(isBeatArray(n.startTime??n.time))return 'beat';for(const b of chart.bpms||[])if(b.start!=null)return 'seconds';return 'seconds'} function detectAnimMode(chart){const vals=[];(chart.animations||[]).slice(0,512).forEach(a=>vals.push(a.fromBeat??a.startTime));for(const line of chart.lines||[])for(const a of (line.animations||[]).slice(0,64))vals.push(a.fromBeat??a.startTime);return vals.some(isBeatArray)?'beat':'seconds'} function valueToBeat(v,timeline,mode){return isBeatArray(v)?beatArrayToFloat(v):(mode==='beat'?toNum(v,0):timeline.beatAt(toNum(v,0)))}
function easeIn(p,pw){p=clamp(p,0,1);if(pw===0)return p;if(pw===1)return 1-Math.cos(p*Math.PI/2);if(pw>=2&&pw<=5)return p**pw;if(pw===6)return p===0?0:2**(10*p-10);if(pw===7)return 1-Math.sqrt(Math.max(0,1-p*p));if(pw===8)return 2.70158*p**3-1.70158*p**2;if(pw===9){if(p===0||p===1)return p;return -(2**(10*p-10))*Math.sin((p*10-10.75)*(2*Math.PI/3))}if(pw===10){const u=1-p;let v;if(u<1/2.75)v=7.5625*u*u;else if(u<2/2.75)v=7.5625*(u-1.5/2.75)**2+.75;else if(u<2.5/2.75)v=7.5625*(u-2.25/2.75)**2+.9375;else v=7.5625*(u-2.625/2.75)**2+.984375;return 1-v}return p}
function easeOut(p,pw){p=clamp(p,0,1);if(pw===0)return p;if(pw===1)return Math.sin(p*Math.PI/2);if(pw>=2&&pw<=5)return 1-(1-p)**pw;if(pw===6)return p===1?1:1-2**(-10*p);if(pw===7)return Math.sqrt(Math.max(0,1-(p-1)**2));if(pw===8)return 1+2.70158*(p-1)**3+1.70158*(p-1)**2;if(pw===9){if(p===0||p===1)return p;return (2**(-10*p))*Math.sin((p*10-.75)*(2*Math.PI/3))+1}if(pw===10){if(p<1/2.75)return 7.5625*p*p;if(p<2/2.75)return 7.5625*(p-1.5/2.75)**2+.75;if(p<2.5/2.75)return 7.5625*(p-2.25/2.75)**2+.9375;return 7.5625*(p-2.625/2.75)**2+.984375}return p}
function easeInOut(p,pw){p=clamp(p,0,1);if(pw===0)return p;if(pw===1)return -(Math.cos(Math.PI*p)-1)/2;if(pw>=2&&pw<=5)return p<.5?(2**(pw-1))*p**pw:1-((-2*p+2)**pw)/2;if(pw===6){if(p===0||p===1)return p;return (p<.5?2**(20*p-10):2-2**(-20*p+10))/2}if(pw===7)return p<.5?(1-Math.sqrt(Math.max(0,1-(2*p)**2)))/2:(Math.sqrt(Math.max(0,1-(-2*p+2)**2))+1)/2;if(pw===8){const c2=2.5949095;return p<.5?(((2*p)**2*((c2+1)*2*p-c2))/2):((((2*p-2)**2*((c2+1)*(2*p-2)+c2))+2)/2)}if(pw===9){if(p===0||p===1)return p;return p<.5?(-(2**(20*p-10))*Math.sin((20*p-11.125)*(2*Math.PI/4.5)))/2:((2**(-20*p+10))*Math.sin((20*p-11.125)*(2*Math.PI/4.5)))/2+1}if(pw===10)return p<.5?(1-easeOut(1-2*p,10))/2:(1+easeOut(2*p-1,10))/2;return p}
function upperBound(a,x){let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(x<a[m])r=m;else l=m+1}return l}
function noteTextureKey(n){return milNoteKey(n.type,n.isAlwaysPerfect,n.isMore,n.isHold)} function milNoteKey(type,isEx,isDouble,isHold){let base;if(isHold)base='hold';else if(type===NOTE_DRAG)base='drag';else if(type===NOTE_FRACTURE)return 'fracture';else base='tap';let k=(isEx?'ex':'')+base;if(isDouble)k+='_double';return k}
function splitArgs(text){const out=[];let buf='',dep=0,q='',esc=false;for(const ch of text){if(q){buf+=ch;if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===q)q='';continue}if(ch==='"'||ch==="'"){q=ch;buf+=ch;continue}if('([{'.includes(ch)){dep++;buf+=ch;continue}if(')]}'.includes(ch)){dep=Math.max(0,dep-1);buf+=ch;continue}if(ch===','&&dep===0){out.push(buf.trim());buf='';continue}buf+=ch}if(buf.trim()||text.trim())out.push(buf.trim());return out}
function parseJsVal(raw){const s=String(raw??'').trim();if(s==='!0'||s==='true'||s==='True')return true;if(s==='!1'||s==='false'||s==='False')return false;if(s==='null'||s==='undefined')return null;if(s.length>=2&&(s[0]==='"'||s[0]==="'")&&s.at(-1)===s[0]){if(s[0]==='"'){try{return JSON.parse(s)}catch{return s.slice(1,-1)}}return s.slice(1,-1).replace(/\\'/g,"'").replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\\\/g,'\\')}const n=Number(s);if(Number.isFinite(n))return n;const e=evalExpr(s);if(Number.isFinite(e))return e;const m=s.match(/(?:line|bpm|note)(\d+)/i);return m?Number(m[1]):s}
function scanCalls(text,name){const res=[],re=name==='p'?/(?<![A-Za-z0-9_$])\.?p\s*\(/g:new RegExp('(?<![A-Za-z0-9_.$])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\(','g');let m;while((m=re.exec(text))){let i=re.lastIndex,start=i,dep=1,q='',esc=false;for(;i<text.length;i++){const ch=text[i];if(q){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===q)q='';continue}if(ch==='"'||ch==="'"){q=ch;continue}if(ch==='(')dep++;else if(ch===')'){dep--;if(dep===0){res.push(splitArgs(text.slice(start,i)).map(parseJsVal));re.lastIndex=i+1;break}}}}return res}
function rwcAlpha(v,d=1){v=Number(v);if(!Number.isFinite(v))return d;return clamp(Math.abs(v)>1?v/255:v,0,1)}
function normalizeRwc(raw){if(!raw||!Array.isArray(raw.judgeLineList))return raw;const bpm0=[...(raw.BPMList||[])].sort((a,b)=>beatArrayToFloat(a.startTime)-beatArrayToFloat(b.startTime));if(!bpm0.length)bpm0.push({bpm:120,startTime:[0,0,1]});const offset=(Number(raw.META?.offset)||0)/1000,bpms=[];let sec=offset,pb=beatArrayToFloat(bpm0[0].startTime),pBpm=Number(bpm0[0].bpm)||120;bpms.push({start:sec,bpm:pBpm,beatsPerBar:4});for(const b of bpm0.slice(1)){const nb=beatArrayToFloat(b.startTime);sec+=(nb-pb)*60/pBpm;pb=nb;pBpm=Number(b.bpm)||120;bpms.push({start:sec,bpm:pBpm,beatsPerBar:4})}const chart={meta:{...(raw.META||{}),offset,_rwc:true},bpms,lines:[],animations:[],storyboardObjects:[],_rwc:true},scale=MIL_WIDTH/200,keymap={alphaEvents:TRANSPARENCY,moveXEvents:POS_X,moveYEvents:POS_Y,rotateZEvents:ROTATION,speedEvents:SPEED,notesAlphaEvents:WHOLE_ALPHA};let gi=0;for(let li=0;li<raw.judgeLineList.length;li++){const line=raw.judgeLineList[li]||{},ol={notes:[]};chart.lines.push(ol);const layers=Array.isArray(line.eventLayers)?line.eventLayers:[{}],layer=layers[0]||{};for(const [field,key] of Object.entries(keymap))for(const eraw of (Array.isArray(layer[field])?layer[field]:[])){const e=eraw||{};let fv=e.start??0,tv=e.end??fv;if(field==='alphaEvents'||field==='notesAlphaEvents'){fv=rwcAlpha(fv);tv=rwcAlpha(tv)}else if(field==='moveXEvents'||field==='moveYEvents'){fv=(Number(fv)||0)*scale;tv=(Number(tv)||0)*scale}else if(field==='speedEvents'){fv=(Number(fv)||50)/50;tv=(Number(tv)||50)/50}const typ=String(e.type||'Linear'),custom=typ.startsWith('y=')?'rwc:'+typ.slice(2):'';chart.animations.push({fromBeat:e.startTime||[0,0,1],toBeat:e.endTime||e.startTime||[0,0,1],key,fv,tv,data:BEARER_LINE,i1:li,press:0,ease:0,valueExpression:!!custom,customEaseExpression:custom})}const lnotes=Array.isArray(line.notes)?line.notes:[];for(let ni=0;ni<lnotes.length;ni++){const n=lnotes[ni]||{},st=n.startTime||[0,0,1],en=n.endTime||st,typ=Number(n.type)===2?NOTE_DRAG:NOTE_HIT;ol.notes.push({startTime:st,endTime:en,type:typ,isFake:!!n.isFake,isAlwaysPerfect:false,__line_local_idx:ni,visibleTime:Number(n.visibleTime)||5});const cs=[[POS_X,(Number(n.positionX)||0)*scale],[TRANSPARENCY,rwcAlpha(n.alpha)],[SIZE,Number.isFinite(Number(n.size))?Number(n.size):1],[FLOW,Number.isFinite(Number(n.speed))?Number(n.speed)/10:1]];for(const [key,val] of cs)chart.animations.push({fromBeat:st,toBeat:en,key,fv:val,tv:val,data:BEARER_NOTE,i1:gi,press:0,ease:0});gi++}}return chart}
function loadImages(){const promises=[];for(const [k,src] of Object.entries(BUILTIN_SOURCES)){const img=new Image();img.decoding='async';state.images[k]=img;promises.push(new Promise(res=>{img.onload=img.onerror=res}));img.src=src}return Promise.all(promises).then(()=>{state.imagesReady=true})}
function imgFor(key){key=String(key||'').toLowerCase();const fallback={tap_double:'tap',extap_double:'extap',drag_double:'drag',exdrag_double:'fracture',hold_double:'hold',exhold_double:'exhold',fracture_double:'fracture',exdrag:'fracture',fracture:'fracture_legacy'};return state.images[key]||state.images[fallback[key]]||null}
let __stageResizeDirty=true,__stageResizeKey='';
function markStageResize(){__stageResizeDirty=true}
function resizeCanvas(){
  const rotated=!!(els.stageWrap?.classList?.contains('nativeLandscapeFallback')&&matchMedia?.('(orientation:portrait)')?.matches),
        coarse=(navigator.maxTouchPoints||0)>0||matchMedia?.('(pointer:coarse)')?.matches,
        heavy=!!state.runtime&&((state.runtime.notes?.length||0)>2500||(state.runtime.storyboards?.length||0)>100),
         cap=state.lowMemory?RENDER_QUALITY.lowMemoryDpr:(state.appMode==='play'?RENDER_QUALITY.maxDpr:(coarse?(heavy?RENDER_QUALITY.heavyMobileEditDpr:RENDER_QUALITY.mobileEditDpr):(heavy?RENDER_QUALITY.heavyDesktopEditDpr:RENDER_QUALITY.maxDpr))),
        rawDpr=Number(window.devicePixelRatio),dpr=Math.min(Number.isFinite(rawDpr)&&rawDpr>0?rawDpr:1,cap),key=`${dpr}:${rotated}`;
  if(!__stageResizeDirty&&key===__stageResizeKey&&els.stage.width>0&&els.stage.height>0)return;
  const r=els.stage.getBoundingClientRect(),cssW=Math.max(1,rotated?els.stage.clientWidth:r.width),cssH=Math.max(1,rotated?els.stage.clientHeight:r.height);
  // CSS 旋转使用变换前尺寸；面积预算只缩放一次，避免逐轴限制造成长宽比变化。
   const stagePixels=state.lowMemory?RENDER_QUALITY.lowMemoryStagePixels:RENDER_QUALITY.maxStagePixels,scale=Math.min(dpr,Math.sqrt(stagePixels/(cssW*cssH))),w=Math.max(1,Math.floor(cssW*scale)),h=Math.max(1,Math.floor(cssH*scale));
  if(els.stage.width!==w||els.stage.height!==h){els.stage.width=w;els.stage.height=h}
  __stageResizeKey=key;__stageResizeDirty=false;
}
function canvasPt(ev){const r=els.stage.getBoundingClientRect(),sx=els.stage.width/r.width,sy=els.stage.height/r.height;return{x:(ev.clientX-r.left)*sx,y:(ev.clientY-r.top)*sy}} function screenToChart(x,y){return{x:(x-state.panX)/state.viewScale,y:(y-state.panY)/state.viewScale}} function chartToScreen(x,y){return{x:state.panX+x*state.viewScale,y:state.panY+y*state.viewScale}}
function itemKey(kind,id){return String(kind)+':'+String(id)}
function isItemHidden(kind,id){return state.hiddenObjects.has(itemKey(kind,id))}
function drawHiddenHalo(x,y,r){if(!state.showHidden)return;ctx.save();ctx.setLineDash([7,5]);ctx.lineWidth=Math.max(2,r*.07);ctx.strokeStyle='rgba(255,255,255,.9)';ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.arc(x,y,Math.max(8,r),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
function screenMapHit(h){const out={...h};if('x' in out&&'y' in out){const p=chartToScreen(out.x,out.y);out.x=p.x;out.y=p.y}if('x1' in out&&'y1' in out){const a=chartToScreen(out.x1,out.y1),b=chartToScreen(out.x2,out.y2);out.x1=a.x;out.y1=a.y;out.x2=b.x;out.y2=b.y}if('r' in out)out.r*=state.viewScale;if('w' in out)out.w*=state.viewScale;if('h' in out)out.h*=state.viewScale;if('lineWidth' in out)out.lineWidth*=state.viewScale;return out}

function localToScreen(w,h,x,y){return{x:w/2+x,y:h/2-y}} function milX(x,w){return x/MIL_WIDTH*w} function milY(y,h){return y/MIL_HEIGHT*h} function rot(x,y,deg){const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return{x:x*c-y*s,y:x*s+y*c}}
function applyLineWorld(st,w,h,xw,yw){const sx=xw*(w/MIL_WIDTH)*st.scale, sy=-yw*(h/MIL_HEIGHT)*st.scale, r=rot(sx,sy,st.angle);return{x:st.center.x+r.x,y:st.center.y+r.y}} function drawRotImg(img,cx,cy,w,h,deg,alpha=1){if(!img||!img.complete||!img.naturalWidth)return;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,cy);ctx.rotate(deg*Math.PI/180);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore()}
function drawCover(img,w,h){const iw=img.naturalWidth||img.width||1,ih=img.naturalHeight||img.height||1,sc=Math.max(w/iw,h/ih),dw=iw*sc,dh=ih*sc;ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh)}
function drawOldBg(w,h){ctx.fillStyle='rgb(18,20,28)';ctx.fillRect(0,0,w,h);for(let y=0;y<h;y+=4){const a=(20+40*y/Math.max(1,h))/255;ctx.fillStyle=`rgba(30,38,55,${a})`;ctx.fillRect(0,y,w,4)}}
function drawBg(w,h){drawOldBg(w,h);const img=state.backgroundImage;if(img&&img.complete&&img.naturalWidth){drawCover(img,w,h);ctx.fillStyle=`rgba(0,0,0,${1-state.bgBrightness})`;ctx.fillRect(0,0,w,h)}}
function drawBackgroundDim(w,h){ctx.save();ctx.fillStyle=`rgba(0,0,0,${BACKGROUND_DIM_ALPHA})`;ctx.fillRect(0,0,w,h);ctx.restore()}
const storyCache=new Map();
function noteLayer(n){if(n.isHold)return 0;if(n.type===NOTE_HIT)return 1;if(n.type===NOTE_DRAG||n.type===NOTE_FRACTURE)return 2;return 1}
function drawCombo(rt,sec,w,h){const combo=rt.comboAt(sec);ctx.save();ctx.textAlign='center';ctx.textBaseline='top';ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=Math.max(2,h*.006);ctx.fillStyle='rgba(255,255,255,.94)';ctx.font=`700 ${Math.max(22,h*.035)}px ui-sans-serif,system-ui`;ctx.fillText('COMBO',w/2,h*.025);ctx.font=`800 ${Math.max(28,h*.048)}px ui-sans-serif,system-ui`;ctx.fillText(String(combo),w/2,h*.025+Math.max(24,h*.04));ctx.restore()} function drawOverlay(w,h){ctx.save();ctx.setTransform(1,0,0,1,0,0);if(!state.runtime){ctx.fillStyle='rgba(235,235,235,.9)';ctx.font=`700 ${Math.max(20,w*.03)}px ui-sans-serif,system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('上传谱面',w/2,h/2)}ctx.restore()} function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function updateUI(){const rt=state.runtime;if(!rt)return;els.playerCard?.classList.add('ready');const m=rt.meta||{},title=m.Title||m.name||state.fileName,sub=[m.Difficulty||m.difficulty_name,m.Composer||m.music_artist,m.Beatmapper].filter(Boolean).join(' / ');if(els.songTitle)els.songTitle.textContent=title;if(els.songSub)els.songSub.textContent=sub||state.fileName;state.duration=rt.duration;if(els.timeSlider)els.timeSlider.max=String(rt.duration);if(els.durationLabel)els.durationLabel.textContent='/ '+fmt(rt.duration)+'s';updateStats();updateControls();setStatus(`${state.parseReport}\n${rt.notes.length} notes · ${rt.lineCount} lines · ${rt.storyboards.length} sb · ${RENDER_LAYER_ORDER}`,'ok')}function updateStats(){if(els.statNotes)els.statNotes.textContent=(state.runtime?.notes.filter(n=>n.type!==NOTE_FRACTURE).length||0)+' notes'}
function updateControls(){const t=clamp(state.currentTime,0,state.duration||0);if(els.timeSlider)els.timeSlider.value=String(t);if(els.timeInput)els.timeInput.value=fmt(t);if(els.infoTime)els.infoTime.textContent=fmt(t);if(els.playBtn)els.playBtn.textContent=state.playing?'暂停':'▶ 播放';if(els.fsPlayBtn)els.fsPlayBtn.textContent=state.playing?'暂停':'▶';if(els.rateInput)els.rateInput.value=String(state.rate);if(els.rateSelect)els.rateSelect.value=[...els.rateSelect.options].some(o=>Number(o.value)===state.rate)?String(state.rate):'1';if(els.audioDelayInput)els.audioDelayInput.value=state.audioDelay.toFixed(3);if(els.audioVolumeInput)els.audioVolumeInput.value=String(state.audioVolume);if(els.bgBrightnessInput)els.bgBrightnessInput.value=String(state.bgBrightness);if(els.mediaName)els.mediaName.textContent=state.mediaName||'无音乐';if(els.infoCombo)els.infoCombo.textContent=state.runtime?String(state.runtime.comboAt(t)): '0'}
function seek(t){state.currentTime=clamp(Number(t)||0,0,state.duration||0);syncMediaToChart(true);updateControls();scheduleSave();render()}function setRate(v){state.rate=clamp(Number(v)||1,.05,8);if(state.appMode==='edit')state.editRate=state.rate;if(els.audioPlayer)els.audioPlayer.playbackRate=state.rate;updateControls();scheduleSave()}function setPlaying(v){state.playing=!!v&&!!state.runtime;state.lastTick=performance.now();if(state.playing){syncMediaToChart(true);if(state.mediaUrl&&state.mediaReady&&els.audioPlayer){els.audioPlayer.play().catch(()=>{state.playing=false;updateControls();setStatus('浏览器阻止了自动播放，请再点一次播放。','warn')})}}else{els.audioPlayer?.pause()}updateControls()}function resetView(){state.viewScale=1;state.panX=0;state.panY=0;render()}
function chartToMediaTime(chartTime){
  const t=Number(chartTime)||0;
  return Math.max(0,t+Number(state.audioDelay||0));
}
function mediaToChartTime(mediaTime){
  const t=(Number(mediaTime)||0)-Number(state.audioDelay||0);
  return clamp(t,0,state.duration||Math.max(0,t));
}
function syncMediaToChart(force=false){
  const media=els.audioPlayer;
  if(!media||!state.mediaUrl||!state.mediaReady)return;
  const target=chartToMediaTime(state.currentTime);
  if(!Number.isFinite(target))return;
  try{
    const dur=Number.isFinite(media.duration)?media.duration:Infinity;
    const clamped=clamp(target,0,Math.max(0,dur));
    const drift=Math.abs((Number(media.currentTime)||0)-clamped);
    if(force||drift>.045){state.mediaSyncing=true;media.currentTime=clamped;state.mediaSyncing=false;}
    media.playbackRate=state.rate;
    media.volume=state.audioVolume;
  }catch{state.mediaSyncing=false;}
}
function setAudioDelay(v){
  state.audioDelay=clamp(Number(v)||0,-5,5);
  if(state.appMode==='edit')state.editAudioDelay=state.audioDelay;
  syncMediaToChart(true);
  updateControls();
  scheduleSave();
}
function setAudioVolume(v){
  state.audioVolume=clamp(Number(v),0,1);
  if(!Number.isFinite(state.audioVolume))state.audioVolume=1;
  if(els.audioPlayer)els.audioPlayer.volume=state.audioVolume;
  updateControls();
  scheduleSave();
}
function setBgBrightness(v){
  state.bgBrightness=clamp(Number(v),.05,1);
  if(!Number.isFinite(state.bgBrightness))state.bgBrightness=.6;
  updateControls();
  scheduleSave();
  render();
}
async function setBackgroundFile(file){
  if(!file)return;
  if(state.bgUrl){try{URL.revokeObjectURL(state.bgUrl)}catch{}}
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.decoding='async';
  state.backgroundImage=null;
  state.bgUrl=url;
  state.bgName=file.name||'background';
  try{await new Promise((resolve,reject)=>{
    img.onload=resolve;
    img.onerror=()=>reject(new Error('背景图片读取失败：'+(file.name||'background')));
    img.src=url;
  })}catch(e){
    URL.revokeObjectURL(url);
    if(state.bgUrl===url){state.bgUrl='';state.bgName=''}
    throw e;
  }
  if(state.bgUrl!==url)return;
   state.backgroundImage=state.lowMemory&&window.__milSampleStoryboard?window.__milSampleStoryboard(img):img;
  /* Fullscreen letterbox uses the same package artwork, never a separate guessed image. */
  els.stageWrap?.style.setProperty('--mil-stage-art',`url("${url.replace(/"/g,'%22')}")`);
  updateControls();
  render();
}
async function setMediaFile(file){
  if(!file)return;
  const media=els.audioPlayer;
  if(state.mediaUrl){try{URL.revokeObjectURL(state.mediaUrl)}catch{}}
  state.mediaReady=false;
  state.mediaName=file.name||'media';
  state.mediaUrl=URL.createObjectURL(file);
  const url=state.mediaUrl;
  media.pause();
  media.removeAttribute('src');
  media.load();
  media.src=state.mediaUrl;
  media.preload='auto';
  media.volume=state.audioVolume;
  media.playbackRate=state.rate;
  await new Promise((resolve,reject)=>{
    const done=()=>{cleanup();state.mediaReady=true;syncMediaToChart(true);resolve();};
    const fail=()=>{cleanup();URL.revokeObjectURL(url);if(state.mediaUrl===url){state.mediaUrl='';state.mediaName='';state.mediaReady=false;media.removeAttribute('src');media.load()}reject(new Error('音乐/视频读取失败：'+(file.name||'media')));};
    const timer=setTimeout(fail,15000);
    const cleanup=()=>{clearTimeout(timer);media.removeEventListener('loadedmetadata',done);media.removeEventListener('canplay',done);media.removeEventListener('error',fail);};
    media.addEventListener('loadedmetadata',done,{once:true});
    media.addEventListener('canplay',done,{once:true});
    media.addEventListener('error',fail,{once:true});
    try{media.load()}catch{}
  });
  updateControls();
}

async function openDB(){return new Promise(res=>{try{if(typeof indexedDB==='undefined'||!indexedDB)return res(null);const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>res(null)}catch{return res(null)}})}async function idbGet(k){try{const db=await openDB();if(!db)return null;return new Promise(res=>{try{const tx=db.transaction(STORE,'readonly'),rq=tx.objectStore(STORE).get(k);rq.onsuccess=()=>res(rq.result||null);rq.onerror=()=>res(null)}catch{return res(null)}})}catch{return null}}async function idbSet(k,v){const db=await openDB();if(!db)throw new Error('IndexedDB 不可用');return new Promise((res,rej)=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,k);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)}catch(e){rej(e)}})}async function idbDel(k){try{const db=await openDB();if(!db)return;return new Promise(res=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(k);tx.oncomplete=res;tx.onerror=res}catch{res()}})}catch{}}async function readSaved(){const v=await idbGet(SAVE_KEY);if(v)return v;try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch{return null}}async function writeSaved(p){try{await idbSet(SAVE_KEY,p);try{localStorage.setItem(SAVE_KEY+'_flag','1')}catch{}}catch{try{localStorage.setItem(SAVE_KEY,JSON.stringify(p))}catch{throw new Error('本地保存不可用')}}}async function clearSaved(){await idbDel(SAVE_KEY);try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(SAVE_KEY+'_flag')}catch{}}
function scheduleSave(){if(!state.chart)return;clearTimeout(state.saveTimer);if(els.infoAutosave)els.infoAutosave.textContent='等待中';state.saveTimer=setTimeout(async()=>{try{await writeSaved({fileName:state.fileName,chart:state.chart,currentTime:state.currentTime,rate:state.rate,savedAt:Date.now()});if(els.infoAutosave)els.infoAutosave.textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch(e){if(els.infoAutosave)els.infoAutosave.textContent='失败';setStatus('自动保存失败：'+(e.message||e),'err')}},250)}


function updateModeUI(){
  const play=state.appMode==='play';document.body.dataset.mode=play?'play':'edit';
  els.playModeTab?.classList.toggle('active',play);els.editModeTab?.classList.toggle('active',!play);
  els.playModeTab?.setAttribute('aria-selected',play?'true':'false');els.editModeTab?.setAttribute('aria-selected',play?'false':'true');
  if(els.modeBadge)els.modeBadge.textContent=play?'游玩模式':'编辑模式';
  if(play){state.showHidden=false;state.referenceMode=true;state.hitEffects=true;}
}
function setAppMode(mode){state.appMode=mode==='play'?'play':'edit';updateModeUI();updateControls();render()}
function prepare(chart,name,report=''){
  const runtime=makeRuntime(chart,name||'chart.json');
  state.chart=chart;state.fileName=name||'chart.json';state.runtime=runtime;state.duration=runtime.duration;
  state.currentTime=clamp(state.currentTime||0,0,state.duration);state.playing=false;els.audioPlayer?.pause();syncMediaToChart(true);
  state.viewScale=1;state.panX=0;state.panY=0;state.hiddenObjects.clear();state.showHidden=false;
  state.parseReport=report||'';updateUI();scheduleSave();render();
  if(state.appMode==='play'&&state.mediaReady)setPlaying(true);
}
var loadFiles;async function loadFile(file){return loadFiles(file?[file]:[])}var restoreSaved;
function u8FromArrayBuffer(buf){return new Uint8Array(buf)}
function bytesStartsWith(u8,arr){if(!u8||u8.length<arr.length)return false;for(let i=0;i<arr.length;i++)if(u8[i]!==arr[i])return false;return true}
function isZstdBytes(u8){return bytesStartsWith(u8,[0x28,0xb5,0x2f,0xfd])}
function decodeUtf8Bytes(u8){return new TextDecoder('utf-8',{fatal:false}).decode(u8)}
function findJsonObjectEndBytes(u8,start){let depth=0,inString=false,escape=false;for(let i=start;i<u8.length;i++){const b=u8[i];if(inString){if(escape)escape=false;else if(b===0x5c)escape=true;else if(b===0x22)inString=false;continue}if(b===0x22)inString=true;else if(b===0x7b||b===0x5b)depth++;else if(b===0x7d||b===0x5d){depth--;if(depth===0)return i+1}}throw new Error('milcht 文件表 JSON 不完整')}
function parseMilchtFileTable(buf){if(buf.byteLength<16)throw new Error('milcht 文件太小');const dv=new DataView(buf),u8=u8FromArrayBuffer(buf),jsonStart=16,header=[dv.getUint32(0,true),dv.getUint32(4,true),dv.getUint32(8,true),dv.getUint32(12,true)],seen=new Set();for(const n of [header[3],header[2],header[1],header[0]]){if(!Number.isFinite(n)||n<=0||n>u8.length-jsonStart||seen.has(n))continue;seen.add(n);try{return{table:JSON.parse(decodeUtf8Bytes(u8.slice(jsonStart,jsonStart+n))),dataStart:jsonStart+n,header}}catch{}}
const jsonEnd=findJsonObjectEndBytes(u8,jsonStart);return{table:JSON.parse(decodeUtf8Bytes(u8.slice(jsonStart,jsonEnd))),dataStart:jsonEnd,header}}
function safeMilchtEntryName(name){return String(name||'entry').replace(/\\/g,'/').split('/').filter(x=>x&&x!=='.'&&x!=='..').join('/')||'entry'}
function milchtEntryBytes(fullU8,dataStart,name,info){if(!info||typeof info!=='object')return null;const off=Number(info.offset),size=Number(info.size);if(!Number.isFinite(off)||!Number.isFinite(size)||off<0||size<0)return null;let start=dataStart+off,end=start+size;if(start<0||end>fullU8.length){start=off;end=off+size}if(start<0||end>fullU8.length||end<start)return null;return fullU8.slice(start,end)}
function guessMediaNameFromBytes(u8,base='audio-data'){if(bytesStartsWith(u8,[0x4f,0x67,0x67,0x53]))return base+'.ogg';if(bytesStartsWith(u8,[0x49,0x44,0x33])||(u8[0]===0xff&&(u8[1]&0xe0)===0xe0))return base+'.mp3';if(bytesStartsWith(u8,[0x52,0x49,0x46,0x46])&&decodeUtf8Bytes(u8.slice(8,12))==='WAVE')return base+'.wav';if(bytesStartsWith(u8,[0x66,0x4c,0x61,0x43]))return base+'.flac';if(decodeUtf8Bytes(u8.slice(4,8))==='ftyp')return base+'.m4a';return base+'.bin'}
function guessTextNameFromBytes(u8,base='chart-data'){const head=decodeUtf8Bytes(u8.slice(0,2048)).trimStart();if(head.startsWith('{')||head.startsWith('['))return base+'.json';if(/^(var|let|const|function)\s/.test(head)||head.includes('MilizeBeatmap'))return base+'.js';return base+'.txt'}
let zstdModulePromise=null;
async function decompressZstdBytes(u8){if(!isZstdBytes(u8))return u8;if(!zstdModulePromise){zstdModulePromise=(async()=>{const errors=[];try{const mod=await import('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/+esm');if(mod&&typeof mod.decompress==='function')return{kind:'fzstd',mod}}catch(e){errors.push(e&&e.message?e.message:String(e))}try{const mod=await import('https://cdn.jsdelivr.net/npm/zstddec@0.2.0/+esm');if(mod&&mod.ZSTDDecoder){const decoder=new mod.ZSTDDecoder();await decoder.init();return{kind:'zstddec',decoder}}}catch(e){errors.push(e&&e.message?e.message:String(e))}throw new Error('无法加载 zstd 解压库。请保持网络可访问 jsDelivr，或先用 unpack_milcht.py 解包。'+(errors.length?'\n'+errors.join('\n'):''))})()}const z=await zstdModulePromise;if(z.kind==='fzstd')return z.mod.decompress(u8);return z.decoder.decode(u8)}
async function extractMilcht(file){const buf=await file.arrayBuffer(),u8=u8FromArrayBuffer(buf),parsed=parseMilchtFileTable(buf),table=parsed.table||{},entries=table.files||{},out=[],report=[];let meta=null;if(entries.meta){const mb=milchtEntryBytes(u8,parsed.dataStart,'meta',entries.meta);if(mb&&mb.length){try{meta=JSON.parse(decodeUtf8Bytes(mb));const title=meta.IdentifierSongName||meta.Title||meta.name,composer=meta.IdentifierComposerName||meta.Composer||meta.music_artist,diff=meta.Difficulty||meta.difficulty_name,charter=meta.Charter||meta.Beatmapper;report.push('milcht 元数据：'+[title,composer,diff,charter].filter(Boolean).join(' / '))}catch{report.push('milcht 元数据：读取成功，但不是 JSON')}}}
const chartNames=['chart-data','chart','beatmap','raw-chart-data'];let chartAdded=false;for(const name of chartNames){if(!entries[name])continue;let bytes=milchtEntryBytes(u8,parsed.dataStart,name,entries[name]);if(!bytes||!bytes.length)continue;if(isZstdBytes(bytes)){setStatus('正在解压 milcht 谱面…','warn');bytes=await decompressZstdBytes(bytes)}const decodedHead=decodeUtf8Bytes(bytes.slice(0,4096));if(decodedHead.trimStart().startsWith('{')||decodedHead.includes('MilizeBeatmap')||/\b(var|let|const)\s+/.test(decodedHead)){const outName=guessTextNameFromBytes(bytes,name);out.push(new File([bytes],outName,{type:mimeForName(outName)}));report.push('milcht 谱面：'+safeMilchtEntryName(name)+(isZstdBytes(milchtEntryBytes(u8,parsed.dataStart,name,entries[name]))?'（zstd 已解压）':''));chartAdded=true;break}}
if(entries['audio-data']){const ab=milchtEntryBytes(u8,parsed.dataStart,'audio-data',entries['audio-data']);if(ab&&ab.length){const audioName=guessMediaNameFromBytes(ab,'audio-data');out.push(new File([ab],audioName,{type:mimeForName(audioName)}));report.push('milcht 音频：'+audioName)}}
if(!chartAdded)throw new Error('milcht 内没有可解析的 chart-data；raw-chart-data 可能是游戏内部二进制缓存，当前播放器需要 chart-data/Milize JS。');return{files:out,report}}
function decodeZipName(bytes,utf8=true){try{return new TextDecoder(utf8?'utf-8':'gbk').decode(bytes)}catch{return new TextDecoder().decode(bytes)}}
async function inflateRaw(data){if(!('DecompressionStream' in window))throw new Error('当前浏览器不支持 zip deflate 解压');for(const fmt of ['deflate-raw','deflate']){try{return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream(fmt))).arrayBuffer()}catch{}}throw new Error('zip deflate 解压失败')}
async function extractZip(file){const buf=await file.arrayBuffer(),dv=new DataView(buf),u8=new Uint8Array(buf);let eocd=-1;for(let i=u8.length-22;i>=0&&i>u8.length-66000;i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}if(eocd<0)throw new Error('zip 结构无效：'+file.name);const entries=dv.getUint16(eocd+10,true),cdOff=dv.getUint32(eocd+16,true),out=[];let p=cdOff;for(let ei=0;ei<entries;ei++){if(dv.getUint32(p,true)!==0x02014b50)break;const flag=dv.getUint16(p+8,true),method=dv.getUint16(p+10,true),compSize=dv.getUint32(p+20,true),nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true),lhOff=dv.getUint32(p+42,true);const name=decodeZipName(u8.slice(p+46,p+46+nameLen),(flag&0x800)!==0);p+=46+nameLen+extraLen+commentLen;if(!name||name.endsWith('/'))continue;if(dv.getUint32(lhOff,true)!==0x04034b50)continue;const ln=dv.getUint16(lhOff+26,true),le=dv.getUint16(lhOff+28,true),dataStart=lhOff+30+ln+le,comp=u8.slice(dataStart,dataStart+compSize);let data;if(method===0)data=comp.buffer.slice(comp.byteOffset,comp.byteOffset+comp.byteLength);else if(method===8)data=await inflateRaw(comp);else continue;out.push(new File([data],name,{type:mimeForName(name)}))}if(!out.length)throw new Error('zip 内没有可读取文件：'+file.name);return out}
function loadExternalScript(src){return new Promise((resolve,reject)=>{if([...document.scripts].some(s=>s.src===src))return resolve();const el=document.createElement('script');el.src=src;el.async=true;el.onload=resolve;el.onerror=()=>reject(new Error('无法加载外部解压库'));document.head.appendChild(el)})}
function flattenArchiveTree(x,out,path=''){if(!x)return;if(x instanceof File){out.push(new File([x],path||x.name,{type:x.type||mimeForName(path||x.name)}));return}if(x.file instanceof File){out.push(new File([x.file],path||x.file.name,{type:x.file.type||mimeForName(path||x.file.name)}));return}if(typeof x==='object'){for(const [k,v] of Object.entries(x))flattenArchiveTree(v,out,path?path+'/'+k:k)}}
async function extract7z(file){try{if(!window.Archive){await loadExternalScript('https://cdn.jsdelivr.net/npm/libarchive.js@2.1.0/dist/libarchive.js')}if(window.Archive?.init)window.Archive.init({workerUrl:'https://cdn.jsdelivr.net/npm/libarchive.js@2.1.0/dist/worker-bundle.js'});const archive=await window.Archive.open(file),out=[];if(archive.extractFiles.length){await archive.extractFiles(entry=>{if(entry&&entry.file)out.push(new File([entry.file],entry.pathname||entry.path||entry.file.name,{type:entry.file.type||mimeForName(entry.pathname||entry.path||entry.file.name)}))})}if(!out.length){const tree=await archive.extractFiles();flattenArchiveTree(tree,out)}if(!out.length)throw new Error('7z 内没有可读取文件');return out}catch(e){throw new Error('7z 解压失败：需要浏览器能访问 libarchive.js；'+(e.message||e))}}
async function requestLandscapeFullscreen(){const el=els.stageWrap;if(!el)return;if(!document.fullscreenElement){await (el.requestFullscreen?.()||el.webkitRequestFullscreen?.());try{await screen.orientation?.lock?.('landscape')}catch{}el.classList.add('landscapeFallback')}else{try{await screen.orientation?.unlock?.()}catch{}await (document.exitFullscreen?.()||document.webkitExitFullscreen?.());el.classList.remove('landscapeFallback')}}
let __playLastRender=0,__playLastUI=0;
function tick(now){
  const dt=Math.min(.12,(now-state.lastTick)/1000);state.lastTick=now;
  if(state.playing&&state.runtime){
    if(state.mediaUrl&&state.mediaReady&&els.audioPlayer&&!els.audioPlayer.paused)state.currentTime=mediaToChartTime(els.audioPlayer.currentTime);
    else state.currentTime+=dt*state.rate;
    if(state.currentTime>=state.duration){state.currentTime=state.duration;state.playing=false;els.audioPlayer?.pause();updateControls();__playLastUI=now;render();__playLastRender=now}
    else{
      if(state.mediaUrl&&state.mediaReady)syncMediaToChart(false);
      /* DOM range/input/text writes are surprisingly expensive on mobile.  The Unity
         reference never rewrites browser controls every render frame, so keep these
         at 15 Hz while gameplay time continues to use the audio clock. */
      if(now-__playLastUI>=66){updateControls();__playLastUI=now}
    }
  }
  /* Canvas2D on 90/120/144 Hz phones can consume the entire main thread and delay
     PointerEvents.  Keep play rendering at <=60 Hz; touch/judgement is independent
     and still advances on input plus the 120 Hz fixed judge loop. */
  const play=state.appMode==='play'&&!!state.runtime;
  /* Play mode only needs a canvas repaint while time advances or input changes; all
     seek/mode/resize interactions call render() directly. Skipping paused frames keeps a
     phone's main thread (and battery) free while the scene is static. */
  if(!play){render();__playLastRender=now}else if(state.playing&&now-__playLastRender>=15.5){render();__playLastRender=now}
  requestAnimationFrame(tick)
}
els.fileInput?.addEventListener('change',e=>loadFiles(e.target.files).catch(err=>setStatus(err.message||String(err),'err')));['dragenter','dragover'].forEach(ev=>els.dropZone?.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.add('drag')}));['dragleave','drop'].forEach(ev=>els.dropZone?.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.remove('drag')}));els.dropZone?.addEventListener('drop',e=>{loadFiles(e.dataTransfer.files).catch(err=>setStatus(err.message||String(err),'err'))});els.playModeTab?.addEventListener('click',()=>setAppMode('play'));els.editModeTab?.addEventListener('click',()=>setAppMode('edit'));els.showHandsToggle?.addEventListener('change',e=>{state.showHandTextures=!!e.target.checked;render()});els.playBtn?.addEventListener('click',()=>setPlaying(!state.playing));els.fsPlayBtn?.addEventListener('click',()=>setPlaying(!state.playing));els.fsBack1Btn?.addEventListener('click',()=>seek(state.currentTime-1));els.pauseEditBtn?.addEventListener('click',()=>setPlaying(false));els.back1Btn?.addEventListener('click',()=>seek(state.currentTime-1));els.forward1Btn?.addEventListener('click',()=>seek(state.currentTime+1));els.timeSlider?.addEventListener('input',e=>seek(e.target.value));els.timeInput?.addEventListener('change',e=>seek(e.target.value));els.rateSelect?.addEventListener('change',e=>setRate(e.target.value));els.rateInput?.addEventListener('change',e=>setRate(e.target.value));els.audioDelayInput?.addEventListener('change',e=>setAudioDelay(e.target.value));els.audioVolumeInput?.addEventListener('input',e=>setAudioVolume(e.target.value));els.bgBrightnessInput?.addEventListener('input',e=>setBgBrightness(e.target.value));els.audioPlayer?.addEventListener('ended',()=>{state.playing=false;updateControls()});els.resetViewBtn?.addEventListener('click',resetView);els.fullscreenBtn?.addEventListener('click',()=>requestLandscapeFullscreen().catch(()=>{}));els.loadSavedBtn?.addEventListener('click',()=>restoreSaved().catch(e=>setStatus(e.message||String(e),'err')));els.restoreYes?.addEventListener('click',()=>restoreSaved().catch(e=>setStatus(e.message||String(e),'err')));els.restoreNo?.addEventListener('click',()=>els.restoreBar?.classList.remove('show'));els.clearSavedBtn?.addEventListener('click',async()=>{await clearSaved();els.restoreBar?.classList.remove('show');setStatus('已清除本地保存。','ok');if(els.infoAutosave)els.infoAutosave.textContent='已清除'});
els.stage.addEventListener('wheel',e=>{if(state.appMode==='play'||!state.runtime||state.playing)return;e.preventDefault();const p=canvasPt(e),before=screenToChart(p.x,p.y),factor=Math.exp(-e.deltaY*.001);state.viewScale=clamp(state.viewScale*factor,.7,5);state.panX=p.x-before.x*state.viewScale;state.panY=p.y-before.y*state.viewScale},{passive:false});
function handleStagePointerDown(e){if(state.appMode==='play'||!state.runtime||state.playing)return;els.stage.setPointerCapture(e.pointerId);const p=canvasPt(e);state.pointerMap.set(e.pointerId,{x:p.x,y:p.y});if(state.pointerMap.size===2){const pts=[...state.pointerMap.values()],cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;state.pinch={dist:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),scale:state.viewScale,world:screenToChart(cx,cy)};return}}
function handleStagePointerMove(e){if(state.appMode==='play'||!state.runtime)return;const p=canvasPt(e);if(state.pointerMap.has(e.pointerId))state.pointerMap.set(e.pointerId,{x:p.x,y:p.y});if(state.playing)return;if(state.pointerMap.size===2&&state.pinch){e.preventDefault();const pts=[...state.pointerMap.values()],dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;state.viewScale=clamp(state.pinch.scale*dist/Math.max(1,state.pinch.dist),.7,5);state.panX=cx-state.pinch.world.x*state.viewScale;state.panY=cy-state.pinch.world.y*state.viewScale;render();return}}
function endPointer(e){state.pointerMap.delete(e.pointerId);if(state.pointerMap.size<2)state.pinch=null;}
els.stage.addEventListener('pointerdown',handleStagePointerDown);els.stage.addEventListener('pointermove',handleStagePointerMove);els.stage.addEventListener('pointerup',endPointer);els.stage.addEventListener('pointercancel',endPointer);window.addEventListener('resize',()=>{markStageResize();resizeCanvas();render()});document.addEventListener('fullscreenchange',()=>{markStageResize();resizeCanvas();render();if(!document.fullscreenElement)els.stageWrap.classList.remove('landscapeFallback')});document.addEventListener('webkitfullscreenchange',()=>{markStageResize();resizeCanvas();render();if(!document.webkitFullscreenElement)els.stageWrap.classList.remove('landscapeFallback')});window.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName||'';if(state.appMode==='edit'&&e.code==='Space'&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();setPlaying(!state.playing)}});window.addEventListener('beforeunload',()=>{if(state.chart)scheduleSave()});
try{new ResizeObserver(()=>{markStageResize();resizeCanvas();render()}).observe(els.stage)}catch{}
(async()=>{await loadImages();if(els.infoRender)els.infoRender.textContent='资源已载入';const saved=await readSaved();if(saved&&saved.chart)els.restoreBar?.classList.add('show');resizeCanvas();requestAnimationFrame(tick)})();









/* Milthm semantic review patch — 2026-08-06
 * This block intentionally overrides the earlier compatibility implementation.
 * It keeps the UI/editor code intact while making time, animation and note rendering
 * follow the supplied Milthm v9/Beatmap.js semantics more closely.
 */
const __MIL_NOTE_EQUAL_EPS = 0.001;
const __MIL_VALID_ANIMATION_KEYS = new Map([
  [BEARER_LINE, new Set([POS_X,POS_Y,TRANSPARENCY,SIZE,ROTATION,FLOW,REL_X,REL_Y,LINE_BODY_ALPHA,LINE_HEAD_ALPHA,SPEED,WHOLE_ALPHA,COLOR,VISIBLE_AREA])],
  [BEARER_NOTE, new Set([POS_X,POS_Y,TRANSPARENCY,SIZE,ROTATION,FLOW,REL_X,REL_Y,COLOR])],
  [BEARER_SB, new Set([POS_X,POS_Y,TRANSPARENCY,SIZE,ROTATION,REL_X,REL_Y,SB_WIDTH,SB_HEIGHT,SB_LB_X,SB_LB_Y,SB_RB_X,SB_RB_Y,SB_LT_X,SB_LT_Y,SB_RT_X,SB_RT_Y,COLOR])]
]);

/* Custom/ValueExpression compatibility.  The format documentation names t, x and PI
 * but does not prescribe a full expression grammar.  Accept arithmetic, comparisons,
 * logical operators and ternaries while rejecting assignments, member access and code
 * construction.  This is deliberately broader than the old arithmetic-only parser and
 * still deterministic inside the renderer. */
const __milExpressionFunctions=new Map();
function evalExpr(expr,vars={}){
  if(typeof expr!=='string')return NaN;
  let source=expr.trim();if(!source)return NaN;
  source=source
    .replace(/MilizeBeatmap\.env\(\s*["']stage\.width["']\s*\)|m\.env\(\s*["']stage\.width["']\s*\)/g,'1920')
    .replace(/MilizeBeatmap\.env\(\s*["']stage\.height["']\s*\)|m\.env\(\s*["']stage\.height["']\s*\)/g,'1080')
    .replace(/^\s*[A-Za-z_]\w*\s*=(?!=)/,'')
    .replace(/……/g,'**').replace(/\^/g,'**').replace(/\bMath\./g,'').replace(/\bPI\b/g,'pi');
  if(!source||/[;{}\[\]"'`\\]/.test(source)||/(?:=>|\+\+|--)/.test(source))return NaN;
  if(/(^|[^=!<>])=([^=]|$)/.test(source))return NaN;
  if(!/^[0-9A-Za-z_+\-*/%().,?::<>=!&|\s]+$/.test(source))return NaN;
  const names=source.match(/[A-Za-z_]\w*/g)||[];
  const allowed=new Set(['pi','e','t','x','y','true','false','sin','cos','tan','asin','acos','atan','atan2','sqrt','cbrt','abs','min','max','pow','floor','ceil','round','trunc','exp','log','log10','log2','sign','hypot','clamp','lerp']);
  if(names.some(name=>!allowed.has(name)))return NaN;
  const clampFn=(v,a,b)=>Math.min(Math.max(v,a),b),lerpFn=(a,b,t)=>a+(b-a)*t;
  try{
    let fn=__milExpressionFunctions.get(source);
    if(!fn){
      fn=Function('pi','e','t','x','y','sin','cos','tan','asin','acos','atan','atan2','sqrt','cbrt','abs','min','max','pow','floor','ceil','round','trunc','exp','log','log10','log2','sign','hypot','clamp','lerp','"use strict";return ('+source+')');
      if(__milExpressionFunctions.size>=512)__milExpressionFunctions.delete(__milExpressionFunctions.keys().next().value);
      __milExpressionFunctions.set(source,fn);
    }
    const out=fn(Math.PI,Math.E,vars.t??0,vars.x??0,vars.y??0,Math.sin,Math.cos,Math.tan,Math.asin,Math.acos,Math.atan,Math.atan2,Math.sqrt,Math.cbrt,Math.abs,Math.min,Math.max,Math.pow,Math.floor,Math.ceil,Math.round,Math.trunc,Math.exp,Math.log,Math.log10,Math.log2,Math.sign,Math.hypot,clampFn,lerpFn);
    return Number(out);
  }catch{return NaN}
};

function __milBeatValue(stamp){
  if(!isBeatArray(stamp))throw new Error('时间戳必须是 [beat, subTime, division] 或 [beat, subTime, division, bpmId]');
  const division=toNum(stamp[2],NaN);
  if(!Number.isFinite(division)||division<=0)throw new Error('时间戳 division 必须大于 0');
  return toNum(stamp[0],0)+toNum(stamp[1],0)/division;
}
function __milScopedTimeToSeconds(value,timeline,bpms,bpmScope,scoped){
  if(Array.isArray(value)){
    const beat=__milBeatValue(value);
    if(scoped){
      let bpmId=int(bpmScope,0);
      if(bpmId<0){
        if(value.length<4)throw new Error('BPM < 0 时，时间戳必须包含第 4 项 bpmId');
        bpmId=int(value[3],-1);
      }
      if(bpmId<0||bpmId>=bpms.length)throw new Error('时间戳引用了不存在的 BPM id: '+bpmId);
      const bpm=bpms[bpmId],rate=toNum(bpm.bpm,120);
      if(!Number.isFinite(rate)||Math.abs(rate)<1e-12)throw new Error('BPM 不能为 0');
      return toNum(bpm.start,0)+beat*60/rate;
    }
    return timeline.secAt(beat);
  }
  if(value==null||typeof value==='boolean'||(typeof value==='string'&&!value.trim()))throw new Error('Absolute time is required');
  const sec=toNum(value,NaN);
  if(!Number.isFinite(sec))throw new Error('绝对时间必须是有限秒数');
  return sec;
}

function buildTimeline(bpms){
  let items=(Array.isArray(bpms)?bpms:[]).map(b=>({
    start:toNum(b.start,0),
    bpm:toNum(b.bpm,120)||120,
    beatOffset:isBeatArray(b.time)?__milBeatValue(b.time):toNum(b.beatOffset,0),
    bpb:toNum(b.beatsPerBar,4)||4
  }));
  if(!items.length)items=[{start:0,bpm:120,beatOffset:0,bpb:4}];
  if(items.every(x=>Math.abs(x.beatOffset)<1e-12)){
    items.sort((a,b)=>a.start-b.start);
    items[0].beatOffset=0;
    for(let i=1;i<items.length;i++){
      const p=items[i-1];
      items[i].beatOffset=p.beatOffset+(items[i].start-p.start)*p.bpm/60;
    }
  }else items.sort((a,b)=>a.beatOffset-b.beatOffset||a.start-b.start);
  return{
    items,
    beatAt(sec){
      let seg=items[0];
      for(const it of items){if(it.start<=sec)seg=it;else break}
      return seg.beatOffset+(sec-seg.start)*seg.bpm/60;
    },
    secAt(beat){
      let seg=items[0];
      for(let i=1;i<items.length;i++){if(items[i].beatOffset<=beat)seg=items[i];else break}
      return seg.start+(beat-seg.beatOffset)*60/seg.bpm;
    }
  };
};

function __milApplySubtype(fn,p,subtype){
  p=clamp(p,0,1);subtype=clamp(int(subtype,0),0,2);
  if(subtype===0)return fn(p);
  if(subtype===1)return 1-fn(1-p);
  return p<.5?fn(p*2)/2:1-fn((1-p)*2)/2;
}
function __milBezierControls(expression){
  const nums=String(expression||'').match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)?.map(Number).filter(Number.isFinite)||[];
  return nums.length>=4?nums.slice(0,4):null;
}
function __milBezierY(x,controls){
  if(!controls)return x;
  const [x1,y1,x2,y2]=controls;
  const sample=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  const deriv=(t,a,b)=>3*(1-t)*(1-t)*a+6*(1-t)*t*(b-a)+3*t*t*(1-b);
  let t=clamp(x,0,1);
  for(let i=0;i<7;i++){
    const dx=sample(t,x1,x2)-x,d=deriv(t,x1,x2);
    if(Math.abs(dx)<1e-7)break;
    if(Math.abs(d)<1e-7)break;
    t=clamp(t-dx/d,0,1);
  }
  let lo=0,hi=1;
  for(let i=0;i<18;i++){
    const sx=sample(t,x1,x2);
    if(Math.abs(sx-x)<1e-7)break;
    if(sx<x)lo=t;else hi=t;
    t=(lo+hi)/2;
  }
  return sample(t,y1,y2);
}

function easeValue(type,press,p,customExpression=''){
  p=clamp(p,0,1);press=clamp(int(press,0),0,15);type=clamp(int(type,0),0,2);
  if(press===0)return p;
  if(press>=1&&press<=10)return type===0?easeIn(p,press):(type===1?easeOut(p,press):easeInOut(p,press));
  if(press===11){
    const controls=__milBezierControls(customExpression);
    return controls?__milApplySubtype(v=>__milBezierY(v,controls),p,type):p;
  }
  if(press===12){
    if(!String(customExpression||'').trim())return p;
    return __milApplySubtype(v=>{
      const out=evalExpr(String(customExpression),{t:v,x:v,y:v});
      return Number.isFinite(out)?out:v;
    },p,type);
  }
  if(press===13)return __milApplySubtype(v=>v*v*(3-2*v),p,type);
  if(press===14)return __milApplySubtype(v=>Math.sqrt(Math.max(0,v)),p,type);
  if(press===15)return __milApplySubtype(v=>Math.sqrt(Math.sqrt(Math.max(0,v))),p,type);
  return p;
};

function __milColorLerp(a,b,p){
  const ca=rgbaFromUint(a),cb=rgbaFromUint(b),c=ca.map((v,i)=>clamp(Math.round(v+(cb[i]-v)*p),0,255));
  return (((c[0]<<24)>>>0)|(c[1]<<16)|(c[2]<<8)|c[3])>>>0;
}
function eventValue(ev,def,sec){
  if(ev.fv==null&&ev.tv==null)return VIS_KEYS.has(ev.key)?0:def;
  const fv=ev.fv==null?def:ev.fv,tv=ev.tv==null?fv:ev.tv;
  const span=ev.endSec-ev.startSec;
  const rawP=Math.abs(span)<1e-12?1:clamp((sec-ev.startSec)/span,0,1);
  const customForEase=ev.valueExpression?'':ev.custom;
  const p=easeValue(ev.ease,ev.press,rawP,customForEase);
  const linearValue=fv+p*(tv-fv);
  if(ev.custom&&String(ev.custom).startsWith('rwc:')){
    const elapsed=sec-ev.startSec;
    const out=evalExpr(String(ev.custom).slice(4),{t:elapsed,x:elapsed,y:linearValue});
    if(Number.isFinite(out))return out;
  }
  if(ev.valueExpression&&ev.custom){
    const out=evalExpr(String(ev.custom),{t:p,x:linearValue,y:linearValue});
    if(Number.isFinite(out))return out;
  }
  if(ev.key===COLOR)return __milColorLerp(fv,tv,p);
  return linearValue;
};
var eventIntegral,compileEvents,evalTrack;
function makeRuntime(chart,fileName='chart.json'){
  if(!chart||!Array.isArray(chart.lines))throw new Error('不是有效谱面：缺少 lines[]');
  chart.lines.forEach(l=>{if(!Array.isArray(l.notes))l.notes=[]});
  if(!Array.isArray(chart.bpms)||!chart.bpms.length)chart.bpms=[{start:0,bpm:120,beatsPerBar:4}];
  if(!Array.isArray(chart.animations))chart.animations=[];
  const timeline=buildTimeline(chart.bpms),noteMode=detectNoteMode(chart),animMode=detectAnimMode(chart),events=compileEvents(chart,timeline);
  const tmp=[];let g=0;
  for(let li=0;li<chart.lines.length;li++){
    const line=chart.lines[li];
    for(let ni=0;ni<(line.notes||[]).length;ni++){
      const raw=line.notes[ni]||{},stRaw=raw.startTime??raw.time??0,enRaw=raw.endTime??raw.time??stRaw;
      const scoped=raw.bpm!=null||raw.bpmId!=null||raw.BPM!=null,scope=raw.bpm??raw.bpmId??raw.BPM??0;
      const startSec=__milScopedTimeToSeconds(stRaw,timeline,chart.bpms,scope,scoped&&!chart._rwc);
      let endSec=__milScopedTimeToSeconds(enRaw,timeline,chart.bpms,scope,scoped&&!chart._rwc);
      if(endSec<startSec)endSec=startSec;
      tmp.push({lineIdx:li,localIdx:ni,globalIdx:g,startBeat:timeline.beatAt(startSec),endBeat:timeline.beatAt(endSec),startSec,endSec,type:int(raw.type??raw.Type,0),isFake:!!(raw.isFake??raw.Fake),isAlwaysPerfect:!!(raw.isAlwaysPerfect??raw.AP),note:raw,key:li+':'+ni});
      g++;
    }
  }
  const order=Array.isArray(chart._note_create_order)?chart._note_create_order:[];let animGlobals=[];
  if(order.length){
    const lookup=new Map(tmp.map(it=>[it.lineIdx+':'+it.localIdx,it.globalIdx])),seen=new Set();
    for(const p of order){if(Array.isArray(p)){const got=lookup.get(int(p[0],0)+':'+int(p[1],0));if(got!=null&&!seen.has(got)){seen.add(got);animGlobals.push(got)}}}
  }
  if(animGlobals.length!==tmp.length)animGlobals=tmp.map(x=>x.globalIdx);
  const byG=new Map(animGlobals.map((id,i)=>[id,i]));
  const lineCache=[];
  const runtime={
    chart,fileName,meta:chart.meta||{},timeline,noteMode,animMode,events,lineCount:chart.lines.length,
    notes:tmp.map(it=>({...it,animIdx:byG.get(it.globalIdx)??it.globalIdx})),
    storyboards:(chart.storyboardObjects||chart.storyboards||[]).map((s,i)=>({type:int(s.type,0),data:String(s.data||''),layer:int(s.layer,1),index:i,distorted:[...SB_DISTORT_KEYS].some(k=>events.get(BEARER_SB)?.get(i)?.has(k))})),
    duration:5,comboTimes:[],
    lineValue(li,key,sec){
      let cache=lineCache[li];if(!cache)cache=lineCache[li]={times:new Float64Array(24).fill(NaN),values:new Float64Array(24)};
      if(cache.times[key]===sec)return cache.values[key];
      const tr=events.get(BEARER_LINE)?.get(li)?.get(key),value=evalTrack(tr,sec,LINE_DEFAULTS[key]??0,key);
      cache.times[key]=sec;cache.values[key]=value;return value;
    },
    noteValue(n,key,sec){
      if(!__MIL_VALID_ANIMATION_KEYS.get(BEARER_NOTE).has(key))return key===FLOW?this.lineValue(n.lineIdx,FLOW,sec):(NOTE_DEFAULTS[key]??0);
      const tr=events.get(BEARER_NOTE)?.get(n.animIdx)?.get(key),def=key===FLOW?this.lineValue(n.lineIdx,FLOW,sec):(NOTE_DEFAULTS[key]??0);
      return evalTrack(tr,sec,def,key)
    },
    sbValue(sb,key,sec){const tr=events.get(BEARER_SB)?.get(sb.index)?.get(key);return evalTrack(tr,sec,SB_DEFAULTS[key]??0,key)}
  };
  precompute(runtime);return runtime;
};

function precompute(rt){
  /* Only truly simultaneous notes receive the More/double texture.  The old 0.1 ms
   * rounding could visually merge two distinct notes.  One microsecond is enough to
   * absorb floating conversion noise without changing authored timing. */
  const simultaneous=new Map(),byTime=[...rt.notes].sort((a,b)=>a.startSec-b.startSec||a.globalIdx-b.globalIdx);
  for(let i=0;i<byTime.length;){let j=i+1;while(j<byTime.length&&Math.abs(byTime[j].startSec-byTime[i].startSec)<=1e-6)j++;const more=j-i>1;for(let k=i;k<j;k++)simultaneous.set(byTime[k].globalIdx,more);i=j}
  let dur=0;const combo=[];
  for(const n of rt.notes){
    const tracks=rt.events.get(BEARER_NOTE)?.get(n.animIdx)||new Map();
    n.isMore=simultaneous.get(n.globalIdx)===true;
    n.isHold=n.type===NOTE_HIT&&n.endSec-n.startSec>__MIL_NOTE_EQUAL_EPS;
    n.fallbackKind=n.isHold?'hold':(n.type===NOTE_DRAG?'drag':(n.type===NOTE_FRACTURE?'fracture':'tap'));
    n.hasPosX=tracks.has(POS_X);n.hasPosY=tracks.has(POS_Y);n.hasRelX=tracks.has(REL_X);n.hasRelY=tracks.has(REL_Y);
    n.hasFlow=tracks.has(FLOW);n.hasSize=tracks.has(SIZE);n.hasRot=tracks.has(ROTATION);n.hasTrans=tracks.has(TRANSPARENCY);n.hasColor=tracks.has(COLOR);n.hasSpeed=false;
    n.floorStart=rt.lineValue(n.lineIdx,SPEED,n.startSec);n.floorEnd=rt.lineValue(n.lineIdx,SPEED,n.endSec);
    if(rt.chart?._rwc)n.activeFrom=rt.timeline.secAt(n.startBeat-Math.max(0,Number(n.note.visibleTime)||5));
    else{
      /* A fixed look-ahead is not semantically safe: low Speed, large VisibleArea,
       * negative flow, or a PositionY animation can place a note on screen arbitrarily
       * early.  Let the geometry/VisibleArea checks perform the exact cull. */
      n.activeFrom=Number.NEGATIVE_INFINITY;
    }
    n.preHitVisualHold=false;
    n.activeTo=n.isHold?n.endSec+HOLD_DISAPPEAR_TIME:n.startSec+NOTE_DISAPPEAR_TIME;
    /* Fake and Lightning notes still belong to the visual timeline.  Only ordinary
     * non-fake notes contribute to the ordinary combo counter. */
    dur=Math.max(dur,n.endSec+2);
    if(!n.isFake&&n.type!==NOTE_FRACTURE){combo.push(n.startSec);if(n.isHold)combo.push(n.endSec)}
  }
  for(const byIdx of rt.events.values())for(const byKey of byIdx.values())for(const tr of byKey.values())for(const ev of tr.events)dur=Math.max(dur,ev.endSec+1);
  rt.notes.sort((a,b)=>a.startSec-b.startSec||a.endSec-b.endSec||a.lineIdx-b.lineIdx||a.animIdx-b.animIdx);
  rt.activeOrder=[...rt.notes].sort((a,b)=>a.activeFrom-b.activeFrom);
  rt.duration=Math.max(5,dur);combo.sort((a,b)=>a-b);rt.comboTimes=combo;rt.comboAt=sec=>upperBound(combo,sec);
};

noteTextureKey = function(n){
  if(n.type===NOTE_FRACTURE)return 'fracture';
  if(n.type===NOTE_DRAG)return n.isMore?'drag_double':'drag';
  const effectiveEx=n.type===NOTE_HIT&&!n.isFake&&n.isAlwaysPerfect;
  return milNoteKey(n.type,effectiveEx,n.isMore,n.isHold);
};

var transformLine,drawLineState,__milTintSlice,__milDrawRotTinted;
function drawNote(rt,n,sec,st,w,h){
  const hidden=isItemHidden('note',n.key);if(hidden&&!state.showHidden)return;
  if(!n.isHold&&sec>=n.startSec+NOTE_DISAPPEAR_TIME)return;if(n.isHold&&sec>n.endSec+HOLD_DISAPPEAR_TIME)return;
  const rawNoteScale=n.hasSize?rt.noteValue(n,SIZE,sec):NOTE_DEFAULTS[SIZE],noteScale=Math.abs(rawNoteScale),noteRot=(n.hasRot?rt.noteValue(n,ROTATION,sec):NOTE_DEFAULTS[ROTATION])+(rawNoteScale<0?180:0);
  if(!Number.isFinite(rawNoteScale)||!Number.isFinite(st.scale)||noteScale*st.scale<=1e-9)return;
  let noteAlpha=n.hasTrans?clamp(rt.noteValue(n,TRANSPARENCY,sec),0,1):NOTE_DEFAULTS[TRANSPARENCY];
  noteAlpha*=st.wholeAlpha;if(hidden)noteAlpha*=.45;
  if(n.isHold&&sec>n.endSec)noteAlpha*=Math.max(0,1-(sec-n.endSec)/HOLD_DISAPPEAR_TIME);
  if(!n.isHold&&sec>n.startSec)noteAlpha*=Math.max(0,1-(sec-n.startSec)/NOTE_DISAPPEAR_TIME);
  if(noteAlpha<=.001)return;
  const finalFlow=n.hasFlow?rt.noteValue(n,FLOW,sec):st.flow,curT=n.isHold?Math.min(sec,n.endSec):sec,curFloor=rt.lineValue(n.lineIdx,SPEED,curT);
  let floorHead=(n.floorStart-curFloor)*finalFlow*SPEED_UNIT*FLOW_SPEED,floorTail=n.isHold?(n.floorEnd-curFloor)*finalFlow*SPEED_UNIT*FLOW_SPEED:floorHead;
  if(n.isHold&&sec>=n.startSec)floorHead=0;
  const posY=n.hasPosY?rt.noteValue(n,POS_Y,sec):0;
  if(n.hasPosY){if(n.isHold)floorTail=floorTail-floorHead+posY;else floorTail=posY;floorHead=posY}
  const baseX=(n.hasPosX?rt.noteValue(n,POS_X,sec):0)+(n.hasRelX?rt.noteValue(n,REL_X,sec):0),baseY=n.hasRelY?rt.noteValue(n,REL_Y,sec):0;
  const localHeadY=baseY+floorHead,localTailY=baseY+floorTail,visible=Number(st.visible);
  if(Number.isFinite(visible)){
    if(visible<0)return;
    if(n.isHold){if(Math.max(Math.min(localHeadY,localTailY),-visible)>Math.min(Math.max(localHeadY,localTailY),visible))return}
    else if(Math.abs(localHeadY)>visible)return;
  }
  const center=applyLineWorld(st,w,h,baseX,localHeadY),tail=n.isHold?applyLineWorld(st,w,h,baseX,localTailY):center;
  const noteColor=rgbaFromUint(n.hasColor?rt.noteValue(n,COLOR,sec):NOTE_DEFAULTS[COLOR]);
  const visualW=(w+h)*NOTE_SIZE*NOTE_SCALE*st.scale*noteScale;if(!Number.isFinite(visualW)||visualW<=1e-6)return;
  const key=noteTextureKey(n),img=imgFor(key),texRot=-st.rotation-noteRot,radius=Math.max(2,visualW*.42);
  if(n.isHold){
    let dx=tail.x-center.x,dy=tail.y-center.y,geometricLen=Math.hypot(dx,dy);
    if(geometricLen<=1e-9){const probe=applyLineWorld(st,w,h,baseX,localHeadY+1);dx=probe.x-center.x;dy=probe.y-center.y;if(Math.hypot(dx,dy)<=1e-9){dx=Math.cos(texRot*Math.PI/180);dy=Math.sin(texRot*Math.PI/180)}}
    const holdAng=Math.atan2(dy,dx),capMargin=Math.max(16,visualW*2),minX=Math.min(center.x,tail.x)-capMargin,maxX=Math.max(center.x,tail.x)+capMargin,minY=Math.min(center.y,tail.y)-capMargin,maxY=Math.max(center.y,tail.y)+capMargin;
    if(__milRectOutsideView(minX,minY,maxX,maxY,w,h))return;
    const holdImg=imgFor(key)||imgFor('hold'),srcW=holdImg?.naturalWidth||4036,srcH=holdImg?.naturalHeight||1336,scale=visualW/srcH,cut=Math.max(1,Math.min(srcW/2-1,HOLD_CUT_PADDING)),capW=cut*scale,bodyW=Math.max(0,geometricLen);
    ctx.save();ctx.globalAlpha*=noteAlpha*(noteColor[3]/255);ctx.translate(center.x,center.y);ctx.rotate(holdAng);
    if(holdImg&&holdImg.naturalWidth){
      __milTintSlice(holdImg,0,0,cut,srcH,-capW,-visualW/2,capW,visualW,noteColor);
      if(bodyW>=.75)__milTintSlice(holdImg,cut,0,Math.max(1,srcW-2*cut),srcH,0,-visualW/2,bodyW,visualW,noteColor);
      __milTintSlice(holdImg,srcW-cut,0,cut,srcH,bodyW,-visualW/2,capW,visualW,noteColor);
    }else{ctx.fillStyle=`rgba(${noteColor[0]},${noteColor[1]},${noteColor[2]},.78)`;ctx.beginPath();ctx.roundRect(0,-visualW*.25,Math.max(1,bodyW),visualW*.5,visualW*.18);ctx.fill();ctx.beginPath();ctx.arc(0,0,visualW*.45,0,Math.PI*2);ctx.fill()}
    ctx.restore();
    const rr=Math.max(2,visualW*.45);if(state.appMode!=='play'){state.visibleHit.push({n,x:center.x,y:center.y,r:rr,key:n.key,type:n.type});state.inspectHit.push({kind:'note',label:'Note',id:n.key,hiddenKey:itemKey('note',n.key),n,x:center.x,y:center.y,r:rr})};if(hidden)drawHiddenHalo(center.x,center.y,rr);return;
  }
  if(__milRectOutsideView(center.x-visualW*2,center.y-visualW*2,center.x+visualW*2,center.y+visualW*2,w,h))return;
  const iw=img?.naturalWidth||100,ih=img?.naturalHeight||80,hh=visualW*ih/iw;
  const drawAng=(n.fallbackKind==='drag'||n.fallbackKind==='fracture'||key.includes('drag')||key.includes('fracture'))?texRot:texRot+180;
  if(img&&img.naturalWidth)__milDrawRotTinted(img,center.x,center.y,visualW,hh,drawAng,noteAlpha,noteColor);
  else{ctx.save();ctx.globalAlpha*=noteAlpha*(noteColor[3]/255);ctx.translate(center.x,center.y);ctx.rotate(drawAng*Math.PI/180);ctx.fillStyle=`rgb(${noteColor[0]},${noteColor[1]},${noteColor[2]})`;ctx.beginPath();ctx.ellipse(0,0,visualW*.5,visualW*.34,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  state.visibleHit.push({n,x:center.x,y:center.y,r:radius,key:n.key,type:n.type});state.inspectHit.push({kind:'note',label:'Note',id:n.key,hiddenKey:itemKey('note',n.key),n,x:center.x,y:center.y,r:radius});if(hidden)drawHiddenHalo(center.x,center.y,radius);
};

function normalizeMilthm(raw){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.BPMList)||!Array.isArray(raw.NoteList))return raw;
  const version=int(raw.FormatVersionCode,9),legacyOffset=version<=6?toNum(raw.SongOffset,0):0;
  const bpms=raw.BPMList.map((b,i)=>{const bpm=toNum(b?.BPM,120);if(!Number.isFinite(bpm)||Math.abs(bpm)<1e-12)throw new Error('BPMList['+i+'].BPM 不能为 0');return{start:toNum(b?.Start,0)-legacyOffset,bpm,beatsPerBar:Math.max(1,int(b?.BeatsPerBar,4))}});
  if(!bpms.length)bpms.push({start:0,bpm:120,beatsPerBar:4});
  const normalizedTimeline=buildTimeline(bpms);
  const endpointSeconds=(stamp,absolute,bpmScope)=>stamp==null?__milScopedTimeToSeconds(absolute,normalizedTimeline,bpms,bpmScope,false):__milScopedTimeToSeconds(stamp,normalizedTimeline,bpms,bpmScope,true);
  const lineCount=Math.max(0,int(raw.LineCount,Array.isArray(raw.LineList)?raw.LineList.length:0)),lines=Array.from({length:lineCount},()=>({notes:[]})),order=[];
  for(let gi=0;gi<raw.NoteList.length;gi++){
    const n=raw.NoteList[gi]||{},li=Math.max(0,int(n.Line,0));while(lines.length<=li)lines.push({notes:[]});
    const bpm=int(n.BPM,0),st=endpointSeconds(n.From,n.FromTime,bpm),en=endpointSeconds(n.To,n.ToTime,bpm),local=lines[li].notes.length;
    lines[li].notes.push({bpm,startTime:st,endTime:en,type:int(n.Type,0),isFake:!!n.Fake,isAlwaysPerfect:typeof n.AP==='boolean'?n.AP:false,__line_local_idx:local,_source:n});order.push([li,local]);
  }
  const sourceAnimations=Array.isArray(raw.AnimationList)?raw.AnimationList:(Array.isArray(raw.PerformanceList)?raw.PerformanceList:[]);
  const animations=sourceAnimations.map(a=>{a=a||{};const bpm=int(a.BPM,0);return{bpmId:bpm,fromBeat:endpointSeconds(a.FromBeat,a.FromTime,bpm),toBeat:endpointSeconds(a.ToBeat,a.ToTime,bpm),key:int(a.Key,0),fv:a.FV,tv:a.TV,data:int(a.Data,0),i1:int(a.I1,-1),press:int(a.Press,0),ease:int(a.Ease,0),valueExpression:!!a.ValueExpression,customEaseExpression:String(a.CustomEaseExpression||''),...(Object.prototype.hasOwnProperty.call(a,'EditorX')?{EditorX:a.EditorX}:{}),...(Object.prototype.hasOwnProperty.call(a,'AllX')?{AllX:a.AllX}:{}),_source:a}});
  const storyboards=(Array.isArray(raw.StoryBoardObjects)?raw.StoryBoardObjects:[]).map(s=>({type:int(s?.Type,0),data:String(s?.Data||''),layer:s?.Layer==null?(s?.ShowUponPlay===true?2:1):int(s.Layer,1),_source:s}));
  const meta={};for(const k of ['Title','Composer','Illustrator','Beatmapper','BeatmapUID','Difficulty','DifficultyValue','UITheme','AudioFile','IllustrationFile','PreviewTime','SongOffset','FormatVersionCode','IsAnomalyMap','Contributors','EditorComments'])if(k in raw)meta[k]=raw[k];
  return{meta,bpms,lines,animations,storyboardObjects:storyboards,_note_create_order:order,_milthm:true,_source:raw};
};

function milizeJsToJson(text,environment=null){return new Promise((resolve,reject)=>{
  const token='js2json_'+Math.random().toString(36).slice(2),iframe=document.createElement('iframe');iframe.sandbox='allow-scripts';iframe.style.display='none';
  const source=String(text).replace(/<\/script/gi,'<\\/script');
  let localeLanguage='en',localeRegion='US',localeScript='Latn';
  try{const loc=new Intl.Locale(navigator.language||'en').maximize();localeLanguage=loc.language||'en';localeRegion=loc.region||'US';localeScript=loc.script||'Latn'}catch{}
  // Stage dimensions are CSS pixels, independent of the render-quality/DPR budget.
  const stageRect=els.stage.getBoundingClientRect(),rotated=els.stageWrap?.classList.contains('nativeLandscapeFallback')&&matchMedia('(orientation:portrait)').matches;
  const stageW=Math.max(1,Number(rotated?els.stage.clientWidth:stageRect.width)||1920),stageH=Math.max(1,Number(rotated?els.stage.clientHeight:stageRect.height)||1080);
  const envValues={
    "stage.width":String(stageW),"stage.height":String(stageH),
    "system.screen_width":String(screen.width||stageW),"system.screen_height":String(screen.height||stageH),
    "user.note_scale":String(state.noteScale||1),"user.flow_speed":String(state.flowSpeed||1),"user.name":"","user.nickname":"",
    "user.culture.bcp47":navigator.language||"en","user.culture.ieft_label":navigator.language||"en","user.culture.ietf_label":navigator.language||"en",
    "user.culture.language":localeLanguage,"user.culture.region":localeRegion,"user.culture.script":localeScript,
    "time":String(Date.now()),...environment
  };
  iframe.srcdoc=`<!doctype html><meta charset="utf-8"><script>(()=>{
    const token=${JSON.stringify(token)},rawSource=${JSON.stringify(source)},ENV=${JSON.stringify(envValues)};
    /* Helper bindings intentionally use var/function (not const/let): a direct eval of
     * chart source such as 'var m=MilizeBeatmap; var t=m.timing;' must be able to
     * redeclare them.  All API methods are bound to the beatmap instance so extracted
     * references ('let timing=m.timing; timing(...)') keep working without 'this'. */
    var finite=(value,name)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(name+' 必须是有限数值');return n};
    var integer=(value,name)=>{const n=finite(value,name);if(!Number.isInteger(n))throw new Error(name+' 必须是整数');return n};
    class MilizeBeatmapClass{
      constructor(){this.mil={meta:{},bpms:[],lines:[],storyboardObjects:[],animations:[],_beatmapjs:true};this.order=[]}
      timing(start,bpm,beatsPerBar=4){const startN=finite(start,'timing.start'),bpmN=finite(bpm,'timing.bpm'),barRaw=beatsPerBar===undefined?4:Math.trunc(Number(beatsPerBar)),barN=Number.isFinite(barRaw)&&barRaw>0?barRaw:4;if(Math.abs(bpmN)<1e-12)throw new Error('timing.bpm 不能为 0');const id=this.mil.bpms.length;this.mil.bpms.push({start:startN,bpm:bpmN,beatsPerBar:barN});return id}
      storyboardObject(type,data,layer){const id=this.mil.storyboardObjects.length;this.mil.storyboardObjects.push({type:integer(type,'storyboardObject.type'),data:data==null?'':String(data),layer:integer(layer,'storyboardObject.layer')});return id}
      note(line,bpm,startTime,endTime,type,isFake,isAlwaysPerfect){const li=integer(line,'note.line');if(li<0)throw new Error('note.line 不能小于 0');while(this.mil.lines.length<=li)this.mil.lines.push({notes:[]});const local=this.mil.lines[li].notes.length,id=this.order.length;this.mil.lines[li].notes.push({bpm:integer(bpm,'note.bpm'),startTime,endTime,type:integer(type,'note.type'),isFake:!!isFake,isAlwaysPerfect:!!isAlwaysPerfect,__line_local_idx:local});this.order.push([li,local]);return id}
      animation(bpmId,fromBeat,toBeat,key,fv,tv,data,i1,press,ease,valueExpression,customEaseExpression){const id=this.mil.animations.length;this.mil.animations.push({bpmId:integer(bpmId,'animation.bpm'),fromBeat,toBeat,key:integer(key,'animation.key'),fv,tv,data:integer(data,'animation.data'),i1:integer(i1,'animation.i1'),press:integer(press,'animation.press'),ease:integer(ease,'animation.ease'),valueExpression:!!valueExpression,customEaseExpression:customEaseExpression===undefined?'':String(customEaseExpression)});return id}
      withProperty(key,value){this.mil.meta[String(key)]=value;return this}
      withoutProperty(key){delete this.mil.meta[String(key)];return this}
      line(){const id=this.mil.lines.length;this.mil.lines.push({notes:[]});return id}
      env(key){return Object.prototype.hasOwnProperty.call(ENV,String(key))?ENV[String(key)]:''}
    }
    var beatmap=new MilizeBeatmapClass();
    /* 所有 API 方法都绑定到同一个 beatmap 实例，因此即使谱面把方法解绑保存
     * （例如 u0=n0.timing 后单独 u0(...)），调用时不依赖 this 也能正确写入。 */
    var __milBound=['timing','storyboardObject','note','animation','withProperty','withoutProperty','line','env'];
    for(var __mbi=0;__mbi<__milBound.length;__mbi++){var __mbk=__milBound[__mbi];beatmap[__mbk]=beatmap[__mbk].bind(beatmap)}
    var MilizeBeatmap=beatmap,m=beatmap;
    var p=beatmap.withProperty,t=beatmap.timing,n=beatmap.note,X=beatmap.note,s=beatmap.storyboardObject,a=beatmap.animation;
    /* 打包谱面可能通过 window/globalThis/self 或间接 eval 查找全局对象，而 IIFE 里的
     * var 只是函数作用域、不会自动成为全局属性。这里显式把 API 暴露到全局（若可用），
     * 让 window.MilizeBeatmap.timing(...) 以及其它全局读取都能命中同一个实例。
     * 真实谱面都不会重新声明 MilizeBeatmap，因此不会覆盖这里的绑定。 */
    try{var __milGlobal=(typeof globalThis!=='undefined'&&globalThis)||(typeof window!=='undefined'&&window)||(typeof self!=='undefined'&&self);if(__milGlobal){__milGlobal.MilizeBeatmap=beatmap;__milGlobal.m=beatmap;__milGlobal.timing=beatmap.timing;__milGlobal.line=beatmap.line;__milGlobal.note=beatmap.note;__milGlobal.animation=beatmap.animation;__milGlobal.storyboardObject=beatmap.storyboardObject;__milGlobal.withProperty=beatmap.withProperty;__milGlobal.withoutProperty=beatmap.withoutProperty;__milGlobal.env=beatmap.env}}catch(__mile){}
    var tap=(line,bpm,time)=>n(line,bpm,time,time,0,false,false),fakeTap=(line,bpm,time)=>n(line,bpm,time,time,0,true,false),exTap=(line,bpm,time)=>n(line,bpm,time,time,0,false,true);
    var drag=(line,bpm,time)=>n(line,bpm,time,time,1,false,false),fakeDrag=(line,bpm,time)=>n(line,bpm,time,time,1,true,false),fracture=(line,bpm,time)=>n(line,bpm,time,time,2,false,false);
    var hold=(line,bpm,start,end)=>n(line,bpm,start,end,0,false,false),fakeHold=(line,bpm,start,end)=>n(line,bpm,start,end,0,true,false),exHold=(line,bpm,start,end)=>n(line,bpm,start,end,0,false,true);
    var withProperty=beatmap.withProperty,withoutProperty=beatmap.withoutProperty,env=beatmap.env,timing=beatmap.timing,line=beatmap.line,note=beatmap.note,animation=beatmap.animation,storyboardObject=beatmap.storyboardObject;
    class NoteType extends Number{} class AnimationType extends Number{} class AnimationBindingType extends Number{} class EaseType extends Number{} class EaseSubType extends Number{} class StoryboardObjectType extends Number{} class StoryboardObjectLayerType extends Number{}
    const NoteTypeEnum=Object.freeze({tap:0,hold:0,drag:1,fracture:2});
    const AnimationTypeEnum=Object.freeze({PositionX:0,PositionY:1,Transparency:2,Size:3,Rotation:4,FlowSpeed:5,RelativeX:6,RelativeY:7,LineBodyTransparency:8,LineHeadTransparency:9,StoryBoardWidth:10,StoryBoardHeight:11,Speed:12,WholeTransparency:13,SBLBX:14,SBLBY:15,SBRBX:16,SBRBY:17,SBLTX:18,SBLTY:19,SBRTX:20,SBRTY:21,Color:22,VisibleArea:23,RenderDistance:23});
    const AnimationBindingTypeEnum=Object.freeze({Line:0,Note:1,Storyboard:2});
    const EaseTypeEnum=Object.freeze({Linear:0,Sine:1,Quad:2,Cubic:3,Quart:4,Quint:5,Expo:6,Circ:7,Back:8,Elastic:9,Bounce:10,Bezier:11,Custom:12,Smoothstep:13,Sqrt:14,QuartRoot:15});
    const EaseSubTypeEnum=Object.freeze({In:0,Out:1,IO:2});
    const StoryboardObjectTypeEnum=Object.freeze({Picture:0,Text:1});
    const StoryboardObjectLayerEnum=Object.freeze({Background:0,Normal:1,Foreground:2});
    const source=rawSource
      .replace(/^\\s*import(?:[\\s\\S]*?\\s+from\\s*)?["'][^"']+["']\\s*;?/gm,'')
      .replace(/^\\s*export\\s*\\{[^}]*\\}\\s*;?\\s*$/gm,'')
      .replace(/\\bexport\\s+default\\s+/g,'')
      .replace(/\\bexport\\s+(?=(?:const|let|var|function|class)\\b)/g,'');
    try{eval(source);if(!beatmap.mil.bpms.length)beatmap.mil.bpms.push({start:0,bpm:120,beatsPerBar:4});beatmap.mil._note_create_order=beatmap.order;parent.postMessage({token,ok:true,chart:beatmap.mil},'*')}
    catch(e){parent.postMessage({token,ok:false,error:e&&e.message?e.message:String(e)},'*')}
  })();<\/script>`;
  const timeoutMs=Math.min(60000,Math.max(4000,4000+source.length*.025));
  const timer=setTimeout(()=>done(false,null,new Error('JS 转 JSON 超时（'+Math.round(timeoutMs/1000)+'s）')),timeoutMs);
  function done(ok,chart,err){clearTimeout(timer);window.removeEventListener('message',onmsg);iframe.remove();if(ok){Object.defineProperties(chart,{_jsSource:{value:String(text)},_jsEnvironment:{value:envValues}});resolve(chart)}else reject(err)}
  function onmsg(ev){const d=ev.data||{};if(d.token!==token)return;d.ok?done(true,d.chart):done(false,null,new Error(d.error||'JS 转 JSON 失败'))}
  window.addEventListener('message',onmsg);document.body.appendChild(iframe);
})};
function __milScanNamedCalls(text,names){
  const out=[],alt=names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),re=new RegExp('(?<![A-Za-z0-9_.$])('+alt+')\\s*\\(','g');let m;
  while((m=re.exec(text))){let i=re.lastIndex,start=i,dep=1,q='',esc=false;for(;i<text.length;i++){const ch=text[i];if(q){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===q)q='';continue}if(ch==='"'||ch==="'"){q=ch;continue}if(ch==='(')dep++;else if(ch===')'){dep--;if(dep===0){out.push({name:m[1],index:m.index,args:splitArgs(text.slice(start,i)).map(parseJsVal)});re.lastIndex=i+1;break}}}}
  return out;
}
function staticTjson(text){
  const meta={},bpms=[],lines=[],storyboardObjects=[],animations=[],order=[];let t=String(text),cons=[];
  const loop=/for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\d+)\s*;\s*\w+\+\+\s*\)\s*\{\s*m\.line\s*\(\s*\)\s*;?\s*\}/g;let m;
  while((m=loop.exec(t))){for(let i=0;i<Number(m[1]);i++)lines.push({notes:[]});cons.push([m.index,loop.lastIndex])}
  for(const [a,b] of cons.reverse())t=t.slice(0,a)+' '.repeat(b-a)+t.slice(b);for(const _ of t.matchAll(/m\.line\s*\(\s*\)/g))lines.push({notes:[]});
  for(const a of scanCalls(text,'p'))if(a.length>=2)meta[String(a[0])]=a[1];for(const a of scanCalls(text,'t'))if(a.length>=2)bpms.push({start:toNum(a[0],0),bpm:toNum(a[1],120),beatsPerBar:a.length>=3?toNum(a[2],4):4});
  const ensure=i=>{while(lines.length<=i)lines.push({notes:[]})};
  for(const call of __milScanNamedCalls(text,['n','X']).sort((a,b)=>a.index-b.index)){const a=call.args;if(a.length>=7){const li=Math.max(0,int(a[0],0));ensure(li);const local=lines[li].notes.length;lines[li].notes.push({bpm:int(a[1],0),startTime:a[2],endTime:a[3],type:int(a[4],0),isFake:!!a[5],isAlwaysPerfect:!!a[6],__line_local_idx:local});order.push([li,local])}}
  for(const a of scanCalls(text,'s'))if(a.length>=3)storyboardObjects.push({type:int(a[0],0),data:String(a[1]??''),layer:int(a[2],0)});
  for(const a of scanCalls(text,'a'))if(a.length>=10)animations.push({bpmId:int(a[0],0),fromBeat:a[1],toBeat:a[2],key:int(a[3],0),fv:a[4],tv:a[5],data:int(a[6],0),i1:int(a[7],0),press:int(a[8],0),ease:int(a[9],0),valueExpression:!!a[10],customEaseExpression:String(a[11]??'')});
  if(!bpms.length)bpms.push({start:0,bpm:120,beatsPerBar:4});const chart={meta,bpms,lines,storyboardObjects,animations,_note_create_order:order,_beatmapjs:true};if(!lines.some(l=>l.notes?.length)&&!animations.length)throw new Error('TJSON 静态解析没有找到 note 或 animation 调用');return chart;
};

window.__milthmSemanticSelfTest = async function(){
  const failures=[],near=(a,b,e=1e-7)=>Math.abs(a-b)<=e,ok=(cond,msg)=>{if(!cond)failures.push(msg)};
  try{
    const tl=buildTimeline([{start:10,bpm:120,beatsPerBar:4}]);ok(near(tl.secAt(-2),9),'首 BPM 前 secAt 反算错误');
    const chart={bpms:[{start:0,bpm:120},{start:10,bpm:60}],lines:[{notes:[{bpm:1,startTime:[2,0,1],endTime:[2,0,1],type:0},{bpm:0,startTime:3,endTime:3.0005,type:0}]}],animations:[{bpmId:1,fromBeat:[0,0,1],toBeat:[2,0,1],key:0,fv:5,tv:9,data:0,i1:0,press:0,ease:0},{bpmId:0,fromBeat:10,toBeat:20,key:12,fv:2,tv:2,data:1,i1:0,press:10,ease:2},{bpmId:0,fromBeat:10,toBeat:20,key:23,fv:1,tv:1,data:1,i1:0,press:0,ease:0}],storyboardObjects:[],_beatmapjs:true,_note_create_order:[[0,0],[0,1]]};
    const rt=makeRuntime(chart,'selftest');const scopedNote=rt.notes.find(n=>n.note.bpm===1),absoluteNote=rt.notes.find(n=>n.note.bpm===0);ok(near(scopedNote?.startSec,12),'Note BPM scope 未正确应用');ok(near(absoluteNote?.startSec,3),'数值时间未按绝对秒处理');ok(!absoluteNote?.isHold,'0.001 秒容差错误');ok(!rt.events.get(BEARER_NOTE)?.get(0)?.has(SPEED),'Note Speed 未被忽略');ok(!rt.events.get(BEARER_NOTE)?.get(0)?.has(VISIBLE_AREA),'Note VisibleArea 未被忽略');ok(near(rt.lineValue(0,POS_X,9),0),'动画开始前未使用默认值');ok(near(rt.lineValue(0,POS_X,11),7),'BPM scoped 动画时间错误');
    const speedChart={bpms:[{start:0,bpm:120}],lines:[{notes:[]}],animations:[{fromBeat:10,toBeat:20,key:SPEED,fv:2,tv:2,data:0,i1:0}],storyboardObjects:[]};const sr=makeRuntime(speedChart);ok(near(sr.lineValue(0,SPEED,5),5),'Speed 首事件前默认积分错误');ok(near(sr.lineValue(0,SPEED,15),20),'Speed 积分错误');
    const overlap={bpms:[{start:0,bpm:120}],lines:[{notes:[]}],animations:[{fromBeat:0,toBeat:10,key:0,fv:0,tv:10,data:0,i1:0},{fromBeat:5,toBeat:6,key:0,fv:100,tv:200,data:0,i1:0}],storyboardObjects:[]};const or=makeRuntime(overlap);ok(near(or.lineValue(0,0,5),100),'同起点/重叠动画未选择最后开始事件');ok(near(or.lineValue(0,0,8),200),'动画目标值未保持');
    const ce={startSec:0,endSec:1,fv:0,tv:10,key:0,press:0,ease:0,valueExpression:true,custom:'x*2'};ok(near(eventValue(ce,0,.5),10),'ValueExpression 语义错误');
    const co={startSec:0,endSec:1,fv:0xff0000ff,tv:0x0000ffff,key:COLOR,press:0,ease:0,valueExpression:false,custom:''};ok((eventValue(co,0,.5)>>>0)===(0x800080ff>>>0),'Color 未按通道插值');
    const fake={type:0,isFake:true,isAlwaysPerfect:true,isMore:false,isHold:false,note:{}};ok(noteTextureKey(fake)==='extap','Fake+AP 按 AP 语义选择 ex 纹理');
    const st=transformLine({lineValue:(li,key)=>key===VISIBLE_AREA?50:(LINE_DEFAULTS[key]??0)},0,0,1920,1080);ok(near(st.visible,50),'VisibleArea 被错误缩放');
    const parsed=await milizeJsToJson('const b=t(10,60,4); const l=m.line(); const q=n(l,b,[2,0,1],[2,0,1],0,false,false); a(b,[0,0,1],[1,0,1],0,1,2,1,q,0,0,false,"");');ok(parsed.bpms.length===1&&parsed.lines[0].notes[0].bpm===0,'Beatmap.js timing 返回值不是 BPM id');ok(parsed.animations[0].i1===0,'Beatmap.js note 返回值不是 Note id');
    const parsed2=await milizeJsToJson('const b=m.timing(0,120,4);const l=m.line();const q=m.note(l,b,[0,0,1],[0,0,1],0,false,false);m.animation(b,[0,0,1],[1,0,1],0,0,1,1,q,13,2,true,"x");');ok(parsed2.animations[0].press===13&&parsed2.animations[0].ease===2&&parsed2.animations[0].valueExpression===true,'MilizeBeatmap.animation 参数映射错误');

    const localScope={bpms:[{start:0,bpm:120},{start:10,bpm:60}],lines:[{notes:[{bpm:-1,startTime:[2,0,1,1],endTime:[2,0,1,1],type:0}]}],animations:[{bpmId:-1,fromBeat:[1,0,1,1],toBeat:[2,0,1,1],key:POS_X,fv:0,tv:10,data:0,i1:0,press:0,ease:0}],storyboardObjects:[]};const lr=makeRuntime(localScope);ok(near(lr.notes[0].startSec,12),'BPM < 0 的 Note 本地 BPM id 解析错误');ok(near(lr.lineValue(0,POS_X,11.5),5),'BPM < 0 的动画本地 BPM id 解析错误');
    const absRaw={FormatVersionCode:9,BPMList:[{Start:0,BPM:120,BeatsPerBar:4}],LineCount:1,NoteList:[{Line:0,BPM:0,From:null,FromTime:1.25,To:null,ToTime:1.25,Type:0,Fake:false,AP:'false'}],AnimationList:[{BPM:0,FromBeat:null,FromTime:1,ToBeat:null,ToTime:2,FV:'0',TV:'10',I1:0,Data:0,Key:0,Press:0,Ease:0,ValueExpression:false,CustomEaseExpression:''}],StoryBoardObjects:[]};const absNorm=normalizeMilthm(absRaw),absRt=makeRuntime(absNorm);ok(near(absRt.notes[0].startSec,1.25),'From:null/FromTime 绝对时间解析错误');ok(absRt.notes[0].isAlwaysPerfect===false,'非布尔 AP 未按 false 处理');ok(near(absRt.lineValue(0,POS_X,1.5),5),'动画绝对时间端点解析错误');
    const oldRaw={FormatVersionCode:6,SongOffset:2,BPMList:[{Start:10,BPM:120,BeatsPerBar:4}],LineCount:0,NoteList:[],AnimationList:[],StoryBoardObjects:[]},newRaw={...oldRaw,FormatVersionCode:9};ok(near(normalizeMilthm(oldRaw).bpms[0].start,8),'v6 SongOffset 未从 BPM Start 扣除');ok(near(normalizeMilthm(newRaw).bpms[0].start,10),'v7+ SongOffset 被错误应用');
    const flowChart={bpms:[{start:0,bpm:120}],lines:[{notes:[{bpm:0,startTime:10,endTime:10,type:0}]}],animations:[{fromBeat:0,toBeat:20,key:FLOW,fv:9,tv:18,data:0,i1:0,press:0,ease:0},{fromBeat:15,toBeat:20,key:FLOW,fv:3,tv:3,data:1,i1:0,press:0,ease:0}],storyboardObjects:[]};const fr=makeRuntime(flowChart),fn=fr.notes[0];ok(near(fr.noteValue(fn,FLOW,5),fr.lineValue(0,FLOW,5)),'Note FlowSpeed 动画开始前未继承 Line 实时流速');ok(near(fr.noteValue(fn,FLOW,16),3),'Note FlowSpeed 动画值错误');
    ok(makeRuntime({bpms:[{start:0,bpm:120}],lines:[],animations:[],storyboardObjects:[]}).lineCount===0,'LineCount=0 时渲染了幽灵判定线');
    const negRt=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[]}],animations:[{fromBeat:0,toBeat:1,key:SIZE,fv:-1,tv:-1,data:0,i1:0,press:0,ease:0}],storyboardObjects:[]}),negSt=transformLine(negRt,0,.5,1920,1080);ok(near(negSt.scale,1)&&near(((negSt.rotation%360)+360)%360,270),'Line 负 Size 未等价转换为 180 度翻转');
    let divRejected=false;try{normalizeMilthm({FormatVersionCode:9,BPMList:[{Start:0,BPM:120,BeatsPerBar:4}],LineCount:1,NoteList:[{Line:0,BPM:0,From:[0,0,0],To:[0,0,1],Type:0,Fake:false}],AnimationList:[],StoryBoardObjects:[]})}catch{divRejected=true}ok(divRejected,'division=0 未被拒绝');
    for(let press=0;press<=15;press++){const expr=press===11?'0.42,0,0.58,1':(press===12?'t*t':'');for(let subtype=0;subtype<=2;subtype++){const a0=easeValue(subtype,press,0,expr),a5=easeValue(subtype,press,.5,expr),a1=easeValue(subtype,press,1,expr);ok([a0,a5,a1].every(Number.isFinite),'缓动 '+press+'/'+subtype+' 产生非有限值');ok(near(a0,0,1e-5)&&near(a1,1,1e-5),'缓动 '+press+'/'+subtype+' 端点错误')}}
    const helpers=await milizeJsToJson('import m,{tap,fakeTap,exTap,drag,fakeDrag,hold,fakeHold,exHold,fracture,env,AnimationTypeEnum,AnimationBindingTypeEnum,EaseTypeEnum,EaseSubTypeEnum} from "beatmap-js"; const b=m.timing(0,120,4),l=m.line(); const q=tap(l,b,[0,0,1]); fakeTap(l,b,[1,0,1]); exTap(l,b,[2,0,1]); drag(l,b,[3,0,1]); fakeDrag(l,b,[4,0,1]); hold(l,b,[5,0,1],[6,0,1]); fakeHold(l,b,[7,0,1],[8,0,1]); exHold(l,b,[9,0,1],[10,0,1]); fracture(l,b,[11,0,1]); m.animation(b,[0,0,1],[1,0,1],AnimationTypeEnum.PositionX,0,10,AnimationBindingTypeEnum.Note,q,EaseTypeEnum.Smoothstep,EaseSubTypeEnum.IO,false,""); m.withProperty("lang",env("user.culture.language")); m.withProperty("missing",env("missing.key"));');ok(helpers.lines[0].notes.length===9,'Beatmap.js 便捷 Note helper 未正确执行');ok(helpers.animations[0].key===0&&helpers.animations[0].data===1&&helpers.animations[0].press===13&&helpers.animations[0].ease===2,'Beatmap.js 导出枚举未正确执行');ok(typeof helpers.meta.lang==='string'&&helpers.meta.lang.length>0&&helpers.meta.missing==='','Beatmap.js env 字符串语义错误');
    ok(near(evalExpr('t<.5 ? t*2 : 2-t*2',{t:.25}),.5),'CustomExpression 三元/比较表达式未解析');ok(near(evalExpr('clamp(x,0,1)',{x:2}),1),'CustomExpression clamp 未解析');ok(Number.isNaN(evalExpr('globalThis.constructor')),'CustomExpression 非法成员访问未拒绝');
    const moreRt=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{bpm:0,startTime:1,endTime:1,type:0},{bpm:0,startTime:1.00005,endTime:1.00005,type:0},{bpm:0,startTime:2,endTime:2,type:0},{bpm:0,startTime:2.0000005,endTime:2.0000005,type:0}]}],animations:[],storyboardObjects:[]});const mn=[...moreRt.notes].sort((a,b)=>a.startSec-b.startSec);ok(!mn[0].isMore&&!mn[1].isMore,'近邻但非同时 Note 被误判为 More');ok(mn[2].isMore&&mn[3].isMore,'浮点同刻 Note 未识别为 More');
    const earlyRt=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{bpm:0,startTime:100,endTime:100,type:0}]}],animations:[{fromBeat:0,toBeat:200,key:SPEED,fv:.01,tv:.01,data:0,i1:0,press:0,ease:0}],storyboardObjects:[]});ok(earlyRt.notes[0].activeFrom===Number.NEGATIVE_INFINITY,'固定预读窗口仍可能裁掉屏幕内 Note');
    const specialTimeline=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{bpm:0,startTime:20,endTime:20,type:0,isFake:true},{bpm:0,startTime:2,endTime:2,type:2,isFake:false}]}],animations:[],storyboardObjects:[]});ok(specialTimeline.duration>=22,'仅 Fake/Lightning Note 未扩展可播放时间轴');ok(specialTimeline.comboAt(3)===0,'Lightning Note 被错误计入普通 Combo');
    const preserved=normalizeMilthm({FormatVersionCode:9,BPMList:[{Start:0,BPM:120,BeatsPerBar:4}],LineCount:1,NoteList:[],AnimationList:[{BPM:0,FromBeat:[0,0,1],ToBeat:[1,0,1],FV:0,TV:1,I1:0,Data:0,Key:0,Press:0,Ease:0,ValueExpression:false,CustomEaseExpression:'',EditorX:12,AllX:true}],StoryBoardObjects:[]});ok(preserved.animations[0].EditorX===12&&preserved.animations[0].AllX===true,'EditorX/AllX 扩展字段未保留');
    const noSemiImport=await milizeJsToJson('import m,{tap} from \"beatmap-js\"\nconst b=m.timing(0,120,4),l=m.line();tap(l,b,[0,0,1])');ok(noSemiImport.lines[0].notes.length===1,'无分号 import 未正确剥离');
    const orderChart={bpms:[{start:0,bpm:120}],lines:[{notes:[{bpm:0,startTime:5,endTime:5,type:0}]},{notes:[{bpm:0,startTime:1,endTime:1,type:0}]}],_note_create_order:[[1,0],[0,0]],animations:[{fromBeat:0,toBeat:1,key:POS_X,fv:100,tv:100,data:1,i1:0,press:0,ease:0}],storyboardObjects:[]};const orderRt=makeRuntime(orderChart),firstCreated=orderRt.notes.find(n=>n.lineIdx===1);ok(near(orderRt.noteValue(firstCreated,POS_X,.5),100),'Note 动画 I1 未按全局创建/NoteList 顺序绑定');
  }catch(e){failures.push(e&&e.stack?e.stack:String(e))}
  return{ok:failures.length===0,failures};
};



/* ===== FULL RENDER REVIEW PATCH ===== */

/* Milthm complete-render review patch — 2026-08-06
 * Completes the ranges intentionally left outside the earlier Note/Line review:
 * package resource resolution, canonical chart selection, legacy LineList defaults,
 * storyboard picture/text/color/layer/vertex rendering, and semantic texture priority.
 */
const __MIL_FULL_REVIEW_VERSION = '2026-08-06.3';
const __MIL_ASSET_SAVE_KEY = SAVE_KEY+'_render-assets-v1';

/* The old UI shipped with an unexplained 110 ms media offset.  Beatmap times and audio
 * time share the same song-time origin; any extra offset must be an explicit user choice. */
if (Math.abs(Number(state.audioDelay) - 0.11) < 1e-12) state.audioDelay = 0;
if (els.audioDelayInput) els.audioDelayInput.value = String(state.audioDelay || 0);
if(els.fileInput&&!String(els.fileInput.accept||'').includes('.milthm'))els.fileInput.accept=(els.fileInput.accept?els.fileInput.accept+',':'')+'.milthm,.tjson,.mjs,.cjs,.gif,.bmp,.svg';

const __milOriginalMimeForName = mimeForName;
mimeForName = function(name){
  const n=String(name||'').toLowerCase();
  if(/\.milthm$/.test(n))return 'application/json;charset=utf-8';
  if(/\.(tjson|mjs|cjs|ts)$/.test(n))return 'text/javascript;charset=utf-8';
  if(/\.svg$/.test(n))return 'image/svg+xml';
  if(/\.gif$/.test(n))return 'image/gif';
  if(/\.bmp$/.test(n))return 'image/bmp';
  return __milOriginalMimeForName(name);
};

function __milNormalizePath(path){
  let s=String(path||'').normalize('NFC').replace(/\\/g,'/').replace(/[?#].*$/,'');
  try{s=decodeURIComponent(s)}catch{}
  s=s.replace(/^file:\/\//i,'').replace(/^\/+/, '');
  const out=[];
  for(const part of s.split('/')){
    if(!part||part==='.')continue;
    if(part==='..'){if(out.length)out.pop();continue}
    out.push(part);
  }
  return out.join('/');
}
function __milDirname(path){const p=__milNormalizePath(path),i=p.lastIndexOf('/');return i<0?'':p.slice(0,i)}
function __milBasename(path){const p=__milNormalizePath(path),i=p.lastIndexOf('/');return i<0?p:p.slice(i+1)}
function __milJoin(base,ref){
  const r=String(ref||'').replace(/\\/g,'/');
  if(/^\//.test(r))return __milNormalizePath(r);
  return __milNormalizePath((base?base+'/':'')+r);
}
function __milIsImageName(name){return /\.(png|jpe?g|avif|webp|gif|bmp|svg)$/i.test(String(name||''))}
function __milIsMediaName(name){return /\.(ogg|opus|mp3|wav|flac|m4a|aac|mp4|webm|mov)$/i.test(String(name||''))}
function __milIsChartName(name){return /\.(milthm|json|js|mjs|cjs|txt|tjson)$/i.test(String(name||''))}
function __milChartPriority(file){
  const n=String(file?.name||'').toLowerCase(),b=__milBasename(n);let score=0;
  if(/\.milthm$/.test(n))score+=1000;
  else if(/\.tjson$/.test(n))score+=900;
  else if(/\.(js|mjs|cjs)$/.test(n))score+=800;
  else if(/\.json$/.test(n))score+=700;
  else if(/\.txt$/.test(n))score+=500;
  if(/(?:^|[-_.])(chart|beatmap|谱面)(?:[-_.]|$)/i.test(b))score+=300;
  if(/(?:meta|manifest|config|setting|package)/i.test(b))score-=500;
  return score;
}

function __milClearStoryCache(){
  if(state.assetObjectUrls instanceof Map){for(const u of state.assetObjectUrls.values())try{URL.revokeObjectURL(u)}catch{}}
  state.assetObjectUrls=new Map();
  storyCache.clear();
}
function __milRevokePackageAssets(){
  __milClearStoryCache();state.assetFiles=new Map();state.assetFilesLower=new Map();state.assetBasenames=new Map();state.assetPathConflicts=new Set();
}
function __milIndexPackageAssets(files,chartName=''){
  __milRevokePackageAssets();state.assetBaseDir=__milDirname(chartName);
  for(const f of files||[]){
    if(!f||!f.name)continue;const p=__milNormalizePath(f.name);if(!p)continue;
    if(state.assetFiles.has(p))state.assetPathConflicts.add(p);else state.assetFiles.set(p,f);
    const low=p.toLowerCase();if(!state.assetFilesLower.has(low))state.assetFilesLower.set(low,[]);state.assetFilesLower.get(low).push(f);
    const b=__milBasename(p).toLowerCase();if(!state.assetBasenames.has(b))state.assetBasenames.set(b,[]);state.assetBasenames.get(b).push(f);
  }
}
function __milResolveAssetFile(ref,baseDir=state.assetBaseDir||''){
  if(!ref||!(state.assetFiles instanceof Map))return null;
  const raw=String(ref);if(/^[A-Za-z][A-Za-z0-9+.-]*:|^\/\//.test(raw))return null;const candidates=[__milJoin(baseDir,raw),__milNormalizePath(raw)];
  for(const p of candidates){if(!state.assetPathConflicts?.has(p)){const f=state.assetFiles.get(p);if(f)return f}}
  for(const p of candidates){const list=state.assetFilesLower.get(p.toLowerCase());if(list?.length===1)return list[0]}
  const matches=state.assetBasenames.get(__milBasename(raw).toLowerCase());return matches&&matches.length===1?matches[0]:null;
}
function __milAssetUrl(ref){
  const f=__milResolveAssetFile(ref);if(!f)return null;const key=__milNormalizePath(f.name);let u=state.assetObjectUrls.get(key);
  if(!u){u=URL.createObjectURL(f);state.assetObjectUrls.set(key,u)}return u;
}
function __milClearBackground(){
  if(state.bgUrl)try{URL.revokeObjectURL(state.bgUrl)}catch{}state.bgUrl='';state.bgName='';state.backgroundImage=null;els.stageWrap?.style.removeProperty('--mil-stage-art');updateControls();render();
}
function __milClearMedia(){
  const media=els.audioPlayer;media.pause();if(state.mediaUrl)try{URL.revokeObjectURL(state.mediaUrl)}catch{}state.mediaUrl='';state.mediaName='';state.mediaReady=false;media.removeAttribute('src');media.load();updateControls();
}

async function expandInputFiles(input){
  /* Same formats as before, but a realistic chart package can contain more than 512 files. */
  const queue=[...(input||[])],out=[],report=[];let guard=0;
  while(queue.length){
    if(++guard>4096)throw new Error('压缩包展开后超过 4096 个条目，已停止以避免异常包占用过多内存');
    const f=queue.shift();if(!f||!f.name)continue;
    if(/\.zip$/i.test(f.name)){const sub=await extractZip(f);report.push('zip 解包：'+f.name+'（'+sub.length+' 个文件）');queue.push(...sub)}
    else if(/\.7z$/i.test(f.name)){const sub=await extract7z(f);report.push('7z 解包：'+f.name+'（'+sub.length+' 个文件）');queue.push(...sub)}
    else if(MILCHT_RE.test(f.name)){const res=await extractMilcht(f);report.push('milcht 解包：'+f.name);report.push(...res.report);queue.push(...res.files)}
    else out.push(f);
  }
  return{files:out,report};
};

/* 判断源码是否值得交给 Beatmap.js 沙箱桥接。真实谱面可能是：
 *   1) 未打包：m.timing(...)/timing(...)/tap(...) 等直接调用；
 *   2) 已打包：`var m=MilizeBeatmap;`、`var L=MilizeBeatmap,ul=L.env,...`，
 *      以及把方法先解绑再保存（`u0=n0.timing` 后 `u0(...)`）的写法。
 * 这些打包写法里方法名是任意标识符，唯一稳定锚点是 `MilizeBeatmap` 本身。
 * 因此只要出现独立的 `MilizeBeatmap` 标识符，或常见 API 调用形态，就尝试桥接；
 * 沙箱解析失败后 parseText 仍会回退到 staticTjson，不会因误判而崩溃。 */
function __milLooksLikeBeatmapJs(source){
  const text=String(source||'');
  if(/\bMilizeBeatmap\b/.test(text))return true;
  return /\b(?:m)\s*\.\s*(?:timing|line|note|animation|storyboardObject|withProperty|withoutProperty|env)\s*\(/.test(text)
    ||/\b(?:timing|line|note|animation|storyboardObject|tap|fakeTap|exTap|drag|fakeDrag|hold|fakeHold|exHold|fracture|withProperty|withoutProperty|env)\s*\(/.test(text)
    ||/\b(?:p|t|n|X|s|a)\s*\(/.test(text);
}

async function parseText(text,name){
  const source=String(text||''),errors=[];
  try{let obj=JSON.parse(source);obj=normalizeMilthm(obj);obj=normalizeRwc(obj);const internal=obj&&typeof obj==='object'&&Array.isArray(obj.lines)&&(obj._milthm||obj._rwc||Array.isArray(obj.bpms)||Array.isArray(obj.animations)||Array.isArray(obj.storyboardObjects)||obj.lines.some(l=>Array.isArray(l?.notes)));if(internal)return{chart:obj,report:obj._milthm?'Milthm JSON 已按 FormatVersionCode 与规范语义归一化。':(obj._rwc?'RWC JSON 解析并按规范归一化成功。':'JSON 解析成功。')};errors.push('JSON 不是支持的谱面结构')}catch(e){errors.push('JSON：'+e.message)}
  const looksLikeBeatmapJs=__milLooksLikeBeatmapJs(source);
  if(!looksLikeBeatmapJs)throw new Error('文件不包含 Milthm JSON 结构或 Beatmap.js/TJSON 构造调用。\n'+errors.join('\n'));
  try{const chart=await milizeJsToJson(source);if(chart&&Array.isArray(chart.lines)&&(chart.lines.length||chart.bpms?.length||chart.animations?.length||chart.storyboardObjects?.length||Object.keys(chart.meta||{}).length))return{chart,report:'Beatmap.js 转 JSON 解析成功。'}}catch(e){errors.push('Beatmap.js：'+e.message)}
  try{const chart=staticTjson(source);return{chart,report:'TJSON 静态扫描解析成功。'}}catch(e){errors.push('TJSON：'+e.message)}
  throw new Error('无法解析或转换该文件。\n'+errors.join('\n'));
};

async function __milFindParseableCharts(files){
  const candidates=(files||[]).filter(f=>f&&__milIsChartName(f.name)&&!/\.jsonl$/i.test(f.name)).sort((a,b)=>__milChartPriority(b)-__milChartPriority(a)||String(a.name).localeCompare(String(b.name),'en'));
  const matches=[],failures=[];
  for(const f of candidates){try{matches.push({file:f,parsed:await parseText(await f.text(),f.name)})}catch(e){failures.push(f.name+': '+String(e?.message||e).split('\n')[0])}}
  return{matches,failures};
}
function __milChooseChart(matches){
  if(matches.length<=1)return Promise.resolve(matches[0]||null);
  return new Promise(resolve=>{
    const d=document.createElement('dialog');d.style.cssText='max-width:min(620px,92vw);background:#151515;color:#eee;border:1px solid #555;border-radius:14px;padding:20px;box-shadow:0 20px 80px #000b';
    const title=document.createElement('h3');title.textContent='压缩包包含多个可用谱面';title.style.margin='0 0 12px';
    const desc=document.createElement('p');desc.textContent='请选择要渲染的谱面。播放器不会静默猜测，以免显示错误难度或版本。';desc.style.cssText='color:#bbb;line-height:1.5';
    const sel=document.createElement('select');sel.style.cssText='width:100%;padding:10px;background:#222;color:#fff;border:1px solid #555;border-radius:8px';
    matches.forEach((m,i)=>{const o=document.createElement('option'),meta=m.parsed?.chart?.meta||{};o.value=String(i);o.textContent=[m.file.name,meta.Title,meta.Difficulty].filter(Boolean).join(' — ');sel.appendChild(o)});
    const row=document.createElement('div');row.style.cssText='display:flex;justify-content:flex-end;gap:10px;margin-top:16px';
    const cancel=document.createElement('button');cancel.textContent='取消';const use=document.createElement('button');use.textContent='载入所选谱面';use.className='primary';row.append(cancel,use);d.append(title,desc,sel,row);document.body.appendChild(d);
    const finish=v=>{try{d.close()}catch{}d.remove();resolve(v)};cancel.onclick=()=>finish(null);use.onclick=()=>finish(matches[Number(sel.value)||0]);d.addEventListener('cancel',e=>{e.preventDefault();finish(null)},{once:true});d.showModal();
  });
}
async function __milFindParseableChart(files){const scan=await __milFindParseableCharts(files),picked=await __milChooseChart(scan.matches);return{file:picked?.file||null,parsed:picked?.parsed||null,failures:scan.failures,matches:scan.matches}}

async function __milPersistReferencedAssets(chart,chartName,bgFile,mediaFile){
  const refs=[];if(bgFile)refs.push(bgFile);if(mediaFile)refs.push(mediaFile);
  for(const sb of chart?.storyboardObjects||chart?.storyboards||[]){if(int(sb?.type,0)===0){const f=__milResolveAssetFile(sb.data);if(f)refs.push(f)}}
  const unique=[...new Map(refs.map(f=>[__milNormalizePath(f.name),f])).values()];
  try{await idbSet(__MIL_ASSET_SAVE_KEY,{chartName:String(chartName||''),files:unique,bgPath:bgFile?__milNormalizePath(bgFile.name):'',mediaPath:mediaFile?__milNormalizePath(mediaFile.name):'',savedAt:Date.now()})}catch(e){console.warn('谱面资源未写入本地恢复缓存',e)}
}

/* Strict validation prevents malformed canonical JSON from being silently coerced into a
 * different picture.  AP remains the documented exception: a non-boolean AP parses false. */
const __milNormalizeBeforeFullReview = normalizeMilthm;
function __milValidateTimestamp(stamp,label,bpmScope,bpmCount){
  if(stamp==null)return;
  if(!Array.isArray(stamp)||(stamp.length!==3&&stamp.length!==4))throw new Error(label+' 必须是 3 或 4 项时间戳');
  for(let i=0;i<stamp.length;i++)if(!Number.isInteger(stamp[i]))throw new Error(label+' 的各项必须是整数');
  if(stamp[2]<=0)throw new Error(label+' division 必须大于 0');
  if(bpmScope<0){if(stamp.length!==4)throw new Error(label+' 在 BPM<0 时必须包含本地 bpmId');if(stamp[3]<0||stamp[3]>=bpmCount)throw new Error(label+' 引用了不存在的本地 BPM id')}
}
function __milValidateCanonicalRaw(raw){
  const v=raw.FormatVersionCode;
  if(!Number.isInteger(v)||v<0||v>9)throw new Error('不支持的 FormatVersionCode：'+v+'；当前文档定义范围为 0–9');
  if(!Array.isArray(raw.BPMList))throw new Error('BPMList 必须是数组');
  raw.BPMList.forEach((b,i)=>{if(!Number.isFinite(Number(b?.Start))||!Number.isFinite(Number(b?.BPM))||Math.abs(Number(b.BPM))<1e-12)throw new Error('BPMList['+i+'] 的 Start/BPM 无效');if(b.BeatsPerBar!=null&&(!Number.isInteger(b.BeatsPerBar)||b.BeatsPerBar<1))throw new Error('BPMList['+i+'].BeatsPerBar 必须为正整数')});
  const lc=raw.LineCount??(Array.isArray(raw.LineList)?raw.LineList.length:undefined);if(!Number.isInteger(lc)||lc<0||lc>1e6)throw new Error('LineCount/LineList 无效（必须为 0–1000000 的整数）');
  if(!Array.isArray(raw.NoteList))throw new Error('NoteList 必须是数组');
  raw.NoteList.forEach((n,i)=>{
    if(!Number.isInteger(n?.Line)||n.Line<0||n.Line>=lc)throw new Error('NoteList['+i+'].Line 超出 LineCount');
    if(!Number.isInteger(n.BPM)||n.BPM< -1||n.BPM>=raw.BPMList.length)throw new Error('NoteList['+i+'].BPM 无效');
    __milValidateTimestamp(n.From,'NoteList['+i+'].From',n.BPM,raw.BPMList.length);__milValidateTimestamp(n.To,'NoteList['+i+'].To',n.BPM,raw.BPMList.length);
    if(n.From==null&&(n.FromTime==null||typeof n.FromTime==='boolean'||String(n.FromTime).trim()===''||!Number.isFinite(Number(n.FromTime))))throw new Error('NoteList['+i+'] 缺少 FromTime');if(n.To==null&&(n.ToTime==null||typeof n.ToTime==='boolean'||String(n.ToTime).trim()===''||!Number.isFinite(Number(n.ToTime))))throw new Error('NoteList['+i+'] 缺少 ToTime');
    if(!Number.isInteger(n.Type)||n.Type<0||n.Type>2)throw new Error('NoteList['+i+'].Type 必须为 0–2');if(typeof n.Fake!=='boolean')throw new Error('NoteList['+i+'].Fake 必须是布尔值');
  });
  const arr=Array.isArray(raw.AnimationList)?raw.AnimationList:(Array.isArray(raw.PerformanceList)?raw.PerformanceList:[]);if(raw.AnimationList!=null&&!Array.isArray(raw.AnimationList))throw new Error('AnimationList 必须是数组');if(raw.PerformanceList!=null&&!Array.isArray(raw.PerformanceList))throw new Error('PerformanceList 必须是数组');
  arr.forEach((a,i)=>{
    const bpm=a.BPM==null?0:a.BPM;if(!Number.isInteger(bpm)||bpm< -1||bpm>=raw.BPMList.length)throw new Error('Animation['+i+'].BPM 无效');
    __milValidateTimestamp(a.FromBeat,'Animation['+i+'].FromBeat',bpm,raw.BPMList.length);__milValidateTimestamp(a.ToBeat,'Animation['+i+'].ToBeat',bpm,raw.BPMList.length);
    if(a.FromBeat==null&&(a.FromTime==null||typeof a.FromTime==='boolean'||String(a.FromTime).trim()===''||!Number.isFinite(Number(a.FromTime))))throw new Error('Animation['+i+'] 缺少 FromTime');if(a.ToBeat==null&&(a.ToTime==null||typeof a.ToTime==='boolean'||String(a.ToTime).trim()===''||!Number.isFinite(Number(a.ToTime))))throw new Error('Animation['+i+'] 缺少 ToTime');
    for(const [k,lo,hi] of [['Data',0,2],['Key',0,23],['Press',0,15],['Ease',0,2]])if(!Number.isInteger(a[k])||a[k]<lo||a[k]>hi)throw new Error('Animation['+i+'].'+k+' 超出 '+lo+'–'+hi);
    if(!Number.isInteger(a.I1))throw new Error('Animation['+i+'].I1 必须是整数');const targetCounts=[lc,raw.NoteList.length,(raw.StoryBoardObjects||[]).length];if(a.I1<-1||(a.I1>=0&&a.I1>=targetCounts[a.Data]))throw new Error('Animation['+i+'].I1 引用了不存在的目标');if(typeof a.ValueExpression!=='boolean')throw new Error('Animation['+i+'].ValueExpression 必须是布尔值');if(typeof a.CustomEaseExpression!=='string')throw new Error('Animation['+i+'].CustomEaseExpression 必须是字符串');
    if(!['string','number'].includes(typeof a.FV)||!['string','number'].includes(typeof a.TV))throw new Error('Animation['+i+'] 的 FV/TV 必须是字符串或数字')
  });
  const sbs=raw.StoryBoardObjects;if(sbs!=null&&!Array.isArray(sbs))throw new Error('StoryBoardObjects 必须是数组或 null');
  (sbs||[]).forEach((s,i)=>{if(!Number.isInteger(s?.Type)||s.Type<0||s.Type>2)throw new Error('StoryBoardObjects['+i+'].Type 必须为 0–2');if(typeof s.Data!=='string')throw new Error('StoryBoardObjects['+i+'].Data 必须是字符串');if(s.Layer!=null&&(!Number.isInteger(s.Layer)||s.Layer<0||s.Layer>2))throw new Error('StoryBoardObjects['+i+'].Layer 必须为 0–2')});
}
normalizeMilthm = function(raw){
  const recognized=raw&&typeof raw==='object'&&Array.isArray(raw.BPMList)&&Array.isArray(raw.NoteList);
  if(recognized)__milValidateCanonicalRaw(raw);
  const out=__milNormalizeBeforeFullReview(raw);
  if(out?._milthm&&Number(raw.FormatVersionCode)>=7&&Math.abs(Number(raw.SongOffset||0))>1e-12)out._warnings=['FormatVersionCode >= 7 的非零 SongOffset 已按运行时兼容规则忽略'];
  if(out?._milthm&&Array.isArray(raw.LineList)){
    for(let i=0;i<Math.min(out.lines.length,raw.LineList.length);i++){
      const l=raw.LineList[i]||{},d={};
      if(Number.isFinite(Number(l.X)))d[POS_X]=Number(l.X);if(Number.isFinite(Number(l.Y)))d[POS_Y]=Number(l.Y);
      if(Number.isFinite(Number(l.Rotation)))d[ROTATION]=Number(l.Rotation);if(Number.isFinite(Number(l.FlowSpeed)))d[FLOW]=Number(l.FlowSpeed);
      out.lines[i]._legacyDefaults=d;
    }
  }
  return out;
};

/* Legacy v3 LineList X/Y/Rotation/FlowSpeed are initial line properties, not metadata. */
const __milMakeRuntimeBeforeFullReview = makeRuntime;
makeRuntime = function(chart,fileName='chart.json'){
  const rt=__milMakeRuntimeBeforeFullReview(chart,fileName);
  if(!chart.lines.some(line=>line._legacyDefaults&&Object.keys(line._legacyDefaults).length))return rt;
  const baseLineValue=rt.lineValue.bind(rt);
  rt.lineValue=function(li,key,sec){
    const custom=chart.lines?.[li]?._legacyDefaults?.[key];if(custom==null)return baseLineValue(li,key,sec);
    const tr=this.events.get(BEARER_LINE)?.get(li)?.get(key);return evalTrack(tr,sec,Number(custom),key);
  };
  precompute(rt);return rt;
};

/* Semantic note variants are selected purely by note type / AP / simultaneous flags. */
noteTextureKey = function(n){
  if(n.type===NOTE_FRACTURE)return 'fracture';
  if(n.type===NOTE_DRAG)return n.isMore?'drag_double':'drag';
  const effectiveEx=n.type===NOTE_HIT&&!n.isFake&&n.isAlwaysPerfect;
  return milNoteKey(n.type,effectiveEx,n.isMore,n.isHold);
};

function __milRectOutsideView(minX,minY,maxX,maxY,w,h){
  const scale=Number(state.viewScale)||1,px=Number(state.panX)||0,py=Number(state.panY)||0;
  const x1=px+minX*scale,x2=px+maxX*scale,y1=py+minY*scale,y2=py+maxY*scale;
  return Math.max(x1,x2)<0||Math.min(x1,x2)>w||Math.max(y1,y2)<0||Math.min(y1,y2)>h;
}
const __milScreenMapHitBeforeFullReview=screenMapHit;
screenMapHit=function(h){const out=__milScreenMapHitBeforeFullReview(h);if(Array.isArray(h?.polygon))out.polygon=h.polygon.map(p=>chartToScreen(p.x,p.y));return out};

var storyImage,drawStoryboardLayer,render;
restoreSaved = async function(){
  const saved=await readSaved();if(!saved||!saved.chart){setStatus('没有可恢复的编辑记录。','warn');return}
  const assets=await idbGet(__MIL_ASSET_SAVE_KEY);let report='已恢复上次编辑记录。';
  if(assets&&assets.chartName===saved.fileName&&Array.isArray(assets.files)&&assets.files.length){
    __milIndexPackageAssets(assets.files,assets.chartName||saved.fileName||'');
    const bg=assets.bgPath?__milResolveAssetFile(assets.bgPath,''):null,media=assets.mediaPath?__milResolveAssetFile(assets.mediaPath,''):null;
    if(bg){try{await setBackgroundFile(bg)}catch(e){__milClearBackground();report+='\n背景资源恢复失败：'+(e?.message||e)}}else __milClearBackground();if(media){try{await setMediaFile(media)}catch(e){__milClearMedia();report+='\n音频资源恢复失败：'+(e?.message||e)}}else __milClearMedia();
    report+='\n已恢复背景、音频与 Storyboard 本地资源。';
  }else{__milRevokePackageAssets();__milClearBackground();__milClearMedia();report+='\n未找到旧记录对应的资源缓存；外部图片/音频需要重新载入。'}
  state.currentTime=saved.currentTime||0;state.rate=saved.rate||1;prepare(saved.chart,saved.fileName||'restored.json',report);els.restoreBar?.classList.remove('show');
};
const __milClearSavedBeforeFullReview=clearSaved;
clearSaved = async function(){await __milClearSavedBeforeFullReview();await idbDel(__MIL_ASSET_SAVE_KEY);__milRevokePackageAssets()};

/* Full-scope browser self-test.  Pixel tests are run by the external verification script. */
window.__milthmFullRenderSelfTest = async function(){
  const failures=[],ok=(x,m)=>{if(!x)failures.push(m)},near=(a,b,e=1e-7)=>Math.abs(a-b)<=e;
  try{
    ok(__milNormalizePath('a/../b\\c.png')==='b/c.png','资源路径归一化错误');
    __milIndexPackageAssets([new File([new Uint8Array([1])],'image.png')],'main.milthm');ok(__milResolveAssetFile('https://example.invalid/image.png')===null,'远程 Storyboard URL 被错误替换为同名包内资源');
    let fakeInternal=false;try{await parseText('{\"lines\":[]}','manifest.json');fakeInternal=true}catch{}ok(!fakeInternal,'只有 lines[] 的普通 JSON 被误判为谱面');
    const legacy=normalizeMilthm({FormatVersionCode:3,BPMList:[{Start:0,BPM:120}],LineList:[{X:12,Y:34,Rotation:45,FlowSpeed:7}],NoteList:[],PerformanceList:[],StoryBoardObjects:[]}),lrt=makeRuntime(legacy);ok(near(lrt.lineValue(0,POS_X,0),12)&&near(lrt.lineValue(0,POS_Y,0),34)&&near(lrt.lineValue(0,ROTATION,0),45)&&near(lrt.lineValue(0,FLOW,0),7),'Legacy LineList 初始属性未应用');
    const ex={type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:true,isHold:false,note:{_hand:'r'}};ok(noteTextureKey(ex)==='extap_double','EX 双押 Tap 纹理错误');const exHold={type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:false,isHold:true,note:{_hand:'r'}};ok(noteTextureKey(exHold)==='exhold','EX Hold 纹理错误');
    const more={type:NOTE_HIT,isFake:false,isAlwaysPerfect:false,isMore:true,isHold:false,note:{_hand:'l'}};ok(noteTextureKey(more)==='tap_double','双押纹理被手序覆盖');
    const nonzeroOffset=normalizeMilthm({FormatVersionCode:9,SongOffset:1,BPMList:[{Start:0,BPM:120,BeatsPerBar:4}],LineCount:0,NoteList:[],AnimationList:[],StoryBoardObjects:[]});ok(near(nonzeroOffset.bpms[0].start,0)&&nonzeroOffset._warnings?.length,'v7+ 非零 SongOffset 未按兼容规则忽略并告警');
    let rejected=false;try{normalizeMilthm({FormatVersionCode:9,SongOffset:0,BPMList:[{Start:0,BPM:120,BeatsPerBar:4}],LineCount:1,NoteList:[{Line:0,BPM:0,From:[0,0,1],To:[0,0,1],Type:0,Fake:'false'}],AnimationList:[],StoryBoardObjects:[]})}catch{rejected=true}ok(rejected,'非法 Fake 字符串被静默转为 true');
    const zero=makeRuntime({bpms:[{start:0,bpm:120}],lines:[],animations:[],storyboardObjects:[]});ok(zero.lineCount===0,'LineCount=0 被错误创建为虚拟判定线');
    const onlyTiming=await parseText('m.timing(0,120,4)','timing-only.js');ok(onlyTiming.chart.bpms.length===1,'仅 timing 的有效 Beatmap.js 被拒绝');
    let badLine=false;try{normalizeMilthm({FormatVersionCode:9,SongOffset:0,BPMList:[{Start:0,BPM:120,BeatsPerBar:4}],LineCount:0,NoteList:[{Line:0,BPM:0,From:[0,0,1],To:[0,0,1],Type:0,Fake:false}],AnimationList:[],StoryBoardObjects:[]})}catch{badLine=true}ok(badLine,'越界 Note.Line 未被拒绝');
    ok(Number(state.audioDelay)===0,'默认音频偏移仍非 0');
  }catch(e){failures.push(e?.stack||String(e))}
  return{ok:failures.length===0,version:__MIL_FULL_REVIEW_VERSION,failures};
};
