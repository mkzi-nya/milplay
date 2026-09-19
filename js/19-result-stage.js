(()=>{
'use strict';
function mountResultInsidePlayfield(){
  const inner=(typeof els!=='undefined'&&els.stageInner)||document.getElementById('stageInner');
  const overlay=document.getElementById('gameResultOverlay');
  if(!inner||!overlay)return false;
  if(overlay.parentElement!==inner)inner.appendChild(overlay);
  return true;
}
if(!mountResultInsidePlayfield())queueMicrotask(mountResultInsidePlayfield);
/* Reassert after fullscreen/orientation changes in case older layout code reparents nodes. */
document.addEventListener('fullscreenchange',()=>requestAnimationFrame(mountResultInsidePlayfield));
document.addEventListener('webkitfullscreenchange',()=>requestAnimationFrame(mountResultInsidePlayfield));
window.addEventListener('orientationchange',()=>requestAnimationFrame(mountResultInsidePlayfield),{passive:true});
window.__gpMountResultInsidePlayfield=mountResultInsidePlayfield;
})();
