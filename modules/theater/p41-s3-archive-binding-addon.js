(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]));
  let enhanceTimer=0;
  function bridge(){return globalThis.VVVTheaterMemoryBridge||null;}
  const LEGACY_ARCHIVE_STYLE_ID='vvvtm-s5-archive-style';
  function removeLegacyArchiveStyle(){document.getElementById(LEGACY_ARCHIVE_STYLE_ID)?.remove();}
  function downloadJson(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function syncNow(button){const b=bridge();if(!b?.syncPermanentArchive)throw new Error('Cầu nối hồ sơ vĩnh viễn chưa được nạp');button&&(button.disabled=true);try{await b.syncPermanentArchive('manual-archive-sync');alert('✅ Toàn bộ dữ liệu 0-32 sinh ra trong cuộc trò chuyện này đã được đồng bộ vào hồ sơ vĩnh viễn của thẻ nhân vật.');}finally{button&&(button.disabled=false)}}
  async function exportBundle(button){const b=bridge();if(!b?.exportCurrentCharacterArchives)throw new Error('Cầu nối hồ sơ vĩnh viễn chưa được nạp');button&&(button.disabled=true);try{await b.syncPermanentArchive?.('before-cardvault-export');const d=await b.exportCurrentCharacterArchives();const bundle=d?.bundle||d;const name=String(bundle?.characterName||'Nhân vật').replace(/[\\/:*?"<>|]+/g,'_');downloadJson(`${name}_0-32-ho-so-di-kem-the-nhan-vat.json`,bundle);alert('✅ Đã xuất hồ sơ đi kèm thẻ nhân vật. CardVault có thể lưu thẳng cùng bundle này.');}finally{button&&(button.disabled=false)}}
  function panelHtml(){
    const b=bridge(),binding=b?.getArchiveBinding?.()||{},identity=b?.getArchiveIdentity?.()||{};
    const ready=Boolean(binding.archiveId);
    return `<div id="vvvtm-s5-archive-dialog" role="dialog" aria-modal="true" aria-label="Hồ sơ vĩnh viễn 0-32">
      <div class="s5-head"><h3>📁 Hồ sơ vĩnh viễn <span class="s5-status ${ready?'s5-ok':'s5-warn'}">${ready?'● Đã gắn kết':'● Đang khởi tạo'}</span></h3><button class="s5-close" data-s5-close>×</button></div>
      <p class="s5-note">Mọi thứ do thẻ nhân vật / cuộc trò chuyện hiện tại sinh ra đều được lưu tại đây: ký ức, dòng thời gian, nhân vật và quan hệ, lời hẹn và bí mật, các cấp tổng kết, điện thoại, Khoảnh khắc, nhật ký, ngày kỷ niệm, Bỉ Gian Tư Văn, ngoại hình nhân vật, chương hồi và nguồn truy xuất. S10 gắn kết vĩnh viễn độc lập theo “thẻ nhân vật + từng đoạn chat”: chat mới dùng hồ sơ mới, quay lại chat cũ vẫn khôi phục hồ sơ cũ; nâng cấp/hạ cấp tiện ích chỉ thay mã nguồn, thao tác lưu thông thường không tự xóa bất kỳ lịch sử nào.</p>
      <div class="s5-info">
        <div><small>Nhân vật</small><b>${esc(identity.characterName||'Chưa nhận diện')}</b></div>
        <div><small>ID hồ sơ của chat hiện tại</small><b title="${esc(binding.archiveId||'')}">${esc(binding.archiveId||'Đang khởi tạo…')}</b></div>
        <div><small>Thư mục vĩnh viễn trên máy chủ</small><b title="${esc(binding.relativePath||'')}">${esc(binding.relativePath||'data/vvv/vvv-theater-memory/card-archives/...')}</b></div>
        <div><small>Cầu nối CardVault</small><b>${globalThis.VVVTheaterMemoryBridge?.exportCurrentCharacterArchives?'Sẵn sàng':'Đang chờ nạp'}</b></div>
      </div>
      <div class="s5-actions"><button data-s5-sync>Đồng bộ ngay</button><button data-s5-export>📦 Xuất hồ sơ đi kèm CardVault</button></div>
    </div>`;
  }
  function ensureTopButton(){
    const actions=document.querySelector('#vvvtm-modal .vvvtm-head-actions');if(!actions)return;
    let btn=document.getElementById('vvvtm-s5-archive-button');
    if(!btn){btn=document.createElement('button');btn.id='vvvtm-s5-archive-button';btn.type='button';btn.textContent='📁 Hồ sơ vĩnh viễn';btn.title='Xem hồ sơ vĩnh viễn 0-32 đang gắn với nhân vật / cuộc trò chuyện hiện tại';const exportBtn=actions.querySelector('[data-action="export"]');if(exportBtn)actions.insertBefore(btn,exportBtn);else actions.appendChild(btn);}
  }
  function ensureOverlay(){
    const modal=document.getElementById('vvvtm-modal');if(!modal)return null;
    let overlay=document.getElementById('vvvtm-s5-archive-overlay');
    if(!overlay){overlay=document.createElement('div');overlay.id='vvvtm-s5-archive-overlay';overlay.hidden=true;modal.appendChild(overlay);}
    return overlay;
  }
  function closePanel(){const overlay=document.getElementById('vvvtm-s5-archive-overlay');if(overlay)overlay.hidden=true;}
  function openPanel(){
    const overlay=ensureOverlay();if(!overlay)return;
    overlay.innerHTML=panelHtml();overlay.hidden=false;
    overlay.querySelector('[data-s5-close]')?.addEventListener('click',closePanel);
    overlay.querySelector('[data-s5-sync]')?.addEventListener('click',async e=>{try{await syncNow(e.currentTarget);openPanel()}catch(err){alert(`Đồng bộ thất bại: ${err.message}`)}});
    overlay.querySelector('[data-s5-export]')?.addEventListener('click',async e=>{try{await exportBundle(e.currentTarget)}catch(err){alert(`Xuất dữ liệu thất bại: ${err.message}`)}});
  }
  function removeOverviewCard(){document.getElementById('vvvtm-s3-archive-card')?.remove();}
  function removeOldTakeoverText(){document.querySelectorAll('#vvvtm-content .vvvtm-counter-note').forEach(n=>{if(/Khóa an toàn hồ sơ cũ|Tiếp quản hồ sơ cũ một chạm/.test(n.textContent||''))n.remove()});}
  function enhance(){removeLegacyArchiveStyle();ensureTopButton();ensureOverlay();removeOverviewCard();removeOldTakeoverText();}

  globalThis.VVVTheaterCardVaultBridge=Object.assign(globalThis.VVVTheaterCardVaultBridge||{}, {
    schema:'vvv-theater-cardvault-bundle-v2',
    async exportForCurrentCharacter(){const b=bridge();await b?.syncPermanentArchive?.('cardvault-bridge-export');const d=await b?.exportCurrentCharacterArchives?.();return d?.bundle||d;},
    async importForCurrentCharacter(bundle){const b=bridge();const d=await b?.importCharacterArchives?.(bundle);return d;},
    getCurrentBinding(){return bridge()?.getArchiveBinding?.()||{};},
  });
  globalThis.dispatchEvent?.(new CustomEvent('vvv-theater-cardvault-bridge-ready',{detail:{schema:'vvv-theater-cardvault-bundle-v2'}}));

  function scheduleEnhance(delay=40){if(enhanceTimer)clearTimeout(enhanceTimer);enhanceTimer=setTimeout(()=>{enhanceTimer=0;enhance();},delay);}
  function start(){enhance();globalThis.addEventListener('vvvtm-ui-ready',()=>scheduleEnhance(0));globalThis.addEventListener('vvvtm-content-rendered',()=>scheduleEnhance(0));document.addEventListener('click',e=>{if(e.target.closest?.('#vvvtm-s5-archive-button')){e.preventDefault();e.stopPropagation();openPanel();return;}if(e.target?.id==='vvvtm-s5-archive-overlay')closePanel();},true);console.info('[0-32·P41-S10] Đã nạp nút hồ sơ vĩnh viễn trên đầu trang + cầu nối CardVault v2; U1.7 chuyển sang chạy theo sự kiện UI của chính 0-32, không dùng bộ quan sát DOM toàn cục.');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
