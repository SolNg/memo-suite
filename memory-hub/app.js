const API='/api/plugins/vvv-theater-memory-server';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={archives:[],selected:null,data:null,tab:'overview',results:[],deleteRefs:new Map(),deleteSeq:0,archiveSelections:new Set(),csrfToken:''};

async function get(path){
  const r=await fetch(`${API}${path}`,{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok===false)throw new Error(j.error||`HTTP ${r.status}`);
  return j;
}
function headerHas(headers,name){return Object.keys(headers||{}).some(k=>k.toLowerCase()===String(name||'').toLowerCase())}
function extractHtmlError(text=''){
  const raw=String(text||'');
  const pre=raw.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1]||'';
  const strip=v=>String(v||'').replace(/<[^>]+>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  return strip(pre)||strip(raw).slice(0,500);
}
function externalRequestHeaders(){
  const roots=[];
  try{if(window.opener&&window.opener!==window)roots.push(window.opener)}catch{}
  try{if(window.parent&&window.parent!==window)roots.push(window.parent)}catch{}
  roots.push(window);
  for(const root of roots){
    try{
      const ctx=root?.SillyTavern?.getContext?.()||root?.SillyTavern?.context||null;
      const fn=ctx?.getRequestHeaders||root?.getRequestHeaders;
      if(typeof fn==='function')return {...fn.call(ctx||root)};
    }catch{}
  }
  return {};
}
async function requestMutationHeaders(forceFresh=false){
  let headers={'Content-Type':'application/json','Accept':'application/json'};
  const external=externalRequestHeaders();
  if(Object.keys(external).length)headers={...external,...headers};
  if(!forceFresh&&!headerHas(headers,'X-CSRF-Token')&&!headerHas(headers,'X-CSRF-TOKEN')){
    try{
      const mod=await import('/script.js');
      if(typeof mod.getRequestHeaders==='function')headers={...mod.getRequestHeaders(),...headers};
    }catch{}
  }
  // Memory Hub can be opened as a standalone same-origin page. In that case it
  // has no SillyTavern JS context, so fetch a token bound to the current session
  // directly from SillyTavern instead of submitting a stale/empty header.
  if(forceFresh||(!headerHas(headers,'X-CSRF-Token')&&!headerHas(headers,'X-CSRF-TOKEN'))){
    const csrf=await fetch('/csrf-token',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    const data=await csrf.json().catch(()=>({}));
    if(!csrf.ok||!data?.token)throw new Error(data?.error||`Không làm mới được CSRF token (HTTP ${csrf.status})`);
    state.csrfToken=String(data.token);
    headers['X-CSRF-Token']=state.csrfToken;
  }
  return headers;
}
async function mutationAttempt(path,method,body,forceFresh=false){
  const headers=await requestMutationHeaders(forceFresh);
  const r=await fetch(`${API}${path}`,{method,credentials:'same-origin',cache:'no-store',headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let j={};
  try{j=text?JSON.parse(text):{}}catch{j={error:extractHtmlError(text)}}
  return {r,j,text};
}
async function mutation(path,method,body){
  let result=await mutationAttempt(path,method,body,false);
  const csrfRejected=result.r.status===403&&/csrf|forbidden/i.test(`${result.j?.error||''} ${result.j?.message||''} ${result.text||''}`);
  if(csrfRejected)result=await mutationAttempt(path,method,body,true);
  if(!result.r.ok||result.j.ok===false)throw new Error(result.j.error||result.j.message||extractHtmlError(result.text)||`HTTP ${result.r.status}`);
  return result.j;
}
function date(v){if(!v)return 'Chưa ghi giờ';const d=new Date(Number(v));return Number.isFinite(d.getTime())?d.toLocaleString('vi-VN',{hour12:false}):String(v)}
function daypart(time=''){const m=String(time).match(/(?:^|\D)([01]?\d|2[0-3])\s*(?::|gi[ờo]|h(?![A-Za-zÀ-ỹ]))/i);if(!m)return '';const h=Number(m[1]);if(h<=4)return 'rạng sáng';if(h<=8)return 'sáng sớm';if(h<=11)return 'buổi sáng';if(h<=13)return 'buổi trưa';if(h<=17)return 'buổi chiều';if(h<=22)return 'buổi tối';return 'đêm khuya'}
function storyParse(value=''){
  const text=String(value||'').trim();let year='',month='',day='',time='';
  const vi=[...text.matchAll(/ngày\s*(3[01]|[12]\d|0?[1-9])\s*(?:[-\/.]|tháng)\s*(1[0-2]|0?[1-9])(?:\s*(?:[-\/.]|năm)\s*((?:1[0-9]\d{2}|20\d{2}|21\d{2})))?/gi)].at(-1);
  if(vi){day=String(Number(vi[1]));month=String(Number(vi[2]));year=vi[3]||''}
  if(!month||!day){const dmy=[...text.matchAll(/\b(3[01]|[12]\d|0?[1-9])\s*[-\/.]\s*(1[0-2]|0?[1-9])\s*[-\/.]\s*((?:1[0-9]\d{2}|20\d{2}|21\d{2}))\b/g)].at(-1);if(dmy){day=String(Number(dmy[1]));month=String(Number(dmy[2]));year=dmy[3]||year}}
  if(!month||!day){const iso=[...text.matchAll(/\b((?:1[0-9]\d{2}|20\d{2}|21\d{2}))\s*[-\/.]\s*(1[0-2]|0?[1-9])(?:\s*[-\/.]\s*(3[01]|[12]\d|0?[1-9]))?/g)].at(-1);if(iso){year=iso[1]||year;month=String(Number(iso[2]||0)||'');day=String(Number(iso[3]||0)||'')}}
  if(!month||!day){const dm=[...text.matchAll(/(?:^|\D)(3[01]|[12]\d|0?[1-9])\s*(?:[-\/.]|\s*tháng\s*)\s*(1[0-2]|0?[1-9])(?![\d\/-])/gi)].at(-1);if(dm){day=String(Number(dm[1]));month=String(Number(dm[2]))}}
  const c=[...text.matchAll(/(?:^|\D)([01]?\d|2[0-3])\s*(?::|gi[ờo]|h(?![A-Za-zÀ-ỹ]))\s*([0-5]?\d)?\s*(?:phút)?/gi)].at(-1);if(c)time=`${String(Number(c[1])).padStart(2,'0')}:${String(Number(c[2]||0)).padStart(2,'0')}`;
  return {year,month,day,time};
}
function storyMerge(a={},b={}){return {year:a.year||b.year||'',month:a.month||b.month||'',day:a.day||b.day||'',time:a.time||b.time||''}}
function storyLabel(parts={}){const d=parts.month&&parts.day?(parts.year?`ngày ${parts.day}/${parts.month}/${parts.year}`:`ngày ${parts.day}/${parts.month}`):'';return [d,parts.time?daypart(parts.time):'',parts.time||''].filter(Boolean).join(' ')||'Chưa ghi giờ'}
function floorStory(floor){const n=Number(floor),rows=state.data?.view?.mainline||[];if(!Number.isFinite(n))return {};const candidates=rows.filter(r=>Number(r['Tầng']??r._sourceFloor)<=n).sort((a,b)=>Number(b['Tầng']??b._sourceFloor)-Number(a['Tầng']??a._sourceFloor));const row=candidates[0];return row?storyParse(`${row['Ngày']||''} ${row['Giờ bắt đầu']||''}`):{}}
function story(row){const own=storyParse([row?.['Ngày']||row?.date||'',row?.['Giờ bắt đầu']||row?.time||row?.storyTime||row?._recordedStoryTime||''].filter(Boolean).join(' '));const fallback=floorStory(row?.['Tầng']??row?._sourceFloor??row?.floor??row?.sourceFloor);return storyLabel(storyMerge(own,fallback))}
function orderItems(row){const items=Array.isArray(row?.items)?row.items:[];return items.map(x=>`${x.name||x.title||x.itemName||'Hàng hóa'}${x.spec||x.variant?` (${x.spec||x.variant})`:''} ×${x.quantity||x.qty||1}`).join('; ')||row?.itemSummary||row?.summary||'Chưa ghi nhận hàng hóa'}
function snippet(value,max=520){const raw=String(value??'').replace(/\s+/g,' ').trim();if(raw.length<=max)return raw;return `${raw.slice(0,Math.max(0,max-1))}…`}
function setStatus(text){$('#content').innerHTML=`<div class="empty big">${esc(text)}</div>`}
function resetHubViewport({sidebar=false}={}){
  const apply=()=>{
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch{try{window.scrollTo(0,0)}catch{}}
    try{document.documentElement.scrollTop=0}catch{}
    try{document.body.scrollTop=0}catch{}
    const main=document.querySelector('.hub-main');if(main)main.scrollTop=0;
    const content=document.querySelector('#content');if(content)content.scrollTop=0;
    if(sidebar){const list=document.querySelector('#archive-list');if(list)list.scrollTop=0}
  };
  apply();
  requestAnimationFrame(()=>requestAnimationFrame(apply));
}
try{if('scrollRestoration' in history)history.scrollRestoration='manual'}catch{}

async function loadArchives(){
  try{
    const j=await get('/hub/characters');state.archives=j.archives||[];renderArchives();
    if(state.selected){const same=state.archives.find(a=>a.archiveId===state.selected.archiveId&&a.characterKey===state.selected.characterKey);if(same)await selectArchive(same);else state.selected=null}
    if(!state.selected&&state.archives[0])await selectArchive(state.archives[0]);
    if(!state.archives.length){state.selected=null;state.data=null;$('#archive-title').textContent='Chưa có hồ sơ vĩnh viễn';$('#archive-subtitle').textContent='Tiếp tục chạy 0-32 trong SillyTavern, hồ sơ sẽ tự động được lập';setStatus('Không có hồ sơ vĩnh viễn nào để hiển thị.')}
  }catch(e){setStatus(`Memory Hub không đọc được hồ sơ vĩnh viễn: ${e.message}`)}
}
function archiveKey(a){return `${String(a?.characterKey||'')}\u0000${String(a?.archiveId||'')}`}
function archiveRowsFiltered(){const q=$('#archive-filter').value.trim().toLowerCase();return state.archives.filter(a=>!q||`${a.characterName} ${a.chatName}`.toLowerCase().includes(q))}
function updateArchiveBulkBar(){
  const count=state.archiveSelections.size;
  const label=$('#archive-selected-count');if(label)label.textContent=count?`Đã chọn ${count}`:'Chưa chọn';
  const button=$('#archive-bulk-delete');if(button){button.disabled=!count;button.textContent=count?`Xóa hàng loạt ${count}`:'Xóa hàng loạt'}
}
function toggleArchiveSelection(a,checked){const key=archiveKey(a);if(checked)state.archiveSelections.add(key);else state.archiveSelections.delete(key);updateArchiveBulkBar()}
function selectVisibleArchives(){for(const a of archiveRowsFiltered())state.archiveSelections.add(archiveKey(a));renderArchives()}
function clearArchiveSelections(){state.archiveSelections.clear();renderArchives()}
function renderArchives(){
  const rows=archiveRowsFiltered();
  // Drop selections that no longer exist after a refresh.
  const live=new Set(state.archives.map(archiveKey));for(const key of [...state.archiveSelections])if(!live.has(key))state.archiveSelections.delete(key);
  $('#archive-list').innerHTML=rows.length?rows.map(a=>`<div class="archive-row ${state.selected?.archiveId===a.archiveId?'active':''}"><label class="archive-select" title="Thêm vào danh sách xóa hàng loạt"><input type="checkbox" data-archive-select="${esc(a.archiveId)}" data-character="${esc(a.characterKey)}" ${state.archiveSelections.has(archiveKey(a))?'checked':''}><span></span></label><button class="archive ${state.selected?.archiveId===a.archiveId?'active':''}" data-archive="${esc(a.archiveId)}" data-character="${esc(a.characterKey)}"><b>${esc(a.characterName||'Nhân vật chưa đặt tên')}</b><small>${esc(a.chatName||'Cuộc trò chuyện chưa đặt tên')} · ${date(a.updatedAt)}</small></button><button class="archive-trash" data-archive-delete="${esc(a.archiveId)}" data-character="${esc(a.characterKey)}" title="Xóa hồ sơ này">🗑</button></div>`).join(''):'<div class="empty">Không có hồ sơ nào khớp</div>';
  document.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>selectArchive(state.archives.find(a=>a.archiveId===b.dataset.archive&&a.characterKey===b.dataset.character)));
  document.querySelectorAll('[data-archive-select]').forEach(b=>b.onchange=()=>{const a=state.archives.find(x=>x.archiveId===b.dataset.archiveSelect&&x.characterKey===b.dataset.character);if(a)toggleArchiveSelection(a,b.checked)});
  document.querySelectorAll('[data-archive-delete]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const a=state.archives.find(x=>x.archiveId===b.dataset.archiveDelete&&x.characterKey===b.dataset.character);if(a)await deleteArchive(a)});
  updateArchiveBulkBar();
}
async function bulkDeleteArchives(){
  const selected=state.archives.filter(a=>state.archiveSelections.has(archiveKey(a)));
  if(!selected.length)return;
  const preview=selected.slice(0,8).map(a=>`• ${a.characterName||'Nhân vật chưa đặt tên'} / ${a.chatName||'Cuộc trò chuyện chưa đặt tên'}`).join('\n');
  if(!confirm(`Xác nhận xóa hàng loạt ${selected.length} hồ sơ vĩnh viễn?\n\n${preview}${selected.length>8?`\n…và ${selected.length-8} hồ sơ khác`:''}\n\nCác hồ sơ này sẽ được chuyển vào khu thùng rác hub-trash trên máy chủ, không bị hủy vật lý ngay.`))return;
  const btn=$('#archive-bulk-delete');if(btn){btn.disabled=true;btn.textContent='Đang xóa…'}
  try{
    const result=await mutation('/hub/archive/bulk-delete','POST',{archives:selected.map(a=>({characterKey:a.characterKey,archiveId:a.archiveId}))});
    const deletedKeys=new Set((result.deleted||[]).map(x=>`${x.characterKey}\u0000${x.archiveId}`));
    if(state.selected&&deletedKeys.has(archiveKey(state.selected))){state.selected=null;state.data=null}
    state.archiveSelections.clear();
    await loadArchives();
    resetHubViewport();
    if((result.errors||[]).length)alert(`Đã xóa ${result.deleted?.length||0} hồ sơ; ${result.errors.length} hồ sơ thất bại.\n\n${result.errors.slice(0,6).map(x=>x.error).join('\n')}`);
  }catch(e){alert(`Xóa hàng loạt thất bại: ${e.message}`)}finally{updateArchiveBulkBar()}
}
async function selectArchive(a,{resetScroll=true}={}){if(!a)return;state.selected=a;renderArchives();setStatus('Đang tải ký ức vĩnh viễn…');if(resetScroll)resetHubViewport();try{const q=new URLSearchParams({characterKey:a.characterKey,archiveId:a.archiveId});state.data=await get(`/hub/archive?${q}`);$('#archive-title').textContent=a.characterName||'Nhân vật chưa đặt tên';$('#archive-subtitle').textContent=`${a.chatName||'Cuộc trò chuyện chưa đặt tên'} · lưu lần cuối ${date(a.updatedAt)}`;renderStats();render();if(resetScroll)resetHubViewport()}catch(e){setStatus(e.message);if(resetScroll)resetHubViewport()}}
function renderStats(){const v=state.data?.view||{};const rows=[['Dòng thời gian',v.mainline?.length||0],['Lời hẹn chờ',(v.promises||[]).filter(x=>!/Đã thực hiện|Đã hoàn thành|[Hh]ủy/.test(x['Trạng thái']||'')).length],['Nhân vật',v.people?.length||0],['Quan hệ',v.relations?.length||0],['Ký ức nguyên tử',(v.anchors?.length||0)+(v.episodeFacts?.length||0)+(v.lifeFacts?.length||0)],['Đơn hàng điện thoại',v.orders?.length||0]];$('#stats').innerHTML=rows.map(([a,b])=>`<article class="stat"><span>${a}</span><b>${b}</b></article>`).join('')}
function recent(rows,n=8){return (rows||[]).slice(-n).reverse()}
function registerDelete(path,item,label='Xóa'){if(!path||!item)return '';const id=`d${++state.deleteSeq}`;state.deleteRefs.set(id,{path,item,label});return `<button class="memory-delete" data-hub-delete="${id}" title="Xóa mẩu ký ức này khỏi hồ sơ vĩnh viễn hiện tại">Xóa</button>`}
async function deleteMemory(ref){if(!state.selected||!ref)return;const title=ref.item?.['Tóm tắt sự kiện']||ref.item?.['Nội dung lời hẹn']||ref.item?.['Họ tên']||ref.item?.event||ref.item?.fact||ref.item?.storeName||ref.item?.merchant||ref.label||'mẩu ký ức này';if(!confirm(`Xác nhận xóa “${snippet(title,90)}”?\n\nMục này sẽ biến mất khỏi giao diện Memory Hub hiện tại và khỏi các lần gợi nhớ sau; ảnh chụp lịch sử trước khi xóa vẫn được giữ.`))return;await mutation('/hub/item','DELETE',{characterKey:state.selected.characterKey,archiveId:state.selected.archiveId,path:ref.path,item:ref.item});await selectArchive(state.selected,{resetScroll:false})}
function bindDeletes(){document.querySelectorAll('[data-hub-delete]').forEach(b=>b.onclick=async()=>{const ref=state.deleteRefs.get(b.dataset.hubDelete);if(!ref)return;b.disabled=true;try{await deleteMemory(ref)}catch(e){alert(`Xóa thất bại: ${e.message}`)}finally{b.disabled=false}})}
async function deleteArchive(a){if(!confirm(`Xác nhận xóa toàn bộ hồ sơ?\n\nNhân vật: ${a.characterName||'Nhân vật chưa đặt tên'}\nCuộc trò chuyện: ${a.chatName||'Cuộc trò chuyện chưa đặt tên'}\n\nHồ sơ sẽ được chuyển vào khu thùng rác trên máy chủ; nếu đây là cuộc trò chuyện đang chơi, lần lưu kế tiếp của 0-32 có thể tự lập một hồ sơ trống mới.`))return;try{await mutation('/hub/archive','DELETE',{characterKey:a.characterKey,archiveId:a.archiveId});state.archiveSelections.delete(archiveKey(a));if(state.selected?.archiveId===a.archiveId&&state.selected?.characterKey===a.characterKey){state.selected=null;state.data=null}await loadArchives();resetHubViewport()}catch(e){alert(`Xóa hồ sơ thất bại: ${e.message}`)}}

function render(){
  if(!state.data)return;state.deleteRefs.clear();state.deleteSeq=0;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));const v=state.data.view||{};
  if(state.tab==='overview')overview(v);else if(state.tab==='timeline')timeline(v);else if(state.tab==='promises')promises(v);else if(state.tab==='people')people(v);else if(state.tab==='orders')orders(v);else if(state.tab==='facts')facts(v);else if(state.tab==='search')searchResults();
  bindDeletes();
}
function overview(v){const events=recent(v.mainline,6);const ps=recent((v.promises||[]).filter(x=>!/Đã thực hiện|Đã hoàn thành|[Hh]ủy/.test(x['Trạng thái']||'')),6);$('#content').innerHTML=`<div class="grid"><article class="card"><h3>📍 Cảnh hiện tại</h3><p>${esc(Object.entries(v.scene||{}).filter(([,x])=>x).map(([k,x])=>`${k}: ${x}`).join(' · ')||'Chưa ghi nhận')}</p></article><article class="card"><h3>🧠 Trang này hiện giải quyết điều gì</h3><p>Hồ sơ vĩnh viễn có thể xem, có thể tìm và có thể xóa tay những mẩu ký ức sai. Thời gian hiển thị thống nhất theo “ngày/tháng/năm + buổi + HH:mm”; RAG vector và xếp hạng lại về sau vẫn nối vào đây.</p></article></div><h3>Sự kiện gần đây</h3><div class="list">${events.map(r=>eventCard(r,'tables.mainline')).join('')||'<div class="empty">Chưa có</div>'}</div><h3>Lời hẹn chờ thực hiện</h3><div class="list">${ps.map(r=>promiseCard(r,'tables.promises')).join('')||'<div class="empty">Chưa có</div>'}</div>`}
function eventCard(r,path='tables.mainline'){return `<article class="row-card"><div><b class="stamp">${esc(story(r))}</b><div class="floor">Tầng ${esc(r['Tầng']??r._sourceFloor??'?')}</div></div><div><h3>${esc(snippet(r['Tóm tắt sự kiện']||'Sự kiện chưa đặt tên',620))}</h3><div class="meta"><span class="pill">${esc(r['Trạng thái']||'')}</span></div></div><div class="row-actions"><span>›</span>${registerDelete(path,r)}</div></article>`}
function promiseCard(r,path='tables.promises'){const recorded=storyLabel(storyMerge(storyParse(r._recordedStoryTime||''),floorStory(r['Tầng']??r._sourceFloor)));return `<article class="row-card"><div><b class="stamp">Ghi nhận: ${esc(recorded)}</b><div class="floor">Tầng ${esc(r['Tầng']??r._sourceFloor??'?')}</div></div><div><h3>${esc(snippet(r['Nội dung lời hẹn']||'Lời hẹn chưa đặt tên',520))}</h3><p>Thực hiện: ${esc(r._due||r['Thời điểm hẹn']||'chưa định')} · ${esc(r['Nhân vật cốt lõi']||'')}</p></div><div class="row-actions"><span class="pill good">${esc(r['Trạng thái']||'Chờ thực hiện')}</span>${registerDelete(path,r)}</div></article>`}
function timeline(v){$('#content').innerHTML=`<div class="list">${(v.mainline||[]).slice().reverse().map(r=>eventCard(r,'tables.mainline')).join('')||'<div class="empty">Chưa có dòng thời gian</div>'}</div>`}
function promises(v){$('#content').innerHTML=`<div class="list">${(v.promises||[]).slice().reverse().map(r=>promiseCard(r,'tables.promises')).join('')||'<div class="empty">Chưa có lời hẹn</div>'}</div>`}
function people(v){const rel=new Map();for(const r of v.relations||[]){for(const n of [r['Nhân vật A'],r['Nhân vật B']].filter(Boolean)){if(!rel.has(n))rel.set(n,[]);rel.get(n).push(r)}}$('#content').innerHTML=`<div class="grid">${(v.people||[]).map(p=>`<article class="card memory-card"><div class="card-head"><h3>${esc(p['Họ tên']||'Chưa đặt tên')}</h3>${registerDelete('tables.people',p)}</div><p>${esc(p['Thân phận']||'Chưa ghi thân phận')} · ${esc(p['Tuổi']||'Chưa rõ tuổi')}</p><p>${esc(snippet(p['Tính cách']||p['Ghi chú']||'',460))}</p><div class="meta"><span>${(rel.get(p['Họ tên'])||[]).length} quan hệ</span></div></article>`).join('')||'<div class="empty">Chưa có nhân vật</div>'}</div><h3>Quan hệ nhân vật</h3><div class="list">${(v.relations||[]).map(r=>`<article class="card relation"><div class="node">${esc(r['Nhân vật A']||'?')}</div><div><b>${esc(r['Mô tả quan hệ']||'Chưa ghi quan hệ')}</b><p>${esc(snippet(r['Thái độ tình cảm']||r._psychologyChange||'',420))}</p></div><div class="relation-end"><div class="node">${esc(r['Nhân vật B']||'?')}</div>${registerDelete('tables.relations',r)}</div></article>`).join('')}</div>`}
function orders(v){$('#content').innerHTML=`<div class="list">${(v.orders||[]).map(r=>{const platform=String(r.platform||'');const p=platform?`phone.commerce.${platform}.orders`:'';return `<article class="row-card"><div><b class="stamp">${esc(story(r))}</b><div class="floor">Tầng ${esc(r.sourceFloor??'?')} · ${esc(platform)}</div></div><div><h3>${esc(r.storeName||r.merchant||'Chưa ghi cửa hàng')}</h3><p class="order-items">${esc(orderItems(r))}</p><p>Thực trả: ${esc(r.amount??'Chưa ghi nhận')} · Trạng thái: ${esc(r.status||'')}</p></div><div class="row-actions"><span class="pill good">Sự thật hệ thống</span>${p?registerDelete(p,r):''}</div></article>`}).join('')||'<div class="empty">Chưa có đơn hàng điện thoại</div>'}</div>`}
function facts(v){const rows=[...(v.anchors||[]).map(x=>({...x,_t:'Neo cốt lõi',_text:x.event||x.details,_time:[x.date,x.time].filter(Boolean).join(' '),_path:'memoryAnchors',_raw:x})),...(v.episodeFacts||[]).map(x=>({...x,_t:'Sự kiện nguyên tử',_text:x.fact,_time:x.time||'',_path:'episodeFacts',_raw:x})),...(v.lifeFacts||[]).map(x=>({...x,_t:'Sự thật đời thường',_text:x.fact||`${x.key||x.category}: ${x.value||''}`,_time:x.time||'',_path:'lifeFacts',_raw:x}))].sort((a,b)=>Number(b.floor||0)-Number(a.floor||0));$('#content').innerHTML=`<div class="list">${rows.map(r=>`<article class="row-card"><div><b class="stamp">${esc(storyLabel(storyMerge(storyParse(r._time),floorStory(r.floor))))}</b><div class="floor">Tầng ${esc(r.floor??'?')}</div></div><div><h3>${esc(r._t)}</h3><p>${esc(snippet(r._text||'',560))}</p></div><div class="row-actions"><span class="pill">${esc(r.importance||r.status||'')}</span>${registerDelete(r._path,r._raw)}</div></article>`).join('')||'<div class="empty">Chưa có ký ức nguyên tử</div>'}</div>`}
async function runSearch(){if(!state.selected)return;const q=$('#memory-query').value.trim();const p=new URLSearchParams({characterKey:state.selected.characterKey,archiveId:state.selected.archiveId,q,limit:'80'});setStatus('Đang truy xuất ký ức vĩnh viễn…');try{const j=await get(`/hub/search?${p}`);state.results=j.results||[];state.tab='search';render()}catch(e){setStatus(e.message)}}
function searchResults(){const q=$('#memory-query').value.trim();$('#content').innerHTML=`<div class="meta" style="margin-bottom:10px">${state.results.length} kết quả · truy vấn “${esc(q||'ký ức gần đây')}”</div><div class="list">${state.results.map(r=>`<article class="row-card search-hit"><div><b class="stamp">${esc(storyLabel(storyMerge(storyParse(r.storyTime||''),floorStory(r.floor))))}</b><div class="floor">Tầng ${esc(r.floor??'?')} · ${esc(r.type)}</div></div><div><h3>${esc(r.title)}</h3><p>${esc(snippet(r.text,520))}</p></div><div class="row-actions"><span class="pill">${esc(r.score??'')}</span>${r.deletePath&&r.deleteItem?registerDelete(r.deletePath,r.deleteItem):''}</div></article>`).join('')||'<div class="empty">Không có kết quả</div>'}</div>`}

$('#archive-filter').addEventListener('input',renderArchives);$('#archive-select-visible').onclick=selectVisibleArchives;$('#archive-clear-selection').onclick=clearArchiveSelections;$('#archive-bulk-delete').onclick=bulkDeleteArchives;$('#refresh').onclick=loadArchives;$('#back-st').onclick=()=>{location.href='/'};$('#memory-search').onclick=runSearch;$('#memory-query').addEventListener('keydown',e=>{if(e.key==='Enter')runSearch()});document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
loadArchives();
