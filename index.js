import { isAuthorQaRequest, injectAuthorQaPrompt, initAuthorQa } from './modules/author-qa/index.js';

(() => {
'use strict';
const VERSION='1.0.1';
const BUILD='vvv-story-memory-suite-1.0.1-public-multi-account';

if(globalThis.__VVV_STORY_MEMORY_SUITE_INSTANCE__){
  console.warn('[VVV Story Memory Suite] duplicate load blocked',globalThis.__VVV_STORY_MEMORY_SUITE_INSTANCE__);
  return;
}
globalThis.__VVV_STORY_MEMORY_SUITE_INSTANCE__=BUILD;

// The standalone package intentionally reuses the original global bridge names because
// 0-32 and relay already depend on them. If the old 0-00 frontend is still active,
// do not start a second copy of the same state machine.
if(globalThis.__VVV_UNIFIED_CORE_INSTANCE__ || globalThis.vvvTheaterMemoryInterceptor){
  globalThis.__VVV_STORY_MEMORY_SUITE_BLOCKED_BY_LEGACY__=true;
  const showLegacyConflict=()=>{
    try{
      globalThis.toastr?.warning?.('Phát hiện VVV 0-00/0-32 bản cũ đang chạy. Để tránh ghi ký ức hai lần trong cùng một lượt, bản độc lập đã tạm dừng. Hãy tắt lõi cũ rồi tải lại trang.','VVV · Lõi Cốt Truyện & Ký Ức',{timeOut:0,extendedTimeOut:0,closeButton:true});
      const menu=document.getElementById('extensionsMenu');
      if(menu&&!document.getElementById('vvvsm-conflict-entry')){
        const row=document.createElement('div');row.id='vvvsm-conflict-entry';row.className='list-group-item flex-container flexGap5';
        row.innerHTML='<span>⚠️ VVV · Lõi Cốt Truyện & Ký Ức: phát hiện xung đột với lõi cũ, đã tạm dừng</span>';
        menu.appendChild(row);
      }
    }catch{}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showLegacyConflict,{once:true});else setTimeout(showLegacyConflict,0);
  console.warn('[VVV Story Memory Suite] legacy VVV core detected; standalone runtime paused to avoid duplicate memory writes.');
  return;
}

const runtime={account:'',booted:false,bootError:null,modules:{theater:false,relay:false,authorQa:false},startedAt:Date.now()};

function stContext(){
  try{
    if(globalThis.SillyTavern?.getContext)return globalThis.SillyTavern.getContext();
    if(globalThis.SillyTavern?.context)return globalThis.SillyTavern.context;
    if(globalThis.getContext)return globalThis.getContext();
  }catch{}
  return null;
}
function toast(msg,type='info'){
  const t=globalThis.toastr;
  if(t?.[type])t[type](msg,'VVV · Lõi Cốt Truyện & Ký Ức');
  else console.log('[VVV Story Memory Suite]',msg);
}
async function account(){
  try{
    const r=await fetch('/api/users/me',{credentials:'same-origin',cache:'no-store'});
    if(!r.ok)return '';
    const d=await r.json();
    return String(d?.handle||'').trim().toLowerCase();
  }catch{return '';}
}

// Shared SillyTavern event bus: keep exactly one native binding per event.
const eventHandlers=new Map();
const nativeEventBindings=new Map();
function bindNativeEvent(name){
  if(nativeEventBindings.has(name))return true;
  const c=stContext();
  const source=c?.eventSource;
  const types=c?.event_types||c?.eventTypes||globalThis.event_types||{};
  if(!source?.on)return false;
  const actual=types[name]||name;
  const dispatch=(...args)=>{
    const set=eventHandlers.get(name);if(!set?.size)return;
    for(const fn of [...set]){
      try{const out=fn(...args);if(out?.catch)out.catch(e=>console.error(`[VVV Story Memory] event ${name} failed`,e));}
      catch(e){console.error(`[VVV Story Memory] event ${name} failed`,e);}
    }
  };
  source.on(actual,dispatch);
  nativeEventBindings.set(name,{actual,dispatch});
  return true;
}
const events={
  on(name,handler){
    if(typeof handler!=='function')return()=>{};
    const key=String(name||'');if(!key)return()=>{};
    if(!eventHandlers.has(key))eventHandlers.set(key,new Set());
    eventHandlers.get(key).add(handler);
    if(!bindNativeEvent(key))setTimeout(()=>bindNativeEvent(key),250);
    return()=>eventHandlers.get(key)?.delete(handler);
  },
  emit(name,...args){for(const fn of [...(eventHandlers.get(String(name))||[])])try{fn(...args);}catch(e){console.error(e);}},
  bindPending(){for(const name of eventHandlers.keys())bindNativeEvent(name);},
  diagnostics(){return {channels:eventHandlers.size,nativeBindings:nativeEventBindings.size};},
};

// Shared serial task groups used by relay and 0-32.
const taskGroups=new Map();
const activeTasks=new Map();
const tasks={
  async run(name,fn,{group='state-write'}={}){
    const label=String(name||'task'),g=String(group||'state-write');
    const previous=taskGroups.get(g)||Promise.resolve();
    let release;const gate=new Promise(r=>release=r);
    const chain=previous.catch(()=>{}).then(()=>gate);taskGroups.set(g,chain);
    await previous.catch(()=>{});
    activeTasks.set(label,{name:label,group:g,startedAt:Date.now()});
    try{return await fn();}
    finally{activeTasks.delete(label);release();if(taskGroups.get(g)===chain)taskGroups.delete(g);}
  },
  isBusy(group=''){return group?[...activeTasks.values()].some(x=>x.group===group):activeTasks.size>0;},
  list(){return [...activeTasks.values()].map(x=>({...x,ageMs:Date.now()-x.startedAt}));},
};

const overlayRegistry=new Map();
function closeKnownOverlays(except=''){
  for(const [key,row] of overlayRegistry){if(key===except)continue;try{row.close?.();}catch{}}
  if(except!=='theater'){
    try{document.getElementById('vvvtm-modal')?.setAttribute('hidden','');}catch{}
    try{document.getElementById('vvvtm-role-phone')?.setAttribute('hidden','');}catch{}
  }
  if(except!=='relay')try{globalThis.VVVUnifiedRelay?.close?.();}catch{}
  if(except!=='author-qa')try{document.querySelector('.vvvsm-author-qa-dialog')?.remove();}catch{}
}
const overlays={
  register(key,api={}){overlayRegistry.set(String(key),api||{});},
  activate(key){closeKnownOverlays(String(key||''));},
  closeAll(){closeKnownOverlays('');},
  diagnostics(){return [...overlayRegistry.keys()];},
};

const viewportState={cleanup:null,last:null,baseHeight:0};
// Nhận diện thiết bị lúc chạy. Media query của CSS không đủ tin cậy trong
// WKWebView (app Tauri/SillyTavern trên iOS), nên ta tự xác định rồi gắn thuộc
// tính lên <html> để cả CSS lẫn JS cùng dựa vào một nguồn duy nhất:
//   data-vvvu-device="mobile" | "desktop"
//   data-vvvu-ios            (iPhone/iPad, kể cả iPad giả dạng máy tính)
//   data-vvvu-touch          (màn hình cảm ứng)
//   data-vvvu-keyboard       (bàn phím ảo đang mở)
// Kèm bốn biến --vvvu-vv-* bám theo visual viewport để lớp phủ co lại đúng bằng
// vùng còn nhìn thấy khi bàn phím hiện lên.
function detectDevice(){
  const mm=q=>{try{return Boolean(matchMedia?.(q)?.matches);}catch{return false;}};
  const ua=String(globalThis.navigator?.userAgent||'');
  const touchPoints=Number(globalThis.navigator?.maxTouchPoints||0);
  const coarse=mm('(pointer: coarse)');
  const noHover=mm('(hover: none)');
  const touch=coarse||touchPoints>0||'ontouchstart' in globalThis;
  // iPadOS báo userAgent giống macOS, phải xét thêm số điểm chạm.
  const ios=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&touchPoints>1);
  const shortSide=Math.min(
    Number(globalThis.innerWidth||0)||Number.POSITIVE_INFINITY,
    Number(globalThis.innerHeight||0)||Number.POSITIVE_INFINITY,
  );
  // Điện thoại/máy tính bảng: cảm ứng thật, hoặc cạnh ngắn hẹp như màn điện thoại.
  const mobile=(touch&&noHover)||(touch&&shortSide<=1024)||shortSide<=640;
  return {mobile,ios,touch,coarse,shortSide};
}

function syncVisualViewport(){
  const vv=globalThis.visualViewport;
  const device=detectDevice();
  const mobile=device.mobile;
  const width=Math.max(1,Math.round(vv?.width||globalThis.innerWidth||document.documentElement.clientWidth||1));
  const height=Math.max(1,Math.round(vv?.height||globalThis.innerHeight||document.documentElement.clientHeight||1));
  const left=Math.round(vv?.offsetLeft||0),top=Math.round(vv?.offsetTop||0);
  // Bàn phím ảo chiếm chỗ: vùng nhìn thấy thấp hơn hẳn chiều cao cửa sổ.
  const windowHeight=Math.max(1,Number(globalThis.innerHeight||height));
  const keyboard=mobile&&(windowHeight-height)>120;
  // Không co lớp phủ lại khi bàn phím bật lên. WebKit trên iOS huỷ luôn focus vừa
  // đặt nếu ô đang gõ bị dịch chuyển/đổi kích thước giữa lúc bàn phím trượt lên —
  // đó chính là cảnh bàn phím nháy một cái rồi tắt. Giữ nguyên chiều cao cũ và chỉ
  // báo ra chiều cao bàn phím để phần nội dung tự chừa chỗ cuộn.
  if(!keyboard)viewportState.baseHeight=height;
  const shellHeight=keyboard?(viewportState.baseHeight||windowHeight):height;
  const keyboardHeight=Math.max(0,shellHeight-height);
  const next={left,top,width,height,shellHeight,keyboardHeight,mobile:!!mobile,ios:device.ios,touch:device.touch,keyboard};
  const root=document.documentElement;
  root.style.setProperty('--vvvu-vv-left',`${left}px`);root.style.setProperty('--vvvu-vv-top',`${top}px`);
  root.style.setProperty('--vvvu-vv-width',`${width}px`);root.style.setProperty('--vvvu-vv-height',`${shellHeight}px`);
  root.style.setProperty('--vvvu-kb-height',`${keyboardHeight}px`);
  root.dataset.vvvuDevice=mobile?'mobile':'desktop';
  root.toggleAttribute('data-vvvu-mobile',!!mobile);
  root.toggleAttribute('data-vvvu-ios',!!device.ios);
  root.toggleAttribute('data-vvvu-touch',!!device.touch);
  root.toggleAttribute('data-vvvu-keyboard',!!keyboard);
  globalThis.VVVDevice=next;
  viewportState.last=next;return next;
}
function bindVisualViewport(){
  if(viewportState.cleanup)return;
  const vv=globalThis.visualViewport;let frame=0;
  const fn=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;syncVisualViewport();});};
  vv?.addEventListener('resize',fn,{passive:true});vv?.addEventListener('scroll',fn,{passive:true});
  globalThis.addEventListener('resize',fn,{passive:true});globalThis.addEventListener('orientationchange',fn,{passive:true});
  viewportState.cleanup=()=>{if(frame)cancelAnimationFrame(frame);vv?.removeEventListener('resize',fn);vv?.removeEventListener('scroll',fn);globalThis.removeEventListener('resize',fn);globalThis.removeEventListener('orientationchange',fn);};
  syncVisualViewport();
}
const viewport={sync:syncVisualViewport,bind:bindVisualViewport,diagnostics:()=>viewportState.last||{}};

