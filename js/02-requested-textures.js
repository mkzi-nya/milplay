/* Requested texture/resource behavior patch — 2026-08-06. */
const __MIL_REQUESTED_PATCH_VERSION='2026-08-06-ex-normal-and-uploaded-story-assets-v1';

/* Every expanded user upload is retained as one session-local asset batch.  The
 * newest batch that contains an unambiguous exact same-name file wins.  This lets a
 * chart refer to "foo.png" while foo.png was uploaded separately before or after the
 * chart, without weakening package-path ambiguity checks. */
function __milEnsureUploadedAssetBatches(){
  if(!Array.isArray(state.uploadedAssetBatches))state.uploadedAssetBatches=[];
  return state.uploadedAssetBatches;
}
function __milRegisterUploadedAssetBatch(files){
  const batch=[...(files||[])].filter(f=>f&&f.name&&!String(f.name).endsWith('/'));
  if(!batch.length)return null;
  const rec={id:(state.uploadedAssetBatchSerial=(Number(state.uploadedAssetBatchSerial)||0)+1),files:batch,paths:new Map(),pathsLower:new Map(),names:new Map(),namesLower:new Map()};
  const add=(map,key,file)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(file)};
  for(const f of batch){
    const path=__milNormalizePath(f.name);if(!path)continue;
    add(rec.paths,path,f);add(rec.pathsLower,path.toLowerCase(),f);
    const name=__milBasename(path);add(rec.names,name,f);add(rec.namesLower,name.toLowerCase(),f);
  }
  const batches=__milEnsureUploadedAssetBatches();batches.push(rec);
  /* Bound session memory while preserving a useful upload history. */
  if(batches.length>64)batches.splice(0,batches.length-64);
  __milClearStoryCache();
  return rec;
}
function __milUniqueBatchMatch(map,key){const list=map?.get(key);return list&&list.length===1?list[0]:null}
function __milResolveUploadedAssetFile(ref,baseDir=state.assetBaseDir||''){
  if(!ref)return null;
  const raw=String(ref);if(/^[A-Za-z][A-Za-z0-9+.-]*:|^\/\//.test(raw))return null;
  const normalized=__milNormalizePath(raw),joined=__milJoin(baseDir,raw),base=__milBasename(normalized);
  const batches=__milEnsureUploadedAssetBatches();
  for(let i=batches.length-1;i>=0;i--){
    const b=batches[i];
    /* Exact path/name is authoritative and case-sensitive. A key that is ambiguous
     * *inside this batch* is skipped rather than aborting the whole lookup, so an
     * ambiguous newest batch falls through to an older batch with a unique match
     * (the documented "newest unambiguous match wins"); an arbitrary duplicate is
     * never returned. Within one batch the specificity order matches package
     * resolution: exact path -> exact basename -> case-insensitive path -> folded. */
    for(const key of [joined,normalized]){const f=__milUniqueBatchMatch(b.paths,key);if(f)return f}
    const exact=__milUniqueBatchMatch(b.names,base);if(exact)return exact;
    /* Case-insensitive fallback is accepted only when unique inside that batch. */
    for(const key of [joined.toLowerCase(),normalized.toLowerCase()]){const f=__milUniqueBatchMatch(b.pathsLower,key);if(f)return f}
    const folded=__milUniqueBatchMatch(b.namesLower,base.toLowerCase());if(folded)return folded;
  }
  return null;
}

const __milResolveAssetFileBeforeUploadedLibrary=__milResolveAssetFile;
__milResolveAssetFile = function(ref,baseDir=state.assetBaseDir||''){
  const packaged=__milResolveAssetFileBeforeUploadedLibrary(ref,baseDir);
  return packaged||__milResolveUploadedAssetFile(ref,baseDir);
};

/* Include file identity in the URL cache key, so re-uploading a newer same-name image
 * cannot accidentally keep rendering the previous Blob URL. */
__milAssetUrl = function(ref){
  const f=__milResolveAssetFile(ref);if(!f)return null;
  if(!(state.assetObjectUrls instanceof Map))state.assetObjectUrls=new Map();
  const key=f;
  let u=state.assetObjectUrls.get(key);if(!u){u=URL.createObjectURL(f);state.assetObjectUrls.set(key,u)}return u;
};

function __milBatchSuppliesCurrentStoryboard(batch){
  if(!batch||!state.chart)return false;
  const set=new Set(batch.files),objects=state.chart.storyboardObjects||state.chart.storyboards||[];
  for(const sb of objects){
    if(int(sb?.type,0)!==0||!sb?.data||/^data:|^blob:|^https?:/i.test(sb.data))continue;
    const f=__milResolveUploadedAssetFile(sb.data);if(f&&set.has(f))return true;
  }
  return false;
}

/* Extend the built-in self-test with the two requested behaviors. */
const __milFullSelfTestBeforeRequestedPatch=window.__milthmFullRenderSelfTest;
window.__milthmFullRenderSelfTest=async function(){
  const result=await __milFullSelfTestBeforeRequestedPatch(),failures=[...(result?.failures||[])],ok=(v,m)=>{if(!v)failures.push(m)};
  try{
    ok(noteTextureKey({type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:false,isHold:false,note:{_hand:'r'}})==='extap','EX Tap 纹理错误');
    ok(noteTextureKey({type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:false,isHold:true,note:{_hand:'l'}})==='exhold','EX Hold 纹理错误');
    const f=new File([new Uint8Array([1])],'uploaded/story-only.png',{type:'image/png'});__milRegisterUploadedAssetBatch([f]);
    ok(__milResolveUploadedAssetFile('story-only.png')===f,'已上传同名 Storyboard 文件未解析');
    /* An ambiguous newest batch must fall through to an older unique batch, while an
     * unambiguous path inside the newest batch still wins. */
    const older=new File([new Uint8Array([2])],'req-old/fallthrough.png',{type:'image/png'});__milRegisterUploadedAssetBatch([older]);
    const dupA=new File([new Uint8Array([3])],'req-new-a/fallthrough.png',{type:'image/png'}),dupB=new File([new Uint8Array([4])],'req-new-b/fallthrough.png',{type:'image/png'});__milRegisterUploadedAssetBatch([dupA,dupB]);
    ok(__milResolveUploadedAssetFile('fallthrough.png')===older,'歧义新批次未回退到更早的唯一批次（仍错误返回 null）');
    ok(__milResolveUploadedAssetFile('req-new-a/fallthrough.png')===dupA,'新批次内唯一路径未被解析');
  }catch(e){failures.push(e?.stack||String(e))}
  return{...result,ok:failures.length===0,requestedPatch:__MIL_REQUESTED_PATCH_VERSION,failures};
};
