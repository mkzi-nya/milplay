(()=>{
'use strict';
const btn=document.getElementById('exportVideoBtn');
const progress=document.getElementById('exportVideoProgress');
if(!btn)return;
let job=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function bestMime(){
  const list=[
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4'
  ];
  return list.find(x=>window.MediaRecorder&&MediaRecorder.isTypeSupported?.(x))||'';
}
function extFor(mime){return /mp4/i.test(mime)?'mp4':'webm'}
function downloadBlob(blob,name){
  const a=document.createElement('a'),url=URL.createObjectURL(blob);
  a.href=url;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500);
}
function setProgress(text){if(!progress)return;progress.hidden=!text;progress.textContent=text||''}
function waitRecorderStop(rec){return new Promise((resolve,reject)=>{rec.addEventListener('stop',resolve,{once:true});rec.addEventListener('error',e=>reject(e.error||new Error('视频编码失败')),{once:true})})}
async function exportVideo(){
  if(job){job.cancelled=true;btn.textContent='正在停止…';return}
  if(state?.appMode!=='play'){setStatus('请切换到游玩模式后导出视频。','warn');return}
  if(!state?.runtime){setStatus('请先加载谱面。','err');return}
  if(!HTMLCanvasElement.prototype.captureStream||!window.MediaRecorder){setStatus('当前浏览器不支持 Canvas 视频导出（需要 MediaRecorder + captureStream）。','err');return}
  const duration=Math.max(0.001,Number(state.duration||state.runtime.duration||0));
  if(!Number.isFinite(duration)||duration<=0){setStatus('谱面时长无效，无法导出视频。','err');return}

  const canvas=els.stage;
  const saved={
    time:state.currentTime,playing:state.playing,rate:state.rate,
    audioRate:els.audioPlayer.playbackRate,showHands:state.showHandTextures
  };
  job={cancelled:false};
  btn.classList.add('exporting');btn.textContent='取消导出';btn.disabled=false;
  setProgress('准备编码…');

  let recorder=null,stream=null;
  try{
    setPlaying(false);
    state.showHandTextures=true;
    state.rate=1;els.audioPlayer.playbackRate=1;
    seek(0);

    /* 直接录制当前播放 canvas 的原始 backing-store 尺寸。
       不重设 width/height，不做 720p/1080p 上限：当前窗口实际以什么分辨率渲染，
       导出就使用什么分辨率。Canvas 内的 COMBO / SCORE / ACC / 判定特效会被录入；
       DOM 控制按钮（暂停、全屏、导出按钮等）不会进入视频。 */
    render();
    const ew=canvas.width,eh=canvas.height;
    const fps=60;
    const canvasStream=canvas.captureStream(fps);
    const tracks=[...canvasStream.getVideoTracks()];
    const media=els.audioPlayer;
    const capture=media.captureStream||media.mozCaptureStream;
    if(state.mediaUrl&&state.mediaReady&&capture){
      try{const as=capture.call(media);for(const t of as.getAudioTracks())tracks.push(t)}catch(e){console.warn('[Milthm export] audio capture unavailable',e)}
    }
    stream=new MediaStream(tracks);
    const mime=bestMime();
    const pixels=ew*eh;
    /* 不设置人为的画质上限；码率随实际像素数增长。 */
    const vbr=Math.max(6_000_000,Math.round(pixels*12));
    recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:vbr,audioBitsPerSecond:192000});
    const chunks=[];
    recorder.addEventListener('dataavailable',e=>{if(e.data&&e.data.size)chunks.push(e.data)});
    recorder.start(2000); // larger chunks = less JS/GC overhead on long songs

    const started=performance.now();
    state.currentTime=0;state.lastTick=performance.now();
    setPlaying(true);
    while(!job.cancelled&&state.currentTime<duration-0.002){
      const pct=Math.min(100,Math.max(0,state.currentTime/duration*100));
      const elapsed=(performance.now()-started)/1000;
      const remain=Math.max(0,duration-state.currentTime);
      setProgress(`${pct.toFixed(1)}% · ${state.currentTime.toFixed(1)}/${duration.toFixed(1)}s · 约剩 ${remain.toFixed(0)}s`);
      await sleep(200);
    }
    setPlaying(false);
    if(recorder.state!=='inactive')recorder.stop();
    await waitRecorderStop(recorder);
    if(job.cancelled){setProgress('已取消');await sleep(500);return}
    setProgress('封装视频…');
    const actualMime=recorder.mimeType||mime||'video/webm';
    const blob=new Blob(chunks,{type:actualMime});
    if(!blob.size)throw new Error('导出结果为空');
    const base=safeName(String(state.fileName||'milthm').replace(/\.(json|txt|js|milcht)$/i,''));
    downloadBlob(blob,`${base}_playback.${extFor(actualMime)}`);
    setProgress(`完成 · ${(blob.size/1048576).toFixed(1)} MiB`);
    await sleep(1200);
  }catch(e){
    console.error('[Milthm export]',e);
    setStatus('视频导出失败：'+(e?.message||String(e)),'err');
  }finally{
    try{if(recorder&&recorder.state!=='inactive')recorder.stop()}catch{}
    try{stream?.getTracks().forEach(t=>t.stop())}catch{}
    state.rate=saved.rate;els.audioPlayer.playbackRate=saved.audioRate||saved.rate||1;
    state.showHandTextures=saved.showHands;
    state.currentTime=Math.min(saved.time,state.duration||saved.time);state.lastTick=performance.now();
    syncMediaToChart(true);render();updateControls();
    if(saved.playing)setPlaying(true);
    btn.classList.remove('exporting');btn.textContent='导出视频';btn.disabled=false;
    job=null;setTimeout(()=>setProgress(''),900);
  }
}
btn.addEventListener('click',exportVideo);
})();