globalThis.VVVUnifiedCore={version:VERSION,build:BUILD,runtime,events,tasks,overlays,viewport,toast};

function ensureSuiteLauncher(){
  const menu=document.getElementById('extensionsMenu');
  if(!menu||document.getElementById('vvvsm-suite-launcher'))return false;
  const box=document.createElement('div');
  box.id='vvvsm-suite-launcher';
  box.className='list-group-item flex-container flexFlowColumn';
  box.innerHTML=`<div style="font-weight:700;margin-bottom:6px">✒ VVV · Lõi Cốt Truyện & Ký Ức</div><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-vvvsm-open="memory">0-32</button><button type="button" data-vvvsm-open="relay">Thúc đẩy cốt truyện</button><button type="button" data-vvvsm-open="author">Hỏi tác giả</button><button type="button" data-vvvsm-open="hub">Memory Hub</button></div>`;
  box.addEventListener('click',e=>{
    const key=e.target?.closest?.('[data-vvvsm-open]')?.dataset?.vvvsmOpen;if(!key)return;
    if(key==='memory')globalThis.openVVVTheaterMemory?.();
    else if(key==='relay')globalThis.VVVUnifiedRelay?.open?.();
    else if(key==='author')globalThis.VVVStoryMemoryAuthorQa?.open?.();
    else if(key==='hub')window.open(new URL('./memory-hub/index.html', import.meta.url).href,'_blank','noopener');
  });
  menu.appendChild(box);return true;
}

