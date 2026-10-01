(()=>{
 'use strict';
 const toggle=els.lowMemoryToggle;
 function apply(value){
   state.lowMemory=!!value||!!state.__milConstrainedMemory;
   state.memoryBudgetBytes=(state.lowMemory||state.__milConstrainedMemory)?__MIL_LOW_MEMORY_BUDGET_BYTES:null;
   try{localStorage.setItem('mil-low-memory',state.lowMemory?'1':'0')}catch{}
   if(toggle)toggle.checked=state.lowMemory;
   document.body.classList.toggle('lowMemoryMode',state.lowMemory);
   window.__milResetEffectCaches?.();
   if(typeof __milClearStoryCache==='function')__milClearStoryCache();
   if(typeof markStageResize==='function')markStageResize();
   if(typeof resizeCanvas==='function')resizeCanvas();
   if(typeof render==='function')render();
 }
 window.__milIsLowMemoryMode=()=>!!state.lowMemory;
 window.__milMemoryBudgetBytes=()=>state.__milConstrainedMemory||state.lowMemory?__MIL_LOW_MEMORY_BUDGET_BYTES:null;
 window.__milSetLowMemoryMode=apply;
 if(toggle){toggle.checked=!!state.lowMemory;toggle.addEventListener('change',()=>apply(toggle.checked))}
})();
