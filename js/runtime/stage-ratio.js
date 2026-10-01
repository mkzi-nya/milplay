(()=>{
'use strict';
const a=document.getElementById('ratioLengthInput'),b=document.getElementById('ratioWidthInput'),wrap=els.stageWrap,inner=els.stageInner;
function number(v){const n=Number(v);return Number.isFinite(n)&&n>0&&n<=10000?n:null}
function ratio(x,y){x=number(x);y=number(y);return x&&y&&x/y>=.1&&x/y<=10?x/y:null}
function apply(){
  const r=ratio(a?.value,b?.value),custom=!!r;
  state.stageRatio=r||16/9;state.stageRatioCustom=custom;
  inner?.style?.setProperty?.('--mil-stage-ratio',String(state.stageRatio));
  wrap?.classList?.toggle?.('customStageRatio',custom);
  wrap?.classList?.toggle?.('portraitStageRatio',custom&&state.stageRatio<1);
  window.__milSyncLegacyFullscreenSize?.();
  a?.setCustomValidity?.(!custom&&(a.value||b?.value)?'请输入有效的长和宽':'');
  markStageResize();(window.requestAnimationFrame||setTimeout)(()=>{resizeCanvas();render();window.__milRefreshStageEnvironment?.()});
}
function change(){apply()}
a?.addEventListener('input',change);b?.addEventListener('input',change);
window.__milParseStageRatio=ratio;window.__milApplyStageRatio=apply;
apply();
})();