async function safeImport(path,label){
  try{const mod=await import(new URL(path,import.meta.url).href+`?u=${encodeURIComponent(BUILD)}`);runtime.modules[label]=true;return mod||true;}
  catch(e){runtime.bootError=e;console.error(`[VVV Story Memory] ${label} load failed`,e);toast(`Không tải được mô-đun ${label}: ${e.message}`,'error');return false;}
}

const bootPromise=(async()=>{
  runtime.account=await account();
  if(!runtime.account){
    console.warn('[VVV Story Memory Suite] unable to resolve current SillyTavern account; continuing in frontend-only mode until account becomes available.');
  }
  viewport.bind();
  await safeImport('./modules/theater/index.js','theater');
  for(let i=0;i<120&&!globalThis.VVVUnifiedRelay;i++)await new Promise(r=>setTimeout(r,50));
  runtime.modules.relay=!!globalThis.VVVUnifiedRelay;
  try{await initAuthorQa({events,overlays,toast,getContext:stContext});runtime.modules.authorQa=true;}catch(e){console.error('[VVV Story Memory] author QA init failed',e);}
  events.bindPending();runtime.booted=true;
  ensureSuiteLauncher();setTimeout(ensureSuiteLauncher,500);setTimeout(ensureSuiteLauncher,1500);
  try{new MutationObserver(()=>ensureSuiteLauncher()).observe(document.documentElement,{subtree:true,childList:true});}catch{}
  console.info('[VVV Story Memory Suite] ready',JSON.parse(JSON.stringify(runtime)));
})();

// Single interceptor entry. Author QA only changes the one marked round; 0-32 keeps
// its original interception for all normal rounds.
globalThis.vvvStoryMemoryInterceptor=async function(chat,contextSize,abort,type){
  await bootPromise;if(!Array.isArray(chat))return;
  try{if(isAuthorQaRequest(chat))injectAuthorQaPrompt(chat);}catch(e){console.error('[VVV Story Memory] author QA interceptor failed',e);}
  try{if(typeof globalThis.vvvTheaterMemoryInterceptor==='function')await globalThis.vvvTheaterMemoryInterceptor(chat,contextSize,abort,type);}catch(e){console.error('[VVV Story Memory] theater interceptor failed',e);}
};

globalThis.VVVStoryMemorySuite={version:VERSION,build:BUILD,runtime,boot:()=>bootPromise,openMemory:()=>globalThis.openVVVTheaterMemory?.(),openRelay:()=>globalThis.VVVUnifiedRelay?.open?.(),openAuthorQa:()=>globalThis.VVVStoryMemoryAuthorQa?.open?.()};
})();
