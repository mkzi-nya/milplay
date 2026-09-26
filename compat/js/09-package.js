(() => {
  'use strict';

  /* ZIP package rules requested for Milthm packages. */
  function __pkgBase(name) {
    return __milBasename(String(name || ''));
  }
  function __pkgIsMeta(name) {
    return /^meta\.json$/i.test(__pkgBase(name));
  }
  function __pkgIsChart(name) {
    return /\.(?:js|mjs|cjs|json)$/i.test(String(name || '')) && !/\.jsonl$/i.test(String(name || '')) && !__pkgIsMeta(name);
  }
  let __pkgStoryboardPath = '';
  function __pkgIsStoryboardPath(name) {
    const p = __milNormalizePath(name);
    const root = __milNormalizePath(__pkgStoryboardPath),
      low = p.toLowerCase(),
      lowRoot = root.toLowerCase();
    return /(?:^|\/)(?:storyboard|storyboards)(?:\/|$)/i.test(p) || !!root && (low === lowRoot || low.indexOf(lowRoot + '/') === 0);
  }
  function __pkgIsAudio(name) {
    return /\.(?:ogg|oga|opus|mp3|mp2|mpeg|wav|wave|flac|m4a|aac|aif|aiff|caf|weba|mp4|webm|mov)$/i.test(String(name || ''));
  }
  function __pkgIsAudioFile(f) {
    return !!f && (String(f.type || '').toLowerCase().startsWith('audio/') || __pkgIsAudio(f.name));
  }
  function __pkgSorted(files) {
    return [...files].sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', {
      numeric: true,
      sensitivity: 'base'
    }));
  }
  function __pkgResolveStoryboardIn(files, ref) {
    const all = [...(files || [])].filter(f => f && __pkgIsStoryboardPath(f.name)),
      pool = all.filter(f => __milIsImageName(f.name));
    const base = __milBasename(ref),
      norm = __milNormalizePath(ref),
      baseLow = base.toLowerCase();
    const stem = x => __milBasename(x).replace(/\.meta$/i, '').replace(/\.(?:asset|png|jpe?g|avif|webp|gif|bmp|svg)$/i, '').toLowerCase();
    /* Exact referenced image wins. Non-image Unity references (e.g. foo.asset) are
       intentionally mapped to the image with the same stem; .asset/.meta blobs are
       never handed to <img>. */
    let m = pool.filter(f => __milNormalizePath(f.name) === norm);
    if (m.length) return {
      matched: true,
      file: m.length === 1 ? m[0] : null
    };
    m = pool.filter(f => __milBasename(f.name) === base);
    if (m.length === 1) return {
      matched: true,
      file: m[0]
    };
    if (m.length > 1) {
      const exact = m.filter(f => __milNormalizePath(f.name).endsWith('/' + norm));
      return {
        matched: true,
        file: exact.length === 1 ? exact[0] : null
      };
    }
    m = pool.filter(f => __milBasename(f.name).toLowerCase() === baseLow);
    if (m.length === 1) return {
      matched: true,
      file: m[0]
    };
    const targetStem = stem(base);
    m = pool.filter(f => stem(f.name) === targetStem);
    if (m.length === 1) return {
      matched: true,
      file: m[0]
    };
    if (m.length > 1) {
      const order = ['.png', '.avif', '.webp', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'];
      for (const ext of order) {
        const preferred = m.filter(f => String(f.name).toLowerCase().endsWith(ext));
        if (preferred.length) return {
          matched: true,
          file: preferred.length === 1 ? preferred[0] : null
        };
      }
    }
    /* A matching non-image resource means the basename exists, but is not drawable. */
    return {
      matched: all.some(f => stem(f.name) === targetStem),
      file: null
    };
  }
  function __pkgCurrentStoryboardFiles() {
    var _state$assetFiles;
    return [...(((_state$assetFiles = state.assetFiles) == null || _state$assetFiles.values == null ? void 0 : _state$assetFiles.values()) || [])].filter(f => f && __pkgIsStoryboardPath(f.name));
  }
  function __pkgCurrentHasStoryboardDir() {
    return __pkgCurrentStoryboardFiles().length > 0;
  }
  function __pkgResolveStoryboardFile(ref) {
    if (!ref) return null;
    /* If the current ZIP contains storyboard(s)/, that folder is authoritative: the
     * chart's reference is resolved by same basename there and nowhere else. */
    const currentFiles = __pkgCurrentStoryboardFiles();
    if (currentFiles.length) return __pkgResolveStoryboardIn(currentFiles, ref).file;
    const batches = typeof __milEnsureUploadedAssetBatches === 'function' ? __milEnsureUploadedAssetBatches() : [];
    for (let i = ((batches == null ? void 0 : batches.length) || 0) - 1; i >= 0; i--) {
      var _batches$i;
      const r = __pkgResolveStoryboardIn(((_batches$i = batches[i]) == null ? void 0 : _batches$i.files) || [], ref);
      if (r.matched) return r.file;
    }
    return null;
  }
  window.__milResolveStoryboardFile = __pkgResolveStoryboardFile;

  /* meta.json is metadata, never a chart candidate. JS remains ahead of JSON when both parse. */
  const __pkgFindChartsBase = __milFindParseableCharts;
  __milFindParseableCharts = async function (files) {
    const filtered = (files || []).filter(f => !__pkgIsMeta(f == null ? void 0 : f.name));
    const scan = await __pkgFindChartsBase(filtered);
    scan.matches.sort((a, b) => {
      var _a$file, _a$file2, _b$file, _b$file2, _a$file3, _b$file3;
      const aj = /\.(?:js|mjs|cjs)$/i.test(((_a$file = a.file) == null ? void 0 : _a$file.name) || '') ? 2 : /\.json$/i.test(((_a$file2 = a.file) == null ? void 0 : _a$file2.name) || '') ? 1 : 0,
        bj = /\.(?:js|mjs|cjs)$/i.test(((_b$file = b.file) == null ? void 0 : _b$file.name) || '') ? 2 : /\.json$/i.test(((_b$file2 = b.file) == null ? void 0 : _b$file2.name) || '') ? 1 : 0;
      return bj - aj || String(((_a$file3 = a.file) == null ? void 0 : _a$file3.name) || '').localeCompare(String(((_b$file3 = b.file) == null ? void 0 : _b$file3.name) || ''), 'en');
    });
    return scan;
  };
  function __pkgObjectUrl(file) {
    if (!file) return null;
    if (!(state.assetObjectUrls instanceof Map)) state.assetObjectUrls = new Map();
    const key = file;
    let u = state.assetObjectUrls.get(key);
    if (!u) {
      u = URL.createObjectURL(file);
      state.assetObjectUrls.set(key, u);
    }
    return u;
  }
  /* Storyboard references get a dedicated same-basename lookup inside storyboard(s)/ first. */
  const __pkgBuiltinStoryMap = {
    'builtin.tap': 'tap',
    'builtin.tap_double': 'tap_double',
    'builtin.extap': 'extap',
    'builtin.extap_double': 'extap_double'
  };
  const __pkgBuiltinStoryShapes = new Map();
  function __pkgBuiltinShape(kind) {
    let c = __pkgBuiltinStoryShapes.get(kind);
    if (c) return c;
    c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (kind === 'builtin.line') {
      c.width = 512;
      c.height = 4;
      g.fillStyle = '#fff';
      g.fillRect(0, 1, 512, 2);
    } else {
      c.width = 300;
      c.height = 300;
      g.fillStyle = '#fff';
      g.beginPath();
      if (kind === 'builtin.round_rect' && g.roundRect) g.roundRect(0, 0, 300, 300, 36);else g.rect(0, 0, 300, 300);
      g.fill();
    }
    __pkgBuiltinStoryShapes.set(kind, c);
    return c;
  }
  function __pkgStoryDrawableReady(d) {
    return !!d && (d instanceof HTMLCanvasElement || d.complete && d.naturalWidth > 0);
  }
  // 所有加载覆盖共用预算；不按触屏或谱面复杂度降低画质，也不随 DPR 反复解码。
  function __pkgStorySampleSize(w, h) {
    if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) return null;
    const low = !!(window.__milIsLowMemoryMode != null && window.__milIsLowMemoryMode()),
      maxSide = low ? 1280 : 2560,
      maxPixels = low ? 1048576 : 4147200;
    const k = Math.min(1, maxSide / Math.max(w, h), Math.sqrt(maxPixels / (w * h)));
    return {
      width: Math.max(1, Math.floor(w * k)),
      height: Math.max(1, Math.floor(h * k))
    };
  }
  window.__milStoryboardSampleSize = __pkgStorySampleSize;
  window.__milSampleStoryboard = function (img) {
    const w = img.naturalWidth || img.width,
      h = img.naturalHeight || img.height,
      size = __pkgStorySampleSize(w, h);
    if (!size || size.width === w && size.height === h) return img;
    const c = document.createElement('canvas');
    c.width = size.width;
    c.height = size.height;
    const g = c.getContext('2d', {
      alpha: true
    });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  storyImage = function (data) {
    data = String(data || '');
    if (!data || data.startsWith('@i18n:')) return null;
    if (data === 'builtin.rect' || data === 'builtin.round_rect' || data === 'builtin.line') return __pkgBuiltinShape(data);
    const builtinKey = __pkgBuiltinStoryMap[data];
    if (builtinKey) {
      const bi = imgFor(builtinKey);
      return bi && bi.complete && bi.naturalWidth ? bi : null;
    }
    let rec = storyCache.get(data);
    if (rec) {
      const d = rec.drawable || rec.img;
      return __pkgStoryDrawableReady(d) ? d : null;
    }
    const img = new Image();
    img.decoding = 'async';
    rec = {
      img,
      drawable: null,
      failed: false,
      source: '',
      sourceWidth: 0,
      sourceHeight: 0
    };
    img.onload = () => {
      if (storyCache.get(data) !== rec) return;
      rec.sourceWidth = img.naturalWidth;
      rec.sourceHeight = img.naturalHeight;
      rec.drawable = window.__milSampleStoryboard(img);
      if (rec.drawable !== img) rec.img = null;
      render();
    };
    img.onerror = () => {
      rec.failed = true;
    };
    const sf = __pkgResolveStoryboardFile(data),
      resolved = sf ? __pkgObjectUrl(sf) : __pkgCurrentHasStoryboardDir() ? null : __milAssetUrl(data);
    let src = resolved || data;
    if (!/^data:|^blob:|^https?:|^\.\//i.test(src) && !src.includes('/')) src = './' + src;
    rec.source = src;
    storyCache.set(data, rec);
    if (window.__milIsLowMemoryMode != null && window.__milIsLowMemoryMode() && storyCache.size > 16) {
      const oldest = storyCache.keys().next().value;
      if (oldest !== data) storyCache.delete(oldest);
    }
    img.src = src;
    return null;
  };

  /* Persist the storyboard assets selected through the dedicated folder resolver too. */
  __milPersistReferencedAssets = async function (chart, chartName, bgFile, mediaFile) {
    const refs = [];
    if (bgFile) refs.push(bgFile);
    if (mediaFile) refs.push(mediaFile);
    for (const sb of (chart == null ? void 0 : chart.storyboardObjects) || (chart == null ? void 0 : chart.storyboards) || []) {
      if (int(sb == null ? void 0 : sb.type, 0) === 0) {
        const f = __pkgResolveStoryboardFile(sb.data) || (!__pkgCurrentHasStoryboardDir() ? __milResolveAssetFile(sb.data) : null);
        if (f) refs.push(f);
      }
    }
    const unique = [...new Map(refs.map(f => [__milNormalizePath(f.name), f])).values()];
    try {
      await idbSet(__MIL_ASSET_SAVE_KEY, {
        chartName: String(chartName || ''),
        files: unique,
        bgPath: bgFile ? __milNormalizePath(bgFile.name) : '',
        mediaPath: mediaFile ? __milNormalizePath(mediaFile.name) : '',
        savedAt: Date.now()
      });
    } catch (e) {
      console.warn('谱面资源未写入本地恢复缓存', e);
    }
  };
  function __pkgResolveCurrentAsset(ref) {
    if (!ref) return null;
    try {
      if (typeof __milResolveAssetFileBeforeUploadedLibrary === 'function') return __milResolveAssetFileBeforeUploadedLibrary(ref, state.assetBaseDir || '');
    } catch {}
    return null;
  }
  function __pkgPickBackground(files, ref) {
    /* Unity packages often leave IllustrationFile empty while the player still uses the
       package's cover (Algebra is one such chart). Resolve a non-empty reference first,
       then use the same deterministic cover/background candidate fallback for both empty
       and absent metadata; authored black/storyboard masks decide cinematic darkening. */
    if (ref != null && String(ref).trim()) {
      const f = __pkgResolveCurrentAsset(ref);
      if (f) return f;
    }
    const all = __pkgSorted((files || []).filter(f => __milIsImageName(f.name))),
      outside = all.filter(f => !__pkgIsStoryboardPath(f.name));
    const pool = outside.length ? outside : all;
    return pool.find(f => /(?:^|[-_. ])(?:illustration|background|cover|bg)(?:[-_. ]|$)/i.test(__pkgBase(f.name))) || pool[0] || null;
  }
  function __pkgPickAudio(files, ref) {
    if (ref) {
      const f = __pkgResolveCurrentAsset(ref);
      if (f) return f;
    }
    const pool = __pkgSorted((files || []).filter(__pkgIsAudioFile));
    return pool.find(f => /(?:^|[-_. ])(?:audio|music|song|bgm)(?:[-_. ]|$)/i.test(__pkgBase(f.name))) || pool[0] || null;
  }
  function __pkgStoryboardMissing(chart) {
    const out = [],
      strict = __pkgCurrentHasStoryboardDir();
    for (const sb of (chart == null ? void 0 : chart.storyboardObjects) || (chart == null ? void 0 : chart.storyboards) || []) {
      if (int(sb == null ? void 0 : sb.type, 0) !== 0 || !(sb != null && sb.data) || /^data:|^blob:|^https?:|^builtin\./i.test(sb.data)) continue;
      if (!__pkgResolveStoryboardFile(sb.data) && (strict || !__milResolveAssetFile(sb.data))) out.push(sb.data);
    }
    return [...new Set(out)];
  }

  const __MILPLAY_META_KEY='mkzi-nya.github.io/milplay/';
  const __pkgMetaAliases={
    title:['谱面名称','chartname','songname','title','name'],illustrator:['画师','illustrator','illustratorname'],composer:['曲师','composer','musicartist','artist'],charter:['谱师','charter','beatmapper'],
    difficultyName:['难度等级名称','difficultylevelname','difficultyname','difficulty_name','levelname','rank','difficulty'],difficultyLevel:['难度等级','difficultylevel','difficulty_level','level','rating','constant'],delay:['谱面延迟','chartdelay','chart_delay','delay','offset'],
    chart:['chartpath','chartpaths','chart path','谱面路径','chart','charts'],music:['musicpath','musicpaths','music path','audiopath','audiopaths','audio path','音乐路径','音频路径','music','audio'],image:['imagepath','imagepaths','image path','picturepath','picturepaths','图片路径','illustrationpath','illustrationpaths','image','images','picture','illustration'],storyboard:['storyboardpath','storyboard path','故事板路径','storyboard']
  };
  function __pkgMetaKey(name){return String(name||'').toLowerCase().replace(/[\s_.-]+/g,'')}
  function __pkgMetaField(record,kind){
    if(!record||typeof record!=='object')return undefined;
    const aliases=__pkgMetaAliases[kind].map(__pkgMetaKey);
    for(const key of Object.keys(record))if(aliases.includes(__pkgMetaKey(key)))return record[key];
    return undefined;
  }
  function __pkgMetaValues(value){
    if(value==null)return[];
    if(Array.isArray(value)){const out=[];for(const item of value)out.push(...__pkgMetaValues(item));return out}
    if(typeof value==='object'){
      for(const key of ['path','file','value','路径','文件'])if(Object.prototype.hasOwnProperty.call(value,key))return __pkgMetaValues(value[key]);
      return Object.keys(value).reduce((out,key)=>out.concat(__pkgMetaValues(value[key])),[]);
    }
    const text=String(value).trim();return text?[text]:[];
  }
  function __pkgMetaValue(record,kind){const values=__pkgMetaValues(__pkgMetaField(record,kind));return values.length?values[0]:null}
  function __pkgIsObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
  async function __pkgReadMilplayMeta(files){
    const candidates=__pkgSorted((files||[]).filter(f=>f&&__pkgIsMeta(f.name)));
    for(const file of candidates){
      let parsed;try{parsed=JSON.parse(await file.text())}catch{continue}
      if(!__pkgIsObject(parsed)||!Object.prototype.hasOwnProperty.call(parsed,__MILPLAY_META_KEY))continue;
      const version=parsed[__MILPLAY_META_KEY];if(!(typeof version==='string'&&version.trim()||typeof version==='number'&&Number.isFinite(version)))continue;
      const entries=Object.keys(parsed).filter(key=>key!==__MILPLAY_META_KEY).map(key=>({id:key,data:parsed[key]})).filter(entry=>__pkgIsObject(entry.data)&&__pkgMetaValue(entry.data,'chart')!=null).map(entry=>({id:entry.id,data:entry.data,chartPath:__pkgMetaValue(entry.data,'chart')}));
      return{recognized:true,valid:entries.length>0,file,entries};
    }
    return{recognized:false,valid:false};
  }
  let __pkgActiveMetaPackage=null;
  function __pkgMetaOptionLabel(record){const m=record.displayMeta,diff=[m.difficultyName,m.difficultyLevel].filter(x=>x!=null&&String(x).trim()).join(' ');return[diff,m.title,record.chartFile.name].filter(Boolean).join(' — ')}
  function __pkgSetMetaChooser(records){
    const wrap=id('packageChartChooser'),select=id('packageChartSelect');if(!wrap||!select)return;
    while(select.firstChild)select.removeChild(select.firstChild);(records||[]).forEach((record,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=__pkgMetaOptionLabel(record);select.appendChild(option)});
    wrap.hidden=!(records&&records.length>1);select.disabled=!records||records.length<2;
  }
  async function __pkgParseMilplayRecords(files,metaPackage,report){
    __pkgStoryboardPath='';__milIndexPackageAssets(files,'');const records=[];
    for(let index=0;index<metaPackage.entries.length;index++){
      const entry=metaPackage.entries[index],path=entry.chartPath,chartFile=__milResolveAssetFile(path,'');
      if(!chartFile){report.push('警告：meta.json 指定的谱面文件未找到：'+path);continue}
      try{
        const parsed=await parseText(await chartFile.text(),chartFile.name),chartMeta=parsed.chart&&parsed.chart.meta||{};
        const textValue=(kind,fallback)=>{const v=__pkgMetaValue(entry.data,kind);return v==null||v===''?fallback:String(v)};
        const delayValue=__pkgMetaValue(entry.data,'delay'),delay=delayValue==null?0:Number(delayValue);
        const displayMeta={title:textValue('title',chartMeta.Title||chartMeta.name||chartFile.name),illustrator:textValue('illustrator',''),composer:textValue('composer',chartMeta.Composer||chartMeta.music_artist||''),charter:textValue('charter',chartMeta.Beatmapper||''),difficultyName:textValue('difficultyName',chartMeta.Difficulty||chartMeta.difficulty_name||''),difficultyLevel:__pkgMetaValue(entry.data,'difficultyLevel')||null};
        const imageRef=__pkgMetaValue(entry.data,'image')||null,musicRef=__pkgMetaValue(entry.data,'music')||null,storyboardPath=__pkgMetaValue(entry.data,'storyboard')||'';
        const chartImageRef=chartMeta.IllustrationFile||chartMeta.illustrationFile||chartMeta.background||null,chartMusicRef=chartMeta.AudioFile||chartMeta.audioFile||chartMeta.music||null;
        records.push({id:entry.id,index,path,chartFile,chart:parsed.chart,parseReport:parsed.report,displayMeta,delay:Number.isFinite(delay)?delay:0,imageRef,musicRef,storyboardPath,chartImageRef,chartMusicRef});
      }catch(error){report.push('警告：meta.json 指定的谱面无法解析：'+path+'（'+String(error&&error.message||error).split('\n')[0]+'）')}
    }
    return records;
  }
  async function __pkgApplyMetaRecord(record){
    const pack=__pkgActiveMetaPackage;if(!pack||!record)return;
    setPlaying(false);state.currentTime=0;state.externalChartMeta=record.displayMeta;
    __pkgStoryboardPath=record.storyboardPath||'';
    __milIndexPackageAssets(pack.files,record.chartFile.name);
    const delay=Number(record.delay);state.audioDelay=Number.isFinite(delay)?delay:0;
    const imgFile=record.imageRef?(__milResolveAssetFile(record.imageRef,'')||__pkgPickBackground(pack.files,null)):__pkgPickBackground(pack.files,record.chartImageRef),mediaFile=record.musicRef?(__milResolveAssetFile(record.musicRef,'')||__pkgPickAudio(pack.files,null)):__pkgPickAudio(pack.files,record.chartMusicRef),report=[pack.baseReport,record.parseReport,'Milplay 专有格式：'+record.chartFile.name].filter(Boolean);
    if(record.storyboardPath)report.push('故事板路径：'+record.storyboardPath);
    if(record.imageRef&&!__milResolveAssetFile(record.imageRef,''))report.push('警告：图片路径未找到：'+record.imageRef+'；已使用包内图片候选');
    if(record.musicRef&&!__milResolveAssetFile(record.musicRef,''))report.push('警告：音乐路径未找到：'+record.musicRef+'；已使用包内音频候选');
    if(imgFile){try{await setBackgroundFile(imgFile);report.push('背景：'+imgFile.name)}catch(error){__milClearBackground();report.push('警告：背景解码失败：'+imgFile.name+'（'+(error&&error.message||error)+'）')}}else __milClearBackground();
    if(mediaFile){try{await setMediaFile(mediaFile);report.push('音乐：'+mediaFile.name)}catch(error){__milClearMedia();report.push('警告：音频解码失败：'+mediaFile.name+'（'+(error&&error.message||error)+'）')}}else __milClearMedia();
    const missing=__pkgStoryboardMissing(record.chart);if(missing.length)report.push('警告：缺少 Storyboard 图片：'+missing.join('、'));
    state.currentTime=0;prepare(record.chart,record.chartFile.name,report.join('\n'));
    if(typeof __milPersistReferencedAssets==='function')void __milPersistReferencedAssets(record.chart,record.chartFile.name,imgFile,mediaFile);
  }
  const __pkgChartSelect=id('packageChartSelect');
  if(__pkgChartSelect)__pkgChartSelect.addEventListener('change',event=>{
    const index=Number(event.target.value),records=__pkgActiveMetaPackage&&__pkgActiveMetaPackage.records,record=records&&records[index];if(!record)return;
    const pending=__pkgLoadQueue.then(()=>__pkgApplyMetaRecord(record));__pkgLoadQueue=pending.catch(error=>{setStatus('切换谱面失败：'+(error&&error.message||error),'err')});
  });

  /* Serialize uploads so asynchronous decodes cannot commit different packages together. */
  let __pkgLoadQueue = Promise.resolve();
  loadFiles = function (fileList) {
    const files = [...(fileList || [])];
    const pending = __pkgLoadQueue.then(() => __pkgLoadFiles(files));
    __pkgLoadQueue = pending.catch(() => {});
    return pending;
  };
  async function __pkgLoadFiles(fileList) {
    var _found$matches, _found$failures, _found$failures2;
    const input = [...(fileList || [])];
    if (!input.length) return;
    if (typeof __milResetParseLog === 'function') __milResetParseLog();
    setStatus('开始解析上传文件（共 ' + input.length + ' 个）…', 'warn');
    const expanded = await expandInputFiles(input);
    let files = expanded.files.filter(f => f && f.name && !String(f.name).endsWith('/')),
      report = [...expanded.report];
    const metaPackage = await __pkgReadMilplayMeta(files);
    if (metaPackage.recognized && metaPackage.valid) {
      const metaReport = [...report, 'meta.json：Milplay ' + String(metaPackage.file && metaPackage.file.name || '') + ' 格式'];
      const records = await __pkgParseMilplayRecords(files, metaPackage, metaReport);
      if (records.length) {
        if (typeof __milRegisterUploadedAssetBatch === 'function') __milRegisterUploadedAssetBatch(files);
        __pkgActiveMetaPackage = {
          records,
          files,
          baseReport: metaReport.join('\n')
        };
        __pkgSetMetaChooser(records);
        const select = id('packageChartSelect');
        if (select) select.value = '0';
        await __pkgApplyMetaRecord(records[0]);
        return;
      }
    }
    const found = await __milFindParseableChart(files),
      chartFile = found.file,
      parsed = found.parsed;
    if (!chartFile && (_found$matches = found.matches) != null && _found$matches.length) return;
    if (chartFile && parsed) {
      __pkgActiveMetaPackage = null;
      __pkgStoryboardPath = '';
      state.externalChartMeta = null;
      __pkgSetMetaChooser(null);
      makeRuntime(parsed.chart, chartFile.name);
    }
    const uploadedBatch = typeof __milRegisterUploadedAssetBatch === 'function' ? __milRegisterUploadedAssetBatch(files) : null;
    if (chartFile && parsed) {
      var _ref, _meta$IllustrationFil, _ref2, _meta$AudioFile;
      setPlaying(false);
      __milIndexPackageAssets(files, chartFile.name);
      const chart = parsed.chart,
        meta = (chart == null ? void 0 : chart.meta) || {};
      if (Array.isArray(chart == null ? void 0 : chart._warnings)) report.push(...chart._warnings.map(x => '警告：' + x));
      const illustrationRef = (_ref = (_meta$IllustrationFil = meta.IllustrationFile) != null ? _meta$IllustrationFil : meta.illustrationFile) != null ? _ref : meta.background,
        audioRef = (_ref2 = (_meta$AudioFile = meta.AudioFile) != null ? _meta$AudioFile : meta.audioFile) != null ? _ref2 : meta.music;
      const imgFile = __pkgPickBackground(files, illustrationRef),
        mediaFile = __pkgPickAudio(files, audioRef),
        sbFiles = files.filter(f => __pkgIsStoryboardPath(f.name));
      const hasRequestedShape = files.some(f => __pkgIsChart(f.name)) && !!imgFile && !!mediaFile && sbFiles.length > 0;
      if (hasRequestedShape) report.push('已按 Milthm ZIP 结构识别：谱面 / 背景 / 音频 / storyboard(s)');
      if (illustrationRef && !__milResolveAssetFile(illustrationRef)) report.push('警告：IllustrationFile 未找到：' + illustrationRef + '；已使用包内背景候选');
      if (audioRef && !__milResolveAssetFile(audioRef)) report.push('警告：AudioFile 未找到：' + audioRef + '；已使用包内音频候选');
      if (imgFile) {
        try {
          await setBackgroundFile(imgFile);
          report.push('背景：' + imgFile.name);
        } catch (e) {
          __milClearBackground();
          report.push('警告：背景解码失败：' + imgFile.name + '（' + ((e == null ? void 0 : e.message) || e) + '）');
        }
      } else __milClearBackground();
      if (mediaFile) {
        try {
          await setMediaFile(mediaFile);
          report.push('音乐：' + mediaFile.name);
        } catch (e) {
          __milClearMedia();
          report.push('警告：音频解码失败：' + mediaFile.name + '（' + ((e == null ? void 0 : e.message) || e) + '）');
        }
      } else __milClearMedia();
      const missing = __pkgStoryboardMissing(chart);
      if (missing.length) report.push('警告：缺少 Storyboard 图片：' + missing.join('、'));else if (sbFiles.length) report.push('Storyboard 目录：' + sbFiles.length + ' 个资源');
      state.currentTime = 0;
      prepare(chart, chartFile.name, [parsed.report, ...report].filter(Boolean).join('\n'));
      if (typeof __milPersistReferencedAssets === 'function') void __milPersistReferencedAssets(chart, chartFile.name, imgFile, mediaFile);
      return;
    }
    if (state.runtime && state.chart && uploadedBatch && typeof __milBatchSuppliesCurrentStoryboard === 'function' && __milBatchSuppliesCurrentStoryboard(uploadedBatch)) {
      storyCache.clear();
      render();
      setStatus([...report, '已将 Storyboard 资源加入当前谱面。'].filter(Boolean).join('\n'), 'ok');
      return;
    }
    __milIndexPackageAssets(files, '');
    const imgFile = __pkgPickBackground(files, null),
      mediaFile = __pkgPickAudio(files, null);
    if (imgFile) {
      try {
        await setBackgroundFile(imgFile);
        report.push('背景：' + imgFile.name);
      } catch (e) {
        __milClearBackground();
        report.push('警告：背景解码失败：' + imgFile.name);
      }
    } else __milClearBackground();
    if (mediaFile) {
      try {
        await setMediaFile(mediaFile);
        report.push('音乐：' + mediaFile.name);
      } catch (e) {
        __milClearMedia();
        report.push('警告：音频解码失败：' + mediaFile.name);
      }
    } else __milClearMedia();
    updateControls();
    render();
    const detail = (_found$failures = found.failures) != null && _found$failures.length ? '\n尝试过的候选文件：\n' + found.failures.join('\n') : '';
    setStatus((report.length ? report.join('\n') : '没有找到可用谱面。') + detail, (_found$failures2 = found.failures) != null && _found$failures2.length ? 'warn' : 'ok');
  }
  ;
})();
